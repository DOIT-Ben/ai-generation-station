(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsChatExcerptTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getCurrentUser = settings.getCurrentUser || function () { return ''; };
    const getCurrentUserProfile = settings.getCurrentUserProfile || function () { return null; };
    const getConversationState = settings.getConversationState || function () { return { activeId: null, messages: [] }; };
    const getChatExcerptState = settings.getChatExcerptState || function () { return { items: [], expanded: false, filter: 'current', query: '' }; };
    const setChatExcerptState = settings.setChatExcerptState || function () {};
    const getCurrentTab = settings.getCurrentTab || function () { return 'chat'; };
    const getElement = settings.getElement || function () { return null; };
    const queryAll = settings.queryAll || function () { return []; };
    const queryOne = settings.queryOne || function () { return null; };
    const safeParseJson = settings.safeParseJson || function (value, fallback) { return fallback; };
    const getLocalStorage = settings.getLocalStorage || function () { return null; };
    const truncateText = settings.truncateText || function (value) { return String(value || ''); };
    const getActiveConversation = settings.getActiveConversation || function () { return null; };
    const getConversationTitlePreview = settings.getConversationTitlePreview || function () { return '新对话'; };
    const getConversationMessageById = settings.getConversationMessageById || function () { return null; };
    const restoreChatMessages = settings.restoreChatMessages || function () {};
    const flashButtonFeedback = settings.flashButtonFeedback || function () {};
    const showToast = settings.showToast || function () {};
    const writeClipboard = settings.writeClipboard || (async function () {});
    const updateChatComposerState = settings.updateChatComposerState || function () {};
    const scheduleWorkspaceStateSave = settings.scheduleWorkspaceStateSave || function () {};
    const selectConversation = settings.selectConversation || (async function () {});
    const switchTab = settings.switchTab || function () {};
    const setChatAutoFollow = settings.setChatAutoFollow || function () {};
    const formatChatRelativeTime = settings.formatChatRelativeTime || function () { return ''; };
    const escapeHtml = settings.escapeHtml || function (value) { return String(value || ''); };
    const excerptStorageKeyPrefix = settings.excerptStorageKeyPrefix || 'aigs.chat.excerpts';
    const getChatInputBuildText = settings.getChatInputBuildText || function (content) { return String(content || ''); };
    const setTimeoutFn = settings.setTimeoutFn || function (callback, delay) { return setTimeout(callback, delay); };

    function createDefaultChatExcerptState() {
      return {
        items: [],
        expanded: false,
        filter: 'current',
        query: ''
      };
    }

    function normalizeChatExcerptState(rawState) {
      const raw = rawState && typeof rawState === 'object' ? rawState : {};
      const items = Array.isArray(raw.items) ? raw.items : [];
      const filter = ['current', 'all', 'archived'].includes(raw.filter) ? raw.filter : 'current';
      return {
        items: items
          .filter(function (item) { return item && typeof item === 'object' && item.id && item.messageId; })
          .map(function (item) {
            return {
              id: String(item.id),
              messageId: String(item.messageId),
              conversationId: String(item.conversationId || ''),
              conversationTitle: String(item.conversationTitle || ''),
              content: String(item.content || ''),
              preview: String(item.preview || ''),
              createdAt: Number(item.createdAt || 0),
              archivedAt: Number(item.archivedAt || 0)
            };
          })
          .sort(function (left, right) { return Number(right.createdAt || 0) - Number(left.createdAt || 0); }),
        expanded: Boolean(raw.expanded),
        filter: filter,
        query: truncateText(String(raw.query || '').replace(/\s+/g, ' ').trim(), 48)
      };
    }

    function getChatExcerptStorageKey() {
      const profile = getCurrentUserProfile();
      const identity = (profile && profile.id) || getCurrentUser() || 'guest';
      return excerptStorageKeyPrefix + '.' + encodeURIComponent(String(identity).trim().toLowerCase() || 'guest');
    }

    function readChatExcerptStatePreference() {
      try {
        const storage = getLocalStorage();
        return normalizeChatExcerptState(
          safeParseJson(storage ? storage.getItem(getChatExcerptStorageKey()) : null, createDefaultChatExcerptState())
        );
      } catch (_) {
        return createDefaultChatExcerptState();
      }
    }

    function persistChatExcerptState() {
      try {
        const storage = getLocalStorage();
        if (storage) {
          storage.setItem(getChatExcerptStorageKey(), JSON.stringify(getChatExcerptState()));
        }
      } catch (_) {
        // Ignore localStorage failures.
      }
    }

    function hydrateChatExcerptState() {
      setChatExcerptState(readChatExcerptStatePreference());
    }

    function isMessageExcerpted(messageId) {
      const targetId = String(messageId || '').trim();
      return targetId ? getChatExcerptState().items.some(function (item) { return item.messageId === targetId; }) : false;
    }

    function buildChatExcerptPreview(text) {
      return truncateText(String(text || '').replace(/\s+/g, ' ').trim(), 84);
    }

    function getRecentChatAssets(limit) {
      const nextLimit = Math.max(0, Number(limit == null ? 3 : limit));
      return getChatExcerptState().items.filter(function (item) { return !item.archivedAt; }).slice(0, nextLimit);
    }

    function stripChatMarkupForPreview(text) {
      return String(text || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/^#{1,3}\s+/gm, '')
        .replace(/^[-*]\s+/gm, '')
        .replace(/^\d+\.\s+/gm, '')
        .replace(/^>\s?/gm, '')
        .replace(/[*_~`>#-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function getChatExcerptByMessageId(messageId) {
      const targetId = String(messageId || '').trim();
      return getChatExcerptState().items.find(function (item) { return item.messageId === targetId; }) || null;
    }

    function isChatExcerptArchived(messageId) {
      return Boolean((getChatExcerptByMessageId(messageId) || {}).archivedAt);
    }

    function renderChatExcerptShelf() {
      const state = getChatExcerptState();
      const conversationState = getConversationState();
      const shelf = getElement('chat-excerpt-shelf');
      const summary = getElement('chat-excerpt-summary');
      const stats = getElement('chat-excerpt-stats');
      const presets = getElement('chat-excerpt-presets');
      const toggleButton = getElement('btn-chat-excerpt-toggle-panel');
      const copyVisibleButton = getElement('btn-chat-excerpt-copy-visible');
      const archiveVisibleButton = getElement('btn-chat-excerpt-archive-visible');
      const manager = getElement('chat-excerpt-manager');
      const searchInput = getElement('chat-excerpt-search');
      const clearArchivedButton = getElement('btn-chat-excerpt-clear-archived');
      const resultsMeta = getElement('chat-excerpt-results-meta');
      const actions = getElement('chat-excerpt-actions');
      if (!shelf || !summary || !stats || !actions || !presets || !toggleButton || !copyVisibleButton || !archiveVisibleButton || !manager || !searchInput || !clearArchivedButton || !resultsMeta) return;

      if (!getCurrentUser() || !state.items.length) {
        shelf.setAttribute('hidden', '');
        summary.textContent = '把值得保留的回复留在这里，方便稍后回看。';
        actions.innerHTML = '';
        stats.innerHTML = '';
        presets.innerHTML = '';
        resultsMeta.textContent = '';
        searchInput.value = '';
        return;
      }

      const visibleItems = getVisibleChatExcerpts();
      const activeConversationId = String(conversationState.activeId || '').trim();
      const currentCount = state.items.filter(function (item) {
        return item.conversationId === activeConversationId && !item.archivedAt;
      }).length;
      const archivedCount = state.items.filter(function (item) { return item.archivedAt; }).length;
      const activeCount = state.items.length - archivedCount;
      const filteredCount = getFilteredChatExcerpts({ limit: 24, fallbackToAll: false }).length;
      const usingFallbackItems = !state.expanded && state.filter === 'current' && !currentCount && visibleItems.length > 0;

      stats.innerHTML = '\n      <span class="workspace-mini-stat">活跃 ' + activeCount + '</span>\n      <span class="workspace-mini-stat">归档 ' + archivedCount + '</span>\n      <span class="workspace-mini-stat">当前可见 ' + visibleItems.length + '</span>\n    ';
      summary.textContent = state.expanded
        ? (filteredCount > 0
          ? '已筛出 ' + filteredCount + ' 条资产。你可以搜索、复制、继续复用，或跳回原消息。'
          : (state.filter === 'archived'
            ? '当前没有匹配的归档资产，试试清空搜索或切回全部。'
            : '没有找到匹配的资产，试试切到全部或清空搜索。'))
        : (currentCount > 0
          ? '当前对话已摘录 ' + currentCount + ' 条，展开后可统一管理与复用。'
          : '你当前有 ' + activeCount + ' 条活跃资产，另有 ' + archivedCount + ' 条已归档。');
      presets.innerHTML = '\n      <button type="button" class="chat-excerpt-preset' + (state.filter === 'current' ? ' is-active' : '') + '" data-chat-excerpt-filter="current">当前对话' + (currentCount ? ' · ' + currentCount : '') + '</button>\n      <button type="button" class="chat-excerpt-preset' + (state.filter === 'all' ? ' is-active' : '') + '" data-chat-excerpt-filter="all">全部 · ' + state.items.length + '</button>\n      <button type="button" class="chat-excerpt-preset' + (state.filter === 'archived' ? ' is-active' : '') + '" data-chat-excerpt-filter="archived">已归档 · ' + archivedCount + '</button>\n    ';
      toggleButton.textContent = state.expanded ? '收起管理' : '展开管理';
      toggleButton.setAttribute('aria-expanded', state.expanded ? 'true' : 'false');
      manager.toggleAttribute('hidden', !state.expanded);
      searchInput.value = state.query || '';
      archiveVisibleButton.disabled = !visibleItems.some(function (item) { return !item.archivedAt; });
      clearArchivedButton.disabled = archivedCount === 0;
      resultsMeta.textContent = state.expanded
        ? (usingFallbackItems
          ? '当前对话暂无摘录，折叠态已回退展示最近摘录。'
          : '当前显示 ' + visibleItems.length + ' / ' + filteredCount + ' 条 · 活跃 ' + activeCount + ' · 已归档 ' + archivedCount)
        : (usingFallbackItems ? '当前对话还没有摘录，先为你显示最近保留的内容。' : '');
      copyVisibleButton.disabled = !visibleItems.length;
      actions.innerHTML = visibleItems.length ? visibleItems.map(function (item) {
        return '\n      <article class="chat-excerpt-item' + (item.archivedAt ? ' is-archived' : '') + '">\n        <div class="chat-excerpt-item-head">\n          <div class="chat-excerpt-item-copy">\n            <strong>' + escapeHtml(item.conversationTitle || '未命名对话') + '</strong>\n            <span>' + escapeHtml(item.archivedAt ? '已归档 · ' + (formatChatRelativeTime(item.archivedAt) || '刚刚') : (formatChatRelativeTime(item.createdAt) || '刚刚摘录')) + '</span>\n          </div>\n        </div>\n        <p class="chat-excerpt-preview">' + escapeHtml(item.preview) + '</p>\n        <div class="chat-excerpt-item-actions">\n          <button type="button" class="chat-excerpt-item-btn" data-chat-excerpt-jump="' + escapeHtml(item.messageId) + '" data-chat-excerpt-conversation-id="' + escapeHtml(item.conversationId) + '">跳回原文</button>\n          <button type="button" class="chat-excerpt-item-btn" data-chat-excerpt-copy="' + escapeHtml(item.messageId) + '">复制</button>\n          <button type="button" class="chat-excerpt-item-btn tone-secondary" data-chat-excerpt-insert="' + escapeHtml(item.messageId) + '">继续聊</button>\n          <button type="button" class="chat-excerpt-item-btn" data-chat-excerpt-archive="' + escapeHtml(item.messageId) + '">' + (item.archivedAt ? '恢复' : '归档') + '</button>\n          <button type="button" class="chat-excerpt-item-btn tone-danger" data-chat-excerpt-remove="' + escapeHtml(item.messageId) + '">移除</button>\n        </div>\n      </article>\n    ';
      }).join('') : '\n      <div class="chat-excerpt-empty">\n        <strong>' + (state.filter === 'archived' ? '当前还没有可展示的归档资产' : '当前条件下还没有可展示的资产') + '</strong>\n        <span>' + (state.filter === 'archived' ? '你可以清空搜索、切回全部，或先把一些活跃资产归档。' : '你可以切到“全部”，或先从回复里加入新的摘录。') + '</span>\n        <div class="chat-excerpt-empty-actions">\n          <button type="button" class="chat-excerpt-item-btn" data-chat-excerpt-filter="all">查看全部摘录</button>\n          <button type="button" class="chat-excerpt-item-btn" data-chat-excerpt-search-clear="true">清空搜索</button>\n        </div>\n      </div>\n    ';
      shelf.removeAttribute('hidden');
    }

    function updateChatExcerptState(patch, options) {
      const nextPatch = patch || {};
      const nextOptions = options || {};
      setChatExcerptState(normalizeChatExcerptState({
        ...getChatExcerptState(),
        ...nextPatch,
        items: nextPatch.items != null ? nextPatch.items : getChatExcerptState().items
      }));
      if (nextOptions.persist !== false) {
        persistChatExcerptState();
      }
      if (nextOptions.render !== false) {
        renderChatExcerptShelf();
      }
    }

    function setChatExcerptExpanded(nextExpanded) {
      updateChatExcerptState({
        expanded: Boolean(nextExpanded),
        query: nextExpanded ? getChatExcerptState().query : ''
      });
    }

    function setChatExcerptFilterMode(nextFilter) {
      updateChatExcerptState({
        filter: ['current', 'all', 'archived'].includes(nextFilter) ? nextFilter : 'current'
      });
    }

    function setChatExcerptQuery(nextQuery, options) {
      updateChatExcerptState({
        query: String(nextQuery || '').replace(/\s+/g, ' ').trim()
      }, options || {});
    }

    function removeChatExcerpt(messageId, options) {
      const targetId = String(messageId || '').trim();
      if (!targetId || !isMessageExcerpted(targetId)) return false;
      updateChatExcerptState({
        items: getChatExcerptState().items.filter(function (item) { return item.messageId !== targetId; })
      }, options || {});
      return true;
    }

    function setChatExcerptArchived(messageId, nextArchived, options) {
      const targetId = String(messageId || '').trim();
      const archived = nextArchived !== false;
      const item = getChatExcerptByMessageId(targetId);
      if (!targetId || !item) return false;
      updateChatExcerptState({
        items: getChatExcerptState().items.map(function (entry) {
          return entry.messageId === targetId
            ? { ...entry, archivedAt: archived ? Date.now() : 0 }
            : entry;
        })
      }, options || {});
      return true;
    }

    function matchesChatExcerptQuery(item, query) {
      const normalizedQuery = String(query || '').trim().toLowerCase();
      if (!normalizedQuery) return true;
      const terms = normalizedQuery.split(/\s+/).filter(Boolean);
      if (!terms.length) return true;
      const haystack = [item.conversationTitle, item.preview, item.content].join(' ').toLowerCase();
      return terms.every(function (term) { return haystack.includes(term); });
    }

    function getFilteredChatExcerpts(options) {
      const nextOptions = options || {};
      const limit = nextOptions.limit == null ? 24 : nextOptions.limit;
      const fallbackToAll = nextOptions.fallbackToAll === true;
      const state = getChatExcerptState();
      const activeConversationId = String(getConversationState().activeId || '').trim();
      const requestedFilter = ['current', 'all', 'archived'].includes(state.filter) ? state.filter : 'current';
      const query = String(state.query || '').trim();
      let filtered = state.items;

      if (requestedFilter === 'archived') {
        filtered = filtered.filter(function (item) { return item.archivedAt; });
      } else if (requestedFilter === 'current') {
        filtered = activeConversationId
          ? filtered.filter(function (item) { return item.conversationId === activeConversationId && !item.archivedAt; })
          : [];
        if (!filtered.length && fallbackToAll) {
          filtered = state.items.filter(function (item) { return !item.archivedAt; });
        }
      } else if (requestedFilter === 'all') {
        filtered = filtered.slice();
      }

      filtered = filtered.filter(function (item) { return matchesChatExcerptQuery(item, query); });
      return filtered.slice(0, limit);
    }

    function getVisibleChatExcerpts() {
      return getFilteredChatExcerpts({
        limit: getChatExcerptState().expanded ? 24 : 3,
        fallbackToAll: !getChatExcerptState().expanded
      });
    }

    function archiveVisibleChatExcerpts() {
      const visibleIds = getFilteredChatExcerpts({ limit: 24, fallbackToAll: false })
        .filter(function (item) { return !item.archivedAt; })
        .map(function (item) { return item.messageId; });
      if (!visibleIds.length) return 0;
      updateChatExcerptState({
        items: getChatExcerptState().items.map(function (item) {
          return visibleIds.includes(item.messageId)
            ? { ...item, archivedAt: item.archivedAt || Date.now() }
            : item;
        })
      });
      return visibleIds.length;
    }

    function clearArchivedChatExcerpts() {
      const archivedCount = getChatExcerptState().items.filter(function (item) { return item.archivedAt; }).length;
      if (!archivedCount) return 0;
      updateChatExcerptState({
        items: getChatExcerptState().items.filter(function (item) { return !item.archivedAt; })
      });
      return archivedCount;
    }

    function saveChatExcerpt(message) {
      if (!(message && message.id && message.content)) return null;
      const activeConversation = getActiveConversation();
      const conversationState = getConversationState();
      const excerpt = {
        id: 'excerpt-' + message.id,
        messageId: String(message.id),
        conversationId: String((activeConversation && activeConversation.id) || conversationState.activeId || ''),
        conversationTitle: getConversationTitlePreview(activeConversation),
        content: String(message.content || '').trim(),
        preview: buildChatExcerptPreview(message.content),
        createdAt: Date.now(),
        archivedAt: 0
      };
      updateChatExcerptState({
        items: [excerpt].concat(getChatExcerptState().items.filter(function (item) {
          return item.messageId !== excerpt.messageId;
        })).slice(0, 24)
      });
      return excerpt;
    }

    async function toggleChatExcerpt(messageId, triggerButton) {
      const message = getConversationMessageById(messageId);
      const conversationState = getConversationState();
      if (!(message && message.content)) return;
      if (isMessageExcerpted(messageId)) {
        removeChatExcerpt(messageId);
        flashButtonFeedback(triggerButton, '已移除', 1200, 'info');
        showToast('已移出消息摘录', 'success', 1200);
        if (conversationState.activeId) {
          restoreChatMessages(conversationState.messages, { forceFollow: false });
        }
        return;
      }
      saveChatExcerpt(message);
      flashButtonFeedback(triggerButton, '已摘录', 1200, 'success');
      showToast('已加入消息摘录', 'success', 1200);
      if (conversationState.activeId) {
        restoreChatMessages(conversationState.messages, { forceFollow: false });
      }
    }

    function buildChatExcerptBundle(items) {
      return (Array.isArray(items) ? items : []).map(function (item, index) {
        return [
          (index + 1) + '. ' + (item.conversationTitle || '未命名对话'),
          item.content || item.preview || ''
        ].filter(Boolean).join('\n');
      }).join('\n\n');
    }

    async function copyChatExcerptBundle(triggerButton) {
      const items = getFilteredChatExcerpts({
        limit: getChatExcerptState().expanded ? 24 : 3,
        fallbackToAll: !getChatExcerptState().expanded
      });
      if (!items.length) return;
      await writeClipboard(buildChatExcerptBundle(items));
      flashButtonFeedback(triggerButton, '已复制');
      showToast('已复制当前摘录列表', 'success', 1200);
    }

    async function copyChatExcerptItem(messageId, triggerButton) {
      const excerpt = getChatExcerptByMessageId(messageId);
      if (!(excerpt && excerpt.content)) return;
      await writeClipboard(excerpt.content);
      flashButtonFeedback(triggerButton, '已复制');
      showToast('已复制摘录内容', 'success', 1200);
    }

    function insertChatExcerptIntoComposer(messageId, triggerButton) {
      const excerpt = getChatExcerptByMessageId(messageId);
      const input = getElement('chat-input');
      if (!(excerpt && excerpt.content && input)) return;
      const addition = getChatInputBuildText(excerpt.content);
      input.value = String(input.value || '').trim()
        ? String(input.value || '').trim() + '\n\n' + addition
        : addition;
      updateChatComposerState();
      scheduleWorkspaceStateSave();
      input.focus();
      const caretPosition = input.value.length;
      if (typeof input.setSelectionRange === 'function') {
        input.setSelectionRange(caretPosition, caretPosition);
      }
      flashButtonFeedback(triggerButton, '已插入', 1200, 'success');
      showToast('已插入输入框，可直接继续追问', 'success', 1400);
    }

    async function jumpToChatExcerpt(messageId, conversationId) {
      const targetMessageId = String(messageId || '').trim();
      const targetConversationId = String(conversationId || '').trim();
      if (!targetMessageId) return;
      if (getCurrentTab() !== 'chat') {
        switchTab('chat');
      }
      if (targetConversationId && targetConversationId !== String(getConversationState().activeId || '').trim()) {
        const activeMatch = getConversationState().list.some(function (item) { return item.id === targetConversationId; });
        if (!activeMatch) {
          showToast('摘录来自非当前进行中会话，请先恢复或打开原会话。', 'info', 1800);
          return;
        }
        await selectConversation(targetConversationId);
      }
      setTimeoutFn(function () {
        if (typeof CSS === 'undefined' || typeof CSS.escape !== 'function') return;
        const targetNode = queryOne('.chat-message[data-chat-message-id="' + CSS.escape(targetMessageId) + '"]');
        if (!targetNode) {
          showToast('原消息暂时不可用', 'info', 1600);
          return;
        }
        setChatAutoFollow(false);
        targetNode.scrollIntoView({ block: 'center', behavior: 'smooth' });
        targetNode.classList.add('is-highlighted');
        setTimeoutFn(function () {
          targetNode.classList.remove('is-highlighted');
        }, 1800);
      }, 40);
    }

    return {
      createDefaultChatExcerptState: createDefaultChatExcerptState,
      normalizeChatExcerptState: normalizeChatExcerptState,
      getChatExcerptStorageKey: getChatExcerptStorageKey,
      readChatExcerptStatePreference: readChatExcerptStatePreference,
      persistChatExcerptState: persistChatExcerptState,
      hydrateChatExcerptState: hydrateChatExcerptState,
      isMessageExcerpted: isMessageExcerpted,
      buildChatExcerptPreview: buildChatExcerptPreview,
      getRecentChatAssets: getRecentChatAssets,
      stripChatMarkupForPreview: stripChatMarkupForPreview,
      getChatExcerptByMessageId: getChatExcerptByMessageId,
      isChatExcerptArchived: isChatExcerptArchived,
      updateChatExcerptState: updateChatExcerptState,
      setChatExcerptExpanded: setChatExcerptExpanded,
      setChatExcerptFilterMode: setChatExcerptFilterMode,
      setChatExcerptQuery: setChatExcerptQuery,
      removeChatExcerpt: removeChatExcerpt,
      setChatExcerptArchived: setChatExcerptArchived,
      archiveVisibleChatExcerpts: archiveVisibleChatExcerpts,
      clearArchivedChatExcerpts: clearArchivedChatExcerpts,
      saveChatExcerpt: saveChatExcerpt,
      toggleChatExcerpt: toggleChatExcerpt,
      getVisibleChatExcerpts: getVisibleChatExcerpts,
      matchesChatExcerptQuery: matchesChatExcerptQuery,
      getFilteredChatExcerpts: getFilteredChatExcerpts,
      buildChatExcerptBundle: buildChatExcerptBundle,
      copyChatExcerptBundle: copyChatExcerptBundle,
      copyChatExcerptItem: copyChatExcerptItem,
      insertChatExcerptIntoComposer: insertChatExcerptIntoComposer,
      renderChatExcerptShelf: renderChatExcerptShelf,
      jumpToChatExcerpt: jumpToChatExcerpt
    };
  }

  return {
    createTools: createTools
  };
}));
