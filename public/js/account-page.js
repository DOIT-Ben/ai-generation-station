(function () {
  'use strict';

  const SiteShell = window.SiteShell;
  const persistence = SiteShell?.getPersistence?.();
  const $ = SiteShell.$;
  let session = null;

  function setFeedback(message, state = 'error') {
    const element = $('account-password-feedback');
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

  function renderSessionProfile() {
    if (!session) return;
    $('account-display-name').textContent = session.displayName || session.username || '-';
    $('account-username-line').textContent = `账号：${session.username || '-'}`;
    $('account-email-line').textContent = `邮箱：${session.email || '未设置'}`;
    $('account-role-pill').textContent = `角色：${SiteShell.getRoleDisplayName(session.role)}`;
    $('account-plan-pill').textContent = `套餐：${SiteShell.getPlanDisplayName(session.planCode)}`;
    $('account-password-pill').textContent = `密码状态：${session.mustResetPassword ? '需立即修改' : '正常'}`;
    $('account-admin-link')?.toggleAttribute('hidden', session.role !== 'admin');
  }

  function renderResetBanner() {
    const banner = $('account-reset-banner');
    if (!banner) return;
    const url = new URL(window.location.href);
    const forcedMode = String(url.searchParams.get('mode') || '').trim();
    const shouldShow = forcedMode === 'reset-required' || Boolean(session?.mustResetPassword);
    if (!shouldShow) {
      banner.setAttribute('hidden', '');
      banner.textContent = '';
      return;
    }
    banner.textContent = '当前账号仍处于临时密码状态。请先在本页完成改密，再返回工作台继续使用。';
    banner.removeAttribute('hidden');
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setFeedback('');
    const currentPassword = $('account-current-password')?.value || '';
    const newPassword = $('account-new-password')?.value || '';
    const confirmPassword = $('account-confirm-password')?.value || '';

    if (!currentPassword) {
      setFeedback('请输入当前密码');
      return;
    }
    if (!newPassword) {
      setFeedback('请输入新密码');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback('两次输入的新密码不一致');
      return;
    }

    try {
      const result = await persistence.changePassword({
        currentPassword,
        newPassword
      });
      session = {
        ...(session || {}),
        ...(result?.user || {}),
        mustResetPassword: false
      };
      $('account-password-form')?.reset();
      renderSessionProfile();
      renderResetBanner();
      setFeedback('密码已更新，当前会话已保留。', 'success');
      SiteShell.showToast('密码更新成功', 'success', 1800);
    } catch (error) {
      setFeedback(error.message || '密码更新失败');
    }
  }

  async function init() {
    SiteShell.bindThemeToggle(theme => SiteShell.syncThemePreference(persistence, theme));
    session = await persistence?.loadSession?.().catch(() => null);
    if (!session?.username) {
      SiteShell.redirect('/auth/', { next: '/account/' });
      return;
    }

    await SiteShell.applyThemeFromPreferences(persistence);
    SiteShell.renderPortalUserNav('portal-user-nav', session, {
      currentPage: 'account',
      nextPath: '/account/'
    });
    $('portal-logout-button')?.addEventListener('click', () => SiteShell.logoutAndRedirect(persistence, '/auth/'));
    $('account-password-form')?.addEventListener('submit', handlePasswordSubmit);

    renderSessionProfile();
    renderResetBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
