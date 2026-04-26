(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsChatSendTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getElement = settings.getElement || function () { return null; };
    const queryOne = settings.queryOne || function () { return null; };
    const getChatQueue = settings.getChatQueue || function () { return []; };
    const shiftChatQueue = settings.shiftChatQueue || function () { return null; };
    const getChatHistory = settings.getChatHistory || function () { return []; };
    const getConversationState = settings.getConversationState || function () { return { activeId: null, messages: [] }; };
    const ensureActiveConversation = settings.ensureActiveConversation || (async function () { return null; });
    const getConversationMessageById = settings.getConversationMessageById || function () { return null; };
    const clearConversationTransientEntries = settings.clearConversationTransientEntries || function () {};
    const restoreChatMessages = settings.restoreChatMessages || function () {};
    const addChatMessage = settings.addChatMessage || function () {};
    const createThinkingMessage = settings.createThinkingMessage || function () { return null; };
    const updateChatComposerState = settings.updateChatComposerState || function () {};
    const setChatRequestStatus = settings.setChatRequestStatus || function () {};
    const apiFetch = settings.apiFetch || (async function () { return null; });
    const streamChatMessage = settings.streamChatMessage || (async function () { return {}; });
    const loadQuota = settings.loadQuota || function () {};
    const refreshUsageToday = settings.refreshUsageToday || function () {};
    const applyConversationPayload = settings.applyConversationPayload || function () {};
    const setChatMessageUiState = settings.setChatMessageUiState || function () {};
    const createFailedChatEntries = settings.createFailedChatEntries || function () { return { entries: [], toast: '', tone: 'error' }; };
    const setConversationTransientEntries = settings.setConversationTransientEntries || function () {};
    const getModel = settings.getModel || function () { return 'gpt-4.1-mini'; };
    const createAbortController = settings.createAbortController || function () { return new AbortController(); };
    const getActiveChatAbortController = settings.getActiveChatAbortController || function () { return null; };
    const setActiveChatAbortController = settings.setActiveChatAbortController || function () {};
    const getActiveChatRequestContext = settings.getActiveChatRequestContext || function () { return null; };
    const setActiveChatRequestContext = settings.setActiveChatRequestContext || function () {};

    function setChatLoading(loading) {
      const btn = getElement('btn-chat-send');
      const stopBtn = getElement('btn-chat-stop');
      const input = getElement('chat-input');
      const nextLoading = Boolean(loading);
      if (btn) {
        btn.classList.toggle('is-loading', nextLoading);
        btn.setAttribute('aria-busy', nextLoading ? 'true' : 'false');
      }
      if (stopBtn) {
        if (nextLoading) {
          stopBtn.removeAttribute('hidden');
          stopBtn.disabled = false;
        } else {
          stopBtn.setAttribute('hidden', '');
          stopBtn.disabled = true;
        }
      }
      if (input) {
        input.disabled = false;
      }
      updateChatComposerState();
    }

    function updateQueueIndicator() {
      const el = getElement('chat-queue-indicator');
      if (!el) return;
      const queueLength = getChatQueue().length;
      if (queueLength === 0) {
        el.setAttribute('hidden', '');
        el.textContent = '';
      } else {
        el.removeAttribute('hidden');
        el.textContent = '队列中 ' + queueLength + ' 条消息，当前回复完成后会自动继续发送。';
      }
      updateChatComposerState();
    }

    async function performChatSend(message, options) {
      const nextOptions = options || {};
      const previousHistory = getChatHistory().slice();
      const conversationId = await ensureActiveConversation();
      const conversationState = getConversationState();
      if (!conversationId) {
        throw new Error('会话创建失败');
      }

      const model = getModel();
      const rewriteMessageId = String(nextOptions.rewriteMessageId || '').trim();
      const rewriteTarget = rewriteMessageId ? getConversationMessageById(rewriteMessageId) : null;
      const rewriteTurnId = String((rewriteTarget && rewriteTarget.metadata && rewriteTarget.metadata.turnId) || '').trim();
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
      const abortController = createAbortController();
      setActiveChatAbortController(abortController);
      setActiveChatRequestContext({
        conversationId: conversationId,
        message: message,
        rewriteMessageId: rewriteMessageId
      });

      try {
        const response = await apiFetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: conversationId,
            message: message,
            rewriteMessageId: rewriteMessageId,
            model: model,
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
            ? ((data.messages.find(function (item) {
              return item.role === 'assistant' && String((item.metadata && item.metadata.turnId) || '') === rewriteTurnId;
            }) || {}).id || rewriteMessageId)
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
          conversationId: conversationId,
          message: message,
          rewriteMessageId: rewriteMessageId
        }, error);
        setConversationTransientEntries(conversationId, failureState.entries);
        if (getConversationState().activeId === conversationId) {
          const anchorMessageId = ((failureState.entries[failureState.entries.length - 1] || {}).id) || '';
          restoreChatMessages(previousHistory, {
            forceFollow: false,
            anchorMessageId: anchorMessageId,
            transientConversationId: conversationId,
            restoreTransient: false
          });
          failureState.entries.forEach(function (entry) {
            addChatMessage(entry.role === 'assistant' ? 'chatbot' : 'user', entry.content || '', {
              message: entry,
              insertAfterMessageId: entry.afterMessageId || '',
              forceFollow: false
            });
          });
          if (anchorMessageId && typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
            const container = getElement('chat-messages');
            const anchor = container ? container.querySelector('.chat-message[data-chat-message-id="' + CSS.escape(anchorMessageId) + '"]') : null;
            if (anchor && typeof anchor.scrollIntoView === 'function') {
              anchor.scrollIntoView({ block: 'nearest' });
            }
          }
        }
        throw error;
      } finally {
        if (getActiveChatAbortController() === abortController) {
          setActiveChatAbortController(null);
        }
        const activeContext = getActiveChatRequestContext();
        if (activeContext && activeContext.conversationId === conversationId) {
          setActiveChatRequestContext(null);
        }
        setChatLoading(false);
        setChatRequestStatus('');
      }
    }

    async function drainChatQueue() {
      while (getChatQueue().length > 0) {
        const next = shiftChatQueue();
        updateQueueIndicator();
        await performChatSend(next);
      }
    }

    function stopChatGeneration(isChatGenerating) {
      const generating = Boolean(isChatGenerating);
      const abortController = getActiveChatAbortController();
      if (!generating || !abortController) return;
      abortController.abort();
      setChatRequestStatus('正在停止当前回复…', 'warning');
    }

    async function sendChatMessageFromQueue(message) {
      if (!message) return;
      await performChatSend(message);
    }

    return {
      setChatLoading: setChatLoading,
      updateQueueIndicator: updateQueueIndicator,
      performChatSend: performChatSend,
      drainChatQueue: drainChatQueue,
      stopChatGeneration: stopChatGeneration,
      sendChatMessageFromQueue: sendChatMessageFromQueue
    };
  }

  return {
    createTools: createTools
  };
}));
