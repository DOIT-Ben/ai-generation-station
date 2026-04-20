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

  // ---- DOM helpers ----
  const $ = id => document.getElementById(id);
  const $$ = (sel, ctx) => (ctx || document).querySelectorAll(sel);
  const appShell = window.AppShell || null;
  const apiClient = appShell && window.fetch && appShell.createApiClient
    ? appShell.createApiClient(window.fetch.bind(window))
    : null;
  const apiFetch = apiClient?.fetch ? apiClient.fetch.bind(apiClient) : window.fetch.bind(window);
  const persistence = appShell && window.fetch ? appShell.createRemotePersistence(window.fetch.bind(window)) : null;
  const resolveApiAssetUrl = appShell?.resolveApiAssetUrl || (value => value);
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
  let userPreferences = {
    theme: 'dark',
    defaultModelChat: 'MiniMax-M2.7',
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
      lastSavedAt: null
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
      lastSavedAt: raw.lastSavedAt ? Number(raw.lastSavedAt) : null
    };
  }

  function updateWorkspaceStateFromPreferences(preferences = userPreferences) {
    templatePreferenceEnvelope = safeParseJson(preferences?.templatePreferencesJson, {}) || {};
    workspaceState = normalizeWorkspaceState(templatePreferenceEnvelope.workspace);
  }

  function getWorkspaceStateDraft(feature) {
    const drafts = workspaceState?.drafts && typeof workspaceState.drafts === 'object'
      ? workspaceState.drafts
      : {};
    const draft = drafts[feature];
    return draft && typeof draft === 'object' ? draft : null;
  }

  function captureInitialFieldValues() {
    TRACKED_WORKSPACE_INPUT_IDS.forEach(inputId => {
      const input = $(inputId);
      if (!input) return;
      if (Object.prototype.hasOwnProperty.call(fieldInitialValues, inputId)) return;
      fieldInitialValues[inputId] = input.value;
    });
  }

  function getFieldDefaultValue(inputId) {
    const preferenceKey = PREFERENCE_BACKED_FIELD_DEFAULTS[inputId];
    if (preferenceKey) {
      return userPreferences[preferenceKey] != null ? String(userPreferences[preferenceKey]) : '';
    }
    return Object.prototype.hasOwnProperty.call(fieldInitialValues, inputId)
      ? String(fieldInitialValues[inputId] ?? '')
      : '';
  }

  function getVoiceSourceMode() {
    return document.querySelector('.voice-source-tabs .source-tab.active')?.dataset.source === 'url' ? 'url' : 'file';
  }

  function applyVoiceSourceMode(sourceMode) {
    const nextSourceMode = sourceMode === 'url' ? 'url' : 'file';
    document.querySelectorAll('.voice-source-tabs .source-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.source === nextSourceMode);
    });
    $('voice-source-file')?.toggleAttribute('hidden', nextSourceMode !== 'file');
    $('voice-source-url')?.toggleAttribute('hidden', nextSourceMode !== 'url');
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
    const drafts = {};
    const chatDraft = {
      message: $('chat-input')?.value || ''
    };
    if (hasMeaningfulFeatureDraft('chat', chatDraft)) {
      drafts.chat = chatDraft;
    }

    Object.keys(FEATURE_FIELDS).forEach(feature => {
      const values = getFeatureInputs(feature);
      if (feature === 'covervoice') {
        values.sourceMode = getVoiceSourceMode();
      }
      if (hasMeaningfulFeatureDraft(feature, values)) {
        drafts[feature] = values;
      }
    });

    return drafts;
  }

  function formatRelativeSavedAt(timestamp) {
    if (!timestamp) return '尚未自动保存';
    return `最后自动保存：${formatTime(timestamp)}`;
  }

  function countMeaningfulDraftItems(feature, draft) {
    if (!draft || typeof draft !== 'object') return 0;
    return Object.entries(draft).filter(([key, value]) => hasMeaningfulDraftValue(feature, key, value)).length;
  }

  async function persistWorkspaceState() {
    if (!currentUser || !workspaceStateReady || !persistence?.savePreferences) return;
    workspaceState.lastTab = currentTab;
    workspaceState.lastConversationId = conversationState.activeId || workspaceState.lastConversationId || null;
    workspaceState.drafts = buildWorkspaceDraftSnapshot();
    workspaceState.lastSavedAt = Date.now();
    templatePreferenceEnvelope = {
      ...(templatePreferenceEnvelope || {}),
      workspace: workspaceState
    };
    const patch = {
      templatePreferencesJson: JSON.stringify(templatePreferenceEnvelope)
    };
    userPreferences = {
      ...userPreferences,
      ...patch
    };

    try {
      const preferences = await persistence.savePreferences(patch);
      userPreferences = {
        ...userPreferences,
        ...(preferences || {})
      };
      updateWorkspaceStateFromPreferences(userPreferences);
      renderWorkspaceResumeCard();
    } catch (error) {
      if (isProtectedSessionError(error)) return;
      showToast('工作台续接状态保存失败', 'error', 1800);
    }
  }

  function scheduleWorkspaceStateSave() {
    if (!currentUser || !workspaceStateReady) return;
    clearTimeout(workspaceStateSaveTimer);
    workspaceStateSaveTimer = setTimeout(() => {
      persistWorkspaceState();
    }, 650);
  }

  function renderWorkspaceResumeCard() {
    const card = $('workspace-resume-card');
    if (!card) return;

    if (!currentUser) {
      card.setAttribute('hidden', '');
      return;
    }

    const featureTitle = featureMeta[currentTab]?.title || 'AI 对话';
    const activeConversation = getActiveConversation();
    const liveDrafts = buildWorkspaceDraftSnapshot();
    const activeDraft = liveDrafts[currentTab === 'chat' ? 'chat' : currentTab] || null;
    const draftCount = countMeaningfulDraftItems(currentTab === 'chat' ? 'chat' : currentTab, activeDraft);
    const featureLine = $('workspace-resume-feature');
    const contextLine = $('workspace-resume-context');
    const metaLine = $('workspace-resume-meta');
    const clearButton = $('workspace-clear-draft');

    if (featureLine) featureLine.textContent = `当前页：${featureTitle}`;

    if (contextLine) {
      if (currentTab === 'chat' && activeConversation?.title) {
        contextLine.textContent = `最近会话：${truncateText(activeConversation.title, 28)}`;
      } else if (draftCount > 0) {
        contextLine.textContent = `已保存草稿：${draftCount} 项内容`;
      } else {
        contextLine.textContent = '当前页没有未完成草稿';
      }
    }

    if (metaLine) {
      if (currentTab === 'chat' && activeDraft?.message?.trim()) {
        metaLine.textContent = `${formatRelativeSavedAt(workspaceState.lastSavedAt)} · 未发送消息 ${activeDraft.message.trim().length} 字`;
      } else {
        metaLine.textContent = formatRelativeSavedAt(workspaceState.lastSavedAt);
      }
    }

    if (clearButton) {
      clearButton.disabled = draftCount === 0;
      clearButton.textContent = currentTab === 'chat' ? '清空未发送消息' : '清空当前草稿';
    }

    card.removeAttribute('hidden');
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
    renderWorkspaceResumeCard();
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
    if (typeof window === 'undefined') return null;
    const url = new URL(window.location.href);
    const inviteToken = String(url.searchParams.get('invite') || '').trim();
    if (inviteToken) {
      return { mode: 'invite', token: inviteToken };
    }
    const resetToken = String(url.searchParams.get('reset') || '').trim();
    if (resetToken) {
      return { mode: 'reset', token: resetToken };
    }
    return null;
  }

  function getCurrentAppPath() {
    const pathname = window.location.pathname || '/';
    const search = window.location.search || '';
    return `${pathname}${search}` || '/';
  }

  function buildAuthPagePath(nextPath = '/') {
    const url = new URL('/auth/', window.location.origin);
    if (nextPath) url.searchParams.set('next', nextPath);
    return `${url.pathname}${url.search}`;
  }

  function buildAccountPagePath(params = {}) {
    const url = new URL('/account/', window.location.origin);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value == null || value === '') return;
      url.searchParams.set(key, String(value));
    });
    return `${url.pathname}${url.search}`;
  }

  function applyUserPreferences() {
    setTheme(userPreferences.theme || 'dark');
    setFieldValue('chat-model', userPreferences.defaultModelChat || 'MiniMax-M2.7');
    setFieldValue('speech-voice', userPreferences.defaultVoice || 'male-qn-qingse');
    setFieldValue('music-style', userPreferences.defaultMusicStyle || '');
    setFieldValue('cover-ratio', userPreferences.defaultCoverRatio || '1:1');
  }

  async function loadUserPreferences() {
    if (!currentUser || !persistence?.getPreferences) return;
    try {
      const preferences = await persistence.getPreferences();
      userPreferences = {
        ...userPreferences,
        ...preferences
      };
      updateWorkspaceStateFromPreferences(userPreferences);
      applyUserPreferences();
    } catch (error) {
      if (isProtectedSessionError(error)) return;
      showToast('用户偏好加载失败，已使用默认设置', 'error', 1800);
    }
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
        renderWorkspaceResumeCard();
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
    if (!currentUser || !persistence?.getTemplates) {
      renderTemplateLibraries();
      return;
    }
    try {
      const features = Object.keys(featureMeta);
      const responses = await Promise.all(features.map(feature => persistence.getTemplates(feature)));
      const nextTemplates = {};
      responses.forEach((response, index) => {
        nextTemplates[features[index]] = response.groups || [];
      });
      templates = nextTemplates;
    } catch (error) {
      if (isProtectedSessionError(error)) return;
      templates = appShell?.TEMPLATE_LIBRARY || {};
      showToast('模板库加载失败，已使用本地模板', 'error', 1800);
    }
    renderTemplateLibraries();
  }

  function getPlanDisplayName(planCode) {
    if (planCode === 'internal') return '内部';
    if (planCode === 'pro') return 'Pro';
    if (planCode === 'free') return 'Free';
    return planCode || '未设置';
  }

  function renderUserPanel() {
    const panel = $('user-panel');
    if (!panel) return;
    if (!currentUser) {
      panel.innerHTML = '<a class="topbar-login-button" id="btn-open-auth" href="/auth/?next=%2F"><span>登录</span></a>';
      return;
    }
    const roleLabel = currentUserProfile?.role === 'admin' ? '管理员' : '成员';
    const planLabel = getPlanDisplayName(currentUserProfile?.planCode);
    const avatarLabel = String(currentUser || '?').trim().slice(0, 1).toUpperCase();
    const summaryLabel = currentUserProfile?.mustResetPassword
      ? '已登录 · 需先改密'
      : `已登录 · ${roleLabel} · ${planLabel}`;
    panel.innerHTML = `
      <div class="topbar-account">
        <div class="topbar-account-avatar">${avatarLabel}</div>
        <div class="topbar-account-copy">
          <strong>${currentUser}</strong>
          <span>${summaryLabel}</span>
        </div>
        <a href="/account/" class="topbar-account-action topbar-account-action--account"><span>个人中心</span></a>
        ${currentUserProfile?.role === 'admin' ? '<a href="/admin/" class="topbar-account-action"><span>后台</span></a>' : ''}
        <button id="btn-logout" class="topbar-account-action topbar-account-action--logout" type="button"><span>退出</span></button>
      </div>
    `;
    $('btn-logout')?.addEventListener('click', logout);
  }

  function resetAuthenticatedWorkspaceState() {
    currentUser = null;
    currentUserProfile = null;
    workspaceStateReady = false;
    workspaceState = createDefaultWorkspaceState();
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
    renderWorkspaceResumeCard();
  }

  function handleProtectedSessionLoss(message = '登录状态已失效，请重新登录') {
    if (authRecoveryLocked) return;
    authRecoveryLocked = true;
    resetAuthenticatedWorkspaceState();
    showToast(message, 'error', 1800);
    window.setTimeout(() => {
      window.location.href = buildAuthPagePath(getCurrentAppPath());
    }, 120);
    setTimeout(() => { authRecoveryLocked = false; }, 600);
  }

  function isProtectedSessionError(error) {
    const status = Number(error?.status || 0);
    return status === 401 || (status === 403 && error?.reason === 'password_reset_required');
  }

  function handlePasswordResetRequired(detail = {}) {
    if (detail.user) {
      currentUserProfile = {
        ...(currentUserProfile || {}),
        ...detail.user,
        mustResetPassword: true
      };
      currentUser = currentUserProfile.username || currentUser;
    } else if (currentUserProfile) {
      currentUserProfile = {
        ...currentUserProfile,
        mustResetPassword: true
      };
    }

    renderUserPanel();
    window.location.href = buildAccountPagePath({
      mode: 'reset-required',
      next: getCurrentAppPath()
    });
  }

  async function loadAuthenticatedWorkspaceData() {
    await loadUserPreferences();
    await refreshUsageToday();
    await loadTemplateLibraries();
    await loadConversations();
    await loadAllHistories();
    restoreWorkspaceDrafts();
    workspaceStateReady = true;
    renderWorkspaceResumeCard();
  }

  async function completeAuthenticatedBootstrap({ showWelcomeToast = false } = {}) {
    renderUserPanel();

    if (currentUserProfile?.mustResetPassword) {
      handlePasswordResetRequired({
        user: currentUserProfile,
        message: '请先修改临时密码后再继续使用'
      });
      return;
    }

    await loadAuthenticatedWorkspaceData();
    if (showWelcomeToast) {
      showToast(`欢迎回来，${currentUser}`, 'success', 1800);
    }
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
    renderUserPanel();
    const publicAuthIntent = getPublicAuthIntentFromUrl();
    if (publicAuthIntent?.mode && publicAuthIntent?.token) {
      const redirectUrl = new URL('/auth/', window.location.origin);
      redirectUrl.searchParams.set(publicAuthIntent.mode === 'invite' ? 'invite' : 'reset', publicAuthIntent.token);
      window.location.replace(`${redirectUrl.pathname}${redirectUrl.search}`);
      return;
    }
    let restoredSession = false;
    try {
      const session = await persistence?.loadSession();
      if (session?.username) {
        currentUserProfile = session;
        currentUser = session.username;
        restoredSession = true;
        await completeAuthenticatedBootstrap();
      }
    } catch {
      restoredSession = false;
    }

    if (!restoredSession) {
      window.location.replace(buildAuthPagePath(getCurrentAppPath()));
    }
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

  function getTemplateRawPreview(item = {}) {
    if (item.message) return String(item.message);
    if (item.values?.prompt) return String(item.values.prompt);
    if (item.values?.text) return String(item.values.text);
    return item.description ? String(item.description) : '';
  }

  function getTemplatePreviewSnippet(item = {}) {
    return truncateText(getTemplateRawPreview(item).replace(/\s+/g, ' ').trim(), 108) || '暂无模板预览';
  }

  function getTemplateSearchQuery(feature) {
    return String(templateSearchState[feature] || '').trim().toLowerCase();
  }

  function filterTemplateGroups(feature, groups = []) {
    const query = getTemplateSearchQuery(feature);
    const terms = query.split(/\s+/).filter(Boolean);
    return groups
      .map((group, groupIndex) => ({
        ...group,
        items: (group.items || [])
          .map((item, itemIndex) => ({
            ...item,
            originalGroupIndex: groupIndex,
            originalItemIndex: itemIndex
          }))
          .filter(item => {
            if (!terms.length) return true;
          const haystack = [
            group.category || '',
            item.label || '',
            item.description || '',
            getTemplateRawPreview(item)
          ].join(' ').toLowerCase();
          return terms.every(term => haystack.includes(term));
          })
      }))
      .filter(group => group.items.length > 0);
  }

  function renderTemplateLibraryStat(feature, totalGroups = [], visibleGroups = []) {
    const stat = $(`template-stat-${feature}`);
    if (!stat) return;
    const totalCount = (totalGroups || []).reduce((sum, group) => sum + (group.items?.length || 0), 0);
    const visibleCount = (visibleGroups || []).reduce((sum, group) => sum + (group.items?.length || 0), 0);
    const query = getTemplateSearchQuery(feature);
    stat.textContent = query
      ? `匹配 ${visibleCount} / ${totalCount} 个模板`
      : `共 ${totalCount} 个模板，覆盖常见工作场景`;
  }

  function renderTemplateLibraries() {
    Object.entries(templates).forEach(([feature, groups]) => {
      const container = $(`template-groups-${feature}`);
      if (!container) return;
      const filteredGroups = filterTemplateGroups(feature, groups);
      renderTemplateLibraryStat(feature, groups, filteredGroups);
      if (!groups.length) {
        container.innerHTML = '<div class="history-empty">当前还没有模板。</div>';
        return;
      }
      if (!filteredGroups.length) {
        container.innerHTML = '<div class="history-empty">没有匹配的模板，换个关键词试试。</div>';
        return;
      }
      container.innerHTML = filteredGroups.map(group => `
        <div class="template-category">
          <div class="template-category-header">
            <div class="template-category-title">${escapeHtml(group.category || '未分类')}</div>
            <div class="template-category-meta">${group.items.length} 个模板</div>
          </div>
          <div class="template-list">
            ${group.items.map(item => `
              <article class="template-item${item.favorite ? ' is-favorite' : ''}">
                <div class="template-item-meta">
                  <span>${item.source === 'user' ? '我的模板' : '系统模板'}</span>
                  ${item.id ? `<button type="button" class="template-favorite-btn" data-template-favorite="${feature}" data-template-id="${item.id}">${item.favorite ? '已收藏' : '收藏'}</button>` : ''}
                </div>
                <strong>${escapeHtml(item.label || '未命名模板')}</strong>
                <span class="template-item-description">${escapeHtml(item.description || '暂无描述')}</span>
                <p class="template-item-preview">${escapeHtml(getTemplatePreviewSnippet(item))}</p>
                <div class="template-item-footer">
                  <span class="template-item-stat">${Math.max(1, getTemplateRawPreview(item).replace(/\s+/g, '').length)} 字内容</span>
                  <div class="template-actions">
                    <button
                      type="button"
                      data-template-feature="${feature}"
                      data-template-group="${item.originalGroupIndex}"
                      data-template-item="${item.originalItemIndex}"
                      data-template-label="${escapeHtml(item.label || '未命名模板')}">
                    ${feature === 'chat' ? '一键发送' : '应用模板'}
                    </button>
                  </div>
                </div>
              </article>
            `).join('')}
          </div>
        </div>
      `).join('');
    });
  }

  function getTemplateDraft(feature) {
    const label = $(`template-label-${feature}`)?.value?.trim();
    const description = $(`template-desc-${feature}`)?.value?.trim() || '';
    if (!label) {
      return { error: '请先填写模板名称' };
    }

    if (feature === 'chat') {
      const message = $('chat-input')?.value?.trim();
      if (!message) {
        return { error: '当前对话输入为空，无法保存成模板' };
      }
      return { label, description, category: '我的模板', message };
    }

    const values = getFeatureInputs(feature);
    const hasContent = Object.values(values).some(value => String(value || '').trim());
    if (!hasContent) {
      return { error: '当前没有可保存的参数内容' };
    }

    return { label, description, category: '我的模板', values };
  }

  async function saveCurrentTemplate(feature) {
    if (!currentUser || !persistence?.createTemplate) {
      showToast('请先登录后再保存模板', 'error', 1600);
      return;
    }

    const draft = getTemplateDraft(feature);
    if (draft.error) {
      showToast(draft.error, 'error', 1600);
      return;
    }

    try {
      await persistence.createTemplate(feature, draft);
      if ($(`template-label-${feature}`)) $(`template-label-${feature}`).value = '';
      if ($(`template-desc-${feature}`)) $(`template-desc-${feature}`).value = '';
      await loadTemplateLibraries();
      showToast('模板已保存到你的账号', 'success', 1600);
    } catch (error) {
      if (isProtectedSessionError(error)) return;
      showToast(error.message || '模板保存失败', 'error', 1800);
    }
  }

  async function toggleTemplateFavoriteAction(feature, templateId) {
    if (!currentUser || !persistence?.toggleTemplateFavorite) {
      showToast('请先登录后再收藏模板', 'error', 1600);
      return;
    }

    try {
      const result = await persistence.toggleTemplateFavorite(feature, templateId);
      await loadTemplateLibraries();
      showToast(result.favorite ? '模板已加入收藏' : '模板已取消收藏', 'success', 1400);
    } catch (error) {
      if (isProtectedSessionError(error)) return;
      showToast(error.message || '模板收藏失败', 'error', 1800);
    }
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
    return conversation?.title || '新对话';
  }

  function getConversationPreview(conversation) {
    const preview = truncateText(conversation?.preview || conversation?.lastMessagePreview || '', 72);
    if (preview) return preview;
    if (Number(conversation?.messageCount || 0) <= 0) {
      return '还没有消息，适合开始一个新主题。';
    }
    return `${conversation?.messageCount || 0} 条消息 · ${conversation?.model || 'MiniMax-M2.7'}`;
  }

  function getConversationRowPillsMarkup(conversation) {
    const pills = [];
    if (conversation?.id === conversationState.activeId) {
      pills.push('<span class="chat-conversation-pill is-current">当前</span>');
    }
    if (Number(conversation?.messageCount || 0) <= 0) {
      pills.push('<span class="chat-conversation-pill">空白</span>');
    }
    return pills.join('');
  }

  function getConversationTimestamp(conversation) {
    return Number(conversation?.lastMessageAt || conversation?.updatedAt || conversation?.createdAt || 0);
  }

  function getConversationTimeLabel(conversation) {
    const timestamp = getConversationTimestamp(conversation);
    if (!timestamp) return '';
    return getDayBucketLabel(timestamp) === '今天'
      ? formatTimeOfDay(timestamp)
      : formatMonthDay(timestamp);
  }

  function groupConversationsByDay(items = []) {
    const groups = [];
    items.forEach(item => {
      const label = getDayBucketLabel(getConversationTimestamp(item));
      const currentGroup = groups[groups.length - 1];
      if (currentGroup && currentGroup.label === label) {
        currentGroup.items.push(item);
        return;
      }
      groups.push({
        label,
        items: [item]
      });
    });
    return groups;
  }

  function getConversationSortValue(conversation) {
    return Number(conversation?.lastMessageAt || conversation?.createdAt || 0);
  }

  function getArchivedConversationSortValue(conversation) {
    return Number(conversation?.archivedAt || conversation?.updatedAt || conversation?.lastMessageAt || conversation?.createdAt || 0);
  }

  function sortConversationSummaries(items = []) {
    return items.slice().sort((left, right) => {
      const primary = getConversationSortValue(right) - getConversationSortValue(left);
      if (primary !== 0) return primary;
      return Number(right?.updatedAt || 0) - Number(left?.updatedAt || 0);
    });
  }

  function sortArchivedConversationSummaries(items = []) {
    return items.slice().sort((left, right) => {
      const primary = getArchivedConversationSortValue(right) - getArchivedConversationSortValue(left);
      if (primary !== 0) return primary;
      return Number(right?.updatedAt || 0) - Number(left?.updatedAt || 0);
    });
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
    return conversationState.list.find(item => item.id === conversationState.activeId) || null;
  }

  function getConversationSearchQuery() {
    return String(conversationSearchQuery || '');
  }

  function getFilteredActiveConversations() {
    return filterConversationSummaries(conversationState.list, getConversationSearchQuery());
  }

  function getFilteredArchivedConversations() {
    return filterConversationSummaries(conversationState.archived, getConversationSearchQuery());
  }

  function updateConversationSearch(value, options = {}) {
    const nextValue = String(value || '');
    const searchInput = $('chat-conversation-search');
    conversationSearchQuery = nextValue;
    if (options.syncInput !== false && searchInput) {
      searchInput.value = nextValue;
    }
    if (options.render !== false) {
      renderConversationList();
    }
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
    if (conversation?.id) {
      conversationState.activeId = conversation.id;
      workspaceState.lastConversationId = conversation.id;
      upsertConversationSummary(conversation);
      setArchivedConversationList(conversationState.archived.filter(item => item.id !== conversation.id));
    }
    conversationState.messages = Array.isArray(messages) ? messages.slice() : [];
    chatHistory = conversationState.messages.map(item => ({
      ...item
    }));

    if (options.restoreMessages !== false) {
      restoreChatMessages(conversationState.messages, options.chatRestoreOptions || {});
    }
    renderConversationList();
    renderWorkspaceResumeCard();
    if (options.persist !== false) {
      scheduleWorkspaceStateSave();
    }
  }

  function _legacyRenderConversationMeta() {
    const title = $('chat-conversation-title');
    const subtitle = $('chat-conversation-subtitle');
    if (!title || !subtitle) return;

    const activeConversation = conversationState.list.find(item => item.id === conversationState.activeId) || null;
    if (!currentUser || !activeConversation) {
      title.textContent = '暂无进行中的对话';
      subtitle.textContent = '新建一个对话后即可开始聊天。';
      return;
    }

    title.textContent = getConversationTitlePreview(activeConversation);
    subtitle.textContent = `${activeConversation.messageCount || 0} 条消息 · ${activeConversation.model || 'MiniMax-M2.7'}`;
  }

  function renderConversationList() {
    const list = $('chat-conversation-list');
    const empty = $('chat-conversation-empty');
    if (!list || !empty) return;

    const totalConversations = conversationState.list.length;
    const filteredConversations = getFilteredActiveConversations();

    if (!currentUser || !totalConversations) {
      list.innerHTML = '';
      empty.textContent = '暂无对话。';
      empty.removeAttribute('hidden');
      renderConversationMeta();
      renderArchivedConversationList();
      return;
    }

    if (!filteredConversations.length) {
      list.innerHTML = '';
      empty.textContent = '没有匹配搜索条件的进行中会话。';
      empty.removeAttribute('hidden');
      renderConversationMeta();
      renderArchivedConversationList();
      return;
    }

    empty.setAttribute('hidden', '');
    const groups = groupConversationsByDay(filteredConversations);
    list.innerHTML = groups.map(group => `
      <section class="chat-conversation-group">
        <div class="chat-conversation-group-label">${group.label}</div>
        <div class="chat-conversation-group-list">
          ${group.items.map(item => `
            <article class="chat-conversation-row${item.id === conversationState.activeId ? ' is-active' : ''}">
              <button
                type="button"
                class="chat-conversation-item${item.id === conversationState.activeId ? ' active' : ''}"
                data-conversation-id="${item.id}">
                <div class="chat-conversation-item-top">
                  <strong>${escapeHtml(getConversationTitlePreview(item))}</strong>
                  <time>${escapeHtml(getConversationTimeLabel(item))}</time>
                </div>
                <p class="chat-conversation-preview">${escapeHtml(getConversationPreview(item))}</p>
                <div class="chat-conversation-meta">
                  <span>${item.messageCount || 0} 条消息</span>
                  <span>${escapeHtml(item.model || 'MiniMax-M2.7')}</span>
                </div>
                <div class="chat-conversation-flags">${getConversationRowPillsMarkup(item)}</div>
              </button>
              <div class="chat-conversation-inline-actions">
                <button
                  type="button"
                  class="chat-conversation-mini-action"
                  data-conversation-rename-id="${item.id}"
                  ${isChatGenerating ? 'disabled' : ''}>
                  改名
                </button>
                <button
                  type="button"
                  class="chat-conversation-mini-action is-danger"
                  data-conversation-archive-id="${item.id}"
                  ${isChatGenerating ? 'disabled' : ''}>
                  归档
                </button>
              </div>
            </article>
          `).join('')}
        </div>
      </section>
    `).join('');
    renderConversationMeta();
    renderArchivedConversationList();
  }

  function renderArchivedConversationList() {
    const section = $('chat-archived-section');
    const count = $('chat-archived-count');
    const empty = $('chat-archived-empty');
    const list = $('chat-archived-list');
    if (!section || !count || !empty || !list) return;

    const totalArchivedConversations = conversationState.archived.length;
    const filteredArchivedConversations = getFilteredArchivedConversations();

    if (!currentUser || !totalArchivedConversations) {
      section.setAttribute('hidden', '');
      count.textContent = '0';
      list.innerHTML = '';
      empty.textContent = '暂无已归档会话。';
      empty.removeAttribute('hidden');
      return;
    }

    section.removeAttribute('hidden');
    count.textContent = String(totalArchivedConversations);

    if (!filteredArchivedConversations.length) {
      list.innerHTML = '';
      empty.textContent = '没有匹配搜索条件的已归档会话。';
      empty.removeAttribute('hidden');
      return;
    }

    empty.setAttribute('hidden', '');
    list.innerHTML = filteredArchivedConversations.map(item => `
      <article class="chat-archived-item">
        <div class="chat-archived-copy">
          <div class="chat-conversation-item-top">
            <strong>${escapeHtml(getConversationTitlePreview(item))}</strong>
            <time>${escapeHtml(getConversationTimeLabel(item))}</time>
          </div>
          <p class="chat-conversation-preview">${escapeHtml(getConversationPreview(item))}</p>
          <span>${item.messageCount || 0} 条消息 · ${escapeHtml(item.model || 'MiniMax-M2.7')}</span>
        </div>
        <div class="chat-archived-actions">
          <button
            type="button"
            class="btn btn-secondary btn-chat-restore"
            data-restore-conversation-id="${item.id}"
            ${isChatGenerating ? 'disabled' : ''}>
            恢复
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-chat-delete"
            data-delete-conversation-id="${item.id}"
            ${isChatGenerating ? 'disabled' : ''}>
            删除
          </button>
        </div>
      </article>
    `).join('');
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
        model: $('chat-model')?.value || 'MiniMax-M2.7'
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
    const title = $('chat-conversation-title');
    const subtitle = $('chat-conversation-subtitle');
    const renameButton = $('btn-chat-rename-conversation');
    const archiveButton = $('btn-chat-archive-conversation');
    if (!title || !subtitle) return;

    const activeConversation = getActiveConversation();
    const disableManagement = !currentUser || !activeConversation || isChatGenerating;
    if (renameButton) renameButton.disabled = disableManagement;
    if (archiveButton) archiveButton.disabled = disableManagement;
    if (!currentUser || !activeConversation) {
      title.textContent = '暂无进行中的对话';
      subtitle.textContent = '新建一个对话后即可开始聊天。';
      return;
    }

    title.textContent = getConversationTitlePreview(activeConversation);
    subtitle.textContent = `${activeConversation.messageCount || 0} 条消息 · ${activeConversation.model || 'MiniMax-M2.7'} · ${getConversationPreview(activeConversation)}`;
  }

  async function selectConversation(conversationId) {
    if (!currentUser || !conversationId || !persistence?.getConversation) return;
    if (isChatGenerating) {
      showToast('请等待当前回复完成后再切换会话。', 'info', 1800);
      return;
    }
    try {
      const result = await persistence.getConversation(conversationId);
      if (!result?.conversation) return;
      applyConversationPayload(result.conversation, result.messages);
    } catch (error) {
      showToast(error.message || '会话加载失败', 'error', 1800);
    }
  }

  async function createConversationAndSelect() {
    if (!currentUser || !persistence?.createConversation) return null;
    try {
      const result = await persistence.createConversation({
        model: $('chat-model')?.value || 'MiniMax-M2.7'
      });
      if (!result?.conversation) return null;
      applyConversationPayload(result.conversation, result.messages);
      return result.conversation;
    } catch (error) {
      showToast(error.message || '会话创建失败', 'error', 1800);
      return null;
    }
  }

  async function startNewConversation() {
    if (isChatGenerating) {
      showToast('请等待当前回复完成后再新建对话。', 'info', 1800);
      return null;
    }
    return createConversationAndSelect();
  }

  async function ensureActiveConversation() {
    if (conversationState.activeId) return conversationState.activeId;
    const conversation = await createConversationAndSelect();
    return conversation?.id || null;
  }

  async function renameActiveConversation() {
    return renameConversationById(getActiveConversation()?.id);
  }

  async function renameConversationById(conversationId) {
    const targetConversation = conversationState.list.find(item => item.id === conversationId) || null;
    if (!currentUser || !targetConversation || !persistence?.updateConversation) return;
    if (isChatGenerating) {
      showToast('请等待当前回复完成后再重命名。', 'info', 1800);
      return;
    }

    const nextTitleRaw = typeof window !== 'undefined' && typeof window.prompt === 'function'
      ? window.prompt('重命名会话', getConversationTitlePreview(targetConversation))
      : null;
    if (nextTitleRaw == null) return;

    const nextTitle = String(nextTitleRaw).replace(/\s+/g, ' ').trim();
    if (!nextTitle) {
      showToast('会话标题不能为空。', 'error', 1800);
      return;
    }
    if (nextTitle === targetConversation.title) return;

    try {
      const result = await persistence.updateConversation(targetConversation.id, { title: nextTitle });
      const updatedConversation = result?.conversation || null;
      if (!updatedConversation?.id) return;
      upsertConversationSummary(updatedConversation);
      renderConversationList();
      showToast('会话已重命名', 'success', 1400);
    } catch (error) {
      showToast(error.message || '会话重命名失败', 'error', 1800);
    }
  }

  async function archiveActiveConversation() {
    const activeConversation = getActiveConversation();
    if (!activeConversation) return;
    return archiveConversationById(activeConversation.id, {
      confirmationMessage: `确认归档“${getConversationTitlePreview(activeConversation)}”吗？`
    });
  }

  async function archiveConversationById(conversationId, options = {}) {
    const targetConversation = conversationState.list.find(item => item.id === conversationId) || null;
    if (!currentUser || !targetConversation || !persistence?.archiveConversation) return;
    if (isChatGenerating) {
      showToast('请等待当前回复完成后再归档。', 'info', 1800);
      return;
    }

    const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm(
        options.confirmationMessage || `确认归档“${getConversationTitlePreview(targetConversation)}”吗？`
      )
      : true;
    if (!confirmed) return;

    try {
      const result = await persistence.archiveConversation(targetConversation.id);
      setConversationList(result?.conversations || conversationState.list.filter(item => item.id !== targetConversation.id));
      setArchivedConversationList(
        result?.archivedConversations || [result?.archivedConversation || targetConversation].filter(Boolean).concat(
          conversationState.archived.filter(item => item.id !== targetConversation.id)
        )
      );
      if (workspaceState.lastConversationId === targetConversation.id) {
        workspaceState.lastConversationId = null;
      }
      renderConversationList();
      if (conversationState.activeId === targetConversation.id) {
        conversationState.activeId = null;
        conversationState.messages = [];
        chatHistory = [];
        restoreChatMessages([]);

        const nextConversation = conversationState.list[0] || null;
        if (nextConversation?.id) {
          await selectConversation(nextConversation.id);
        } else {
          await createConversationAndSelect();
        }
      }

      renderWorkspaceResumeCard();
      scheduleWorkspaceStateSave();
      showToast('会话已归档', 'success', 1400);
    } catch (error) {
      if (isProtectedSessionError(error)) return;
      showToast(error.message || '会话归档失败', 'error', 1800);
    }
  }

  async function restoreArchivedConversation(conversationId) {
    if (!currentUser || !conversationId || !persistence?.restoreConversation) return;
    if (isChatGenerating) {
      showToast('请等待当前回复完成后再恢复。', 'info', 1800);
      return;
    }

    try {
      const result = await persistence.restoreConversation(conversationId);
      const restoredConversation = result?.conversation || null;
      if (!restoredConversation?.id) return;

      setConversationList(
        result?.conversations || [restoredConversation].concat(conversationState.list.filter(item => item.id !== restoredConversation.id))
      );
      setArchivedConversationList(
        result?.archivedConversations || conversationState.archived.filter(item => item.id !== restoredConversation.id)
      );
      renderConversationList();
      await selectConversation(restoredConversation.id);
      scheduleWorkspaceStateSave();
      showToast('会话已恢复', 'success', 1400);
    } catch (error) {
      if (isProtectedSessionError(error)) return;
      showToast(error.message || '会话恢复失败', 'error', 1800);
    }
  }

  async function deleteArchivedConversation(conversationId) {
    if (!currentUser || !conversationId || !persistence?.deleteArchivedConversation) return;
    if (isChatGenerating) {
      showToast('请等待当前回复完成后再删除。', 'info', 1800);
      return;
    }

    const conversation = conversationState.archived.find(item => item.id === conversationId) || null;
    const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm(`确认永久删除已归档会话“${getConversationTitlePreview(conversation)}”吗？`)
      : true;
    if (!confirmed) return;

    try {
      const result = await persistence.deleteArchivedConversation(conversationId);
      if (workspaceState.lastConversationId === conversationId) {
        workspaceState.lastConversationId = null;
      }
      setArchivedConversationList(
        result?.archivedConversations || conversationState.archived.filter(item => item.id !== conversationId)
      );
      renderConversationList();
      scheduleWorkspaceStateSave();
      showToast('已归档会话已删除', 'success', 1400);
    } catch (error) {
      if (isProtectedSessionError(error)) return;
      showToast(error.message || '会话删除失败', 'error', 1800);
    }
  }

  async function loadConversations() {
    if (!currentUser || !persistence?.getConversations) {
      setConversationList([]);
      setArchivedConversationList([]);
      conversationState.activeId = null;
      conversationState.messages = [];
      renderConversationList();
      return;
    }

    try {
      const [conversations, archivedConversations] = await Promise.all([
        persistence.getConversations(),
        persistence.listArchivedConversations ? persistence.listArchivedConversations() : Promise.resolve([])
      ]);
      setConversationList(conversations);
      setArchivedConversationList(archivedConversations);
    } catch (error) {
      if (isProtectedSessionError(error)) return;
      setConversationList([]);
      setArchivedConversationList([]);
    }

    if (!conversationState.list.length) {
      const created = await createConversationAndSelect();
      if (created) return;
    }

    const preferredConversation = conversationState.list.find(item => item.id === workspaceState.lastConversationId)
      || conversationState.list.find(item => item.id === conversationState.activeId)
      || conversationState.list[0];
    if (preferredConversation) {
      await selectConversation(preferredConversation.id);
    } else {
      chatHistory = [];
      restoreChatMessages([]);
      renderConversationList();
    }
  }

  function renderHistory(feature) {
    if (feature === 'chat') return;
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
      Object.keys(featureMeta).filter(feature => feature !== 'chat').forEach(feature => {
        historyState[feature] = [];
        renderHistory(feature);
      });
      return;
    }

    await Promise.all(Object.keys(featureMeta).filter(feature => feature !== 'chat').map(async feature => {
      try {
        historyState[feature] = await persistence.getHistory(currentUser, feature);
      } catch (error) {
        if (isProtectedSessionError(error)) return;
        historyState[feature] = [];
      }
      renderHistory(feature);
    }));
  }

  function saveHistoryEntry(feature, entry) {
    if (feature === 'chat') return;
    if (!currentUser || !persistence) return;
    historyState[feature] = [entry].concat(historyState[feature] || []).slice(0, appShell?.MAX_HISTORY_ITEMS || 12);
    renderHistory(feature);
    persistence.appendHistory(currentUser, feature, entry)
      .then(items => {
        historyState[feature] = items;
        renderHistory(feature);
      })
      .catch(() => {
        showToast(`${featureMeta[feature]?.title || feature} 历史保存失败`, 'error', 1800);
      });
  }

  function isChatNearBottom(container) {
    if (!container) return true;
    return (container.scrollHeight - container.scrollTop - container.clientHeight) <= 72;
  }

  function updateChatScrollButton() {
    const button = $('chat-scroll-to-latest');
    const container = $('chat-messages');
    if (!button || !container) return;
    if (chatScrollState.autoFollow || container.scrollHeight <= container.clientHeight + 12) {
      button.setAttribute('hidden', '');
      return;
    }
    button.removeAttribute('hidden');
  }

  function setChatAutoFollow(shouldFollow) {
    chatScrollState.autoFollow = Boolean(shouldFollow);
    updateChatScrollButton();
  }

  function followChatToBottom(force = false) {
    const container = $('chat-messages');
    if (!container) return;
    if (!force && !chatScrollState.autoFollow) {
      updateChatScrollButton();
      return;
    }
    container.scrollTop = container.scrollHeight;
    if (force) {
      setChatAutoFollow(true);
    } else {
      updateChatScrollButton();
    }
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
    if (!messageId) return null;
    return chatMessageUiState.get(messageId) || null;
  }

  function setChatMessageUiState(messageId, patch = {}) {
    if (!messageId) return;
    const nextState = {
      ...(chatMessageUiState.get(messageId) || {}),
      ...patch
    };
    chatMessageUiState.set(messageId, nextState);
    if (patch.expiresInMs) {
      window.setTimeout(() => {
        const currentState = chatMessageUiState.get(messageId);
        if (currentState !== nextState) return;
        chatMessageUiState.delete(messageId);
        if (conversationState.activeId) {
          restoreChatMessages(conversationState.messages, { forceFollow: false });
        }
      }, Number(patch.expiresInMs));
    }
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
    const container = $('chat-messages');
    const chatContainer = document.querySelector('.chat-container');
    const tabChat = $('tab-chat');
    if (!container) return;
    const transientConversationId = options.transientConversationId || conversationState.activeId;
    container.innerHTML = '';
    chatContainer?.classList.remove('has-messages');
    tabChat?.classList.remove('has-messages');
    if (!Array.isArray(messages) || messages.length === 0) {
      addChatMessage('chatbot', '你好！我是 AI 对话助手，有什么我可以帮你的吗？');
      chatHistory = [];
      if (options.forceFollow === false) {
        setChatAutoFollow(false);
        updateChatScrollButton();
      } else {
        setChatAutoFollow(true);
        followChatToBottom(true);
      }
      return;
    }
    chatHistory = messages.slice();
    messages.forEach(message => {
      addChatMessage(message.role === 'assistant' ? 'chatbot' : 'user', message.content || '', {
        message
      });
    });
    if (options.restoreTransient !== false) {
      getConversationTransientEntries(transientConversationId).forEach(message => {
        addChatMessage(message.role === 'assistant' ? 'chatbot' : 'user', message.content || '', {
          message,
          insertAfterMessageId: message.afterMessageId || '',
          forceFollow: false
        });
      });
    }
    if (options.forceFollow === false) {
      const anchorMessageId = String(options.anchorMessageId || '').trim();
      if (anchorMessageId) {
        const anchor = container.querySelector(`.chat-message[data-chat-message-id="${CSS.escape(anchorMessageId)}"]`);
        anchor?.scrollIntoView({ block: 'nearest' });
      }
      setChatAutoFollow(false);
      updateChatScrollButton();
      return;
    }
    followChatToBottom(true);
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
    const entry = historyState[feature]?.[index];
    if (!entry) return;
    switchTab(feature);
    if (feature === 'chat') {
      restoreChatMessages(entry.state?.messages || []);
      if (action === 'reuse') {
        $('chat-input')?.focus();
      }
      renderWorkspaceResumeCard();
      return;
    }
    applyFeatureInputs(feature, entry.state?.inputs || {});
    if (feature === 'covervoice' && entry.state?.inputs?.audio_url) {
      applyVoiceSourceMode('url');
    }
    if (entry.state?.result) {
      renderFeatureResult(feature, entry.state.result, entry.state.inputs || {});
    }
    scheduleWorkspaceStateSave();
    renderWorkspaceResumeCard();
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
      scheduleWorkspaceStateSave();
      renderWorkspaceResumeCard();
      sendChatMessage(template.message);
      return;
    }
    applyFeatureInputs(feature, template.values || {});
    if (feature === 'covervoice') {
      applyVoiceSourceMode('url');
    }
    scheduleWorkspaceStateSave();
    renderWorkspaceResumeCard();
    showToast(`${template.label} 模板已应用`, 'success', 1400);
  }

  function bindEnhancementEvents() {
    document.addEventListener('click', event => {
      const newConversationButton = event.target.closest('#btn-chat-new-conversation');
      if (newConversationButton) {
        startNewConversation();
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
      const inlineRenameConversationButton = event.target.closest('[data-conversation-rename-id]');
      if (inlineRenameConversationButton) {
        renameConversationById(inlineRenameConversationButton.dataset.conversationRenameId);
        return;
      }
      const inlineArchiveConversationButton = event.target.closest('[data-conversation-archive-id]');
      if (inlineArchiveConversationButton) {
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
      const rewriteMessageButton = event.target.closest('[data-chat-rewrite-id]');
      if (rewriteMessageButton) {
        rewriteAssistantMessage(rewriteMessageButton.dataset.chatRewriteId);
        return;
      }
      const versionNavButton = event.target.closest('[data-chat-version-nav]');
      if (versionNavButton) {
        switchAssistantVersion(versionNavButton.dataset.chatMessageId, versionNavButton.dataset.chatVersionNav)
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
      const clearDraftButton = event.target.closest('#workspace-clear-draft');
      if (clearDraftButton) {
        clearCurrentWorkspaceDraft();
        return;
      }
      const conversationButton = event.target.closest('[data-conversation-id]');
      if (conversationButton) {
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

      const inputId = event.target?.id;
      if (!TRACKED_WORKSPACE_INPUT_IDS.has(inputId)) return;
      renderWorkspaceResumeCard();
      scheduleWorkspaceStateSave();
    });

    document.addEventListener('change', event => {
      const inputId = event.target?.id;
      if (!TRACKED_WORKSPACE_INPUT_IDS.has(inputId)) return;
      renderWorkspaceResumeCard();
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

  function switchTab(tab) {
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));
    currentTab = tab;
    workspaceState.lastTab = tab;
    renderWorkspaceResumeCard();
    scheduleWorkspaceStateSave();
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
  function getStoredTheme() { return userPreferences.theme || 'dark'; }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    userPreferences.theme = theme;
    try {
      window.localStorage.setItem('aigs.theme', theme);
    } catch {
      // Ignore localStorage failures.
    }
    const btn = $('theme-toggle');
    if (btn) btn.setAttribute('data-tip', theme === 'light' ? '浅色模式' : '深色模式');
  }

  function toggleTheme() {
    const nextTheme = getStoredTheme() === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    schedulePreferenceSave({ theme: nextTheme });
  }

  function initTheme() {
    setTheme(getStoredTheme());
    $('theme-toggle')?.addEventListener('click', toggleTheme);
  }

  // ============================================
  //  Quota
  // ============================================
  let quotaLoading = false;
  const QUOTA_COLLAPSED_KEY = 'aigs.quota.collapsed';
  let quotaCollapsed = false;
  const MODEL_LABELS = {
    'MiniMax-M*': '通用对话', 'speech-hd': '语音合成',
    'music-2.5': '音乐生成', 'music-2.6': '音乐生成',
    'music-cover': '歌声翻唱', 'lyrics_generation': '歌词创作',
    'image-01': '封面生成', 'MiniMax-Hailuo-2.3-Fast-6s-768p': '视频生成',
    'MiniMax-Hailuo-2.3-6s-768p': '视频生成',
  };
  const LABEL_ORDER = ['通用对话', '音乐生成', '歌声翻唱', '歌词创作', '封面生成', '语音合成', '视频生成'];

  function getModelLabel(name) { return MODEL_LABELS[name] || name || '其他'; }

  function readQuotaCollapsedPreference() {
    try {
      return window.localStorage.getItem(QUOTA_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  }

  function persistQuotaCollapsedPreference(value) {
    try {
      window.localStorage.setItem(QUOTA_COLLAPSED_KEY, value ? '1' : '0');
    } catch {
      // noop
    }
  }

  function buildQuotaSummary(items = [], stateText = '') {
    if (stateText) return stateText;
    if (!Array.isArray(items) || items.length === 0) return '暂无可用额度数据';

    const totalModels = items.length;
    const highestUsageItem = items.reduce((selected, current) => {
      const selectedPct = selected?.current_interval_total_count > 0
        ? selected.current_interval_usage_count / selected.current_interval_total_count
        : -1;
      const currentPct = current?.current_interval_total_count > 0
        ? current.current_interval_usage_count / current.current_interval_total_count
        : -1;
      return currentPct > selectedPct ? current : selected;
    }, null);

    if (!highestUsageItem) {
      return `${totalModels} 项额度可用`;
    }

    const used = Number(highestUsageItem.current_interval_usage_count || 0);
    const total = Number(highestUsageItem.current_interval_total_count || 0);
    const pct = total > 0 ? Math.round((used / total) * 100) : 0;
    return `${totalModels} 项额度 · ${getModelLabel(highestUsageItem.model_name)} 已用 ${pct}%`;
  }

  function syncQuotaCardState() {
    const card = $('quota-info');
    const toggle = $('btn-quota-toggle');
    const label = toggle?.querySelector('.quota-toggle-label');
    if (!card || !toggle || !label) return;
    card.dataset.collapsed = quotaCollapsed ? 'true' : 'false';
    toggle.setAttribute('aria-expanded', quotaCollapsed ? 'false' : 'true');
    toggle.setAttribute('title', quotaCollapsed ? '展开额度详情' : '收起额度详情');
    label.textContent = quotaCollapsed ? '展开' : '收起';
  }

  function setQuotaCollapsed(nextValue) {
    quotaCollapsed = Boolean(nextValue);
    persistQuotaCollapsedPreference(quotaCollapsed);
    syncQuotaCardState();
  }

  function renderQuotaContent({ items = [], summaryText = '', bodyHtml = '' } = {}) {
    const summary = $('quota-summary');
    const body = $('quota-body');
    if (summary) {
      summary.textContent = buildQuotaSummary(items, summaryText);
    }
    if (body) {
      body.innerHTML = bodyHtml || '<div class="quota-loading">暂无可用额度数据</div>';
    }
    $('btn-quota-refresh')?.addEventListener('click', e => {
      e.stopPropagation();
      loadQuota();
    });
  }

  function bindQuotaToggle() {
    $('btn-quota-toggle')?.addEventListener('click', () => {
      setQuotaCollapsed(!quotaCollapsed);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  window.loadQuota = async function loadQuota() {
    if (quotaLoading) return;
    quotaLoading = true;

    try {
      const res = await apiFetch('/api/quota');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const models = data.model_remains || [];

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
          const ia = LABEL_ORDER.indexOf(getModelLabel(a.model_name));
          const ib = LABEL_ORDER.indexOf(getModelLabel(b.model_name));
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
      const res = await apiFetch(apiEndpoint, {
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
      refreshUsageToday();
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
      const res = await apiFetch('/api/generate/music', {
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
        const statusRes = await apiFetch('/api/music/status', {
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
      $('music-audio').src = resolveApiAssetUrl(statusData.audio_url || statusData.url || '');
      // 转换毫秒为秒显示
      const durationMs = parseInt(statusData.duration) || 0;
      const durationSec = (durationMs / 1000).toFixed(1);
      $('music-duration-info').textContent = durationMs > 0 ? `${durationSec}秒` : '';
      $('music-model-info').textContent = '模型: music-2.6';
      recordFeatureHistory('music', prompt, `${style || '默认风格'} · ${duration || '自动时长'}`, { prompt, style, bpm, key, duration }, {
        url: resolveApiAssetUrl(statusData.url || ''),
        duration: statusData.duration || 0
      });

      if (resultEl) {
        resultEl.removeAttribute('hidden');
        resultEl.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      }
      loadQuota();
      refreshUsageToday();
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

    apiFetch('/api/generate/cover', {
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
      apiFetch('/api/image/status', {
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
            img.src = resolveApiAssetUrl(data.url || '');
            img.onclick = () => openImageModal(img.src);
            $('cover-meta').textContent = data.model ? `模型: ${data.model}` : '';
            $('cover-result')?.removeAttribute('hidden');
            $('cover-result')?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
            loadQuota();
            refreshUsageToday();
            recordFeatureHistory('cover', inputs.prompt, `${inputs.style || '自动风格'} · ${inputs.ratio || '1:1'}`, inputs, {
              url: resolveApiAssetUrl(data.url),
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
      const uploadRes = await apiFetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, data: base64 }),
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.error || '文件上传失败');

      const audioUrl = resolveApiAssetUrl(uploadData.url);
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

      const res = await apiFetch('/api/generate/voice', {
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
        const statusRes = await apiFetch('/api/music-cover/status', {
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

      $('voice-audio').src = resolveApiAssetUrl(statusData.url || '');
      $('voice-meta').textContent = statusData.duration ? `时长: ${statusData.duration}s` : '';

      if (resultEl) { resultEl.removeAttribute('hidden'); resultEl.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }); }
      currentResult['covervoice'] = statusData;
      loadQuota();
      refreshUsageToday();
      recordFeatureHistory('covervoice', prompt, `${config.timbre || '自动音色'} · ${config.pitch || '原调'}`, {
        prompt,
        timbre: config.timbre,
        pitch: config.pitch,
        audio_url: audioUrl
      }, {
        url: resolveApiAssetUrl(statusData.url || ''),
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

      const res = await apiFetch('/api/generate/voice', {
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
        const statusRes = await apiFetch('/api/music-cover/status', {
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

      $('voice-audio').src = resolveApiAssetUrl(statusData.url || '');
      $('voice-meta').textContent = statusData.duration ? `时长: ${statusData.duration}s` : '';

      if (resultEl) { resultEl.removeAttribute('hidden'); resultEl.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }); }
      currentResult[resultTab] = statusData;
      loadQuota();
      refreshUsageToday();
      recordFeatureHistory('covervoice', prompt, `${config.timbre || '自动音色'} · ${config.pitch || '原调'}`, {
        prompt,
        timbre: config.timbre,
        pitch: config.pitch,
        audio_url: audioUrl
      }, {
        url: resolveApiAssetUrl(statusData.url || ''),
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
    speech:     [{ id: 'speech-text', tag: 'textarea' }, { id: 'speech-voice' }, { id: 'speech-emotion' }, { id: 'speech-speed' }, { id: 'speech-pitch' }, { id: 'speech-vol' }, { id: 'speech-format' }, { id: 'speech-char', val: '0' }]
  };

  function resetFieldToDefault(inputId) {
    if (inputId === 'voice-audio-file') {
      const fileInput = $('voice-audio-file');
      if (fileInput) fileInput.value = '';
      if ($('voice-file-name')) $('voice-file-name').textContent = '';
      return;
    }

    const input = $(inputId);
    if (!input) return;
    setFieldValue(inputId, getFieldDefaultValue(inputId));
  }

  function clearFeatureDraft(feature, { clearResult = true } = {}) {
    if (feature === 'chat') {
      const input = $('chat-input');
      if (input) input.value = '';
      renderWorkspaceResumeCard();
      scheduleWorkspaceStateSave();
      return;
    }

    (RESET_MAPS[feature] || []).forEach(item => {
      const el = $(item.id);
      if (!el) return;
      if (item.id === 'voice-audio-file') {
        resetFieldToDefault(item.id);
        return;
      }
      if (item.val !== undefined) {
        if (item.id.endsWith('-char')) {
          el.textContent = item.val;
          return;
        }
        resetFieldToDefault(item.id);
        return;
      }
      resetFieldToDefault(item.id);
    });

    if (feature === 'covervoice') {
      applyVoiceSourceMode('file');
    }

    if (clearResult) {
      getResultArea(feature)?.setAttribute('hidden', '');
      $(`${feature}-generating`)?.setAttribute('hidden', '');
      currentResult[feature] = null;
    }

    renderWorkspaceResumeCard();
    scheduleWorkspaceStateSave();
  }

  // file input 需要手动清空
  function resetTab(tab) {
    clearFeatureDraft(tab);
  }

  function clearCurrentWorkspaceDraft() {
    if (currentTab === 'chat') {
      clearFeatureDraft('chat', { clearResult: false });
      showToast('未发送消息已清空', 'success', 1400);
      return;
    }

    clearFeatureDraft(currentTab);
    showToast(`${featureMeta[currentTab]?.title || '当前页'}草稿已清空`, 'success', 1400);
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
    return String(value || '').replace(/\r\n/g, '\n');
  }

  function renderChatCodeBlock(language, code) {
    const langLabel = String(language || '').trim();
    return `
      <div class="chat-code-block">
        <div class="chat-code-header">
          <span>${langLabel || '代码'}</span>
          <button class="chat-code-copy" type="button">复制代码</button>
        </div>
        <pre><code>${code}</code></pre>
      </div>
    `;
  }

  function applyInlineMarkdown(text) {
    const sanitizeLinkUrl = (rawUrl) => {
      try {
        const parsed = new URL(rawUrl, window.location.origin);
        return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.href : '#';
      } catch {
        return '#';
      }
    };

    return text
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => `<a href="${sanitizeLinkUrl(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`)
      // Bold: **text** or __text__
      .replace(/\*\*(.+?)\*\*|__(.+?)__/g, '<strong>$1$2</strong>')
      // Italic: *text* or _text_
      .replace(/\*(.+?)\*|_(.+?)_/g, '<em>$1$2</em>')
      // Inline code: `text`
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Strikethrough: ~~text~~
      .replace(/~~(.+?)~~/g, '<del>$1</del>');
  }

  function formatChatMessageHtml(text) {
    const normalizedText = normalizeChatMarkdownText(text);
    const escapedText = escapeHtml(normalizedText);
    const codeBlocks = [];
    const placeholderPrefix = '__CHAT_CODE_BLOCK_';
    const withPlaceholders = escapedText.replace(/```([\w-]+)?\n?([\s\S]*?)```/g, (_, language, code) => {
      const placeholder = `${placeholderPrefix}${codeBlocks.length}__`;
      codeBlocks.push(renderChatCodeBlock(language, String(code || '').replace(/\n$/, '')));
      return placeholder;
    });

    const lines = withPlaceholders.split('\n');
    const blocks = [];
    let index = 0;

    const isSpecialBlockStart = line => {
      const trimmed = String(line || '').trim();
      return Boolean(
        trimmed.startsWith(placeholderPrefix) ||
        /^#{1,3}\s+/.test(trimmed) ||
        /^&gt;\s?/.test(trimmed) ||
        /^[-*]\s+/.test(trimmed) ||
        /^\d+\.\s+/.test(trimmed)
      );
    };

    while (index < lines.length) {
      const currentLine = lines[index];
      const trimmed = String(currentLine || '').trim();

      if (!trimmed) {
        index += 1;
        continue;
      }

      if (trimmed.startsWith(placeholderPrefix)) {
        blocks.push(trimmed);
        index += 1;
        continue;
      }

      const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        const level = Math.min(3, headingMatch[1].length);
        blocks.push(`<h${level}>${applyInlineMarkdown(headingMatch[2])}</h${level}>`);
        index += 1;
        continue;
      }

      if (/^&gt;\s?/.test(trimmed)) {
        const quoteLines = [];
        while (index < lines.length && /^&gt;\s?/.test(String(lines[index] || '').trim())) {
          quoteLines.push(String(lines[index] || '').trim().replace(/^&gt;\s?/, ''));
          index += 1;
        }
        blocks.push(`<blockquote>${quoteLines.map(line => applyInlineMarkdown(line)).join('<br>')}</blockquote>`);
        continue;
      }

      if (/^[-*]\s+/.test(trimmed)) {
        const items = [];
        while (index < lines.length && /^[-*]\s+/.test(String(lines[index] || '').trim())) {
          items.push(String(lines[index] || '').trim().replace(/^[-*]\s+/, ''));
          index += 1;
        }
        blocks.push(`<ul>${items.map(item => `<li>${applyInlineMarkdown(item)}</li>`).join('')}</ul>`);
        continue;
      }

      if (/^\d+\.\s+/.test(trimmed)) {
        const items = [];
        while (index < lines.length && /^\d+\.\s+/.test(String(lines[index] || '').trim())) {
          items.push(String(lines[index] || '').trim().replace(/^\d+\.\s+/, ''));
          index += 1;
        }
        blocks.push(`<ol>${items.map(item => `<li>${applyInlineMarkdown(item)}</li>`).join('')}</ol>`);
        continue;
      }

      const paragraphLines = [];
      while (index < lines.length) {
        const line = String(lines[index] || '');
        if (!line.trim()) break;
        if (paragraphLines.length > 0 && isSpecialBlockStart(line)) break;
        paragraphLines.push(line.trim());
        index += 1;
      }
      blocks.push(`<p>${paragraphLines.map(line => applyInlineMarkdown(line)).join('<br>')}</p>`);
    }

    let html = blocks.join('');
    codeBlocks.forEach((codeBlockHtml, codeIndex) => {
      html = html.replace(`${placeholderPrefix}${codeIndex}__`, codeBlockHtml);
    });
    return html || '<p></p>';
  }

  function getAssistantMessageStatus(message) {
    if (!message?.id) return null;

    const uiState = getChatMessageUiState(message.id);
    if (uiState?.label) {
      return {
        label: uiState.label,
        tone: uiState.tone || 'info'
      };
    }

    if (message.transient && message.statusText) {
      return {
        label: message.statusText,
        tone: message.statusTone || 'warning'
      };
    }

    const versions = Array.isArray(message.versions) ? message.versions : [];
    const versionCount = Math.max(Number(message.versionCount || 0), versions.length || 0);
    if (versionCount > 1) {
      const activeVersionIndex = Math.max(1, Number(message.activeVersionIndex || versions.findIndex(item => item.active) + 1 || 1));
      return {
        label: `当前显示第 ${activeVersionIndex} 版，共 ${versionCount} 版`,
        tone: 'neutral'
      };
    }

    return null;
  }

  function buildChatAssistantActions(message) {
    if (!message?.id) return '';
    const versions = Array.isArray(message.versions) ? message.versions : [];
    const versionCount = Math.max(Number(message.versionCount || 0), versions.length || 0);
    const activeVersionIndex = Math.max(1, Number(message.activeVersionIndex || versions.findIndex(item => item.active) + 1 || 1));
    const status = getAssistantMessageStatus(message);
    const canCopy = Boolean(String(message.content || '').trim());
    const canRetry = Boolean(message.transient && message.retryPayload);

    return `
      <div class="message-actions">
        ${status ? `<div class="message-status-row"><span class="message-status-badge tone-${escapeHtml(status.tone)}">${escapeHtml(status.label)}</span></div>` : ''}
        <div class="message-actions-row">
          ${canCopy ? `<button class="message-action-btn" type="button" data-chat-copy-id="${escapeHtml(message.id)}">复制</button>` : ''}
          ${!message.transient ? `<button class="message-action-btn" type="button" data-chat-rewrite-id="${escapeHtml(message.id)}">重写</button>` : ''}
          ${canRetry ? `<button class="message-action-btn tone-retry" type="button" data-chat-retry-id="${escapeHtml(message.id)}">重试</button>` : ''}
          ${versionCount > 1 ? `
            <div class="message-version-switcher">
              <button class="message-action-btn" type="button" data-chat-version-nav="prev" data-chat-message-id="${escapeHtml(message.id)}" ${activeVersionIndex <= 1 ? 'disabled' : ''}>上一版</button>
              <span class="message-version-label">版本 ${activeVersionIndex}/${versionCount}</span>
              <button class="message-action-btn" type="button" data-chat-version-nav="next" data-chat-message-id="${escapeHtml(message.id)}" ${activeVersionIndex >= versionCount ? 'disabled' : ''}>下一版</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function insertChatMessageNode(container, node, insertAfterMessageId = '') {
    if (!container || !node) return;
    const anchorMessageId = String(insertAfterMessageId || '').trim();
    const anchor = anchorMessageId
      ? container.querySelector(`.chat-message[data-chat-message-id="${CSS.escape(anchorMessageId)}"]`)
      : null;
    if (anchor?.parentNode === container) {
      anchor.insertAdjacentElement('afterend', node);
      return;
    }
    container.appendChild(node);
  }

  function createThinkingMessage(options = {}) {
    const container = $('chat-messages');
    if (!container) return null;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message chatbot is-thinking';
    msgDiv.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <div class="thinking-indicator" aria-live="polite">
          <span class="thinking-label">正在思考</span>
          <span class="thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        </div>
      </div>
    `;

    insertChatMessageNode(container, msgDiv, options.afterMessageId || '');
    followChatToBottom(!options.afterMessageId);
    return {
      msgDiv,
      contentWrap: msgDiv.querySelector('.message-content')
    };
  }

  function addChatMessage(role, content, options = {}) {
    const settings = typeof options === 'boolean' ? { isStreaming: options } : (options || {});
    const container = $('chat-messages');
    const chatContainer = document.querySelector('.chat-container');
    const avatar = role === 'user' ? '😀' : '🤖';
    const msgDiv = document.createElement('div');
    const messageData = settings.message && typeof settings.message === 'object' ? settings.message : null;
    const messageId = String(messageData?.id || settings.messageId || '').trim();

    if (role === 'user' && chatContainer && !chatContainer.classList.contains('has-messages')) {
      chatContainer.classList.add('has-messages');
      document.getElementById('tab-chat')?.classList.add('has-messages');
    }

    msgDiv.className = `chat-message ${role}`;
    if (messageId) {
      msgDiv.dataset.chatMessageId = messageId;
    }

    if (settings.message?.transient) {
      msgDiv.classList.add('is-transient');
    }

    if (role === 'chatbot' && settings.isStreaming) {
      msgDiv.innerHTML = `<div class="message-avatar">${avatar}</div><div class="message-content"><div class="message-body streaming-content"></div></div>`;
      insertChatMessageNode(container, msgDiv, settings.insertAfterMessageId || '');
      followChatToBottom(settings.forceFollow !== false);
      return { msgDiv, contentEl: msgDiv.querySelector('.streaming-content') };
    }

    const formattedContent = formatChatMessageHtml(content);
    const actionsHtml = role === 'chatbot' ? buildChatAssistantActions(messageData) : '';
    msgDiv.innerHTML = `<div class="message-avatar">${avatar}</div><div class="message-content"><div class="message-body">${formattedContent}</div>${actionsHtml}</div>`;
    insertChatMessageNode(container, msgDiv, settings.insertAfterMessageId || '');
    followChatToBottom(settings.forceFollow !== false);
    return null;
  }

  function parseSseBlock(block) {
    const lines = String(block || '').split(/\r?\n/);
    let eventName = 'message';
    const dataLines = [];
    lines.forEach(line => {
      if (!line) return;
      if (line.startsWith('event:')) {
        eventName = line.slice('event:'.length).trim() || 'message';
        return;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trimStart());
      }
    });
    return {
      eventName,
      dataText: dataLines.join('\n')
    };
  }

  async function streamChatMessage(response, pendingMessage = null) {
    if (!response?.ok) {
      let failurePayload = null;
      if (typeof response?.json === 'function') {
        failurePayload = await response.json().catch(() => null);
      }
      throw new Error(failurePayload?.error || `对话失败（${response?.status || 500}）`);
    }

    if (!response.body || typeof response.body.getReader !== 'function') {
      const data = await response.json();
      return {
        reply: String(data.reply || ''),
        conversation: data.conversation || null,
        messages: Array.isArray(data.messages) ? data.messages : null,
        usage: data.usage || null
      };
    }

    let contentEl = null;
    let msgDiv = null;
    if (pendingMessage?.contentWrap) {
      msgDiv = pendingMessage.msgDiv;
      pendingMessage.contentWrap.innerHTML = '<div class="message-body streaming-content"></div>';
      contentEl = pendingMessage.contentWrap.querySelector('.streaming-content');
      msgDiv.classList.remove('is-thinking');
    } else {
      ({ contentEl, msgDiv } = addChatMessage('chatbot', '', { isStreaming: true }));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let reply = '';
    let conversation = null;
    let messages = null;
    let usage = null;

    const applyStreamingText = () => {
      if (!contentEl) return;
      contentEl.textContent = reply;
      followChatToBottom(false);
    };

    const consumeBlock = (block) => {
      const { eventName, dataText } = parseSseBlock(block);
      if (!dataText || dataText === '[DONE]') return;

      let payload = null;
      try {
        payload = JSON.parse(dataText);
      } catch {
        payload = null;
      }

      if (eventName === 'error') {
        throw new Error(payload?.error || '对话流中断，请重试。');
      }

      if (eventName === 'conversation_state') {
        conversation = payload?.conversation || null;
        messages = Array.isArray(payload?.messages) ? payload.messages : null;
        usage = payload?.usage || null;
        if (payload?.reply != null) {
          reply = String(payload.reply || '');
          applyStreamingText();
        }
        return;
      }

      if (eventName === 'content_block_start') {
        const initialText = payload?.content_block?.type === 'text'
          ? String(payload.content_block?.text || '')
          : '';
        if (initialText) {
          reply += initialText;
          applyStreamingText();
        }
        return;
      }

      if (eventName === 'content_block_delta' && payload?.delta?.type === 'text_delta') {
        reply += String(payload.delta?.text || '');
        applyStreamingText();
        return;
      }

      if (eventName === 'done' && payload?.reply != null) {
        reply = String(payload.reply || '');
        applyStreamingText();
        return;
      }

      if (payload?.usage) {
        usage = payload.usage;
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, '\n');
        let boundaryIndex = buffer.indexOf('\n\n');
        while (boundaryIndex !== -1) {
          const block = buffer.slice(0, boundaryIndex);
          buffer = buffer.slice(boundaryIndex + 2);
          consumeBlock(block);
          boundaryIndex = buffer.indexOf('\n\n');
        }
      }
  
      buffer += decoder.decode();
      if (buffer.trim()) {
        consumeBlock(buffer);
      }
    } catch (error) {
      const wrappedError = error instanceof Error ? error : new Error('对话流中断，请重试。');
      wrappedError.partialReply = reply;
      if (error?.name === 'AbortError') {
        wrappedError.name = 'AbortError';
        wrappedError.isAbort = true;
      }
      throw wrappedError;
    }

    if (contentEl) {
      contentEl.innerHTML = formatChatMessageHtml(reply || '');
      contentEl.classList.remove('streaming-content');
    }
    followChatToBottom(false);

    return {
      reply,
      conversation,
      messages,
      usage
    };
  }

  function setChatLoading(loading) {
    const btn = $('btn-chat-send');
    const stopBtn = $('btn-chat-stop');
    const input = $('chat-input');
    if (btn) btn.disabled = false;
    btn?.classList.toggle('is-loading', Boolean(loading));
    btn?.setAttribute('aria-busy', loading ? 'true' : 'false');
    if (stopBtn) {
      if (loading) {
        stopBtn.removeAttribute('hidden');
        stopBtn.disabled = false;
      } else {
        stopBtn.setAttribute('hidden', '');
        stopBtn.disabled = true;
      }
    }
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

  function describeChatFailure(error) {
    if (error?.isAbort || error?.name === 'AbortError') {
      return {
        tone: 'warning',
        toast: '已停止当前回复',
        statusText: String(error?.partialReply || '').trim()
          ? '已停止生成，保留到当前进度，可直接重试。'
          : '已停止生成，可直接重试。'
      };
    }
    return {
      tone: 'error',
      toast: error?.message || '对话失败，请重试。',
      statusText: String(error?.partialReply || '').trim()
        ? '回复中断，已保留当前内容，可直接重试。'
        : (error?.message || '对话失败，请重试。')
    };
  }

  function createFailedChatEntries(context = {}, error) {
    const failure = describeChatFailure(error);
    const entries = [];
    const userMessageText = String(context.message || '').trim();
    const assistantContent = String(error?.partialReply || '').trim();

    if (!context.rewriteMessageId && userMessageText) {
      entries.push({
        id: buildTransientMessageId('chat-user'),
        role: 'user',
        content: userMessageText,
        transient: true
      });
    }

    entries.push({
      id: buildTransientMessageId('chat-assistant'),
      role: 'assistant',
      content: assistantContent,
      transient: true,
      afterMessageId: context.rewriteMessageId || '',
      statusText: failure.statusText,
      statusTone: failure.tone,
      retryPayload: {
        message: context.message,
        rewriteMessageId: context.rewriteMessageId || ''
      }
    });

    return {
      entries,
      toast: failure.toast,
      tone: failure.tone
    };
  }

  async function performChatSend(message, options = {}) {
    const previousHistory = chatHistory.slice();
    const conversationId = await ensureActiveConversation();
    if (!conversationId) {
      throw new Error('会话创建失败');
    }

    const model = $('chat-model')?.value || 'MiniMax-M2.7';
    const rewriteMessageId = String(options.rewriteMessageId || '').trim();
    const rewriteTarget = rewriteMessageId ? getConversationMessageById(rewriteMessageId) : null;
    const rewriteTurnId = String(rewriteTarget?.metadata?.turnId || '').trim();
    clearConversationTransientEntries(conversationId);
    if (conversationState.activeId === conversationId) {
      restoreChatMessages(conversationState.messages, {
        forceFollow: !rewriteMessageId
      });
    }
    if (!rewriteMessageId) {
      addChatMessage('user', message, { forceFollow: true });
    }

    const thinkingMessage = createThinkingMessage(rewriteMessageId ? { afterMessageId: rewriteMessageId } : {});
    setChatLoading(true);
    setChatRequestStatus(rewriteMessageId ? '正在重写回复，可随时停止。' : '正在流式回复，可继续输入下一条或点击停止。', 'info');
    const abortController = new AbortController();
    activeChatAbortController = abortController;
    activeChatRequestContext = {
      conversationId,
      message,
      rewriteMessageId
    };

    try {
      const response = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message,
          rewriteMessageId,
          model,
          stream: true
        }),
        signal: abortController.signal
      });

      const data = await streamChatMessage(response, thinkingMessage);
      if (!data.reply && !data.conversation && !Array.isArray(data.messages)) {
        throw new Error('对话结果为空，请重试。');
      }

      loadQuota();
      refreshUsageToday();
      if (data.conversation && Array.isArray(data.messages)) {
        const rewriteAnchorId = rewriteTurnId
          ? (data.messages.find(item => item.role === 'assistant' && String(item.metadata?.turnId || '') === rewriteTurnId)?.id || rewriteMessageId)
          : '';
        applyConversationPayload(data.conversation, data.messages, {
          chatRestoreOptions: rewriteMessageId
            ? { forceFollow: false, anchorMessageId: rewriteAnchorId }
            : { forceFollow: true }
        });
        if (rewriteAnchorId && rewriteMessageId) {
          setChatMessageUiState(rewriteAnchorId, {
            label: '已生成新的回复版本',
            tone: 'success',
            expiresInMs: 2200
          });
        }
      }
      return data;
    } catch (error) {
      const failureState = createFailedChatEntries({
        conversationId,
        message,
        rewriteMessageId
      }, error);
      setConversationTransientEntries(conversationId, failureState.entries);
      if (conversationState.activeId === conversationId) {
        const anchorMessageId = failureState.entries[failureState.entries.length - 1]?.id || '';
        restoreChatMessages(previousHistory, {
          forceFollow: false,
          anchorMessageId,
          transientConversationId: conversationId,
          restoreTransient: false
        });
        failureState.entries.forEach(message => {
          addChatMessage(message.role === 'assistant' ? 'chatbot' : 'user', message.content || '', {
            message,
            insertAfterMessageId: message.afterMessageId || '',
            forceFollow: false
          });
        });
        if (anchorMessageId) {
          const container = $('chat-messages');
          const anchor = container?.querySelector(`.chat-message[data-chat-message-id="${CSS.escape(anchorMessageId)}"]`);
          anchor?.scrollIntoView({ block: 'nearest' });
        }
      }
      throw error;
    } finally {
      if (activeChatAbortController === abortController) {
        activeChatAbortController = null;
      }
      if (activeChatRequestContext?.conversationId === conversationId) {
        activeChatRequestContext = null;
      }
      setChatLoading(false);
      setChatRequestStatus('');
    }
  }

  async function drainChatQueue() {
    while (chatQueue.length > 0) {
      const next = chatQueue.shift();
      updateQueueIndicator();
      await performChatSend(next);
    }
  }

  function stopChatGeneration() {
    if (!isChatGenerating || !activeChatAbortController) return;
    activeChatAbortController.abort();
    setChatRequestStatus('正在停止当前回复…', 'warning');
  }

  async function retryTransientAssistantMessage(messageId) {
    const message = getConversationMessageById(messageId);
    const retryPayload = message?.retryPayload || null;
    if (!retryPayload) return;
    if (isChatGenerating) {
      showToast('请等待当前回复完成后再重试。', 'info', 1800);
      return;
    }

    const conversationId = conversationState.activeId;
    if (conversationId) {
      clearConversationTransientEntries(conversationId);
      restoreChatMessages(conversationState.messages, { forceFollow: false });
    }

    isChatGenerating = true;
    renderConversationMeta();
    renderArchivedConversationList();

    try {
      await performChatSend(retryPayload.message, { rewriteMessageId: retryPayload.rewriteMessageId || '' });
      showToast('已重新发起这条回复', 'success', 1400);
    } catch (error) {
      const failure = describeChatFailure(error);
      showToast(failure.toast, failure.tone === 'warning' ? 'info' : 'error', 2200);
    } finally {
      isChatGenerating = false;
      updateQueueIndicator();
      renderConversationMeta();
      renderArchivedConversationList();
    }
  }

  async function sendChatMessage(forcedMessage) {
    const input = $('chat-input');
    const isDomEvent = forcedMessage && typeof forcedMessage === 'object' && (
      typeof forcedMessage.preventDefault === 'function' ||
      typeof forcedMessage.stopPropagation === 'function' ||
      Object.prototype.hasOwnProperty.call(forcedMessage, 'type')
    );
    const message = String(!isDomEvent && forcedMessage != null ? forcedMessage : input?.value || '').trim();
    if (!message) return;

    if (isChatGenerating) {
      chatQueue.push(message);
      updateQueueIndicator();
      showToast(`消息已加入队列（还有 ${chatQueue.length} 条等待）`, 'info', 1800);
      if (input) input.value = '';
      renderWorkspaceResumeCard();
      scheduleWorkspaceStateSave();
      return;
    }

    isChatGenerating = true;
    renderConversationMeta();
    renderArchivedConversationList();
    if (input) input.value = '';
    renderWorkspaceResumeCard();
    scheduleWorkspaceStateSave();

    try {
      await performChatSend(message);
      await drainChatQueue();
    } catch (error) {
      const failure = describeChatFailure(error);
      showToast(failure.toast, failure.tone === 'warning' ? 'info' : 'error', 2200);
    } finally {
      isChatGenerating = false;
      updateQueueIndicator();
      renderConversationMeta();
      renderArchivedConversationList();
    }
  }

  async function sendChatMessageFromQueue(message) {
    if (!message) return;
    await performChatSend(message);
  }

  async function activateAssistantVersion(messageId) {
    const conversationId = conversationState.activeId;
    if (!conversationId || !messageId) return;

    const res = await apiFetch(`/api/conversations/${conversationId}/messages/${messageId}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (data.error) {
      throw new Error(data.error);
    }
    applyConversationPayload(data.conversation, data.messages, {
      chatRestoreOptions: {
        forceFollow: false,
        anchorMessageId: messageId
      }
    });
  }

  async function rewriteAssistantMessage(messageId) {
    if (!messageId) return;
    if (isChatGenerating) {
      showToast('请等待当前回复完成后再重写。', 'info', 1800);
      return;
    }

    isChatGenerating = true;
    renderConversationMeta();
    renderArchivedConversationList();

    try {
      await performChatSend(undefined, { rewriteMessageId: messageId });
      showToast('已生成新的回复版本', 'success', 1400);
    } catch (error) {
      const failure = describeChatFailure(error);
      showToast(failure.toast, failure.tone === 'warning' ? 'info' : 'error', 2200);
    } finally {
      isChatGenerating = false;
      updateQueueIndicator();
      renderConversationMeta();
      renderArchivedConversationList();
    }
  }

  function flashButtonFeedback(button, nextLabel, timeoutMs = 1400) {
    if (!button) return;
    const defaultLabel = button.dataset.defaultLabel || button.textContent || '';
    button.dataset.defaultLabel = defaultLabel;
    button.textContent = nextLabel;
    button.disabled = true;
    window.setTimeout(() => {
      button.textContent = button.dataset.defaultLabel || defaultLabel;
      button.disabled = false;
    }, timeoutMs);
  }

  async function copyAssistantMessage(messageId, triggerButton = null) {
    const message = getConversationMessageById(messageId);
    if (!message?.content) return;
    await navigator.clipboard.writeText(message.content);
    flashButtonFeedback(triggerButton, '已复制');
    showToast('已复制回复内容', 'success', 1200);
  }

  async function copyCodeBlock(button) {
    const code = button?.closest('.chat-code-block')?.querySelector('code')?.textContent || '';
    if (!code) return;
    await navigator.clipboard.writeText(code);
    flashButtonFeedback(button, '已复制');
  }

  async function switchAssistantVersion(messageId, direction) {
    const message = getConversationMessageById(messageId);
    const versions = Array.isArray(message?.versions) ? message.versions : [];
    if (!versions.length) return;

    const activeIndex = Math.max(0, versions.findIndex(item => item.active));
    const nextIndex = direction === 'prev' ? activeIndex - 1 : activeIndex + 1;
    const nextVersion = versions[nextIndex];
    if (!nextVersion?.id) return;

    await activateAssistantVersion(nextVersion.id);
    setChatMessageUiState(nextVersion.id, {
      label: `已切换到第 ${nextIndex + 1} 版`,
      tone: 'success',
      expiresInMs: 2200
    });
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
        const res = await apiFetch('/api/tts', {
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
          if (audio) audio.src = resolveApiAssetUrl(data.url);
          const info = $('speech-info');
          if (info) info.textContent = `音频时长: ${data.extra?.audio_length || '?'}s | 消耗字符: ${data.extra?.usage_characters || text.length}`;
          currentResult.speech = { url: resolveApiAssetUrl(data.url), info: info?.textContent || '' };
          recordFeatureHistory('speech', text, `${$('speech-voice')?.value || ''} · ${$('speech-emotion')?.value || ''}`, {
            text,
            voice_id: $('speech-voice')?.value,
            emotion: $('speech-emotion')?.value,
            speed: $('speech-speed')?.value,
            pitch: $('speech-pitch')?.value,
            vol: $('speech-vol')?.value,
            output_format: $('speech-format')?.value
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
    window.addEventListener('app-auth-expired', event => {
      const message = event?.detail?.message || '登录状态已失效，请重新登录';
      handleProtectedSessionLoss(message);
    });
    window.addEventListener('app-password-reset-required', event => {
      handlePasswordResetRequired(event?.detail || {});
    });
    ensureFeatureExtensions();
    renderTemplateLibraries();
    bindEnhancementEvents();
    initTabs();
    initTheme();
    captureInitialFieldValues();
    bootstrapAuth();
    $('chat-messages')?.addEventListener('scroll', () => {
      setChatAutoFollow(isChatNearBottom($('chat-messages')));
    });
    updateChatScrollButton();

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
      renderWorkspaceResumeCard();
    });

    // 歌声翻唱来源 Tab 切换
    document.querySelectorAll('.voice-source-tabs .source-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        applyVoiceSourceMode(tab.dataset.source);
        renderWorkspaceResumeCard();
        scheduleWorkspaceStateSave();
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
          applyVoiceSourceMode('file');
          renderWorkspaceResumeCard();
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
      if (el) {
        el.value = lyrics;
        $('music-char').textContent = lyrics.length;
      }
      renderWorkspaceResumeCard();
      scheduleWorkspaceStateSave();
      showToast('歌词已导入到音乐生成', 'success');
    });

    // Image modal
    $('modal-close')?.addEventListener('click', closeImageModal);
    $('image-modal')?.addEventListener('click', e => { if (e.target === $('image-modal')) closeImageModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeImageModal(); });

    // Quota
    quotaCollapsed = readQuotaCollapsedPreference();
    syncQuotaCardState();
    bindQuotaToggle();
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
    $('btn-chat-stop')?.addEventListener('click', stopChatGeneration);
    $('chat-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); sendChatMessage(); }
    });

    // Custom dropdown for chat model
    initCustomDropdown('chat-model-dropdown', 'chat-model');

    // Convert all config selects to custom dropdowns
    convertAllSelectsToCustomDropdowns();

    $('chat-model')?.addEventListener('change', () => {
      schedulePreferenceSave({ defaultModelChat: $('chat-model')?.value || 'MiniMax-M2.7' });
    });
    $('speech-voice')?.addEventListener('change', () => {
      schedulePreferenceSave({ defaultVoice: $('speech-voice')?.value || 'male-qn-qingse' });
    });
    $('music-style')?.addEventListener('change', () => {
      schedulePreferenceSave({ defaultMusicStyle: $('music-style')?.value || '' });
    });
    $('cover-ratio')?.addEventListener('change', () => {
      schedulePreferenceSave({ defaultCoverRatio: $('cover-ratio')?.value || '1:1' });
    });
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
    workspaceState.lastTab = tab;
    renderWorkspaceResumeCard();
    scheduleWorkspaceStateSave();
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); initMobileSidebar(); });
  } else {
    init();
    initMobileSidebar();
  }
})();
