(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsWorkspaceStateTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getCurrentUser = settings.getCurrentUser || function () { return null; };
    const getWorkspaceStateReady = settings.getWorkspaceStateReady || function () { return false; };
    const getPersistence = settings.getPersistence || function () { return null; };
    const getWorkspaceState = settings.getWorkspaceState || function () { return {}; };
    const getTemplatePreferenceEnvelope = settings.getTemplatePreferenceEnvelope || function () { return {}; };
    const setTemplatePreferenceEnvelope = settings.setTemplatePreferenceEnvelope || function () {};
    const getUserPreferences = settings.getUserPreferences || function () { return {}; };
    const setUserPreferences = settings.setUserPreferences || function () {};
    const getCurrentTab = settings.getCurrentTab || function () { return 'chat'; };
    const getConversationActiveId = settings.getConversationActiveId || function () { return null; };
    const getElement = settings.getElement || function () { return null; };
    const queryAll = settings.queryAll || function () { return []; };
    const getFeatureFields = settings.getFeatureFields || function () { return {}; };
    const getTrackedWorkspaceInputIds = settings.getTrackedWorkspaceInputIds || function () { return []; };
    const getFieldInitialValues = settings.getFieldInitialValues || function () { return {}; };
    const getPreferenceBackedFieldDefaults = settings.getPreferenceBackedFieldDefaults || function () { return {}; };
    const getResultArea = settings.getResultArea || function () { return null; };
    const getCurrentResult = settings.getCurrentResult || function () { return {}; };
    const getResetMaps = settings.getResetMaps || function () { return {}; };
    const getFeatureInputs = settings.getFeatureInputs || function () { return {}; };
    const setFieldValue = settings.setFieldValue || function () {};
    const updateWorkspaceStateFromPreferences = settings.updateWorkspaceStateFromPreferences || function () {};
    const updateChatComposerState = settings.updateChatComposerState || function () {};
    const syncTranscriptionFilePreview = settings.syncTranscriptionFilePreview || function () {};
    const isProtectedSessionError = settings.isProtectedSessionError || function () { return false; };
    const showToast = settings.showToast || function () {};
    const clearTimeoutFn = settings.clearTimeoutFn || function () {};
    const setTimeoutFn = settings.setTimeoutFn || function (callback) { return callback(); };
    const getWorkspaceStateSaveTimer = settings.getWorkspaceStateSaveTimer || function () { return null; };
    const setWorkspaceStateSaveTimer = settings.setWorkspaceStateSaveTimer || function () {};

    function getWorkspaceStateDraft(feature) {
      const workspaceState = getWorkspaceState();
      const drafts = workspaceState?.drafts && typeof workspaceState.drafts === 'object'
        ? workspaceState.drafts
        : {};
      const draft = drafts[feature];
      return draft && typeof draft === 'object' ? draft : null;
    }

    function captureInitialFieldValues() {
      const fieldInitialValues = getFieldInitialValues();
      Array.from(getTrackedWorkspaceInputIds() || []).forEach(inputId => {
        const input = getElement(inputId);
        if (!input) return;
        if (Object.prototype.hasOwnProperty.call(fieldInitialValues, inputId)) return;
        fieldInitialValues[inputId] = input.value;
      });
    }

    function getFieldDefaultValue(inputId) {
      const preferenceBackedFieldDefaults = getPreferenceBackedFieldDefaults();
      const userPreferences = getUserPreferences();
      const fieldInitialValues = getFieldInitialValues();
      const preferenceKey = preferenceBackedFieldDefaults[inputId];
      if (preferenceKey) {
        return userPreferences[preferenceKey] != null ? String(userPreferences[preferenceKey]) : '';
      }
      return Object.prototype.hasOwnProperty.call(fieldInitialValues, inputId)
        ? String(fieldInitialValues[inputId] ?? '')
        : '';
    }

    function getVoiceSourceMode() {
      return queryAll('.voice-source-tabs .source-tab.active')?.[0]?.dataset.source === 'url' ? 'url' : 'file';
    }

    function applyVoiceSourceMode(sourceMode) {
      const nextSourceMode = sourceMode === 'url' ? 'url' : 'file';
      Array.from(queryAll('.voice-source-tabs .source-tab')).forEach(tab => {
        tab.classList.toggle('active', tab.dataset.source === nextSourceMode);
      });
      getElement('voice-source-file')?.toggleAttribute('hidden', nextSourceMode !== 'file');
      getElement('voice-source-url')?.toggleAttribute('hidden', nextSourceMode !== 'url');
    }

    function hasMeaningfulDraftValue(feature, key, value) {
      if (key === 'sourceMode') return false;
      const normalizedValue = String(value ?? '');
      if (!normalizedValue) return false;
      if (feature === 'chat' && key === 'message') return Boolean(normalizedValue.trim());

      const inputId = getFeatureFields()?.[feature]?.[key];
      const input = inputId ? getElement(inputId) : null;
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
        message: getElement('chat-input')?.value || ''
      };
      if (hasMeaningfulFeatureDraft('chat', chatDraft)) {
        drafts.chat = chatDraft;
      }

      Object.keys(getFeatureFields() || {}).forEach(feature => {
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

    async function persistWorkspaceState() {
      const persistence = getPersistence();
      if (!getCurrentUser() || !getWorkspaceStateReady() || !persistence?.savePreferences) return;
      const workspaceState = getWorkspaceState();
      workspaceState.lastTab = getCurrentTab();
      workspaceState.lastConversationId = getConversationActiveId() || workspaceState.lastConversationId || null;
      workspaceState.drafts = buildWorkspaceDraftSnapshot();
      workspaceState.lastSavedAt = Date.now();
      const nextEnvelope = {
        ...(getTemplatePreferenceEnvelope() || {}),
        workspace: workspaceState
      };
      setTemplatePreferenceEnvelope(nextEnvelope);

      const patch = {
        templatePreferencesJson: JSON.stringify(nextEnvelope)
      };
      setUserPreferences({
        ...getUserPreferences(),
        ...patch
      });

      try {
        const preferences = await persistence.savePreferences(patch);
        setUserPreferences({
          ...getUserPreferences(),
          ...(preferences || {})
        });
        updateWorkspaceStateFromPreferences(getUserPreferences());
      } catch (error) {
        if (isProtectedSessionError(error)) return;
        showToast('工作台续接状态保存失败', 'error', 1800);
      }
    }

    function scheduleWorkspaceStateSave() {
      if (!getCurrentUser() || !getWorkspaceStateReady()) return;
      clearTimeoutFn(getWorkspaceStateSaveTimer());
      setWorkspaceStateSaveTimer(setTimeoutFn(() => {
        persistWorkspaceState();
      }, 650));
    }

    function resetFieldToDefault(inputId) {
      if (inputId === 'voice-audio-file') {
        const fileInput = getElement('voice-audio-file');
        if (fileInput) fileInput.value = '';
        if (getElement('voice-file-name')) getElement('voice-file-name').textContent = '';
        return;
      }

      if (inputId === 'transcription-file') {
        const fileInput = getElement('transcription-file');
        if (fileInput) fileInput.value = '';
        syncTranscriptionFilePreview(null);
        return;
      }

      const input = getElement(inputId);
      if (!input) return;
      setFieldValue(inputId, getFieldDefaultValue(inputId));
    }

    function clearFeatureDraft(feature, options) {
      const nextOptions = options || {};
      if (feature === 'chat') {
        const input = getElement('chat-input');
        if (input) input.value = '';
        updateChatComposerState();
        scheduleWorkspaceStateSave();
        return;
      }

      (getResetMaps()?.[feature] || []).forEach(item => {
        const el = getElement(item.id);
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

      if (nextOptions.clearResult !== false) {
        getResultArea(feature)?.setAttribute('hidden', '');
        getElement(feature + '-generating')?.setAttribute('hidden', '');
        getCurrentResult()[feature] = null;
      }

      scheduleWorkspaceStateSave();
    }

    return {
      getWorkspaceStateDraft,
      captureInitialFieldValues,
      getFieldDefaultValue,
      getVoiceSourceMode,
      applyVoiceSourceMode,
      hasMeaningfulDraftValue,
      hasMeaningfulFeatureDraft,
      buildWorkspaceDraftSnapshot,
      persistWorkspaceState,
      scheduleWorkspaceStateSave,
      resetFieldToDefault,
      clearFeatureDraft
    };
  }

  return {
    createTools
  };
}));
