# 2026-04-27 安全性测试第七阶段计划

## 目标
- 延续第六阶段的代理头安全修复，验证审计日志中的 `actorIp` 是否已经按预期落为“首个合法代理 IP”或安全回退地址，避免限流修好了但审计链路仍然脏数据。
- 保持最小改动原则，优先通过自动化测试验证现状；只有命中真实缺陷时才做最小修复。

## 范围
- 测试脚本：
  - `test-security-gateway.js`
- 后端实现核验：
  - `server\routes\state-route-helpers.js`
  - `server\lib\request-security.js`
  - `server\state-store-core.js`
  - `server\routes\state-admin-routes.js`
- 文档记录：
  - `docs\dev-records`

## 非范围
- 不修改 UI、数据库结构、鉴权流程或与本轮无关的安全头实现。
- 不扩展到完整 CORS 组合测试或外部渗透扫描。
- 不借机重构审计系统。

## 假设
- 第六阶段修复后，`buildAuditActor()` 通过 `getClientIp()` 写入的 `actorIp` 应已共享同一套合法 IP 选择逻辑。
- 管理员可通过 `GET /api/admin/audit-logs` 查询到目标动作的审计记录。
- `test-security-gateway.js` 已具备管理员登录、审计查询、CSRF 引导与请求头注入能力。

## 风险
- 审计日志断言若直接匹配“最新一条”而不做动作与目标过滤，容易被同轮其他测试污染。
- 回退地址在本地测试环境通常会落成 `127.0.0.1`，断言要聚焦“不是垃圾值、是安全回退”而不是写死过宽。
- 若审计动作选错，可能误把业务路径差异当成 IP 解析问题。

## 完成标准
- 已覆盖并验证至少以下边界：
  - `TRUST_PROXY=true` 时，带垃圾前缀的 `X-Forwarded-For` 审计 `actorIp` 取首个合法 IP
  - `TRUST_PROXY=true` 时，无效 `X-Real-IP` 审计 `actorIp` 不落垃圾值，而是回退到安全地址
- 若命中问题，完成最小修复并通过回归。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`
- 必要时 `npm test`
- `git diff --check`

## TODO
1. 盘点审计 `actorIp` 当前测试缺口与可用动作路径。
2. 为 `X-Forwarded-For` 合法 IP 选择补充审计回归。
3. 为无效 `X-Real-IP` 的安全回退补充审计回归。
4. 运行安全测试并判断是否暴露真实问题。
5. 若发现问题，做最小修复并回归。
6. 回写执行记录、验证结果、复盘。
7. 若有代码改动，提交 Git。

## 执行顺序
1. 缺口盘点。
2. `X-Forwarded-For` 审计回归。
3. `X-Real-IP` 审计回归。
4. 执行与修复。
5. 文档回写。
6. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已确认当前缺少“代理头修复后，审计 `actorIp` 是否同步正确”的回归。
  - 已选择 `user_public_register` 作为审计动作路径：
    - 该路径直接使用 `buildAuditActor(null, req)`
    - 审计记录可通过管理员 `GET /api/admin/audit-logs` 稳定查询
- 已完成 TODO 2：
  - 在 `test-security-gateway.js` 中补充 `X-Forwarded-For` 审计回归：
    - `X-Forwarded-For: garbage-forwarded, 198.51.100.20`
    - 注册成功后查询 `user_public_register` 审计
    - 断言 `actorIp` 落为首个合法 IP `198.51.100.20`
- 已完成 TODO 3：
  - 在 `test-security-gateway.js` 中补充无效 `X-Real-IP` 审计回归：
    - `X-Real-IP: garbage-real-ip`
    - 注册成功后查询 `user_public_register` 审计
    - 在当前 mock 传输下，断言 `actorIp` 回退为 `unknown`，而不是垃圾值
- 已完成 TODO 4：
  - 已执行新增安全测试与认证回归
  - 中途出现一次假失败，根因如下：
    - 首版测试用户名过长，命中 32 位用户名校验，返回 `400`
    - 缩短测试用户名后重跑通过
  - 第二次观察到 `actorIp=unknown`
    - 经检查 `test-live-utils.js` 的 `dispatchRequest()` 未挂 `socket.remoteAddress`
    - 判定为测试桩边界，而非新的业务缺陷
- 已完成 TODO 5：
  - 本轮未发现需要修改业务代码的真实缺陷
  - 因此无需新增服务端修复
- 已完成 TODO 6：
  - 已回写执行记录、验证结果、复盘
- 已完成 TODO 7：
  - 本轮提交信息已确定为：`test: verify proxy audit actor ip boundaries`

## 验证结果
- 语法检查通过：
  - `node --check test-security-gateway.js`
- 安全测试通过：
  - `node test-security-gateway.js`
- 认证回归通过：
  - `node test-auth-history.js`
- 提交前检查待执行：
  - `git diff --check`

## 复盘
- 新问题：
  - 本轮没有打出新的业务实现缺陷。
  - 本轮补齐了第六阶段修复后的观测链路验证，确认审计 `actorIp` 不再落入垃圾代理值。
- 边界条件：
  - 在当前 `dispatchRequest()` mock 传输下，没有真实 `remoteAddress`，因此安全回退值表现为 `unknown`。
  - 这说明测试环境与真实网络环境在回退地址上仍有差异，断言时必须明确区分。
- 遗漏点：
  - 仍未覆盖真实网络请求下的 `remoteAddress` 回退落值。
  - 仍未扩展 `Origin`、`Host`、`X-Forwarded-*` 的组合异常输入。
- 残余风险：
  - 当前未发现审计 `actorIp` 与第六阶段代理 IP 修复不一致的问题。
  - 若后续要进一步验证真实回退地址，可能需要补 network-level 测试，而不是继续依赖 mock 请求。
- 是否回写规划：
  - 是。本轮已回写假失败原因、测试桩边界与验证结论。

## 当前结果
- 第七阶段安全测试已完成并已提交：
  - 新增 `X-Forwarded-For` 审计 `actorIp` 回归
  - 新增无效 `X-Real-IP` 审计 `actorIp` 回退回归
  - 当前未发现新的业务缺陷
  - 已完成 Git 提交：`test: verify proxy audit actor ip boundaries`

## 下一阶段建议 TODO
1. 继续扩展 `Origin`、`Host`、`X-Forwarded-*` 的组合异常输入。
2. 若要验证真实回退地址，可单开一轮 network-level 测试补 `remoteAddress` 观察。
3. 再往后可转向管理员敏感动作审计字段完整性。
