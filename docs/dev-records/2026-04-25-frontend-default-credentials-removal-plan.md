# 前端默认凭据移除修复记录

## 目标
修复审查报告中“前端包保留默认账号密码常量”的问题，避免浏览器静态资源公开默认凭据语义。

## 范围
- 修改 `public\js\app-shell.js`，移除 `AUTH` 默认账号密码和本地 `authenticate` 导出。
- 修改 `test-frontend-state.js` 中依赖固定前端凭据的测试。
- 新增聚焦测试，扫描前端包中不再包含默认密码和本地认证导出。
- 不修改后端种子账号配置、不修改登录 API、不调整前端登录页 UX。

## 假设
- 当前真实认证走 `createRemotePersistence().login()` 调用后端 `/api/auth/login`。
- `AppShell.authenticate` 只被测试使用，前端运行代码没有依赖它。
- 后端默认开发密码问题已由生产配置校验约束；本轮只处理前端包泄露。

## 风险
- 若有未被测试覆盖的旧本地登录 fallback 依赖 `AppShell.authenticate`，移除后会暴露问题；当前搜索未发现运行时代码引用。
- `test-frontend-state.js` 需要从“固定凭据认证”改为“前端不导出本地认证”。

## TODO
1. 新增聚焦测试：验证 `public\js\app-shell.js` 不包含默认密码 `AIGS2026!`。
2. 新增聚焦测试：验证 `AppShell` 不再导出 `AUTH` 和 `authenticate`。
3. 修改 `public\js\app-shell.js`，移除 `AUTH` 和 `authenticate`。
4. 修改 `test-frontend-state.js`，更新前端认证测试期望。
5. 运行聚焦测试、前端状态测试、前端测试脚本、语法检查。
6. 复盘新问题、边界条件、遗漏点，并回写本文件。
7. 提交本轮前端默认凭据移除修复。

## 完成标准
- 前端静态包不再包含 `AIGS2026!`。
- `AppShell.AUTH` 和 `AppShell.authenticate` 不再作为前端 API 暴露。
- 远端认证相关方法仍存在并通过测试。
- 相关验证命令通过。

## 验证方式
- `node test-frontend-default-credentials.js`
- `node test-frontend-state.js`
- `npm run test:frontend`
- `npm run check`

## 执行记录
- 已完成根因调查：`public\js\app-shell.js` 顶部定义 `AUTH = { username: 'studio', password: 'AIGS2026!' }`，并导出 `authenticate`；搜索显示运行时代码未引用，仅 `test-frontend-state.js` 断言该固定凭据。
- TODO 1-2 已新增聚焦测试：`test-frontend-default-credentials.js` 覆盖前端源码不包含默认密码、不导出 `AUTH`、不导出 `authenticate`。
- 预修复验证：`node test-frontend-default-credentials.js` 失败，失败点为前端包仍包含默认后端密码，符合预期。
- TODO 3 已完成：`public\js\app-shell.js` 移除 `AUTH` 和 `authenticate` 导出。
- TODO 4 已完成：`test-frontend-state.js` 改为断言前端不暴露固定凭据，并保留远端认证 persistence。
- 修复后聚焦验证：`node test-frontend-default-credentials.js` 和 `node test-frontend-state.js` 通过。

## 验证结果
- `node test-frontend-default-credentials.js`：通过。
- `node test-frontend-state.js`：通过。
- `npm run test:frontend`：通过，前端状态和页面标记测试通过。
- `npm run check`：通过。

## 复盘
- TODO 1-2 复盘：测试同时覆盖源码和模块导出，避免只删除字符串但仍保留本地认证 API。当前阻塞点为 `public\js\app-shell.js` 和 `test-frontend-state.js`，需要继续 TODO 3-4。
- TODO 3-6 复盘：运行时代码没有发现 `AppShell.authenticate` 引用，移除后前端测试通过。后端默认开发账号仍由 `server\config.js` 管理，生产环境已有非默认密码校验；本轮不改后端种子逻辑。
