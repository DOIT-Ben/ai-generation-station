(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsChatMessageMetaTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getChatMessageUiState = settings.getChatMessageUiState || function () { return null; };
    const formatChatRelativeTime = settings.formatChatRelativeTime || function () { return ''; };
    const escapeHtml = settings.escapeHtml || function (value) { return String(value || ''); };

    function getAssistantMessageStatus(message) {
      if (!message || !message.id) return null;

      const uiState = getChatMessageUiState(message.id);
      if (uiState && uiState.label) {
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
        const activeVersionIndex = Math.max(1, Number(message.activeVersionIndex || versions.findIndex(function (item) {
          return item && item.active;
        }) + 1 || 1));
        return {
          label: '当前显示第 ' + activeVersionIndex + ' 版，共 ' + versionCount + ' 版',
          tone: 'neutral'
        };
      }

      return null;
    }

    function buildChatMessageMeta(message, role) {
      const metaItems = [];
      const roleLabel = role === 'user' ? '你' : 'AI 助手';
      metaItems.push('<span class="message-meta-pill tone-role">' + escapeHtml(roleLabel) + '</span>');

      if (message && message.transient) {
        metaItems.push('<span class="message-meta-pill tone-transient">临时结果</span>');
      }

      const timeLabel = formatChatRelativeTime(message && (message.createdAt || message.updatedAt || message.timestamp || 0));
      if (timeLabel) {
        metaItems.push('<span class="message-meta-time">' + escapeHtml(timeLabel) + '</span>');
      }

      if (!metaItems.length) return '';
      return '<div class="message-meta-row">' + metaItems.join('') + '</div>';
    }

    return {
      getAssistantMessageStatus: getAssistantMessageStatus,
      buildChatMessageMeta: buildChatMessageMeta
    };
  }

  return {
    createTools: createTools
  };
}));
