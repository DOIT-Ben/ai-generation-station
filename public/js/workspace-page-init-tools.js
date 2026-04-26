(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsWorkspacePageInitTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getElement = settings.getElement || function () { return null; };
    const apiFetch = settings.apiFetch || (async function () { return { json: async function () { return {}; } }; });
    const resolveApiAssetUrl = settings.resolveApiAssetUrl || function (value) { return value; };
    const getCurrentResult = settings.getCurrentResult || function () { return {}; };
    const recordFeatureHistory = settings.recordFeatureHistory || function () {};
    const showToast = settings.showToast || function () {};
    const showLoading = settings.showLoading || function () {};
    const hideLoading = settings.hideLoading || function () {};
    const loadQuota = settings.loadQuota || function () {};
    const refreshUsageToday = settings.refreshUsageToday || function () {};
    const getWindow = settings.getWindow || function () { return null; };
    const handleProtectedSessionLoss = settings.handleProtectedSessionLoss || function () {};
    const handlePasswordResetRequired = settings.handlePasswordResetRequired || function () {};
    const ensureFeatureExtensions = settings.ensureFeatureExtensions || function () {};
    const renderTemplateLibraries = settings.renderTemplateLibraries || function () {};
    const bindEnhancementEvents = settings.bindEnhancementEvents || function () {};
    const initTabs = settings.initTabs || function () {};
    const initTheme = settings.initTheme || function () {};
    const captureInitialFieldValues = settings.captureInitialFieldValues || function () {};
    const bootstrapAuth = settings.bootstrapAuth || function () {};
    const bindWorkspaceInteractions = settings.bindWorkspaceInteractions || function () {};
    const setTimeoutFn = settings.setTimeoutFn || function (callback) { return callback(); };

    function initSpeechTab() {
      const textArea = getElement('speech-text');
      const charCount = getElement('speech-char');
      textArea?.addEventListener('input', function () {
        if (charCount) charCount.textContent = textArea.value.length;
      });

      ['speech-speed', 'speech-pitch', 'speech-vol'].forEach(function (id) {
        const slider = getElement(id);
        const val = getElement(id.replace('speech-', 'speech-') + '-val') || getElement(id + '-val');
        if (slider && val) {
          const suffix = id === 'speech-vol' ? '%' : (id === 'speech-speed' ? 'x' : '');
          slider.addEventListener('input', function () {
            val.textContent = slider.value + suffix;
          });
        }
      });

      getElement('btn-speech-generate')?.addEventListener('click', async function () {
        const text = getElement('speech-text')?.value?.trim();
        if (!text) {
          showToast('请输入要转换的文本', 'error');
          return;
        }

        showLoading('正在生成语音...', 0);
        const btn = getElement('btn-speech-generate');
        if (btn) btn.disabled = true;

        try {
          const res = await apiFetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              voice_id: getElement('speech-voice')?.value,
              emotion: getElement('speech-emotion')?.value,
              speed: parseFloat(getElement('speech-speed')?.value || 1),
              pitch: parseFloat(getElement('speech-pitch')?.value || 0),
              vol: parseInt(getElement('speech-vol')?.value || 100, 10),
              output_format: getElement('speech-format')?.value,
              model: 'speech-2.8-hd'
            })
          });
          const data = await res.json();

          if (data.success) {
            getElement('speech-result')?.removeAttribute('hidden');
            const audio = getElement('speech-audio');
            if (audio) audio.src = resolveApiAssetUrl(data.url);
            const info = getElement('speech-info');
            if (info) info.textContent = '音频时长: ' + (data.extra?.audio_length || '?') + 's | 消耗字符: ' + (data.extra?.usage_characters || text.length);
            const currentResult = getCurrentResult();
            currentResult.speech = { url: resolveApiAssetUrl(data.url), info: info?.textContent || '' };
            recordFeatureHistory('speech', text, (getElement('speech-voice')?.value || '') + ' · ' + (getElement('speech-emotion')?.value || ''), {
              text,
              voice_id: getElement('speech-voice')?.value,
              emotion: getElement('speech-emotion')?.value,
              speed: getElement('speech-speed')?.value,
              pitch: getElement('speech-pitch')?.value,
              vol: getElement('speech-vol')?.value,
              output_format: getElement('speech-format')?.value
            }, {
              url: resolveApiAssetUrl(data.url),
              info: info?.textContent || ''
            });
            showToast('语音生成成功！', 'success');
            loadQuota();
            refreshUsageToday();
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

    async function init() {
      const windowRef = getWindow();
      windowRef?.addEventListener('app-auth-expired', function (event) {
        const message = event?.detail?.message || '登录状态已失效，请重新登录';
        handleProtectedSessionLoss(message);
      });
      windowRef?.addEventListener('app-password-reset-required', function (event) {
        handlePasswordResetRequired(event?.detail || {});
      });
      ensureFeatureExtensions();
      renderTemplateLibraries();
      bindEnhancementEvents();
      initTabs();
      initTheme();
      const queuedWelcomeToast = windowRef?.SiteShell?.consumeQueuedWelcomeToast?.();
      if (queuedWelcomeToast) {
        setTimeoutFn(function () {
          windowRef?.SiteShell?.showWelcomeToast?.(queuedWelcomeToast);
        }, 240);
      }
      captureInitialFieldValues();
      bootstrapAuth();
      bindWorkspaceInteractions();
    }

    return {
      initSpeechTab: initSpeechTab,
      init: init
    };
  }

  return {
    createTools: createTools
  };
}));
