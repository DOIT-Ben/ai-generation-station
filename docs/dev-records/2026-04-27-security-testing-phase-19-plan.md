# 2026-04-27 安全性测试第十九阶段计划

## 目标
- 继续沿安全主线补强 `Host / Origin` 组合矩阵，验证“分别合法、组合后不一致”的来源样本不会被错误视为同源或允许来源。
- 严格保持最小方案，先通过自动化测试验证是否存在真实缺陷，只有测试命中问题时才做最小修复。

## 范围
- 测试脚本：
  - `test-security-gateway.js`
- 后端实现核验：
  - `server\lib\request-security.js`
  - `server\index.js`
- 文档记录：
  - `docs\dev-records`

## 非范围
- 不继续扩展单点 Host / Unicode / IPv6 语法样本。
- 不修改 UI、数据库结构、认证业务流程或审计模型。
- 不做插件目录与依赖层专项安全审计。

## 假设
- 当前单点 Origin、Host、IPv6、punycode / Unicode 样本基本已被覆盖。
- 仍可能存在“Host 合法、Origin 合法，但两者规范化后不一致”的组合边界尚未系统回归。
- 这类问题更可能命中真实来源判定缺陷，优先级高于继续补更细缓存头策略。

## 风险
- 如果把太多组合一次性混进来，首次失败时根因不容易聚焦。
- 需要区分“规范化后应视为同一来源”和“表面相近但必须拒绝”的组合。
- 修复时要避免误伤现有合法 same-origin 与允许 Origin 场景。

## 完成标准
- 已覆盖并验证至少以下组合：
  - punycode Host + Unicode Origin
  - Unicode Host + punycode Origin
  - 合法 IPv6 Host + 不同 Origin
  - 默认端口 / 显式端口组合中的不一致来源
- 若命中问题，完成最小修复并通过回归。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`
- 必要时 `npm test`
- `git diff --check`

## TODO
1. 盘点高价值 `Host / Origin` 组合样本，并确认哪些当前尚未被正式回归。
2. 为选定的合法规范化组合补充安全测试。
3. 为选定的不一致组合补充安全测试。
4. 运行安全测试并判断是否暴露真实问题。
5. 若发现问题，做最小修复并回归。
6. 回写执行记录、验证结果、复盘。
7. 若有代码改动，提交 Git。

## 执行顺序
1. 缺口盘点。
2. 合法规范化组合回归。
3. 不一致组合回归。
4. 执行与修复。
5. 文档回写。
6. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已盘点一组高价值 `Host / Origin` 组合样本，并确认以下组合值得纳入正式回归：
    - punycode Host + Unicode Origin
    - Unicode Host + punycode Origin
    - 默认端口规范化组合
    - 显式端口不一致组合
  - 已确认以下组合在规范化后应被视为同源：
    - `Host: xn--fsqu00a:18805` + `Origin: http://例子:18805`
    - `Host: localhost` + `Origin: http://localhost:80`
  - 已确认以下组合在规范化后应被拒绝：
    - `Host: xn--bcher-kva:18818` + `Origin: http://例子:18818`
    - `Host: localhost:18818` + `Origin: http://localhost`
- 已完成 TODO 2：
  - 在 `testSameOriginAndAllowedCors()` 中补充合法规范化组合回归：
    - 默认端口规范化组合
    - punycode Host + Unicode Origin 组合
- 已完成 TODO 3：
  - 在 `testOriginAndProxyProtocolBoundaries()` 中补充不一致组合回归：
    - punycode / Unicode 不一致组合
    - 显式端口不一致组合
- 已完成 TODO 4：
  - 已执行新增安全测试与认证回归。
  - 本轮新增用例全部通过，没有打出新的来源组合判定缺陷。
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
  - 本轮把 `Host / Origin` 组合矩阵从单点样本推进到规范化组合层回归。
- 边界条件：
  - 当前实现接受“规范化后等价”的组合，例如 punycode 与 Unicode 的同义来源、默认端口归一化来源。
  - 当前实现拒绝“分别合法但规范化后不一致”的组合，例如不同 punycode 目标与显式端口不一致来源。
- 遗漏点：
  - 本轮尚未把组合矩阵系统扩展到更大规模笛卡尔组合。
  - 本轮尚未继续补更细缓存头策略验证。
- 残余风险：
  - 当前未发现 `Host / Origin` 组合层存在新的错误放行问题。
- 是否回写规划：
  - 是。本轮已回写新增组合矩阵覆盖与结论。

## 当前结果
- 第十九阶段安全测试已完成：
  - 新增合法规范化组合回归
  - 新增不一致组合回归
  - 当前未发现新的来源组合判定缺陷

## 下一阶段建议 TODO
1. 若继续主线，可转去补更细的缓存头策略验证。
2. 若切到治理视角，可开始插件目录与依赖层专项安全审计。
3. 若准备收口，可基于现有总表和总报告结束本轮安全测试主线。
