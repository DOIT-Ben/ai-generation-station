# 2026-04-27 安全性测试第八阶段计划

## 目标
- 继续补强请求来源与代理头相关安全测试，聚焦 `Origin`、`Host`、`X-Forwarded-Proto` 的组合异常输入，验证 CORS 判定、同源判定、Secure Cookie 与 HSTS 是否保持一致。
- 保持最小改动原则，优先通过自动化测试暴露真实缺陷；只有测试命中问题时才做最小修复。

## 范围
- 测试脚本：
  - `test-security-gateway.js`
- 后端实现核验：
  - `server\lib\request-security.js`
  - `server\index.js`
- 文档记录：
  - `docs\dev-records`

## 非范围
- 不修改 UI、数据库结构、认证业务流程或审计模型。
- 不做外网扫描、依赖漏洞扫描、压测或权限模型改造。
- 不扩展到完整 network-level 回退地址测试。

## 假设
- 现有同源判定核心依赖 `getRequestOrigin(req, options)` 与 `isOriginAllowed(req, origin, options)`。
- `TRUST_PROXY=true` 时，`getRequestProtocol()` 会从 `X-Forwarded-Proto` 中挑选第一个合法值。
- `test-security-gateway.js` 已具备临时服务、来源头注入、Cookie/CSRF 断言能力。

## 风险
- 若同时混测 Host、Origin、X-Forwarded-Proto，失败时不容易分辨究竟是哪条边界出了问题。
- 某些组合更像“配置误用风险”而非代码缺陷，测试断言必须聚焦实现当前应当满足的行为。
- 若打出问题，修复要避免破坏已通过的反代 HTTPS 场景。

## 完成标准
- 已覆盖并验证至少以下边界：
  - Host 与 Origin 不匹配时的同源拒绝
  - `TRUST_PROXY=true` 下多值 `X-Forwarded-Proto` 的优先级与安全属性一致性
  - 异常 / 非法 Origin 字符串不会被错误放行
- 若命中问题，完成最小修复并通过回归。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`
- 必要时 `npm test`
- `git diff --check`

## TODO
1. 盘点来源校验与代理协议识别当前测试缺口。
2. 为 Host / Origin 不匹配边界补充安全测试。
3. 为多值 `X-Forwarded-Proto` 与异常 Origin 输入补充安全测试。
4. 运行安全测试并判断是否暴露真实问题。
5. 若发现问题，做最小修复并回归。
6. 回写执行记录、验证结果、复盘。
7. 若有代码改动，提交 Git。

## 执行顺序
1. 缺口盘点。
2. Host / Origin 回归。
3. 代理协议与异常 Origin 回归。
4. 执行与修复。
5. 文档回写。
6. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已确认当前尚未覆盖以下边界：
    - Host / Origin 不匹配时的同源拒绝
    - 非法 `Origin` 字符串的 API 处理
    - `TRUST_PROXY=true` 下多值 `X-Forwarded-Proto` 的安全属性一致性
- 已完成 TODO 2：
  - 在 `test-security-gateway.js` 中补充 Host / Origin 不匹配回归：
    - `Host: localhost:18818`
    - `Origin: http://localhost:29999`
    - 断言返回 `403 origin_not_allowed`
- 已完成 TODO 3：
  - 在 `test-security-gateway.js` 中补充来源与代理协议组合回归：
    - 非法 `Origin: https://studio.example.com, https://evil.example.com`
    - `X-Forwarded-Proto: garbage, http, https`
    - `X-Forwarded-Proto: garbage, https, http`
  - 首次执行时稳定暴露真实问题：
    - `Expected malformed origin request to return 403, got 200`
  - 根因定位：
    - `server\lib\request-security.js` 中 `applyCorsHeaders()` 对 `normalizeOrigin()` 失败的结果直接视作“无 Origin”
    - 导致“存在但非法”的 `Origin` 头被错误放行为 API 请求
- 已完成 TODO 4：
  - 已执行新增安全测试与认证回归
- 已完成 TODO 5：
  - 已在 `server\lib\request-security.js` 做最小修复：
    - 区分“缺失 Origin”与“存在但非法的 Origin”
    - 缺失时仍允许
    - 非法时明确返回 `allowed: false`
    - 继续保留 `Vary: Origin`
  - 修复后重新执行安全网关测试与认证历史回归，结果通过
- 已完成 TODO 6：
  - 已回写执行记录、验证结果、复盘
- 已完成 TODO 7：
  - 本轮提交信息已确定为：`fix: reject invalid origin headers`

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
  - 已确认存在真实安全缺陷：
    - 非法 `Origin` 头此前会被当作“无 Origin”处理
    - 对 API 路由而言，这意味着应被拒绝的跨源异常输入被错误放行
- 边界条件：
  - “无 Origin” 仍然需要允许，因为同源脚本、服务端请求或某些非浏览器请求不会总是带 `Origin`
  - 因此修复不能简单把 `!normalizeOrigin()` 全部视为拒绝，而是必须先区分“头不存在”与“头存在但无效”
- 遗漏点：
  - 本轮尚未覆盖更复杂的 Host 变体，例如尾点、大小写或异常端口格式
  - 本轮尚未扩展到 network-level 真实来源验证
- 残余风险：
  - 当前未发现多值 `X-Forwarded-Proto` 在已信任代理场景下的安全属性不一致问题
  - 当前未发现 Host / Origin 不匹配被错误放行的问题
- 是否回写规划：
  - 是。本轮已回写缺陷、根因、修复与下一阶段缺口

## 当前结果
- 第八阶段安全测试已完成并已提交：
  - 新增 Host / Origin 不匹配回归
  - 新增非法 Origin 拒绝回归
  - 新增多值 `X-Forwarded-Proto` 安全属性回归
  - 修复了非法 Origin 被错误放行的问题
  - 已完成 Git 提交：`fix: reject invalid origin headers`

## 下一阶段建议 TODO
1. 继续扩展 Host 变体与更细的 Origin 规范化边界。
2. 若要验证真实回退地址，可继续转向 network-level `remoteAddress` 回退验证。
3. 若继续做来源安全，可补更多缓存相关头与 CORS 组合回归。
