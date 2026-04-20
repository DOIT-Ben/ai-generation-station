(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SiteShell = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const THEME_STORAGE_KEY = 'aigs.theme';

  function $(id) {
    return document.getElementById(id);
  }

  function getPersistence() {
    return window.AppShell && window.fetch
      ? window.AppShell.createRemotePersistence(window.fetch.bind(window))
      : null;
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value == null ? '' : value);
    return div.innerHTML;
  }

  function formatTime(timestamp) {
    try {
      return new Date(timestamp).toLocaleString('zh-CN', {
        hour12: false,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  }

  function showToast(message, type = 'info', duration = 2800) {
    const container = $('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    window.setTimeout(() => {
      toast.style.animation = 'fadeOut 0.35s ease forwards';
      window.setTimeout(() => toast.remove(), 400);
    }, duration);
  }

  function getStoredTheme() {
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
    } catch {
      return 'dark';
    }
  }

  function setTheme(theme) {
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore localStorage failures.
    }
    const button = $('theme-toggle');
    if (button) {
      button.setAttribute('data-tip', nextTheme === 'light' ? '浅色模式' : '深色模式');
    }
  }

  function bindThemeToggle(onToggle) {
    setTheme(getStoredTheme());
    $('theme-toggle')?.addEventListener('click', async () => {
      const nextTheme = getStoredTheme() === 'dark' ? 'light' : 'dark';
      setTheme(nextTheme);
      if (typeof onToggle === 'function') {
        await onToggle(nextTheme);
      }
    });
  }

  function getPlanDisplayName(planCode) {
    if (planCode === 'internal') return '内部';
    if (planCode === 'pro') return 'Pro';
    if (planCode === 'free') return 'Free';
    return planCode || '未设置';
  }

  function getRoleDisplayName(role) {
    return role === 'admin' ? '管理员' : '成员';
  }

  function sanitizeNextPath(raw, fallback = '/') {
    const value = String(raw || '').trim();
    if (!value.startsWith('/') || value.startsWith('//')) return fallback;
    return value;
  }

  function getNextPath(fallback = '/') {
    const currentUrl = new URL(window.location.href);
    return sanitizeNextPath(currentUrl.searchParams.get('next'), fallback);
  }

  function buildUrl(pathname, searchParams = {}) {
    const url = new URL(pathname, window.location.origin);
    Object.entries(searchParams || {}).forEach(([key, value]) => {
      if (value == null || value === '') return;
      url.searchParams.set(key, String(value));
    });
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function redirect(pathname, searchParams = {}) {
    window.location.href = buildUrl(pathname, searchParams);
  }

  async function syncThemePreference(persistence, theme) {
    if (!persistence?.savePreferences) return;
    try {
      await persistence.savePreferences({ theme });
    } catch {
      // Theme sync failure should not block page usage.
    }
  }

  async function applyThemeFromPreferences(persistence) {
    if (!persistence?.getPreferences) return null;
    try {
      const preferences = await persistence.getPreferences();
      if (preferences?.theme) {
        setTheme(preferences.theme);
      }
      return preferences || null;
    } catch {
      return null;
    }
  }

  async function logoutAndRedirect(persistence, targetPath = '/auth/') {
    const safeTargetPath = sanitizeNextPath(targetPath, '/auth/');
    try {
      await persistence?.logout?.();
      const remainingSession = await persistence?.loadSession?.().catch(() => null);
      if (remainingSession?.username) {
        throw new Error('退出未完成，请稍后重试');
      }
    } catch (error) {
      showToast(error?.message || '退出失败，请稍后重试', 'error', 2400);
      return false;
    }
    window.location.replace(buildUrl(safeTargetPath));
    return true;
  }

  function renderPortalUserNav(containerId, session, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const currentPage = options.currentPage || '';
    const showAdmin = session?.role === 'admin';
    const showLogout = options.showLogout !== false;
    const nextForAuth = options.nextPath || '/';
    const summary = session
      ? `${getRoleDisplayName(session.role)} · ${getPlanDisplayName(session.planCode)}`
      : '访问工作台前请先登录';

    container.className = 'portal-user-nav';
    container.innerHTML = `
      <a class="portal-brand" href="/">
        <span class="portal-brand-mark">AI</span>
        <span class="portal-brand-copy">
          <strong>AI Generation</strong>
          <span>创作工作台</span>
        </span>
      </a>
      <div class="portal-nav-links">
        <a class="portal-nav-link${currentPage === 'workspace' ? ' is-active' : ''}" href="/">工作台</a>
        ${session ? `<a class="portal-nav-link${currentPage === 'account' ? ' is-active' : ''}" href="/account/">个人中心</a>` : ''}
        ${showAdmin ? `<a class="portal-nav-link${currentPage === 'admin' ? ' is-active' : ''}" href="/admin/">管理后台</a>` : ''}
      </div>
      <div class="portal-user-meta">
        ${session ? `
          <div class="portal-user-copy">
            <strong>${escapeHtml(session.displayName || session.username)}</strong>
            <span>${escapeHtml(summary)}</span>
          </div>
          ${showLogout ? '<button id="portal-logout-button" class="portal-nav-button" type="button">退出</button>' : ''}
        ` : `
          <a class="portal-nav-button portal-nav-button--primary" href="${escapeHtml(buildUrl('/auth/', { next: nextForAuth }))}">登录 / 注册</a>
        `}
      </div>
    `;
  }

  return {
    $,
    getPersistence,
    escapeHtml,
    formatTime,
    showToast,
    getStoredTheme,
    setTheme,
    bindThemeToggle,
    getPlanDisplayName,
    getRoleDisplayName,
    sanitizeNextPath,
    getNextPath,
    buildUrl,
    redirect,
    syncThemePreference,
    applyThemeFromPreferences,
    logoutAndRedirect,
    renderPortalUserNav
  };
});
