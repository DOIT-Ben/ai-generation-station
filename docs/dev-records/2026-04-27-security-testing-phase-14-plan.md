# 2026-04-27 安全性测试第十四阶段计划

## 目标
- 继续沿来源校验主线补强 IPv6 Host 语法边界，聚焦 bracket 结构异常与更细的 IPv6 authority 组合是否会被过宽接受并参与同源判定。
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
- 当前 Host 收口已经覆盖前导点、尾随点、连续点、显式异常端口格式、尾随冒号与基础 IPv6 端口边界。
- 仍可能存在“格式可解析但 bracket 结构或 authority 组成异常”的 IPv6 样本被 URL API 吞掉后错误放行。
- 当前 `testHostVariantBoundaries()` 已可承接这轮最小增量回归。

## 风险
- IPv6 authority 语法细碎，若样本过多，首次失败时根因不容易聚焦。
- 若修复范围收得过宽，可能误伤合法 IPv6 same-origin 样本。
- 某些样本可能被 URL 解析直接拒绝，本轮需要区分“浏览器层已无效”和“服务端仍需防住”的边界。

## 完成标准
- 已覆盖并验证至少以下边界：
  - 至少两类 IPv6 bracket 异常 authority 不会被错误当作合法同源来源
  - 合法 IPv6 same-origin 样本不被误伤
- 若命中问题，完成最小修复并通过回归。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`
- 必要时 `npm test`
- `git diff --check`

## TODO
1. 盘点更细的 IPv6 bracket 异常样本当前行为，并确认哪些值得纳入正式回归。
2. 为选定的 IPv6 bracket 异常样本补充安全测试。
3. 运行安全测试并判断是否暴露真实问题。
4. 若发现问题，做最小修复并回归。
5. 回写执行记录、验证结果、复盘。
6. 若有代码改动，提交 Git。

## 执行顺序
1. 缺口盘点。
2. IPv6 bracket 异常回归。
3. 执行与修复。
4. 文档回写。
5. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已用本地样本确认多数 bracket 结构异常 authority 会被 URL 解析直接拒绝，例如：
    - `http://[[::1]]:18822`
    - `http://[::1]]:18822`
    - `http://[[::1]:18822`
    - `http://[::1]:18822extra`
  - 已确认真正值得纳入正式回归的是“会被 URL API 规范化吞掉”的 IPv6 端口样本：
    - `http://[::1]:018822`
    - `http://[::1]:00000`
- 已完成 TODO 2：
  - 在 `test-security-gateway.js` 的 `testHostVariantBoundaries()` 中补充 IPv6 端口异常样本回归：
    - `Host: [::1]:018822`、`Origin: http://[::1]:018822`
    - `Host: [::1]:00000`、`Origin: http://[::1]:00000`
- 已完成 TODO 3：
  - 已执行新增安全测试与认证回归。
  - 本轮新增用例全部通过，没有打出新的来源校验实现缺陷。
- 已完成 TODO 4：
  - 因本轮未发现新的真实问题，无需新增服务端代码修复。
- 已完成 TODO 5：
  - 已回写执行记录、验证结果与复盘。
- TODO 6 待执行：
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
  - 本轮进一步确认，当前 Host authority 收口对 IPv6 端口异常格式已经稳定生效。
- 边界条件：
  - 本轮没有把“URL 解析层已直接无效”的 bracket 结构样本强行纳入同源回归，而是只纳入“可能被规范化吞掉”的样本。
  - 当前合法 IPv6 same-origin 样本仍保持通过。
- 遗漏点：
  - 本轮尚未覆盖 IPv6 zone id、更多大小写十六进制写法或更复杂的 authority 组合异常。
  - 本轮尚未进入 punycode / Unicode 主机名边界。
- 残余风险：
  - 当前未发现 `Host: [::1]:018822` 或 `Host: [::1]:00000` 这类 IPv6 端口异常格式仍可被错误放行。
- 是否回写规划：
  - 是。本轮已回写新增覆盖面、样本筛选结论与下一阶段缺口。

## 当前结果
- 第十四阶段安全测试已完成：
  - 新增两类 IPv6 端口异常格式回归
  - 当前未发现新的来源校验缺陷

## 下一阶段建议 TODO
1. 继续补 punycode / Unicode 主机名边界。
2. 若来源主线暂时收口，可转去补 CORS 与缓存相关头一致性回归。
3. 若仍留在 Host 主线，可补更少量但高价值的 IPv6 zone id / authority 组合样本。
