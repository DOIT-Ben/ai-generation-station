(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsChatOutlineTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getElement = settings.getElement || function () { return null; };
    const escapeHtml = settings.escapeHtml || function (value) { return String(value || ''); };
    const buildTransientMessageId = settings.buildTransientMessageId || function () { return 'chat-heading'; };
    const queryAll = settings.queryAll || function () { return []; };

    function annotateChatMessageHeadings(msgDiv, messageId) {
      if (!msgDiv) return;
      const headingNodes = Array.from(msgDiv.querySelectorAll('.message-body h1, .message-body h2, .message-body h3'));
      const headingBase = String(messageId || msgDiv.dataset.chatMessageId || buildTransientMessageId('chat-heading')).trim();
      headingNodes.forEach(function (heading, index) {
        heading.id = 'chat-heading-' + headingBase + '-' + (index + 1);
        heading.dataset.chatHeadingLevel = heading.tagName.toLowerCase();
      });
    }

    function renderChatReadingOutline() {
      const outline = getElement('chat-reading-outline');
      const actions = getElement('chat-reading-outline-actions');
      const container = getElement('chat-messages');
      if (!outline || !actions || !container) return;

      const chatbotMessages = Array.from(container.querySelectorAll('.chat-message.chatbot'));
      const targetMessage = chatbotMessages.reverse().find(function (node) {
        return node.querySelectorAll('.message-body h1, .message-body h2, .message-body h3').length >= 2;
      });
      if (!targetMessage) {
        outline.setAttribute('hidden', '');
        actions.innerHTML = '';
        return;
      }

      const headings = Array.from(targetMessage.querySelectorAll('.message-body h1, .message-body h2, .message-body h3'));
      actions.innerHTML = headings.map(function (heading, index) {
        return '\n      <button\n        type="button"\n        class="chat-outline-chip level-' + escapeHtml((heading.tagName || 'h2').toLowerCase()) + '"\n        data-chat-outline-target="' + escapeHtml(heading.id) + '">\n        <span>' + (index + 1) + '</span>' + escapeHtml(String(heading.textContent || '').trim()) + '\n      </button>\n    ';
      }).join('');
      outline.removeAttribute('hidden');
      syncChatReadingOutlineActiveTarget();
    }

    function syncChatReadingOutlineActiveTarget() {
      const container = getElement('chat-messages');
      if (!container) return;
      const headings = Array.from(container.querySelectorAll('.message-body h1[id], .message-body h2[id], .message-body h3[id]'));
      if (!headings.length) {
        queryAll('[data-chat-outline-target]').forEach(function (button) {
          button.classList.remove('is-active');
        });
        return;
      }

      const containerRect = container.getBoundingClientRect();
      let activeHeading = headings[0];
      const threshold = containerRect.top + 88;

      headings.forEach(function (heading) {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= threshold) {
          activeHeading = heading;
        }
      });

      queryAll('[data-chat-outline-target]').forEach(function (button) {
        button.classList.toggle('is-active', button.dataset.chatOutlineTarget === activeHeading.id);
      });
    }

    return {
      annotateChatMessageHeadings: annotateChatMessageHeadings,
      renderChatReadingOutline: renderChatReadingOutline,
      syncChatReadingOutlineActiveTarget: syncChatReadingOutlineActiveTarget
    };
  }

  return {
    createTools: createTools
  };
}));
