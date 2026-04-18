/* =============================================
   AI 内容生成站 - App JS
   ============================================= */

(function () {
  'use strict';

  // ---- State ----
  let currentTab = 'chat';
  let currentResult = {};
  let progressInterval = null;
  let activeProgressTab = null;

  // ---- Chat Queue State ----
  let chatQueue = [];
  let isChatGenerating = false;
  let pendingChatInput = null; // 保存排队时用户输入的内容

  // ---- DOM helpers ----
  const $ = id => document.getElementById(id);
  const $$ = (sel, ctx) => (ctx || document).querySelectorAll(sel);
  const appShell = window.AppShell || null;
  const persistence = appShell && window.fetch ? appShell.createRemotePersistence(window.fetch.bind(window)) : null;
  const templates = appShell?.TEMPLATE_LIBRARY || {};
  const featureMeta = appShell?.FEATURE_META || {};
  const historyState = {};
  let currentUser = null;

  const FEATURE_FIELDS = {
    lyrics: { prompt: 'lyrics-prompt', style: 'lyrics-style', structure: 'lyrics-structure' },
    cover: { prompt: 'cover-prompt', ratio: 'cover-ratio', style: 'cover-style' },
    speech: { text: 'speech-text', voice_id: 'speech-voice', emotion: 'speech-emotion', speed: 'speech-speed', pitch: 'speech-pitch', vol: 'speech-vol', output_format: 'speech-format' },
    music: { prompt: 'music-prompt', style: 'music-style', bpm: 'music-bpm', key: 'music-key', duration: 'music-duration' },
    covervoice: { prompt: 'voice-prompt', timbre: 'voice-timbre', pitch: 'voice-pitch', audio_url: 'voice-audio-url' }
  };

  const RESULT_IDS = {
    covervoice: 'covervoice-result',
    speech: 'speech-result'
  };

  const COUNTER_IDS = {
    'music-prompt': 'music-char',
    'lyrics-prompt': 'lyrics-char',
    'cover-prompt': 'cover-char',
    'voice-prompt': 'voice-char',
    'speech-text': 'speech-char'
  };

  function getResultArea(feature) {
    return $(RESULT_IDS[feature] || `${feature}-result`);
  }

  function syncCounter(inputId) {
    const counterId = COUNTER_IDS[inputId];
    if (!counterId) return;
    const input = $(inputId);
    const counter = $(counterId);
    if (input && counter) counter.textContent = (input.value || '').length;
  }

  function syncSelectDropdown(selectId) {
    const select = $(selectId);
    if (!select) return;
    const dropdown = $(`${selectId}-dropdown`);
    if (!dropdown) return;
    const valueSpan = dropdown.querySelector('.dropdown-value');
    const options = dropdown.querySelectorAll('.dropdown-option');
    const selected = Array.from(select.options).find(opt => opt.value === select.value) || select.options[0];
    if (valueSpan && selected) valueSpan.textContent = selected.text;
    options.forEach(option => option.classList.toggle('active', option.dataset.value === select.value));
  }

  function setFieldValue(inputId, value) {
    const input = $(inputId);
    if (!input) return;
    if (input.type === 'range') {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    input.value = value == null ? '' : value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    syncCounter(inputId);
    syncSelectDropdown(inputId);
  }

  function formatTime(timestamp) {
    try {
      return new Date(timestamp).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function truncateText(text, length = 72) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= length) return normalized;
    return `${normalized.slice(0, length)}...`;
  }

  function ensureAuthGate() {
    if ($('auth-gate')) return;
    const gate = document.createElement('div');
    gate.id = 'auth-gate';
    gate.className = 'auth-gate';
    gate.hidden = true;
    gate.innerHTML = `
      <div class="auth-card">
        <div class="auth-eyebrow">固定账号登录</div>
        <h2>先登录，再继续创作</h2>
        <p>这个站点现在会为固定账号保存所有功能的历史记录与模板使用状态。</p>
        <div class="auth-credentials">
          <div><strong>默认账号：</strong><code>studio</code></div>
          <div><strong>默认密码：</strong><code>AIGS2026!</code></div>
        </div>
        <form id="auth-form" class="auth-form">
          <label>账号<input id="auth-username" type="text" autocomplete="username" value="studio" /></label>
          <label>密码<input id="auth-password" type="password" autocomplete="current-password" value="AIGS2026!" /></label>
          <div id="auth-error" class="auth-error"></div>
          <button class="btn btn-primary" type="submit">进入工作台</button>
        </form>
      </div>
    `;
    document.body.appendChild(gate);
    $('auth-form')?.addEventListener('submit', handleLoginSubmit);
  }

  function renderUserPanel() {
    const panel = $('user-panel');
    if (!panel) return;
    if (!currentUser) {
      panel.innerHTML = '<div class="user-panel-empty">未登录，历史记录将不会展示。</div>';
      return;
    }
    panel.innerHTML = `
      <div class="user-panel-row">
        <div class="user-panel-label">
          <strong>${currentUser}</strong>
          <span>历史记录已启用</span>
        </div>
        <button id="btn-logout" type="button">退出</button>
      </div>
    `;
    $('btn-logout')?.addEventListener('click', logout);
  }

  function showAuthGate() {
    $('auth-gate')?.removeAttribute('hidden');
    document.querySelector('.app')?.classList.add('auth-locked');
  }

  function hideAuthGate() {
    $('auth-gate')?.setAttribute('hidden', '');
    document.querySelector('.app')?.classList.remove('auth-locked');
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    const username = $('auth-username')?.value?.trim();
    const password = $('auth-password')?.value;
    const error = $('auth-error');
    try {
      const user = await persistence?.login(username, password);
      currentUser = user?.username || username;
      if (error) error.textContent = '';
      renderUserPanel();
      hideAuthGate();
      await loadAllHistories();
      showToast(`欢迎回来，${currentUser}`, 'success', 1800);
    } catch (loginError) {
      if (error) error.textContent = loginError.message || '账号或密码不正确';
    }
  }

  async function logout() {
    currentUser = null;
    historyState.chat = [];
    Object.keys(featureMeta).forEach(feature => { historyState[feature] = []; renderHistory(feature); });
    try {
      await persistence?.logout();
    } catch {
      // Ignore logout failures and still lock UI locally.
    }
    restoreChatMessages([]);
    renderUserPanel();
    showAuthGate();
  }

  async function bootstrapAuth() {
    ensureAuthGate();
    renderUserPanel();
    showAuthGate();
    try {
      const session = await persistence?.loadSession();
      if (!session?.username) {
        return;
      }
      currentUser = session.username;
      renderUserPanel();
      hideAuthGate();
      await loadAllHistories();
    } catch {
      showAuthGate();
    }
  }

  function ensureFeatureExtensions() {
    Object.keys(featureMeta).forEach(feature => {
      const section = $(`tab-${feature}`);
      if (!section || section.querySelector(`[data-feature-shell="${feature}"]`)) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'feature-extensions';
      wrapper.dataset.featureShell = feature;
      wrapper.innerHTML = `
        <section class="feature-card">
          <h3>${featureMeta[feature].title}模板库</h3>
          <p>按场景选模板，减少手动组织提示词和参数。</p>
          <div class="template-groups" id="template-groups-${feature}"></div>
        </section>
        <aside class="feature-card">
          <h3>${featureMeta[feature].historyTitle}</h3>
          <p>自动保存当前账号下的最近记录，可随时恢复。</p>
          <div class="history-list" id="history-list-${feature}"></div>
          <div class="history-empty" id="history-empty-${feature}">还没有历史记录，先跑一次生成或对话。</div>
        </aside>
      `;
      section.appendChild(wrapper);
    });
  }

  function renderTemplateLibraries() {
    Object.entries(templates).forEach(([feature, groups]) => {
      const container = $(`template-groups-${feature}`);
      if (!container) return;
      container.innerHTML = groups.map((group, groupIndex) => `
        <div class="template-category">
          <div class="template-category-header">
            <div class="template-category-title">${group.category}</div>
            <div class="template-category-meta">${group.items.length} 个模板</div>
          </div>
          <div class="template-list">
            ${group.items.map((item, itemIndex) => `
              <article class="template-item">
                <strong>${item.label}</strong>
                <span>${item.description}</span>
                <button type="button" data-template-feature="${feature}" data-template-group="${groupIndex}" data-template-item="${itemIndex}">
                  ${feature === 'chat' ? '一键发送' : '应用模板'}
                </button>
              </article>
            `).join('')}
          </div>
        </div>
      `).join('');
    });
  }

  function getFeatureInputs(feature) {
    const config = FEATURE_FIELDS[feature] || {};
    return Object.keys(config).reduce((acc, key) => {
      const inputId = config[key];
      const input = $(inputId);
      if (input) acc[key] = input.value;
      return acc;
    }, {});
  }

  function applyFeatureInputs(feature, values) {
    const config = FEATURE_FIELDS[feature] || {};
    Object.keys(values || {}).forEach(key => {
      const inputId = config[key];
      if (inputId) setFieldValue(inputId, values[key]);
    });
  }

  function renderHistory(feature) {
    const list = $(`history-list-${feature}`);
    const empty = $(`history-empty-${feature}`);
    if (!list || !empty) return;
    const entries = historyState[feature] || [];
    if (!currentUser || entries.length === 0) {
      list.innerHTML = '';
      empty.removeAttribute('hidden');
      return;
    }
    empty.setAttribute('hidden', '');
    list.innerHTML = entries.map((entry, index) => `
      <article class="history-item">
        <div class="history-item-header">
          <strong>${entry.title}</strong>
          <time>${formatTime(entry.timestamp)}</time>
        </div>
        <p>${entry.summary || '无摘要'}</p>
        <div class="history-actions">
          <button type="button" data-history-feature="${feature}" data-history-index="${index}" data-history-action="restore">恢复</button>
          ${feature === 'chat' ? '<button type="button" data-history-feature="chat" data-history-index="' + index + '" data-history-action="reuse">继续对话</button>' : ''}
        </div>
      </article>
    `).join('');
  }

  async function loadAllHistories() {
    if (!currentUser || !persistence) {
      Object.keys(featureMeta).forEach(feature => {
        historyState[feature] = [];
        renderHistory(feature);
      });
      restoreLatestChat();
      return;
    }

    await Promise.all(Object.keys(featureMeta).map(async feature => {
      try {
        historyState[feature] = await persistence.getHistory(currentUser, feature);
      } catch {
        historyState[feature] = [];
      }
      renderHistory(feature);
    }));
    restoreLatestChat();
  }

  function saveHistoryEntry(feature, entry) {
    if (!currentUser || !persistence) return;
    historyState[feature] = [entry].concat(historyState[feature] || []).slice(0, appShell?.MAX_HISTORY_ITEMS || 12);
    renderHistory(feature);
    persistence.appendHistory(currentUser, feature, entry)
      .then(items => {
        historyState[feature] = items;
        renderHistory(feature);
        if (feature === 'chat') {
          restoreLatestChat();
        }
      })
      .catch(() => {
        showToast(`${featureMeta[feature]?.title || feature} 历史保存失败`, 'error', 1800);
      });
  }

  function restoreChatMessages(messages) {
    const container = $('chat-messages');
    const chatContainer = document.querySelector('.chat-container');
    const tabChat = $('tab-chat');
    if (!container) return;
    container.innerHTML = '';
    chatContainer?.classList.remove('has-messages');
    tabChat?.classList.remove('has-messages');
    if (!Array.isArray(messages) || messages.length === 0) {
      addChatMessage('chatbot', '你好！我是 AI 对话助手，有什么我可以帮你的吗？');
      chatHistory = [];
      return;
    }
    chatHistory = messages.slice();
    messages.forEach(message => {
      addChatMessage(message.role === 'assistant' ? 'chatbot' : 'user', message.content || '');
    });
  }

  function restoreLatestChat() {
    const latest = historyState.chat?.[0];
    if (latest?.state?.messages) {
      restoreChatMessages(latest.state.messages);
    } else {
      restoreChatMessages([]);
    }
  }

  function recordChatHistory(title, reply) {
    saveHistoryEntry('chat', {
      title: truncateText(title, 24),
      summary: truncateText(reply, 88),
      timestamp: Date.now(),
      state: {
        messages: chatHistory.slice()
      }
    });
  }

  function recordFeatureHistory(feature, title, summary, inputs, result) {
    saveHistoryEntry(feature, {
      title: truncateText(title, 24),
      summary: truncateText(summary, 88),
      timestamp: Date.now(),
      state: {
        inputs,
        result
      }
    });
  }

  function renderFeatureResult(feature, result, inputs) {
    currentResult[feature] = result;
    if (feature === 'lyrics') {
      $('lyrics-content').innerHTML = `<pre>${escapeHtml(result.lyrics || result.content || '')}</pre>`;
      $('lyrics-meta').textContent = result.title ? `标题: ${result.title}` : '';
      getResultArea('lyrics')?.removeAttribute('hidden');
      return;
    }
    if (feature === 'music') {
      $('music-audio').src = result.url || '';
      const durationMs = parseInt(result.duration, 10) || 0;
      $('music-duration-info').textContent = durationMs ? `${(durationMs / 1000).toFixed(1)}秒` : '';
      $('music-model-info').textContent = '模型: music-2.6';
      getResultArea('music')?.removeAttribute('hidden');
      return;
    }
    if (feature === 'cover') {
      $('cover-image').src = result.url || '';
      $('cover-meta').textContent = inputs?.style ? `风格: ${inputs.style}` : '';
      getResultArea('cover')?.removeAttribute('hidden');
      return;
    }
    if (feature === 'speech') {
      $('speech-result')?.removeAttribute('hidden');
      $('speech-audio').src = result.url || '';
      $('speech-info').textContent = result.info || '';
      return;
    }
    if (feature === 'covervoice') {
      $('voice-audio').src = result.url || '';
      $('voice-meta').textContent = result.duration ? `时长: ${result.duration}s` : '';
      getResultArea('covervoice')?.removeAttribute('hidden');
    }
  }

  function restoreHistoryEntry(feature, index, action) {
    const entry = historyState[feature]?.[index];
    if (!entry) return;
    switchTab(feature);
    if (feature === 'chat') {
      restoreChatMessages(entry.state?.messages || []);
      if (action === 'reuse') {
        $('chat-input')?.focus();
      }
      return;
    }
    applyFeatureInputs(feature, entry.state?.inputs || {});
    if (feature === 'covervoice' && entry.state?.inputs?.audio_url) {
      document.querySelectorAll('.voice-source-tabs .source-tab').forEach(t => t.classList.remove('active'));
      document.querySelector('.voice-source-tabs .source-tab[data-source="url"]')?.classList.add('active');
      $('voice-source-file')?.setAttribute('hidden', '');
      $('voice-source-url')?.removeAttribute('hidden');
    }
    if (entry.state?.result) {
      renderFeatureResult(feature, entry.state.result, entry.state.inputs || {});
    }
    showToast(`${featureMeta[feature]?.title || feature} 历史已恢复`, 'success', 1600);
  }

  function applyTemplate(feature, groupIndex, itemIndex) {
    const template = templates?.[feature]?.[groupIndex]?.items?.[itemIndex];
    if (!template) return;
    switchTab(feature);
    if (feature === 'chat') {
      const input = $('chat-input');
      if (input) {
        input.value = template.message;
        input.focus();
      }
      sendChatMessage(template.message);
      return;
    }
    applyFeatureInputs(feature, template.values || {});
    if (feature === 'covervoice') {
      document.querySelectorAll('.voice-source-tabs .source-tab').forEach(t => t.classList.remove('active'));
      document.querySelector('.voice-source-tabs .source-tab[data-source="url"]')?.classList.add('active');
      $('voice-source-file')?.setAttribute('hidden', '');
      $('voice-source-url')?.removeAttribute('hidden');
    }
    showToast(`${template.label} 模板已应用`, 'success', 1400);
  }

  function bindEnhancementEvents() {
    document.addEventListener('click', event => {
      const templateButton = event.target.closest('[data-template-feature]');
      if (templateButton) {
        applyTemplate(templateButton.dataset.templateFeature, Number(templateButton.dataset.templateGroup), Number(templateButton.dataset.templateItem));
        return;
      }
      const historyButton = event.target.closest('[data-history-feature]');
      if (historyButton) {
        restoreHistoryEntry(historyButton.dataset.historyFeature, Number(historyButton.dataset.historyIndex), historyButton.dataset.historyAction);
      }
    });
  }

  // ============================================
  //  Tab Navigation
  // ============================================
  function initTabs() {
    $$('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(tab) {
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));
    currentTab = tab;
  }

  // ============================================
  //  Loading Overlay (disabled)
  // ============================================
  function showLoading(text = '正在生成...', initialProgress = 0) {
    // Loading overlay removed - use inline progress instead
  }

  function updateLoadingProgress(progress) {
    // Loading overlay removed - use inline progress instead
  }

  function hideLoading() {
    // Loading overlay removed - use inline progress instead
  }

  // ============================================
  //  Inline Progress
  // ============================================
  function startInlineProgress(tab, fillId, textId) {
    const card = $(`${tab}-generating`);
    activeProgressTab = tab;
    card.removeAttribute('hidden');

    let progress = 0;
    const speeds = { music: 1.2, lyrics: 2.5, cover: 1.8, covervoice: 1.0 };
    const baseSpeed = speeds[tab] || 1.5;

    progressInterval = setInterval(() => {
      progress += Math.random() * baseSpeed * 3;
      if (progress > 88) progress = 88;
      const fill = $(fillId);
      const text = $(textId);
      if (fill) fill.style.width = progress + '%';
      if (text) text.textContent = Math.round(progress) + '%';
    }, 200);
  }

  function stopInlineProgress() {
    clearInterval(progressInterval);
    progressInterval = null;
    const progressTab = activeProgressTab || currentTab;
    const fill = $(`${progressTab}-progress-fill`);
    const text = $(`${progressTab}-progress-text`);
    if (fill) fill.style.width = '100%';
    if (text) text.textContent = '100%';
    setTimeout(() => $(`${progressTab}-generating`)?.setAttribute('hidden', ''), 600);
    activeProgressTab = null;
  }

  // ============================================
  //  Toast
  // ============================================
  function showToast(message, type = 'info', duration = 4000) {
    const container = $('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.35s ease forwards';
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }

  // ============================================
  //  Theme
  // ============================================
  function getStoredTheme() { return localStorage.getItem('theme') || 'dark'; }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const btn = $('theme-toggle');
    if (btn) btn.setAttribute('data-tip', theme === 'light' ? '浅色模式' : '深色模式');
  }

  function toggleTheme() { setTheme(getStoredTheme() === 'dark' ? 'light' : 'dark'); }

  function initTheme() {
    setTheme(getStoredTheme());
    $('theme-toggle')?.addEventListener('click', toggleTheme);
  }

  // ============================================
  //  Quota
  // ============================================
  let quotaLoading = false;
  const MODEL_LABELS = {
    'MiniMax-M*': '通用对话', 'speech-hd': '语音合成',
    'music-2.5': '音乐生成', 'music-2.6': '音乐生成',
    'music-cover': '歌声翻唱', 'lyrics_generation': '歌词创作',
    'image-01': '封面生成', 'MiniMax-Hailuo-2.3-Fast-6s-768p': '视频生成',
    'MiniMax-Hailuo-2.3-6s-768p': '视频生成',
  };
  const LABEL_ORDER = ['通用对话', '音乐生成', '歌声翻唱', '歌词创作', '封面生成', '语音合成', '视频生成'];

  function getModelLabel(name) { return MODEL_LABELS[name] || name || '其他'; }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  window.loadQuota = async function loadQuota() {
    if (quotaLoading) return;
    quotaLoading = true;
    const el = $('quota-info');

    try {
      const res = await fetch('/api/quota');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const models = data.model_remains || [];

      if (models.length === 0) {
        el.innerHTML = '<div class="quota-loading">无可用配额数据</div>';
        return;
      }

      // Deduplicate by label, filter zero-quota
      const seen = new Set();
      const unique = models
        .filter(m => m.current_interval_total_count > 0)
        .filter(m => { const l = getModelLabel(m.model_name); return !seen.has(l) && seen.add(l); })
        .sort((a, b) => {
          const ia = LABEL_ORDER.indexOf(getModelLabel(a.model_name));
          const ib = LABEL_ORDER.indexOf(getModelLabel(b.model_name));
          return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        })
        .slice(0, 8);

      el.innerHTML = `
        <div class="quota-list">${unique.map(m => {
          const total = m.current_interval_total_count;
          const used = m.current_interval_usage_count;
          const pct = total > 0 ? Math.round((used / total) * 100) : 0;
          const pctClass = pct >= 100 ? 'full' : pct > 60 ? 'high' : pct > 30 ? 'medium' : 'low';
          return `<div class="quota-item">
            <div class="quota-item-header">
              <span class="quota-label">${escapeHtml(getModelLabel(m.model_name))}</span>
              <span class="quota-num"><span class="used">${used}</span><span class="total">/${total}</span><span class="pct ${pctClass}">${pct}%</span></span>
            </div>
            <div class="quota-bar-track"><div class="quota-bar-fill ${pctClass}" style="--fill-width:${pct}%"></div></div>
          </div>`;
        }).join('')}</div>
        <button class="quota-refresh" id="btn-quota-refresh" title="刷新配额">↻ 刷新</button>`;
      $('btn-quota-refresh')?.addEventListener('click', e => { e.stopPropagation(); loadQuota(); });

    } catch {
      el.innerHTML = '<div class="quota-loading">无法加载配额</div>';
    } finally {
      quotaLoading = false;
    }
  };

  // ============================================
  //  Generic Content Generator
  // ============================================
  async function generateContent({ apiEndpoint, domIds, resultTab, loadingText, successMessage, onSuccess, historyFeature, buildHistoryEntry }) {
    const config = {};
    for (const [key, id] of Object.entries(domIds)) {
      const el = $(id);
      config[key] = el ? (el.value != null ? el.value : el.textContent || '') : '';
    }

    // Validation: reject empty strings
    if (Object.values(config).every(v => !String(v).trim())) {
      showToast('请填写必要信息', 'error');
      return;
    }

    const btn = $(`btn-generate-${resultTab}`);
    const resultEl = $(`${resultTab}-result`);

    if (btn) btn.disabled = true;
    if (resultEl) resultEl.setAttribute('hidden', '');

    showLoading(loadingText, 0);
    startInlineProgress(resultTab, `${resultTab}-progress-fill`, `${resultTab}-progress-text`);

    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '请求失败' }));
        throw new Error(err.error || '生成失败');
      }

      const data = await res.json();
      stopInlineProgress();

      if (onSuccess) onSuccess(data);
      currentResult[resultTab] = data;
      if (historyFeature && buildHistoryEntry) {
        const historyEntry = buildHistoryEntry(data, config);
        if (historyEntry) {
          recordFeatureHistory(historyFeature, historyEntry.title, historyEntry.summary, historyEntry.inputs, historyEntry.result);
        }
      }

      const area = $(`${resultTab}-result`);
      if (area) { area.removeAttribute('hidden'); area.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }); }
      loadQuota();
      showToast(successMessage, 'success');

    } catch (err) {
      stopInlineProgress();
      showToast(err.message || '生成失败，请重试', 'error');
    } finally {
      hideLoading();
      if (btn) btn.disabled = false;
    }
  }

  // ============================================
  //  Content Generators (thin wrappers)
  // ============================================
  async function generateMusic() {
    const prompt = $('music-prompt')?.value?.trim();
    if (!prompt) { showToast('请输入歌词或描述', 'error'); return; }

    const btn = $('btn-generate-music');
    const resultEl = $('music-result');

    if (btn) btn.disabled = true;
    if (resultEl) resultEl.setAttribute('hidden', '');

    const style = $('music-style')?.value || '';
    const bpm = $('music-bpm')?.value || '';
    const key = $('music-key')?.value || '';
    const duration = $('music-duration')?.value || '';

    startInlineProgress('music', 'music-progress-fill', 'music-progress-text');

    try {
      // 1. 启动音乐生成任务
      const res = await fetch('/api/generate/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style, bpm, key, duration }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const taskId = data.taskId;
      if (!taskId) throw new Error('未返回任务ID');

      // 2. 轮询检查任务状态
      const checkStatus = async () => {
        const statusRes = await fetch('/api/music/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId }),
        });
        return statusRes.json();
      };

      // 轮询直到完成
      let statusData;
      let attempts = 0;
      const maxAttempts = 60; // 最多轮询60次

      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000)); // 每2秒检查一次
        statusData = await checkStatus();

        if (statusData.status === 'completed') {
          break;
        } else if (statusData.status === 'error') {
          throw new Error(statusData.error || '生成失败');
        }
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('生成超时，请稍后查看结果');
      }

      // 3. 显示结果
      stopInlineProgress();
      $('music-audio').src = statusData.audio_url || statusData.url || '';
      // 转换毫秒为秒显示
      const durationMs = parseInt(statusData.duration) || 0;
      const durationSec = (durationMs / 1000).toFixed(1);
      $('music-duration-info').textContent = durationMs > 0 ? `${durationSec}秒` : '';
      $('music-model-info').textContent = '模型: music-2.6';
      recordFeatureHistory('music', prompt, `${style || '默认风格'} · ${duration || '自动时长'}`, { prompt, style, bpm, key, duration }, {
        url: statusData.url || '',
        duration: statusData.duration || 0
      });

      if (resultEl) {
        resultEl.removeAttribute('hidden');
        resultEl.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      }
      loadQuota();
      showToast('音乐生成成功！', 'success');

    } catch (err) {
      stopInlineProgress();
      showToast(err.message || '生成失败，请重试', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function generateLyrics() {
    generateContent({
      apiEndpoint: '/api/generate/lyrics',
      domIds: { prompt: 'lyrics-prompt', style: 'lyrics-style', structure: 'lyrics-structure' },
      resultTab: 'lyrics',
      loadingText: '正在创作歌词...',
      successMessage: '歌词创作完成！',
      historyFeature: 'lyrics',
      onSuccess: data => {
        $('lyrics-content').innerHTML = `<pre>${escapeHtml(data.lyrics || data.content || '')}</pre>`;
        $('lyrics-meta').textContent = data.title ? `标题: ${data.title}` : '';
      },
      buildHistoryEntry: (data, config) => ({
        title: data.title || config.prompt,
        summary: data.lyrics || data.content || '',
        inputs: config,
        result: {
          title: data.title,
          lyrics: data.lyrics,
          content: data.content
        }
      })
    });
  }

  function generateCover() {
    const prompt = $('cover-prompt')?.value?.trim();
    const ratio = $('cover-ratio')?.value || '';
    const style = $('cover-style')?.value || '';
    if (!prompt) { showToast('请填写封面描述', 'error'); return; }

    const btn = $('btn-generate-cover');
    const resultEl = $('cover-result');
    if (btn) btn.disabled = true;
    if (resultEl) resultEl.setAttribute('hidden', '');

    showLoading('正在生成封面...', 0);
    startInlineProgress('cover', 'cover-progress-fill', 'cover-progress-text');

    fetch('/api/generate/cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, ratio, style }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        pollImageStatus(data.taskId, 60, { prompt, ratio, style });
      })
      .catch(err => {
        stopInlineProgress();
        showToast(err.message || '生成失败', 'error');
        if (btn) btn.disabled = false;
        hideLoading();
      });
  }

  function pollImageStatus(taskId, maxRetries, inputs) {
    const btn = $('btn-generate-cover');

    const tryPoll = (retry) => {
      fetch('/api/image/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) throw new Error(data.error);

          if (data.status === 'completed') {
            stopInlineProgress();
            const img = $('cover-image');
            img.src = data.url || '';
            img.onclick = () => openImageModal(img.src);
            $('cover-meta').textContent = data.model ? `模型: ${data.model}` : '';
            $('cover-result')?.removeAttribute('hidden');
            $('cover-result')?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
            loadQuota();
            recordFeatureHistory('cover', inputs.prompt, `${inputs.style || '自动风格'} · ${inputs.ratio || '1:1'}`, inputs, {
              url: data.url,
              size: data.size,
              duration: data.duration
            });
            showToast('封面生成成功！', 'success');
            if (btn) btn.disabled = false;
            hideLoading();
          } else if (data.status === 'error') {
            throw new Error(data.error || '生成失败');
          } else {
            // pending / processing
            if (retry >= maxRetries) {
              throw new Error('生成超时，请重试');
            }
            setTimeout(() => tryPoll(retry + 1), 2000);
          }
        })
        .catch(err => {
          stopInlineProgress();
          showToast(err.message || '生成失败', 'error');
          if (btn) btn.disabled = false;
          hideLoading();
        });
    };

    tryPoll(0);
  }

  async function generateVoice() {
    const fileInput = $('voice-audio-file');
    const urlInput = $('voice-audio-url');
    const prompt = $('voice-prompt')?.value?.trim();

    // 根据当前 Tab 判断来源
    const activeTab = document.querySelector('.voice-source-tabs .source-tab.active')?.dataset.source;

    if (activeTab === 'file' && fileInput?.files?.[0]) {
      if (!prompt) { showToast('请填写翻唱描述', 'error'); return; }
      await generateVoiceWithFile(fileInput.files[0], prompt);
    } else if (activeTab === 'url') {
      const audioUrl = urlInput?.value?.trim();
      if (!audioUrl) { showToast('请填写歌曲链接', 'error'); return; }
      if (!prompt) { showToast('请填写翻唱描述', 'error'); return; }
      await generateVoiceWithUrl(audioUrl, prompt);
    } else {
      // 默认行为：优先文件其次 URL
      const file = fileInput?.files?.[0];
      const audioUrl = urlInput?.value?.trim();
      if (file) {
        if (!prompt) { showToast('请填写翻唱描述', 'error'); return; }
        await generateVoiceWithFile(file, prompt);
      } else if (audioUrl) {
        if (!prompt) { showToast('请填写翻唱描述', 'error'); return; }
        await generateVoiceWithUrl(audioUrl, prompt);
      } else {
        showToast('请上传音频文件或填写歌曲链接', 'error');
      }
    }
  }

  async function generateVoiceWithFile(file, prompt) {
    const btn = $('btn-generate-voice');
    if (btn) btn.disabled = true;
    showLoading('正在上传音频...', 0);

    try {
      // 1. 把文件转成 base64 上传
      const base64 = await fileToBase64(file);
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, data: base64 }),
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.error || '文件上传失败');

      const audioUrl = uploadData.url;
      showLoading('正在处理翻唱...', 50);

      // 2. 用上传后的 URL 发起翻唱
      await doVoiceGenerate(audioUrl, prompt);

    } catch (err) {
      hideLoading();
      showToast(err.message || '处理失败', 'error');
      if (btn) btn.disabled = false;
    }
  }

  async function generateVoiceWithUrl(audioUrl, prompt) {
    const btn = $('btn-generate-voice');
    const resultEl = $('covervoice-result');
    const progressTab = 'voice';

    if (btn) btn.disabled = true;
    if (resultEl) resultEl.setAttribute('hidden', '');

    startInlineProgress(progressTab, `${progressTab}-progress-fill`, `${progressTab}-progress-text`);

    try {
      const config = {
        audio_url: audioUrl,
        prompt,
        timbre: $('voice-timbre')?.value || '',
        pitch: $('voice-pitch')?.value || '',
      };

      const res = await fetch('/api/generate/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '请求失败' }));
        throw new Error(err.error || '生成失败');
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      const taskId = data.taskId;
      if (!taskId) throw new Error('未返回任务ID');

      // 轮询检查任务状态
      const checkStatus = async () => {
        const statusRes = await fetch('/api/music-cover/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId }),
        });
        return statusRes.json();
      };

      // 轮询直到完成
      let statusData;
      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000));
        statusData = await checkStatus();

        if (statusData.status === 'completed') {
          break;
        } else if (statusData.status === 'error') {
          throw new Error(statusData.error || '生成失败');
        }
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('生成超时，请稍后查看结果');
      }

      stopInlineProgress();

      $('voice-audio').src = statusData.url || '';
      $('voice-meta').textContent = statusData.duration ? `时长: ${statusData.duration}s` : '';

      if (resultEl) { resultEl.removeAttribute('hidden'); resultEl.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }); }
      currentResult['covervoice'] = statusData;
      loadQuota();
      recordFeatureHistory('covervoice', prompt, `${config.timbre || '自动音色'} · ${config.pitch || '原调'}`, {
        prompt,
        timbre: config.timbre,
        pitch: config.pitch,
        audio_url: audioUrl
      }, {
        url: statusData.url || '',
        duration: statusData.duration || 0
      });
      showToast('歌声翻唱完成！', 'success');

    } catch (err) {
      stopInlineProgress();
      showToast(err.message || '生成失败，请重试', 'error');
    } finally {
      hideLoading();
      if (btn) btn.disabled = false;
    }
  }

  async function doVoiceGenerate(audioUrl, prompt) {
    const btn = $('btn-generate-voice');
    const resultEl = $('covervoice-result');
    const resultTab = 'covervoice';
    const progressTab = 'voice';

    if (btn) btn.disabled = true;
    if (resultEl) resultEl.setAttribute('hidden', '');

    startInlineProgress(progressTab, `${progressTab}-progress-fill`, `${progressTab}-progress-text`);

    try {
      const config = {
        audio_url: audioUrl,
        prompt,
        timbre: $('voice-timbre')?.value || '',
        pitch: $('voice-pitch')?.value || '',
      };

      const res = await fetch('/api/generate/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '请求失败' }));
        throw new Error(err.error || '生成失败');
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      const taskId = data.taskId;
      if (!taskId) throw new Error('未返回任务ID');

      // 轮询检查任务状态
      const checkStatus = async () => {
        const statusRes = await fetch('/api/music-cover/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId }),
        });
        return statusRes.json();
      };

      // 轮询直到完成
      let statusData;
      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000));
        statusData = await checkStatus();

        if (statusData.status === 'completed') {
          break;
        } else if (statusData.status === 'error') {
          throw new Error(statusData.error || '生成失败');
        }
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('生成超时，请稍后查看结果');
      }

      stopInlineProgress();

      $('voice-audio').src = statusData.url || '';
      $('voice-meta').textContent = statusData.duration ? `时长: ${statusData.duration}s` : '';

      if (resultEl) { resultEl.removeAttribute('hidden'); resultEl.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }); }
      currentResult[resultTab] = statusData;
      loadQuota();
      recordFeatureHistory('covervoice', prompt, `${config.timbre || '自动音色'} · ${config.pitch || '原调'}`, {
        prompt,
        timbre: config.timbre,
        pitch: config.pitch,
        audio_url: audioUrl
      }, {
        url: statusData.url || '',
        duration: statusData.duration || 0
      });
      showToast('歌声翻唱完成！', 'success');

    } catch (err) {
      stopInlineProgress();
      showToast(err.message || '生成失败，请重试', 'error');
    } finally {
      hideLoading();
      if (btn) btn.disabled = false;
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ============================================
  //  Reset
  // ============================================
  const RESET_MAPS = {
    music:      [{ id: 'music-prompt', tag: 'textarea' }, { id: 'music-style' }, { id: 'music-bpm' }, { id: 'music-key' }, { id: 'music-duration' }, { id: 'music-char', val: '0' }],
    lyrics:     [{ id: 'lyrics-prompt', tag: 'textarea' }, { id: 'lyrics-style' }, { id: 'lyrics-structure' }, { id: 'lyrics-char', val: '0' }],
    cover:      [{ id: 'cover-prompt', tag: 'textarea' }, { id: 'cover-ratio' }, { id: 'cover-style' }, { id: 'cover-char', val: '0' }],
    covervoice: [{ id: 'voice-audio-file' }, { id: 'voice-audio-url' }, { id: 'voice-prompt', tag: 'textarea' }, { id: 'voice-timbre' }, { id: 'voice-pitch' }, { id: 'voice-char', val: '0' }],
  };

  // file input 需要手动清空
  function resetTab(tab) {
    (RESET_MAPS[tab] || []).forEach(item => {
      const el = $(item.id);
      if (!el) return;
      if (item.id === 'voice-audio-file') { el.value = ''; $('voice-file-name').textContent = ''; return; }
      if (item.val !== undefined) {
        if (el.tagName === 'SELECT') el.selectedIndex = 0;
        else if (item.id.endsWith('-char')) el.textContent = item.val;
        else el.value = item.val;
      }
    });
    $(`${tab}-result`)?.setAttribute('hidden', '');
    $(`${tab}-generating`)?.setAttribute('hidden', '');
    currentResult[tab] = null;
  }

  // ============================================
  //  Image Modal
  // ============================================
  function openImageModal(src) {
    const modal = $('image-modal');
    $('modal-image').src = src;
    modal.removeAttribute('hidden');
  }

  function closeImageModal() { $('image-modal')?.setAttribute('hidden', ''); }

  // ============================================
  //  Chat
  // ============================================
  let chatHistory = [];

  // Simple Markdown parser for chat messages
  function parseMarkdown(text) {
    const sanitizeLinkUrl = (rawUrl) => {
      try {
        const parsed = new URL(rawUrl, window.location.origin);
        return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.href : '#';
      } catch {
        return '#';
      }
    };

    return text
      // Bold: **text** or __text__
      .replace(/\*\*(.+?)\*\*|__(.+?)__/g, '<strong>$1$2</strong>')
      // Italic: *text* or _text_
      .replace(/\*(.+?)\*|_(.+?)_/g, '<em>$1$2</em>')
      // Inline code: `text`
      .replace(/`(.+?)`/g, '<code style="background:var(--bg-secondary);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:0.9em;color:var(--accent-cyan);">$1</code>')
      // Strikethrough: ~~text~~
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      // Links: [text](url)
      .replace(/\[(.+?)\]\((.+?)\)/g, (_, label, href) => `<a href="${sanitizeLinkUrl(href)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-cyan);text-decoration:underline;">${label}</a>`);
  }

  function addChatMessage(role, content, isStreaming = false) {
    const container = $('chat-messages');
    const chatContainer = document.querySelector('.chat-container');
    const avatar = role === 'user' ? '😀' : '🤖';
    const msgDiv = document.createElement('div');

    // Expand chat container when user sends first message
    if (role === 'user' && chatContainer && !chatContainer.classList.contains('has-messages')) {
      chatContainer.classList.add('has-messages');
      // Also update parent section layout
      const tabChat = document.getElementById('tab-chat');
      if (tabChat) tabChat.classList.add('has-messages');
    }
    msgDiv.className = `chat-message ${role}`;

    if (role === 'chatbot' && isStreaming) {
      // Create streaming message container
      msgDiv.innerHTML = `<div class="message-avatar">${avatar}</div><div class="message-content"><p class="streaming-content" style="margin:0;line-height:1.5;white-space:normal;word-break:break-word;color:var(--fg-primary);"></p></div>`;
      container.appendChild(msgDiv);
      container.scrollTop = container.scrollHeight;
      return { msgDiv, contentEl: msgDiv.querySelector('.streaming-content') };
    }

    // Parse markdown then handle line breaks
    const formattedContent = parseMarkdown(escapeHtml(content)).replace(/\n/g, '<br>');
    msgDiv.innerHTML = `<div class="message-avatar">${avatar}</div><div class="message-content"><p style="margin:0;line-height:1.5;white-space:normal;word-break:break-word;color:var(--fg-primary);">${formattedContent}</p></div>`;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
    return null;
  }

  // Stream text with typing effect
  async function streamChatMessage(content, onComplete) {
    const { contentEl, msgDiv } = addChatMessage('chatbot', '', true);
    const container = $('chat-messages');

    const chars = content.split('');
    let currentText = '';
    const batchSize = 3; // Characters per frame
    const delay = 15; // ms between frames

    return new Promise((resolve) => {
      let index = 0;

      function typeNext() {
        if (index >= chars.length) {
          // Streaming complete - finalize content
          const finalContent = parseMarkdown(escapeHtml(content)).replace(/\n/g, '<br>');
          contentEl.innerHTML = finalContent;
          contentEl.classList.remove('streaming-content');
          container.scrollTop = container.scrollHeight;
          if (onComplete) onComplete(content);
          resolve(content);
          return;
        }

        // Add next batch of characters
        const batch = chars.slice(index, index + batchSize);
        currentText += batch.join('');

        // Show raw text during streaming (no markdown parsing for performance)
        contentEl.textContent = currentText;

        index += batchSize;
        container.scrollTop = container.scrollHeight;

        setTimeout(typeNext, delay);
      }

      typeNext();
    });
  }

  function setChatLoading(loading) {
    const btn = $('btn-chat-send');
    const input = $('chat-input');
    if (btn) btn.disabled = loading;
    // 输入框始终保持可输入，支持排队发送
    if (input) input.disabled = false;
  }

  function updateQueueIndicator() {
    const el = $('chat-queue-indicator');
    if (!el) return;
    const qLen = chatQueue.length;
    if (qLen === 0) {
      el.setAttribute('hidden', '');
      el.textContent = '';
    } else {
      el.removeAttribute('hidden');
      el.textContent = `⏳ ${qLen} 条消息等待中...`;
    }
  }

  async function sendChatMessage(forcedMessage) {
    const input = $('chat-input');
    const message = String(forcedMessage != null ? forcedMessage : input?.value || '').trim();
    if (!message) return;

    // 如果正在生成，把消息加入队列
    if (isChatGenerating) {
      chatQueue.push(message);
      updateQueueIndicator();
      showToast(`消息已加入队列（${chatQueue.length}条等待）`, 'info', 2000);
      if (input) input.value = '';
      return;
    }

    isChatGenerating = true;
    if (input) input.value = '';

    addChatMessage('user', message);
    chatHistory.push({ role: 'user', content: message });
    setChatLoading(true);

    try {
      const model = $('chat-model')?.value || 'MiniMax-M2.7';
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory, model }),
      });
      const data = await res.json();

      if (data.error) {
        addChatMessage('chatbot', '抱歉，发生了错误：' + data.error);
      } else {
        // Stream the response with typing effect
        await streamChatMessage(data.reply, (finalContent) => {
          chatHistory.push({ role: 'assistant', content: finalContent });
          recordChatHistory(message, finalContent);
          loadQuota();
        });
      }
    } catch {
      addChatMessage('chatbot', '网络错误，请稍后重试。');
    }
    setChatLoading(false);

    // 队列非空，继续处理下一条
    if (chatQueue.length > 0) {
      const next = chatQueue.shift();
      updateQueueIndicator();
      // 清空 input 后再递归发送，保持 isChatGenerating 为 true
      if (input) input.value = '';
      await sendChatMessageFromQueue(next);
    } else {
      isChatGenerating = false;
    }
  }

  // 仅供队列内部调用，不做队列检查
  async function sendChatMessageFromQueue(message) {
    addChatMessage('user', message);
    chatHistory.push({ role: 'user', content: message });
    setChatLoading(true);

    try {
      const model = $('chat-model')?.value || 'MiniMax-M2.7';
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory, model }),
      });
      const data = await res.json();

      if (data.error) {
        addChatMessage('chatbot', '抱歉，发生了错误：' + data.error);
      } else {
        // Stream the response with typing effect
        await streamChatMessage(data.reply, (finalContent) => {
          chatHistory.push({ role: 'assistant', content: finalContent });
          recordChatHistory(message, finalContent);
          loadQuota();
        });
      }
    } catch {
      addChatMessage('chatbot', '网络错误，请稍后重试。');
    }
    setChatLoading(false);

    // 继续处理队列
    if (chatQueue.length > 0) {
      const next = chatQueue.shift();
      updateQueueIndicator();
      await sendChatMessageFromQueue(next);
    } else {
      isChatGenerating = false;
    }
  }

  // ============================================
  //  Custom Dropdown
  // ============================================
  function initCustomDropdown(dropdownId, inputId) {
    const dropdown = $(dropdownId);
    if (!dropdown) return;

    const trigger = dropdown.querySelector('.dropdown-trigger');
    const menu = dropdown.querySelector('.dropdown-menu');
    const options = dropdown.querySelectorAll('.dropdown-option');
    const valueSpan = dropdown.querySelector('.dropdown-value');
    const hiddenInput = $(inputId);

    if (!trigger || !menu) return;

    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');

      // Close all other dropdowns
      document.querySelectorAll('.custom-dropdown.open').forEach(d => {
        if (d.id !== dropdownId) {
          d.classList.remove('open');
          d.querySelector('.dropdown-menu')?.setAttribute('hidden', '');
        }
      });

      if (isOpen) {
        dropdown.classList.remove('open');
        menu.setAttribute('hidden', '');
      } else {
        dropdown.classList.add('open');
        menu.removeAttribute('hidden');
      }
    });

    // Option selection
    options.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const value = option.dataset.value;
        const text = option.textContent;

        // Update hidden input
        if (hiddenInput) hiddenInput.value = value;

        // Update display
        if (valueSpan) valueSpan.textContent = text;

        // Update active state
        options.forEach(o => o.classList.remove('active'));
        option.classList.add('active');

        // Close dropdown
        dropdown.classList.remove('open');
        menu.setAttribute('hidden', '');
      });
    });

    // Close on outside click
    document.addEventListener('click', () => {
      if (dropdown.classList.contains('open')) {
        dropdown.classList.remove('open');
        menu.setAttribute('hidden', '');
      }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dropdown.classList.contains('open')) {
        dropdown.classList.remove('open');
        menu.setAttribute('hidden', '');
      }
    });
  }

  // ============================================
  //  Speech TTS
  // ============================================
  function initSpeechTab() {
    const textArea = $('speech-text');
    const charCount = $('speech-char');
    textArea?.addEventListener('input', () => { if (charCount) charCount.textContent = textArea.value.length; });

    ['speech-speed', 'speech-pitch', 'speech-vol'].forEach(id => {
      const slider = $(id);
      const val = $(id.replace('speech-', 'speech-') + '-val') || $(id + '-val');
      if (slider && val) {
        const suffix = id === 'speech-vol' ? '%' : (id === 'speech-speed' ? 'x' : '');
        slider.addEventListener('input', () => { val.textContent = slider.value + suffix; });
      }
    });

    $('btn-speech-generate')?.addEventListener('click', async () => {
      const text = $('speech-text')?.value?.trim();
      if (!text) { showToast('请输入要转换的文本', 'error'); return; }

      showLoading('正在生成语音...', 0);
      const btn = $('btn-speech-generate');
      if (btn) btn.disabled = true;

      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voice_id: $('speech-voice')?.value,
            emotion: $('speech-emotion')?.value,
            speed: parseFloat($('speech-speed')?.value || 1),
            pitch: parseFloat($('speech-pitch')?.value || 0),
            vol: parseInt($('speech-vol')?.value || 100),
            output_format: $('speech-format')?.value,
            model: 'speech-2.8-hd',
          }),
        });
        const data = await res.json();

        if (data.success) {
          $('speech-result')?.removeAttribute('hidden');
          const audio = $('speech-audio');
          if (audio) audio.src = data.url;
          const info = $('speech-info');
          if (info) info.textContent = `音频时长: ${data.extra?.audio_length || '?'}s | 消耗字符: ${data.extra?.usage_characters || text.length}`;
          currentResult.speech = { url: data.url, info: info?.textContent || '' };
          recordFeatureHistory('speech', text, `${$('speech-voice')?.value || ''} · ${$('speech-emotion')?.value || ''}`, {
            text,
            voice_id: $('speech-voice')?.value,
            emotion: $('speech-emotion')?.value,
            speed: $('speech-speed')?.value,
            pitch: $('speech-pitch')?.value,
            vol: $('speech-vol')?.value,
            output_format: $('speech-format')?.value
          }, {
            url: data.url,
            info: info?.textContent || ''
          });
          showToast('语音生成成功！', 'success');
          loadQuota();
        } else {
          showToast(data.error || '生成失败', 'error');
        }
      } catch (e) {
        showToast('请求失败: ' + e.message, 'error');
      } finally {
        hideLoading();
        if (btn) btn.disabled = false;
      }
    });
  }

  // ============================================
  //  Download
  // ============================================
  function downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || '';
    a.click();
  }

  function copyToClipboard(text) {
    navigator.clipboard?.writeText(text).then(() => showToast('已复制到剪贴板', 'success'));
  }

  // ============================================
  //  Init
  // ============================================
  function init() {
    ensureFeatureExtensions();
    renderTemplateLibraries();
    bindEnhancementEvents();
    initTabs();
    initTheme();
    bootstrapAuth();

    // Char counters
    [['music-prompt', 'music-char'], ['lyrics-prompt', 'lyrics-char'],
     ['cover-prompt', 'cover-char'], ['voice-prompt', 'voice-char'], ['speech-text', 'speech-char']].forEach(([id, counterId]) => {
      const el = $(id);
      const counter = $(counterId);
      if (el && counter) el.addEventListener('input', () => { counter.textContent = el.value.length; });
    });

    // Example chips - click to fill input
    document.querySelectorAll('.example-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const targetId = chip.dataset.target;
        const text = chip.dataset.text;
        const targetInput = $(targetId);
        const counterId = targetId === 'music-prompt' ? 'music-char' :
                         targetId === 'lyrics-prompt' ? 'lyrics-char' :
                         targetId === 'cover-prompt' ? 'cover-char' :
                         targetId === 'voice-prompt' ? 'voice-char' :
                         targetId === 'speech-text' ? 'speech-char' : null;

        if (targetInput) {
          targetInput.value = text;
          targetInput.focus();
          // Update counter if exists
          if (counterId) {
            const counter = $(counterId);
            if (counter) counter.textContent = text.length;
          }
          // Visual feedback
          chip.style.transform = 'scale(0.95)';
          setTimeout(() => chip.style.transform = '', 150);
        }
      });
    });

    // 文件上传选中后显示文件名
    $('voice-audio-file')?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      $('voice-file-name').textContent = file ? file.name : '';
    });

    // 歌声翻唱来源 Tab 切换
    document.querySelectorAll('.voice-source-tabs .source-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.voice-source-tabs .source-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const source = tab.dataset.source;
        $('voice-source-file')?.toggleAttribute('hidden', source !== 'file');
        $('voice-source-url')?.toggleAttribute('hidden', source !== 'url');
      });
    });

    // 拖拽上传
    const dropZone = $('voice-drop-zone');
    if (dropZone) {
      // 点击区域触发文件选择
      dropZone.addEventListener('click', e => {
        // 避免点击label时重复触发
        if (e.target.tagName === 'LABEL' || e.target.closest('label')) return;
        $('voice-audio-file')?.click();
      });
      dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
      dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer?.files?.[0];
        if (file && file.type.startsWith('audio/')) {
          const dt = new DataTransfer();
          dt.items.add(file);
          $('voice-audio-file').files = dt.files;
          $('voice-file-name').textContent = file.name;
          // 自动切换到文件模式
          document.querySelectorAll('.voice-source-tabs .source-tab').forEach(t => t.classList.remove('active'));
          document.querySelector('.voice-source-tabs .source-tab[data-source="file"]')?.classList.add('active');
          $('voice-source-file')?.removeAttribute('hidden');
          $('voice-source-url')?.setAttribute('hidden', '');
        } else {
          showToast('请拖拽音频文件', 'error');
        }
      });
    }

    // Generate buttons
    $('btn-generate-music')?.addEventListener('click', generateMusic);
    $('btn-generate-lyrics')?.addEventListener('click', generateLyrics);
    $('btn-generate-cover')?.addEventListener('click', generateCover);
    $('btn-generate-voice')?.addEventListener('click', generateVoice);

    // Reset buttons
    $('btn-reset-music')?.addEventListener('click', () => resetTab('music'));
    $('btn-reset-lyrics')?.addEventListener('click', () => resetTab('lyrics'));
    $('btn-reset-cover')?.addEventListener('click', () => resetTab('cover'));
    $('btn-reset-voice')?.addEventListener('click', () => resetTab('covervoice'));

    // Download buttons
    $('btn-download-music')?.addEventListener('click', () => { const src = $('music-audio')?.src; if (src) downloadFile(src, 'ai-music.mp3'); });
    $('btn-download-cover')?.addEventListener('click', () => { const src = $('cover-image')?.src; if (src) downloadFile(src, 'ai-cover.png'); });
    $('btn-download-voice')?.addEventListener('click', () => { const src = $('voice-audio')?.src; if (src) downloadFile(src, 'ai-voice-cover.mp3'); });

    // Copy lyrics
    $('btn-copy-lyrics')?.addEventListener('click', () => {
      const text = currentResult.lyrics?.lyrics || currentResult.lyrics?.content || '';
      copyToClipboard(text);
    });

    // Use lyrics in music
    $('btn-use-lyrics')?.addEventListener('click', () => {
      const lyrics = currentResult.lyrics?.lyrics || currentResult.lyrics?.content || '';
      if (!lyrics) return;
      switchTab('music');
      const el = $('music-prompt');
      if (el) { el.value = lyrics; $('music-char').textContent = lyrics.length; }
      showToast('歌词已导入到音乐生成', 'success');
    });

    // Image modal
    $('modal-close')?.addEventListener('click', closeImageModal);
    $('image-modal')?.addEventListener('click', e => { if (e.target === $('image-modal')) closeImageModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeImageModal(); });

    // Quota
    loadQuota();
    setInterval(loadQuota, 30000);

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.ctrlKey || e.shiftKey || e.altKey) return;
      const tag = document.activeElement.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      const handlers = { music: generateMusic, lyrics: generateLyrics, cover: generateCover, covervoice: generateVoice, chat: sendChatMessage };
      handlers[currentTab]?.();
    });

    // Speech tab
    initSpeechTab();

    // Chat
    $('btn-chat-send')?.addEventListener('click', sendChatMessage);
    $('chat-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); sendChatMessage(); }
    });

    // Custom dropdown for chat model
    initCustomDropdown('chat-model-dropdown', 'chat-model');

    // Convert all config selects to custom dropdowns
    convertAllSelectsToCustomDropdowns();
  }

  // ============================================
  //  Convert Selects to Custom Dropdowns
  // ============================================
  function convertAllSelectsToCustomDropdowns() {
    // Find all selects that need to be converted
    const selectsToConvert = [
      'music-style', 'music-bpm', 'music-key', 'music-duration',
      'lyrics-style', 'lyrics-structure',
      'cover-ratio', 'cover-style',
      'voice-timbre', 'voice-pitch',
      'speech-voice', 'speech-emotion', 'speech-format'
    ];

    selectsToConvert.forEach(selectId => {
      const select = $(selectId);
      if (!select) return;
      if (select.closest('.custom-dropdown-sm')) return; // Already converted

      const parent = select.parentElement;
      if (!parent) return;

      const options = Array.from(select.options);
      const selectedValue = select.value;
      const selectedText = options.find(o => o.value === selectedValue)?.text || options[0]?.text || '';

      // Build custom dropdown HTML
      const dropdownId = `${selectId}-dropdown`;
      const dropdownHTML = `
        <div class="custom-dropdown-sm" id="${dropdownId}">
          <div class="dropdown-trigger">
            <span class="dropdown-value">${selectedText}</span>
            <svg class="dropdown-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="dropdown-menu" hidden>
            ${options.map(opt => `<div class="dropdown-option ${opt.value === selectedValue ? 'active' : ''}" data-value="${opt.value}">${opt.text}</div>`).join('')}
          </div>
        </div>
      `;

      // Replace select with custom dropdown
      select.style.display = 'none'; // Hide original select
      const wrapper = document.createElement('div');
      wrapper.innerHTML = dropdownHTML;
      parent.insertBefore(wrapper.firstElementChild, select);

      // Initialize the custom dropdown
      initCustomDropdownSm(dropdownId, selectId);
    });
  }

  // Initialize small dropdown (for config items)
  function initCustomDropdownSm(dropdownId, inputId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    const trigger = dropdown.querySelector('.dropdown-trigger');
    const menu = dropdown.querySelector('.dropdown-menu');
    const options = dropdown.querySelectorAll('.dropdown-option');
    const valueSpan = dropdown.querySelector('.dropdown-value');
    const hiddenInput = document.getElementById(inputId);

    if (!trigger || !menu) return;

    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');

      // Close all other dropdowns
      document.querySelectorAll('.custom-dropdown-sm.open, .custom-dropdown.open').forEach(d => {
        if (d.id !== dropdownId) {
          d.classList.remove('open');
          d.querySelector('.dropdown-menu')?.setAttribute('hidden', '');
        }
      });

      if (isOpen) {
        dropdown.classList.remove('open');
        menu.setAttribute('hidden', '');
      } else {
        dropdown.classList.add('open');
        menu.removeAttribute('hidden');
      }
    });

    // Option selection
    options.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const value = option.dataset.value;
        const text = option.textContent;

        // Update hidden select
        if (hiddenInput) {
          hiddenInput.value = value;
          // Trigger change event
          hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Update display
        if (valueSpan) valueSpan.textContent = text;

        // Update active state
        options.forEach(o => o.classList.remove('active'));
        option.classList.add('active');

        // Close dropdown
        dropdown.classList.remove('open');
        menu.setAttribute('hidden', '');
      });
    });

    // Close on outside click
    document.addEventListener('click', () => {
      if (dropdown.classList.contains('open')) {
        dropdown.classList.remove('open');
        menu.setAttribute('hidden', '');
      }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dropdown.classList.contains('open')) {
        dropdown.classList.remove('open');
        menu.setAttribute('hidden', '');
      }
    });
  }

  // Mobile sidebar toggle
  function initMobileSidebar() {
    const toggle = $('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = $('sidebar-overlay');

    if (!toggle || !sidebar) return;

    function openSidebar() {
      sidebar.classList.add('open');
      overlay?.classList.add('show');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
      sidebar.classList.remove('open');
      overlay?.classList.remove('show');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    toggle.addEventListener('click', () => {
      if (sidebar.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    overlay?.addEventListener('click', closeSidebar);

    // Close sidebar when clicking a nav item on mobile
    $$('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 767) {
          closeSidebar();
        }
      });
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      if (window.innerWidth > 767) {
        closeSidebar();
      }
    });
  }

  // Form validation helpers
  function showInputError(inputId, message) {
    const input = $(inputId);
    if (!input) return;
    input.classList.add('input-error');
    input.setAttribute('aria-invalid', 'true');

    // Remove existing error message
    const existingError = input.parentElement.querySelector('.input-error-message');
    if (existingError) existingError.remove();

    // Add error message
    const errorEl = document.createElement('div');
    errorEl.className = 'input-error-message';
    errorEl.textContent = message;
    errorEl.setAttribute('role', 'alert');
    input.parentElement.appendChild(errorEl);

    // Focus the input
    input.focus();
  }

  function clearInputError(inputId) {
    const input = $(inputId);
    if (!input) return;
    input.classList.remove('input-error');
    input.removeAttribute('aria-invalid');
    const errorEl = input.parentElement.querySelector('.input-error-message');
    if (errorEl) errorEl.remove();
  }

  // Tab switching with animation
  function switchTab(tab) {
    const currentContent = document.querySelector('.tab-content.active');
    const newContent = $(`tab-${tab}`);
    const currentNav = document.querySelector('.nav-item.active');
    const newNav = document.querySelector(`.nav-item[data-tab="${tab}"]`);

    if (newContent && currentContent !== newContent) {
      // Animate out current
      currentContent?.classList.add('tab-exit');
      setTimeout(() => {
        currentContent?.classList.remove('active', 'tab-exit');
        // Animate in new
        newContent.classList.add('tab-enter');
        requestAnimationFrame(() => {
          newContent.classList.add('active');
          setTimeout(() => newContent.classList.remove('tab-enter'), 300);
        });
      }, 150);
    }

    // Update nav
    currentNav?.classList.remove('active');
    newNav?.classList.add('active');

    currentTab = tab;
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); initMobileSidebar(); });
  } else {
    init();
    initMobileSidebar();
  }
})();
