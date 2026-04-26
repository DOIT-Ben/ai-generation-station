(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsChatFailureTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const buildTransientMessageId = settings.buildTransientMessageId || function (prefix) {
      return String(prefix || 'chat-temp');
    };

    function describeChatFailure(error) {
      if ((error && error.isAbort) || (error && error.name === 'AbortError')) {
        return {
          tone: 'warning',
          toast: '已停止当前回复',
          statusText: String((error && error.partialReply) || '').trim()
            ? '已停止生成，保留到当前进度，可直接重试。'
            : '已停止生成，可直接重试。'
        };
      }
      return {
        tone: 'error',
        toast: (error && error.message) || '对话失败，请重试。',
        statusText: String((error && error.partialReply) || '').trim()
          ? '回复中断，已保留当前内容，可直接重试。'
          : ((error && error.message) || '对话失败，请重试。')
      };
    }

    function createFailedChatEntries(context, error) {
      const nextContext = context || {};
      const failure = describeChatFailure(error);
      const entries = [];
      const userMessageText = String(nextContext.message || '').trim();
      const assistantContent = String((error && error.partialReply) || '').trim();

      if (!nextContext.rewriteMessageId && userMessageText) {
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
        afterMessageId: nextContext.rewriteMessageId || '',
        statusText: failure.statusText,
        statusTone: failure.tone,
        retryPayload: {
          message: nextContext.message,
          rewriteMessageId: nextContext.rewriteMessageId || ''
        }
      });

      return {
        entries: entries,
        toast: failure.toast,
        tone: failure.tone
      };
    }

    return {
      describeChatFailure: describeChatFailure,
      createFailedChatEntries: createFailedChatEntries
    };
  }

  return {
    createTools: createTools
  };
}));
