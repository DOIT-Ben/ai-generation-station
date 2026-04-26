(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsWorkspaceConversationTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getCurrentUser = settings.getCurrentUser || function () { return null; };
    const getPersistence = settings.getPersistence || function () { return null; };
    const getConversationState = settings.getConversationState || function () { return { list: [], archived: [], activeId: null, messages: [] }; };
    const getWorkspaceState = settings.getWorkspaceState || function () { return { lastConversationId: null }; };
    const setArchivedConversationList = settings.setArchivedConversationList || function () {};
    const setConversationActiveId = settings.setConversationActiveId || function () {};
    const setConversationMessages = settings.setConversationMessages || function () {};
    const setChatHistory = settings.setChatHistory || function () {};
    const restoreChatMessages = settings.restoreChatMessages || function () {};
    const upsertConversationSummary = settings.upsertConversationSummary || function () {};
    const renderConversationList = settings.renderConversationList || function () {};
    const renderChatExperienceState = settings.renderChatExperienceState || function () {};
    const renderChatContextStrip = settings.renderChatContextStrip || function () {};
    const renderChatExcerptShelf = settings.renderChatExcerptShelf || function () {};
    const renderChatSuggestionStrip = settings.renderChatSuggestionStrip || function () {};
    const scheduleWorkspaceStateSave = settings.scheduleWorkspaceStateSave || function () {};
    const getActiveConversation = settings.getActiveConversation || function () { return null; };
    const getConversationTitlePreview = settings.getConversationTitlePreview || function () { return '新对话'; };
    const getConversationPreview = settings.getConversationPreview || function () { return ''; };
    const getActiveConversationLastActivityLabel = settings.getActiveConversationLastActivityLabel || function () { return ''; };
    const getChatModel = settings.getChatModel || function () { return 'gpt-4.1-mini'; };
    const getIsChatGenerating = settings.getIsChatGenerating || function () { return false; };
    const showToast = settings.showToast || function () {};
    const getElement = settings.getElement || function () { return null; };

    function applyConversationPayload(conversation, messages, options) {
      const nextOptions = options || {};
      const conversationState = getConversationState();
      const workspaceState = getWorkspaceState();
      if (conversation && conversation.id) {
        setConversationActiveId(conversation.id);
        workspaceState.lastConversationId = conversation.id;
        upsertConversationSummary(conversation);
        setArchivedConversationList(conversationState.archived.filter(function (item) {
          return item.id !== conversation.id;
        }));
      }

      const safeMessages = Array.isArray(messages) ? messages.slice() : [];
      setConversationMessages(safeMessages);
      setChatHistory(safeMessages.map(function (item) {
        return { ...item };
      }));

      if (nextOptions.restoreMessages !== false) {
        restoreChatMessages(safeMessages, nextOptions.chatRestoreOptions || {});
      }
      renderConversationList();
      renderChatExcerptShelf();
      if (nextOptions.persist !== false) {
        scheduleWorkspaceStateSave();
      }
    }

    function renderConversationMeta() {
      const title = getElement('chat-conversation-title');
      const subtitle = getElement('chat-conversation-subtitle');
      if (!title || !subtitle) return;

      const activeConversation = getActiveConversation();
      if (!getCurrentUser() || !activeConversation) {
        title.textContent = '暂无进行中的对话';
        subtitle.textContent = '新建一个对话后即可开始聊天。';
        renderChatExperienceState();
        renderChatContextStrip();
        renderChatExcerptShelf();
        renderChatSuggestionStrip();
        return;
      }

      title.textContent = getConversationTitlePreview(activeConversation);
      subtitle.textContent = Number(activeConversation.messageCount || 0) <= 0
        ? String(getActiveConversationLastActivityLabel(activeConversation) || '')
        : String(getActiveConversationLastActivityLabel(activeConversation) || '') + ' · ' + getConversationPreview(activeConversation);
      renderChatExperienceState();
      renderChatContextStrip();
      renderChatExcerptShelf();
      renderChatSuggestionStrip();
    }

    async function createConversationAndSelect() {
      const persistence = getPersistence();
      if (!getCurrentUser() || !persistence?.createConversation) return null;
      try {
        const result = await persistence.createConversation({
          model: getChatModel()
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
      if (getIsChatGenerating()) {
        showToast('请等待当前回复完成后再新建对话。', 'info', 1800);
        return null;
      }
      return createConversationAndSelect();
    }

    async function ensureActiveConversation() {
      const conversationState = getConversationState();
      if (conversationState.activeId) return conversationState.activeId;
      const conversation = await createConversationAndSelect();
      return conversation && conversation.id ? conversation.id : null;
    }

    return {
      applyConversationPayload: applyConversationPayload,
      renderConversationMeta: renderConversationMeta,
      createConversationAndSelect: createConversationAndSelect,
      startNewConversation: startNewConversation,
      ensureActiveConversation: ensureActiveConversation
    };
  }

  return {
    createTools: createTools
  };
}));
