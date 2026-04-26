(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsConversationWorkflowTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getCurrentUser = settings.getCurrentUser || function () { return ''; };
    const getCurrentUserProfile = settings.getCurrentUserProfile || function () { return null; };
    const getChatWorkflowState = settings.getChatWorkflowState || function () { return { pinnedIds: [], parkedIds: [] }; };
    const setChatWorkflowState = settings.setChatWorkflowState || function () {};
    const getOpenConversationActionId = settings.getOpenConversationActionId || function () { return ''; };
    const setOpenConversationActionId = settings.setOpenConversationActionId || function () {};
    const getConversationManageMode = settings.getConversationManageMode || function () { return false; };
    const setConversationManageModeState = settings.setConversationManageModeState || function () {};
    const getChatArchivedCollapsed = settings.getChatArchivedCollapsed || function () { return false; };
    const setChatArchivedCollapsedState = settings.setChatArchivedCollapsedState || function () {};
    const getElement = settings.getElement || function () { return null; };
    const queryAll = settings.queryAll || function () { return []; };
    const safeParseJson = settings.safeParseJson || function (value, fallback) { return fallback; };
    const workflowStorageKeyPrefix = settings.workflowStorageKeyPrefix || 'aigs.chat.workflow';
    const archivedCollapsedKey = settings.archivedCollapsedKey || 'aigs.chat.archived.collapsed';
    const getLocalStorage = settings.getLocalStorage || function () { return null; };
    const renderConversationList = settings.renderConversationList || function () {};
    const renderConversationSidebarSummary = settings.renderConversationSidebarSummary || function () {};
    const renderArchivedConversationList = settings.renderArchivedConversationList || function () {};

    function createDefaultChatWorkflowState() {
      return {
        pinnedIds: [],
        parkedIds: []
      };
    }

    function normalizeChatWorkflowState(rawState) {
      const raw = rawState && typeof rawState === 'object' ? rawState : {};
      const pinnedIds = Array.from(new Set((Array.isArray(raw.pinnedIds) ? raw.pinnedIds : []).map(function (item) {
        return String(item || '').trim();
      }).filter(Boolean)));
      const parkedIds = Array.from(new Set((Array.isArray(raw.parkedIds) ? raw.parkedIds : []).map(function (item) {
        return String(item || '').trim();
      }).filter(Boolean))).filter(function (item) {
        return !pinnedIds.includes(item);
      });
      return {
        pinnedIds: pinnedIds,
        parkedIds: parkedIds
      };
    }

    function getChatWorkflowStorageKey() {
      const profile = getCurrentUserProfile();
      const identity = (profile && profile.id) || getCurrentUser() || 'guest';
      return workflowStorageKeyPrefix + '.' + encodeURIComponent(String(identity).trim().toLowerCase() || 'guest');
    }

    function readChatWorkflowStatePreference() {
      try {
        const storage = getLocalStorage();
        return normalizeChatWorkflowState(
          safeParseJson(storage ? storage.getItem(getChatWorkflowStorageKey()) : null, createDefaultChatWorkflowState())
        );
      } catch (_) {
        return createDefaultChatWorkflowState();
      }
    }

    function persistChatWorkflowState() {
      try {
        const storage = getLocalStorage();
        if (storage) {
          storage.setItem(getChatWorkflowStorageKey(), JSON.stringify(getChatWorkflowState()));
        }
      } catch (_) {
        // Ignore localStorage failures.
      }
    }

    function hydrateChatWorkflowState() {
      setChatWorkflowState(readChatWorkflowStatePreference());
    }

    function isConversationPinned(conversationId) {
      const targetId = String(conversationId || '').trim();
      return targetId ? getChatWorkflowState().pinnedIds.includes(targetId) : false;
    }

    function isConversationParked(conversationId) {
      const targetId = String(conversationId || '').trim();
      return targetId ? getChatWorkflowState().parkedIds.includes(targetId) : false;
    }

    function removeConversationFromWorkflowState(conversationId, options) {
      const nextOptions = options || {};
      const targetId = String(conversationId || '').trim();
      if (!targetId) return;
      const state = getChatWorkflowState();
      setChatWorkflowState({
        pinnedIds: state.pinnedIds.filter(function (item) { return item !== targetId; }),
        parkedIds: state.parkedIds.filter(function (item) { return item !== targetId; })
      });
      if (nextOptions.persist !== false) {
        persistChatWorkflowState();
      }
    }

    function toggleConversationWorkflowState(conversationId, mode) {
      const targetId = String(conversationId || '').trim();
      if (!targetId) return false;
      const isPinnedMode = mode === 'pinned';
      const collectionKey = isPinnedMode ? 'pinnedIds' : 'parkedIds';
      const oppositeKey = isPinnedMode ? 'parkedIds' : 'pinnedIds';
      const state = getChatWorkflowState();
      const currentCollection = state[collectionKey];
      const exists = currentCollection.includes(targetId);
      setChatWorkflowState({
        pinnedIds: state.pinnedIds,
        parkedIds: state.parkedIds,
        [oppositeKey]: state[oppositeKey].filter(function (item) { return item !== targetId; }),
        [collectionKey]: exists
          ? currentCollection.filter(function (item) { return item !== targetId; })
          : [targetId].concat(currentCollection.filter(function (item) { return item !== targetId; }))
      });
      persistChatWorkflowState();
      renderConversationList();
      return !exists;
    }

    function closeConversationActionMenu(options) {
      const nextOptions = options || {};
      if (!getOpenConversationActionId()) return;
      setOpenConversationActionId('');
      if (nextOptions.render !== false) {
        renderConversationList();
      }
    }

    function toggleConversationActionMenu(conversationId) {
      const targetId = String(conversationId || '').trim();
      if (!targetId) return false;
      const nextValue = getOpenConversationActionId() === targetId ? '' : targetId;
      setOpenConversationActionId(nextValue);
      renderConversationList();
      return nextValue === targetId;
    }

    function setConversationManageMode(nextMode, options) {
      const nextOptions = options || {};
      const nextValue = Boolean(nextMode);
      setConversationManageModeState(nextValue);
      setOpenConversationActionId('');
      const button = getElement('btn-chat-manage-conversations');
      if (button) {
        button.classList.toggle('is-active', nextValue);
        button.setAttribute('aria-pressed', nextValue ? 'true' : 'false');
        button.textContent = nextValue ? '完成' : '管理';
      }
      if (nextOptions.render !== false) {
        renderConversationList();
      }
    }

    function toggleConversationManageMode() {
      setConversationManageMode(!getConversationManageMode());
    }

    function readChatArchivedCollapsedPreference() {
      try {
        const storage = getLocalStorage();
        return storage ? storage.getItem(archivedCollapsedKey) === '1' : false;
      } catch (_) {
        return false;
      }
    }

    function persistChatArchivedCollapsedPreference(value) {
      try {
        const storage = getLocalStorage();
        if (storage) {
          storage.setItem(archivedCollapsedKey, value ? '1' : '0');
        }
      } catch (_) {
        // noop
      }
    }

    function syncChatArchivedSectionState() {
      const collapsed = getChatArchivedCollapsed();
      const section = getElement('chat-archived-section');
      if (section) {
        section.dataset.collapsed = collapsed ? 'true' : 'false';
      }
      Array.from(queryAll('[data-chat-archived-toggle]')).forEach(function (button) {
        if (button.classList.contains('chat-sidebar-tool')) {
          button.textContent = collapsed ? '展开归档' : '收起归档';
        } else {
          button.textContent = collapsed ? '展开' : '收起';
        }
        button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      });
    }

    function setChatArchivedCollapsed(nextValue) {
      const collapsed = Boolean(nextValue);
      setChatArchivedCollapsedState(collapsed);
      persistChatArchivedCollapsedPreference(collapsed);
      syncChatArchivedSectionState();
      renderConversationSidebarSummary();
      renderArchivedConversationList();
    }

    return {
      createDefaultChatWorkflowState: createDefaultChatWorkflowState,
      normalizeChatWorkflowState: normalizeChatWorkflowState,
      getChatWorkflowStorageKey: getChatWorkflowStorageKey,
      readChatWorkflowStatePreference: readChatWorkflowStatePreference,
      persistChatWorkflowState: persistChatWorkflowState,
      hydrateChatWorkflowState: hydrateChatWorkflowState,
      isConversationPinned: isConversationPinned,
      isConversationParked: isConversationParked,
      removeConversationFromWorkflowState: removeConversationFromWorkflowState,
      toggleConversationWorkflowState: toggleConversationWorkflowState,
      closeConversationActionMenu: closeConversationActionMenu,
      toggleConversationActionMenu: toggleConversationActionMenu,
      setConversationManageMode: setConversationManageMode,
      toggleConversationManageMode: toggleConversationManageMode,
      readChatArchivedCollapsedPreference: readChatArchivedCollapsedPreference,
      persistChatArchivedCollapsedPreference: persistChatArchivedCollapsedPreference,
      syncChatArchivedSectionState: syncChatArchivedSectionState,
      setChatArchivedCollapsed: setChatArchivedCollapsed
    };
  }

  return {
    createTools: createTools
  };
}));
