# 2026-04-27 安全性测试第十五阶段计划

## 目标
- 继续沿来源校验主线补强 Host 语法边界，聚焦 punycode 与 Unicode 主机名样本是否会被过宽接受并参与同源判定。
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
- 不扩展到更大范围的 IDNA / URL 解析器重写。
- 不做外网扫描、依赖漏洞扫描或压测。

## 假设
- 当前 `normalizeOrigin()` 主要按 URL 解析结果和基础 hostname / port 规则收口，未必显式覆盖 punycode 与 Unicode 主机名边界。
- 某些 Unicode 主机名可能被 URL API 规范化成 punycode 后参与同源比较。
- 当前 `testHostVariantBoundaries()` 已可承接这轮最小增量回归。

## 风险
- 需要区分“浏览器 / URL API 的合法 IDNA 规范化”与“异常主机名被错误吞掉”。
- 如果直接禁止全部 Unicode 或 punycode，可能误伤合法同源场景；但如果完全放开，也可能放入不希望支持的语义边界。
- 若样本选择过多，首次失败时根因不容易聚焦。

## 完成标准
- 已覆盖并验证至少以下边界：
  - 至少一类 punycode 或 Unicode 主机名样本的当前行为
  - 若命中问题，完成最小修复并通过回归
  - 若未命中问题，明确记录当前行为与残余风险
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`
- 必要时 `npm test`
- `git diff --check`

## TODO
1. 盘点 punycode 与 Unicode 主机名样本当前行为，并确认哪些值得纳入正式回归。
2. 为选定样本补充安全测试。
3. 运行安全测试并判断是否暴露真实问题。
4. 若发现问题，做最小修复并回归。
5. 回写执行记录、验证结果、复盘。
6. 若有代码改动，提交 Git。

## 执行顺序
1. 缺口盘点。
2. punycode / Unicode 样本回归。
3. 执行与修复。
4. 文档回写。
5. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已用本地样本确认当前 `URL` 与 `normalizeOrigin()` 的行为：
    - `http://例子:18822` 会规范化为 `http://xn--fsqu00a:18822`
    - `http://bücher:18822` 会规范化为 `http://xn--bcher-kva:18822`
    - `http://☃.net:18822` 会规范化为 `http://xn--n3h.net:18822`
    - `http://例子..com:18822` 会因连续点样本被拒绝
  - 已确认本轮值得纳入正式回归的是：
    - 合法 Unicode 主机名样本
    - 合法 punycode 主机名样本
    - 异常 Unicode 主机名样本
- 已完成 TODO 2：
  - 在 `test-security-gateway.js` 的 `testHostVariantBoundaries()` 中补充样本回归：
    - `Host: 例子:18822`、`Origin: http://例子:18822`
    - `Host: xn--bcher-kva:18822`、`Origin: http://xn--bcher-kva:18822`
    - `Host: 例子..com:18822`、`Origin: http://例子..com:18822`
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
  - 本轮把 punycode / Unicode 主机名的当前行为正式落成了自动化回归。
- 边界条件：
  - 当前实现接受合法 Unicode 主机名，并通过 URL API 规范化后按 punycode origin 做同源比较。
  - 这意味着系统当前语义不是“拒绝全部 Unicode 主机名”，而是“接受规范化后的合法 IDNA 样本”。
- 遗漏点：
  - 本轮尚未覆盖更细的 IDNA 边界，例如大小写、混合脚本、更多特殊 Unicode 标签。
  - 本轮尚未进入 CORS 与缓存相关头的一致性回归。
- 残余风险：
  - 当前未发现合法 Unicode / punycode 主机名会错误破坏同源判断。
  - 当前未发现 `例子..com` 这类异常 Unicode Host 仍可被错误放行。
- 是否回写规划：
  - 是。本轮已回写当前行为、覆盖面与后续缺口。

## 当前结果
- 第十五阶段安全测试已完成：
  - 新增合法 Unicode Host 回归
  - 新增合法 punycode Host 回归
  - 新增异常 Unicode Host 回归
  - 当前未发现新的来源校验缺陷

## 下一阶段建议 TODO
1. 若继续来源主线，可转去补 CORS 与缓存相关头一致性回归。
2. 若仍留在主机名边界，可补更细的 IDNA / Unicode 标签样本，但收益会明显下降。
3. 可考虑更新安全总报告，把第十二到第十五阶段的新增覆盖纳入正式统计口径。
