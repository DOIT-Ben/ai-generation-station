function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatExpiry(expiresAt) {
    const date = new Date(Number(expiresAt || 0));
    if (Number.isNaN(date.getTime())) {
        return '稍后失效';
    }
    return date.toLocaleString('zh-CN', {
        hour12: false,
        timeZone: 'Asia/Shanghai'
    });
}

function buildInvitationEmail({ actionUrl, expiresAt, user }) {
    const username = escapeHtml(user?.displayName || user?.username || '成员账号');
    const expiryText = escapeHtml(formatExpiry(expiresAt));
    const safeUrl = escapeHtml(actionUrl);
    return {
        subject: '邀请你加入 AI 内容生成站',
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.7;color:#111827;">
            <h2 style="margin:0 0 16px;">欢迎加入 AI 内容生成站</h2>
            <p>${username}，管理员已为你创建账号，请点击下方按钮设置登录密码并激活账号。</p>
            <p style="margin:24px 0;">
              <a href="${safeUrl}" style="background:#111827;color:#ffffff;padding:12px 18px;border-radius:999px;text-decoration:none;display:inline-block;">激活账号并设置密码</a>
            </p>
            <p>如果按钮无法点击，可复制以下地址到浏览器打开：</p>
            <p><a href="${safeUrl}">${safeUrl}</a></p>
            <p>该链接将在 <strong>${expiryText}</strong> 失效。</p>
          </div>
        `.trim(),
        text: [
            '欢迎加入 AI 内容生成站。',
            `${user?.displayName || user?.username || '成员账号'}，管理员已为你创建账号，请打开以下链接设置登录密码并激活账号：`,
            actionUrl,
            `该链接将在 ${formatExpiry(expiresAt)} 失效。`
        ].join('\n')
    };
}

function buildPasswordResetEmail({ actionUrl, expiresAt, user }) {
    const username = escapeHtml(user?.displayName || user?.username || '成员账号');
    const expiryText = escapeHtml(formatExpiry(expiresAt));
    const safeUrl = escapeHtml(actionUrl);
    return {
        subject: 'AI 内容生成站密码重置',
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.7;color:#111827;">
            <h2 style="margin:0 0 16px;">重置你的登录密码</h2>
            <p>${username}，我们收到了你的密码重置请求。请点击下方按钮继续设置新密码。</p>
            <p style="margin:24px 0;">
              <a href="${safeUrl}" style="background:#111827;color:#ffffff;padding:12px 18px;border-radius:999px;text-decoration:none;display:inline-block;">重置密码</a>
            </p>
            <p>如果按钮无法点击，可复制以下地址到浏览器打开：</p>
            <p><a href="${safeUrl}">${safeUrl}</a></p>
            <p>该链接将在 <strong>${expiryText}</strong> 失效。</p>
          </div>
        `.trim(),
        text: [
            '我们收到了你的密码重置请求。',
            `${user?.displayName || user?.username || '成员账号'}，请打开以下链接设置新密码：`,
            actionUrl,
            `该链接将在 ${formatExpiry(expiresAt)} 失效。`
        ].join('\n')
    };
}

module.exports = {
    buildInvitationEmail,
    buildPasswordResetEmail
};
