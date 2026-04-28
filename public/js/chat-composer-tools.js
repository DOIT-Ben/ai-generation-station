(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsChatComposerTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getElement = settings.getElement || function () { return null; };
    const queryOne = settings.queryOne || function () { return null; };
    const escapeHtml = settings.escapeHtml || function (value) { return String(value == null ? '' : value); };
    const getCurrentUser = settings.getCurrentUser || function () { return null; };
    const getIsChatGenerating = settings.getIsChatGenerating || function () { return false; };
    const getChatQueue = settings.getChatQueue || function () { return []; };
    const getConversationState = settings.getConversationState || function () { return { messages: [] }; };
    const getActiveConversation = settings.getActiveConversation || function () { return null; };
    const getConversationTimestamp = settings.getConversationTimestamp || function () { return ''; };
    const formatChatRelativeTime = settings.formatChatRelativeTime || function () { return ''; };
    const isConversationPinned = settings.isConversationPinned || function () { return false; };
    const isConversationParked = settings.isConversationParked || function () { return false; };
    const queueChatViewportSync = settings.queueChatViewportSync || function () {};
    const scheduleWorkspaceStateSave = settings.scheduleWorkspaceStateSave || function () {};
    const getStarterPrompts = settings.getStarterPrompts || function () {
      return Array.isArray(settings.starterPrompts) ? settings.starterPrompts : [];
    };
    const getQuickstartPromptSource = settings.getQuickstartPrompts || function () {
      const starterPrompts = getStarterPrompts();
      return Array.isArray(settings.quickstartPrompts) ? settings.quickstartPrompts : starterPrompts.slice(0, 3);
    };
    const getFollowUpPromptSource = settings.getFollowUpPrompts || function () {
      return Array.isArray(settings.followUpPrompts) ? settings.followUpPrompts : [];
    };

    function autoResizeChatInput() {
      const input = getElement('chat-input');
      if (!input) return;
      input.style.height = 'auto';
      const nextHeight = Math.min(Math.max(input.scrollHeight, 56), 176);
      input.style.height = nextHeight + 'px';
      input.style.overflowY = input.scrollHeight > 176 ? 'auto' : 'hidden';
    }

    function updateChatComposerState() {
      const input = getElement('chat-input');
      const sendButton = getElement('btn-chat-send');
      const clearButton = getElement('btn-chat-clear');
      const draftCount = getElement('chat-draft-count');
      if (!input) return;

      autoResizeChatInput();
      const rawValue = String(input.value || '');
      const trimmedValue = rawValue.trim();
      const isGenerating = getIsChatGenerating();
      const canSend = Boolean(trimmedValue);

      if (draftCount) {
        draftCount.textContent = String(rawValue.length);
        draftCount.dataset.state = rawValue.length > 3600 ? 'near-limit' : 'normal';
      }
      if (sendButton) {
        sendButton.disabled = !canSend;
        sendButton.setAttribute('aria-disabled', canSend ? 'false' : 'true');
        sendButton.setAttribute('aria-label', isGenerating && canSend ? '加入发送队列' : '发送消息');
      }
      if (clearButton) {
        clearButton.disabled = rawValue.length <= 0;
      }
      renderChatExperienceState();
      queueChatViewportSync();
    }

    function getChatDraftLength() {
      const input = getElement('chat-input');
      return String(input?.value || '').trim().length;
    }

    function getConversationMessageCount(conversation) {
      const conversationState = getConversationState();
      if (!conversation) return Array.isArray(conversationState.messages) ? conversationState.messages.length : 0;
      return Number(conversation.messageCount || conversationState.messages.length || 0);
    }

    function getAssistantMessageCount(messages) {
      const conversationState = getConversationState();
      const source = Array.isArray(messages) ? messages : conversationState.messages;
      return (Array.isArray(source) ? source : []).filter(function (item) {
        return item?.role === 'assistant';
      }).length;
    }

    function getChatExperienceStage() {
      const draftLength = getChatDraftLength();
      const activeConversation = getActiveConversation();
      const messageCount = getConversationMessageCount(activeConversation);
      const assistantCount = getAssistantMessageCount();
      const hasConversation = Boolean(getCurrentUser() && activeConversation);
      const queueLength = getChatQueue().length;

      if (getIsChatGenerating()) {
        if (queueLength > 0) {
          return {
            key: 'queued',
            tone: 'live',
            indicator: '队列中还有 ' + queueLength + ' 条待发送消息',
            hint: '当前回复完成后会自动继续发送，你也可以继续输入下一条。'
          };
        }
        if (draftLength > 0) {
          return {
            key: 'live-draft',
            tone: 'live',
            indicator: '已输入 ' + draftLength + ' 字，发送后会加入队列',
            hint: '当前回复仍在继续，Enter 会把这条消息加入队列。'
          };
        }
        return {
          key: 'live',
          tone: 'live',
          indicator: '正在生成回复',
          hint: '可以提前组织下一条消息，回复结束后会更顺。'
        };
      }

      if (!hasConversation || messageCount <= 0) {
        if (draftLength > 0) {
          return {
            key: 'first-draft',
            tone: 'quickstart',
            indicator: '第一条消息已准备 ' + draftLength + ' 字',
            hint: '发出后我会开始记录上下文，并自动切到继续追问节奏。'
          };
        }
        return {
          key: 'quickstart',
          tone: 'quickstart',
          indicator: '先写下这轮目标或问题',
          hint: '没想好第一句也可以先点建议，再补限制条件后发送。'
        };
      }

      if (draftLength > 0) {
        return {
          key: 'followup-draft',
          tone: 'followup',
          indicator: '这条会接在当前上下文后面 · ' + draftLength + ' 字',
          hint: assistantCount <= 1
            ? '第一轮刚展开，继续补充目标、风格或限制会最省力。'
            : '继续补约束、偏好或风险点，我会沿当前主题往下接。'
        };
      }

      return {
        key: assistantCount <= 1 ? 'followup-early' : 'followup',
        tone: 'followup',
        indicator: assistantCount <= 1 ? '第一轮已展开，继续把需求压实' : '当前上下文已就绪，可以继续追问',
        hint: assistantCount <= 1
          ? '再给一句限制条件、目标结果或风格偏好，我会继续顺着这轮往下拆。'
          : '可以让我换角度、补风险、整理步骤，或直接给执行方案。'
      };
    }

    function renderChatExperienceState() {
      const draftIndicator = getElement('chat-draft-indicator');
      const shortcutHint = getElement('chat-shortcut-hint');
      const inputArea = queryOne('.chat-input-area');
      const stage = getChatExperienceStage();
      if (draftIndicator) draftIndicator.textContent = stage.indicator;
      if (shortcutHint) shortcutHint.textContent = stage.hint;
      if (inputArea) inputArea.dataset.chatStage = stage.tone || 'neutral';
    }

    function getActiveConversationLastActivityLabel(conversation) {
      if (!conversation) return '暂无活跃记录';
      const timestamp = getConversationTimestamp(conversation);
      return timestamp ? formatChatRelativeTime(timestamp) : '暂无活跃记录';
    }

    function createChatStarterPanelMarkup() {
      return '\n      <div class="chat-starter-shell">\n        <div class="chat-starter-copy">\n          <h3>开始一段新对话</h3>\n          <p>选一个开头，或直接输入你的问题。</p>\n        </div>\n        <div class="chat-starter-grid">\n          ' + getStarterPrompts().map(function (item) {
        return '\n            <button\n              type="button"\n              class="chat-starter-card"\n              data-chat-starter-prompt="' + escapeHtml(item.prompt) + '">\n              <strong>' + escapeHtml(item.label) + '</strong>\n            </button>\n          ';
      }).join('') + '\n        </div>\n      </div>\n    ';
    }

    function applyChatStarterPrompt(promptText) {
      const input = getElement('chat-input');
      if (!input) return;
      input.value = String(promptText || '');
      updateChatComposerState();
      scheduleWorkspaceStateSave();
      input.focus();
      const caretPosition = input.value.length;
      if (typeof input.setSelectionRange === 'function') {
        input.setSelectionRange(caretPosition, caretPosition);
      }
    }

    return {
      autoResizeChatInput: autoResizeChatInput,
      updateChatComposerState: updateChatComposerState,
      getChatDraftLength: getChatDraftLength,
      getConversationMessageCount: getConversationMessageCount,
      getAssistantMessageCount: getAssistantMessageCount,
      getChatExperienceStage: getChatExperienceStage,
      renderChatExperienceState: renderChatExperienceState,
      getActiveConversationLastActivityLabel: getActiveConversationLastActivityLabel,
      createChatStarterPanelMarkup: createChatStarterPanelMarkup,
      applyChatStarterPrompt: applyChatStarterPrompt
    };
  }

  return {
    createTools: createTools
  };
}));
