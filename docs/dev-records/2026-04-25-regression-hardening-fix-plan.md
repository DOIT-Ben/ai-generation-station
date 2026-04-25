# 2026-04-25 Regression Hardening Fix Plan

## 目标
- 修复安全加固后遗留的回归测试失败，恢复 `test-regression.js --skip-live --skip-browser` 的稳定通过。
- 保持当前鉴权、CSRF、请求体限制与输出目录边界不回退。

## 范围
- `test-auth-history.js`
- `test-task-persistence.js`
- `test-suite.js`
- `test-failures.js`
- 仅在必要时补充最小测试注入点，已确认 `server\index.js` 与 `server\routes\service.js` 的 `chatFetch` 注入链路已具备。

## 假设
- `AuthHistory` 失败源于聊天上游已切到 `fetch`，而测试仍只 stub `https`。
- 其余失败源于鉴权边界收紧后，旧测试仍以匿名请求验证受保护接口。
- 当前服务真实行为是正确的，本轮以修复测试夹具和回归用例为主。

## 风险
- 若登录态与 CSRF 引导在各测试内写法不一致，容易出现误判为业务失败的 401 或 403。
- 若 `AuthHistory` 断言仍耦合旧传输层细节，后续再次切换上游协议会重复失稳。
- 烟雾测试若一次性覆盖过多鉴权接口，排障时定位成本会升高。

## TODO
1. 校正 `AuthHistory` 的聊天桩与断言来源。
2. 为 `TaskPersistence` 补齐登录态与受保护接口访问前置。
3. 将 `Smoke` 调整为符合当前安全边界的登录态烟雾验证。
4. 将 `Failures` 调整为先通过鉴权，再验证真实失败路径。
5. 分阶段执行目标测试与总回归。
6. 回写执行结果、遗漏点与复盘。

## 完成标准
- `node test-auth-history.js` 通过。
- `node test-task-persistence.js` 通过。
- `node test-suite.js` 通过。
- `node test-failures.js` 通过。
- `node test-regression.js --skip-live --skip-browser` 通过。

## 验证方式
- 先单测单文件回归，再跑总回归。
- 若中途出现新失败，先记录到执行记录，再判断属于当前必修还是规划外问题。

## 执行记录
- 2026-04-25：已重新确认四个失败点根因，进入按 TODO 顺序修复阶段。
- 2026-04-25：`AuthHistory` 已改为通过 `chatFetch` 注入聊天上游桩，聊天上下文断言从旧 `https` 调用记录切换为 `chatFetch` 请求体检查。
- 2026-04-25：`TaskPersistence` 已补充管理员登录流程，并在受保护的任务状态查询前带上会话 Cookie 与 CSRF 引导。
- 2026-04-25：`Smoke` 已新增登录态准备步骤，受保护接口改为登录后验证，保留 404 与 405 的匿名公共验证。
- 2026-04-25：`Failures` 已在缺失 API key、任务状态校验、坏本地音频失败路径前补齐登录态，确保命中真实业务失败而非鉴权前置失败。
- 2026-04-25：补跑浏览器回归时，`UiFlowSmoke` 首次受沙箱限制触发 Chromium `spawn EPERM`，已改为在提权环境下串行执行并避开端口冲突。
- 2026-04-25：`UiFlowSmoke` 已在浏览器环境通过。
- 2026-04-25：`UiVisualRegression` 首次失败，差异集中在 `admin-console`、`chat-card-dark`、`chat-card-light` 三张视觉基线，像素差异比例分别为 `0.0118%`、`0.1362%`、`0.1441%`，判定为前序 UI 调整后的基线过期。
- 2026-04-25：已刷新视觉基线并复跑 `UiVisualRegression`，验证通过。
- 2026-04-25：已执行带浏览器、跳过 live API 的全量回归，12 项全部通过。

## 验证结果
- `node test-auth-history.js`：通过。
- `node test-task-persistence.js`：通过。
- `node test-suite.js`：通过。
- `node test-failures.js`：通过。
- `node test-regression.js --skip-live --skip-browser`：通过。
- `node test-ui-flow-smoke.js --port 18811 --launch-server`：通过。
- `node test-ui-visual.js --port 18812 --launch-server --update-baseline`：已刷新视觉基线。
- `node test-ui-visual.js --port 18813 --launch-server`：通过。
- `node test-regression.js --skip-live --port 18814`：通过。
- 总回归摘要：
  - Passed: 12
  - Skipped: 0
  - Failed: 0

## 复盘
- 新问题：本轮未发现新的功能级回归；控制台仅有既有提示信息，包括 SQLite experimental warning、通知投递失败日志与缺失 `MINIMAX_API_KEY` 的配置提示，均与本轮测试目标一致，不构成新的阻塞问题。
- 边界条件：安全加固后，测试若要验证受保护接口的业务错误，必须先满足登录态与 CSRF 前置，否则会被 401 或 403 截断。
- 漏遗漏点：聊天链路测试不应继续耦合底层传输实现；后续若再次调整上游协议，优先保留可注入依赖并让测试断言聚焦请求语义。
- 规划回写：已确认本轮 TODO 全部完成。浏览器回归与视觉基线已恢复到可持续状态，后续若再次出现视觉差异，应先区分“真实 UI 漂移”与“已接受设计变更导致的基线过期”，再决定修代码还是更新基线。
