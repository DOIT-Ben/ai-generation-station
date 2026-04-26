(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsWorkspaceShellTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const THEME_SEQUENCE = ['dark', 'light', 'paper'];
  const THEME_TIPS = {
    dark: '深色模式',
    light: '浅色模式',
    paper: '护眼模式'
  };
  const QUOTA_COLLAPSED_KEY = 'aigs.quota.collapsed';
  const MODEL_LABELS = {
    'MiniMax-M*': '通用对话',
    'speech-hd': '语音合成',
    'music-2.5': '音乐生成',
    'music-2.6': '音乐生成',
    'music-cover': '歌声翻唱',
    'lyrics_generation': '歌词创作',
    'image-01': '封面生成',
    'MiniMax-Hailuo-2.3-Fast-6s-768p': '视频生成',
    'MiniMax-Hailuo-2.3-6s-768p': '视频生成'
  };
  const LABEL_ORDER = ['通用对话', '音乐生成', '歌声翻唱', '歌词创作', '封面生成', '语音合成', '视频生成'];

  function createTools(options) {
    const settings = options || {};
    const getElement = settings.getElement || function () { return null; };
    const getLocalStorage = settings.getLocalStorage || function () { return null; };
    const getDocumentElement = settings.getDocumentElement || function () { return null; };
    const getUserPreferences = settings.getUserPreferences || function () { return null; };
    const schedulePreferenceSave = settings.schedulePreferenceSave || function () {};
    const loadQuota = settings.loadQuota || function () {};
    let quotaCollapsed = false;

    function normalizeTheme(theme) {
      return THEME_SEQUENCE.includes(theme) ? theme : 'dark';
    }

    function getStoredTheme() {
      return normalizeTheme((getUserPreferences() || {}).theme || 'dark');
    }

    function setTheme(theme) {
      const nextTheme = normalizeTheme(theme);
      const documentElement = getDocumentElement();
      if (documentElement) {
        documentElement.setAttribute('data-theme', nextTheme);
      }

      const preferences = getUserPreferences();
      if (preferences) {
        preferences.theme = nextTheme;
      }

      try {
        getLocalStorage()?.setItem('aigs.theme', nextTheme);
      } catch {
        // Ignore localStorage failures.
      }

      const btn = getElement('theme-toggle');
      if (btn) {
        const themeTip = THEME_TIPS[nextTheme] || THEME_TIPS.dark;
        btn.setAttribute('data-tip', themeTip);
        btn.setAttribute('aria-label', '切换主题，当前为' + themeTip);
      }
    }

    function toggleTheme() {
      const currentIndex = THEME_SEQUENCE.indexOf(getStoredTheme());
      const nextTheme = THEME_SEQUENCE[(currentIndex + 1) % THEME_SEQUENCE.length];
      setTheme(nextTheme);
      schedulePreferenceSave({ theme: nextTheme });
    }

    function initTheme() {
      setTheme(getStoredTheme());
      getElement('theme-toggle')?.addEventListener('click', toggleTheme);
    }

    function getModelLabel(name) {
      return MODEL_LABELS[name] || name || '其他';
    }

    function getQuotaLabelOrder() {
      return LABEL_ORDER.slice();
    }

    function readQuotaCollapsedPreference() {
      try {
        return getLocalStorage()?.getItem(QUOTA_COLLAPSED_KEY) === '1';
      } catch {
        return false;
      }
    }

    function persistQuotaCollapsedPreference(value) {
      try {
        getLocalStorage()?.setItem(QUOTA_COLLAPSED_KEY, value ? '1' : '0');
      } catch {
        // noop
      }
    }

    function buildQuotaSummary(items, stateText) {
      const nextItems = Array.isArray(items) ? items : [];
      if (stateText) return stateText;
      if (nextItems.length === 0) return '暂无可用额度数据';

      const totalModels = nextItems.length;
      const highestUsageItem = nextItems.reduce(function (selected, current) {
        const selectedPct = selected && selected.current_interval_total_count > 0
          ? selected.current_interval_usage_count / selected.current_interval_total_count
          : -1;
        const currentPct = current && current.current_interval_total_count > 0
          ? current.current_interval_usage_count / current.current_interval_total_count
          : -1;
        return currentPct > selectedPct ? current : selected;
      }, null);

      if (!highestUsageItem) {
        return totalModels + ' 项额度可用';
      }

      const used = Number(highestUsageItem.current_interval_usage_count || 0);
      const total = Number(highestUsageItem.current_interval_total_count || 0);
      const pct = total > 0 ? Math.round((used / total) * 100) : 0;
      return totalModels + ' 项额度 · ' + getModelLabel(highestUsageItem.model_name) + ' 已用 ' + pct + '%';
    }

    function syncQuotaCardState() {
      const card = getElement('quota-info');
      const toggle = getElement('btn-quota-toggle');
      const label = toggle?.querySelector('.quota-toggle-label');
      if (!card || !toggle || !label) return;
      card.dataset.collapsed = quotaCollapsed ? 'true' : 'false';
      toggle.setAttribute('aria-expanded', quotaCollapsed ? 'false' : 'true');
      toggle.setAttribute('title', quotaCollapsed ? '展开额度详情' : '收起额度详情');
      label.textContent = quotaCollapsed ? '展开' : '收起';
    }

    function setQuotaCollapsed(nextValue) {
      quotaCollapsed = Boolean(nextValue);
      persistQuotaCollapsedPreference(quotaCollapsed);
      syncQuotaCardState();
    }

    function getQuotaCollapsed() {
      return quotaCollapsed;
    }

    function renderQuotaContent(options) {
      const nextOptions = options || {};
      const summary = getElement('quota-summary');
      const body = getElement('quota-body');
      if (summary) {
        summary.textContent = buildQuotaSummary(nextOptions.items, nextOptions.summaryText || '');
      }
      if (body) {
        body.innerHTML = nextOptions.bodyHtml || '<div class="quota-loading">暂无可用额度数据</div>';
      }
      getElement('btn-quota-refresh')?.addEventListener('click', function (e) {
        e.stopPropagation();
        loadQuota();
      });
    }

    function bindQuotaToggle() {
      getElement('btn-quota-toggle')?.addEventListener('click', function () {
        setQuotaCollapsed(!quotaCollapsed);
      });
    }

    return {
      normalizeTheme: normalizeTheme,
      getStoredTheme: getStoredTheme,
      setTheme: setTheme,
      toggleTheme: toggleTheme,
      initTheme: initTheme,
      getModelLabel: getModelLabel,
      getQuotaLabelOrder: getQuotaLabelOrder,
      readQuotaCollapsedPreference: readQuotaCollapsedPreference,
      persistQuotaCollapsedPreference: persistQuotaCollapsedPreference,
      buildQuotaSummary: buildQuotaSummary,
      syncQuotaCardState: syncQuotaCardState,
      setQuotaCollapsed: setQuotaCollapsed,
      getQuotaCollapsed: getQuotaCollapsed,
      renderQuotaContent: renderQuotaContent,
      bindQuotaToggle: bindQuotaToggle
    };
  }

  return {
    createTools: createTools
  };
}));
