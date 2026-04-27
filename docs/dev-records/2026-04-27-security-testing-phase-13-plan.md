# 2026-04-27 安全性测试第十三阶段计划

## 目标
- 继续沿来源校验主线补强 Host 语法边界，聚焦尾随冒号 Host 与 IPv6 Host 变体是否会被过宽接受并参与同源判定。
- 严格保持最小方案，先通过自动化测试验证是否存在真实缺陷，只有测试命中问题时才做最小修复。

## 范围
- 测试脚本：
  - `test-security-gateway.js`
- 后端实现核验：
  - `server\lib\request-security.js`
- 文档记录：
  - `docs\dev-records`

## 非范围
- 不修改 UI、数据库结构、认证业务流程或审计模型。
- 不扩展到 punycode / Unicode 主机名全量规则重写。
- 不做外网扫描、依赖漏洞扫描或压测。

## 假设
- 当前 `normalizeOrigin()` 已拒绝前导点、尾随点、连续点与显式异常端口格式，但未必覆盖尾随冒号 Host 与更细的 IPv6 authority 变体。
- `new URL(...)` 可能仍会接受一部分“格式可解析但语义异常”的 IPv6 / authority 样本。
- 当前主线已有 Host 变体回归基础，适合继续细化。

## 风险
- Host authority 与 IPv6 语法耦合更紧，修复若过宽容易误伤合法 `[::1]:18822` 这类开发环境常见写法。
- 需要区分“合法 IPv6 规范化”与“异常 authority 被 URL API 吞掉”。
- 如果一次混入太多 IPv6 样本，首次失败时根因不容易聚焦。

## 完成标准
- 已覆盖并验证至少以下边界：
  - 尾随冒号 Host 不会被错误当作合法同源来源
  - 至少一类非法 IPv6 Host 变体不会被错误当作合法同源来源
  - 合法 IPv6 Host 样本不被误伤
- 若命中问题，完成最小修复并通过回归。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`
- 必要时 `npm test`
- `git diff --check`

## TODO
1. 盘点尾随冒号 Host 与 IPv6 Host 当前测试缺口，并确认本地样本行为。
2. 为尾随冒号 Host 补充安全测试。
3. 为 IPv6 Host 合法样本与非法变体补充安全测试。
4. 运行安全测试并判断是否暴露真实问题。
5. 若发现问题，做最小修复并回归。
6. 回写执行记录、验证结果、复盘。
7. 若有代码改动，提交 Git。

## 执行顺序
1. 缺口盘点。
2. 尾随冒号 Host 回归。
3. IPv6 Host 回归。
4. 执行与修复。
5. 文档回写。
6. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已用本地样本确认当前 `normalizeOrigin()` 与 URL 解析下的表现：
    - `http://localhost:` 已被拒绝
    - `http://[::1]:18822` 为合法样本
    - `http://[::1]:00080`、`http://[::1]:`、`http://[::1`、`http://::1:18822`、`http://[::1]extra:18822` 已被拒绝
  - 已确认本轮主要缺口不是“明显未防住”，而是“需要把尾随冒号和 IPv6 边界正式纳入回归”。
- 已完成 TODO 2：
  - 在 `test-security-gateway.js` 的 `testHostVariantBoundaries()` 中补充尾随冒号 Host 回归：
    - `Host: localhost:`
    - `Origin: http://localhost:`
- 已完成 TODO 3：
  - 在 `test-security-gateway.js` 的 `testHostVariantBoundaries()` 中补充 IPv6 Host 回归：
    - 合法样本：`Host: [::1]:18822`、`Origin: http://[::1]:18822`
    - 非法样本：`Host: [::1]:00080`、`Origin: http://[::1]:00080`
- 已完成 TODO 4：
  - 已执行新增安全测试与认证回归。
  - 本轮新增用例全部通过，没有打出新的来源校验实现缺陷。
- 已完成 TODO 5：
  - 因本轮未发现新的真实问题，无需新增服务端代码修复。
- 已完成 TODO 6：
  - 已回写执行记录、验证结果与复盘。
- TODO 7 待执行：
  - 本轮尚未提交 Git。

## 验证结果
- 语法检查通过：
  - `node --check test-security-gateway.js`
- 安全测试通过：
  - `node test-security-gateway.js`
- 认证回归通过：
  - `node test-auth-history.js`

## 复盘
- 新问题：
  - 本轮没有打出新的业务实现缺陷。
  - 本轮确认第十二阶段对 Host authority 的收口已经覆盖到尾随冒号与本轮纳入的 IPv6 样本。
- 边界条件：
  - 合法 IPv6 same-origin 样本仍然可用，说明当前收口没有误伤 `[::1]:18822` 这类开发环境路径。
  - 当前端口格式校验对 IPv6 authority 同样生效。
- 遗漏点：
  - 本轮尚未覆盖更复杂的 IPv6 Host 变体，例如 zone id、大小写十六进制或更多 bracket 组合异常。
  - 本轮尚未进入 punycode / Unicode 主机名边界。
- 残余风险：
  - 当前未发现尾随冒号 Host 仍可绕过来源校验。
  - 当前未发现 `Host: [::1]:00080` 这类 IPv6 异常端口格式仍可被错误放行。
- 是否回写规划：
  - 是。本轮已回写新增覆盖面、验证结论与下一阶段缺口。

## 当前结果
- 第十三阶段安全测试已完成：
  - 新增尾随冒号 Host 回归
  - 新增合法 IPv6 same-origin 回归
  - 新增 IPv6 异常端口格式回归
  - 当前未发现新的来源校验缺陷

## 下一阶段建议 TODO
1. 继续扩展更细的 IPv6 Host 变体与 bracket 异常组合。
2. 继续补 punycode / Unicode 主机名边界。
3. 若来源主线暂时收口，可转去补 CORS 与缓存相关头一致性回归。
