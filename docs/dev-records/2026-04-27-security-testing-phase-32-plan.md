# 2026-04-27 安全性测试第三十二阶段计划

## 目标
- 继续扩展更大规模的 `Host / Origin` 组合矩阵，但仍保持最小高价值样本原则。
- 本轮聚焦两类此前还不够系统的组合：
  - 允许来源列表 `ALLOWED_ORIGINS` 的规范化组合
  - 默认端口规范化与允许来源组合

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
- 不修改缓存策略设计。
- 不做 UI、数据库结构、认证业务逻辑改动。

## 假设
- 当前已覆盖同源规范化组合，但“允许来源列表中的 punycode / Unicode / 默认端口规范化”等价关系还没有形成正式矩阵回归。
- 这类组合更可能暴露“配置值规范化”和“请求头规范化”之间的不一致。

## 风险
- 若一次性加入过多样本，首次失败时根因不容易聚焦。
- 需要严格区分“同源放行”和“允许来源列表放行”这两条逻辑链。

## 完成标准
- 已为 `ALLOWED_ORIGINS` 相关规范化组合补正式回归。
- 若命中问题，完成最小修复并通过回归。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`

## TODO
1. 盘点允许来源列表中尚未覆盖的规范化组合。
2. 选定应允许的允许来源组合样本。
3. 选定应拒绝的不一致允许来源组合样本。
4. 补自动化回归。
5. 运行安全与认证回归。
6. 若命中问题，做最小修复并复测。
7. 回写执行记录、验证结果、复盘。
8. 若有代码改动，提交 Git。

## 执行顺序
1. 组合盘点。
2. 允许样本回归。
3. 拒绝样本回归。
4. 执行与修复。
5. 文档回写。
6. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已盘点允许来源列表相关的高价值规范化组合：
    - Unicode Origin -> punycode 允许来源
    - 默认端口 Origin -> 允许来源
    - Unicode 不匹配 Origin
    - 显式端口不匹配 Origin
- 已完成 TODO 2：
  - 已在 `testSameOriginAndAllowedCors()` 中补充应允许的样本：
    - `Origin: http://例子:18806`
    - `Origin: http://localhost:80`
  - 并扩展 `ALLOWED_ORIGINS` 为：
    - `https://studio.example.com`
    - `http://xn--fsqu00a:18806`
    - `http://localhost`
- 已完成 TODO 3：
  - 已补充应拒绝的样本：
    - `Origin: http://bücher:18806`
    - `Origin: http://localhost:18807`
- 已完成 TODO 4：
  - 已执行主仓库安全与认证回归。
  - 本轮新增用例全部通过，没有打出新的允许来源规范化缺陷。
- 已完成 TODO 5：
  - 因本轮未发现新的真实问题，无需新增代码修复。
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
  - 本轮没有打出新的代码问题。
  - 本轮把 `ALLOWED_ORIGINS` 的规范化组合也纳入了正式矩阵。
- 边界条件：
  - 当前覆盖的仍是高价值样本，不是所有允许来源组合的全量笛卡尔积。
- 遗漏点：
  - 仍可继续扩大组合矩阵，但收益已明显下降。
- 残余风险：
  - 当前未发现允许来源列表在 punycode / Unicode 或默认端口规范化层存在新的错误放行问题。
- 是否回写规划：
  - 是。本轮已回写新增覆盖与结论。

## 当前结果
- 第三十二阶段已完成：
  - 新增 `ALLOWED_ORIGINS` 规范化组合回归
  - 当前未发现新的允许来源规范化缺陷

## 下一阶段建议 TODO
1. 若继续主线，可转入非 API 缓存策略是否设计化的讨论。
2. 若准备收口，可冻结当前测试矩阵口径并结束。
