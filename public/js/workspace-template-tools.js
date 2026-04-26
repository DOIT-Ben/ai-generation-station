(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsWorkspaceTemplateTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getCurrentUser = settings.getCurrentUser || function () { return null; };
    const getPersistence = settings.getPersistence || function () { return null; };
    const getTemplates = settings.getTemplates || function () { return {}; };
    const setTemplates = settings.setTemplates || function () {};
    const getAppShellTemplateLibrary = settings.getAppShellTemplateLibrary || function () { return {}; };
    const getFeatureMeta = settings.getFeatureMeta || function () { return {}; };
    const getHistoryState = settings.getHistoryState || function () { return {}; };
    const setHistoryEntries = settings.setHistoryEntries || function () {};
    const getAppShellMaxHistoryItems = settings.getAppShellMaxHistoryItems || function () { return 12; };
    const getTemplateDraft = settings.getTemplateDraft || function () { return { error: '模板草稿不可用' }; };
    const renderTemplateLibraries = settings.renderTemplateLibraries || function () {};
    const renderHistory = settings.renderHistory || function () {};
    const showToast = settings.showToast || function () {};
    const isProtectedSessionError = settings.isProtectedSessionError || function () { return false; };
    const getElement = settings.getElement || function () { return null; };
    const setFieldValue = settings.setFieldValue || function () {};
    const applyFeatureInputs = settings.applyFeatureInputs || function () {};
    const applyVoiceSourceMode = settings.applyVoiceSourceMode || function () {};
    const renderFeatureResult = settings.renderFeatureResult || function () {};
    const scheduleWorkspaceStateSave = settings.scheduleWorkspaceStateSave || function () {};
    const getWorkspaceState = settings.getWorkspaceState || function () { return { lastTab: 'chat' }; };
    const setCurrentTab = settings.setCurrentTab || function () {};
    const getCurrentTab = settings.getCurrentTab || function () { return 'chat'; };
    const queryAll = settings.queryAll || function () { return []; };
    const queryOne = settings.queryOne || function () { return null; };
    const sendChatMessage = settings.sendChatMessage || function () {};
    const recordRecentTemplateUse = settings.recordRecentTemplateUse || function () {};
    const formatTime = settings.formatTime || function () { return ''; };
    const truncateText = settings.truncateText || function (value) { return String(value || ''); };
    const escapeHtml = settings.escapeHtml || function (value) { return String(value || ''); };

    async function loadTemplateLibraries() {
      const currentUser = getCurrentUser();
      const persistence = getPersistence();
      if (!currentUser || !persistence?.getTemplates) {
        renderTemplateLibraries();
        return;
      }
      try {
        const features = Object.keys(getFeatureMeta());
        const responses = await Promise.all(features.map(function (feature) { return persistence.getTemplates(feature); }));
        const nextTemplates = {};
        responses.forEach(function (response, index) {
          nextTemplates[features[index]] = response.groups || [];
        });
        setTemplates(nextTemplates);
      } catch (error) {
        if (isProtectedSessionError(error)) return;
        setTemplates(getAppShellTemplateLibrary());
        showToast('模板库加载失败，已使用本地模板', 'error', 1800);
      }
      renderTemplateLibraries();
    }

    async function saveCurrentTemplate(feature) {
      const currentUser = getCurrentUser();
      const persistence = getPersistence();
      if (!currentUser || !persistence?.createTemplate) {
        showToast('请先登录后再保存模板', 'error', 1600);
        return;
      }

      const draft = getTemplateDraft(feature);
      if (draft.error) {
        showToast(draft.error, 'error', 1600);
        return;
      }

      try {
        await persistence.createTemplate(feature, draft);
        if (getElement(`template-label-${feature}`)) getElement(`template-label-${feature}`).value = '';
        if (getElement(`template-desc-${feature}`)) getElement(`template-desc-${feature}`).value = '';
        await loadTemplateLibraries();
        showToast('模板已保存到你的账号', 'success', 1600);
      } catch (error) {
        if (isProtectedSessionError(error)) return;
        showToast(error.message || '模板保存失败', 'error', 1800);
      }
    }

    async function toggleTemplateFavoriteAction(feature, templateId) {
      const currentUser = getCurrentUser();
      const persistence = getPersistence();
      if (!currentUser || !persistence?.toggleTemplateFavorite) {
        showToast('请先登录后再收藏模板', 'error', 1600);
        return;
      }

      try {
        const result = await persistence.toggleTemplateFavorite(feature, templateId);
        await loadTemplateLibraries();
        showToast(result.favorite ? '模板已加入收藏' : '模板已取消收藏', 'success', 1400);
      } catch (error) {
        if (isProtectedSessionError(error)) return;
        showToast(error.message || '模板收藏失败', 'error', 1800);
      }
    }

    function renderHistoryList(feature) {
      if (feature === 'chat') return;
      const list = getElement(`history-list-${feature}`);
      const empty = getElement(`history-empty-${feature}`);
      if (!list || !empty) return;
      const entries = getHistoryState()[feature] || [];
      if (!getCurrentUser() || entries.length === 0) {
        list.innerHTML = '';
        empty.removeAttribute('hidden');
        return;
      }
      empty.setAttribute('hidden', '');
      list.innerHTML = entries.map(function (entry, index) {
        return '\n      <article class="history-item">\n        <div class="history-item-header">\n          <strong>' + escapeHtml(entry.title) + '</strong>\n          <time>' + escapeHtml(formatTime(entry.timestamp)) + '</time>\n        </div>\n        <p>' + escapeHtml(entry.summary || '无摘要') + '</p>\n        <div class="history-actions">\n          <button type="button" data-history-feature="' + escapeHtml(feature) + '" data-history-index="' + index + '" data-history-action="restore">恢复</button>\n        </div>\n      </article>\n    ';
      }).join('');
    }

    async function loadAllHistories() {
      const currentUser = getCurrentUser();
      const persistence = getPersistence();
      const features = Object.keys(getFeatureMeta()).filter(function (feature) { return feature !== 'chat'; });
      if (!currentUser || !persistence) {
        features.forEach(function (feature) {
          setHistoryEntries(feature, []);
          renderHistory(feature);
        });
        return;
      }

      await Promise.all(features.map(async function (feature) {
        try {
          setHistoryEntries(feature, await persistence.getHistory(currentUser, feature));
        } catch (error) {
          if (isProtectedSessionError(error)) return;
          setHistoryEntries(feature, []);
        }
        renderHistory(feature);
      }));
    }

    function saveHistoryEntry(feature, entry) {
      const currentUser = getCurrentUser();
      const persistence = getPersistence();
      if (feature === 'chat' || !currentUser || !persistence) return;
      const nextEntries = [entry].concat(getHistoryState()[feature] || []).slice(0, getAppShellMaxHistoryItems());
      setHistoryEntries(feature, nextEntries);
      renderHistory(feature);
      persistence.appendHistory(currentUser, feature, entry)
        .then(function (items) {
          setHistoryEntries(feature, items);
          renderHistory(feature);
        })
        .catch(function () {
          showToast((getFeatureMeta()[feature]?.title || feature) + ' 历史保存失败', 'error', 1800);
        });
    }

    function switchTab(tab) {
      const currentContent = queryOne('.tab-content.active');
      const newContent = getElement(`tab-${tab}`);
      const currentNav = queryOne('.nav-item.active');
      const newNav = queryOne(`.nav-item[data-tab="${tab}"]`);

      if (newContent && currentContent !== newContent) {
        currentContent?.classList.add('tab-exit');
        setTimeout(function () {
          currentContent?.classList.remove('active', 'tab-exit');
          newContent.classList.add('tab-enter');
          requestAnimationFrame(function () {
            newContent.classList.add('active');
            setTimeout(function () { newContent.classList.remove('tab-enter'); }, 300);
          });
        }, 150);
      }

      currentNav?.classList.remove('active');
      newNav?.classList.add('active');
      queryAll('.nav-item').forEach(function (item) {
        if (item.dataset.tab === tab) {
          item.setAttribute('aria-current', 'page');
        } else {
          item.removeAttribute('aria-current');
        }
      });

      setCurrentTab(tab);
      getWorkspaceState().lastTab = tab;
      scheduleWorkspaceStateSave();
    }

    function restoreHistoryEntry(feature, index) {
      const entry = getHistoryState()[feature]?.[index];
      if (!entry) return;
      switchTab(feature);
      applyFeatureInputs(feature, entry.state?.inputs || {});
      if (feature === 'covervoice' && entry.state?.inputs?.audio_url) {
        applyVoiceSourceMode('url');
      }
      if (entry.state?.result) {
        renderFeatureResult(feature, entry.state.result, entry.state.inputs || {});
      }
      scheduleWorkspaceStateSave();
      showToast((getFeatureMeta()[feature]?.title || feature) + ' 历史已恢复', 'success', 1600);
    }

    function applyTemplate(feature, groupIndex, itemIndex) {
      const template = getTemplates()?.[feature]?.[groupIndex]?.items?.[itemIndex];
      if (!template) return;
      recordRecentTemplateUse(feature, {
        label: template.label || '未命名模板',
        groupIndex,
        itemIndex
      });
      renderTemplateLibraries();
      switchTab(feature);
      if (feature === 'chat') {
        const input = getElement('chat-input');
        if (input) {
          input.value = template.message;
          input.focus();
        }
        scheduleWorkspaceStateSave();
        sendChatMessage(template.message);
        return;
      }
      applyFeatureInputs(feature, template.values || {});
      if (feature === 'covervoice') {
        applyVoiceSourceMode('url');
      }
      scheduleWorkspaceStateSave();
      showToast((template.label || '模板') + ' 模板已应用', 'success', 1400);
    }

    return {
      loadTemplateLibraries,
      saveCurrentTemplate,
      toggleTemplateFavoriteAction,
      renderHistory: renderHistoryList,
      loadAllHistories,
      saveHistoryEntry,
      switchTab,
      restoreHistoryEntry,
      applyTemplate
    };
  }

  return {
    createTools: createTools
  };
}));
