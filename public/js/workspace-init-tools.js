(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsWorkspaceInitTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getElement = settings.getElement || function () { return null; };
    const queryAll = settings.queryAll || function () { return []; };
    const createElement = settings.createElement || function () { return null; };
    const getDocument = settings.getDocument || function () { return null; };
    const getWindow = settings.getWindow || function () { return null; };
    const getCurrentResult = settings.getCurrentResult || function () { return {}; };
    const getCurrentTab = settings.getCurrentTab || function () { return 'chat'; };
    const getResolveApiAssetUrl = settings.getResolveApiAssetUrl || function (value) { return value; };
    const getHiddenInputValue = settings.getHiddenInputValue || function () { return ''; };
    const setChatArchivedCollapsed = settings.setChatArchivedCollapsed || function () {};
    const getReadChatArchivedCollapsedPreference = settings.getReadChatArchivedCollapsedPreference || function () { return false; };
    const syncChatArchivedSectionState = settings.syncChatArchivedSectionState || function () {};
    const setQuotaCollapsed = settings.setQuotaCollapsed || function () {};
    const getReadQuotaCollapsedPreference = settings.getReadQuotaCollapsedPreference || function () { return false; };
    const syncQuotaCardState = settings.syncQuotaCardState || function () {};
    const bindQuotaToggle = settings.bindQuotaToggle || function () {};
    const loadQuota = settings.loadQuota || function () {};
    const initSpeechTab = settings.initSpeechTab || function () {};
    const scheduleWorkspaceStateSave = settings.scheduleWorkspaceStateSave || function () {};
    const syncTranscriptionFilePreview = settings.syncTranscriptionFilePreview || function () {};
    const applyVoiceSourceMode = settings.applyVoiceSourceMode || function () {};
    const resetTab = settings.resetTab || function () {};
    const generateMusic = settings.generateMusic || function () {};
    const generateLyrics = settings.generateLyrics || function () {};
    const generateCover = settings.generateCover || function () {};
    const generateVoice = settings.generateVoice || function () {};
    const startTranscriptionShell = settings.startTranscriptionShell || function () {};
    const downloadFile = settings.downloadFile || function () {};
    const copyToClipboard = settings.copyToClipboard || function () {};
    const switchTab = settings.switchTab || function () {};
    const showToast = settings.showToast || function () {};
    const closeImageModal = settings.closeImageModal || function () {};
    const trapImageModalFocus = settings.trapImageModalFocus || function () {};
    const sendChatMessage = settings.sendChatMessage || function () {};
    const stopChatGeneration = settings.stopChatGeneration || function () {};
    const clearFeatureDraft = settings.clearFeatureDraft || function () {};
    const updateChatComposerState = settings.updateChatComposerState || function () {};
    const queueChatViewportSync = settings.queueChatViewportSync || function () {};
    const ensureChatComposerVisible = settings.ensureChatComposerVisible || function () {};
    const handleChatMessagesScroll = settings.handleChatMessagesScroll || function () {};
    const initializeChatModelDropdownLoadingState = settings.initializeChatModelDropdownLoadingState || function () {};
    const initCustomDropdown = settings.initCustomDropdown || function () {};
    const loadChatModelOptions = settings.loadChatModelOptions || function () {};
    const schedulePreferenceSave = settings.schedulePreferenceSave || function () {};
    const updateChatScrollButton = settings.updateChatScrollButton || function () {};
    const setChatAutoFollow = settings.setChatAutoFollow || function () {};
    const isChatNearBottom = settings.isChatNearBottom || function () { return true; };
    const setIntervalFn = settings.setIntervalFn || function () {};
    const setTimeoutFn = settings.setTimeoutFn || function (callback) { return callback(); };

    function convertAllSelectsToCustomDropdowns() {
      const selectsToConvert = [
        'music-style', 'music-bpm', 'music-key', 'music-duration',
        'lyrics-style', 'lyrics-structure',
        'cover-ratio', 'cover-style',
        'voice-timbre', 'voice-pitch',
        'speech-voice', 'speech-emotion', 'speech-format'
      ];

      selectsToConvert.forEach(selectId => {
        const select = getElement(selectId);
        if (!select) return;
        if (select.closest('.custom-dropdown-sm')) return;

        const parent = select.parentElement;
        if (!parent) return;

        const options = Array.from(select.options);
        const selectedValue = select.value;
        const selectedText = options.find(o => o.value === selectedValue)?.text || options[0]?.text || '';
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

        select.style.display = 'none';
        const wrapper = createElement('div');
        wrapper.innerHTML = dropdownHTML;
        parent.insertBefore(wrapper.firstElementChild, select);
        initCustomDropdownSm(dropdownId, selectId);
      });
    }

    function initCustomDropdownSm(dropdownId, inputId) {
      const dropdown = getElement(dropdownId);
      if (!dropdown) return;

      const trigger = dropdown.querySelector('.dropdown-trigger');
      const menu = dropdown.querySelector('.dropdown-menu');
      const options = dropdown.querySelectorAll('.dropdown-option');
      const valueSpan = dropdown.querySelector('.dropdown-value');
      const hiddenInput = getElement(inputId);
      const documentRef = getDocument();
      if (!trigger || !menu || !documentRef) return;

      trigger.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');
        documentRef.querySelectorAll('.custom-dropdown-sm.open, .custom-dropdown.open').forEach(d => {
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

      options.forEach(option => {
        option.addEventListener('click', e => {
          e.stopPropagation();
          const value = option.dataset.value;
          const text = option.textContent;
          if (hiddenInput) {
            hiddenInput.value = value;
            hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (valueSpan) valueSpan.textContent = text;
          options.forEach(o => o.classList.remove('active'));
          option.classList.add('active');
          dropdown.classList.remove('open');
          menu.setAttribute('hidden', '');
        });
      });

      documentRef.addEventListener('click', () => {
        if (dropdown.classList.contains('open')) {
          dropdown.classList.remove('open');
          menu.setAttribute('hidden', '');
        }
      });

      documentRef.addEventListener('keydown', e => {
        if (e.key === 'Escape' && dropdown.classList.contains('open')) {
          dropdown.classList.remove('open');
          menu.setAttribute('hidden', '');
        }
      });
    }

    function bindWorkspaceInteractions() {
      const windowRef = getWindow();
      const documentRef = getDocument();
      if (!windowRef || !documentRef) return;

      getElement('chat-messages')?.addEventListener('scroll', () => {
        setChatAutoFollow(isChatNearBottom(getElement('chat-messages')));
      });
      updateChatScrollButton();

      [
        ['music-prompt', 'music-char'],
        ['lyrics-prompt', 'lyrics-char'],
        ['cover-prompt', 'cover-char'],
        ['voice-prompt', 'voice-char'],
        ['speech-text', 'speech-char']
      ].forEach(([id, counterId]) => {
        const el = getElement(id);
        const counter = getElement(counterId);
        if (el && counter) {
          el.addEventListener('input', () => {
            counter.textContent = el.value.length;
            el.removeAttribute('aria-invalid');
            const error = getElement(`${id}-error`);
            if (error) {
              error.textContent = '';
              error.setAttribute('hidden', '');
            }
          });
        }
      });

      documentRef.querySelectorAll('.example-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const targetId = chip.dataset.target;
          const text = chip.dataset.text;
          const targetInput = getElement(targetId);
          const counterId = targetId === 'music-prompt' ? 'music-char'
            : targetId === 'lyrics-prompt' ? 'lyrics-char'
            : targetId === 'cover-prompt' ? 'cover-char'
            : targetId === 'voice-prompt' ? 'voice-char'
            : targetId === 'speech-text' ? 'speech-char'
            : null;

          if (targetInput) {
            targetInput.value = text;
            targetInput.focus();
            if (counterId) {
              const counter = getElement(counterId);
              if (counter) counter.textContent = text.length;
            }
            chip.style.transform = 'scale(0.95)';
            setTimeoutFn(() => {
              chip.style.transform = '';
            }, 150);
          }
        });
      });

      getElement('voice-audio-file')?.addEventListener('change', e => {
        const file = e.target.files?.[0];
        const fileName = getElement('voice-file-name');
        const sourceError = getElement('voice-source-error');
        getElement('voice-drop-zone')?.removeAttribute('aria-invalid');
        getElement('voice-audio-url')?.removeAttribute('aria-invalid');
        if (sourceError) {
          sourceError.textContent = '';
          sourceError.setAttribute('hidden', '');
        }
        if (fileName) fileName.textContent = file ? file.name : '';
      });

      getElement('transcription-file')?.addEventListener('change', e => {
        const file = e.target.files?.[0] || null;
        syncTranscriptionFilePreview(file);
        scheduleWorkspaceStateSave();
      });

      documentRef.querySelectorAll('.voice-source-tabs .source-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          applyVoiceSourceMode(tab.dataset.source);
          const sourceError = getElement('voice-source-error');
          getElement('voice-drop-zone')?.removeAttribute('aria-invalid');
          getElement('voice-audio-url')?.removeAttribute('aria-invalid');
          if (sourceError) {
            sourceError.textContent = '';
            sourceError.setAttribute('hidden', '');
          }
          scheduleWorkspaceStateSave();
        });
      });

      const dropZone = getElement('voice-drop-zone');
      if (dropZone) {
        dropZone.addEventListener('click', e => {
          if (e.target.tagName === 'LABEL' || e.target.closest('label')) return;
          getElement('voice-audio-file')?.click();
        });
        dropZone.addEventListener('dragover', e => {
          e.preventDefault();
          dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', e => {
          e.preventDefault();
          dropZone.classList.remove('drag-over');
          const file = e.dataTransfer?.files?.[0];
          if (file && file.type.startsWith('audio/')) {
            const dt = new DataTransfer();
            dt.items.add(file);
            getElement('voice-audio-file').files = dt.files;
            const fileName = getElement('voice-file-name');
            if (fileName) fileName.textContent = file.name;
            applyVoiceSourceMode('file');
          } else {
            showToast('请拖拽音频文件', 'error');
          }
        });
      }

      const transcriptionDropZone = getElement('transcription-drop-zone');
      if (transcriptionDropZone) {
        transcriptionDropZone.addEventListener('click', e => {
          if (e.target.tagName === 'LABEL' || e.target.closest('label')) return;
          getElement('transcription-file')?.click();
        });
        transcriptionDropZone.addEventListener('dragover', e => {
          e.preventDefault();
          transcriptionDropZone.classList.add('drag-over');
        });
        transcriptionDropZone.addEventListener('dragleave', () => transcriptionDropZone.classList.remove('drag-over'));
        transcriptionDropZone.addEventListener('drop', e => {
          e.preventDefault();
          transcriptionDropZone.classList.remove('drag-over');
          const file = e.dataTransfer?.files?.[0];
          if (!file) return;
          if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
            showToast('请拖拽音频或视频文件', 'error');
            return;
          }
          const dt = new DataTransfer();
          dt.items.add(file);
          getElement('transcription-file').files = dt.files;
          syncTranscriptionFilePreview(file);
          scheduleWorkspaceStateSave();
        });
      }

      getElement('btn-generate-music')?.addEventListener('click', generateMusic);
      getElement('btn-generate-lyrics')?.addEventListener('click', generateLyrics);
      getElement('btn-generate-cover')?.addEventListener('click', generateCover);
      getElement('btn-generate-voice')?.addEventListener('click', generateVoice);
      getElement('btn-start-transcription')?.addEventListener('click', startTranscriptionShell);

      getElement('btn-reset-music')?.addEventListener('click', () => resetTab('music'));
      getElement('btn-reset-lyrics')?.addEventListener('click', () => resetTab('lyrics'));
      getElement('btn-reset-cover')?.addEventListener('click', () => resetTab('cover'));
      getElement('btn-reset-voice')?.addEventListener('click', () => resetTab('covervoice'));
      getElement('btn-reset-transcription')?.addEventListener('click', () => resetTab('transcription'));

      getElement('btn-download-music')?.addEventListener('click', () => {
        const src = getElement('music-audio')?.src;
        if (src) downloadFile(src, 'ai-music.mp3');
      });
      getElement('btn-download-cover')?.addEventListener('click', () => {
        const src = getElement('cover-image')?.src;
        if (src) downloadFile(src, 'ai-cover.png');
      });
      getElement('btn-download-voice')?.addEventListener('click', () => {
        const src = getElement('voice-audio')?.src;
        if (src) downloadFile(src, 'ai-voice-cover.mp3');
      });
      getElement('btn-copy-transcription-placeholder')?.addEventListener('click', () => {
        const text = getElement('transcription-text')?.textContent || '';
        if (text) copyToClipboard(text);
      });

      getElement('btn-copy-lyrics')?.addEventListener('click', () => {
        const text = getCurrentResult().lyrics?.lyrics || getCurrentResult().lyrics?.content || '';
        copyToClipboard(text);
      });

      getElement('btn-use-lyrics')?.addEventListener('click', () => {
        const lyrics = getCurrentResult().lyrics?.lyrics || getCurrentResult().lyrics?.content || '';
        if (!lyrics) return;
        switchTab('music');
        const el = getElement('music-prompt');
        if (el) {
          el.value = lyrics;
          const counter = getElement('music-char');
          if (counter) counter.textContent = lyrics.length;
        }
        scheduleWorkspaceStateSave();
        showToast('歌词已导入到音乐生成', 'success');
      });

      getElement('modal-close')?.addEventListener('click', closeImageModal);
      getElement('image-modal')?.addEventListener('click', e => {
        if (e.target === getElement('image-modal')) closeImageModal();
      });
      documentRef.addEventListener('keydown', e => {
        trapImageModalFocus(e);
        if (e.key === 'Escape') closeImageModal();
      });

      setQuotaCollapsed(getReadQuotaCollapsedPreference());
      syncQuotaCardState();
      bindQuotaToggle();
      loadQuota();
      setIntervalFn(loadQuota, 30000);

      setChatArchivedCollapsed(getReadChatArchivedCollapsedPreference());
      syncChatArchivedSectionState();

      documentRef.addEventListener('keydown', e => {
        if (e.key !== 'Enter' || e.ctrlKey || e.shiftKey || e.altKey) return;
        const tag = documentRef.activeElement.tagName;
        if (tag === 'TEXTAREA' || tag === 'INPUT') return;
        const handlers = {
          music: generateMusic,
          lyrics: generateLyrics,
          cover: generateCover,
          covervoice: generateVoice,
          chat: sendChatMessage
        };
        handlers[getCurrentTab()]?.();
      });

      initSpeechTab();

      getElement('btn-chat-send')?.addEventListener('click', sendChatMessage);
      getElement('btn-chat-stop')?.addEventListener('click', stopChatGeneration);
      getElement('btn-chat-clear')?.addEventListener('click', () => {
        clearFeatureDraft('chat', { clearResult: false });
        getElement('chat-input')?.focus();
      });
      getElement('chat-input')?.addEventListener('input', updateChatComposerState);
      getElement('chat-input')?.addEventListener('focus', () => {
        queueChatViewportSync();
        ensureChatComposerVisible();
      });
      getElement('chat-input')?.addEventListener('blur', queueChatViewportSync);
      getElement('chat-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          sendChatMessage();
        }
      });
      getElement('chat-messages')?.addEventListener('scroll', handleChatMessagesScroll);
      windowRef.addEventListener('resize', queueChatViewportSync);
      windowRef.visualViewport?.addEventListener('resize', queueChatViewportSync);
      windowRef.visualViewport?.addEventListener('scroll', queueChatViewportSync);

      initializeChatModelDropdownLoadingState();
      initCustomDropdown('chat-model-dropdown', 'chat-model');
      loadChatModelOptions();
      convertAllSelectsToCustomDropdowns();

      getElement('chat-model')?.addEventListener('change', () => {
        schedulePreferenceSave({ defaultModelChat: getHiddenInputValue('chat-model', 'gpt-4.1-mini') });
      });
      updateChatComposerState();
      queueChatViewportSync();
      getElement('speech-voice')?.addEventListener('change', () => {
        schedulePreferenceSave({ defaultVoice: getHiddenInputValue('speech-voice', 'male-qn-qingse') });
      });
      getElement('music-style')?.addEventListener('change', () => {
        schedulePreferenceSave({ defaultMusicStyle: getHiddenInputValue('music-style', '') });
      });
      getElement('cover-ratio')?.addEventListener('change', () => {
        schedulePreferenceSave({ defaultCoverRatio: getHiddenInputValue('cover-ratio', '1:1') });
      });
    }

    function initMobileSidebar() {
      const windowRef = getWindow();
      const documentRef = getDocument();
      const toggle = getElement('sidebar-toggle');
      const sidebar = documentRef?.querySelector('.sidebar');
      const overlay = getElement('sidebar-overlay');
      if (!toggle || !sidebar || !windowRef) return;

      function openSidebar() {
        sidebar.classList.add('open');
        overlay?.classList.add('show');
        toggle.setAttribute('aria-expanded', 'true');
        documentRef.body.style.overflow = 'hidden';
      }

      function closeSidebar() {
        sidebar.classList.remove('open');
        overlay?.classList.remove('show');
        toggle.setAttribute('aria-expanded', 'false');
        documentRef.body.style.overflow = '';
      }

      toggle.addEventListener('click', () => {
        if (sidebar.classList.contains('open')) {
          closeSidebar();
        } else {
          openSidebar();
        }
      });
      overlay?.addEventListener('click', closeSidebar);
      queryAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
          if (windowRef.innerWidth <= 767) closeSidebar();
        });
      });
      windowRef.addEventListener('resize', () => {
        if (windowRef.innerWidth > 767) closeSidebar();
      });
    }

    return {
      bindWorkspaceInteractions,
      convertAllSelectsToCustomDropdowns,
      initCustomDropdownSm,
      initMobileSidebar
    };
  }

  return {
    createTools
  };
}));
