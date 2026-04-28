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
  let activeChatAbortController = null;
  let activeChatRequestContext = null;
  const transientConversationEntries = new Map();
  const chatMessageUiState = new Map();
  const chatScrollState = {
    autoFollow: true
  };
  const chatViewportState = {
    keyboardInset: 0,
    mobileCompose: false
  };

  // ---- DOM helpers ----
  const $ = id => document.getElementById(id);
  const $$ = (sel, ctx) => (ctx || document).querySelectorAll(sel);
  const appShell = window.AppShell || null;
  const chatModelUtils = window.AigsChatModelUtils || null;
  const apiClient = appShell && window.fetch && appShell.createApiClient
    ? appShell.createApiClient(window.fetch.bind(window))
    : null;
  const apiFetch = apiClient?.fetch ? apiClient.fetch.bind(apiClient) : window.fetch.bind(window);
  const persistence = appShell && window.fetch ? appShell.createRemotePersistence(window.fetch.bind(window)) : null;
  const resolveApiAssetUrl = appShell?.resolveApiAssetUrl || (value => value);
  const workspaceChatModelTools = window.AigsWorkspaceChatModelTools?.createTools
    ? window.AigsWorkspaceChatModelTools.createTools({
        getElement: $,
        getUserPreferences: () => userPreferences,
        safeParseJson,
        getLocalStorage: () => window.localStorage,
        escapeHtml,
        syncInputDropdown,
        updateDropdownScrollState,
        apiFetch,
        formatChatModelDropdownLabel: (label, modelId) => requireChatModelUtils().formatChatModelDropdownLabel(label, modelId),
        getChatModelGroupLabel: modelId => requireChatModelUtils().getChatModelGroupLabel(modelId),
        getChatModelSeriesLabel: modelId => requireChatModelUtils().getChatModelSeriesLabel(modelId),
        getChatModelSeriesClass: seriesLabel => requireChatModelUtils().getChatModelSeriesClass(seriesLabel),
        getChatModelTagClass: tag => requireChatModelUtils().getChatModelTagClass(tag)
      })
    : null;
  const filterConversationSummaries = appShell?.filterConversationSummaries || ((items, query) => {
    const collection = Array.isArray(items) ? items.slice() : [];
    const normalizedQuery = String(query || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!normalizedQuery) return collection;

    const terms = normalizedQuery.split(' ').filter(Boolean);
    return collection.filter(item => {
      const haystack = [
        item?.title || '',
        item?.model || '',
        item?.preview || ''
      ].join(' ').toLowerCase();
      return terms.every(term => haystack.includes(term));
    });
  });
  const conversationWorkflowTools = window.AigsConversationWorkflowTools?.createTools
    ? window.AigsConversationWorkflowTools.createTools({
        getCurrentUser: () => currentUser,
        getCurrentUserProfile: () => currentUserProfile,
        getChatWorkflowState: () => chatWorkflowState,
        setChatWorkflowState: value => {
          chatWorkflowState = value;
        },
        getOpenConversationActionId: () => openConversationActionId,
        setOpenConversationActionId: value => {
          openConversationActionId = value;
        },
        getConversationManageMode: () => conversationManageMode,
        setConversationManageModeState: value => {
          conversationManageMode = value;
        },
        getChatArchivedCollapsed: () => chatArchivedCollapsed,
        setChatArchivedCollapsedState: value => {
          chatArchivedCollapsed = value;
        },
        getElement: $,
        queryAll: selector => document.querySelectorAll(selector),
        safeParseJson: (value, fallback) => {
          if (!value) return fallback;
          try {
            return JSON.parse(value);
          } catch {
            return fallback;
          }
        },
        getLocalStorage: () => window.localStorage,
        workflowStorageKeyPrefix: 'aigs.chat.workflow',
        archivedCollapsedKey: 'aigs.chat.archived.collapsed',
        renderConversationList: () => renderConversationList(),
        renderConversationSidebarSummary: () => renderConversationSidebarSummary(),
        renderArchivedConversationList: () => renderArchivedConversationList()
      })
    : null;
  const chatMessageMetaTools = window.AigsChatMessageMetaTools?.createTools
    ? window.AigsChatMessageMetaTools.createTools({
        getChatMessageUiState,
        formatChatRelativeTime,
        escapeHtml
      })
    : null;
  const chatMessageNodeTools = window.AigsChatMessageNodeTools?.createTools
    ? window.AigsChatMessageNodeTools.createTools({
        getElement: $,
        queryOne: selector => document.querySelector(selector),
        createElement: tagName => document.createElement(tagName),
        escapeHtml,
        formatChatMessageHtml,
        buildChatMessageMeta,
        isAssistantMessageCompact,
        buildAssistantMessageCompactSummary,
        annotateChatMessageHeadings,
        getAssistantMessageStatus,
        isMessageExcerpted,
        getChatMessageUiState,
        isLongAssistantMessage,
        followChatToBottom
      })
    : null;
  const chatFailureTools = window.AigsChatFailureTools?.createTools
    ? window.AigsChatFailureTools.createTools({
        buildTransientMessageId
      })
    : null;
  const chatEntryTools = window.AigsChatEntryTools?.createTools
    ? window.AigsChatEntryTools.createTools({
        getElement: $,
        getConversationState: () => conversationState,
        getIsChatGenerating: () => isChatGenerating,
        setIsChatGenerating: value => {
          isChatGenerating = value;
        },
        getChatQueue: () => chatQueue,
        pushChatQueue: message => {
          chatQueue.push(message);
        },
        getConversationMessageById,
        clearConversationTransientEntries,
        restoreChatMessages,
        performChatSend,
        drainChatQueue,
        describeChatFailure,
        updateQueueIndicator,
        renderConversationMeta,
        renderArchivedConversationList,
        updateChatComposerState,
        scheduleWorkspaceStateSave,
        showToast
      })
    : null;
  const chatMessageActionTools = window.AigsChatMessageActionTools?.createTools
    ? window.AigsChatMessageActionTools.createTools({
        getConversationState: () => conversationState,
        apiFetch,
        applyConversationPayload,
        getConversationMessageById,
        getIsChatGenerating: () => isChatGenerating,
        setIsChatGenerating: value => {
          isChatGenerating = value;
        },
        setChatMessageUiState,
        renderConversationMeta,
        renderArchivedConversationList,
        performChatSend,
        describeChatFailure,
        updateQueueIndicator,
        writeClipboard: text => navigator.clipboard.writeText(text),
        showToast,
        setTimeoutFn: (callback, delay) => window.setTimeout(callback, delay)
      })
    : null;
  const chatComposerTools = window.AigsChatComposerTools?.createTools
    ? window.AigsChatComposerTools.createTools({
        getElement: $,
        queryOne: selector => document.querySelector(selector),
        escapeHtml,
        getCurrentUser: () => currentUser,
        getIsChatGenerating: () => isChatGenerating,
        getChatQueue: () => chatQueue,
        getConversationState: () => conversationState,
        getActiveConversation,
        getConversationTimestamp,
        formatChatRelativeTime,
        isConversationPinned,
        isConversationParked,
        queueChatViewportSync,
        scheduleWorkspaceStateSave,
        getStarterPrompts: () => CHAT_STARTER_PROMPTS,
        getQuickstartPrompts: () => CHAT_QUICKSTART_PROMPTS,
        getFollowUpPrompts: () => CHAT_FOLLOW_UP_PROMPTS
      })
    : null;
  const chatExcerptTools = window.AigsChatExcerptTools?.createTools
    ? window.AigsChatExcerptTools.createTools({
        getCurrentUser: () => currentUser,
        getCurrentUserProfile: () => currentUserProfile,
        getConversationState: () => conversationState,
        getChatExcerptState: () => chatExcerptState,
        setChatExcerptState: value => {
          chatExcerptState = value;
        },
        getCurrentTab: () => currentTab,
        getElement: $,
        queryAll: selector => document.querySelectorAll(selector),
        queryOne: selector => document.querySelector(selector),
        safeParseJson,
        getLocalStorage: () => window.localStorage,
        truncateText,
        getActiveConversation,
        getConversationTitlePreview,
        getConversationMessageById,
        restoreChatMessages,
        flashButtonFeedback,
        showToast,
        writeClipboard: text => navigator.clipboard.writeText(text),
        updateChatComposerState,
        scheduleWorkspaceStateSave,
        selectConversation,
        switchTab,
        setChatAutoFollow,
        formatChatRelativeTime,
        escapeHtml,
        excerptStorageKeyPrefix: 'aigs.chat.excerpts',
        getChatInputBuildText: content => WORKSPACE_ASSET_TARGETS.chat.buildText(content),
        setTimeoutFn: (callback, delay) => window.setTimeout(callback, delay)
      })
    : null;
  const chatStreamTools = window.AigsChatStreamTools?.createTools
    ? window.AigsChatStreamTools.createTools({
        addChatMessage,
        buildChatMessageMeta,
        followChatToBottom,
        formatChatMessageHtml,
        createTextDecoder: () => new TextDecoder()
      })
    : null;
  const chatSendTools = window.AigsChatSendTools?.createTools
    ? window.AigsChatSendTools.createTools({
        getElement: $,
        queryOne: selector => document.querySelector(selector),
        getChatQueue: () => chatQueue,
        shiftChatQueue: () => chatQueue.shift(),
        getChatHistory: () => chatHistory,
        getConversationState: () => conversationState,
        ensureActiveConversation,
        getConversationMessageById,
        clearConversationTransientEntries,
        restoreChatMessages,
        addChatMessage,
        createThinkingMessage,
        updateChatComposerState,
        setChatRequestStatus,
        apiFetch,
        streamChatMessage,
        loadQuota,
        refreshUsageToday,
        applyConversationPayload,
        setChatMessageUiState,
        createFailedChatEntries,
        setConversationTransientEntries,
        getModel: () => $('chat-model')?.value || 'gpt-4.1-mini',
        createAbortController: () => new AbortController(),
        getActiveChatAbortController: () => activeChatAbortController,
        setActiveChatAbortController: value => {
          activeChatAbortController = value;
        },
        getActiveChatRequestContext: () => activeChatRequestContext,
        setActiveChatRequestContext: value => {
          activeChatRequestContext = value;
        }
      })
    : null;
  const chatRenderRuntimeTools = window.AigsChatRenderRuntimeTools?.createTools
    ? window.AigsChatRenderRuntimeTools.createTools({
        getElement: $,
        queryOne: selector => document.querySelector(selector),
        getConversationState: () => conversationState,
        getConversationTransientEntries,
        getIsChatGenerating: () => isChatGenerating,
        getChatScrollState: () => chatScrollState,
        setChatScrollAutoFollow: value => {
          chatScrollState.autoFollow = Boolean(value);
        },
        getChatMessageUiStateStore: () => chatMessageUiState,
        setChatHistory: value => {
          chatHistory = Array.isArray(value) ? value.slice() : [];
        },
        renderChatReadingOutline: () => renderChatReadingOutline(),
        syncChatReadingOutlineActiveTarget: () => syncChatReadingOutlineActiveTarget(),
        addChatMessage,
        createChatStarterPanelMarkup,
        queueChatViewportSync,
        requestAnimationFrameFn: callback => window.requestAnimationFrame(callback),
        setTimeoutFn: (callback, delay) => window.setTimeout(callback, delay)
      })
    : null;
  const chatOutlineTools = window.AigsChatOutlineTools?.createTools
    ? window.AigsChatOutlineTools.createTools({
        getElement: $,
        queryAll: selector => document.querySelectorAll(selector),
        escapeHtml,
        buildTransientMessageId
      })
    : null;
  const workspaceConversationTools = window.AigsWorkspaceConversationTools?.createTools
    ? window.AigsWorkspaceConversationTools.createTools({
        getCurrentUser: () => currentUser,
        getPersistence: () => persistence,
        getConversationState: () => conversationState,
        getWorkspaceState: () => workspaceState,
        setArchivedConversationList,
        setConversationActiveId: value => {
          conversationState.activeId = value;
        },
        setConversationMessages: value => {
          conversationState.messages = Array.isArray(value) ? value.slice() : [];
        },
        setChatHistory: value => {
          chatHistory = Array.isArray(value) ? value.slice() : [];
        },
        restoreChatMessages,
        upsertConversationSummary,
        renderConversationList,
        renderChatExperienceState,
        renderChatContextStrip,
        renderChatExcerptShelf,
        renderChatSuggestionStrip,
        scheduleWorkspaceStateSave,
        getActiveConversation,
        getConversationTitlePreview,
        getConversationPreview,
        getActiveConversationLastActivityLabel,
        getChatModel: () => $('chat-model')?.value || 'gpt-4.1-mini',
        getIsChatGenerating: () => isChatGenerating,
        showToast,
        getElement: $
      })
    : null;
  const workspaceMediaTools = window.AigsWorkspaceMediaTools?.createTools
    ? window.AigsWorkspaceMediaTools.createTools({
        getElement: $,
        setCurrentResult: (feature, value) => {
          currentResult[feature] = value;
        }
      })
    : null;
  const workspaceStateTools = window.AigsWorkspaceStateTools?.createTools
    ? window.AigsWorkspaceStateTools.createTools({
        getCurrentUser: () => currentUser,
        getWorkspaceStateReady: () => workspaceStateReady,
        getPersistence: () => persistence,
        getWorkspaceState: () => workspaceState,
        getTemplatePreferenceEnvelope: () => templatePreferenceEnvelope,
        setTemplatePreferenceEnvelope: value => {
          templatePreferenceEnvelope = value;
        },
        getUserPreferences: () => userPreferences,
        setUserPreferences: value => {
          userPreferences = value;
        },
        getCurrentTab: () => currentTab,
        getConversationActiveId: () => conversationState.activeId,
        getElement: $,
        queryAll: selector => document.querySelectorAll(selector),
        getFeatureFields: () => FEATURE_FIELDS,
        getTrackedWorkspaceInputIds: () => TRACKED_WORKSPACE_INPUT_IDS,
        getFieldInitialValues: () => fieldInitialValues,
        getPreferenceBackedFieldDefaults: () => PREFERENCE_BACKED_FIELD_DEFAULTS,
        getResultArea,
        getCurrentResult: () => currentResult,
        getResetMaps: () => RESET_MAPS,
        getFeatureInputs,
        setFieldValue,
        updateWorkspaceStateFromPreferences,
        updateChatComposerState,
        syncTranscriptionFilePreview,
        isProtectedSessionError,
        showToast,
        clearTimeoutFn: value => clearTimeout(value),
        setTimeoutFn: (callback, delay) => window.setTimeout(callback, delay),
        getWorkspaceStateSaveTimer: () => workspaceStateSaveTimer,
        setWorkspaceStateSaveTimer: value => {
          workspaceStateSaveTimer = value;
        }
      })
    : null;
  const workspaceShellTools = window.AigsWorkspaceShellTools?.createTools
    ? window.AigsWorkspaceShellTools.createTools({
        getElement: $,
        getLocalStorage: () => window.localStorage,
        getDocumentElement: () => document.documentElement,
        getUserPreferences: () => userPreferences,
        schedulePreferenceSave: patch => schedulePreferenceSave(patch),
        loadQuota: () => loadQuota()
      })
    : null;
  const workspaceUiTools = window.AigsWorkspaceUiTools?.createTools
    ? window.AigsWorkspaceUiTools.createTools({
        getElement: $,
        getDocument: () => document,
        syncInputDropdown,
        updateDropdownScrollState,
        syncCustomDropdownValue,
        showToast
      })
    : null;
  const workspacePageInitTools = window.AigsWorkspacePageInitTools?.createTools
    ? window.AigsWorkspacePageInitTools.createTools({
        getElement: $,
        apiFetch,
        resolveApiAssetUrl,
        getCurrentResult: () => currentResult,
        recordFeatureHistory,
        showToast,
        showLoading,
        hideLoading,
        loadQuota,
        refreshUsageToday,
        getWindow: () => window,
        handleProtectedSessionLoss,
        handlePasswordResetRequired,
        ensureFeatureExtensions,
        renderTemplateLibraries,
        bindEnhancementEvents,
        initTabs,
        initTheme,
        captureInitialFieldValues,
        bootstrapAuth,
        bindWorkspaceInteractions: () => requireWorkspaceInitTools().bindWorkspaceInteractions(),
        setTimeoutFn: (callback, delay) => window.setTimeout(callback, delay)
      })
    : null;
  const workspaceAuthTools = window.AigsWorkspaceAuthTools?.createTools
    ? window.AigsWorkspaceAuthTools.createTools({
        getWindow: () => window,
        getCurrentUser: () => currentUser,
        setCurrentUser: value => {
          currentUser = value;
        },
        getCurrentUserProfile: () => currentUserProfile,
        setCurrentUserProfile: value => {
          currentUserProfile = value;
        },
        getPersistence: () => persistence,
        getUserPreferences: () => userPreferences,
        setUserPreferences: value => {
          userPreferences = value;
        },
        updateWorkspaceStateFromPreferences,
        applyUserPreferences,
        isProtectedSessionError,
        showToast,
        getCurrentUserProfileState: () => currentUserProfile,
        getCurrentUserNameState: () => currentUser,
        getPlanDisplayName,
        logout,
        resetAuthenticatedWorkspaceState,
        getAuthRecoveryLocked: () => authRecoveryLocked,
        setAuthRecoveryLocked: value => {
          authRecoveryLocked = value;
        },
        setTimeoutFn: (callback, delay) => window.setTimeout(callback, delay),
        loadTemplateLibraries,
        refreshUsageToday,
        loadConversations,
        loadAllHistories,
        hydrateChatWorkflowState,
        hydrateChatExcerptState,
        restoreWorkspaceDrafts,
        setWorkspaceStateReady: value => {
          workspaceStateReady = Boolean(value);
        },
        getElement: $,
        getCurrentAppPath
      })
    : null;
  const workspaceInitTools = window.AigsWorkspaceInitTools?.createTools
    ? window.AigsWorkspaceInitTools.createTools({
        getElement: $,
        queryAll: selector => document.querySelectorAll(selector),
        createElement: tagName => document.createElement(tagName),
        getDocument: () => document,
        getWindow: () => window,
        getCurrentResult: () => currentResult,
        getCurrentTab: () => currentTab,
        getResolveApiAssetUrl: () => resolveApiAssetUrl,
        getHiddenInputValue: (inputId, fallback = '') => $(inputId)?.value || fallback,
        setChatArchivedCollapsed: value => {
          chatArchivedCollapsed = value;
        },
        getReadChatArchivedCollapsedPreference: () => readChatArchivedCollapsedPreference(),
        syncChatArchivedSectionState,
        setQuotaCollapsed: value => setQuotaCollapsed(value),
        getReadQuotaCollapsedPreference: () => readQuotaCollapsedPreference(),
        syncQuotaCardState,
        bindQuotaToggle,
        loadQuota,
        initSpeechTab,
        scheduleWorkspaceStateSave,
        syncTranscriptionFilePreview,
        applyVoiceSourceMode,
        resetTab,
        generateMusic,
        generateLyrics,
        generateCover,
        generateVoice,
        startTranscriptionShell,
        downloadFile,
        copyToClipboard,
        switchTab,
        showToast,
        closeImageModal,
        sendChatMessage,
        stopChatGeneration,
        clearFeatureDraft,
        updateChatComposerState,
        queueChatViewportSync,
        ensureChatComposerVisible,
        handleChatMessagesScroll,
        initializeChatModelDropdownLoadingState,
        initCustomDropdown,
        loadChatModelOptions,
        schedulePreferenceSave,
        updateChatScrollButton,
        setChatAutoFollow,
        isChatNearBottom,
        setIntervalFn: (callback, delay) => setInterval(callback, delay),
        setTimeoutFn: (callback, delay) => setTimeout(callback, delay)
      })
    : null;
  let templates = appShell?.TEMPLATE_LIBRARY || {};
  const featureMeta = appShell?.FEATURE_META || {};
  const historyState = {};
  const templateSearchState = {};
  const conversationState = {
    list: [],
    archived: [],
    activeId: null,
    messages: []
  };
  let currentUser = null;
  let currentUserProfile = null;
  let conversationSearchQuery = '';
  let conversationFilterMode = 'all';
  let openConversationActionId = '';
  let conversationManageMode = false;
  let userPreferences = {
    theme: 'dark',
    defaultModelChat: 'gpt-4.1-mini',
    defaultVoice: 'male-qn-qingse',
    defaultMusicStyle: '',
    defaultCoverRatio: '1:1'
  };
  let usageToday = null;
  let preferenceSaveTimer = null;
  let workspaceStateSaveTimer = null;
  let authRecoveryLocked = false;
  let workspaceStateReady = false;
  let templatePreferenceEnvelope = {};
  let workspaceState = createDefaultWorkspaceState();
  const fieldInitialValues = {};
  const CHAT_ARCHIVED_COLLAPSED_KEY = 'aigs.chat.archived.collapsed';
  const CHAT_WORKFLOW_STATE_KEY_PREFIX = 'aigs.chat.workflow';
  const CHAT_EXCERPT_STATE_KEY_PREFIX = 'aigs.chat.excerpts';
  let chatArchivedCollapsed = false;
  let chatWorkflowState = createDefaultChatWorkflowState();
  let chatExcerptState = createDefaultChatExcerptState();

  const FEATURE_FIELDS = {
    lyrics: { prompt: 'lyrics-prompt', style: 'lyrics-style', structure: 'lyrics-structure' },
    cover: { prompt: 'cover-prompt', ratio: 'cover-ratio', style: 'cover-style' },
    speech: { text: 'speech-text', voice_id: 'speech-voice', emotion: 'speech-emotion', speed: 'speech-speed', pitch: 'speech-pitch', vol: 'speech-vol', output_format: 'speech-format' },
    transcription: {},
    music: { prompt: 'music-prompt', style: 'music-style', bpm: 'music-bpm', key: 'music-key', duration: 'music-duration' },
    covervoice: { prompt: 'voice-prompt', timbre: 'voice-timbre', pitch: 'voice-pitch', audio_url: 'voice-audio-url' }
  };

  const RESULT_IDS = {
    covervoice: 'covervoice-result',
    speech: 'speech-result',
    transcription: 'transcription-result'
  };

  const COUNTER_IDS = {
    'music-prompt': 'music-char',
    'lyrics-prompt': 'lyrics-char',
    'cover-prompt': 'cover-char',
    'voice-prompt': 'voice-char',
    'speech-text': 'speech-char'
  };
  const WORKSPACE_ASSET_TARGETS = {
    chat: {
      inputId: 'chat-input',
      actionLabel: '继续聊',
      toast: '已插入聊天输入框',
      buildText: content => `参考这段已摘录内容继续：\n${content}\n\n请基于这段内容继续展开。`
    },
    lyrics: {
      inputId: 'lyrics-prompt',
      actionLabel: '用于歌词',
      toast: '已导入到歌词灵感',
      buildText: content => `参考这段摘录，写成更完整的歌词：\n${content}`
    },
    music: {
      inputId: 'music-prompt',
      actionLabel: '用于音乐',
      toast: '已导入到音乐描述',
      buildText: content => `参考这段摘录，为我生成对应的音乐灵感与编曲描述：\n${content}`
    },
    cover: {
      inputId: 'cover-prompt',
      actionLabel: '用于封面',
      toast: '已导入到封面描述',
      buildText: content => `参考这段摘录，为我设计一张匹配气质的封面：\n${content}`
    },
    speech: {
      inputId: 'speech-text',
      actionLabel: '用于语音',
      toast: '已导入到语音文本',
      buildText: content => content
    },
    covervoice: {
      inputId: 'voice-prompt',
      actionLabel: '用于配音',
      toast: '已导入到配音描述',
      buildText: content => `参考这段摘录，帮我规划适合的翻唱或配音风格：\n${content}`
    }
  };

  const TRACKED_WORKSPACE_INPUT_IDS = new Set([
    'chat-input',
    'lyrics-prompt', 'lyrics-style', 'lyrics-structure',
    'cover-prompt', 'cover-ratio', 'cover-style',
    'speech-text', 'speech-voice', 'speech-emotion', 'speech-speed', 'speech-pitch', 'speech-vol', 'speech-format',
    'music-prompt', 'music-style', 'music-bpm', 'music-key', 'music-duration',
    'voice-prompt', 'voice-timbre', 'voice-pitch', 'voice-audio-url'
  ]);

  const PREFERENCE_BACKED_FIELD_DEFAULTS = {
    'chat-model': 'defaultModelChat',
    'speech-voice': 'defaultVoice',
    'music-style': 'defaultMusicStyle',
    'cover-ratio': 'defaultCoverRatio'
  };
  const CHAT_STARTER_PROMPTS = [
    {
      label: '规划今天的工作',
      description: '让 AI 帮你把今天最重要的 3 件事拆成可执行步骤。',
      prompt: '请按“现在就能开始”的标准，帮我把今天最重要的 3 件事拆成具体执行步骤，并指出第一步该做什么。'
    },
    {
      label: '整理思路',
      description: '适合脑子里有很多想法，但还没形成结构的时候。',
      prompt: '我脑子里有很多零散想法，请先帮我把问题结构化，再给我一个清晰的分析框架。'
    },
    {
      label: '润色内容',
      description: '把一段中文改得更专业、更自然，适合直接发布或发送。',
      prompt: '接下来我会发一段中文，请帮我在不改变核心意思的前提下改得更专业、更自然、更利于直接发出去。'
    },
    {
      label: '解决问题',
      description: '遇到 bug、卡点或选择困难时，先把问题讲清楚再逐步解决。',
      prompt: '我遇到了一个具体问题。请你先帮我确认问题边界、可能原因，再给我一个从快到稳的解决顺序。'
    }
  ];
  const CHAT_QUICKSTART_PROMPTS = CHAT_STARTER_PROMPTS.slice(0, 3);
  const CHAT_FOLLOW_UP_PROMPTS = [
    {
      label: '总结并给下一步',
      prompt: '请先总结我们刚才的重点，再告诉我下一步最该做什么。'
    },
    {
      label: '整理成 TODO',
      prompt: '请把上面的内容整理成可以直接执行的 TODO 清单，按优先级排序。'
    },
    {
      label: '补齐风险遗漏',
      prompt: '请从风险、边界条件和容易遗漏的细节角度，再检查一遍上面的内容。'
    },
    {
      label: '改成更具体方案',
      prompt: '请把上面的建议改成更具体、更可落地的执行方案，尽量减少模糊表述。'
    }
  ];

  function requireChatModelUtils() {
    if (!chatModelUtils) {
      throw new Error('AigsChatModelUtils 未加载');
    }
    return chatModelUtils;
  }

  function requireWorkspaceChatModelTools() {
    if (!workspaceChatModelTools) {
      throw new Error('AigsWorkspaceChatModelTools 未加载');
    }
    return workspaceChatModelTools;
  }

  function requireConversationWorkflowTools() {
    if (!conversationWorkflowTools) {
      throw new Error('AigsConversationWorkflowTools 未加载');
    }
    return conversationWorkflowTools;
  }

  function requireChatRenderRuntimeTools() {
    if (!chatRenderRuntimeTools) {
      throw new Error('AigsChatRenderRuntimeTools 未加载');
    }
    return chatRenderRuntimeTools;
  }

  function requireChatMessageMetaTools() {
    if (!chatMessageMetaTools) {
      throw new Error('AigsChatMessageMetaTools 未加载');
    }
    return chatMessageMetaTools;
  }

  function requireChatMessageNodeTools() {
    if (!chatMessageNodeTools) {
      throw new Error('AigsChatMessageNodeTools 未加载');
    }
    return chatMessageNodeTools;
  }

  function requireChatFailureTools() {
    if (!chatFailureTools) {
      throw new Error('AigsChatFailureTools 未加载');
    }
    return chatFailureTools;
  }

  function requireChatEntryTools() {
    if (!chatEntryTools) {
      throw new Error('AigsChatEntryTools 未加载');
    }
    return chatEntryTools;
  }

  function requireChatMessageActionTools() {
    if (!chatMessageActionTools) {
      throw new Error('AigsChatMessageActionTools 未加载');
    }
    return chatMessageActionTools;
  }

  function requireChatComposerTools() {
    if (!chatComposerTools) {
      throw new Error('AigsChatComposerTools 未加载');
    }
    return chatComposerTools;
  }

  function requireChatExcerptTools() {
    if (!chatExcerptTools) {
      throw new Error('AigsChatExcerptTools 未加载');
    }
    return chatExcerptTools;
  }

  function requireChatStreamTools() {
    if (!chatStreamTools) {
      throw new Error('AigsChatStreamTools 未加载');
    }
    return chatStreamTools;
  }

  function requireChatSendTools() {
    if (!chatSendTools) {
      throw new Error('AigsChatSendTools 未加载');
    }
    return chatSendTools;
  }

  function requireChatOutlineTools() {
    if (!chatOutlineTools) {
      throw new Error('AigsChatOutlineTools 未加载');
    }
    return chatOutlineTools;
  }

  function safeParseJson(value, fallback) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function createDefaultWorkspaceState() {
    return {
      lastTab: 'chat',
      lastConversationId: null,
      drafts: {},
      lastSavedAt: null,
      recentTemplates: {}
    };
  }

  function normalizeWorkspaceState(rawState) {
    const raw = rawState && typeof rawState === 'object' ? rawState : {};
    const nextLastTab = (raw.lastTab && (featureMeta[raw.lastTab] || raw.lastTab === 'chat'))
      ? raw.lastTab
      : 'chat';
    return {
      ...createDefaultWorkspaceState(),
      ...raw,
      lastTab: nextLastTab,
      lastConversationId: raw.lastConversationId ? String(raw.lastConversationId) : null,
      drafts: raw.drafts && typeof raw.drafts === 'object' ? raw.drafts : {},
      lastSavedAt: raw.lastSavedAt ? Number(raw.lastSavedAt) : null,
      recentTemplates: raw.recentTemplates && typeof raw.recentTemplates === 'object' ? raw.recentTemplates : {}
    };
  }

  function updateWorkspaceStateFromPreferences(preferences = userPreferences) {
    templatePreferenceEnvelope = safeParseJson(preferences?.templatePreferencesJson, {}) || {};
    workspaceState = normalizeWorkspaceState(templatePreferenceEnvelope.workspace);
  }

  function createDefaultChatWorkflowState() {
    return requireConversationWorkflowTools().createDefaultChatWorkflowState();
  }

  function normalizeChatWorkflowState(rawState) {
    return requireConversationWorkflowTools().normalizeChatWorkflowState(rawState);
  }

  function getChatWorkflowStorageKey() {
    return requireConversationWorkflowTools().getChatWorkflowStorageKey();
  }

  function readChatWorkflowStatePreference() {
    return requireConversationWorkflowTools().readChatWorkflowStatePreference();
  }

  function persistChatWorkflowState() {
    return requireConversationWorkflowTools().persistChatWorkflowState();
  }

  function hydrateChatWorkflowState() {
    return requireConversationWorkflowTools().hydrateChatWorkflowState();
  }

  function isConversationPinned(conversationId) {
    return requireConversationWorkflowTools().isConversationPinned(conversationId);
  }

  function isConversationParked(conversationId) {
    return requireConversationWorkflowTools().isConversationParked(conversationId);
  }

  function removeConversationFromWorkflowState(conversationId, options = {}) {
    return requireConversationWorkflowTools().removeConversationFromWorkflowState(conversationId, options);
  }

  function toggleConversationWorkflowState(conversationId, mode) {
    return requireConversationWorkflowTools().toggleConversationWorkflowState(conversationId, mode);
  }

  function closeConversationActionMenu(options = {}) {
    return requireConversationWorkflowTools().closeConversationActionMenu(options);
  }

  function toggleConversationActionMenu(conversationId) {
    return requireConversationWorkflowTools().toggleConversationActionMenu(conversationId);
  }

  function setConversationManageMode(nextMode, options = {}) {
    return requireConversationWorkflowTools().setConversationManageMode(nextMode, options);
  }

  function toggleConversationManageMode() {
    return requireConversationWorkflowTools().toggleConversationManageMode();
  }

  function createDefaultChatExcerptState() {
    return requireChatExcerptTools().createDefaultChatExcerptState();
  }

  function normalizeChatExcerptState(rawState) {
    return requireChatExcerptTools().normalizeChatExcerptState(rawState);
  }

  function getChatExcerptStorageKey() {
    return requireChatExcerptTools().getChatExcerptStorageKey();
  }

  function readChatExcerptStatePreference() {
    return requireChatExcerptTools().readChatExcerptStatePreference();
  }

  function persistChatExcerptState() {
    return requireChatExcerptTools().persistChatExcerptState();
  }

  function hydrateChatExcerptState() {
    return requireChatExcerptTools().hydrateChatExcerptState();
  }

  function isMessageExcerpted(messageId) {
    return requireChatExcerptTools().isMessageExcerpted(messageId);
  }

  function buildChatExcerptPreview(text) {
    return requireChatExcerptTools().buildChatExcerptPreview(text);
  }

  function getRecentChatAssets(limit = 3) {
    return requireChatExcerptTools().getRecentChatAssets(limit);
  }

  function stripChatMarkupForPreview(text) {
    return requireChatExcerptTools().stripChatMarkupForPreview(text);
  }

  function isLongAssistantMessage(message) {
    const content = String(message?.content || '').trim();
    if (!content) return false;
    const headingCount = (content.match(/^#{1,3}\s+/gm) || []).length;
    const paragraphCount = content.split(/\n\s*\n/).filter(Boolean).length;
    return content.length >= 520 || headingCount >= 2 || paragraphCount >= 5;
  }

  function buildAssistantMessageCompactSummary(message) {
    const content = String(message?.content || '').trim();
    if (!content) return null;
    const headings = (content.match(/^#{1,3}\s+(.+)$/gm) || [])
      .map(line => line.replace(/^#{1,3}\s+/, '').trim())
      .filter(Boolean)
      .slice(0, 3);
    const plain = stripChatMarkupForPreview(content);
    const preview = truncateText(plain, headings.length ? 96 : 132);
    return {
      preview,
      headings
    };
  }

  function isAssistantMessageCompact(message) {
    if (!message?.id || !isLongAssistantMessage(message)) return false;
    const uiState = getChatMessageUiState(message.id) || {};
    return uiState.compactExpanded === false;
  }

  function getChatExcerptByMessageId(messageId) {
    return requireChatExcerptTools().getChatExcerptByMessageId(messageId);
  }

  function isChatExcerptArchived(messageId) {
    return requireChatExcerptTools().isChatExcerptArchived(messageId);
  }

  function updateChatExcerptState(patch = {}, options = {}) {
    return requireChatExcerptTools().updateChatExcerptState(patch, options);
  }

  function setChatExcerptExpanded(nextExpanded) {
    return requireChatExcerptTools().setChatExcerptExpanded(nextExpanded);
  }

  function setChatExcerptFilterMode(nextFilter) {
    return requireChatExcerptTools().setChatExcerptFilterMode(nextFilter);
  }

  function setChatExcerptQuery(nextQuery, options = {}) {
    return requireChatExcerptTools().setChatExcerptQuery(nextQuery, options);
  }

  function removeChatExcerpt(messageId, options = {}) {
    return requireChatExcerptTools().removeChatExcerpt(messageId, options);
  }

  function setChatExcerptArchived(messageId, nextArchived = true, options = {}) {
    return requireChatExcerptTools().setChatExcerptArchived(messageId, nextArchived, options);
  }

  function archiveVisibleChatExcerpts() {
    return requireChatExcerptTools().archiveVisibleChatExcerpts();
  }

  function clearArchivedChatExcerpts() {
    return requireChatExcerptTools().clearArchivedChatExcerpts();
  }

  function saveChatExcerpt(message) {
    return requireChatExcerptTools().saveChatExcerpt(message);
  }

  async function toggleChatExcerpt(messageId, triggerButton = null) {
    return requireChatExcerptTools().toggleChatExcerpt(messageId, triggerButton);
  }

  function getWorkspaceStateDraft(feature) {
    return requireWorkspaceStateTools().getWorkspaceStateDraft(feature);
  }

  function captureInitialFieldValues() {
    return requireWorkspaceStateTools().captureInitialFieldValues();
  }

  function getFieldDefaultValue(inputId) {
    return requireWorkspaceStateTools().getFieldDefaultValue(inputId);
  }

  function getVoiceSourceMode() {
    return requireWorkspaceStateTools().getVoiceSourceMode();
  }

  function applyVoiceSourceMode(sourceMode) {
    return requireWorkspaceStateTools().applyVoiceSourceMode(sourceMode);
  }

  function hasMeaningfulDraftValue(feature, key, value) {
    if (key === 'sourceMode') return false;
    const normalizedValue = String(value ?? '');
    if (!normalizedValue) return false;
    if (feature === 'chat' && key === 'message') return Boolean(normalizedValue.trim());

    const inputId = FEATURE_FIELDS[feature]?.[key];
    const input = inputId ? $(inputId) : null;
    if (!input) return Boolean(normalizedValue.trim());

    if (input.tagName === 'TEXTAREA' || input.type === 'text' || input.type === 'url') {
      return Boolean(normalizedValue.trim());
    }

    return normalizedValue !== String(getFieldDefaultValue(inputId));
  }

  function hasMeaningfulFeatureDraft(feature, draft) {
    if (!draft || typeof draft !== 'object') return false;
    return Object.entries(draft).some(([key, value]) => hasMeaningfulDraftValue(feature, key, value));
  }

  function buildWorkspaceDraftSnapshot() {
    return requireWorkspaceStateTools().buildWorkspaceDraftSnapshot();
  }

  function formatRelativeSavedAt(timestamp) {
    if (!timestamp) return '尚未自动保存';
    return `最后自动保存：${formatTime(timestamp)}`;
  }

  function formatChatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const dayLabel = getDayBucketLabel(timestamp);
    const timeLabel = formatTimeOfDay(timestamp) || formatTime(timestamp);
    if (!timeLabel) return '';
    if (dayLabel === '更早') {
      return formatTime(timestamp);
    }
    return `${dayLabel} ${timeLabel}`;
  }

  function countMeaningfulDraftItems(feature, draft) {
    if (!draft || typeof draft !== 'object') return 0;
    return Object.entries(draft).filter(([key, value]) => hasMeaningfulDraftValue(feature, key, value)).length;
  }

  async function persistWorkspaceState() {
    return requireWorkspaceStateTools().persistWorkspaceState();
  }

  function scheduleWorkspaceStateSave() {
    return requireWorkspaceStateTools().scheduleWorkspaceStateSave();
  }

  function autoResizeChatInput() {
    return requireChatComposerTools().autoResizeChatInput();
  }

  function updateChatComposerState() {
    return requireChatComposerTools().updateChatComposerState();
  }

  function getChatDraftLength() {
    return requireChatComposerTools().getChatDraftLength();
  }

  function getConversationMessageCount(conversation = getActiveConversation()) {
    return requireChatComposerTools().getConversationMessageCount(conversation);
  }

  function getAssistantMessageCount(messages = conversationState.messages) {
    return requireChatComposerTools().getAssistantMessageCount(messages);
  }

  function getChatExperienceStage() {
    return requireChatComposerTools().getChatExperienceStage();
  }

  function renderChatExperienceState() {
    return requireChatComposerTools().renderChatExperienceState();
  }

  function getActiveConversationLastActivityLabel(conversation) {
    return requireChatComposerTools().getActiveConversationLastActivityLabel(conversation);
  }

  function getChatContextPills(conversation = getActiveConversation()) {
    return requireChatComposerTools().getChatContextPills(conversation);
  }

  function renderChatContextStrip() {
    return requireChatComposerTools().renderChatContextStrip();
  }

  function getChatQuickstartPrompts() {
    return requireChatComposerTools().getChatQuickstartPrompts();
  }

  function getChatFollowUpPrompts() {
    return requireChatComposerTools().getChatFollowUpPrompts();
  }

  function getChatSuggestionConfig() {
    return requireChatComposerTools().getChatSuggestionConfig();
  }

  function renderChatSuggestionStrip() {
    return requireChatComposerTools().renderChatSuggestionStrip();
  }

  function createChatStarterPanelMarkup() {
    return requireChatComposerTools().createChatStarterPanelMarkup();
  }

  function applyChatStarterPrompt(promptText) {
    return requireChatComposerTools().applyChatStarterPrompt(promptText);
  }

  function restoreWorkspaceDrafts() {
    const chatDraft = getWorkspaceStateDraft('chat');
    if (chatDraft?.message != null && $('chat-input')) {
      $('chat-input').value = String(chatDraft.message || '');
    }

    Object.keys(FEATURE_FIELDS).forEach(feature => {
      const draft = getWorkspaceStateDraft(feature);
      if (!draft) return;
      applyFeatureInputs(feature, draft);
      if (feature === 'covervoice') {
        applyVoiceSourceMode(draft.sourceMode || 'file');
      }
    });

    switchTab(workspaceState.lastTab || 'chat');
        updateChatComposerState();
  }

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

  function syncInputDropdown(inputId) {
    const input = $(inputId);
    if (!input) return;
    const dropdown = $(`${inputId}-dropdown`);
    if (!dropdown) return;
    const valueSpan = dropdown.querySelector('.dropdown-value');
    const options = dropdown.querySelectorAll('.dropdown-option');
    const selected = Array.from(options).find(option => option.dataset.value === input.value) || options[0];
    if (valueSpan && selected) valueSpan.textContent = selected.dataset.label || selected.textContent;
    options.forEach(option => option.classList.toggle('active', option.dataset.value === input.value));
  }

  function updateDropdownScrollState(menu) {
    if (!menu) return;
    const hasOverflow = menu.scrollHeight - menu.clientHeight > 8;
    const isNearBottom = menu.scrollTop + menu.clientHeight >= menu.scrollHeight - 8;
    menu.dataset.scrollable = hasOverflow ? 'true' : 'false';
    menu.dataset.scrollHint = hasOverflow && !isNearBottom ? 'true' : 'false';
  }

  function syncCustomDropdownValue(dropdown, hiddenInput, option) {
    if (!dropdown || !option) return;
    const valueSpan = dropdown.querySelector('.dropdown-value');
    const nextValue = String(option.dataset.value || '').trim();
    const nextLabel = String(option.dataset.label || option.textContent || '').trim();
    const options = dropdown.querySelectorAll('.dropdown-option');

    if (hiddenInput && nextValue) {
      hiddenInput.value = nextValue;
      hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (valueSpan && nextLabel) valueSpan.textContent = nextLabel;
    options.forEach(item => item.classList.toggle('active', item.dataset.value === nextValue));
  }

  function initializeChatModelDropdownLoadingState() {
    return requireWorkspaceChatModelTools().initializeChatModelDropdownLoadingState();
  }

  function applyChatModelOptions(models = [], options = {}) {
    return requireWorkspaceChatModelTools().applyChatModelOptions(models, options);
  }

  async function loadChatModelOptions() {
    return requireWorkspaceChatModelTools().loadChatModelOptions();
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
    syncInputDropdown(inputId);
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

  function formatTimeOfDay(timestamp) {
    if (!timestamp) return '';
    try {
      return new Date(timestamp).toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  }

  function getDayBucketLabel(timestamp) {
    if (!timestamp) return '更早';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(timestamp);
    if (Number.isNaN(target.getTime())) return '更早';
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
    if (diffDays <= 0) return '今天';
    if (diffDays === 1) return '昨天';
    return '更早';
  }

  function formatMonthDay(timestamp) {
    if (!timestamp) return '';
    try {
      return new Date(timestamp).toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return '';
    }
  }

  function formatUsageSummary(usage) {
    if (!usage) return '今日用量待加载';
    return `今日日志 Chat ${usage.chatCount || 0} / Lyrics ${usage.lyricsCount || 0} / Music ${usage.musicCount || 0} / Image ${usage.imageCount || 0} / Speech ${usage.speechCount || 0} / Cover ${usage.coverCount || 0}`;
  }

  function getPublicAuthIntentFromUrl() {
    return requireWorkspaceAuthTools().getPublicAuthIntentFromUrl();
  }

  function getCurrentAppPath() {
    const pathname = window.location.pathname || '/';
    const search = window.location.search || '';
    return `${pathname}${search}` || '/';
  }

  function buildAuthPagePath(nextPath = '/') {
    return requireWorkspaceAuthTools().buildAuthPagePath(nextPath);
  }

  function buildAccountPagePath(params = {}) {
    return requireWorkspaceAuthTools().buildAccountPagePath(params);
  }

  function applyUserPreferences() {
    setTheme(userPreferences.theme || 'dark');
    setFieldValue('chat-model', userPreferences.defaultModelChat || 'gpt-4.1-mini');
    setFieldValue('speech-voice', userPreferences.defaultVoice || 'male-qn-qingse');
    setFieldValue('music-style', userPreferences.defaultMusicStyle || '');
    setFieldValue('cover-ratio', userPreferences.defaultCoverRatio || '1:1');
  }

  async function loadUserPreferences() {
    return requireWorkspaceAuthTools().loadUserPreferences();
  }

  function schedulePreferenceSave(patch) {
    if (!currentUser || !persistence?.savePreferences) return;
    userPreferences = {
      ...userPreferences,
      ...patch
    };
    clearTimeout(preferenceSaveTimer);
    preferenceSaveTimer = setTimeout(async () => {
      try {
        userPreferences = await persistence.savePreferences(userPreferences);
        updateWorkspaceStateFromPreferences(userPreferences);
        renderUserPanel();
              } catch (error) {
        if (isProtectedSessionError(error)) return;
        showToast('偏好保存失败', 'error', 1800);
      }
    }, 300);
  }

  async function refreshUsageToday() {
    if (!currentUser || !persistence?.getUsageToday) return;
    try {
      usageToday = await persistence.getUsageToday();
      renderUserPanel();
    } catch (error) {
      if (isProtectedSessionError(error)) return;
      usageToday = null;
      renderUserPanel();
    }
  }

  async function loadTemplateLibraries() {
    return requireWorkspaceTemplateTools().loadTemplateLibraries();
  }

  function getPlanDisplayName(planCode) {
    if (planCode === 'internal') return '内部';
    if (planCode === 'pro') return 'Pro';
    if (planCode === 'free') return 'Free';
    return planCode || '未设置';
  }

  function renderUserPanel() {
    return requireWorkspaceAuthTools().renderUserPanel();
  }

  function resetAuthenticatedWorkspaceState() {
    currentUser = null;
    currentUserProfile = null;
    workspaceStateReady = false;
    workspaceState = createDefaultWorkspaceState();
    chatWorkflowState = createDefaultChatWorkflowState();
    chatExcerptState = createDefaultChatExcerptState();
    templatePreferenceEnvelope = {};
    conversationState.list = [];
    conversationState.archived = [];
    conversationState.activeId = null;
    conversationState.messages = [];
    conversationSearchQuery = '';
    if ($('chat-conversation-search')) $('chat-conversation-search').value = '';
    currentResult = {};
    clearTimeout(preferenceSaveTimer);
    preferenceSaveTimer = null;
    clearTimeout(workspaceStateSaveTimer);
    workspaceStateSaveTimer = null;
    historyState.chat = [];
    Object.keys(featureMeta).forEach(feature => { historyState[feature] = []; renderHistory(feature); });
    templates = appShell?.TEMPLATE_LIBRARY || {};
    usageToday = null;
    restoreChatMessages([]);
    renderUserPanel();
    renderConversationList();
    renderTemplateLibraries();
      }

  function handleProtectedSessionLoss(message = '登录状态已失效，请重新登录') {
    return requireWorkspaceAuthTools().handleProtectedSessionLoss(message);
  }

  function isProtectedSessionError(error) {
    const status = Number(error?.status || 0);
    return status === 401 || (status === 403 && error?.reason === 'password_reset_required');
  }

  function handlePasswordResetRequired(detail = {}) {
    return requireWorkspaceAuthTools().handlePasswordResetRequired(detail);
  }

  async function loadAuthenticatedWorkspaceData() {
    return requireWorkspaceAuthTools().loadAuthenticatedWorkspaceData();
      }

  async function completeAuthenticatedBootstrap({ showWelcomeToast = false } = {}) {
    return requireWorkspaceAuthTools().completeAuthenticatedBootstrap({ showWelcomeToast });
  }

  async function logout() {
    try {
      await persistence?.logout();
      const remainingSession = await persistence?.loadSession?.().catch(() => null);
      if (remainingSession?.username) {
        throw new Error('退出未完成，请稍后重试');
      }
    } catch (error) {
      showToast(error?.message || '退出失败，请稍后重试', 'error', 2400);
      renderUserPanel();
      return;
    }
    resetAuthenticatedWorkspaceState();
    window.location.replace(buildAuthPagePath('/'));
  }

  async function bootstrapAuth() {
    return requireWorkspaceAuthTools().bootstrapAuth();
  }

  function ensureFeatureExtensions() {
    Object.keys(featureMeta).forEach(feature => {
      if (feature === 'chat') return;
      const section = $(`tab-${feature}`);
      if (!section || section.querySelector(`[data-feature-shell="${feature}"]`)) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'feature-extensions';
      wrapper.dataset.featureShell = feature;
      wrapper.innerHTML = `
        <section class="feature-card">
          <div class="feature-card-head">
            <div>
              <h3>${featureMeta[feature].title}模板库</h3>
              <p>按场景套用模板，也可以把当前输入直接保存成你自己的模板。</p>
            </div>
            <div class="template-library-toolbar">
              <div class="template-library-stat" id="template-stat-${feature}">正在整理模板库...</div>
              <label class="template-search-shell" for="template-search-${feature}">
                <input id="template-search-${feature}" class="template-search-input" type="search" placeholder="搜索模板 / 场景 / 提示词" aria-label="搜索${featureMeta[feature].title}模板">
              </label>
            </div>
          </div>
          <div class="template-creator">
            <input id="template-label-${feature}" type="text" maxlength="24" placeholder="模板名称" />
            <input id="template-desc-${feature}" type="text" maxlength="60" placeholder="一句话描述（可选）" />
            <button type="button" class="template-save-btn" data-template-save="${feature}">保存当前内容</button>
          </div>
          <div class="template-groups" id="template-groups-${feature}"></div>
        </section>
        <aside class="feature-card">
          <h3>${featureMeta[feature].historyTitle}</h3>
          <p>自动保存当前账号下的最近记录，后续可以继续恢复或复用。</p>
          <div class="history-list" id="history-list-${feature}"></div>
          <div class="history-empty" id="history-empty-${feature}">还没有历史记录，先跑一次生成或对话。</div>
        </aside>
      `;
      section.appendChild(wrapper);
      $(`template-search-${feature}`)?.addEventListener('input', event => {
        templateSearchState[feature] = String(event.target?.value || '').trim();
        renderTemplateLibraries();
      });
    });
  }

  const templateTools = window.AigsTemplateTools?.createTools
    ? window.AigsTemplateTools.createTools({
        getTemplates: () => templates,
        getWorkspaceState: () => workspaceState,
        getTemplateSearchState: () => templateSearchState,
        getCurrentUser: () => currentUser,
        getFeatureMeta: () => featureMeta,
        getFeatureInputs,
        scheduleWorkspaceStateSave,
        renderTemplateLibraries: () => renderTemplateLibraries(),
        truncateText,
        escapeHtml,
        getElement: $
      })
    : null;
  const workspaceTemplateTools = window.AigsWorkspaceTemplateTools?.createTools
    ? window.AigsWorkspaceTemplateTools.createTools({
        getCurrentUser: () => currentUser,
        getPersistence: () => persistence,
        getTemplates: () => templates,
        setTemplates: value => {
          templates = value || {};
        },
        getAppShellTemplateLibrary: () => appShell?.TEMPLATE_LIBRARY || {},
        getFeatureMeta: () => featureMeta,
        getHistoryState: () => historyState,
        setHistoryEntries: (feature, items) => {
          historyState[feature] = Array.isArray(items) ? items.slice() : [];
        },
        getAppShellMaxHistoryItems: () => appShell?.MAX_HISTORY_ITEMS || 12,
        getTemplateDraft,
        renderTemplateLibraries: () => renderTemplateLibraries(),
        renderHistory: feature => renderHistory(feature),
        showToast,
        isProtectedSessionError,
        getElement: $,
        setFieldValue,
        applyFeatureInputs,
        applyVoiceSourceMode,
        renderFeatureResult,
        scheduleWorkspaceStateSave,
        getWorkspaceState: () => workspaceState,
        setCurrentTab: value => {
          currentTab = value;
        },
        getCurrentTab: () => currentTab,
        queryAll: selector => document.querySelectorAll(selector),
        queryOne: selector => document.querySelector(selector),
        sendChatMessage,
        recordRecentTemplateUse,
        formatTime,
        truncateText,
        escapeHtml
      })
    : null;
  const workspaceGenerationTools = window.AigsWorkspaceGenerationTools?.createTools
    ? window.AigsWorkspaceGenerationTools.createTools({
        getElement: $,
        apiFetch,
        showToast,
        showLoading,
        hideLoading,
        startInlineProgress,
        stopInlineProgress,
        resolveApiAssetUrl,
        loadQuota,
        refreshUsageToday,
        recordFeatureHistory,
        setCurrentResult: (feature, value) => {
          currentResult[feature] = value;
        },
        renderFeatureResult,
        escapeHtml,
        applyVoiceSourceMode,
        fileToBase64,
        openImageModal
      })
    : null;
  const conversationListTools = window.AigsConversationListTools?.createTools
    ? window.AigsConversationListTools.createTools({
        getConversationState: () => conversationState,
        getCurrentUser: () => currentUser,
        getConversationSearchQueryState: () => conversationSearchQuery,
        setConversationSearchQueryState: value => {
          conversationSearchQuery = value;
        },
        getConversationFilterModeState: () => conversationFilterMode,
        setConversationFilterModeState: value => {
          conversationFilterMode = value;
        },
        getConversationManageMode: () => conversationManageMode,
        getIsChatGenerating: () => isChatGenerating,
        getChatArchivedCollapsed: () => chatArchivedCollapsed,
        getElement: $,
        queryOne: selector => document.querySelector(selector),
        queryAll: selector => document.querySelectorAll(selector),
        escapeHtml,
        truncateText,
        isConversationPinned,
        isConversationParked,
        filterConversationSummaries,
        getDayBucketLabel,
        formatTimeOfDay,
        formatMonthDay,
        renderConversationMeta: () => renderConversationMeta(),
        renderConversationSidebarSummary: () => renderConversationSidebarSummary(),
        renderConversationSearchFeedback: () => renderConversationSearchFeedback(),
        renderArchivedConversationList: () => renderArchivedConversationList(),
        syncChatArchivedSectionState
      })
    : null;
  const conversationActionTools = window.AigsConversationActionTools?.createTools
    ? window.AigsConversationActionTools.createTools({
        getCurrentUser: () => currentUser,
        getPersistence: () => persistence,
        getIsChatGenerating: () => isChatGenerating,
        getConversationState: () => conversationState,
        getWorkspaceState: () => workspaceState,
        setConversationActiveState: value => {
          conversationState.activeId = value;
        },
        setConversationMessages: value => {
          conversationState.messages = Array.isArray(value) ? value.slice() : [];
        },
        setConversationList,
        setArchivedConversationList,
        getChatHistory: () => chatHistory,
        setChatHistory: value => {
          chatHistory = Array.isArray(value) ? value.slice() : [];
        },
        applyConversationPayload,
        showToast,
        getActiveConversation,
        getConversationTitlePreview,
        upsertConversationSummary,
        renderConversationList,
        removeConversationFromWorkflowState,
        restoreChatMessages,
        createConversationAndSelect,
        scheduleWorkspaceStateSave,
        isProtectedSessionError,
        promptFn: (message, defaultValue) => (typeof window !== 'undefined' && typeof window.prompt === 'function'
          ? window.prompt(message, defaultValue)
          : null),
        confirmFn: message => (typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(message)
          : true)
      })
    : null;

  function requireTemplateTools() {
    if (!templateTools) {
      throw new Error('AigsTemplateTools 未加载');
    }
    return templateTools;
  }

  function requireWorkspaceTemplateTools() {
    if (!workspaceTemplateTools) {
      throw new Error('AigsWorkspaceTemplateTools 未加载');
    }
    return workspaceTemplateTools;
  }

  function requireWorkspaceGenerationTools() {
    if (!workspaceGenerationTools) {
      throw new Error('AigsWorkspaceGenerationTools 未加载');
    }
    return workspaceGenerationTools;
  }

  function requireWorkspaceConversationTools() {
    if (!workspaceConversationTools) {
      throw new Error('AigsWorkspaceConversationTools 未加载');
    }
    return workspaceConversationTools;
  }

  function requireWorkspaceMediaTools() {
    if (!workspaceMediaTools) {
      throw new Error('AigsWorkspaceMediaTools 未加载');
    }
    return workspaceMediaTools;
  }

  function requireWorkspaceStateTools() {
    if (!workspaceStateTools) {
      throw new Error('AigsWorkspaceStateTools 未加载');
    }
    return workspaceStateTools;
  }

  function requireWorkspaceShellTools() {
    if (!workspaceShellTools) {
      throw new Error('AigsWorkspaceShellTools 未加载');
    }
    return workspaceShellTools;
  }

  function requireWorkspaceUiTools() {
    if (!workspaceUiTools) {
      throw new Error('AigsWorkspaceUiTools 未加载');
    }
    return workspaceUiTools;
  }

  function requireWorkspacePageInitTools() {
    if (!workspacePageInitTools) {
      throw new Error('AigsWorkspacePageInitTools 未加载');
    }
    return workspacePageInitTools;
  }

  function requireWorkspaceAuthTools() {
    if (!workspaceAuthTools) {
      throw new Error('AigsWorkspaceAuthTools 未加载');
    }
    return workspaceAuthTools;
  }

  function requireWorkspaceInitTools() {
    if (!workspaceInitTools) {
      throw new Error('AigsWorkspaceInitTools 未加载');
    }
    return workspaceInitTools;
  }

  function requireConversationListTools() {
    if (!conversationListTools) {
      throw new Error('AigsConversationListTools 未加载');
    }
    return conversationListTools;
  }

  function requireConversationActionTools() {
    if (!conversationActionTools) {
      throw new Error('AigsConversationActionTools 未加载');
    }
    return conversationActionTools;
  }

  function getTemplateRawPreview(item = {}) {
    return requireTemplateTools().getTemplateRawPreview(item);
  }

  function getTemplatePreviewSnippet(item = {}) {
    return requireTemplateTools().getTemplatePreviewSnippet(item);
  }

  function getTemplateSearchQuery(feature) {
    return requireTemplateTools().getTemplateSearchQuery(feature);
  }

  function getRecentTemplatesForFeature(feature) {
    return requireTemplateTools().getRecentTemplatesForFeature(feature);
  }

  function resolveRecentTemplateReference(feature, recentItem) {
    return requireTemplateTools().resolveRecentTemplateReference(feature, recentItem);
  }

  function getResolvedRecentTemplates(feature) {
    return requireTemplateTools().getResolvedRecentTemplates(feature);
  }

  function recordRecentTemplateUse(feature, item = {}) {
    return requireTemplateTools().recordRecentTemplateUse(feature, item);
  }

  function clearRecentTemplates(feature) {
    return requireTemplateTools().clearRecentTemplates(feature);
  }

  function filterTemplateGroups(feature, groups = []) {
    return requireTemplateTools().filterTemplateGroups(feature, groups);
  }

  function renderTemplateLibraryStat(feature, totalGroups = [], visibleGroups = []) {
    return requireTemplateTools().renderTemplateLibraryStat(feature, totalGroups, visibleGroups);
  }

  function renderTemplateLibraries() {
    return requireTemplateTools().renderTemplateLibraries();
  }

  function getTemplateDraft(feature) {
    return requireTemplateTools().getTemplateDraft(feature);
  }

  async function saveCurrentTemplate(feature) {
    return requireWorkspaceTemplateTools().saveCurrentTemplate(feature);
  }

  async function toggleTemplateFavoriteAction(feature, templateId) {
    return requireWorkspaceTemplateTools().toggleTemplateFavoriteAction(feature, templateId);
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

  function getConversationTitlePreview(conversation) {
    return requireConversationListTools().getConversationTitlePreview(conversation);
  }

  function getConversationCardTitle(conversation) {
    return requireConversationListTools().getConversationCardTitle(conversation);
  }

  function getConversationPreview(conversation) {
    return requireConversationListTools().getConversationPreview(conversation);
  }

  function sanitizeConversationText(value) {
    return requireConversationListTools().sanitizeConversationText(value);
  }

  function getConversationCardPreview(conversation) {
    return requireConversationListTools().getConversationCardPreview(conversation);
  }

  function getConversationRowPillsMarkup(conversation) {
    return requireConversationListTools().getConversationRowPillsMarkup(conversation);
  }

  function getConversationTimestamp(conversation) {
    return requireConversationListTools().getConversationTimestamp(conversation);
  }

  function getConversationTimeLabel(conversation) {
    return requireConversationListTools().getConversationTimeLabel(conversation);
  }

  function groupConversationsByDay(items = []) {
    return requireConversationListTools().groupConversationsByDay(items);
  }

  function getConversationPriorityRank(conversation) {
    return requireConversationListTools().getConversationPriorityRank(conversation);
  }

  function getConversationSortValue(conversation) {
    return requireConversationListTools().getConversationSortValue(conversation);
  }

  function getArchivedConversationSortValue(conversation) {
    return requireConversationListTools().getArchivedConversationSortValue(conversation);
  }

  function sortConversationSummaries(items = []) {
    return requireConversationListTools().sortConversationSummaries(items);
  }

  function sortArchivedConversationSummaries(items = []) {
    return requireConversationListTools().sortArchivedConversationSummaries(items);
  }

  function setConversationList(items = []) {
    conversationState.list = sortConversationSummaries(
      (Array.isArray(items) ? items : []).filter(Boolean)
    );
  }

  function setArchivedConversationList(items = []) {
    conversationState.archived = sortArchivedConversationSummaries(
      (Array.isArray(items) ? items : []).filter(Boolean)
    );
  }

  function getActiveConversation() {
    return requireConversationListTools().getActiveConversation();
  }

  function getConversationSearchQuery() {
    return requireConversationListTools().getConversationSearchQuery();
  }

  function getConversationFilterMode() {
    return requireConversationListTools().getConversationFilterMode();
  }

  function matchesConversationFilter(conversation, mode = getConversationFilterMode()) {
    return requireConversationListTools().matchesConversationFilter(conversation, mode);
  }

  function getFilteredActiveConversations() {
    return requireConversationListTools().getFilteredActiveConversations();
  }

  function getFilteredArchivedConversations() {
    return requireConversationListTools().getFilteredArchivedConversations();
  }

  function updateConversationSearch(value, options = {}) {
    return requireConversationListTools().updateConversationSearch(value, options);
  }

  function updateConversationFilterMode(mode, options = {}) {
    return requireConversationListTools().updateConversationFilterMode(mode, options);
  }

  function upsertConversationSummary(conversation) {
    if (!conversation?.id) return;
    setConversationList([conversation].concat(
      conversationState.list.filter(item => item.id !== conversation.id)
    ));
  }

  function getConversationTransientEntries(conversationId = conversationState.activeId) {
    if (!conversationId) return [];
    const entries = transientConversationEntries.get(conversationId);
    return Array.isArray(entries) ? entries.slice() : [];
  }

  function setConversationTransientEntries(conversationId, entries = []) {
    if (!conversationId) return;
    if (!Array.isArray(entries) || entries.length === 0) {
      transientConversationEntries.delete(conversationId);
      return;
    }
    transientConversationEntries.set(conversationId, entries.slice());
  }

  function clearConversationTransientEntries(conversationId = conversationState.activeId) {
    if (!conversationId) return;
    transientConversationEntries.delete(conversationId);
  }

  function applyConversationPayload(conversation, messages = [], options = {}) {
    return requireWorkspaceConversationTools().applyConversationPayload(conversation, messages, options);
  }

  function _legacyRenderConversationMeta() {
    const title = $('chat-conversation-title');
    const subtitle = $('chat-conversation-subtitle');
    if (!title || !subtitle) return;

    const activeConversation = conversationState.list.find(item => item.id === conversationState.activeId) || null;
    if (!currentUser || !activeConversation) {
      title.textContent = '暂无进行中的对话';
      subtitle.textContent = '新建对话后即可开始。';
      return;
    }

    title.textContent = getConversationTitlePreview(activeConversation);
    subtitle.textContent = `${activeConversation.messageCount || 0} 条消息 · ${activeConversation.model || 'gpt-4.1-mini'}`;
  }

  function renderConversationList() {
    return requireConversationListTools().renderConversationList();
  }

  function renderArchivedConversationList() {
    return requireConversationListTools().renderArchivedConversationList();
  }

  async function _legacySelectConversation(conversationId) {
    if (!currentUser || !conversationId || !persistence?.getConversation) return;
    try {
      const result = await persistence.getConversation(conversationId);
      if (!result?.conversation) return;
      conversationState.activeId = result.conversation.id;
      conversationState.messages = result.messages || [];
      conversationState.list = conversationState.list.map(item => item.id === result.conversation.id ? result.conversation : item);
      chatHistory = conversationState.messages.map(item => ({ ...item }));
      restoreChatMessages(conversationState.messages);
      renderConversationList();
    } catch (error) {
      showToast(error.message || '会话加载失败', 'error', 1800);
    }
  }

  async function _legacyCreateConversationAndSelect() {
    if (!currentUser || !persistence?.createConversation) return null;
    try {
      const result = await persistence.createConversation({
        model: $('chat-model')?.value || 'gpt-4.1-mini'
      });
      if (!result?.conversation) return null;
      conversationState.list = [result.conversation].concat(conversationState.list.filter(item => item.id !== result.conversation.id));
      conversationState.activeId = result.conversation.id;
      conversationState.messages = result.messages || [];
      chatHistory = [];
      restoreChatMessages([]);
      renderConversationList();
      return result.conversation;
    } catch (error) {
      showToast(error.message || '会话创建失败', 'error', 1800);
      return null;
    }
  }

  async function _legacyLoadConversations() {
    if (!currentUser || !persistence?.getConversations) {
      conversationState.list = [];
      conversationState.archived = [];
      conversationState.activeId = null;
      conversationState.messages = [];
      renderConversationList();
      return;
    }

    try {
      conversationState.list = await persistence.getConversations();
      conversationState.archived = persistence.listArchivedConversations ? await persistence.listArchivedConversations() : [];
    } catch {
      conversationState.list = [];
      conversationState.archived = [];
    }

    if (!conversationState.list.length) {
      const created = await createConversationAndSelect();
      if (created) return;
    }

    const preferredConversation = conversationState.list.find(item => item.id === conversationState.activeId) || conversationState.list[0];
    if (preferredConversation) {
      await selectConversation(preferredConversation.id);
    } else {
      restoreChatMessages([]);
      renderConversationList();
    }
  }

  function renderConversationMeta() {
    return requireWorkspaceConversationTools().renderConversationMeta();
  }

  function renderConversationSidebarSummary() {
    return requireConversationListTools().renderConversationSidebarSummary();
  }

  function renderConversationSearchFeedback() {
    return requireConversationListTools().renderConversationSearchFeedback();
  }

  function focusCurrentConversationInList() {
    return requireConversationListTools().focusCurrentConversationInList();
  }

  function readChatArchivedCollapsedPreference() {
    return requireConversationWorkflowTools().readChatArchivedCollapsedPreference();
  }

  function persistChatArchivedCollapsedPreference(value) {
    return requireConversationWorkflowTools().persistChatArchivedCollapsedPreference(value);
  }

  function syncChatArchivedSectionState() {
    return requireConversationWorkflowTools().syncChatArchivedSectionState();
  }

  function setChatArchivedCollapsed(nextValue) {
    return requireConversationWorkflowTools().setChatArchivedCollapsed(nextValue);
  }

  async function selectConversation(conversationId) {
    return requireConversationActionTools().selectConversation(conversationId);
  }

  async function createConversationAndSelect() {
    return requireWorkspaceConversationTools().createConversationAndSelect();
  }

  async function startNewConversation() {
    return requireWorkspaceConversationTools().startNewConversation();
  }

  async function ensureActiveConversation() {
    return requireWorkspaceConversationTools().ensureActiveConversation();
  }

  async function renameActiveConversation() {
    return renameConversationById(getActiveConversation()?.id);
  }

  async function renameConversationById(conversationId) {
    return requireConversationActionTools().renameConversationById(conversationId);
  }

  async function archiveActiveConversation() {
    const activeConversation = getActiveConversation();
    if (!activeConversation) return;
    return archiveConversationById(activeConversation.id, {
      confirmationMessage: `确认归档“${getConversationTitlePreview(activeConversation)}”吗？`
    });
  }

  async function archiveConversationById(conversationId, options = {}) {
    return requireConversationActionTools().archiveConversationById(conversationId, options);
  }

  async function restoreArchivedConversation(conversationId) {
    return requireConversationActionTools().restoreArchivedConversation(conversationId);
  }

  async function deleteArchivedConversation(conversationId) {
    return requireConversationActionTools().deleteArchivedConversation(conversationId);
  }

  async function loadConversations() {
    return requireConversationActionTools().loadConversations();
  }

  function renderHistory(feature) {
    return requireWorkspaceTemplateTools().renderHistory(feature);
  }

  async function loadAllHistories() {
    return requireWorkspaceTemplateTools().loadAllHistories();
  }

  function saveHistoryEntry(feature, entry) {
    return requireWorkspaceTemplateTools().saveHistoryEntry(feature, entry);
  }

  function isChatNearBottom(container) {
    return requireChatRenderRuntimeTools().isChatNearBottom(container);
  }

  function updateChatScrollButton() {
    return requireChatRenderRuntimeTools().updateChatScrollButton();
  }

  function handleChatMessagesScroll() {
    return requireChatRenderRuntimeTools().handleChatMessagesScroll();
  }

  function isChatMobileViewport() {
    return window.matchMedia ? window.matchMedia('(max-width: 767px)').matches : window.innerWidth <= 767;
  }

  function getChatKeyboardInset() {
    const viewport = window.visualViewport;
    if (!viewport) return 0;
    const viewportBottom = viewport.height + viewport.offsetTop;
    return Math.max(0, Math.round(window.innerHeight - viewportBottom));
  }

  function syncChatViewportState() {
    const chatMain = document.querySelector('.chat-main');
    const inputArea = document.querySelector('.chat-input-area');
    const input = $('chat-input');
    if (!chatMain || !inputArea || !input) return;

    const focused = document.activeElement === input;
    const keyboardInset = isChatMobileViewport() && focused ? getChatKeyboardInset() : 0;
    const mobileCompose = Boolean(isChatMobileViewport() && focused && keyboardInset >= 80);

    chatViewportState.keyboardInset = keyboardInset;
    chatViewportState.mobileCompose = mobileCompose;
    document.documentElement.style.setProperty('--chat-mobile-keyboard-offset', `${keyboardInset}px`);
    chatMain.dataset.mobileCompose = mobileCompose ? 'true' : 'false';
    inputArea.dataset.mobileCompose = mobileCompose ? 'true' : 'false';
  }

  function queueChatViewportSync() {
    window.requestAnimationFrame(syncChatViewportState);
  }

  function ensureChatComposerVisible() {
    if (!isChatMobileViewport()) return;
    const inputArea = document.querySelector('.chat-input-area');
    if (!inputArea) return;
    window.setTimeout(() => {
      inputArea.scrollIntoView({ block: 'end', behavior: 'smooth' });
      followChatToBottom(false);
    }, 60);
  }

  function setChatAutoFollow(shouldFollow) {
    return requireChatRenderRuntimeTools().setChatAutoFollow(shouldFollow);
  }

  function followChatToBottom(force = false) {
    return requireChatRenderRuntimeTools().followChatToBottom(force);
  }

  function getConversationMessageById(messageId) {
    const persisted = (conversationState.messages || []).find(item => item.id === messageId);
    if (persisted) return persisted;
    const activeTransient = getConversationTransientEntries().find(item => item.id === messageId);
    if (activeTransient) return activeTransient;
    for (const entries of transientConversationEntries.values()) {
      const matched = (Array.isArray(entries) ? entries : []).find(item => item.id === messageId);
      if (matched) return matched;
    }
    return null;
  }

  function getChatMessageUiState(messageId) {
    return requireChatRenderRuntimeTools().getChatMessageUiState(messageId);
  }

  function setChatMessageUiState(messageId, patch = {}) {
    return requireChatRenderRuntimeTools().setChatMessageUiState(messageId, patch);
  }

  function syncChatMessageActionPanelDom(messageId, expanded) {
    return requireChatRenderRuntimeTools().syncChatMessageActionPanelDom(messageId, expanded);
  }

  function collapseOtherChatMessagePanels(exceptMessageId = '') {
    return requireChatRenderRuntimeTools().collapseOtherChatMessagePanels(exceptMessageId);
  }

  function toggleChatMessageActionPanel(messageId) {
    return requireChatRenderRuntimeTools().toggleChatMessageActionPanel(messageId);
  }

  function toggleAssistantMessageCompact(messageId) {
    return requireChatRenderRuntimeTools().toggleAssistantMessageCompact(messageId);
  }

  function setChatRequestStatus(text = '', tone = 'info') {
    const statusEl = $('chat-request-status');
    if (!statusEl) return;
    const normalizedText = String(text || '').trim();
    if (!normalizedText) {
      statusEl.setAttribute('hidden', '');
      statusEl.textContent = '';
      statusEl.dataset.tone = 'info';
      return;
    }
    statusEl.textContent = normalizedText;
    statusEl.dataset.tone = tone;
    statusEl.removeAttribute('hidden');
  }

  function buildTransientMessageId(prefix = 'chat-temp') {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function removeTransientEntry(messageId, conversationId = conversationState.activeId) {
    if (!conversationId || !messageId) return;
    const nextEntries = getConversationTransientEntries(conversationId).filter(item => item.id !== messageId);
    setConversationTransientEntries(conversationId, nextEntries);
  }

  function clearTransientConversationRender(conversationId = conversationState.activeId) {
    clearConversationTransientEntries(conversationId);
    if (conversationState.activeId === conversationId) {
      restoreChatMessages(conversationState.messages, { forceFollow: false });
    }
  }

  function restoreChatMessages(messages, options = {}) {
    return requireChatRenderRuntimeTools().restoreChatMessages(messages, options);
  }

  function restoreLatestChat() {
    renderConversationList();
  }

  function recordChatHistory(title, reply) {
    return { title, reply };
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
      $('music-audio').src = resolveApiAssetUrl(result.url || '');
      const durationMs = parseInt(result.duration, 10) || 0;
      $('music-duration-info').textContent = durationMs ? `${(durationMs / 1000).toFixed(1)}秒` : '';
      $('music-model-info').textContent = '模型: music-2.6';
      getResultArea('music')?.removeAttribute('hidden');
      return;
    }
    if (feature === 'cover') {
      $('cover-image').src = resolveApiAssetUrl(result.url || '');
      $('cover-meta').textContent = inputs?.style ? `风格: ${inputs.style}` : '';
      getResultArea('cover')?.removeAttribute('hidden');
      return;
    }
    if (feature === 'speech') {
      $('speech-result')?.removeAttribute('hidden');
      $('speech-audio').src = resolveApiAssetUrl(result.url || '');
      $('speech-info').textContent = result.info || '';
      return;
    }
    if (feature === 'covervoice') {
      $('voice-audio').src = resolveApiAssetUrl(result.url || '');
      $('voice-meta').textContent = result.duration ? `时长: ${result.duration}s` : '';
      getResultArea('covervoice')?.removeAttribute('hidden');
    }
  }

  function restoreHistoryEntry(feature, index, action) {
    return requireWorkspaceTemplateTools().restoreHistoryEntry(feature, index, action);
  }

  function applyTemplate(feature, groupIndex, itemIndex) {
    return requireWorkspaceTemplateTools().applyTemplate(feature, groupIndex, itemIndex);
  }

  function bindEnhancementEvents() {
    document.addEventListener('click', event => {
      const newConversationButton = event.target.closest('#btn-chat-new-conversation');
      if (newConversationButton) {
        startNewConversation();
        return;
      }
      const manageConversationsButton = event.target.closest('#btn-chat-manage-conversations');
      if (manageConversationsButton) {
        toggleConversationManageMode();
        return;
      }
      const restoreConversationButton = event.target.closest('[data-restore-conversation-id]');
      if (restoreConversationButton) {
        restoreArchivedConversation(restoreConversationButton.dataset.restoreConversationId);
        return;
      }
      const deleteConversationButton = event.target.closest('[data-delete-conversation-id]');
      if (deleteConversationButton) {
        deleteArchivedConversation(deleteConversationButton.dataset.deleteConversationId);
        return;
      }
      const renameConversationButton = event.target.closest('#btn-chat-rename-conversation');
      if (renameConversationButton) {
        renameActiveConversation();
        return;
      }
      const archiveConversationButton = event.target.closest('#btn-chat-archive-conversation');
      if (archiveConversationButton) {
        archiveActiveConversation();
        return;
      }
      const conversationActionsToggleButton = event.target.closest('[data-conversation-actions-toggle]');
      if (conversationActionsToggleButton) {
        toggleConversationActionMenu(conversationActionsToggleButton.dataset.conversationActionsToggle || '');
        return;
      }
      const inlineRenameConversationButton = event.target.closest('[data-conversation-rename-id]');
      if (inlineRenameConversationButton) {
        closeConversationActionMenu({ render: false });
        renameConversationById(inlineRenameConversationButton.dataset.conversationRenameId);
        return;
      }
      const inlinePinConversationButton = event.target.closest('[data-conversation-pin-id]');
      if (inlinePinConversationButton) {
        closeConversationActionMenu({ render: false });
        const nextPinned = toggleConversationWorkflowState(inlinePinConversationButton.dataset.conversationPinId, 'pinned');
        showToast(nextPinned ? '已设为重点会话' : '已取消重点会话', 'success', 1400);
        return;
      }
      const inlineParkConversationButton = event.target.closest('[data-conversation-park-id]');
      if (inlineParkConversationButton) {
        closeConversationActionMenu({ render: false });
        const nextParked = toggleConversationWorkflowState(inlineParkConversationButton.dataset.conversationParkId, 'parked');
        showToast(nextParked ? '已加入稍后处理' : '已移出稍后处理', 'success', 1400);
        return;
      }
      const inlineArchiveConversationButton = event.target.closest('[data-conversation-archive-id]');
      if (inlineArchiveConversationButton) {
        closeConversationActionMenu({ render: false });
        archiveConversationById(inlineArchiveConversationButton.dataset.conversationArchiveId);
        return;
      }
      const copyMessageButton = event.target.closest('[data-chat-copy-id]');
      if (copyMessageButton) {
        copyAssistantMessage(copyMessageButton.dataset.chatCopyId, copyMessageButton).catch(error => {
          showToast(error.message || '复制失败，请重试。', 'error', 1600);
        });
        return;
      }
      const excerptMessageButton = event.target.closest('[data-chat-excerpt-id]');
      if (excerptMessageButton) {
        toggleChatExcerpt(excerptMessageButton.dataset.chatExcerptId, excerptMessageButton).catch(error => {
          showToast(error.message || '摘录操作失败，请重试。', 'error', 1600);
        });
        return;
      }
      const compactToggleButton = event.target.closest('[data-chat-compact-toggle]');
      if (compactToggleButton) {
        toggleAssistantMessageCompact(compactToggleButton.dataset.chatCompactToggle || '');
        return;
      }
      const rewriteMessageButton = event.target.closest('[data-chat-rewrite-id]');
      if (rewriteMessageButton) {
        rewriteAssistantMessage(rewriteMessageButton.dataset.chatRewriteId, rewriteMessageButton);
        return;
      }
      const messageActionsToggleButton = event.target.closest('[data-chat-message-actions-toggle]');
      if (messageActionsToggleButton) {
        toggleChatMessageActionPanel(messageActionsToggleButton.dataset.chatMessageActionsToggle || '');
        return;
      }
      const versionNavButton = event.target.closest('[data-chat-version-nav]');
      if (versionNavButton) {
        switchAssistantVersion(versionNavButton.dataset.chatMessageId, versionNavButton.dataset.chatVersionNav, versionNavButton)
          .catch(error => {
            showToast(error.message || '切换版本失败，请重试。', 'error', 1600);
          });
        return;
      }
      const retryMessageButton = event.target.closest('[data-chat-retry-id]');
      if (retryMessageButton) {
        retryTransientAssistantMessage(retryMessageButton.dataset.chatRetryId);
        return;
      }
      const copyCodeButton = event.target.closest('.chat-code-copy');
      if (copyCodeButton) {
        copyCodeBlock(copyCodeButton).catch(error => {
          showToast(error.message || '复制代码失败，请重试。', 'error', 1600);
        });
        return;
      }
      const scrollToLatestButton = event.target.closest('#chat-scroll-to-latest');
      if (scrollToLatestButton) {
        setChatAutoFollow(true);
        followChatToBottom(true);
        return;
      }
      const chatStarterButton = event.target.closest('[data-chat-starter-prompt]');
      if (chatStarterButton) {
        applyChatStarterPrompt(chatStarterButton.dataset.chatStarterPrompt || '');
        return;
      }
      const chatSuggestionButton = event.target.closest('[data-chat-suggestion-prompt]');
      if (chatSuggestionButton) {
        applyChatStarterPrompt(chatSuggestionButton.dataset.chatSuggestionPrompt || '');
        return;
      }
      const searchResetButton = event.target.closest('[data-chat-search-reset]');
      if (searchResetButton) {
        updateConversationSearch('');
        updateConversationFilterMode('all', { render: true });
        $('chat-conversation-search')?.focus();
        return;
      }
      const filterButton = event.target.closest('[data-chat-filter]');
      if (filterButton) {
        updateConversationFilterMode(filterButton.dataset.chatFilter || 'all');
        return;
      }
      const filterShortcutButton = event.target.closest('[data-chat-filter-shortcut]');
      if (filterShortcutButton) {
        updateConversationFilterMode(filterShortcutButton.dataset.chatFilterShortcut || 'all');
        return;
      }
      const focusCurrentButton = event.target.closest('[data-chat-focus-current]');
      if (focusCurrentButton) {
        const shouldResetSearch = Boolean(getConversationSearchQuery().trim());
        const shouldResetFilter = getConversationFilterMode() !== 'all';
        if (shouldResetFilter) {
          updateConversationFilterMode('all', { render: false });
        }
        if (shouldResetSearch || shouldResetFilter) {
          updateConversationSearch('');
          window.setTimeout(() => {
            focusCurrentConversationInList();
          }, 0);
        } else {
          focusCurrentConversationInList();
        }
        return;
      }
      const archivedToggleButton = event.target.closest('[data-chat-archived-toggle]');
      if (archivedToggleButton) {
        setChatArchivedCollapsed(!chatArchivedCollapsed);
        return;
      }
      const outlineButton = event.target.closest('[data-chat-outline-target]');
      if (outlineButton) {
        const targetId = outlineButton.dataset.chatOutlineTarget || '';
        const targetHeading = targetId ? document.getElementById(targetId) : null;
        if (targetHeading) {
          setChatAutoFollow(false);
          targetHeading.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        return;
      }
      const excerptJumpButton = event.target.closest('[data-chat-excerpt-jump]');
      if (excerptJumpButton) {
        jumpToChatExcerpt(
          excerptJumpButton.dataset.chatExcerptJump || '',
          excerptJumpButton.dataset.chatExcerptConversationId || ''
        ).catch(error => {
          showToast(error.message || '摘录跳转失败，请重试。', 'error', 1600);
        });
        return;
      }
      const excerptCopyButton = event.target.closest('[data-chat-excerpt-copy]');
      if (excerptCopyButton) {
        copyChatExcerptItem(excerptCopyButton.dataset.chatExcerptCopy || '', excerptCopyButton).catch(error => {
          showToast(error.message || '摘录复制失败，请重试。', 'error', 1600);
        });
        return;
      }
      const excerptInsertButton = event.target.closest('[data-chat-excerpt-insert]');
      if (excerptInsertButton) {
        insertChatExcerptIntoComposer(excerptInsertButton.dataset.chatExcerptInsert || '', excerptInsertButton);
        return;
      }
      const excerptArchiveButton = event.target.closest('[data-chat-excerpt-archive]');
      if (excerptArchiveButton) {
        const targetId = excerptArchiveButton.dataset.chatExcerptArchive || '';
        const nextArchived = !isChatExcerptArchived(targetId);
        const updated = setChatExcerptArchived(targetId, nextArchived);
        if (updated) {
          showToast(nextArchived ? '已归档到资产库' : '已恢复到活跃资产', 'success', 1400);
          if (conversationState.activeId) {
            restoreChatMessages(conversationState.messages, { forceFollow: false });
          }
        }
        return;
      }
      const excerptRemoveButton = event.target.closest('[data-chat-excerpt-remove]');
      if (excerptRemoveButton) {
        const removed = removeChatExcerpt(excerptRemoveButton.dataset.chatExcerptRemove || '');
        if (removed) {
          showToast('已移出消息摘录', 'success', 1200);
          if (conversationState.activeId) {
            restoreChatMessages(conversationState.messages, { forceFollow: false });
          }
        }
        return;
      }
      const excerptFilterButton = event.target.closest('[data-chat-excerpt-filter]');
      if (excerptFilterButton) {
        setChatExcerptFilterMode(excerptFilterButton.dataset.chatExcerptFilter || 'current');
        return;
      }
      const excerptToggleButton = event.target.closest('#btn-chat-excerpt-toggle-panel');
      if (excerptToggleButton) {
        setChatExcerptExpanded(!chatExcerptState.expanded);
        return;
      }
      const excerptCopyVisibleButton = event.target.closest('#btn-chat-excerpt-copy-visible');
      if (excerptCopyVisibleButton) {
        copyChatExcerptBundle(excerptCopyVisibleButton).catch(error => {
          showToast(error.message || '摘录列表复制失败，请重试。', 'error', 1600);
        });
        return;
      }
      const excerptArchiveVisibleButton = event.target.closest('#btn-chat-excerpt-archive-visible');
      if (excerptArchiveVisibleButton) {
        const archived = archiveVisibleChatExcerpts();
        if (archived > 0) {
          showToast(`已归档 ${archived} 条资产`, 'success', 1400);
        }
        return;
      }
      const excerptSearchClearButton = event.target.closest('[data-chat-excerpt-search-clear], #btn-chat-excerpt-search-clear');
      if (excerptSearchClearButton) {
        setChatExcerptQuery('');
        return;
      }
      const excerptClearArchivedButton = event.target.closest('#btn-chat-excerpt-clear-archived');
      if (excerptClearArchivedButton) {
        const cleared = clearArchivedChatExcerpts();
        if (cleared > 0) {
          showToast(`已清空 ${cleared} 条归档资产`, 'success', 1400);
        }
        return;
      }
      const clearRecentTemplatesButton = event.target.closest('[data-template-recent-clear]');
      if (clearRecentTemplatesButton) {
        clearRecentTemplates(clearRecentTemplatesButton.dataset.templateRecentClear);
        return;
      }
      const conversationButton = event.target.closest('[data-conversation-id]');
      if (conversationButton) {
        closeConversationActionMenu({ render: false });
        selectConversation(conversationButton.dataset.conversationId);
        return;
      }
      const saveButton = event.target.closest('[data-template-save]');
      if (saveButton) {
        saveCurrentTemplate(saveButton.dataset.templateSave);
        return;
      }
      const favoriteButton = event.target.closest('[data-template-favorite]');
      if (favoriteButton) {
        toggleTemplateFavoriteAction(favoriteButton.dataset.templateFavorite, favoriteButton.dataset.templateId);
        return;
      }
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

    document.addEventListener('input', event => {
      const searchInput = event.target.closest?.('#chat-conversation-search');
      if (searchInput) {
        updateConversationSearch(searchInput.value, { syncInput: false });
        return;
      }
      const excerptSearchInput = event.target.closest?.('#chat-excerpt-search');
      if (excerptSearchInput) {
        setChatExcerptQuery(excerptSearchInput.value);
        return;
      }

      const inputId = event.target?.id;
      if (!TRACKED_WORKSPACE_INPUT_IDS.has(inputId)) return;
            scheduleWorkspaceStateSave();
    });

    document.addEventListener('change', event => {
      const inputId = event.target?.id;
      if (!TRACKED_WORKSPACE_INPUT_IDS.has(inputId)) return;
            scheduleWorkspaceStateSave();
    });
  }

  // ===========================================
  //  Tab Navigation
  // ===========================================
  function initTabs() {
    $$('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
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

  function normalizeTheme(theme) {
    return requireWorkspaceShellTools().normalizeTheme(theme);
  }

  function getStoredTheme() { return requireWorkspaceShellTools().getStoredTheme(); }

  function setTheme(theme) {
    return requireWorkspaceShellTools().setTheme(theme);
  }

  function toggleTheme() {
    return requireWorkspaceShellTools().toggleTheme();
  }

  function initTheme() {
    return requireWorkspaceShellTools().initTheme();
  }

  let quotaLoading = false;
  function getModelLabel(name) { return requireWorkspaceShellTools().getModelLabel(name); }

  function readQuotaCollapsedPreference() {
    return requireWorkspaceShellTools().readQuotaCollapsedPreference();
  }

  function persistQuotaCollapsedPreference(value) {
    return requireWorkspaceShellTools().persistQuotaCollapsedPreference(value);
  }

  function buildQuotaSummary(items = [], stateText = '') {
    return requireWorkspaceShellTools().buildQuotaSummary(items, stateText);
  }

  function syncQuotaCardState() {
    return requireWorkspaceShellTools().syncQuotaCardState();
  }

  function setQuotaCollapsed(nextValue) {
    return requireWorkspaceShellTools().setQuotaCollapsed(nextValue);
  }

  function renderQuotaContent({ items = [], summaryText = '', bodyHtml = '' } = {}) {
    return requireWorkspaceShellTools().renderQuotaContent({ items, summaryText, bodyHtml });
  }

  function bindQuotaToggle() {
    return requireWorkspaceShellTools().bindQuotaToggle();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  const chatMarkdownTools = window.AigsChatMarkdown?.createTools
    ? window.AigsChatMarkdown.createTools({
        escapeHtml,
        getOrigin: () => window.location.origin
      })
    : null;

  function requireChatMarkdownTools() {
    if (!chatMarkdownTools) {
      throw new Error('AigsChatMarkdown 未加载');
    }
    return chatMarkdownTools;
  }

  async function loadQuota() {
    if (quotaLoading) return;
    quotaLoading = true;

    try {
      const res = await apiFetch('/api/quota');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const models = data.model_remains || [];
      const labelOrder = requireWorkspaceShellTools().getQuotaLabelOrder();

      if (models.length === 0) {
        renderQuotaContent({
          items: [],
          summaryText: '暂无可用额度数据',
          bodyHtml: '<div class="quota-loading">无可用配额数据</div>'
        });
        return;
      }

      // Deduplicate by label, filter zero-quota
      const seen = new Set();
      const unique = models
        .filter(m => m.current_interval_total_count > 0)
        .filter(m => { const l = getModelLabel(m.model_name); return !seen.has(l) && seen.add(l); })
        .sort((a, b) => {
          const ia = labelOrder.indexOf(getModelLabel(a.model_name));
          const ib = labelOrder.indexOf(getModelLabel(b.model_name));
          return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        })
        .slice(0, 8);

      renderQuotaContent({
        items: unique,
        bodyHtml: `
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
        <button class="quota-refresh" id="btn-quota-refresh" type="button" title="刷新配额">↻ 刷新</button>`
      });

    } catch {
      renderQuotaContent({
        items: [],
        summaryText: '额度加载失败',
        bodyHtml: '<div class="quota-loading">无法加载配额</div>'
      });
    } finally {
      quotaLoading = false;
    }
  }
  window.loadQuota = loadQuota;

  // ============================================
  //  Generic Content Generator
  // ============================================
  async function generateContent({ apiEndpoint, domIds, resultTab, loadingText, successMessage, onSuccess, historyFeature, buildHistoryEntry }) {
    return requireWorkspaceGenerationTools().generateContent({
      apiEndpoint,
      domIds,
      resultTab,
      loadingText,
      successMessage,
      onSuccess,
      historyFeature,
      buildHistoryEntry
    });
  }

  // ============================================
  //  Content Generators (thin wrappers)
  // ============================================
  async function generateMusic() {
    return requireWorkspaceGenerationTools().generateMusic();
  }

  function generateLyrics() {
    return requireWorkspaceGenerationTools().generateLyrics();
  }

  function generateCover() {
    return requireWorkspaceGenerationTools().generateCover();
  }

  function pollImageStatus(taskId, maxRetries, inputs) {
    return requireWorkspaceGenerationTools().pollImageStatus(taskId, maxRetries, inputs);
  }

  async function generateVoice() {
    return requireWorkspaceGenerationTools().generateVoice();
  }

  async function generateVoiceWithFile(file, prompt) {
    return requireWorkspaceGenerationTools().generateVoiceWithFile(file, prompt);
  }

  async function generateVoiceWithUrl(audioUrl, prompt) {
    return requireWorkspaceGenerationTools().generateVoiceWithUrl(audioUrl, prompt);
  }

  async function doVoiceGenerate(audioUrl, prompt) {
    return requireWorkspaceGenerationTools().runVoiceGeneration(audioUrl, prompt);
  }

  function fileToBase64(file) {
    return requireWorkspaceMediaTools().fileToBase64(file);
  }

  function formatFileSize(size) {
    return requireWorkspaceMediaTools().formatFileSize(size);
  }

  function normalizeMediaTypeLabel(file) {
    return requireWorkspaceMediaTools().normalizeMediaTypeLabel(file);
  }

  function getTranscriptionSelectedFile() {
    return requireWorkspaceMediaTools().getTranscriptionSelectedFile();
  }

  function syncTranscriptionFilePreview(file) {
    return requireWorkspaceMediaTools().syncTranscriptionFilePreview(file);
  }

  function renderTranscriptionExperimentalPlan(file) {
    return requireWorkspaceMediaTools().renderTranscriptionExperimentalPlan(file);
  }

  function startTranscriptionShell() {
    const file = getTranscriptionSelectedFile();
    renderTranscriptionExperimentalPlan(file);
    showToast('语音转文字仍为实验入口，已展示接入计划', 'info', 1800);
        scheduleWorkspaceStateSave();
  }

  // ============================================
  //  Reset
  // ============================================
  const RESET_MAPS = {
    music:      [{ id: 'music-prompt', tag: 'textarea' }, { id: 'music-style' }, { id: 'music-bpm' }, { id: 'music-key' }, { id: 'music-duration' }, { id: 'music-char', val: '0' }],
    lyrics:     [{ id: 'lyrics-prompt', tag: 'textarea' }, { id: 'lyrics-style' }, { id: 'lyrics-structure' }, { id: 'lyrics-char', val: '0' }],
    cover:      [{ id: 'cover-prompt', tag: 'textarea' }, { id: 'cover-ratio' }, { id: 'cover-style' }, { id: 'cover-char', val: '0' }],
    covervoice: [{ id: 'voice-audio-file' }, { id: 'voice-audio-url' }, { id: 'voice-prompt', tag: 'textarea' }, { id: 'voice-timbre' }, { id: 'voice-pitch' }, { id: 'voice-char', val: '0' }],
    speech:     [{ id: 'speech-text', tag: 'textarea' }, { id: 'speech-voice' }, { id: 'speech-emotion' }, { id: 'speech-speed' }, { id: 'speech-pitch' }, { id: 'speech-vol' }, { id: 'speech-format' }, { id: 'speech-char', val: '0' }],
    transcription: [{ id: 'transcription-file' }]
  };

  function resetFieldToDefault(inputId) {
    return requireWorkspaceStateTools().resetFieldToDefault(inputId);
  }

  function clearFeatureDraft(feature, { clearResult = true } = {}) {
    return requireWorkspaceStateTools().clearFeatureDraft(feature, { clearResult });
  }

  // file input 需要手动清空
  function resetTab(tab) {
    clearFeatureDraft(tab);
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

  function normalizeChatMarkdownText(value) {
    return requireChatMarkdownTools().normalizeChatMarkdownText(value);
  }

  function renderChatCodeBlock(language, code) {
    return requireChatMarkdownTools().renderChatCodeBlock(language, code);
  }

  function renderChatFormulaSegment(rawFormula, mode = 'inline') {
    return requireChatMarkdownTools().renderChatFormulaSegment(rawFormula, mode);
  }

  function protectChatFormulaSegments(text) {
    return requireChatMarkdownTools().protectChatFormulaSegments(text);
  }

  function restoreChatFormulaSegments(text, formulas, placeholderPrefix = '__CHAT_FORMULA_') {
    return requireChatMarkdownTools().restoreChatFormulaSegments(text, formulas, placeholderPrefix);
  }

  function applyInlineMarkdown(text) {
    return requireChatMarkdownTools().applyInlineMarkdown(text);
  }

  function getMarkdownTableCells(line) {
    return requireChatMarkdownTools().getMarkdownTableCells(line);
  }

  function isMarkdownTableSeparator(line) {
    return requireChatMarkdownTools().isMarkdownTableSeparator(line);
  }

  function isMarkdownTableStart(lines, index) {
    return requireChatMarkdownTools().isMarkdownTableStart(lines, index);
  }

  function renderChatMarkdownTable(tableLines) {
    return requireChatMarkdownTools().renderChatMarkdownTable(tableLines);
  }

  function formatChatMessageHtml(text) {
    return requireChatMarkdownTools().formatChatMessageHtml(text);
  }

  function getAssistantMessageStatus(message) {
    return requireChatMessageMetaTools().getAssistantMessageStatus(message);
  }

  function buildChatMessageMeta(message, role, settings = {}) {
    return requireChatMessageMetaTools().buildChatMessageMeta(message, role, settings);
  }

  function annotateChatMessageHeadings(msgDiv, messageId = '') {
    return requireChatOutlineTools().annotateChatMessageHeadings(msgDiv, messageId);
  }

  function renderChatReadingOutline() {
    return requireChatOutlineTools().renderChatReadingOutline();
  }

  function getVisibleChatExcerpts() {
    return requireChatExcerptTools().getVisibleChatExcerpts();
  }

  function matchesChatExcerptQuery(item, query) {
    return requireChatExcerptTools().matchesChatExcerptQuery(item, query);
  }

  function getFilteredChatExcerpts(options = {}) {
    return requireChatExcerptTools().getFilteredChatExcerpts(options);
  }

  function buildChatExcerptBundle(items = []) {
    return requireChatExcerptTools().buildChatExcerptBundle(items);
  }

  async function copyChatExcerptBundle(triggerButton = null) {
    return requireChatExcerptTools().copyChatExcerptBundle(triggerButton);
  }

  async function copyChatExcerptItem(messageId, triggerButton = null) {
    return requireChatExcerptTools().copyChatExcerptItem(messageId, triggerButton);
  }

  function insertChatExcerptIntoComposer(messageId, triggerButton = null) {
    return requireChatExcerptTools().insertChatExcerptIntoComposer(messageId, triggerButton);
  }

  function getCurrentWorkspaceAssetConfig() {
    return WORKSPACE_ASSET_TARGETS[currentTab] || WORKSPACE_ASSET_TARGETS.chat;
  }

  function appendTextToField(inputId, nextText) {
    const input = $(inputId);
    if (!input || nextText == null) return false;
    const prepared = String(nextText || '').trim();
    if (!prepared) return false;
    input.value = String(input.value || '').trim()
      ? `${String(input.value || '').trim()}\n\n${prepared}`
      : prepared;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    const caretPosition = input.value.length;
    if (typeof input.setSelectionRange === 'function') {
      input.setSelectionRange(caretPosition, caretPosition);
    }
    if (inputId === 'chat-input') {
      updateChatComposerState();
    }
    return true;
  }

  function renderChatExcerptShelf() {
    return requireChatExcerptTools().renderChatExcerptShelf();
  }

  async function jumpToChatExcerpt(messageId, conversationId = '') {
    return requireChatExcerptTools().jumpToChatExcerpt(messageId, conversationId);
  }

  function syncChatReadingOutlineActiveTarget() {
    return requireChatOutlineTools().syncChatReadingOutlineActiveTarget();
  }

  function buildChatAssistantActions(message) {
    return requireChatMessageNodeTools().buildChatAssistantActions(message);
  }

  function insertChatMessageNode(container, node, insertAfterMessageId = '') {
    return requireChatMessageNodeTools().insertChatMessageNode(container, node, insertAfterMessageId);
  }

  function createThinkingMessage(options = {}) {
    return requireChatMessageNodeTools().createThinkingMessage(options);
  }

  function addChatMessage(role, content, options = {}) {
    return requireChatMessageNodeTools().addChatMessage(role, content, options);
  }

  function parseSseBlock(block) {
    return requireChatStreamTools().parseSseBlock(block);
  }

  async function streamChatMessage(response, pendingMessage = null) {
    return requireChatStreamTools().streamChatMessage(response, pendingMessage);
  }

  function setChatLoading(loading) {
    return requireChatSendTools().setChatLoading(loading);
  }

  function updateQueueIndicator() {
    return requireChatSendTools().updateQueueIndicator();
  }

  function describeChatFailure(error) {
    return requireChatFailureTools().describeChatFailure(error);
  }

  function createFailedChatEntries(context = {}, error) {
    return requireChatFailureTools().createFailedChatEntries(context, error);
  }

  async function performChatSend(message, options = {}) {
    return requireChatSendTools().performChatSend(message, options);
  }

  async function drainChatQueue() {
    return requireChatSendTools().drainChatQueue();
  }

  function stopChatGeneration() {
    return requireChatSendTools().stopChatGeneration(isChatGenerating);
  }

  async function retryTransientAssistantMessage(messageId) {
    return requireChatEntryTools().retryTransientAssistantMessage(messageId);
  }

  async function sendChatMessage(forcedMessage) {
    return requireChatEntryTools().sendChatMessage(forcedMessage);
  }

  async function sendChatMessageFromQueue(message) {
    return requireChatSendTools().sendChatMessageFromQueue(message);
  }

  async function activateAssistantVersion(messageId) {
    return requireChatMessageActionTools().activateAssistantVersion(messageId);
  }

  function setActionButtonState(button, nextLabel, options = {}) {
    return requireChatMessageActionTools().setActionButtonState(button, nextLabel, options);
  }

  async function rewriteAssistantMessage(messageId, triggerButton = null) {
    return requireChatMessageActionTools().rewriteAssistantMessage(messageId, triggerButton);
  }

  function flashButtonFeedback(button, nextLabel, timeoutMs = 1400, tone = 'success') {
    return requireChatMessageActionTools().flashButtonFeedback(button, nextLabel, timeoutMs, tone);
  }

  async function copyAssistantMessage(messageId, triggerButton = null) {
    return requireChatMessageActionTools().copyAssistantMessage(messageId, triggerButton);
  }

  async function copyCodeBlock(button) {
    return requireChatMessageActionTools().copyCodeBlock(button);
  }

  async function switchAssistantVersion(messageId, direction, triggerButton = null) {
    return requireChatMessageActionTools().switchAssistantVersion(messageId, direction, triggerButton);
  }

  // ============================================
  //  Custom Dropdown
  // ============================================
  function initCustomDropdown(dropdownId, inputId) {
    return requireWorkspaceUiTools().initCustomDropdown(dropdownId, inputId);
  }

  // ============================================
  //  Speech TTS
  // ============================================
  function initSpeechTab() {
    return requireWorkspacePageInitTools().initSpeechTab();
  }

  // ============================================
  //  Download
  // ============================================
  function downloadFile(url, filename) {
    return requireWorkspaceUiTools().downloadFile(url, filename);
  }

  function copyToClipboard(text) {
    return requireWorkspaceUiTools().copyToClipboard(text);
  }

  // ============================================
  //  Init
  // ============================================
  async function init() {
    return requireWorkspacePageInitTools().init();
  }

  // ============================================
  //  Convert Selects to Custom Dropdowns
  // ============================================
  function convertAllSelectsToCustomDropdowns() {
    return requireWorkspaceInitTools().convertAllSelectsToCustomDropdowns();
  }

  // Initialize small dropdown (for config items)
  function initCustomDropdownSm(dropdownId, inputId) {
    return requireWorkspaceInitTools().initCustomDropdownSm(dropdownId, inputId);
  }

  // Mobile sidebar toggle
  function initMobileSidebar() {
    return requireWorkspaceInitTools().initMobileSidebar();
  }

  // Form validation helpers
  function showInputError(inputId, message) {
    return requireWorkspaceUiTools().showInputError(inputId, message);
  }

  function clearInputError(inputId) {
    return requireWorkspaceUiTools().clearInputError(inputId);
  }

  function switchTab(tab) {
    return requireWorkspaceTemplateTools().switchTab(tab);
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); initMobileSidebar(); });
  } else {
    init();
    initMobileSidebar();
  }
})();


