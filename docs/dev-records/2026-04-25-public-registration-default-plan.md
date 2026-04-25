# 公开注册默认关闭修复记录

## 目标
修复审查报告中“生产若忘记配置会默认开放公开注册”的风险，将公开注册改为默认关闭，并保留显式开启能力。

## 范围
- 修改 `server\config.js` 中 `PUBLIC_REGISTRATION_ENABLED` 的默认值。
- 新增聚焦测试，覆盖配置默认值、显式开启值、API 默认拒绝注册、显式开启后允许注册。
- 不修改前端注册页展示、不引入灰度开关、不调整管理员创建用户流程。

## 假设
- 更安全的默认值是 `PUBLIC_REGISTRATION_ENABLED=false`。
- 需要公开注册的环境可以通过环境变量或本地配置显式设置为 `true`。
- 现有自动化测试不依赖默认公开注册。

## 风险
- 依赖默认公开注册的开发或演示环境会需要显式配置。
- 前端注册入口仍可见，但默认提交会得到“暂未开放公开注册”的后端响应；是否隐藏入口属于后续 UX 任务。

## TODO
1. 新增聚焦测试：验证配置默认 `PUBLIC_REGISTRATION_ENABLED=false`。
2. 新增聚焦测试：验证显式 `PUBLIC_REGISTRATION_ENABLED=true` 可开启。
3. 新增聚焦测试：验证默认 API 注册返回 `public_registration_disabled`。
4. 新增聚焦测试：验证显式开启后 API 注册成功。
5. 修改 `server\config.js` 默认值。
6. 运行聚焦测试、认证历史测试、语法检查。
7. 复盘新问题、边界条件、遗漏点，并回写本文件。
8. 提交本轮公开注册默认关闭修复。

## 完成标准
- 未配置时 `createConfig().PUBLIC_REGISTRATION_ENABLED` 为 `false`。
- 设置 `PUBLIC_REGISTRATION_ENABLED=true` 时配置值为 `true`。
- 未配置时 `/api/auth/register` 返回 403 和稳定 reason。
- 显式开启时 `/api/auth/register` 可成功创建普通用户。
- 相关验证命令通过。

## 验证方式
- `node test-public-registration-config.js`
- `node test-auth-history.js`
- `npm run check`

## 执行记录
- 已完成根因调查：`server\config.js` 使用 `parseBooleanFlag(getConfigValue(..., 'true'), true)`，导致未配置时默认开启公开注册。
- TODO 1-4 已新增聚焦测试：`test-public-registration-config.js` 覆盖配置默认值、显式开启、默认 API 拒绝注册、显式开启 API 注册成功。
- 预修复验证：`node test-public-registration-config.js` 失败，失败点为 `PUBLIC_REGISTRATION_ENABLED should default to false`，符合预期。
- TODO 5 已完成：`server\config.js` 将 `PUBLIC_REGISTRATION_ENABLED` 默认值改为关闭，显式 `true` 仍可开启。
- 修复后聚焦验证：`node test-public-registration-config.js` 通过。

## 验证结果
- `node test-public-registration-config.js`：通过。覆盖默认关闭、显式开启、默认 API 拒绝、显式开启 API 成功。
- `node test-auth-history.js`：通过。认证、历史、会话、邀请、密码重置相关流程未回归。
- `npm run check`：通过。

## 复盘
- TODO 1-4 复盘：测试覆盖配置层和 API 层，避免只改配置但未验证真实注册路径。当前阻塞点为配置默认值，需要继续 TODO 5。
- TODO 5-7 复盘：默认关闭会让前端注册页默认得到后端拒绝提示；是否隐藏注册入口或展示“需管理员邀请”属于 UX 后续项，未纳入本轮最小安全修复。
