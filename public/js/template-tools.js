(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsTemplateTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getTemplates = settings.getTemplates || function () { return {}; };
    const getWorkspaceState = settings.getWorkspaceState || function () { return {}; };
    const getTemplateSearchState = settings.getTemplateSearchState || function () { return {}; };
    const getCurrentUser = settings.getCurrentUser || function () { return ''; };
    const getFeatureMeta = settings.getFeatureMeta || function () { return {}; };
    const getFeatureInputs = settings.getFeatureInputs || function () { return {}; };
    const scheduleWorkspaceStateSave = settings.scheduleWorkspaceStateSave || function () {};
    const renderTemplateLibrariesCallback = settings.renderTemplateLibraries || function () {};
    const truncateText = settings.truncateText || function (text) { return String(text || ''); };
    const escapeHtml = settings.escapeHtml || function (value) { return String(value || ''); };
    const getElement = settings.getElement || function () { return null; };

    function getTemplateRawPreview(item) {
      if (item && item.message) return String(item.message);
      if (item && item.values && item.values.prompt) return String(item.values.prompt);
      if (item && item.values && item.values.text) return String(item.values.text);
      return item && item.description ? String(item.description) : '';
    }

    function getTemplatePreviewSnippet(item) {
      return truncateText(getTemplateRawPreview(item).replace(/\s+/g, ' ').trim(), 108) || '暂无模板预览';
    }

    function getTemplateSearchQuery(feature) {
      const state = getTemplateSearchState();
      return String(state && state[feature] || '').trim().toLowerCase();
    }

    function getRecentTemplatesForFeature(feature) {
      const workspaceState = getWorkspaceState();
      const recentTemplates = workspaceState && workspaceState.recentTemplates && typeof workspaceState.recentTemplates === 'object'
        ? workspaceState.recentTemplates
        : {};
      return Array.isArray(recentTemplates[feature]) ? recentTemplates[feature].slice() : [];
    }

    function resolveRecentTemplateReference(feature, recentItem) {
      const templates = getTemplates();
      const groupIndex = Number(recentItem && recentItem.groupIndex);
      const itemIndex = Number(recentItem && recentItem.itemIndex);
      const template = templates && templates[feature] && templates[feature][groupIndex] && templates[feature][groupIndex].items
        ? templates[feature][groupIndex].items[itemIndex]
        : null;
      if (!template) return null;
      return Object.assign({}, recentItem, {
        groupIndex: groupIndex,
        itemIndex: itemIndex,
        template: template
      });
    }

    function getResolvedRecentTemplates(feature) {
      return getRecentTemplatesForFeature(feature)
        .map(function (item) { return resolveRecentTemplateReference(feature, item); })
        .filter(Boolean);
    }

    function recordRecentTemplateUse(feature, item) {
      if (!feature) return;
      const nextItem = {
        label: String(item && item.label || '未命名模板'),
        groupIndex: Number(item && item.groupIndex),
        itemIndex: Number(item && item.itemIndex),
        timestamp: Date.now()
      };
      if (Number.isNaN(nextItem.groupIndex) || Number.isNaN(nextItem.itemIndex)) return;

      const workspaceState = getWorkspaceState();
      const previous = getRecentTemplatesForFeature(feature).filter(function (entry) {
        return !(Number(entry && entry.groupIndex) === nextItem.groupIndex && Number(entry && entry.itemIndex) === nextItem.itemIndex);
      });
      workspaceState.recentTemplates = Object.assign({}, workspaceState.recentTemplates || {}, {
        [feature]: [nextItem].concat(previous).slice(0, 4)
      });
      scheduleWorkspaceStateSave();
    }

    function clearRecentTemplates(feature) {
      if (!feature) return;
      const workspaceState = getWorkspaceState();
      const nextRecentTemplates = Object.assign({}, workspaceState.recentTemplates || {});
      delete nextRecentTemplates[feature];
      workspaceState.recentTemplates = nextRecentTemplates;
      renderTemplateLibrariesCallback();
      scheduleWorkspaceStateSave();
    }

    function filterTemplateGroups(feature, groups) {
      const query = getTemplateSearchQuery(feature);
      const terms = query.split(/\s+/).filter(Boolean);
      return (groups || [])
        .map(function (group, groupIndex) {
          return Object.assign({}, group, {
            items: (group.items || [])
              .map(function (item, itemIndex) {
                return Object.assign({}, item, {
                  originalGroupIndex: groupIndex,
                  originalItemIndex: itemIndex
                });
              })
              .filter(function (item) {
                if (!terms.length) return true;
                const haystack = [
                  group.category || '',
                  item.label || '',
                  item.description || '',
                  getTemplateRawPreview(item)
                ].join(' ').toLowerCase();
                return terms.every(function (term) { return haystack.includes(term); });
              })
          });
        })
        .filter(function (group) { return group.items.length > 0; });
    }

    function renderTemplateLibraryStat(feature, totalGroups, visibleGroups) {
      const stat = getElement('template-stat-' + feature);
      if (!stat) return;
      const totalCount = (totalGroups || []).reduce(function (sum, group) { return sum + ((group.items && group.items.length) || 0); }, 0);
      const visibleCount = (visibleGroups || []).reduce(function (sum, group) { return sum + ((group.items && group.items.length) || 0); }, 0);
      const query = getTemplateSearchQuery(feature);
      stat.textContent = query
        ? '匹配 ' + visibleCount + ' / ' + totalCount + ' 个模板'
        : '共 ' + totalCount + ' 个模板，覆盖常见工作场景';
    }

    function renderTemplateLibraries() {
      const templates = getTemplates();
      Object.entries(templates).forEach(function (entry) {
        const feature = entry[0];
        const groups = entry[1];
        const container = getElement('template-groups-' + feature);
        if (!container) return;
        const filteredGroups = filterTemplateGroups(feature, groups);
        const recentTemplates = getResolvedRecentTemplates(feature);
        renderTemplateLibraryStat(feature, groups, filteredGroups);
        if (!groups.length) {
          container.innerHTML = '<div class="history-empty">当前还没有模板。</div>';
          return;
        }
        if (!filteredGroups.length) {
          container.innerHTML = '\n          ' + (recentTemplates.length ? '\n            <section class="template-recent-strip">\n              <div class="template-recent-header">\n                <div class="template-recent-copy">\n                  <strong>最近使用</strong>\n                  <span>刚用过的模板会优先留在这里，方便你继续复用。</span>\n                </div>\n                <button type="button" class="template-recent-clear" data-template-recent-clear="' + feature + '">清空</button>\n              </div>\n              <div class="template-recent-actions">\n                ' + recentTemplates.map(function (item) { return '\n                  <button\n                    type="button"\n                    class="template-recent-chip"\n                    data-template-feature="' + feature + '"\n                    data-template-group="' + item.groupIndex + '"\n                    data-template-item="' + item.itemIndex + '"\n                    data-template-label="' + escapeHtml(item.label || (item.template && item.template.label) || '未命名模板') + '">\n                    ' + escapeHtml(item.label || (item.template && item.template.label) || '未命名模板') + '\n                  </button>\n                '; }).join('') + '\n              </div>\n            </section>\n          ' : '') + '\n          <div class="history-empty">没有匹配的模板，换个关键词试试。</div>\n        ';
          return;
        }
        container.innerHTML = '\n        ' + (recentTemplates.length ? '\n          <section class="template-recent-strip">\n            <div class="template-recent-header">\n              <div class="template-recent-copy">\n                <strong>最近使用</strong>\n                <span>刚用过的模板会优先留在这里，方便你继续复用。</span>\n              </div>\n              <button type="button" class="template-recent-clear" data-template-recent-clear="' + feature + '">清空</button>\n            </div>\n            <div class="template-recent-actions">\n              ' + recentTemplates.map(function (item) { return '\n                <button\n                  type="button"\n                  class="template-recent-chip"\n                  data-template-feature="' + feature + '"\n                  data-template-group="' + item.groupIndex + '"\n                  data-template-item="' + item.itemIndex + '"\n                  data-template-label="' + escapeHtml(item.label || (item.template && item.template.label) || '未命名模板') + '">\n                  ' + escapeHtml(item.label || (item.template && item.template.label) || '未命名模板') + '\n                </button>\n              '; }).join('') + '\n            </div>\n          </section>\n        ' : '') + '\n        ' + filteredGroups.map(function (group) { return '\n        <div class="template-category">\n          <div class="template-category-header">\n            <div class="template-category-title">' + escapeHtml(group.category || '未分类') + '</div>\n            <div class="template-category-meta">' + group.items.length + ' 个模板</div>\n          </div>\n          <div class="template-list">\n            ' + group.items.map(function (item) { return '\n              <article class="template-item' + (item.favorite ? ' is-favorite' : '') + '">\n                <div class="template-item-meta">\n                  <span>' + (item.source === 'user' ? '我的模板' : '系统模板') + '</span>\n                  ' + (item.id ? '<button type="button" class="template-favorite-btn" data-template-favorite="' + feature + '" data-template-id="' + item.id + '">' + (item.favorite ? '已收藏' : '收藏') + '</button>' : '') + '\n                </div>\n                <strong>' + escapeHtml(item.label || '未命名模板') + '</strong>\n                <span class="template-item-description">' + escapeHtml(item.description || '暂无描述') + '</span>\n                <p class="template-item-preview">' + escapeHtml(getTemplatePreviewSnippet(item)) + '</p>\n                <div class="template-item-footer">\n                  <span class="template-item-stat">' + Math.max(1, getTemplateRawPreview(item).replace(/\s+/g, '').length) + ' 字内容</span>\n                  <div class="template-actions">\n                    <button\n                      type="button"\n                      data-template-feature="' + feature + '"\n                      data-template-group="' + item.originalGroupIndex + '"\n                      data-template-item="' + item.originalItemIndex + '"\n                      data-template-label="' + escapeHtml(item.label || '未命名模板') + '">\n                    ' + (feature === 'chat' ? '一键发送' : '应用模板') + '\n                    </button>\n                  </div>\n                </div>\n              </article>\n            '; }).join('') + '\n          </div>\n        </div>\n        '; }).join('') + '\n      ';
      });
    }

    function getTemplateDraft(feature) {
      const label = getElement('template-label-' + feature) && getElement('template-label-' + feature).value
        ? getElement('template-label-' + feature).value.trim()
        : '';
      const description = getElement('template-desc-' + feature) && getElement('template-desc-' + feature).value
        ? getElement('template-desc-' + feature).value.trim()
        : '';
      if (!label) {
        return { error: '请先填写模板名称' };
      }

      if (feature === 'chat') {
        const chatInput = getElement('chat-input');
        const message = chatInput && chatInput.value ? chatInput.value.trim() : '';
        if (!message) {
          return { error: '当前对话输入为空，无法保存成模板' };
        }
        return { label: label, description: description || '', category: '我的模板', message: message };
      }

      const values = getFeatureInputs(feature);
      const hasContent = Object.values(values).some(function (value) { return String(value || '').trim(); });
      if (!hasContent) {
        return { error: '当前没有可保存的参数内容' };
      }

      return { label: label, description: description || '', category: '我的模板', values: values };
    }

    return {
      getTemplateRawPreview,
      getTemplatePreviewSnippet,
      getTemplateSearchQuery,
      getRecentTemplatesForFeature,
      resolveRecentTemplateReference,
      getResolvedRecentTemplates,
      recordRecentTemplateUse,
      clearRecentTemplates,
      filterTemplateGroups,
      renderTemplateLibraryStat,
      renderTemplateLibraries,
      getTemplateDraft
    };
  }

  return {
    createTools
  };
}));
