(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsWorkspaceChatModelTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CHAT_MODEL_OPTIONS_CACHE_KEY = 'aigs.chat.model-options';
  const CHAT_MODEL_OPTIONS_CACHE_VERSION = 2;

  function createTools(options) {
    const settings = options || {};
    const getElement = settings.getElement || function () { return null; };
    const getUserPreferences = settings.getUserPreferences || function () { return {}; };
    const safeParseJson = settings.safeParseJson || function (_value, fallback) { return fallback; };
    const getLocalStorage = settings.getLocalStorage || function () { return null; };
    const escapeHtml = settings.escapeHtml || function (value) { return String(value || ''); };
    const syncInputDropdown = settings.syncInputDropdown || function () {};
    const updateDropdownScrollState = settings.updateDropdownScrollState || function () {};
    const apiFetch = settings.apiFetch || function () { return Promise.reject(new Error('apiFetch unavailable')); };
    const formatChatModelDropdownLabel = settings.formatChatModelDropdownLabel || function (label) { return String(label || ''); };
    const getChatModelGroupLabel = settings.getChatModelGroupLabel || function () { return 'Other'; };
    const getChatModelSeriesLabel = settings.getChatModelSeriesLabel || function () { return ''; };
    const getChatModelSeriesClass = settings.getChatModelSeriesClass || function () { return ''; };
    const getChatModelTagClass = settings.getChatModelTagClass || function () { return ''; };

    function readCachedChatModelOptions() {
      try {
        const storage = getLocalStorage();
        const cached = safeParseJson(storage?.getItem(CHAT_MODEL_OPTIONS_CACHE_KEY), null);
        if (!cached || typeof cached !== 'object') return null;
        if (Number(cached.version || 0) !== CHAT_MODEL_OPTIONS_CACHE_VERSION) return null;
        const models = Array.isArray(cached.models) ? cached.models : [];
        return models.length ? { models: models, savedAt: Number(cached.savedAt || 0) || 0 } : null;
      } catch {
        return null;
      }
    }

    function writeCachedChatModelOptions(models) {
      if (!Array.isArray(models) || !models.length) return;
      try {
        const storage = getLocalStorage();
        storage?.setItem(CHAT_MODEL_OPTIONS_CACHE_KEY, JSON.stringify({
          version: CHAT_MODEL_OPTIONS_CACHE_VERSION,
          models: models,
          savedAt: Date.now()
        }));
      } catch {
        // Ignore localStorage write failures for model cache.
      }
    }

    function initializeChatModelDropdownLoadingState() {
      const input = getElement('chat-model');
      const dropdown = getElement('chat-model-dropdown');
      const menu = dropdown?.querySelector('.dropdown-menu');
      if (!input || !dropdown || !menu) return;

      const userPreferences = getUserPreferences();
      const cached = readCachedChatModelOptions();
      if (cached?.models?.length) {
        applyChatModelOptions(cached.models, {
          selectedValue: userPreferences.defaultModelChat || input.value || ''
        });
        dropdown.dataset.modelSource = 'cache';
        return;
      }

      const currentValue = String(input.value || userPreferences.defaultModelChat || 'gpt-4.1-mini').trim() || 'gpt-4.1-mini';
      const currentLabel = String(dropdown.querySelector('.dropdown-value')?.textContent || currentValue).trim() || currentValue;

      menu.innerHTML = '\n      <div class="dropdown-group dropdown-group-recommended dropdown-group-loading">\n        <div class="dropdown-group-label">当前模型</div>\n        <div class="dropdown-option dropdown-option-recommended active" data-value="' + escapeHtml(currentValue) + '" data-label="' + escapeHtml(currentLabel) + '" title="' + escapeHtml(currentLabel) + '">\n          <span class="dropdown-option-label">' + escapeHtml(currentLabel) + '</span>\n        </div>\n      </div>\n      <div class="dropdown-group dropdown-group-loading">\n        <div class="dropdown-group-label">模型列表</div>\n        <div class="dropdown-option dropdown-option-loading" data-value="' + escapeHtml(currentValue) + '" data-label="' + escapeHtml(currentLabel) + '" aria-disabled="true">\n          <span class="dropdown-option-label">正在加载模型列表...</span>\n        </div>\n      </div>\n    ';

      syncInputDropdown('chat-model');
      updateDropdownScrollState(menu);
      dropdown.dataset.modelSource = 'loading';
    }

    function applyChatModelOptions(models, options) {
      const nextOptions = options || {};
      const input = getElement('chat-model');
      const dropdown = getElement('chat-model-dropdown');
      const menu = dropdown?.querySelector('.dropdown-menu');
      if (!input || !dropdown || !menu) return;

      const normalizedModels = (Array.isArray(models) ? models : [])
        .map(function (item) {
          const id = String(item?.id || '').trim();
          const rawLabel = String(item?.label || item?.display_name || id || '').trim();
          return {
            id: id,
            label: formatChatModelDropdownLabel(rawLabel, id),
            tags: Array.isArray(item?.tags) ? item.tags.map(function (tag) { return String(tag || '').trim(); }).filter(Boolean) : []
          };
        })
        .filter(function (item) { return item.id && item.label; });
      if (!normalizedModels.length) return;

      const userPreferences = getUserPreferences();
      const recommendedIds = [
        'gpt-5.4',
        'gpt-4.5-preview',
        'gpt-4.1',
        'gpt-4.1-mini',
        'chatgpt-4o-latest',
        'gpt-4o'
      ];
      const recommendedModels = normalizedModels.filter(function (item) { return recommendedIds.includes(item.id); });
      const remainingModels = normalizedModels.filter(function (item) { return !recommendedIds.includes(item.id); });

      const groupedModels = remainingModels.reduce(function (acc, item) {
        const groupLabel = getChatModelGroupLabel(item.id);
        if (!acc.has(groupLabel)) {
          acc.set(groupLabel, []);
        }
        acc.get(groupLabel).push(item);
        return acc;
      }, new Map());

      const groupOrder = ['GPT-5.x', 'GPT-4.5', 'GPT-4.1', 'ChatGPT-4o', 'GPT-4o', 'GPT-4', 'GPT-3.5', 'o Series', 'Other'];
      const groupedEntries = Array.from(groupedModels.entries()).sort(function (left, right) {
        const leftIndex = groupOrder.indexOf(left[0]);
        const rightIndex = groupOrder.indexOf(right[0]);
        const safeLeftIndex = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
        const safeRightIndex = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
        return safeLeftIndex - safeRightIndex;
      });

      function renderTag(tag) {
        return '<span class="dropdown-option-tag ' + getChatModelTagClass(tag) + '">' + escapeHtml(tag) + '</span>';
      }

      function renderSeriesBadge(modelId) {
        const seriesLabel = getChatModelSeriesLabel(modelId);
        return seriesLabel
          ? '<span class="dropdown-option-series ' + getChatModelSeriesClass(seriesLabel) + '">' + escapeHtml(seriesLabel) + '</span>'
          : '';
      }

      function renderMeta(item) {
        const seriesBadge = renderSeriesBadge(item.id);
        const capabilityTags = item.tags.length
          ? '<span class="dropdown-option-tags">' + item.tags.slice(0, 2).map(renderTag).join('') + '</span>'
          : '';
        if (!seriesBadge && !capabilityTags) return '';
        return '<span class="dropdown-option-meta">' + seriesBadge + capabilityTags + '</span>';
      }

      const recommendedBlock = recommendedModels.length ? '\n      <div class="dropdown-group dropdown-group-recommended">\n        <div class="dropdown-group-label">推荐模型</div>\n        ' + recommendedModels.map(function (item) {
        return '\n          <div class="dropdown-option dropdown-option-recommended" data-value="' + escapeHtml(item.id) + '" data-label="' + escapeHtml(item.label) + '" title="' + escapeHtml(item.label) + '">\n            <span class="dropdown-option-label">' + escapeHtml(item.label) + '</span>\n            ' + renderMeta(item) + '\n          </div>\n        ';
      }).join('') + '\n      </div>\n    ' : '';

      menu.innerHTML = recommendedBlock + groupedEntries.map(function (entry) {
        const groupLabel = entry[0];
        const items = entry[1];
        return '\n      <div class="dropdown-group">\n        <div class="dropdown-group-label">' + escapeHtml(groupLabel) + '</div>\n        ' + items.map(function (item) {
          return '\n          <div class="dropdown-option" data-value="' + escapeHtml(item.id) + '" data-label="' + escapeHtml(item.label) + '" title="' + escapeHtml(item.label) + '">\n            <span class="dropdown-option-label">' + escapeHtml(item.label) + '</span>\n            ' + renderMeta(item) + '\n          </div>\n        ';
        }).join('') + '\n      </div>\n    ';
      }).join('') + '<div class="dropdown-scroll-hint" aria-hidden="true">向下滚动查看更多</div>';

      const preferredValue = String(
        nextOptions.selectedValue
        || input.value
        || userPreferences.defaultModelChat
        || normalizedModels[0].id
      ).trim();
      const selected = normalizedModels.find(function (item) { return item.id === preferredValue; }) || normalizedModels[0];
      input.value = selected.id;
      syncInputDropdown('chat-model');
      menu.scrollTop = 0;
      updateDropdownScrollState(menu);
    }

    async function loadChatModelOptions() {
      try {
        const response = await apiFetch('/api/chat/models', { method: 'GET' });
        if (!response.ok) {
          const payload = await response.json().catch(function () { return {}; });
          throw new Error(payload.error || '聊天模型列表加载失败');
        }
        const data = await response.json();
        const models = Array.isArray(data.models) ? data.models : [];
        if (!models.length) return;
        writeCachedChatModelOptions(models);
        applyChatModelOptions(models, {
          selectedValue: getUserPreferences().defaultModelChat || data.defaultModel || ''
        });
        getElement('chat-model-dropdown')?.setAttribute('data-model-source', 'live');
      } catch {
        syncInputDropdown('chat-model');
      }
    }

    return {
      readCachedChatModelOptions: readCachedChatModelOptions,
      writeCachedChatModelOptions: writeCachedChatModelOptions,
      initializeChatModelDropdownLoadingState: initializeChatModelDropdownLoadingState,
      applyChatModelOptions: applyChatModelOptions,
      loadChatModelOptions: loadChatModelOptions
    };
  }

  return {
    createTools: createTools
  };
}));
