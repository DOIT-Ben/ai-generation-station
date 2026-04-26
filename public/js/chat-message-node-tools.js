(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsChatMessageNodeTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getElement = settings.getElement || function () { return null; };
    const queryOne = settings.queryOne || function () { return null; };
    const createElement = settings.createElement || function () { return null; };
    const escapeHtml = settings.escapeHtml || function (value) { return String(value || ''); };
    const formatChatMessageHtml = settings.formatChatMessageHtml || function (value) { return String(value || ''); };
    const buildChatMessageMeta = settings.buildChatMessageMeta || function () { return ''; };
    const isAssistantMessageCompact = settings.isAssistantMessageCompact || function () { return false; };
    const buildAssistantMessageCompactSummary = settings.buildAssistantMessageCompactSummary || function () { return null; };
    const annotateChatMessageHeadings = settings.annotateChatMessageHeadings || function () {};
    const getAssistantMessageStatus = settings.getAssistantMessageStatus || function () { return null; };
    const isMessageExcerpted = settings.isMessageExcerpted || function () { return false; };
    const getChatMessageUiState = settings.getChatMessageUiState || function () { return null; };
    const isLongAssistantMessage = settings.isLongAssistantMessage || function () { return false; };
    const followChatToBottom = settings.followChatToBottom || function () {};

    function buildChatAssistantActions(message) {
      if (!(message && message.id)) return '';
      const versions = Array.isArray(message.versions) ? message.versions : [];
      const versionCount = Math.max(Number(message.versionCount || 0), versions.length || 0);
      const activeVersionIndex = Math.max(1, Number(message.activeVersionIndex || versions.findIndex(function (item) {
        return item && item.active;
      }) + 1 || 1));
      const status = getAssistantMessageStatus(message);
      const canCopy = Boolean(String(message.content || '').trim());
      const canRetry = Boolean(message.transient && message.retryPayload);
      const isExcerpted = isMessageExcerpted(message.id);
      const isExpanded = Boolean((getChatMessageUiState(message.id) || {}).actionsExpanded);
      const canCompact = isLongAssistantMessage(message);
      const isCompact = isAssistantMessageCompact(message);
      const versionSummary = versionCount > 1
        ? '当前第 ' + activeVersionIndex + ' 版，共 ' + versionCount + ' 版，可随时切回上一版。'
        : '';

      return '\n      <div class="message-actions" data-expanded="' + (isExpanded ? 'true' : 'false') + '">\n        <div class="message-actions-head">\n          ' + (status ? '<div class="message-status-row"><span class="message-status-badge tone-' + escapeHtml(status.tone) + '">' + escapeHtml(status.label) + '</span></div>' : '<span class="message-status-spacer" aria-hidden="true"></span>') + '\n          <div class="message-actions-row">\n            ' + (canCompact ? '<button class="message-action-btn tone-secondary" type="button" data-chat-compact-toggle="' + escapeHtml(message.id) + '">' + (isCompact ? '展开全文' : '收起长文') + '</button>' : '') + '\n            ' + (canCopy ? '<button class="message-action-btn" type="button" data-chat-copy-id="' + escapeHtml(message.id) + '">复制全文</button>' : '') + '\n            ' + (canCopy ? '<button class="message-action-btn' + (isExcerpted ? ' tone-secondary' : '') + '" type="button" data-chat-excerpt-id="' + escapeHtml(message.id) + '">' + (isExcerpted ? '取消摘录' : '加入摘录') + '</button>' : '') + '\n            ' + (!message.transient ? '<button class="message-action-btn" type="button" data-chat-rewrite-id="' + escapeHtml(message.id) + '">换个版本</button>' : '') + '\n            ' + (canRetry ? '<button class="message-action-btn tone-retry" type="button" data-chat-retry-id="' + escapeHtml(message.id) + '">重试</button>' : '') + '\n            ' + (versionCount > 1 ? '\n              <button\n                class="message-action-btn tone-secondary"\n                type="button"\n                data-chat-message-actions-toggle="' + escapeHtml(message.id) + '"\n                data-collapsed-label="查看版本 ' + activeVersionIndex + '/' + versionCount + '"\n                data-expanded-label="收起版本"\n                aria-expanded="' + (isExpanded ? 'true' : 'false') + '">\n                ' + (isExpanded ? '收起版本' : '查看版本 ' + activeVersionIndex + '/' + versionCount) + '\n              </button>\n            ' : '') + '\n          </div>\n        </div>\n        ' + (versionCount > 1 ? '\n          <div class="message-version-panel" data-chat-message-panel ' + (isExpanded ? '' : 'hidden') + '>\n            <div class="message-version-summary">' + escapeHtml(versionSummary) + '</div>\n            <div class="message-version-switcher">\n              <button class="message-action-btn" type="button" data-chat-version-nav="prev" data-chat-message-id="' + escapeHtml(message.id) + '" ' + (activeVersionIndex <= 1 ? 'disabled' : '') + '>上一版</button>\n              <span class="message-version-label">版本 ' + activeVersionIndex + '/' + versionCount + '</span>\n              <button class="message-action-btn" type="button" data-chat-version-nav="next" data-chat-message-id="' + escapeHtml(message.id) + '" ' + (activeVersionIndex >= versionCount ? 'disabled' : '') + '>下一版</button>\n            </div>\n          </div>\n        ' : '') + '\n      </div>\n    ';
    }

    function insertChatMessageNode(container, node, insertAfterMessageId) {
      const nextInsertAfterMessageId = String(insertAfterMessageId || '').trim();
      if (!container || !node) return;
      const anchor = nextInsertAfterMessageId && typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? container.querySelector('.chat-message[data-chat-message-id="' + CSS.escape(nextInsertAfterMessageId) + '"]')
        : null;
      if (anchor && anchor.parentNode === container) {
        anchor.insertAdjacentElement('afterend', node);
        return;
      }
      container.appendChild(node);
    }

    function createThinkingMessage(options) {
      const nextOptions = options || {};
      const container = getElement('chat-messages');
      if (!container) return null;

      const msgDiv = createElement('div');
      if (!msgDiv) return null;
      msgDiv.className = 'chat-message chatbot is-thinking';
      msgDiv.innerHTML = '\n      <div class="message-avatar"><img src="/images/AG-logo.png" alt="AG Logo" class="message-avatar-logo" /></div>\n      <div class="message-content">\n        <div class="thinking-indicator" aria-live="polite">\n          <span class="thinking-label">正在思考</span>\n          <span class="thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span>\n        </div>\n      </div>\n    ';

      insertChatMessageNode(container, msgDiv, nextOptions.afterMessageId || '');
      followChatToBottom(!nextOptions.afterMessageId);
      return {
        msgDiv: msgDiv,
        contentWrap: msgDiv.querySelector('.message-content')
      };
    }

    function addChatMessage(role, content, options) {
      const nextOptions = typeof options === 'boolean' ? { isStreaming: options } : (options || {});
      const container = getElement('chat-messages');
      const chatContainer = queryOne('.chat-container');
      const avatar = role === 'user'
        ? '😀'
        : '<img src="/images/AG-logo.png" alt="AG Logo" class="message-avatar-logo" />';
      const msgDiv = createElement('div');
      const messageData = nextOptions.message && typeof nextOptions.message === 'object' ? nextOptions.message : null;
      const messageId = String((messageData && messageData.id) || nextOptions.messageId || '').trim();
      const contentClassName = nextOptions.rawHtml ? 'message-content is-panel' : 'message-content';
      const bodyClassName = nextOptions.rawHtml ? 'message-body is-panel-body' : 'message-body';

      if (!container || !msgDiv) return null;

      if (role === 'user' && chatContainer && !chatContainer.classList.contains('has-messages')) {
        chatContainer.classList.add('has-messages');
        getElement('tab-chat') && getElement('tab-chat').classList.add('has-messages');
      }

      msgDiv.className = 'chat-message ' + role;
      if (messageId) {
        msgDiv.dataset.chatMessageId = messageId;
      }

      if (nextOptions.message && nextOptions.message.transient) {
        msgDiv.classList.add('is-transient');
      }

      if (role === 'chatbot' && nextOptions.isStreaming) {
        const metaHtml = buildChatMessageMeta(messageData, role, nextOptions);
        msgDiv.innerHTML = '<div class="message-avatar">' + avatar + '</div><div class="message-content">' + metaHtml + '<div class="message-body streaming-content"></div></div>';
        insertChatMessageNode(container, msgDiv, nextOptions.insertAfterMessageId || '');
        followChatToBottom(nextOptions.forceFollow !== false);
        return { msgDiv: msgDiv, contentEl: msgDiv.querySelector('.streaming-content') };
      }

      const formattedContent = nextOptions.rawHtml || formatChatMessageHtml(content);
      const actionsHtml = role === 'chatbot' ? buildChatAssistantActions(messageData) : '';
      const metaHtml = nextOptions.rawHtml ? '' : buildChatMessageMeta(messageData, role, nextOptions);
      const compactSummary = role === 'chatbot' && messageData && isAssistantMessageCompact(messageData)
        ? buildAssistantMessageCompactSummary(messageData)
        : null;
      const compactSummaryHtml = compactSummary ? '\n      <div class="message-compact-summary">\n        <div class="message-compact-copy">\n          <strong>速览</strong>\n          <span>' + escapeHtml(compactSummary.preview || '这条回复较长，建议先看重点再展开全文。') + '</span>\n        </div>\n        ' + (compactSummary.headings.length ? '\n          <div class="message-compact-headings">\n            ' + compactSummary.headings.map(function (heading, index) {
              return '<span class="message-compact-heading">' + (index + 1) + '. ' + escapeHtml(heading) + '</span>';
            }).join('') + '\n          </div>\n        ' : '') + '\n      </div>\n    ' : '';
      const compactBodyClass = compactSummary ? bodyClassName + ' is-compact' : bodyClassName;
      msgDiv.innerHTML = '<div class="message-avatar">' + avatar + '</div><div class="' + contentClassName + '">' + metaHtml + compactSummaryHtml + '<div class="' + compactBodyClass + '">' + formattedContent + '</div>' + actionsHtml + '</div>';
      annotateChatMessageHeadings(msgDiv, messageId);
      insertChatMessageNode(container, msgDiv, nextOptions.insertAfterMessageId || '');
      followChatToBottom(nextOptions.forceFollow !== false);
      return null;
    }

    return {
      buildChatAssistantActions: buildChatAssistantActions,
      insertChatMessageNode: insertChatMessageNode,
      createThinkingMessage: createThinkingMessage,
      addChatMessage: addChatMessage
    };
  }

  return {
    createTools: createTools
  };
}));
