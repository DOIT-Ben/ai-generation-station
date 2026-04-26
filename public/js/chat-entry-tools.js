(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsChatEntryTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getElement = settings.getElement || function () { return null; };
    const getConversationState = settings.getConversationState || function () { return { activeId: null, messages: [] }; };
    const getIsChatGenerating = settings.getIsChatGenerating || function () { return false; };
    const setIsChatGenerating = settings.setIsChatGenerating || function () {};
    const getChatQueue = settings.getChatQueue || function () { return []; };
    const pushChatQueue = settings.pushChatQueue || function () {};
    const getConversationMessageById = settings.getConversationMessageById || function () { return null; };
    const clearConversationTransientEntries = settings.clearConversationTransientEntries || function () {};
    const restoreChatMessages = settings.restoreChatMessages || function () {};
    const performChatSend = settings.performChatSend || (async function () {});
    const drainChatQueue = settings.drainChatQueue || (async function () {});
    const describeChatFailure = settings.describeChatFailure || function () { return { toast: '', tone: 'error' }; };
    const updateQueueIndicator = settings.updateQueueIndicator || function () {};
    const renderConversationMeta = settings.renderConversationMeta || function () {};
    const renderArchivedConversationList = settings.renderArchivedConversationList || function () {};
    const updateChatComposerState = settings.updateChatComposerState || function () {};
    const scheduleWorkspaceStateSave = settings.scheduleWorkspaceStateSave || function () {};
    const showToast = settings.showToast || function () {};

    async function retryTransientAssistantMessage(messageId) {
      const message = getConversationMessageById(messageId);
      const retryPayload = message?.retryPayload || null;
      if (!retryPayload) return;
      if (getIsChatGenerating()) {
        showToast('请等待当前回复完成后再重试。', 'info', 1800);
        return;
      }

      const conversationState = getConversationState();
      const conversationId = conversationState.activeId;
      if (conversationId) {
        clearConversationTransientEntries(conversationId);
        restoreChatMessages(conversationState.messages, { forceFollow: false });
      }

      setIsChatGenerating(true);
      renderConversationMeta();
      renderArchivedConversationList();

      try {
        await performChatSend(retryPayload.message, { rewriteMessageId: retryPayload.rewriteMessageId || '' });
        showToast('已重新发起这条回复', 'success', 1400);
      } catch (error) {
        const failure = describeChatFailure(error);
        showToast(failure.toast, failure.tone === 'warning' ? 'info' : 'error', 2200);
      } finally {
        setIsChatGenerating(false);
        updateQueueIndicator();
        renderConversationMeta();
        renderArchivedConversationList();
      }
    }

    async function sendChatMessage(forcedMessage) {
      const input = getElement('chat-input');
      const isDomEvent = forcedMessage && typeof forcedMessage === 'object' && (
        typeof forcedMessage.preventDefault === 'function' ||
        typeof forcedMessage.stopPropagation === 'function' ||
        Object.prototype.hasOwnProperty.call(forcedMessage, 'type')
      );
      const message = String(!isDomEvent && forcedMessage != null ? forcedMessage : input?.value || '').trim();
      if (!message) return;

      if (getIsChatGenerating()) {
        pushChatQueue(message);
        const queueLength = getChatQueue().length;
        updateQueueIndicator();
        showToast('消息已加入队列（还有 ' + queueLength + ' 条等待）', 'info', 1800);
        if (input) input.value = '';
        updateChatComposerState();
        scheduleWorkspaceStateSave();
        return;
      }

      setIsChatGenerating(true);
      renderConversationMeta();
      renderArchivedConversationList();
      if (input) input.value = '';
      updateChatComposerState();
      scheduleWorkspaceStateSave();

      try {
        await performChatSend(message);
        await drainChatQueue();
      } catch (error) {
        const failure = describeChatFailure(error);
        showToast(failure.toast, failure.tone === 'warning' ? 'info' : 'error', 2200);
      } finally {
        setIsChatGenerating(false);
        updateQueueIndicator();
        renderConversationMeta();
        renderArchivedConversationList();
        updateChatComposerState();
      }
    }

    return {
      retryTransientAssistantMessage: retryTransientAssistantMessage,
      sendChatMessage: sendChatMessage
    };
  }

  return {
    createTools: createTools
  };
}));
