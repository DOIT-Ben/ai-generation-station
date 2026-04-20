(function () {
  'use strict';

  const SiteShell = window.SiteShell;
  const persistence = SiteShell?.getPersistence?.();
  const $ = SiteShell.$;
  let session = null;
  let adminUsers = [];
  let adminAuditState = getDefaultAuditState();

  function getDefaultAuditState() {
    return {
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 1,
      hasMore: false,
      loading: false,
      error: '',
      filters: {
        action: '',
        actorUsername: '',
        targetUsername: '',
        from: '',
        to: ''
      }
    };
  }

  function setFormFeedback(id, message, state = 'error') {
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

  function getAuditActionLabel(action) {
    if (action === 'user_create') return '创建用户';
    if (action === 'user_disable') return '禁用用户';
    if (action === 'user_role_change') return '角色变更';
    if (action === 'user_password_reset') return '密码重置';
    if (action === 'user_invite_issue') return '签发邀请';
    if (action === 'user_invite_resend') return '重发邀请';
    if (action === 'user_invite_revoke') return '撤销邀请';
    if (action === 'user_public_register') return '公开注册';
    return action || '未知动作';
  }

  function formatInvitationStatus(invitation) {
    if (!invitation?.active) return '无待激活邀请';
    const expiryText = SiteShell.formatTime(invitation.expiresAt);
    return expiryText ? `待激活 · ${expiryText} 前有效` : '待激活';
  }

  function resetAdminCreateForm() {
    $('admin-create-user-form')?.reset();
    if ($('admin-create-role')) $('admin-create-role').value = 'user';
    if ($('admin-create-plan')) $('admin-create-plan').value = 'free';
    setFormFeedback('admin-create-user-feedback', '');
  }

  function focusAdminResetTarget(userId) {
    const select = $('admin-reset-user-id');
    if (!select) return;
    select.value = userId || '';
    $('admin-reset-password')?.focus();
  }

  function renderUserList() {
    const list = $('admin-user-list');
    const empty = $('admin-user-empty');
    const select = $('admin-reset-user-id');
    if (!list || !empty || !select) return;

    const previousValue = select.value;
    select.innerHTML = ['<option value="">请选择用户</option>']
      .concat(adminUsers.map(user => `<option value="${user.id}">${user.username} · ${user.role} · ${user.status}</option>`))
      .join('');
    if (previousValue && adminUsers.some(user => user.id === previousValue)) {
      select.value = previousValue;
    }

    if (!adminUsers.length) {
      list.innerHTML = '';
      empty.removeAttribute('hidden');
      return;
    }

    empty.setAttribute('hidden', '');
    list.innerHTML = adminUsers.map(user => {
      const isSelf = user.id === session?.id;
      const nextStatus = user.status === 'active' ? 'disabled' : 'active';
      const nextRole = user.role === 'admin' ? 'user' : 'admin';
      const nextPlan = user.planCode === 'pro' ? 'free' : 'pro';
      const hasActiveInvitation = Boolean(user.invitation?.active);
      return `
        <article class="history-item">
          <div class="history-item-header">
            <strong>${SiteShell.escapeHtml(user.username)}</strong>
            <time>${user.lastLoginAt ? SiteShell.formatTime(user.lastLoginAt) : '从未登录'}</time>
          </div>
          <p>显示名：${SiteShell.escapeHtml(user.displayName || user.username)}</p>
          <p>状态：${SiteShell.escapeHtml(user.status)} · 角色：${SiteShell.escapeHtml(user.role)} · 套餐：${SiteShell.escapeHtml(user.planCode)}</p>
          <p>邮箱：${SiteShell.escapeHtml(user.email || '未设置')}</p>
          <p>邀请：${SiteShell.escapeHtml(formatInvitationStatus(user.invitation))}</p>
          <div class="history-actions">
            <button type="button" data-admin-invite-target="${user.id}" ${user.status !== 'active' || hasActiveInvitation ? 'disabled' : ''}>签发邀请</button>
            <button type="button" data-admin-invite-resend-target="${user.id}" ${user.status !== 'active' || !hasActiveInvitation ? 'disabled' : ''}>重发邀请</button>
            <button type="button" data-admin-invite-revoke-target="${user.id}" ${!hasActiveInvitation ? 'disabled' : ''}>撤销邀请</button>
            <button type="button" data-admin-reset-target="${user.id}">重置密码</button>
            <button type="button" data-admin-email-target="${user.id}">编辑邮箱</button>
            <button type="button" data-admin-user="${user.id}" data-admin-status="${nextStatus}" ${isSelf ? 'disabled' : ''}>${nextStatus === 'disabled' ? '禁用' : '启用'}</button>
            <button type="button" data-admin-user="${user.id}" data-admin-role="${nextRole}" ${isSelf ? 'disabled' : ''}>${nextRole === 'admin' ? '设为管理员' : '降为普通用户'}</button>
            <button type="button" data-admin-user="${user.id}" data-admin-plan="${nextPlan}">${nextPlan === 'pro' ? '设为 Pro' : '设为 Free'}</button>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderAuditPanel() {
    const summary = $('admin-audit-summary');
    const tableBody = $('admin-audit-table-body');
    const pageLabel = $('admin-audit-page-label');
    const prevButton = $('admin-audit-prev');
    const nextButton = $('admin-audit-next');
    if (!summary || !tableBody || !pageLabel || !prevButton || !nextButton) return;

    prevButton.disabled = adminAuditState.loading || adminAuditState.page <= 1;
    nextButton.disabled = adminAuditState.loading || !adminAuditState.hasMore;
    pageLabel.textContent = `第 ${adminAuditState.page || 1} / ${Math.max(1, adminAuditState.totalPages || 1)} 页`;

    if (adminAuditState.loading) {
      summary.textContent = '正在加载审计日志…';
      tableBody.innerHTML = '<tr><td colspan="6" class="audit-log-empty">正在加载审计日志…</td></tr>';
      return;
    }
    if (adminAuditState.error) {
      summary.textContent = adminAuditState.error;
      tableBody.innerHTML = `<tr><td colspan="6" class="audit-log-empty">${SiteShell.escapeHtml(adminAuditState.error)}</td></tr>`;
      return;
    }

    summary.textContent = `共 ${adminAuditState.total || 0} 条审计日志，当前显示第 ${adminAuditState.page || 1} 页。`;
    if (!adminAuditState.items.length) {
      tableBody.innerHTML = '<tr><td colspan="6" class="audit-log-empty">当前筛选条件下没有审计日志。</td></tr>';
      return;
    }

    tableBody.innerHTML = adminAuditState.items.map(log => `
      <tr>
        <td><div class="audit-log-copy"><strong>${SiteShell.escapeHtml(SiteShell.formatTime(log.createdAt) || '-')}</strong><span>ID ${SiteShell.escapeHtml(String(log.id || '-'))}</span></div></td>
        <td><span class="audit-log-pill">${SiteShell.escapeHtml(getAuditActionLabel(log.action))}</span></td>
        <td><div class="audit-log-copy"><strong>${SiteShell.escapeHtml(log.actorUsername || '系统')}</strong><span>${SiteShell.escapeHtml(log.actorRole || '-')}</span></div></td>
        <td><div class="audit-log-copy"><strong>${SiteShell.escapeHtml(log.targetUsername || '-')}</strong><span>${SiteShell.escapeHtml(log.targetRole || '-')}</span></div></td>
        <td><div class="audit-log-copy"><strong>${SiteShell.escapeHtml(log.actorIp || '未知来源')}</strong><span>${SiteShell.escapeHtml(log.actorUserAgent || '未记录 UA')}</span></div></td>
        <td>
          <details class="audit-log-details">
            <summary>查看详情</summary>
            <pre>${SiteShell.escapeHtml(JSON.stringify(log.details || {}, null, 2))}</pre>
          </details>
        </td>
      </tr>
    `).join('');
  }

  async function loadAdminUsers() {
    adminUsers = await persistence.getAdminUsers();
    renderUserList();
  }

  async function loadAdminAuditLogs(overrides = {}) {
    adminAuditState = {
      ...adminAuditState,
      loading: true,
      error: '',
      page: Math.max(1, Number(overrides.page || adminAuditState.page || 1)),
      pageSize: Math.max(1, Number(overrides.pageSize || adminAuditState.pageSize || 10)),
      filters: {
        ...(adminAuditState.filters || {}),
        ...(overrides.filters || {})
      }
    };
    renderAuditPanel();

    try {
      const result = await persistence.getAdminAuditLogs({
        page: adminAuditState.page,
        pageSize: adminAuditState.pageSize,
        action: adminAuditState.filters.action,
        actorUsername: adminAuditState.filters.actorUsername,
        targetUsername: adminAuditState.filters.targetUsername,
        from: adminAuditState.filters.from,
        to: adminAuditState.filters.to
      });
      adminAuditState = {
        ...adminAuditState,
        loading: false,
        items: result.items || [],
        total: Number(result.total || 0),
        totalPages: Number(result.totalPages || 1),
        hasMore: Boolean(result.hasMore),
        page: Number(result.page || adminAuditState.page),
        pageSize: Number(result.pageSize || adminAuditState.pageSize)
      };
    } catch (error) {
      adminAuditState = {
        ...adminAuditState,
        loading: false,
        error: error.message || '审计日志加载失败'
      };
    }
    renderAuditPanel();
  }

  async function createAdminUserFromForm(event) {
    event.preventDefault();
    setFormFeedback('admin-create-user-feedback', '');
    const payload = {
      username: $('admin-create-username')?.value?.trim(),
      email: $('admin-create-email')?.value?.trim(),
      displayName: $('admin-create-display-name')?.value?.trim(),
      password: $('admin-create-password')?.value || '',
      role: $('admin-create-role')?.value || 'user',
      planCode: $('admin-create-plan')?.value || 'free'
    };

    try {
      const user = await persistence.createAdminUser(payload);
      resetAdminCreateForm();
      setFormFeedback('admin-create-user-feedback', `账号 ${user?.username || payload.username} 已创建。`, 'success');
      await loadAdminUsers();
      await loadAdminAuditLogs({ page: 1 });
      SiteShell.showToast('用户已创建', 'success', 1500);
    } catch (error) {
      setFormFeedback('admin-create-user-feedback', error.message || '用户创建失败');
      SiteShell.showToast(error.message || '用户创建失败', 'error', 1800);
    }
  }

  async function resetAdminUserPasswordFromForm(event) {
    event.preventDefault();
    const userId = $('admin-reset-user-id')?.value || '';
    const password = $('admin-reset-password')?.value || '';
    if (!userId) {
      setFormFeedback('admin-reset-password-feedback', '请先选择要重置密码的账号');
      return;
    }
    setFormFeedback('admin-reset-password-feedback', '');
    try {
      const result = await persistence.resetAdminUserPassword(userId, password);
      if ($('admin-reset-password')) $('admin-reset-password').value = '';
      setFormFeedback('admin-reset-password-feedback', result.sessionRetained ? '密码已重置，当前管理员会话已保留。' : '密码已重置，目标账号下次登录后需要先修改临时密码。', 'success');
      await loadAdminUsers();
      await loadAdminAuditLogs({ page: 1 });
      SiteShell.showToast('密码已重置', 'success', 1500);
    } catch (error) {
      setFormFeedback('admin-reset-password-feedback', error.message || '密码重置失败');
      SiteShell.showToast(error.message || '密码重置失败', 'error', 1800);
    }
  }

  async function updateAdminUser(userId, patch) {
    await persistence.updateAdminUser(userId, patch);
    await loadAdminUsers();
    await loadAdminAuditLogs({ page: 1 });
    SiteShell.showToast(Object.prototype.hasOwnProperty.call(patch || {}, 'email') ? '邮箱已更新' : '用户状态已更新', 'success', 1500);
  }

  async function editAdminUserEmail(userId) {
    const targetUser = adminUsers.find(user => user.id === userId);
    if (!targetUser) {
      SiteShell.showToast('未找到目标账号', 'error', 1600);
      return;
    }
    const nextEmail = window.prompt(`请输入 ${targetUser.username} 的邮箱地址，留空可清除。`, targetUser.email || '');
    if (nextEmail === null) return;
    const normalizedEmail = nextEmail.trim();
    if (normalizedEmail === String(targetUser.email || '').trim()) return;
    try {
      await updateAdminUser(userId, { email: normalizedEmail });
    } catch (error) {
      SiteShell.showToast(error.message || '邮箱更新失败', 'error', 1800);
    }
  }

  async function issueInvitation(method, userId) {
    const map = {
      issue: persistence.issueAdminInvitation,
      resend: persistence.resendAdminInvitation,
      revoke: persistence.revokeAdminInvitation
    };
    const handler = map[method];
    if (!handler || !userId) return;
    setFormFeedback('admin-invite-feedback', '');
    try {
      const result = await handler.call(persistence, userId);
      if (method === 'revoke') {
        setFormFeedback('admin-invite-feedback', `已撤销 ${result.user?.username || '目标账号'} 的待激活邀请链接。`, 'success');
      } else {
        const absolutePreviewUrl = result.previewUrl ? new URL(result.previewUrl, window.location.origin).href : '';
        const successMessage = absolutePreviewUrl
          ? `已为 ${result.user?.username || '目标账号'} 生成邀请链接：${absolutePreviewUrl}`
          : `已向 ${result.recipientEmail || '目标邮箱'} 发送邀请邮件。`;
        setFormFeedback('admin-invite-feedback', successMessage, 'success');
        if (absolutePreviewUrl) {
          navigator.clipboard?.writeText(absolutePreviewUrl).catch(() => {});
        }
      }
      await loadAdminUsers();
      await loadAdminAuditLogs({ page: 1 });
      SiteShell.showToast(method === 'revoke' ? '邀请已撤销' : '邀请处理成功', 'success', 1600);
    } catch (error) {
      setFormFeedback('admin-invite-feedback', error.message || '邀请处理失败');
      SiteShell.showToast(error.message || '邀请处理失败', 'error', 1800);
    }
  }

  function handleAuditFilterSubmit(event) {
    event.preventDefault();
    adminAuditState.filters = {
      action: $('admin-audit-action')?.value || '',
      actorUsername: $('admin-audit-actor')?.value?.trim() || '',
      targetUsername: $('admin-audit-target')?.value?.trim() || '',
      from: $('admin-audit-from')?.value || '',
      to: $('admin-audit-to')?.value || ''
    };
    loadAdminAuditLogs({ page: 1, filters: adminAuditState.filters });
  }

  function resetAuditFilters() {
    adminAuditState.filters = {
      action: '',
      actorUsername: '',
      targetUsername: '',
      from: '',
      to: ''
    };
    ['admin-audit-action', 'admin-audit-actor', 'admin-audit-target', 'admin-audit-from', 'admin-audit-to'].forEach(id => {
      if ($(id)) $(id).value = '';
    });
    loadAdminAuditLogs({ page: 1, filters: adminAuditState.filters });
  }

  function changeAuditPage(delta) {
    const nextPage = Math.max(1, (adminAuditState.page || 1) + delta);
    if (nextPage === adminAuditState.page) return;
    loadAdminAuditLogs({ page: nextPage });
  }

  function bindListActions() {
    document.addEventListener('click', event => {
      const adminButton = event.target.closest('[data-admin-user]');
      if (adminButton) {
        const patch = {};
        if (adminButton.dataset.adminStatus) patch.status = adminButton.dataset.adminStatus;
        if (adminButton.dataset.adminRole) patch.role = adminButton.dataset.adminRole;
        if (adminButton.dataset.adminPlan) patch.planCode = adminButton.dataset.adminPlan;
        updateAdminUser(adminButton.dataset.adminUser, patch).catch(error => {
          SiteShell.showToast(error.message || '用户更新失败', 'error', 1800);
        });
        return;
      }
      const resetButton = event.target.closest('[data-admin-reset-target]');
      if (resetButton) {
        focusAdminResetTarget(resetButton.dataset.adminResetTarget);
        return;
      }
      const emailButton = event.target.closest('[data-admin-email-target]');
      if (emailButton) {
        editAdminUserEmail(emailButton.dataset.adminEmailTarget);
        return;
      }
      const inviteButton = event.target.closest('[data-admin-invite-target]');
      if (inviteButton) {
        issueInvitation('issue', inviteButton.dataset.adminInviteTarget);
        return;
      }
      const resendButton = event.target.closest('[data-admin-invite-resend-target]');
      if (resendButton) {
        issueInvitation('resend', resendButton.dataset.adminInviteResendTarget);
        return;
      }
      const revokeButton = event.target.closest('[data-admin-invite-revoke-target]');
      if (revokeButton) {
        issueInvitation('revoke', revokeButton.dataset.adminInviteRevokeTarget);
      }
    });
  }

  async function init() {
    SiteShell.bindThemeToggle(theme => SiteShell.syncThemePreference(persistence, theme));
    session = await persistence?.loadSession?.().catch(() => null);
    if (!session?.username) {
      SiteShell.redirect('/auth/', { next: '/admin/' });
      return;
    }
    if (session.role !== 'admin') {
      SiteShell.redirect('/account/');
      return;
    }

    await SiteShell.applyThemeFromPreferences(persistence);
    SiteShell.renderPortalUserNav('portal-user-nav', session, {
      currentPage: 'admin',
      nextPath: '/admin/'
    });
    $('portal-logout-button')?.addEventListener('click', () => SiteShell.logoutAndRedirect(persistence, '/auth/'));
    $('admin-create-user-form')?.addEventListener('submit', createAdminUserFromForm);
    $('admin-reset-password-form')?.addEventListener('submit', resetAdminUserPasswordFromForm);
    $('admin-audit-form')?.addEventListener('submit', handleAuditFilterSubmit);
    $('admin-audit-reset')?.addEventListener('click', resetAuditFilters);
    $('admin-audit-prev')?.addEventListener('click', () => changeAuditPage(-1));
    $('admin-audit-next')?.addEventListener('click', () => changeAuditPage(1));
    bindListActions();

    await loadAdminUsers();
    await loadAdminAuditLogs({ page: 1 });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
