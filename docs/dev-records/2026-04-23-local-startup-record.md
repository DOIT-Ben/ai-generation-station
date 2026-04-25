# 本地前后端启动记录

## 目标
- 在当前项目中按仓库既有方式启动可访问的本地服务，使前端页面和后端接口同时可用。

## 范围
- 仅处理本仓库本地启动。
- 仅使用仓库已有启动与检查脚本。
- 不修改业务代码，不扩展功能，不重构模块。

## 假设
- 当前项目归属目录为 `e:\desktop\AI\02_Agents\lab\AI-Generation-Stations`。
- 仓库当前前端静态资源由 `public` 提供，后端接口由 `server\index.js` 提供，统一通过 `scripts\start-local-service.ps1` 启动。
- 依赖已存在，因为仓库根目录已有 `node_modules`。
- 默认启动端口使用仓库运行手册记录的 `18791`。

## 风险
- `18791` 端口可能被其他非仓库进程占用，导致启动被脚本拒绝。
- 本地环境变量或 PowerShell profile 依赖异常，可能导致服务无法通过健康检查。
- 服务可能只通过基础健康检查，未通过认证契约检查，导致前端登录态相关页面不可用。

## TODO
1. 确认仓库实际启动入口、默认端口、健康检查与认证契约检查方式。
2. 使用仓库标准脚本启动本地服务，不额外发散到其他启动方案。
3. 验证首页、健康接口、认证契约接口可访问，并记录结果。
4. 复盘启动过程中出现的新问题、边界条件和遗漏点，必要时回写记录。

## 完成标准
- 本地服务成功启动在 `http://127.0.0.1:18791\`。
- `scripts\check-local-service.ps1 -Port 18791` 返回健康状态。
- `/api/health` 返回 `200`。
- `/api/auth/csrf` 返回 `200` 且包含认证契约所需字段。

## 验证方式
- 执行 `powershell -ExecutionPolicy Bypass -File .\scripts\start-local-service.ps1 -Port 18791`。
- 执行 `powershell -ExecutionPolicy Bypass -File .\scripts\check-local-service.ps1 -Port 18791 -Json`。
- 直接请求 `http://127.0.0.1:18791\api\health`。
- 直接请求 `http://127.0.0.1:18791\api\auth\csrf`。

## 执行记录
- 已确认实际启动入口为 `scripts\start-local-service.ps1`，其内部通过 `server\index.js` 启动统一本地服务。
- 已确认默认本地端口为 `18791`，并通过 `scripts\check-local-service.ps1` 校验健康状态。
- 已执行 `powershell -ExecutionPolicy Bypass -File .\scripts\start-local-service.ps1 -Port 18791`。
- 启动后继续执行了状态检查、首页访问、`/api/health` 访问、`/api/auth/csrf` 访问。

## 验证结果
- `scripts\check-local-service.ps1 -Port 18791 -Json` 返回：
  - `healthy: true`
  - `apiHealthy: true`
  - `apiStatusCode: 200`
  - `authContractHealthy: true`
  - `authContractStatusCode: 200`
  - `managedPid: 54132`
  - `listenerPid: 54132`
- `http://127.0.0.1:18791\` 访问状态码为 `200`。
- `http://127.0.0.1:18791\api\health` 返回状态正常，响应体包含 `status: ok`。
- `http://127.0.0.1:18791\api\auth\csrf` 返回状态正常，响应体包含 `csrfToken` 与 `headerName`。

## 复盘
- 本次仓库虽然存在 `frontend` 与 `backend` 目录，但本地启动主线并不是双进程开发模式，而是单个 Node 服务统一提供前端静态页面与后端 API。
- 仓库已有标准化启动、停止、检查脚本，当前任务不需要额外引入新的启动方式。
- 本次未发现阻塞性新问题，暂无需补充新的主线 TODO。
- 边界条件已确认：如果未来 `18791` 被非仓库进程占用，标准启动脚本会拒绝重复启动，需要先处理占用进程。
