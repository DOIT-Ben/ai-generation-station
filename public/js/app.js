/* =============================================
   AI 内容生成站 - App JS
   ============================================= */

(function () {
  'use strict';

  // ---- State ----
  let currentTab = 'chat';
  let currentResult = {};
  let progressInterval = null;

  // ---- Chat Queue State ----
  let chatQueue = [];
  let isChatGenerating = false;
  let pendingChatInput = null; // 保存排队时用户输入的内容

  // ---- DOM helpers ----
  const $ = id => document.getElementById(id);
  const $$ = (sel, ctx) => (ctx || document).querySelectorAll(sel);

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
  //  Loading Overlay
  // ============================================
  function showLoading(text = '正在生成...', initialProgress = 0) {
    const overlay = $('loading-overlay');
    $('loading-text').textContent = text;
    $('loading-progress-fill').style.width = initialProgress + '%';
    $('loading-percent').textContent = initialProgress + '%';
    overlay.classList.add('show');
    overlay.removeAttribute('hidden');
  }

  function updateLoading(progress) {
    $('loading-progress-fill').style.width = progress + '%';
    $('loading-percent').textContent = Math.round(progress) + '%';
  }

  function hideLoading() {
    const overlay = $('loading-overlay');
    overlay.classList.remove('show');
    setTimeout(() => overlay.setAttribute('hidden', ''), 400);
  }

  // ============================================
  //  Inline Progress
  // ============================================
  function startInlineProgress(tab, fillId, textId) {
    const card = $(`${tab}-generating`);
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
    const fill = $(`${currentTab}-progress-fill`);
    const text = $(`${currentTab}-progress-text`);
    if (fill) fill.style.width = '100%';
    if (text) text.textContent = '100%';
    setTimeout(() => $(`${currentTab}-generating`)?.setAttribute('hidden', ''), 600);
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
  async function generateContent({ apiEndpoint, domIds, resultTab, loadingText, successMessage, onSuccess }) {
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
  function generateMusic() {
    generateContent({
      apiEndpoint: '/api/generate/music',
      domIds: { prompt: 'music-prompt', style: 'music-style', bpm: 'music-bpm', key: 'music-key', duration: 'music-duration' },
      resultTab: 'music',
      loadingText: '正在生成音乐...',
      successMessage: '音乐生成成功！',
      onSuccess: data => {
        $('music-audio').src = data.audio_url || data.url || '';
        $('music-duration-info').textContent = data.duration || '';
        $('music-model-info').textContent = data.model ? `模型: ${data.model}` : '';
      },
    });
  }

  function generateLyrics() {
    generateContent({
      apiEndpoint: '/api/generate/lyrics',
      domIds: { prompt: 'lyrics-prompt', style: 'lyrics-style', structure: 'lyrics-structure' },
      resultTab: 'lyrics',
      loadingText: '正在创作歌词...',
      successMessage: '歌词创作完成！',
      onSuccess: data => {
        $('lyrics-content').innerHTML = `<pre>${escapeHtml(data.lyrics || data.content || '')}</pre>`;
        $('lyrics-meta').textContent = data.model ? `模型: ${data.model}` : '';
      },
    });
  }

  function generateCover() {
    generateContent({
      apiEndpoint: '/api/generate/cover',
      domIds: { prompt: 'cover-prompt', ratio: 'cover-ratio', style: 'cover-style' },
      resultTab: 'cover',
      loadingText: '正在生成封面...',
      successMessage: '封面生成成功！',
      onSuccess: data => {
        const img = $('cover-image');
        img.src = data.image_url || data.url || '';
        img.onclick = () => openImageModal(img.src);
        $('cover-meta').textContent = data.model ? `模型: ${data.model}` : '';
      },
    });
  }

  function generateVoice() {
    const fileInput = $('voice-audio-file');
    const urlInput = $('voice-audio-url');
    const audioUrl = urlInput?.value?.trim();
    const prompt = $('voice-prompt')?.value?.trim();

    // 优先使用文件上传
    if (fileInput?.files?.[0]) {
      const file = fileInput.files[0];
      if (!prompt) { showToast('请填写翻唱描述', 'error'); return; }
      generateVoiceWithFile(file, prompt);
      return;
    }

    // 其次用 URL
    if (!audioUrl) { showToast('请上传音频文件或填写歌曲链接', 'error'); return; }
    if (!prompt) { showToast('请填写翻唱描述', 'error'); return; }

    generateVoiceWithUrl(audioUrl, prompt);
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

  function generateVoiceWithUrl(audioUrl, prompt) {
    generateContent({
      apiEndpoint: '/api/generate/voice',
      domIds: { audio_url: 'voice-audio-url', prompt: 'voice-prompt', timbre: 'voice-timbre', pitch: 'voice-pitch' },
      resultTab: 'covervoice',
      loadingText: '正在处理翻唱...',
      successMessage: '歌声翻唱完成！',
      onSuccess: data => {
        $('voice-audio').src = data.audio_url || data.url || '';
        $('voice-meta').textContent = data.model ? `模型: ${data.model}` : '';
      },
    });
  }

  async function doVoiceGenerate(audioUrl, prompt) {
    const btn = $('btn-generate-voice');
    const resultEl = $('covervoice-result');
    const resultTab = 'covervoice';

    if (btn) btn.disabled = true;
    if (resultEl) resultEl.setAttribute('hidden', '');

    startInlineProgress(resultTab, `${resultTab}-progress-fill`, `${resultTab}-progress-text`);

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
      stopInlineProgress();

      $('voice-audio').src = data.audio_url || data.url || '';
      $('voice-meta').textContent = data.model ? `模型: ${data.model}` : '';

      if (resultEl) { resultEl.removeAttribute('hidden'); resultEl.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }); }
      currentResult[resultTab] = data;
      loadQuota();
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

  function addChatMessage(role, content) {
    const container = $('chat-messages');
    const avatar = role === 'user' ? '😀' : '🤖';
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${role}`;
    msgDiv.innerHTML = `<div class="message-avatar">${avatar}</div><div class="message-content"><p>${escapeHtml(content)}</p></div>`;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
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

  async function sendChatMessage() {
    const input = $('chat-input');
    const message = input?.value?.trim();
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
        addChatMessage('chatbot', data.reply);
        chatHistory.push({ role: 'assistant', content: data.reply });
        loadQuota();
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
        addChatMessage('chatbot', data.reply);
        chatHistory.push({ role: 'assistant', content: data.reply });
        loadQuota();
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
    initTabs();
    initTheme();

    // Char counters
    [['music-prompt', 'music-char'], ['lyrics-prompt', 'lyrics-char'],
     ['cover-prompt', 'cover-char'], ['voice-prompt', 'voice-char']].forEach(([id, counterId]) => {
      const el = $(id);
      const counter = $(counterId);
      if (el && counter) el.addEventListener('input', () => { counter.textContent = el.value.length; });
    });

    // 文件上传选中后显示文件名
    $('voice-audio-file')?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      $('voice-file-name').textContent = file ? file.name : '';
    });

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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
logout
logout
logout
