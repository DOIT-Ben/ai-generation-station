# 2026-04-26 安全性测试第五阶段计划

## 目标
- 继续补强认证与 token 相关安全测试，聚焦邀请激活 token 显式过期、异常 token 形态，以及 Cookie、Query、Header 异常组合的统一容错。
- 严格按最小方案推进，优先扩自动化测试暴露真实问题，只有在测试命中缺陷时才做最小修复。

## 范围
- 测试脚本：
  - `test-security-gateway.js`
- 后端实现核验：
  - `server\routes\state-auth-routes.js`
  - `server\routes\state-route-helpers.js`
  - `server\state-store-auth.js`
  - `server\lib\http.js`
- 文档记录：
  - `docs\dev-records`

## 非范围
- 不做与本轮无关的 UI、样式、管理后台、数据库结构调整。
- 不做外网渗透、依赖漏洞扫描、压力测试、WebSocket 测试。
- 不借机重构认证路由、测试工具层或状态存储实现。

## 假设
- `test-security-gateway.js` 已具备临时服务启动、管理员登录、CSRF 引导、Cookie 合并、公开注册与 token 预览提取能力。
- token 显式过期边界仍可通过“最小 TTL + 受控时间偏移”稳定验证。
- 认证路由对异常 token 的期望行为是受控失败，而不是抛异常或导致进程崩溃。

## 风险
- `issueUserToken()` 内部存在 TTL 下限，若测试未控制时间偏移，容易把“未过期 token”误判成“已过期 token”。
- 异常 Cookie、Query、Header 组合可能同时触发认证、CSRF、URL 解析多条分支，若断言不够聚焦容易误伤正常限制逻辑。
- 若打出真实缺陷，修复要避免破坏现有邀请、登录、找回密码主流程。

## 完成标准
- 已覆盖并验证至少以下边界：
  - 邀请激活 token 的显式过期边界
  - 邀请 / 密码重置 token 的至少两类异常输入形态
  - 至少一组异常 Cookie、Query、Header 组合请求的受控失败行为
- 若发现问题，完成最小修复并通过回归；若未发现问题，完整记录结论、残余风险和下一步缺口。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`
- 必要时 `npm test`
- `git diff --check`

## TODO
1. 盘点邀请 token 过期与异常 token 输入当前测试缺口。
2. 为邀请激活 token 的显式过期边界补充安全测试。
3. 为邀请 / 密码重置 token 的异常输入形态补充安全测试。
4. 为异常 Cookie、Query、Header 组合补充统一容错测试。
5. 运行安全测试并判断是否暴露真实问题。
6. 若发现问题，做最小修复并回归。
7. 回写执行记录、验证结果、复盘。
8. 若有代码改动，提交 Git。

## 执行顺序
1. 缺口盘点。
2. 邀请 token 过期测试补充。
3. 异常 token 形态测试补充。
4. 异常 Cookie、Query、Header 容错测试补充。
5. 执行与修复。
6. 文档回写。
7. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已确认上一轮尚未显式覆盖邀请激活 token 的过期边界。
  - 已确认 `normalizePublicToken()` 仅做 `trim()`，因此超长 token、异常编码 token、空白 token 都值得单独回归。
  - 已确认异常 Cookie 命中 `getCurrentSession()` 时，当前主要风险不是鉴权绕过，而是解析容错与失败响应是否稳定。
- 已完成 TODO 2：
  - 在 `test-security-gateway.js` 中补充邀请 token 的显式过期边界回归：
    - 直接签发 `invite_activation` token
    - 通过“最小 TTL + 时间偏移”验证 GET 查询过期失败
    - 通过同样方式验证 POST 激活过期失败
- 已完成 TODO 3：
  - 在 `test-security-gateway.js` 中补充邀请 / 密码重置 token 的异常输入回归：
    - 超长邀请 token 查询
    - 异常编码邀请 token 查询
    - 超长邀请 token 激活
    - 异常编码密码重置 token 查询
    - 超长密码重置 token 提交
- 已完成 TODO 4：
  - 在 `test-security-gateway.js` 中补充异常 Cookie 组合回归：
    - 使用异常编码 `aigs_session` 访问 `/api/auth/session`
    - 验证服务端返回受控 `401 session_expired`
    - 验证服务端显式清除损坏 session Cookie
- 已完成 TODO 5：
  - 已执行语法检查、安全测试、认证回归与 diff 检查。
  - 本轮新增用例全部通过，没有打出新的邀请 / 密码重置 token 缺陷，也没有打出新的 Cookie 解析崩溃问题。
- 已完成 TODO 6：
  - 本轮未发现需要修复的真实业务缺陷，因此无需新增业务代码变更。
  - 已确认“若无缺陷则记录结论”的分支成立。
- 已完成 TODO 7：
  - 已回写执行记录、验证结果与复盘。
- 已完成 TODO 8：
  - 已完成本轮 Git 提交：`test: extend token boundary security coverage`

## 验证结果
- 语法检查通过：
  - `node --check test-security-gateway.js`
- 安全测试通过：
  - `node test-security-gateway.js`
- 认证回归通过：
  - `node test-auth-history.js`
- 提交前检查通过：
  - `git diff --check`
  - 说明：仅存在 LF -> CRLF 提示，无 diff 错误。

## 复盘
- 新问题：
  - 本轮没有打出新的业务实现缺陷。
  - 本轮进一步确认，现有 token 查询 / 消费链路对超长 token、异常编码 token、显式过期 token 均能受控失败。
- 边界条件：
  - `issueUserToken()` 存在 60 秒 TTL 下限，因此“过期 token”测试仍必须使用时间偏移，不能只依赖 `ttlMs: 1`。
  - 异常 Cookie 若仍能解析出非空原始值，将进入 `session_expired` 分支，而不是 `anonymous` 分支；这是当前实现下的预期行为。
- 遗漏点：
  - 本轮仍未覆盖“异常 token + 异常 CSRF 头”叠加场景。
  - 本轮仍未覆盖更大规模异常 Header 组合，如伪造 Host、重复 Origin、异常 `X-Forwarded-*` 组合。
- 残余风险：
  - 目前未发现邀请 token 的显式过期判断问题。
  - 目前未发现异常 token 字符串导致的认证路由崩溃或错误放行。
  - 目前未发现异常 session Cookie 导致的鉴权绕过或未受控异常。
- 是否回写规划：
  - 是。本轮已回写新增覆盖面、验证结论与下一阶段缺口。

## 当前结果
- 第五阶段安全测试已完成：
  - 新增邀请 token 显式过期测试
  - 新增邀请 / 密码重置 token 异常输入测试
  - 新增异常 session Cookie 容错测试
  - 当前未发现新的业务缺陷，属于“继续补测试并确认边界稳定”的推进
- 本轮 Git 提交已完成：
  - `test: extend token boundary security coverage`

## 下一阶段建议 TODO
1. 继续扩展异常 Header 组合与代理头相关安全回归，重点看 `Origin`、`Host`、`X-Forwarded-*` 边界。
2. 继续细化管理员敏感动作的审计字段完整性与跨身份切换链路。
3. 若后续命中真实缺陷，再新增最小回归用例并重新评估相关输入归一化边界。
