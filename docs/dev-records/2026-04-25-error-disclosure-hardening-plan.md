# 后端错误细节泄露修复记录

## 目标
修复审查报告中“后端错误响应泄露内部异常细节”的问题，避免客户端看到内部异常消息、数据库状态细节或活跃管理员数量。

## 范围
- 修改 `server\index.js` 的通用异常响应。
- 修改 `server\routes\system.js` 的健康检查响应。
- 新增一个聚焦测试，覆盖通用异常响应和健康检查响应脱敏。

## 假设
- 服务端日志可以保留内部异常，客户端响应必须使用稳定的通用错误文案。
- `/api/health` 是公开探活接口，只需要返回基础可用性信息，不需要公开 `activeAdminCount`。
- 本轮不调整鉴权、数据库结构、CI 或灰度发布流程。

## 风险
- 过度收敛健康检查字段可能影响依赖 `activeAdminCount` 的外部监控；当前代码和测试只断言 `status`、`database` 等基础字段，未发现必要依赖。
- 通用错误文案改变可能影响前端错误展示；保留 `reason` 字段可降低调用方判断成本。

## TODO
1. 新增失败测试：验证 `/api/chat/models` 触发内部异常时，响应不包含内部异常消息。
2. 新增失败测试：验证健康检查成功响应不包含 `activeAdminCount`。
3. 新增失败测试：验证健康检查异常响应不包含内部异常消息。
4. 修改 `server\index.js`，通用 catch 只返回脱敏错误。
5. 修改 `server\routes\system.js`，健康检查只返回基础信息并脱敏异常。
6. 运行聚焦测试、语法检查和相关安全测试。
7. 复盘新问题、边界条件、遗漏点，并回写本文件。

## 完成标准
- 客户端 500 响应不再包含 `error.message` 原文。
- 健康检查成功响应不再包含 `activeAdminCount`。
- 健康检查失败响应不再包含内部异常原文。
- 新增测试能覆盖以上行为。
- `npm run check` 和相关安全测试通过。

## 验证方式
- `node test-error-disclosure.js`
- `npm run check`
- `node test-security-gateway.js`

## 执行记录
- 已完成根因调查：`server\index.js` 通用 catch 直接返回 `error.message`；`server\routes\system.js` 健康检查失败响应返回 `error.message`，成功响应暴露 `activeAdminCount`。
- TODO 1-3 已新增聚焦测试：`test-error-disclosure.js` 覆盖通用异常脱敏、健康检查成功响应字段、健康检查失败脱敏。
- 预修复验证：`node test-error-disclosure.js` 失败，失败点为通用 500 响应包含内部异常 `INTERNAL_CHAT_MODEL_SECRET_42`，符合预期。
- TODO 4 已完成：`server\index.js` 通用异常响应改为 `{ error: '服务器内部错误，请稍后重试', reason: 'internal_error' }`，内部异常仅写服务端日志。
- TODO 5 已完成：`server\routes\system.js` 健康检查成功响应移除 `activeAdminCount`，失败响应改为通用文案和 `health_check_failed`。
- 修复后聚焦验证：`node test-error-disclosure.js` 通过。

## 验证结果
- `node test-error-disclosure.js`：通过。覆盖通用 500 响应脱敏、健康检查成功响应不暴露 `activeAdminCount`、健康检查失败响应脱敏。
- `npm run check`：通过。`server\index.js` 语法检查通过。
- `node test-security-gateway.js`：通过。现有健康检查、安全响应头、CORS、CSRF、Secure Cookie 相关行为未回归。

## 复盘
- TODO 1-3 复盘：测试通过真实登录路径触发 `/api/chat/models` 的 handler 异常，能覆盖 `server\index.js` 通用 catch；健康检查使用直接路由单测，避免为测试扩大生产接口。当前阻塞点属于必修问题，需要继续按 TODO 4-5 修复。
- TODO 4 复盘：最小改动满足客户端脱敏，保留 `reason` 便于前端和测试判断；未引入请求追踪 ID，避免本轮扩大范围。
- TODO 5 复盘：健康检查仍调用 `countActiveAdmins()` 作为数据库可用性探测，但不再把数量暴露给公开响应；外部监控若曾依赖该字段，需要后续单独评估为受保护管理接口。
- TODO 6-7 复盘：本轮验证通过。新发现的非阻塞事项是服务端日志仍记录原始异常，属于内部可观测性策略问题；当前任务目标是客户端脱敏，未纳入本轮改动，后续如要做日志脱敏或请求追踪 ID，应单独规划。
