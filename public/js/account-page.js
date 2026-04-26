(function () {
  'use strict';

  const SiteShell = window.SiteShell;
  const persistence = SiteShell?.getPersistence?.();
  const $ = SiteShell.$;
  let session = null;

  function setText(id, value) {
    const element = $(id);
    if (!element) return;
    element.textContent = value;
  }

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

  function setPasswordCheck(id, passed, pending = false) {
    const element = $(id);
    if (!element) return;
    element.dataset.state = pending ? 'pending' : (passed ? 'success' : 'error');
  }

  function renderPasswordChecklist() {
    const currentPassword = $('account-current-password')?.value || '';
    const newPassword = $('account-new-password')?.value || '';
    const confirmPassword = $('account-confirm-password')?.value || '';
    const submitButton = $('account-password-submit');

    const hasLength = newPassword.length >= 8;
    const isDifferent = Boolean(newPassword) && newPassword !== currentPassword;
    const isMatch = Boolean(newPassword) && Boolean(confirmPassword) && newPassword === confirmPassword;

    setPasswordCheck('account-password-check-length', hasLength, !newPassword);
    setPasswordCheck('account-password-check-different', isDifferent, !newPassword);
    setPasswordCheck('account-password-check-match', isMatch, !confirmPassword);

    if (submitButton) {
      submitButton.disabled = !(currentPassword && hasLength && isDifferent && isMatch);
    }
  }

  function renderSessionProfile() {
    if (!session) return;
    const displayName = session.displayName || session.username || '-';
    const username = session.username || '-';
    const email = session.email || '未设置';
    const roleLabel = SiteShell.getRoleDisplayName(session.role);
    const planLabel = SiteShell.getPlanDisplayName(session.planCode);
    const mustResetPassword = Boolean(session.mustResetPassword);
    const securityHeading = mustResetPassword ? '需立即修改' : '保护中';
    const identitySeed = String(displayName === '-' ? username : displayName || username || '?').trim();
    const avatarCharacter = identitySeed ? identitySeed.charAt(0).toUpperCase() : '?';

    setText('account-display-name', displayName);
    setText('account-username-line', `账号：${username}`);
    setText('account-email-line', `邮箱：${email}`);
    setText('account-overview-display-name', displayName);
    setText('account-overview-username', username);
    setText('account-overview-email', email);
    setText('account-overview-plan', planLabel);
    setText('account-role-pill', `角色：${roleLabel}`);
    setText('account-plan-pill', `套餐：${planLabel}`);
    setText('account-password-pill', `密码状态：${mustResetPassword ? '需立即修改' : '正常'}`);
    setText('account-avatar-badge', avatarCharacter);
    setText('account-password-status-heading', securityHeading);
    setText(
      'account-password-status-note',
      mustResetPassword
        ? '当前账号仍在使用临时密码。完成改密后，再返回工作台继续使用。'
        : '建议定期更换密码，并避免在公共设备上长期保留登录状态。'
    );
    setText('account-role-heading', roleLabel);
    setText(
      'account-security-entry-note',
      session.role === 'admin'
        ? '你当前拥有管理员权限，可以从快捷入口进入后台。'
        : '当前账号为普通成员，这里只保留和你本人有关的安全设置。'
    );
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
      renderPasswordChecklist();
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
    ['account-current-password', 'account-new-password', 'account-confirm-password'].forEach(id => {
      $(id)?.addEventListener('input', renderPasswordChecklist);
    });

    renderSessionProfile();
    renderResetBanner();
    renderPasswordChecklist();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
