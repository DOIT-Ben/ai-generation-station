# 2026-04-27 安全性测试第二十九阶段计划

## 目标
- 回到主仓库安全主线，继续扩展更系统化的 `Host / Origin` 组合矩阵。
- 目标是把“分别合法、组合后规范化等价 / 不等价”的样本覆盖得更系统，而不是只靠零散个例。

## 范围
- 测试脚本：
  - `test-security-gateway.js`
- 后端实现核验：
  - `server\lib\request-security.js`
  - `server\index.js`
- 文档记录：
  - `docs\dev-records`
  - `docs\test\security-testing-report.md`

## 非范围
- 不继续扩展插件 CLI 治理。
- 不做缓存策略重构。
- 不修改 UI、数据库结构、认证业务流程或审计模型。

## 假设
- 当前已经覆盖了一批高价值 `Host / Origin` 个例，但还没有形成更系统的矩阵。
- 继续补矩阵比现在直接进入缓存策略设计更有价值。

## 风险
- 如果一次性补太多样本，首次失败时根因不容易聚焦。
- 需要区分“规范化后应允许”与“规范化后必须拒绝”的组合。

## 完成标准
- 已新增一组更系统化的 `Host / Origin` 组合回归。
- 若命中问题，完成最小修复并通过回归。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`

## TODO
1. 盘点尚未覆盖的 `Host / Origin` 组合类别。
2. 选定一组规范化后应允许的组合。
3. 选定一组规范化后应拒绝的组合。
4. 补自动化回归。
5. 运行安全与认证回归。
6. 若命中问题，做最小修复并复测。
7. 回写执行记录、验证结果、复盘。
8. 若有代码改动，提交 Git。

## 执行顺序
1. 组合类别盘点。
2. 允许组合回归。
3. 拒绝组合回归。
4. 执行与修复。
5. 文档回写。
6. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已盘点尚未正式回归的组合类别，并选定以下高价值样本：
    - punycode + 默认端口等价组合
    - Unicode + 显式默认端口等价组合
    - punycode + 默认端口不等价组合
    - 默认端口 vs 应用端口不等价组合
- 已完成 TODO 2：
  - 已在 `testSameOriginAndAllowedCors()` 中补充规范化后应允许的组合：
    - `Host: xn--fsqu00a` + `Origin: http://例子:80`
    - `Host: 例子:80` + `Origin: http://xn--fsqu00a`
- 已完成 TODO 3：
  - 已在 `testOriginAndProxyProtocolBoundaries()` 中补充规范化后应拒绝的组合：
    - `Host: xn--bcher-kva` + `Origin: http://例子:80`
    - `Host: localhost` + `Origin: http://localhost:18818`
- 已完成 TODO 4：
  - 已执行主仓库安全与认证回归。
  - 本轮新增用例全部通过，没有打出新的来源组合判定缺陷。
- 已完成 TODO 5：
  - 因本轮未发现新的真实问题，无需新增服务端代码修复。
- 已完成 TODO 6：
  - 已回写执行记录、验证结果与复盘。
- TODO 8 待执行：
  - 待本轮 Git 提交。

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
  - 本轮把 `Host / Origin` 组合矩阵补到更接近“规则层”而不只是“个例层”。
- 边界条件：
  - 当前矩阵仍然是精选样本，不是全量组合爆炸。
- 遗漏点：
  - 仍可继续扩更大规模的 Host / Origin 组合矩阵，但收益开始下降。
- 残余风险：
  - 当前未发现默认端口、punycode / Unicode 规范化组合层存在新的错误放行问题。
- 是否回写规划：
  - 是。本轮已回写新增矩阵覆盖与结论。

## 当前结果
- 第二十九阶段已完成：
  - 新增更系统化的 `Host / Origin` 组合矩阵回归
  - 当前未发现新的来源组合判定缺陷

## 下一阶段建议 TODO
1. 若继续主线，可转入缓存策略是否设计化的决策。
2. 若准备彻底收口，可统一整理最终完成面与残余风险总结。
