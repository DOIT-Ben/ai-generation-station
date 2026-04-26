# 2026-04-26 安全性测试第六阶段计划

## 目标
- 继续补强安全测试覆盖，聚焦 `TRUST_PROXY` 场景下的代理头信任边界，重点验证 `X-Forwarded-For`、`X-Real-IP`、`X-Forwarded-Proto` 是否可能导致限流绕过或安全属性误判。
- 严格按最小方案推进，优先通过自动化测试证明是否存在真实缺陷；只有测试命中问题时才做最小修复。

## 范围
- 测试脚本：
  - `test-security-gateway.js`
- 后端实现核验：
  - `server\lib\request-security.js`
  - `server\index.js`
  - `server\routes\state-auth-routes.js`
  - `server\routes\state-route-helpers.js`
- 文档记录：
  - `docs\dev-records`

## 非范围
- 不修改与本轮无关的 UI、数据库结构、业务流程或管理后台布局。
- 不做外网扫描、依赖漏洞扫描、压力测试、权限模型改造。
- 不借机重构全部请求安全层，只处理本轮测试命中的最小缺陷。

## 假设
- 认证、注册、找回密码等限流仍以 `getClientIp()` 返回值作为 key。
- `TRUST_PROXY=true` 的部署前提下，若代理头解析接受任意非空字符串，存在绕过限流与污染审计 `actorIp` 的风险。
- `test-security-gateway.js` 已具备临时服务、CSRF 引导、登录、注册、限流断言等基础能力。

## 风险
- 如果直接把所有代理头边界混在一起测，失败时不容易区分是 IP 解析问题、协议识别问题，还是 CORS / CSRF 逻辑问题。
- 代理头解析改动若过宽，可能影响现有反代部署行为，因此修复必须围绕“无效值跳过、合法值保留”这类最小收口。
- 限流测试若没有控制好同一用户、同一 CSRF、同一服务实例，容易出现假阳性或假阴性。

## 完成标准
- 已覆盖并验证至少以下边界：
  - `TRUST_PROXY=true` 时无效 `X-Forwarded-For` / `X-Real-IP` 是否可绕过限流
  - `TRUST_PROXY=false` 时伪造 `X-Forwarded-Proto` 是否被忽略
  - 若命中问题，完成最小修复并通过安全回归
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`
- 必要时 `npm test`
- `git diff --check`

## TODO
1. 盘点代理头信任与限流当前测试缺口，并复现怀疑中的绕过路径。
2. 为 `TRUST_PROXY=true` 下的无效 `X-Forwarded-For` / `X-Real-IP` 限流边界补充安全测试。
3. 为 `TRUST_PROXY=false` 下的伪造 `X-Forwarded-Proto` 忽略行为补充安全测试。
4. 运行安全测试并判断是否暴露真实问题。
5. 若发现问题，做最小修复并回归。
6. 回写执行记录、验证结果、复盘。
7. 若有代码改动，提交 Git。

## 执行顺序
1. 缺口盘点与复现。
2. 代理 IP 解析测试补充。
3. 代理协议识别测试补充。
4. 执行与修复。
5. 文档回写。
6. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已确认当前测试尚未覆盖 `TRUST_PROXY=true` 下的无效代理 IP 头部限流绕过边界。
  - 已使用临时服务做现场复现：
    - 条件：`TRUST_PROXY=true`、`FORGOT_PASSWORD_RATE_LIMIT_MAX=1`
    - 请求 1：`X-Forwarded-For: garbage-one, 198.51.100.10`
    - 请求 2：`X-Forwarded-For: garbage-two, 198.51.100.10`
    - 结果：两次 `POST /api/auth/forgot-password` 均返回 `200`
  - 初步判因：
    - `server\lib\request-security.js` 中 `normalizeIpAddress()` 目前接受任意非空字符串
    - `getClientIp()` 在 `TRUST_PROXY=true` 时会把这些垃圾值当作 IP key 使用
    - 导致可通过变化垃圾前缀绕过限流，并污染审计中的 `actorIp`
- 已完成 TODO 2：
  - 在 `test-security-gateway.js` 中补充代理 IP 信任边界回归：
    - `X-Forwarded-For: garbage-one, 198.51.100.10`
    - `X-Forwarded-For: garbage-two, 198.51.100.10`
    - 断言第二次找回密码请求应命中 `forgot_password_rate_limited`
    - 补充 `X-Real-IP` 垃圾值变更场景，断言同样不能绕过限流
- 已完成 TODO 3：
  - 在 `test-security-gateway.js` 中补充 `TRUST_PROXY=false` 下的协议伪造忽略回归：
    - 伪造 `X-Forwarded-Proto: https`
    - 断言响应不应下发 HSTS
    - 断言 CSRF Cookie 不应被错误标记为 `Secure`
- 已完成 TODO 4：
  - 新增回归首次执行失败，稳定暴露真实问题：
    - `Expected second forwarded-for forgot-password request to be rate-limited, got 200`
- 已完成 TODO 5：
  - 已在 `server\lib\request-security.js` 做最小修复：
    - 引入 `net.isIP`
    - 无效代理 IP 值改为返回 `null`
    - 保留合法 IPv4、IPv6、`::ffff:` 映射、`::1` 映射与常见 IPv4:port 收口
  - 修复后重新执行安全网关测试与认证历史回归，结果通过
- 已完成 TODO 6：
  - 已回写执行记录、验证结果与复盘
- 已完成 TODO 7：
  - 本轮提交信息已确定为：`fix: harden proxy header ip validation`

## 验证结果
- 语法检查通过：
  - `node --check test-security-gateway.js`
- 安全测试通过：
  - `node test-security-gateway.js`
- 认证回归通过：
  - `node test-auth-history.js`
- 提交前检查通过：
  - `git diff --check`
  - 说明：仅存在 LF -> CRLF 提示，无 diff 错误

## 复盘
- 新问题：
  - 已确认存在真实安全缺陷：
    - `TRUST_PROXY=true` 时，无效 `X-Forwarded-For` / `X-Real-IP` 值会被当作客户端 IP
    - 攻击者可通过变化垃圾值绕过基于 IP 的限流
    - 同时也会污染审计中的 `actorIp`
- 边界条件：
  - 修复不能粗暴禁用代理头，因为现有反代场景仍依赖 `TRUST_PROXY=true`
  - 因此本轮采用“无效值跳过、合法值保留”的最小收口，而不是重写全部代理链解析策略
- 遗漏点：
  - 本轮尚未单独核验审计日志中的 `actorIp` 已按预期落为合法 IP / 回退地址
  - 本轮尚未扩展 `Origin`、`Host`、`X-Forwarded-*` 的组合型异常输入
- 残余风险：
  - 若后续部署需要支持更特殊的代理头格式，本轮仅覆盖常见 IPv4、IPv6 与 IPv4:port 形式
  - 目前未发现 `TRUST_PROXY=false` 下的协议伪造误判问题
- 是否回写规划：
  - 是。本轮已回写复现证据、根因、修复策略与下一阶段缺口

## 当前结果
- 第六阶段安全测试已完成并已提交：
  - 新增代理头限流绕过回归
  - 新增未信任代理协议伪造回归
  - 修复了代理 IP 解析接受垃圾值的问题
  - 已完成 Git 提交：`fix: harden proxy header ip validation`

## 下一阶段建议 TODO
1. 继续围绕审计日志验证 `actorIp` 落值是否稳定、是否与修复后的合法 IP 选择一致。
2. 继续扩展 `Origin`、`Host`、`X-Forwarded-*` 的组合异常输入。
3. 再往后可转向管理员敏感动作审计字段完整性。
