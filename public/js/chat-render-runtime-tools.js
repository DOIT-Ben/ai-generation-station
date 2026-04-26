(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsChatRenderRuntimeTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getElement = settings.getElement || function () { return null; };
    const queryOne = settings.queryOne || function () { return null; };
    const getConversationState = settings.getConversationState || function () { return { activeId: null, messages: [] }; };
    const getConversationTransientEntries = settings.getConversationTransientEntries || function () { return []; };
    const getIsChatGenerating = settings.getIsChatGenerating || function () { return false; };
    const getChatScrollState = settings.getChatScrollState || function () { return { autoFollow: true }; };
    const setChatScrollAutoFollow = settings.setChatScrollAutoFollow || function () {};
    const getChatMessageUiStateStore = settings.getChatMessageUiStateStore || function () { return new Map(); };
    const setChatHistory = settings.setChatHistory || function () {};
    const renderChatReadingOutline = settings.renderChatReadingOutline || function () {};
    const syncChatReadingOutlineActiveTarget = settings.syncChatReadingOutlineActiveTarget || function () {};
    const addChatMessage = settings.addChatMessage || function () {};
    const createChatStarterPanelMarkup = settings.createChatStarterPanelMarkup || function () { return ''; };
    const requestAnimationFrameFn = settings.requestAnimationFrameFn || function (callback) { return callback(); };
    const setTimeoutFn = settings.setTimeoutFn || function (callback) { return callback(); };

    function isChatNearBottom(container) {
      if (!container) return true;
      return (container.scrollHeight - container.scrollTop - container.clientHeight) <= 72;
    }

    function updateChatScrollButton() {
      const button = getElement('chat-scroll-to-latest');
      const label = button && typeof button.querySelector === 'function'
        ? button.querySelector('.chat-scroll-to-latest-label')
        : null;
      const container = getElement('chat-messages');
      const conversationState = getConversationState();
      if (!button || !container) return;
      if ((conversationState.messages || []).length === 0 && getConversationTransientEntries().length === 0) {
        button.dataset.state = 'idle';
        button.dataset.visible = 'false';
        button.setAttribute('hidden', '');
        return;
      }
      button.removeAttribute('hidden');
      if (getChatScrollState().autoFollow || container.scrollHeight <= container.clientHeight + 12) {
        button.dataset.state = 'idle';
        button.dataset.visible = 'false';
        return;
      }
      const isAttentionState = getIsChatGenerating();
      const nextLabel = isAttentionState ? '有新回复，回到最新' : '回到最新回复';
      button.dataset.state = isAttentionState ? 'attention' : 'idle';
      button.dataset.visible = 'true';
      if (label) {
        label.textContent = nextLabel;
      } else {
        button.textContent = nextLabel;
      }
    }

    function handleChatMessagesScroll() {
      const container = getElement('chat-messages');
      if (!container) return;
      setChatScrollAutoFollow(isChatNearBottom(container));
      syncChatReadingOutlineActiveTarget();
      updateChatScrollButton();
    }

    function setChatAutoFollow(shouldFollow) {
      setChatScrollAutoFollow(Boolean(shouldFollow));
      updateChatScrollButton();
    }

    function followChatToBottom(force) {
      const nextForce = Boolean(force);
      const container = getElement('chat-messages');
      if (!container) return;
      if (!nextForce && !getChatScrollState().autoFollow) {
        updateChatScrollButton();
        return;
      }
      container.scrollTop = container.scrollHeight;
      if (nextForce) {
        setChatAutoFollow(true);
      } else {
        updateChatScrollButton();
      }
    }

    function getChatMessageUiState(messageId) {
      if (!messageId) return null;
      return getChatMessageUiStateStore().get(messageId) || null;
    }

    function restoreChatMessages(messages, options) {
      const nextOptions = options || {};
      const container = getElement('chat-messages');
      const chatContainer = queryOne('.chat-container');
      const tabChat = getElement('tab-chat');
      const conversationState = getConversationState();
      if (!container) return;
      const transientConversationId = nextOptions.transientConversationId || conversationState.activeId;
      container.innerHTML = '';
      if (chatContainer && chatContainer.classList) {
        chatContainer.classList.remove('has-messages');
      }
      if (tabChat && tabChat.classList) {
        tabChat.classList.remove('has-messages');
      }
      if (!Array.isArray(messages) || messages.length === 0) {
        addChatMessage('chatbot', '', { rawHtml: createChatStarterPanelMarkup() });
        setChatHistory([]);
        renderChatReadingOutline();
        container.scrollTop = 0;
        if (nextOptions.forceFollow === false) {
          setChatAutoFollow(false);
        } else {
          setChatAutoFollow(true);
        }
        updateChatScrollButton();
        return;
      }
      setChatHistory(messages.slice());
      messages.forEach(function (message) {
        addChatMessage(message.role === 'assistant' ? 'chatbot' : 'user', message.content || '', {
          message: message
        });
      });
      if (nextOptions.restoreTransient !== false) {
        getConversationTransientEntries(transientConversationId).forEach(function (message) {
          addChatMessage(message.role === 'assistant' ? 'chatbot' : 'user', message.content || '', {
            message: message,
            insertAfterMessageId: message.afterMessageId || '',
            forceFollow: false
          });
        });
      }
      if (nextOptions.forceFollow === false) {
        const anchorMessageId = String(nextOptions.anchorMessageId || '').trim();
        if (anchorMessageId && typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
          const anchor = container.querySelector('.chat-message[data-chat-message-id="' + CSS.escape(anchorMessageId) + '"]');
          if (anchor && typeof anchor.scrollIntoView === 'function') {
            anchor.scrollIntoView({ block: 'nearest' });
          }
        }
        setChatAutoFollow(false);
        updateChatScrollButton();
        renderChatReadingOutline();
        return;
      }
      renderChatReadingOutline();
      followChatToBottom(true);
    }

    function setChatMessageUiState(messageId, patch) {
      const nextPatch = patch || {};
      if (!messageId) return;
      const store = getChatMessageUiStateStore();
      const conversationState = getConversationState();
      const nextState = Object.assign({}, store.get(messageId) || {}, nextPatch);
      store.set(messageId, nextState);
      if (nextPatch.expiresInMs) {
        setTimeoutFn(function () {
          const currentState = store.get(messageId);
          if (currentState !== nextState) return;
          store.delete(messageId);
          if (getConversationState().activeId) {
            restoreChatMessages(getConversationState().messages, { forceFollow: false });
          }
        }, Number(nextPatch.expiresInMs));
      }
      if (nextPatch.renderNow && conversationState.activeId) {
        restoreChatMessages(conversationState.messages, { forceFollow: false });
      }
    }

    function syncChatMessageActionPanelDom(messageId, expanded) {
      if (!messageId || typeof CSS === 'undefined' || typeof CSS.escape !== 'function') return;
      const messageNode = queryOne('.chat-message[data-chat-message-id="' + CSS.escape(messageId) + '"]');
      if (!messageNode) return;
      messageNode.querySelectorAll('[data-chat-message-actions-toggle="' + CSS.escape(messageId) + '"]').forEach(function (button) {
        button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        button.textContent = expanded
          ? (button.dataset.expandedLabel || '收起版本')
          : (button.dataset.collapsedLabel || '查看版本');
      });
      const panel = messageNode.querySelector('[data-chat-message-panel]');
      if (panel) {
        if (expanded) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      }
      const shell = messageNode.querySelector('.message-actions');
      if (shell) shell.dataset.expanded = expanded ? 'true' : 'false';
    }

    function collapseOtherChatMessagePanels(exceptMessageId) {
      const nextExceptMessageId = exceptMessageId || '';
      const store = getChatMessageUiStateStore();
      Array.from(store.entries()).forEach(function (entry) {
        const messageId = entry[0];
        const state = entry[1];
        if (!(state && state.actionsExpanded) || messageId === nextExceptMessageId) return;
        store.set(messageId, Object.assign({}, state, { actionsExpanded: false }));
        syncChatMessageActionPanelDom(messageId, false);
      });
    }

    function toggleChatMessageActionPanel(messageId) {
      if (!messageId) return;
      const store = getChatMessageUiStateStore();
      const currentState = getChatMessageUiState(messageId) || {};
      const nextExpanded = !currentState.actionsExpanded;
      if (nextExpanded) {
        collapseOtherChatMessagePanels(messageId);
      }
      store.set(messageId, Object.assign({}, currentState, { actionsExpanded: nextExpanded }));
      syncChatMessageActionPanelDom(messageId, nextExpanded);
    }

    function toggleAssistantMessageCompact(messageId) {
      if (!messageId) return;
      const currentState = getChatMessageUiState(messageId) || {};
      setChatMessageUiState(messageId, {
        compactExpanded: currentState.compactExpanded === true ? false : true,
        renderNow: true
      });
      requestAnimationFrameFn(function () {
        const inputArea = queryOne('.chat-input-area');
        if (inputArea && typeof inputArea.scrollIntoView === 'function') {
          inputArea.scrollIntoView({ block: 'end', behavior: 'instant' });
        }
        if (typeof settings.queueChatViewportSync === 'function') {
          settings.queueChatViewportSync();
        }
      });
    }

    return {
      isChatNearBottom: isChatNearBottom,
      updateChatScrollButton: updateChatScrollButton,
      handleChatMessagesScroll: handleChatMessagesScroll,
      setChatAutoFollow: setChatAutoFollow,
      followChatToBottom: followChatToBottom,
      getChatMessageUiState: getChatMessageUiState,
      setChatMessageUiState: setChatMessageUiState,
      syncChatMessageActionPanelDom: syncChatMessageActionPanelDom,
      collapseOtherChatMessagePanels: collapseOtherChatMessagePanels,
      toggleChatMessageActionPanel: toggleChatMessageActionPanel,
      toggleAssistantMessageCompact: toggleAssistantMessageCompact,
      restoreChatMessages: restoreChatMessages
    };
  }

  return {
    createTools: createTools
  };
}));
