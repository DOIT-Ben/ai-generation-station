# 2026-04-27 安全性测试第十二阶段计划

## 目标
- 继续沿来源校验主线补强 Host 语法边界，聚焦尾随点 Host、异常端口格式 Host 是否会被过宽接受并参与同源判定。
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
- 当前 `normalizeOrigin()` 已拒绝前导点和连续点，但未必覆盖尾随点 Host 与异常端口格式。
- `new URL(...)` 可能会接受一部分“格式可解析但语义异常”的 Host 样本。
- 当前主线已有非法 Host + 匹配 Origin 回归基础，适合继续细化。

## 风险
- 需要区分“合法规范化”与“非法 Host 被吞掉”，避免误伤合法默认端口与大小写归一化。
- Host 语法修复若收得过宽，可能影响 IPv6、合法端口或开发环境常见写法。
- 如果同时混入太多 Host 变体，首次失败时根因不容易聚焦。

## 完成标准
- 已覆盖并验证至少以下边界：
  - 尾随点 Host 不会被错误当作合法同源来源
  - 异常端口格式 Host 不会被错误当作合法同源来源
- 若命中问题，完成最小修复并通过回归。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`
- 必要时 `npm test`
- `git diff --check`

## TODO
1. 盘点尾随点 Host 与异常端口 Host 当前测试缺口，并确认本地样本行为。
2. 为尾随点 Host 补充安全测试。
3. 为异常端口格式 Host 补充安全测试。
4. 运行安全测试并判断是否暴露真实问题。
5. 若发现问题，做最小修复并回归。
6. 回写执行记录、验证结果、复盘。
7. 若有代码改动，提交 Git。

## 执行顺序
1. 缺口盘点。
2. 尾随点 Host 回归。
3. 异常端口 Host 回归。
4. 执行与修复。
5. 文档回写。
6. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已用本地样本确认当前 `normalizeOrigin()` 会接受以下 Host 变体：
    - `http://localhost.:18822`
    - `http://localhost:00080`
    - `http://localhost:08`
  - 已确认 `http://localhost:65536`、`http://localhost:+80`、`http://localhost:80extra` 会被 URL 解析阶段拒绝，不构成本轮主要缺口。
- 已完成 TODO 2：
  - 在 `test-security-gateway.js` 的 `testHostVariantBoundaries()` 中补充尾随点 Host 回归：
    - `Host: localhost.:18822`
    - `Origin: http://localhost.:18822`
  - 首次执行稳定暴露真实问题：
    - `Expected trailing-dot host same-origin request to return 403, got 200`
- 已完成 TODO 3：
  - 在 `test-security-gateway.js` 的 `testHostVariantBoundaries()` 中补充异常端口格式 Host 回归：
    - `Host: localhost:00080`
    - `Origin: http://localhost:00080`
  - 在修复尾随点 Host 后再次执行，稳定暴露第二个真实问题：
    - `Expected normalized-port host same-origin request to return 403, got 200`
- 已完成 TODO 4：
  - 已执行新增安全测试与语法检查，先后打出两个真实来源校验缺陷：
    - 尾随点 Host 被错误视为合法同源来源
    - 显式异常端口格式 Host 被 URL 规范化后错误视为合法同源来源
- 已完成 TODO 5：
  - 已在 `server\lib\request-security.js` 做最小修复：
    - 对非 IPv6 主机名新增尾随点拒绝
    - 对原始 authority 中显式端口新增格式校验
    - 若显式端口为空、含非数字字符、或带前导零则拒绝
  - 修复后重新执行安全网关测试与认证历史回归，结果通过
- 已完成 TODO 6：
  - 已回写执行记录、验证结果与复盘
- TODO 7 待执行：
  - 本轮尚未提交 Git

## 验证结果
- 语法检查通过：
  - `node --check server\lib\request-security.js`
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
  - 已确认存在 2 个真实安全缺陷：
    - 尾随点 Host 变体此前会被错误视为合法同源来源
    - 显式异常端口格式 Host 会被 URL API 过宽规范化后错误放行
- 边界条件：
  - 本轮修复只收紧“显式异常格式”，没有改动合法默认端口归一化或 IPv6 路径。
  - 端口校验依赖原始 authority，而不是 `parsed.port`，因为 `parsed.port` 已经丢失了前导零等原始异常格式信息。
- 遗漏点：
  - 本轮尚未覆盖尾随冒号 Host、更多 IPv6 Host 变体、punycode / Unicode 主机名边界。
  - 本轮尚未扩展 Host 变体与 CORS 缓存相关头的一致性组合测试。
- 残余风险：
  - 当前未发现尾随点 Host 仍可绕过来源校验。
  - 当前未发现 `:00080` 这类显式异常端口格式仍可被错误视为合法同源来源。
- 是否回写规划：
  - 是。本轮已回写缺陷、根因、修复策略与后续缺口。

## 当前结果
- 第十二阶段安全测试已完成：
  - 新增尾随点 Host 回归
  - 新增显式异常端口格式 Host 回归
  - 修复了 2 个来源校验相关真实缺陷

## 下一阶段建议 TODO
1. 继续扩展 Host 语法边界，例如尾随冒号、IPv6 Host 变体、punycode / Unicode 主机名。
2. 继续补更多 Host / Origin 组合回归。
3. 若安全主线继续推进，可补 CORS 与缓存相关头一致性回归。
