(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SiteShell = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const THEME_STORAGE_KEY = 'aigs.theme';
  const PENDING_WELCOME_TOAST_KEY = 'aigs.pendingWelcomeToast';
  const THEME_SEQUENCE = ['dark', 'light', 'paper'];
  const THEME_TIPS = {
    dark: '深色模式',
    light: '浅色模式',
    paper: '护眼模式'
  };

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

  function showWelcomeToast(options = {}) {
    const title = String(options.title || '欢迎回来').trim() || '欢迎回来';
    const message = String(options.message || '正在进入工作台').trim() || '正在进入工作台';
    const duration = Number(options.duration || 1800);
    const host = document.createElement('div');
    const shell = document.createElement('div');
    const card = document.createElement('div');
    const content = document.createElement('div');
    const icon = document.createElement('span');
    const eyebrow = document.createElement('span');
    const heading = document.createElement('strong');
    const copy = document.createElement('p');
    const progress = document.createElement('span');
    const closeButton = document.createElement('button');

    host.className = 'welcome-toast-host';
    shell.className = 'welcome-toast-shell';
    progress.className = 'welcome-toast-progress';
    progress.style.transform = 'scaleX(0)';
    card.className = 'welcome-toast-card';
    content.className = 'welcome-toast-content';
    icon.className = 'welcome-toast-icon';
    icon.innerHTML = `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="8.25"></circle>
        <path d="M6.2 10.3l2.45 2.45 5.15-5.4"></path>
      </svg>
    `;
    eyebrow.className = 'welcome-toast-eyebrow';
    eyebrow.textContent = 'Back to Flow';
    closeButton.className = 'welcome-toast-close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', '关闭欢迎提示');
    closeButton.textContent = '×';
    heading.textContent = title;
    copy.textContent = message;

    content.appendChild(icon);
    content.appendChild(eyebrow);
    content.appendChild(heading);
    content.appendChild(copy);
    card.appendChild(closeButton);
    card.appendChild(content);
    shell.appendChild(progress);
    shell.appendChild(card);
    host.appendChild(shell);
    document.body.appendChild(host);

    const startedAt = performance.now();
    let rafId = 0;
    let finishTimer = 0;
    let isClosed = false;

    const finish = () => {
      if (isClosed) return;
      isClosed = true;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      if (finishTimer) {
        window.clearTimeout(finishTimer);
      }
      host.classList.add('is-leaving');
      window.setTimeout(() => {
        host.remove();
      }, 420);
    };

    const tick = now => {
      const progress = Math.min((now - startedAt) / duration, 1);
      if (progress >= 0 && progress <= 1) {
        const nextScale = Math.max(0.0001, progress);
        host.querySelector('.welcome-toast-progress')?.style.setProperty('transform', `scaleX(${nextScale})`);
      }
      if (progress < 1 && !isClosed) {
        rafId = window.requestAnimationFrame(tick);
      }
    };
    rafId = window.requestAnimationFrame(tick);

    return new Promise(resolve => {
      const resolveAndFinish = () => {
        finish();
        window.setTimeout(resolve, 420);
      };
      closeButton.addEventListener('click', resolveAndFinish, { once: true });
      finishTimer = window.setTimeout(resolveAndFinish, duration);
    });
  }

  function queueWelcomeToast(options = {}) {
    try {
      window.sessionStorage.setItem(PENDING_WELCOME_TOAST_KEY, JSON.stringify({
        title: String(options.title || '欢迎回来').trim() || '欢迎回来',
        message: String(options.message || '正在进入工作台').trim() || '正在进入工作台',
        duration: Number(options.duration || 1800)
      }));
    } catch {
      // Navigation must keep working even when sessionStorage is unavailable.
    }
  }

  function consumeQueuedWelcomeToast() {
    try {
      const raw = window.sessionStorage.getItem(PENDING_WELCOME_TOAST_KEY);
      if (!raw) return null;
      window.sessionStorage.removeItem(PENDING_WELCOME_TOAST_KEY);
      const payload = JSON.parse(raw);
      if (!payload || typeof payload !== 'object') return null;
      return {
        title: String(payload.title || '欢迎回来').trim() || '欢迎回来',
        message: String(payload.message || '正在进入工作台').trim() || '正在进入工作台',
        duration: Number(payload.duration || 1800)
      };
    } catch {
      return null;
    }
  }

  function normalizeTheme(theme) {
    return THEME_SEQUENCE.includes(theme) ? theme : 'dark';
  }

  function getStoredTheme() {
    try {
      return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY) || 'dark');
    } catch {
      return 'dark';
    }
  }

  function setTheme(theme) {
    const nextTheme = normalizeTheme(theme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore localStorage failures.
    }
    const button = $('theme-toggle');
    if (button) {
      button.setAttribute('data-tip', THEME_TIPS[nextTheme] || THEME_TIPS.dark);
      button.setAttribute('aria-label', `切换主题，当前为${THEME_TIPS[nextTheme] || THEME_TIPS.dark}`);
    }
  }

  function bindThemeToggle(onToggle) {
    setTheme(getStoredTheme());
    $('theme-toggle')?.addEventListener('click', async () => {
      const currentIndex = THEME_SEQUENCE.indexOf(getStoredTheme());
      const nextTheme = THEME_SEQUENCE[(currentIndex + 1) % THEME_SEQUENCE.length];
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

  function setPortalNavCollapsed(container, collapsed) {
    if (!container) return;
    const nextCollapsed = Boolean(collapsed);
    const toggleButton = container.querySelector('[data-portal-nav-toggle]');
    const panel = container.querySelector('.portal-user-nav-panel');
    container.classList.toggle('is-collapsed', nextCollapsed);
    if (toggleButton) {
      toggleButton.setAttribute('aria-expanded', String(!nextCollapsed));
      toggleButton.setAttribute('aria-label', nextCollapsed ? '展开页面导航' : '收起页面导航');
      toggleButton.textContent = nextCollapsed ? '菜单' : '收起';
    }
    if (panel) {
      if (nextCollapsed) {
        panel.setAttribute('hidden', '');
      } else {
        panel.removeAttribute('hidden');
      }
    }
  }

  function bindPortalUserNavResponsiveState(container) {
    if (!container) return;
    if (typeof container._portalNavResizeHandler === 'function') {
      window.removeEventListener('resize', container._portalNavResizeHandler);
    }

    const syncState = () => {
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      if (!isMobile) {
        setPortalNavCollapsed(container, false);
        return;
      }
      if (!container.dataset.mobileNavInitialized) {
        container.dataset.mobileNavInitialized = 'true';
        setPortalNavCollapsed(container, true);
      }
    };

    container._portalNavResizeHandler = syncState;
    window.addEventListener('resize', syncState);
    syncState();
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
      <div class="portal-user-nav-main">
        <a class="portal-brand" href="/">
          <span class="portal-brand-mark">AI</span>
          <span class="portal-brand-copy">
            <strong>AI</strong>
            <span>Generation</span>
            <em>Station</em>
          </span>
        </a>
        <button class="portal-nav-toggle" type="button" data-portal-nav-toggle aria-expanded="true" aria-label="收起页面导航">收起</button>
      </div>
      <div class="portal-user-nav-panel">
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
      </div>
    `;

    container.querySelector('[data-portal-nav-toggle]')?.addEventListener('click', () => {
      const nextCollapsed = !container.classList.contains('is-collapsed');
      setPortalNavCollapsed(container, nextCollapsed);
    });
    bindPortalUserNavResponsiveState(container);
  }

  return {
    $,
    getPersistence,
    escapeHtml,
    formatTime,
    showToast,
    showWelcomeToast,
    queueWelcomeToast,
    consumeQueuedWelcomeToast,
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
