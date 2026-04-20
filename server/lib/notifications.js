const { buildInvitationEmail, buildPasswordResetEmail } = require('./email-templates');

function normalizeDeliveryMode(mode) {
    const normalized = String(mode || '').trim().toLowerCase();
    if (['local_preview', 'resend', 'disabled'].includes(normalized)) {
        return normalized;
    }
    return 'local_preview';
}

function buildPreviewPath(kind, token) {
    const param = kind === 'invite' ? 'invite' : 'reset';
    return `/?${param}=${encodeURIComponent(String(token || '').trim())}`;
}

function buildAbsoluteActionUrl(appBaseUrl, relativePath) {
    return new URL(relativePath, String(appBaseUrl || 'http://localhost:18791')).href;
}

function createNotificationService(options = {}) {
    const mode = normalizeDeliveryMode(options.mode);
    const appBaseUrl = String(options.appBaseUrl || 'http://localhost:18791').trim() || 'http://localhost:18791';
    const fromEmail = String(options.fromEmail || '').trim();
    const resendApiKey = String(options.resendApiKey || '').trim();
    const fetchImpl = options.fetchImpl || global.fetch?.bind(global);

    async function sendResendEmail(message) {
        if (!fetchImpl) {
            return {
                ok: false,
                status: 503,
                deliveryMode: 'resend',
                error: '当前环境不支持邮件发送'
            };
        }
        if (!fromEmail) {
            return {
                ok: false,
                status: 503,
                deliveryMode: 'resend',
                error: '当前环境未配置发件邮箱'
            };
        }
        if (!resendApiKey) {
            return {
                ok: false,
                status: 503,
                deliveryMode: 'resend',
                error: '当前环境未配置邮件发送 API Key'
            };
        }

        let response;
        try {
            response = await fetchImpl('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: fromEmail,
                    to: [message.toEmail],
                    subject: message.subject,
                    html: message.html,
                    text: message.text
                })
            });
        } catch (error) {
            return {
                ok: false,
                status: 502,
                deliveryMode: 'resend',
                error: error.message || '邮件发送失败'
            };
        }

        let data = {};
        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            return {
                ok: false,
                status: 502,
                deliveryMode: 'resend',
                error: data?.message || data?.error || '邮件发送失败'
            };
        }

        return {
            ok: true,
            status: 200,
            deliveryMode: 'resend',
            externalMessageId: data?.id || null
        };
    }

    async function sendInvitation(payload = {}) {
        const previewUrl = buildPreviewPath('invite', payload.token);
        if (mode === 'local_preview') {
            return {
                ok: true,
                status: 200,
                deliveryMode: 'local_preview',
                previewUrl,
                recipientEmail: payload.user?.email || null
            };
        }
        if (mode === 'disabled') {
            return {
                ok: false,
                status: 503,
                deliveryMode: 'disabled',
                error: '当前环境未启用邮件发送'
            };
        }
        if (!payload.user?.email) {
            return {
                ok: false,
                status: 409,
                deliveryMode: 'resend',
                error: '目标账号未设置邮箱地址'
            };
        }

        const actionUrl = buildAbsoluteActionUrl(appBaseUrl, previewUrl);
        const email = buildInvitationEmail({
            actionUrl,
            expiresAt: payload.expiresAt,
            user: payload.user
        });
        const sent = await sendResendEmail({
            toEmail: payload.user.email,
            subject: email.subject,
            html: email.html,
            text: email.text
        });
        if (!sent.ok) return sent;
        return {
            ...sent,
            recipientEmail: payload.user.email
        };
    }

    async function sendPasswordReset(payload = {}) {
        const previewUrl = buildPreviewPath('reset', payload.token);
        if (mode === 'local_preview') {
            return {
                ok: true,
                status: 200,
                deliveryMode: 'local_preview',
                previewUrl
            };
        }
        if (mode === 'disabled') {
            return {
                ok: false,
                status: 503,
                deliveryMode: 'disabled',
                error: '当前环境未启用邮件发送'
            };
        }
        if (!payload.user?.email) {
            return {
                ok: false,
                status: 409,
                deliveryMode: 'resend',
                error: '目标账号未设置邮箱地址'
            };
        }

        const actionUrl = buildAbsoluteActionUrl(appBaseUrl, previewUrl);
        const email = buildPasswordResetEmail({
            actionUrl,
            expiresAt: payload.expiresAt,
            user: payload.user
        });
        const sent = await sendResendEmail({
            toEmail: payload.user.email,
            subject: email.subject,
            html: email.html,
            text: email.text
        });
        if (!sent.ok) return sent;
        return sent;
    }

    return {
        getDeliveryMode() {
            return mode;
        },
        async sendInvitation(payload) {
            return sendInvitation(payload);
        },
        async sendPasswordReset(payload) {
            return sendPasswordReset(payload);
        }
    };
}

module.exports = {
    createNotificationService
};
