(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsConversationListTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getConversationState = settings.getConversationState || function () { return { list: [], archived: [], activeId: null }; };
    const getCurrentUser = settings.getCurrentUser || function () { return ''; };
    const getConversationSearchQueryState = settings.getConversationSearchQueryState || function () { return ''; };
    const setConversationSearchQueryState = settings.setConversationSearchQueryState || function () {};
    const getConversationFilterModeState = settings.getConversationFilterModeState || function () { return 'all'; };
    const setConversationFilterModeState = settings.setConversationFilterModeState || function () {};
    const getConversationManageMode = settings.getConversationManageMode || function () { return false; };
    const getIsChatGenerating = settings.getIsChatGenerating || function () { return false; };
    const getChatArchivedCollapsed = settings.getChatArchivedCollapsed || function () { return false; };
    const getElement = settings.getElement || function () { return null; };
    const queryOne = settings.queryOne || function () { return null; };
    const queryAll = settings.queryAll || function () { return []; };
    const escapeHtml = settings.escapeHtml || function (value) { return String(value || ''); };
    const truncateText = settings.truncateText || function (text) { return String(text || ''); };
    const isConversationPinned = settings.isConversationPinned || function () { return false; };
    const isConversationParked = settings.isConversationParked || function () { return false; };
    const filterConversationSummaries = settings.filterConversationSummaries || function (items) { return Array.isArray(items) ? items.slice() : []; };
    const getDayBucketLabel = settings.getDayBucketLabel || function () { return '更早'; };
    const formatTimeOfDay = settings.formatTimeOfDay || function () { return ''; };
    const formatMonthDay = settings.formatMonthDay || function () { return ''; };
    const renderConversationMeta = settings.renderConversationMeta || function () {};
    const renderConversationSidebarSummaryCallback = settings.renderConversationSidebarSummary || function () {};
    const renderConversationSearchFeedbackCallback = settings.renderConversationSearchFeedback || function () {};
    const renderArchivedConversationListCallback = settings.renderArchivedConversationList || function () {};
    const syncChatArchivedSectionState = settings.syncChatArchivedSectionState || function () {};

    function sanitizeConversationText(value) {
      return String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
        .replace(/^\s*#{1,6}\s+/gm, '')
        .replace(/^\s*[>]+ ?/gm, '')
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
        .replace(/[`*_~]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function getConversationTitlePreview(conversation) {
      return sanitizeConversationText(conversation && conversation.title) || '新对话';
    }

    function getConversationCardTitle(conversation) {
      return truncateText(getConversationTitlePreview(conversation), 15);
    }

    function getConversationPreview(conversation) {
      const preview = truncateText(
        sanitizeConversationText(conversation && (conversation.preview || conversation.lastMessagePreview || '')),
        72
      );
      if (preview) return preview;
      if (Number(conversation && conversation.messageCount || 0) <= 0) {
        return '还没有消息，适合开始一个新主题。';
      }
      return String((conversation && conversation.messageCount) || 0) + ' 条消息 · ' + ((conversation && conversation.model) || 'gpt-4.1-mini');
    }

    function getConversationCardPreview(conversation) {
      return truncateText(getConversationPreview(conversation), 15);
    }

    function getConversationRowPillsMarkup(conversation) {
      const conversationState = getConversationState();
      const pills = [];
      if ((conversation && conversation.id) === conversationState.activeId) {
        pills.push('<span class="chat-conversation-pill is-current">当前</span>');
      }
      if (isConversationPinned(conversation && conversation.id)) {
        pills.push('<span class="chat-conversation-pill is-pinned">重点</span>');
      }
      if (isConversationParked(conversation && conversation.id)) {
        pills.push('<span class="chat-conversation-pill is-parked">稍后</span>');
      }
      if (Number(conversation && conversation.messageCount || 0) <= 0) {
        pills.push('<span class="chat-conversation-pill">空白</span>');
      }
      return pills.join('');
    }

    function getConversationTimestamp(conversation) {
      return Number(conversation && (conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt) || 0);
    }

    function getConversationTimeLabel(conversation) {
      const timestamp = getConversationTimestamp(conversation);
      if (!timestamp) return '';
      return getDayBucketLabel(timestamp) === '今天'
        ? formatTimeOfDay(timestamp)
        : formatMonthDay(timestamp);
    }

    function groupConversationsByDay(items) {
      const safeItems = Array.isArray(items) ? items : [];
      const groups = [];
      const pinnedItems = safeItems.filter(function (item) { return isConversationPinned(item && item.id); });
      const parkedItems = safeItems.filter(function (item) { return !isConversationPinned(item && item.id) && isConversationParked(item && item.id); });
      const regularItems = safeItems.filter(function (item) { return !isConversationPinned(item && item.id) && !isConversationParked(item && item.id); });

      if (pinnedItems.length) {
        groups.push({ label: '重点会话', items: pinnedItems });
      }

      regularItems.forEach(function (item) {
        const label = getDayBucketLabel(getConversationTimestamp(item));
        const currentGroup = groups[groups.length - 1];
        if (currentGroup && currentGroup.label === label) {
          currentGroup.items.push(item);
          return;
        }
        groups.push({ label: label, items: [item] });
      });

      if (parkedItems.length) {
        groups.push({ label: '稍后处理', items: parkedItems });
      }
      return groups;
    }

    function getConversationPriorityRank(conversation) {
      if (isConversationPinned(conversation && conversation.id)) return 0;
      if (isConversationParked(conversation && conversation.id)) return 2;
      return 1;
    }

    function getConversationSortValue(conversation) {
      return Number(conversation && (conversation.lastMessageAt || conversation.createdAt) || 0);
    }

    function getArchivedConversationSortValue(conversation) {
      return Number(conversation && (conversation.archivedAt || conversation.updatedAt || conversation.lastMessageAt || conversation.createdAt) || 0);
    }

    function sortConversationSummaries(items) {
      return (Array.isArray(items) ? items.slice() : []).sort(function (left, right) {
        const priority = getConversationPriorityRank(left) - getConversationPriorityRank(right);
        if (priority !== 0) return priority;
        const primary = getConversationSortValue(right) - getConversationSortValue(left);
        if (primary !== 0) return primary;
        return Number(right && right.updatedAt || 0) - Number(left && left.updatedAt || 0);
      });
    }

    function sortArchivedConversationSummaries(items) {
      return (Array.isArray(items) ? items.slice() : []).sort(function (left, right) {
        const primary = getArchivedConversationSortValue(right) - getArchivedConversationSortValue(left);
        if (primary !== 0) return primary;
        return Number(right && right.updatedAt || 0) - Number(left && left.updatedAt || 0);
      });
    }

    function getActiveConversation() {
      const conversationState = getConversationState();
      return (conversationState.list || []).find(function (item) { return item.id === conversationState.activeId; }) || null;
    }

    function getConversationSearchQuery() {
      return String(getConversationSearchQueryState() || '');
    }

    function getConversationFilterMode() {
      return String(getConversationFilterModeState() || 'all');
    }

    function matchesConversationFilter(conversation, mode) {
      const targetMode = mode || getConversationFilterMode();
      const conversationState = getConversationState();
      if (!conversation) return false;
      if (targetMode === 'pinned') return isConversationPinned(conversation.id);
      if (targetMode === 'parked') return isConversationParked(conversation.id);
      if (targetMode === 'current') return conversation.id === conversationState.activeId;
      if (targetMode === 'blank') return Number(conversation && conversation.messageCount || 0) <= 0;
      if (targetMode === 'today') return getDayBucketLabel(getConversationTimestamp(conversation)) === '今天';
      return true;
    }

    function getFilteredActiveConversations() {
      const conversationState = getConversationState();
      return filterConversationSummaries(conversationState.list, getConversationSearchQuery())
        .filter(function (item) { return matchesConversationFilter(item); });
    }

    function getFilteredArchivedConversations() {
      const conversationState = getConversationState();
      return filterConversationSummaries(conversationState.archived, getConversationSearchQuery())
        .filter(function (item) { return matchesConversationFilter(item); });
    }

    function renderArchivedConversationList() {
      const conversationState = getConversationState();
      const section = getElement('chat-archived-section');
      const count = getElement('chat-archived-count');
      const empty = getElement('chat-archived-empty');
      const list = getElement('chat-archived-list');
      if (!section || !count || !empty || !list) return;

      const totalArchivedConversations = conversationState.archived.length;
      const filteredArchivedConversations = getFilteredArchivedConversations();

      if (!getCurrentUser() || !totalArchivedConversations) {
        section.setAttribute('hidden', '');
        count.textContent = '0';
        list.innerHTML = '';
        empty.textContent = '暂无已归档会话。';
        empty.removeAttribute('hidden');
        renderConversationSearchFeedbackCallback();
        return;
      }

      section.removeAttribute('hidden');
      count.textContent = String(totalArchivedConversations);
      syncChatArchivedSectionState();

      if (getChatArchivedCollapsed()) {
        list.innerHTML = '';
        empty.setAttribute('hidden', '');
        return;
      }

      if (!filteredArchivedConversations.length) {
        list.innerHTML = '';
        empty.textContent = '没有匹配搜索条件的已归档会话。';
        empty.removeAttribute('hidden');
        renderConversationSearchFeedbackCallback();
        return;
      }

      empty.setAttribute('hidden', '');
      list.innerHTML = filteredArchivedConversations.map(function (item) {
        return '\n      <article class="chat-archived-item">\n        <div class="chat-archived-copy">\n          <div class="chat-conversation-item-top">\n            <strong>' + escapeHtml(getConversationCardTitle(item)) + '</strong>\n            <time>' + escapeHtml(getConversationTimeLabel(item)) + '</time>\n          </div>\n          <p class="chat-conversation-preview">' + escapeHtml(getConversationCardPreview(item)) + '</p>\n        </div>\n        <div class="chat-archived-actions">\n          <button\n            type="button"\n            class="btn btn-secondary btn-chat-restore"\n            data-restore-conversation-id="' + item.id + '"\n            ' + (getIsChatGenerating() ? 'disabled' : '') + '>\n            恢复\n          </button>\n          <button\n            type="button"\n            class="btn btn-secondary btn-chat-delete"\n            data-delete-conversation-id="' + item.id + '"\n            ' + (getIsChatGenerating() ? 'disabled' : '') + '>\n            删除\n          </button>\n        </div>\n      </article>\n    ';
      }).join('');
      renderConversationSearchFeedbackCallback();
    }

    function renderConversationList() {
      const conversationState = getConversationState();
      const list = getElement('chat-conversation-list');
      const empty = getElement('chat-conversation-empty');
      if (!list || !empty) return;

      const totalConversations = conversationState.list.length;
      const filteredConversations = getFilteredActiveConversations();

      if (!getCurrentUser() || !totalConversations) {
        list.innerHTML = '';
        empty.textContent = '暂无对话。';
        empty.removeAttribute('hidden');
        renderConversationSidebarSummaryCallback();
        renderConversationSearchFeedbackCallback();
        renderConversationMeta();
        renderArchivedConversationList();
        return;
      }

      if (!filteredConversations.length) {
        list.innerHTML = '';
        empty.textContent = '没有匹配搜索条件的进行中会话。';
        empty.removeAttribute('hidden');
        renderConversationSidebarSummaryCallback();
        renderConversationSearchFeedbackCallback();
        renderConversationMeta();
        renderArchivedConversationList();
        return;
      }

      empty.setAttribute('hidden', '');
      const groups = groupConversationsByDay(filteredConversations);
      list.innerHTML = groups.map(function (group) {
        return '\n      <section class="chat-conversation-group">\n        <div class="chat-conversation-group-label">' + group.label + '</div>\n        <div class="chat-conversation-group-list">\n          ' + group.items.map(function (item) {
            return '\n            <article class="chat-conversation-row' + (item.id === conversationState.activeId ? ' is-active' : '') + '">\n              <div class="chat-conversation-row-main">\n                <button\n                  type="button"\n                  class="chat-conversation-item' + (item.id === conversationState.activeId ? ' active' : '') + '"\n                  data-conversation-id="' + item.id + '">\n                  <div class="chat-conversation-item-top">\n                    <strong>' + escapeHtml(getConversationCardTitle(item)) + '</strong>\n                    <time>' + escapeHtml(getConversationTimeLabel(item)) + '</time>\n                  </div>\n                  <p class="chat-conversation-preview">' + escapeHtml(getConversationCardPreview(item)) + '</p>\n                </button>\n              </div>\n              <div class="chat-conversation-action-panel' + (getConversationManageMode() ? ' is-open' : '') + '" ' + (getConversationManageMode() ? '' : 'hidden') + '>\n                <button\n                  type="button"\n                  class="chat-conversation-mini-action' + (isConversationPinned(item.id) ? ' is-active' : '') + '"\n                  data-conversation-pin-id="' + item.id + '"\n                  ' + (getIsChatGenerating() ? 'disabled' : '') + '>\n                  ' + (isConversationPinned(item.id) ? '取消重点' : '设为重点') + '\n                </button>\n                <button\n                  type="button"\n                  class="chat-conversation-mini-action is-muted' + (isConversationParked(item.id) ? ' is-active' : '') + '"\n                  data-conversation-park-id="' + item.id + '"\n                  ' + (getIsChatGenerating() ? 'disabled' : '') + '>\n                  ' + (isConversationParked(item.id) ? '取消稍后' : '稍后处理') + '\n                </button>\n                <button\n                  type="button"\n                  class="chat-conversation-mini-action"\n                  data-conversation-rename-id="' + item.id + '"\n                  ' + (getIsChatGenerating() ? 'disabled' : '') + '>\n                  改名\n                </button>\n                <button\n                  type="button"\n                  class="chat-conversation-mini-action is-danger"\n                  data-conversation-archive-id="' + item.id + '"\n                  ' + (getIsChatGenerating() ? 'disabled' : '') + '>\n                  归档\n                </button>\n              </div>\n            </article>\n          ';
          }).join('') + '\n        </div>\n      </section>\n    ';
      }).join('');
      renderConversationSidebarSummaryCallback();
      renderConversationSearchFeedbackCallback();
      renderConversationMeta();
      renderArchivedConversationList();
    }

    function renderConversationSidebarSummary() {
      const conversationState = getConversationState();
      const summary = getElement('chat-sidebar-summary');
      if (!summary) return;

      const totalActive = conversationState.list.length;
      const totalArchived = conversationState.archived.length;
      const pinnedCount = conversationState.list.filter(function (item) { return isConversationPinned(item && item.id); }).length;
      const parkedCount = conversationState.list.filter(function (item) { return isConversationParked(item && item.id); }).length;
      const blankCount = conversationState.list.filter(function (item) { return matchesConversationFilter(item, 'blank'); }).length;
      const todayCount = conversationState.list.filter(function (item) { return matchesConversationFilter(item, 'today'); }).length;
      const activeConversation = getActiveConversation();
      const hasFilterState = Boolean(getConversationSearchQuery().trim()) || getConversationFilterMode() !== 'all';
      const filterLabels = {
        all: '当前筛选：全部会话',
        pinned: '当前筛选：重点会话',
        parked: '当前筛选：稍后处理',
        current: '当前筛选：仅当前会话',
        blank: '当前筛选：仅空白会话',
        today: '当前筛选：仅今日活跃'
      };
      if (!getCurrentUser() && totalActive <= 0 && totalArchived <= 0) {
        summary.setAttribute('hidden', '');
        summary.innerHTML = '';
        return;
      }

      summary.innerHTML = '\n      <div class="chat-sidebar-summary-grid">\n        <div class="chat-sidebar-stat">\n          <strong>' + totalActive + '</strong>\n          <span>进行中</span>\n        </div>\n        <div class="chat-sidebar-stat">\n          <strong>' + blankCount + '</strong>\n          <span>空白会话</span>\n        </div>\n        <div class="chat-sidebar-stat">\n          <strong>' + pinnedCount + '</strong>\n          <span>重点会话</span>\n        </div>\n      </div>\n      <div class="chat-sidebar-summary-foot">\n        <span>' + (filterLabels[getConversationFilterMode()] || filterLabels.all) + '</span>\n        <span>今日活跃 ' + todayCount + ' · 稍后 ' + parkedCount + ' · 已归档 ' + totalArchived + '</span>\n      </div>\n      ' + ((activeConversation || hasFilterState || totalArchived > 0) ? '\n        <div class="chat-sidebar-utility">\n          ' + (activeConversation ? '<button type="button" class="chat-sidebar-tool" data-chat-focus-current="true">定位当前</button>' : '') + '\n          ' + (hasFilterState ? '<button type="button" class="chat-sidebar-tool" data-chat-search-reset="true">清空筛选</button>' : '') + '\n          ' + (totalArchived > 0 ? '<button type="button" class="chat-sidebar-tool" data-chat-archived-toggle="true">' + (getChatArchivedCollapsed() ? '展开归档' : '收起归档') + '</button>' : '') + '\n        </div>\n      ' : '') + '\n    ';
      summary.removeAttribute('hidden');
    }

    function renderConversationSearchFeedback() {
      const conversationState = getConversationState();
      const feedback = getElement('chat-search-feedback');
      if (!feedback) return;

      const query = getConversationSearchQuery().trim();
      const filterMode = getConversationFilterMode();
      const activeConversation = getActiveConversation();
      const filteredActive = getFilteredActiveConversations();
      const filteredArchived = getFilteredArchivedConversations();
      const totalActive = conversationState.list.length;
      const totalArchived = conversationState.archived.length;
      const activeVisible = Boolean(activeConversation && filteredActive.some(function (item) { return item.id === activeConversation.id; }));
      const filterLabels = {
        all: '全部会话',
        pinned: '重点会话',
        parked: '稍后处理',
        current: '仅当前会话',
        blank: '仅空白会话',
        today: '仅今日活跃'
      };

      if (!getCurrentUser() && totalActive <= 0 && totalArchived <= 0) {
        feedback.setAttribute('hidden', '');
        feedback.innerHTML = '';
        return;
      }

      if (!query && filterMode === 'all') {
        feedback.setAttribute('hidden', '');
        feedback.innerHTML = '';
        return;
      }

      if (!query) {
        feedback.innerHTML = '\n        <div class="chat-search-feedback-main">\n          <strong>' + (filterLabels[filterMode] || filterLabels.all) + '</strong>\n          <span>当前已切到快捷筛选状态，可随时回到全部会话继续浏览。</span>\n        </div>\n        <div class="chat-search-feedback-actions">\n          <button type="button" class="chat-search-action" data-chat-search-reset="true">回到全部</button>\n          ' + (activeConversation ? '<button type="button" class="chat-search-action" data-chat-focus-current="true">定位当前对话</button>' : '') + '\n        </div>\n      ';
        feedback.removeAttribute('hidden');
        return;
      }

      feedback.innerHTML = '\n      <div class="chat-search-feedback-main">\n        <strong>' + (filterLabels[filterMode] || filterLabels.all) + '</strong>\n        <span>进行中匹配 ' + filteredActive.length + '/' + totalActive + '，已归档匹配 ' + filteredArchived.length + '/' + totalArchived + (activeConversation && !activeVisible ? '，当前对话未命中' : '') + '</span>\n      </div>\n      <div class="chat-search-feedback-actions">\n        <button type="button" class="chat-search-action" data-chat-search-reset="true">清空筛选</button>\n        ' + (activeConversation ? '<button type="button" class="chat-search-action" data-chat-focus-current="true">回到当前对话</button>' : '') + '\n      </div>\n    ';
      feedback.removeAttribute('hidden');
    }

    function updateConversationSearch(value, options) {
      const nextValue = String(value || '');
      const searchInput = getElement('chat-conversation-search');
      setConversationSearchQueryState(nextValue);
      if ((!options || options.syncInput !== false) && searchInput) {
        searchInput.value = nextValue;
      }
      if (!options || options.render !== false) {
        renderConversationList();
      }
    }

    function updateConversationFilterMode(mode, options) {
      const nextMode = ['all', 'pinned', 'parked', 'current', 'blank', 'today'].includes(mode) ? mode : 'all';
      setConversationFilterModeState(nextMode);
      Array.from(queryAll('[data-chat-filter]')).forEach(function (button) {
        button.classList.toggle('is-active', button.dataset.chatFilter === nextMode);
      });
      if (!options || options.render !== false) {
        renderConversationList();
      }
    }

    function focusCurrentConversationInList() {
      const activeConversation = getActiveConversation();
      if (!activeConversation || !activeConversation.id) return;
      if (typeof CSS === 'undefined' || typeof CSS.escape !== 'function') return;
      const activeRow = queryOne('.chat-conversation-item[data-conversation-id="' + CSS.escape(activeConversation.id) + '"]');
      if (activeRow && typeof activeRow.scrollIntoView === 'function') {
        activeRow.scrollIntoView({ block: 'nearest' });
      }
    }

    return {
      sanitizeConversationText,
      getConversationTitlePreview,
      getConversationCardTitle,
      getConversationPreview,
      getConversationCardPreview,
      getConversationRowPillsMarkup,
      getConversationTimestamp,
      getConversationTimeLabel,
      groupConversationsByDay,
      getConversationPriorityRank,
      getConversationSortValue,
      getArchivedConversationSortValue,
      sortConversationSummaries,
      sortArchivedConversationSummaries,
      getActiveConversation,
      getConversationSearchQuery,
      getConversationFilterMode,
      matchesConversationFilter,
      getFilteredActiveConversations,
      getFilteredArchivedConversations,
      renderConversationList,
      renderArchivedConversationList,
      renderConversationSidebarSummary,
      renderConversationSearchFeedback,
      updateConversationSearch,
      updateConversationFilterMode,
      focusCurrentConversationInList
    };
  }

  return {
    createTools
  };
}));
