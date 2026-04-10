/* =============================================
   AI 内容生成站 - App JS
   ============================================= */

(function () {
  'use strict';

  // ---- State ----
  let currentTab = 'chat';
  let currentResult = {};
  let progressInterval = null;

  // ---- DOM refs ----
  const $ = (id) => document.getElementById(id);
  const $$ = (sel, ctx) => (ctx || document).querySelectorAll(sel);

  // ---- Tab Navigation ----
  function initTabs() {
    $$('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
      });
    });
  }

  function switchTab(tab) {
    // Update nav
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    // Update content
    $$('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));
    currentTab = tab;
  }

  // ---- Char Count ----
  function initCharCount(textarea, counterId) {
    const counter = $(counterId);
    textarea.addEventListener('input', () => {
      counter.textContent = textarea.value.length;
    });
  }

  // ---- Loading Overlay ----
  function showLoading(text = '正在生成...', initialProgress = 0) {
    const overlay = $('loading-overlay');
    $('loading-text').textContent = text;
    $('loading-progress-fill').style.width = initialProgress + '%';
    $('loading-percent').textContent = initialProgress + '%';
    overlay.classList.add('show');
    overlay.removeAttribute('hidden');
  }

  function updateLoading(progress) {
    const fill = $('loading-progress-fill');
    const pct = $('loading-percent');
    fill.style.width = progress + '%';
    pct.textContent = Math.round(progress) + '%';
  }

  function hideLoading() {
    const overlay = $('loading-overlay');
    overlay.classList.remove('show');
    setTimeout(() => overlay.setAttribute('hidden', ''), 400);
  }

  // ---- Inline Progress (generating-card) ----
  function startInlineProgress(tab, fillId, textId) {
    const card = $(`${tab}-generating`);
    const fill = $(fillId);
    const text = $(textId);
    card.removeAttribute('hidden');

    let progress = 0;
    const speeds = { music: 1.2, lyrics: 2.5, cover: 1.8, covervoice: 1.0 };
    const baseSpeed = speeds[tab] || 1.5;

    progressInterval = setInterval(() => {
      progress += Math.random() * baseSpeed * 3;
      if (progress > 88) progress = 88;
      fill.style.width = progress + '%';
      text.textContent = Math.round(progress) + '%';
    }, 200);
  }

  function stopInlineProgress(progress = 100) {
    clearInterval(progressInterval);
    progressInterval = null;
    // Fast-forward to 100%
    const fillId = `${currentTab}-progress-fill`;
    const textId = `${currentTab}-progress-text`;
    const fill = $(fillId);
    const text = $(textId);
    if (fill) { fill.style.width = '100%'; text.textContent = '100%'; }

    setTimeout(() => {
      const card = $(`${currentTab}-generating`);
      if (card) card.setAttribute('hidden', '');
    }, 600);
  }

  // ---- Toast ----
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

  // ---- Theme ----
  function getStoredTheme() {
    return localStorage.getItem('theme') || 'dark';
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const btn = $('theme-toggle');
    if (btn) btn.setAttribute('data-tip', theme === 'light' ? '浅色模式' : '深色模式');
  }

  function toggleTheme() {
    const current = getStoredTheme();
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  function initTheme() {
    const stored = getStoredTheme();
    setTheme(stored);
    $('theme-toggle').addEventListener('click', toggleTheme);
  }

  // ---- Quota (global so inline onclick works) ----
  let quotaLoading = false;
  window.loadQuota = async function loadQuota() {
    if (quotaLoading) return;
    quotaLoading = true;

    const el = $('quota-info');
    try {
      const res = await fetch('/api/quota');
      if (!res.ok) throw new Error('获取配额失败');
      const data = await res.json();
      const models = data.model_remains || [];

      if (models.length === 0) {
        el.innerHTML = '<div class="quota-loading">无可用配额数据</div>';
        return;
      }

      // Map model names → friendly Chinese labels
      const MODEL_LABELS = {
        'MiniMax-M*': '通用对话',
        'speech-hd': '语音合成',
        'music-2.5': '音乐生成',
        'music-2.6': '音乐生成',
        'music-cover': '歌声翻唱',
        'lyrics_generation': '歌词创作',
        'image-01': '封面生成',
        'MiniMax-Hailuo-2.3-Fast-6s-768p': '视频生成',
        'MiniMax-Hailuo-2.3-6s-768p': '视频生成',
      };

      // Preferred order
      const LABEL_ORDER = ['通用对话', '音乐生成', '歌声翻唱', '歌词创作', '封面生成', '语音合成', '视频生成'];

      function getModelLabel(name) {
        return MODEL_LABELS[name] || name || '其他';
      }

      // Filter out entries with no quota data (total === 0), then deduplicate by label
      const seen = new Set();
      const unique = [];
      for (const m of models) {
        if (m.current_interval_total_count === 0) continue;
        const label = getModelLabel(m.model_name);
        if (!seen.has(label)) {
          seen.add(label);
          unique.push(m);
        }
      }

      // Sort by preferred order
      unique.sort((a, b) => {
        const ia = LABEL_ORDER.indexOf(getModelLabel(a.model_name));
        const ib = LABEL_ORDER.indexOf(getModelLabel(b.model_name));
        const ai = ia === -1 ? 999 : ia;
        const bi = ib === -1 ? 999 : ib;
        return ai - bi;
      });

      const shown = unique.slice(0, 8);
      const html = shown.map(m => {
        const total = m.current_interval_total_count;
        const used = m.current_interval_usage_count;
        const pct = total > 0 ? Math.round((used / total) * 100) : 0;
        const pctClass = pct >= 100 ? 'full' : pct > 60 ? 'high' : pct > 30 ? 'medium' : 'low';
        const label = getModelLabel(m.model_name);
        return `
          <div class="quota-item">
            <div class="quota-item-header">
              <span class="quota-label">${escapeHtml(label)}</span>
              <span class="quota-num">
                <span class="used">${used}</span><span class="total">/${total}</span>
                <span class="pct ${pctClass}">${pct}%</span>
              </span>
            </div>
            <div class="quota-bar-track">
              <div class="quota-bar-fill ${pctClass}" style="--fill-width:${pct}%"></div>
            </div>
          </div>`;
      }).join('');

      el.innerHTML = `
        <div class="quota-list">${html}</div>
        <button class="quota-refresh" id="btn-quota-refresh" title="刷新配额">↻ 刷新</button>`;
      $('btn-quota-refresh').addEventListener('click', (e) => {
        e.stopPropagation();
        loadQuota();
      });
    } catch {
      el.innerHTML = '<div class="quota-loading">无法加载配额</div>';
    } finally {
      quotaLoading = false;
    }
  }

  // ---- Result Area Helpers ----
  function showResult(tab, data) {
    const area = $(`${tab}-result`);
    area.removeAttribute('hidden');
    // Scroll into view smoothly
    setTimeout(() => area.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    // Refresh quota after successful API call
    loadQuota();
  }

  // ---- Music Generation ----
  async function generateMusic() {
    const prompt = $('music-prompt').value.trim();
    if (!prompt) { showToast('请输入歌词或描述', 'error'); return; }

    const config = {
      prompt,
      style: $('music-style').value,
      bpm: $('music-bpm').value,
      key: $('music-key').value,
      duration: $('music-duration').value,
    };

    $('btn-generate-music').disabled = true;
    $('music-result').setAttribute('hidden', '');

    showLoading('正在生成音乐...', 0);
    startInlineProgress('music', 'music-progress-fill', 'music-progress-text');

    try {
      const res = await fetch('/api/generate/music', {
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

      $('music-audio').src = data.audio_url || data.url || '';
      $('music-duration-info').textContent = data.duration || '';
      $('music-model-info').textContent = data.model ? `模型: ${data.model}` : '';

      showResult('music', data);
      showToast('音乐生成成功！', 'success');
      currentResult.music = data;

    } catch (err) {
      stopInlineProgress();
      showToast(err.message || '生成失败，请重试', 'error');
    } finally {
      hideLoading();
      $('btn-generate-music').disabled = false;
    }
  }

  // ---- Lyrics Generation ----
  async function generateLyrics() {
    const prompt = $('lyrics-prompt').value.trim();
    if (!prompt) { showToast('请输入主题或描述', 'error'); return; }

    const config = {
      prompt,
      style: $('lyrics-style').value,
      structure: $('lyrics-structure').value,
    };

    $('btn-generate-lyrics').disabled = true;
    $('lyrics-result').setAttribute('hidden', '');

    showLoading('正在创作歌词...', 0);
    startInlineProgress('lyrics', 'lyrics-progress-fill', 'lyrics-progress-text');

    try {
      const res = await fetch('/api/generate/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '生成失败');
      }

      const data = await res.json();
      stopInlineProgress();

      $('lyrics-content').innerHTML = `<pre>${escapeHtml(data.lyrics || data.content || '')}</pre>`;
      $('lyrics-meta').textContent = data.model ? `模型: ${data.model}` : '';

      showResult('lyrics', data);
      showToast('歌词创作完成！', 'success');
      currentResult.lyrics = data;

    } catch (err) {
      stopInlineProgress();
      showToast(err.message || '生成失败，请重试', 'error');
    } finally {
      hideLoading();
      $('btn-generate-lyrics').disabled = false;
    }
  }

  // ---- Cover Generation ----
  async function generateCover() {
    const prompt = $('cover-prompt').value.trim();
    if (!prompt) { showToast('请输入封面描述', 'error'); return; }

    const config = {
      prompt,
      ratio: $('cover-ratio').value,
      style: $('cover-style').value,
    };

    $('btn-generate-cover').disabled = true;
    $('cover-result').setAttribute('hidden', '');

    showLoading('正在生成封面...', 0);
    startInlineProgress('cover', 'cover-progress-fill', 'cover-progress-text');

    try {
      const res = await fetch('/api/generate/cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '生成失败');
      }

      const data = await res.json();
      stopInlineProgress();

      const img = $('cover-image');
      img.src = data.image_url || data.url || '';
      img.onclick = () => openImageModal(img.src);
      $('cover-meta').textContent = data.model ? `模型: ${data.model}` : '';

      showResult('cover', data);
      showToast('封面生成成功！', 'success');
      currentResult.cover = data;

    } catch (err) {
      stopInlineProgress();
      showToast(err.message || '生成失败，请重试', 'error');
    } finally {
      hideLoading();
      $('btn-generate-cover').disabled = false;
    }
  }

  // ---- Voice Cover Generation ----
  async function generateVoice() {
    const audioUrl = $('voice-audio-url').value.trim();
    const prompt = $('voice-prompt').value.trim();
    if (!audioUrl && !prompt) {
      showToast('请提供歌曲链接或描述', 'error');
      return;
    }

    const config = {
      audio_url: audioUrl,
      prompt,
      timbre: $('voice-timbre').value,
      pitch: $('voice-pitch').value,
    };

    $('btn-generate-voice').disabled = true;
    $('voice-result').setAttribute('hidden', '');

    showLoading('正在处理翻唱...', 0);
    startInlineProgress('covervoice', 'voice-progress-fill', 'voice-progress-text');

    try {
      const res = await fetch('/api/generate/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '生成失败');
      }

      const data = await res.json();
      stopInlineProgress();

      $('voice-audio').src = data.audio_url || data.url || '';
      $('voice-meta').textContent = data.model ? `模型: ${data.model}` : '';

      showResult('covervoice', data);
      showToast('歌声翻唱完成！', 'success');
      currentResult.covervoice = data;

    } catch (err) {
      stopInlineProgress();
      showToast(err.message || '生成失败，请重试', 'error');
    } finally {
      hideLoading();
      $('btn-generate-voice').disabled = false;
    }
  }

  // ---- Reset ----
  function resetTab(tab) {
    const maps = {
      music: [
        { id: 'music-prompt', val: '' },
        { id: 'music-style', val: '' },
        { id: 'music-bpm', val: '' },
        { id: 'music-key', val: '' },
        { id: 'music-duration', val: '' },
        { id: 'music-char', val: '0' },
      ],
      lyrics: [
        { id: 'lyrics-prompt', val: '' },
        { id: 'lyrics-style', val: '' },
        { id: 'lyrics-structure', val: '' },
        { id: 'lyrics-char', val: '0' },
      ],
      cover: [
        { id: 'cover-prompt', val: '' },
        { id: 'cover-ratio', val: '1:1' },
        { id: 'cover-style', val: '' },
        { id: 'cover-char', val: '0' },
      ],
      covervoice: [
        { id: 'voice-audio-url', val: '' },
        { id: 'voice-prompt', val: '' },
        { id: 'voice-timbre', val: '' },
        { id: 'voice-pitch', val: '' },
        { id: 'voice-char', val: '0' },
      ],
    };

    (maps[tab] || []).forEach(item => {
      const el = $(item.id);
      if (el) {
        if (el.tagName === 'SELECT') el.selectedIndex = 0;
        else el.value = item.val;
        if (item.id.endsWith('-char')) el.textContent = item.val;
      }
    });

    $(`${tab}-result`)?.setAttribute('hidden', '');
    $(`${tab}-generating`)?.setAttribute('hidden', '');
    currentResult[tab] = null;
  }

  // ---- Image Modal ----
  function openImageModal(src) {
    const modal = $('image-modal');
    $('modal-image').src = src;
    modal.removeAttribute('hidden');
  }

  function closeImageModal() {
    $('image-modal').setAttribute('hidden', '');
  }

  // ---- Download ----
  function downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ---- Copy to Clipboard ----
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制到剪贴板', 'success');
    } catch {
      showToast('复制失败', 'error');
    }
  }

  // ---- Use lyrics in music tab ----
  function useLyricsInMusic() {
    if (!currentResult.lyrics) return;
    const lyrics = currentResult.lyrics.lyrics || currentResult.lyrics.content || '';
    switchTab('music');
    $('music-prompt').value = lyrics;
    $('music-char').textContent = lyrics.length;
    showToast('歌词已导入到音乐生成', 'success');
  }

  // ---- Utility ----
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Init ----
  function init() {
    initTabs();

    // Char counters
    initCharCount($('music-prompt'), 'music-char');
    initCharCount($('lyrics-prompt'), 'lyrics-char');
    initCharCount($('cover-prompt'), 'cover-char');
    initCharCount($('voice-prompt'), 'voice-char');

    // Generate buttons
    $('btn-generate-music').addEventListener('click', generateMusic);
    $('btn-generate-lyrics').addEventListener('click', generateLyrics);
    $('btn-generate-cover').addEventListener('click', generateCover);
    $('btn-generate-voice').addEventListener('click', generateVoice);

    // Reset buttons
    $('btn-reset-music').addEventListener('click', () => resetTab('music'));
    $('btn-reset-lyrics').addEventListener('click', () => resetTab('lyrics'));
    $('btn-reset-cover').addEventListener('click', () => resetTab('cover'));
    $('btn-reset-voice').addEventListener('click', () => resetTab('covervoice'));

    // Download buttons
    $('btn-download-music').addEventListener('click', () => {
      const src = $('music-audio').src;
      if (src) downloadFile(src, 'ai-music.mp3');
    });
    $('btn-download-cover').addEventListener('click', () => {
      const src = $('cover-image').src;
      if (src) downloadFile(src, 'ai-cover.png');
    });
    $('btn-download-voice').addEventListener('click', () => {
      const src = $('voice-audio').src;
      if (src) downloadFile(src, 'ai-voice-cover.mp3');
    });

    // Copy lyrics
    $('btn-copy-lyrics').addEventListener('click', () => {
      const text = currentResult.lyrics?.lyrics || currentResult.lyrics?.content || '';
      copyToClipboard(text);
    });

    // Use lyrics in music
    $('btn-use-lyrics').addEventListener('click', useLyricsInMusic);

    // Image modal
    $('modal-close').addEventListener('click', closeImageModal);
    $('image-modal').addEventListener('click', (e) => {
      if (e.target === $('image-modal')) closeImageModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeImageModal();
    });

    // Quota
    loadQuota();
    // Refresh quota every 30s
    setInterval(loadQuota, 30000);

    // Theme
    initTheme();

    // Keyboard shortcut: Enter to generate (when not in textarea)
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.ctrlKey || e.shiftKey || e.altKey) return;
      const tag = document.activeElement.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;

      const handlers = {
        music: generateMusic,
        lyrics: generateLyrics,
        cover: generateCover,
        covervoice: generateVoice,
        chat: sendChatMessage,
        speech: initSpeechTab,
      };
      handlers[currentTab]?.();
    });

    // Speech synthesis functionality
    function initSpeechTab() {
      const textArea = $('speech-text');
      const charCount = $('speech-char');
      const speedSlider = $('speech-speed');
      const pitchSlider = $('speech-pitch');
      const volSlider = $('speech-vol');
      const speedVal = $('speed-val');
      const pitchVal = $('pitch-val');
      const volVal = $('vol-val');

      textArea.addEventListener('input', () => {
        charCount.textContent = textArea.value.length;
      });

      speedSlider.addEventListener('input', () => { speedVal.textContent = speedSlider.value + 'x'; });
      pitchSlider.addEventListener('input', () => { pitchVal.textContent = pitchSlider.value; });
      volSlider.addEventListener('input', () => { volVal.textContent = volSlider.value + '%'; });

      $('btn-speech-generate').addEventListener('click', async () => {
        const text = $('speech-text').value.trim();
        if (!text) { showToast('请输入要转换的文本', 'error'); return; }

        showLoading('正在生成语音...');
        $('btn-speech-generate').disabled = true;

        try {
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: text,
              voice_id: $('speech-voice').value,
              emotion: $('speech-emotion').value,
              speed: parseFloat($('speech-speed').value),
              pitch: parseFloat($('speech-pitch').value),
              vol: parseInt($('speech-vol').value),
              output_format: $('speech-format').value,
              model: 'speech-2.8-hd'
            })
          });
          const data = await res.json();

          if (data.success) {
            $('speech-result').hidden = false;
            $('speech-audio').src = data.url;
            $('speech-info').textContent = `音频时长: ${data.extra?.audio_length || '?'}s | 消耗字符: ${data.extra?.usage_characters || text.length}`;
            showToast('语音生成成功！', 'success');
          } else {
            showToast(data.error || '生成失败', 'error');
          }
        } catch (e) {
          showToast('请求失败: ' + e.message, 'error');
        } finally {
          hideLoading();
          $('btn-speech-generate').disabled = false;
        }
      });
    }

    // Chat functionality
    let chatHistory = [];

    function addChatMessage(role, content) {
      const container = $('chat-messages');
      const avatar = role === 'user' ? '😀' : '🤖';
      const msgDiv = document.createElement('div');
      msgDiv.className = `chat-message ${role}`;
      msgDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content"><p>${escapeHtml(content)}</p></div>
      `;
      container.appendChild(msgDiv);
      container.scrollTop = container.scrollHeight;
    }

    function setChatLoading(loading) {
      const sendBtn = $('btn-chat-send');
      const input = $('chat-input');
      if (loading) {
        sendBtn.disabled = true;
        input.disabled = true;
      } else {
        sendBtn.disabled = false;
        input.disabled = false;
      }
    }

    async function sendChatMessage() {
      const input = $('chat-input');
      const message = input.value.trim();
      if (!message) return;

      addChatMessage('user', message);
      chatHistory.push({ role: 'user', content: message });
      input.value = '';
      setChatLoading(true);

      try {
        const model = $('chat-model').value;
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: chatHistory, model })
        });
        const data = await res.json();

        if (data.error) {
          addChatMessage('chatbot', '抱歉，发生了错误：' + data.error);
        } else {
          addChatMessage('chatbot', data.reply);
          chatHistory.push({ role: 'assistant', content: data.reply });
          loadQuota(); // Refresh quota after chat
        }
      } catch (e) {
        addChatMessage('chatbot', '网络错误，请稍后重试。');
      }

      setChatLoading(false);
    }

    $('btn-chat-send').addEventListener('click', sendChatMessage);
    $('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();





