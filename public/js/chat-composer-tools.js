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
      if (!input) return;

      autoResizeChatInput();
      const rawValue = String(input.value || '');
      const trimmedValue = rawValue.trim();

      if (sendButton) {
        sendButton.disabled = !trimmedValue;
        sendButton.setAttribute('aria-disabled', trimmedValue ? 'false' : 'true');
      }
      if (clearButton) {
        clearButton.disabled = rawValue.length <= 0;
      }
      renderChatExperienceState();
      renderChatSuggestionStrip();
      renderChatContextStrip();
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

    function getChatContextPills(conversation) {
      const activeConversation = conversation || getActiveConversation();
      const pills = [];
      const draftLength = getChatDraftLength();
      if (!activeConversation) {
        if (draftLength > 0) {
          pills.push({ tone: 'draft', label: '未发送草稿 ' + draftLength + ' 字' });
        }
        return pills;
      }

      pills.push({ tone: 'model', label: activeConversation.model || 'gpt-4.1-mini' });
      pills.push({ tone: 'count', label: (activeConversation.messageCount || 0) + ' 条消息' });
      if (isConversationPinned(activeConversation.id)) {
        pills.push({ tone: 'priority', label: '重点会话' });
      }
      if (isConversationParked(activeConversation.id)) {
        pills.push({ tone: 'parked', label: '稍后处理' });
      }
      if (Number(activeConversation.messageCount || 0) <= 0) {
        pills.push({ tone: 'empty', label: '空白会话，可直接开始新主题' });
      }
      if (draftLength > 0) {
        pills.push({ tone: 'draft', label: '未发送草稿 ' + draftLength + ' 字' });
      }
      if (getIsChatGenerating()) {
        const queueLength = getChatQueue().length;
        pills.push({ tone: 'live', label: queueLength > 0 ? '正在回复中，队列 ' + queueLength + ' 条' : '正在回复中' });
      }
      return pills;
    }

    function renderChatContextStrip() {
      const strip = getElement('chat-context-strip');
      const pillsContainer = getElement('chat-context-pills');
      if (!strip || !pillsContainer) return;

      const pills = getChatContextPills();
      if (!pills.length) {
        strip.setAttribute('hidden', '');
        pillsContainer.innerHTML = '';
        return;
      }

      pillsContainer.innerHTML = pills.map(function (pill) {
        return '<span class="chat-context-pill tone-' + escapeHtml(pill.tone || 'neutral') + '">' + escapeHtml(pill.label) + '</span>';
      }).join('');
      strip.removeAttribute('hidden');
    }

    function getChatQuickstartPrompts() {
      const activeConversation = getActiveConversation();
      const conversationState = getConversationState();
      const draftLength = getChatDraftLength();
      const conversationMessageCount = Number(activeConversation?.messageCount || conversationState.messages.length || 0);
      if (!getCurrentUser() || getIsChatGenerating() || draftLength > 0 || conversationMessageCount > 0) return [];
      return getQuickstartPromptSource().slice();
    }

    function getChatFollowUpPrompts() {
      const activeConversation = getActiveConversation();
      const conversationState = getConversationState();
      const draftLength = getChatDraftLength();
      if (!activeConversation || draftLength > 0) return [];
      if (!Array.isArray(conversationState.messages) || conversationState.messages.length === 0) return [];
      return getFollowUpPromptSource().slice();
    }

    function getChatSuggestionConfig() {
      const activeConversation = getActiveConversation();
      const draftLength = getChatDraftLength();
      const conversationMessageCount = getConversationMessageCount(activeConversation);
      if (!getCurrentUser() || getIsChatGenerating() || draftLength > 0) return null;
      if (conversationMessageCount > 0) return null;

      const prompts = getChatQuickstartPrompts();
      if (!prompts.length) return null;
      return {
        tone: 'quickstart',
        title: '还没想好第一句？',
        description: '先插入一个常见开头，再继续改成你自己的问题。',
        prompts: prompts
      };
    }

    function renderChatSuggestionStrip() {
      const strip = getElement('chat-suggestion-strip');
      const title = getElement('chat-suggestion-title');
      const description = getElement('chat-suggestion-description');
      const actions = getElement('chat-suggestion-actions');
      if (!strip || !title || !description || !actions) return;

      const config = getChatSuggestionConfig();
      if (!config) {
        strip.setAttribute('hidden', '');
        strip.dataset.tone = '';
        actions.innerHTML = '';
        return;
      }

      strip.dataset.tone = config.tone || 'quickstart';
      title.textContent = config.title || '';
      description.textContent = config.description || '';
      actions.innerHTML = config.prompts.map(function (item) {
        return '\n      <button\n        type="button"\n        class="chat-suggestion-chip"\n        data-chat-suggestion-prompt="' + escapeHtml(item.prompt) + '">\n        ' + escapeHtml(item.label) + '\n      </button>\n    ';
      }).join('');
      strip.removeAttribute('hidden');
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
      getChatContextPills: getChatContextPills,
      renderChatContextStrip: renderChatContextStrip,
      getChatQuickstartPrompts: getChatQuickstartPrompts,
      getChatFollowUpPrompts: getChatFollowUpPrompts,
      getChatSuggestionConfig: getChatSuggestionConfig,
      renderChatSuggestionStrip: renderChatSuggestionStrip,
      createChatStarterPanelMarkup: createChatStarterPanelMarkup,
      applyChatStarterPrompt: applyChatStarterPrompt
    };
  }

  return {
    createTools: createTools
  };
}));
