(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsWorkspaceAuthTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getWindow = settings.getWindow || function () { return null; };
    const getCurrentUser = settings.getCurrentUser || function () { return null; };
    const setCurrentUser = settings.setCurrentUser || function () {};
    const getCurrentUserProfile = settings.getCurrentUserProfile || function () { return null; };
    const setCurrentUserProfile = settings.setCurrentUserProfile || function () {};
    const getPersistence = settings.getPersistence || function () { return null; };
    const getUserPreferences = settings.getUserPreferences || function () { return {}; };
    const setUserPreferences = settings.setUserPreferences || function () {};
    const updateWorkspaceStateFromPreferences = settings.updateWorkspaceStateFromPreferences || function () {};
    const applyUserPreferences = settings.applyUserPreferences || function () {};
    const isProtectedSessionError = settings.isProtectedSessionError || function () { return false; };
    const showToast = settings.showToast || function () {};
    const getCurrentUserProfileState = settings.getCurrentUserProfileState || function () { return null; };
    const getCurrentUserNameState = settings.getCurrentUserNameState || function () { return null; };
    const getPlanDisplayName = settings.getPlanDisplayName || function () { return ''; };
    const logout = settings.logout || function () {};
    const resetAuthenticatedWorkspaceState = settings.resetAuthenticatedWorkspaceState || function () {};
    const getAuthRecoveryLocked = settings.getAuthRecoveryLocked || function () { return false; };
    const setAuthRecoveryLocked = settings.setAuthRecoveryLocked || function () {};
    const setTimeoutFn = settings.setTimeoutFn || function (callback) { return callback(); };
    const loadTemplateLibraries = settings.loadTemplateLibraries || (async function () {});
    const refreshUsageToday = settings.refreshUsageToday || (async function () {});
    const loadConversations = settings.loadConversations || (async function () {});
    const loadAllHistories = settings.loadAllHistories || (async function () {});
    const hydrateChatWorkflowState = settings.hydrateChatWorkflowState || function () {};
    const hydrateChatExcerptState = settings.hydrateChatExcerptState || function () {};
    const restoreWorkspaceDrafts = settings.restoreWorkspaceDrafts || function () {};
    const setWorkspaceStateReady = settings.setWorkspaceStateReady || function () {};
    const getElement = settings.getElement || function () { return null; };
    const getCurrentAppPath = settings.getCurrentAppPath || function () { return '/'; };

    function getPublicAuthIntentFromUrl() {
      const windowRef = getWindow();
      if (!windowRef) return null;
      const url = new URL(windowRef.location.href);
      const inviteToken = String(url.searchParams.get('invite') || '').trim();
      if (inviteToken) {
        return { mode: 'invite', token: inviteToken };
      }
      const resetToken = String(url.searchParams.get('reset') || '').trim();
      if (resetToken) {
        return { mode: 'reset', token: resetToken };
      }
      return null;
    }

    function buildAuthPagePath(nextPath = '/') {
      const url = new URL('/login/', getWindow().location.origin);
      if (nextPath) url.searchParams.set('next', nextPath);
      return url.pathname + url.search;
    }

    function buildAccountPagePath(params = {}) {
      const url = new URL('/account/', getWindow().location.origin);
      Object.entries(params || {}).forEach(function ([key, value]) {
        if (value == null || value === '') return;
        url.searchParams.set(key, String(value));
      });
      return url.pathname + url.search;
    }

    async function loadUserPreferences() {
      const currentUser = getCurrentUser();
      const persistence = getPersistence();
      if (!currentUser || !persistence?.getPreferences) return;
      try {
        const preferences = await persistence.getPreferences();
        const nextPreferences = {
          ...getUserPreferences(),
          ...preferences
        };
        setUserPreferences(nextPreferences);
        updateWorkspaceStateFromPreferences(nextPreferences);
        applyUserPreferences();
      } catch (error) {
        if (isProtectedSessionError(error)) return;
        showToast('用户偏好加载失败，已使用默认设置', 'error', 1800);
      }
    }

    function renderUserPanel() {
      const panel = getElement('user-panel');
      const currentUser = getCurrentUserNameState();
      const currentUserProfile = getCurrentUserProfileState();
      if (!panel) return;
      if (!currentUser) {
        panel.innerHTML = '<a class="topbar-login-button" id="btn-open-auth" href="/login/?next=%2F"><span>登录</span></a>';
        return;
      }
      const roleLabel = currentUserProfile?.role === 'admin' ? '管理员' : '成员';
      const planLabel = getPlanDisplayName(currentUserProfile?.planCode);
      const avatarLabel = String(currentUser || '?').trim().slice(0, 1).toUpperCase();
      const summaryLabel = currentUserProfile?.mustResetPassword
        ? '已登录 · 需先改密'
        : '已登录 · ' + roleLabel + ' · ' + planLabel;
      panel.innerHTML = '\n      <div class="topbar-account">\n        <div class="topbar-account-avatar">' + avatarLabel + '</div>\n        <div class="topbar-account-copy">\n          <strong>' + currentUser + '</strong>\n          <span>' + summaryLabel + '</span>\n        </div>\n        <a href="/account/" class="topbar-account-action topbar-account-action--account"><span>个人中心</span></a>\n        ' + (currentUserProfile?.role === 'admin' ? '<a href="/admin/" class="topbar-account-action"><span>后台</span></a>' : '') + '\n        <button id="btn-logout" class="topbar-account-action topbar-account-action--logout" type="button"><span>退出</span></button>\n      </div>\n    ';
      getElement('btn-logout')?.addEventListener('click', logout);
    }

    function handleProtectedSessionLoss(message = '登录状态已失效，请重新登录') {
      const windowRef = getWindow();
      if (getAuthRecoveryLocked()) return;
      setAuthRecoveryLocked(true);
      resetAuthenticatedWorkspaceState();
      showToast(message, 'error', 1800);
      setTimeoutFn(function () {
        windowRef.location.href = buildAuthPagePath(getCurrentAppPath());
      }, 120);
      setTimeoutFn(function () { setAuthRecoveryLocked(false); }, 600);
    }

    function handlePasswordResetRequired(detail = {}) {
      const currentUserProfile = getCurrentUserProfile();
      if (detail.user) {
        const nextProfile = {
          ...(currentUserProfile || {}),
          ...detail.user,
          mustResetPassword: true
        };
        setCurrentUserProfile(nextProfile);
        setCurrentUser(nextProfile.username || getCurrentUser());
      } else if (currentUserProfile) {
        setCurrentUserProfile({
          ...currentUserProfile,
          mustResetPassword: true
        });
      }

      renderUserPanel();
      getWindow().location.href = buildAccountPagePath({
        mode: 'reset-required',
        next: getCurrentAppPath()
      });
    }

    async function loadAuthenticatedWorkspaceData() {
      hydrateChatWorkflowState();
      hydrateChatExcerptState();
      await loadUserPreferences();
      await refreshUsageToday();
      await loadTemplateLibraries();
      await loadConversations();
      await loadAllHistories();
      restoreWorkspaceDrafts();
      setWorkspaceStateReady(true);
    }

    async function completeAuthenticatedBootstrap(options = {}) {
      const nextOptions = options || {};
      const currentUserProfile = getCurrentUserProfile();
      const currentUser = getCurrentUser();
      renderUserPanel();

      if (currentUserProfile?.mustResetPassword) {
        handlePasswordResetRequired({
          user: currentUserProfile,
          message: '请先修改临时密码后再继续使用'
        });
        return;
      }

      await loadAuthenticatedWorkspaceData();
      if (nextOptions.showWelcomeToast) {
        showToast('欢迎回来，' + currentUser, 'success', 1800);
      }
    }

    async function bootstrapAuth() {
      const persistence = getPersistence();
      const windowRef = getWindow();
      renderUserPanel();
      const publicAuthIntent = getPublicAuthIntentFromUrl();
      if (publicAuthIntent?.mode && publicAuthIntent?.token) {
        const redirectUrl = new URL('/login/', windowRef.location.origin);
        redirectUrl.searchParams.set(publicAuthIntent.mode === 'invite' ? 'invite' : 'reset', publicAuthIntent.token);
        windowRef.location.replace(redirectUrl.pathname + redirectUrl.search);
        return;
      }

      let restoredSession = false;
      try {
        const session = await persistence?.loadSession();
        if (session?.username) {
          setCurrentUserProfile(session);
          setCurrentUser(session.username);
          restoredSession = true;
          await completeAuthenticatedBootstrap();
        }
      } catch {
        restoredSession = false;
      }

      if (!restoredSession) {
        windowRef.location.replace(buildAuthPagePath(getCurrentAppPath()));
      }
    }

    return {
      getPublicAuthIntentFromUrl: getPublicAuthIntentFromUrl,
      buildAuthPagePath: buildAuthPagePath,
      buildAccountPagePath: buildAccountPagePath,
      loadUserPreferences: loadUserPreferences,
      renderUserPanel: renderUserPanel,
      handleProtectedSessionLoss: handleProtectedSessionLoss,
      handlePasswordResetRequired: handlePasswordResetRequired,
      loadAuthenticatedWorkspaceData: loadAuthenticatedWorkspaceData,
      completeAuthenticatedBootstrap: completeAuthenticatedBootstrap,
      bootstrapAuth: bootstrapAuth
    };
  }

  return {
    createTools: createTools
  };
}));
