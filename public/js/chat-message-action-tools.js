(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsChatMessageActionTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getConversationState = settings.getConversationState || function () { return { activeId: null }; };
    const apiFetch = settings.apiFetch || (async function () { return { json: async () => ({}) }; });
    const applyConversationPayload = settings.applyConversationPayload || function () {};
    const getConversationMessageById = settings.getConversationMessageById || function () { return null; };
    const getIsChatGenerating = settings.getIsChatGenerating || function () { return false; };
    const setIsChatGenerating = settings.setIsChatGenerating || function () {};
    const setChatMessageUiState = settings.setChatMessageUiState || function () {};
    const renderConversationMeta = settings.renderConversationMeta || function () {};
    const renderArchivedConversationList = settings.renderArchivedConversationList || function () {};
    const performChatSend = settings.performChatSend || (async function () {});
    const describeChatFailure = settings.describeChatFailure || function () { return { toast: '操作失败', tone: 'error' }; };
    const updateQueueIndicator = settings.updateQueueIndicator || function () {};
    const writeClipboard = settings.writeClipboard || (async function () {});
    const showToast = settings.showToast || function () {};
    const setTimeoutFn = settings.setTimeoutFn || function (callback) { return callback(); };

    async function activateAssistantVersion(messageId) {
      const conversationId = getConversationState().activeId;
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

    function setActionButtonState(button, nextLabel, options = {}) {
      if (!button) {
        return () => {};
      }
      const defaultLabel = button.dataset.defaultLabel || button.textContent || '';
      const defaultDisabled = button.dataset.defaultDisabled || (button.disabled ? 'true' : 'false');
      button.dataset.defaultLabel = defaultLabel;
      button.dataset.defaultDisabled = defaultDisabled;
      button.textContent = nextLabel;
      if (options.tone) {
        button.dataset.feedbackTone = options.tone;
      } else {
        delete button.dataset.feedbackTone;
      }
      if (options.pending) {
        button.dataset.pending = 'true';
      } else {
        delete button.dataset.pending;
      }
      button.disabled = options.disabled !== undefined ? Boolean(options.disabled) : true;
      return () => {
        if (!button) return;
        button.textContent = button.dataset.defaultLabel || defaultLabel;
        button.disabled = (button.dataset.defaultDisabled || defaultDisabled) === 'true';
        delete button.dataset.feedbackTone;
        delete button.dataset.pending;
      };
    }

    async function rewriteAssistantMessage(messageId, triggerButton = null) {
      if (!messageId) return;
      if (getIsChatGenerating()) {
        showToast('请等待当前回复完成后再重写。', 'info', 1800);
        return;
      }

      const resetButtonState = setActionButtonState(triggerButton, '重写中…', {
        tone: 'info',
        pending: true,
        disabled: true
      });
      setIsChatGenerating(true);
      setChatMessageUiState(messageId, {
        label: '正在生成新的回复版本…',
        tone: 'info',
        renderNow: true
      });
      renderConversationMeta();
      renderArchivedConversationList();

      try {
        await performChatSend(undefined, { rewriteMessageId: messageId });
        resetButtonState();
        flashButtonFeedback(triggerButton, '已生成新版', 1600, 'success');
        showToast('已生成新的回复版本', 'success', 1400);
      } catch (error) {
        resetButtonState();
        setChatMessageUiState(messageId, {
          label: '重写失败，请稍后重试',
          tone: 'error',
          expiresInMs: 2200,
          renderNow: true
        });
        const failure = describeChatFailure(error);
        showToast(failure.toast, failure.tone === 'warning' ? 'info' : 'error', 2200);
      } finally {
        setIsChatGenerating(false);
        updateQueueIndicator();
        renderConversationMeta();
        renderArchivedConversationList();
      }
    }

    function flashButtonFeedback(button, nextLabel, timeoutMs = 1400, tone = 'success') {
      if (!button) return;
      const reset = setActionButtonState(button, nextLabel, {
        tone,
        disabled: true
      });
      setTimeoutFn(() => {
        reset();
      }, timeoutMs);
    }

    async function copyAssistantMessage(messageId, triggerButton = null) {
      const message = getConversationMessageById(messageId);
      if (!message?.content) return;
      await writeClipboard(message.content);
      flashButtonFeedback(triggerButton, '已复制');
      showToast('已复制回复内容', 'success', 1200);
    }

    async function copyCodeBlock(button) {
      const code = button?.closest('.chat-code-block')?.querySelector('code')?.textContent || '';
      if (!code) return;
      await writeClipboard(code);
      flashButtonFeedback(button, '已复制');
    }

    async function switchAssistantVersion(messageId, direction, triggerButton = null) {
      const message = getConversationMessageById(messageId);
      const versions = Array.isArray(message?.versions) ? message.versions : [];
      if (!versions.length) return;

      const activeIndex = Math.max(0, versions.findIndex(item => item.active));
      const nextIndex = direction === 'prev' ? activeIndex - 1 : activeIndex + 1;
      const nextVersion = versions[nextIndex];
      if (!nextVersion?.id) return;

      const resetButtonState = setActionButtonState(triggerButton, '切换中…', {
        tone: 'info',
        pending: true,
        disabled: true
      });

      try {
        await activateAssistantVersion(nextVersion.id);
        resetButtonState();
        flashButtonFeedback(triggerButton, direction === 'prev' ? '已切上一版' : '已切下一版', 1400, 'success');
        setChatMessageUiState(nextVersion.id, {
          label: `已切换到第 ${nextIndex + 1} 版`,
          tone: 'success',
          expiresInMs: 2200
        });
      } catch (error) {
        resetButtonState();
        setChatMessageUiState(messageId, {
          label: '版本切换失败，请重试',
          tone: 'error',
          expiresInMs: 2200,
          renderNow: true
        });
        throw error;
      }
    }

    return {
      activateAssistantVersion,
      setActionButtonState,
      rewriteAssistantMessage,
      flashButtonFeedback,
      copyAssistantMessage,
      copyCodeBlock,
      switchAssistantVersion
    };
  }

  return {
    createTools
  };
}));
