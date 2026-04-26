(function () {
  'use strict';

  const SiteShell = window.SiteShell;
  const persistence = SiteShell?.getPersistence?.();
  const $ = SiteShell.$;
  const nextPath = SiteShell.getNextPath('/');
  const pageDefaultMode = document.body?.dataset?.authDefaultMode || '';
  let activeMode = ['login', 'register', 'forgot'].includes(pageDefaultMode) ? pageDefaultMode : 'login';
  let tokenIntent = { mode: '', token: '' };

  function setFeedback(id, message, state = 'error') {
    const element = $(id);
    if (!element) return;
    if (!message) {
      element.textContent = '';
      element.setAttribute('hidden', '');
      element.removeAttribute('data-state');
      return;
    }
    element.textContent = message;
    element.dataset.state = state;
    element.removeAttribute('hidden');
  }

  function clearAllFeedback() {
    ['login-feedback', 'register-feedback', 'forgot-feedback', 'token-feedback'].forEach(id => setFeedback(id, ''));
  }

  function getRedirectTarget(user) {
    if (user?.mustResetPassword) {
      return SiteShell.buildUrl('/account/', {
        mode: 'reset-required',
        next: nextPath
      });
    }
    return ['/auth/', '/login/', '/register/'].includes(nextPath) ? '/' : nextPath;
  }

  function switchMode(mode) {
    activeMode = mode;
    document.querySelectorAll('[data-auth-mode]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.authMode === mode);
    });
    ['login', 'register', 'forgot'].forEach(name => {
      $(`auth-pane-${name}`)?.toggleAttribute('hidden', name !== mode);
    });
    $('auth-pane-token')?.setAttribute('hidden', '');
    if ($('auth-mode-tabs')) {
      $('auth-mode-tabs').removeAttribute('hidden');
    }
    $('auth-entry-head')?.removeAttribute('hidden');
    clearAllFeedback();
  }

  function readTokenIntent() {
    const url = new URL(window.location.href);
    const invite = String(url.searchParams.get('invite') || '').trim();
    if (invite) {
      return { mode: 'invite', token: invite };
    }
    const reset = String(url.searchParams.get('reset') || '').trim();
    if (reset) {
      return { mode: 'reset', token: reset };
    }
    return { mode: '', token: '' };
  }

  function redirectTokenIntentToRecoveryPage() {
    const intent = readTokenIntent();
    if (!intent.mode || !intent.token || window.location.pathname === '/auth/') return false;
    const url = new URL('/auth/', window.location.origin);
    url.searchParams.set(intent.mode, intent.token);
    window.location.replace(`${url.pathname}${url.search}`);
    return true;
  }

  async function maybeRedirectAuthenticatedUser() {
    const session = await persistence?.loadSession?.().catch(() => null);
    if (!session?.username) return false;
    window.location.href = getRedirectTarget(session);
    return true;
  }

  async function hydrateTokenFlow() {
    tokenIntent = readTokenIntent();
    if (!tokenIntent.mode || !tokenIntent.token) return false;

    $('auth-pane-login')?.setAttribute('hidden', '');
    $('auth-pane-register')?.setAttribute('hidden', '');
    $('auth-pane-forgot')?.setAttribute('hidden', '');
    $('auth-pane-token')?.removeAttribute('hidden');
    $('auth-mode-tabs')?.setAttribute('hidden', '');
    $('auth-entry-head')?.setAttribute('hidden', '');

    try {
      const result = tokenIntent.mode === 'invite'
        ? await persistence.getInvitationSession(tokenIntent.token)
        : await persistence.getPasswordResetSession(tokenIntent.token);
      $('token-username').textContent = result?.user?.displayName || result?.user?.username || '-';
      if (tokenIntent.mode === 'invite') {
        $('token-title').textContent = '激活账号';
        $('token-message').textContent = '这是管理员签发的激活链接。设置新密码后会直接进入工作台。';
        $('token-note').textContent = '激活成功后会自动登录，并直接回到工作台。';
      } else {
        $('token-title').textContent = '重置密码';
        $('token-message').textContent = '设置新的长期密码后，旧密码将失效。';
        $('token-note').textContent = '重置成功后会自动登录，并直接回到工作台。';
      }
      return true;
    } catch (error) {
      setFeedback('token-feedback', error.message || '链接无效或已失效');
      return true;
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setFeedback('login-feedback', '');
    const username = $('login-username')?.value?.trim() || '';
    const password = $('login-password')?.value || '';

    if (!username) {
      setFeedback('login-feedback', '请输入账号');
      return;
    }
    if (!password) {
      setFeedback('login-feedback', '请输入密码');
      return;
    }

    try {
      const user = await persistence.login(username, password);
      SiteShell.queueWelcomeToast?.({
        title: `欢迎回来，${user?.displayName || user?.username || username}`,
        message: '已进入工作台，可以继续创作',
        duration: 1900
      });
      window.location.href = getRedirectTarget(user);
    } catch (error) {
      setFeedback('login-feedback', error.message || '登录失败');
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    setFeedback('register-feedback', '');
    const username = $('register-username')?.value?.trim() || '';
    const email = $('register-email')?.value?.trim() || '';
    const displayName = $('register-display-name')?.value?.trim() || '';
    const password = $('register-password')?.value || '';
    const confirmPassword = $('register-confirm-password')?.value || '';

    if (!username) {
      setFeedback('register-feedback', '请输入账号');
      return;
    }
    if (!email) {
      setFeedback('register-feedback', '请输入邮箱地址');
      return;
    }
    if (!password) {
      setFeedback('register-feedback', '请输入密码');
      return;
    }
    if (password !== confirmPassword) {
      setFeedback('register-feedback', '两次输入的密码不一致');
      return;
    }

    try {
      const user = await persistence.register({
        username,
        email,
        displayName,
        password
      });
      SiteShell.queueWelcomeToast?.({
        title: `欢迎你，${user?.displayName || user?.username || username}`,
        message: '账号已创建，工作台已准备好',
        duration: 1900
      });
      window.location.href = getRedirectTarget(user);
    } catch (error) {
      setFeedback('register-feedback', error.message || '注册失败');
    }
  }

  async function handleForgotSubmit(event) {
    event.preventDefault();
    setFeedback('forgot-feedback', '');
    $('forgot-preview')?.setAttribute('hidden', '');
    const username = $('forgot-username')?.value?.trim() || '';
    if (!username) {
      setFeedback('forgot-feedback', '请输入账号');
      return;
    }

    try {
      const result = await persistence.requestPasswordReset(username);
      setFeedback('forgot-feedback', result.message || '重置请求已提交', 'success');
      if (result.previewUrl) {
        const previewUrl = new URL(result.previewUrl, window.location.origin);
        $('forgot-preview-copy').textContent = previewUrl.href;
        $('forgot-preview-link').href = `${previewUrl.pathname}${previewUrl.search}`;
        $('forgot-preview').removeAttribute('hidden');
      }
    } catch (error) {
      setFeedback('forgot-feedback', error.message || '找回密码失败');
    }
  }

  async function handleTokenSubmit(event) {
    event.preventDefault();
    setFeedback('token-feedback', '');
    const password = $('token-password')?.value || '';
    const confirmPassword = $('token-confirm-password')?.value || '';

    if (!password) {
      setFeedback('token-feedback', '请输入新密码');
      return;
    }
    if (password !== confirmPassword) {
      setFeedback('token-feedback', '两次输入的密码不一致');
      return;
    }

    try {
      const result = tokenIntent.mode === 'invite'
        ? await persistence.activateInvitation(tokenIntent.token, password)
        : await persistence.completePasswordReset(tokenIntent.token, password);
      const user = result?.user || result;
      SiteShell.queueWelcomeToast?.({
        title: tokenIntent.mode === 'invite' ? '账号已激活' : '密码已更新',
        message: '已进入工作台，可以继续使用',
        duration: 1900
      });
      window.location.href = getRedirectTarget(user);
    } catch (error) {
      setFeedback('token-feedback', error.message || '操作失败');
    }
  }

  async function init() {
    SiteShell.bindThemeToggle(theme => SiteShell.syncThemePreference(persistence, theme));
    SiteShell.renderPortalUserNav('portal-user-nav', null, { nextPath });

    if (redirectTokenIntentToRecoveryPage()) {
      return;
    }

    document.querySelectorAll('[data-auth-mode]').forEach(button => {
      button.addEventListener('click', () => switchMode(button.dataset.authMode));
    });
    $('login-form')?.addEventListener('submit', handleLoginSubmit);
    $('register-form')?.addEventListener('submit', handleRegisterSubmit);
    $('forgot-form')?.addEventListener('submit', handleForgotSubmit);
    $('token-form')?.addEventListener('submit', handleTokenSubmit);
    $('token-back-to-login')?.addEventListener('click', () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('invite');
      url.searchParams.delete('reset');
      window.location.href = SiteShell.buildUrl('/login/', { next: nextPath });
    });

    if (await hydrateTokenFlow()) {
      return;
    }

    if (await maybeRedirectAuthenticatedUser()) {
      return;
    }

    await SiteShell.applyThemeFromPreferences(persistence);
    switchMode(activeMode);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
