# 2026-04-27 安全性测试第三十六阶段计划

## 目标
- 继续扩展 `Host / Origin` 组合矩阵，但继续保持“小组高价值样本”的策略。
- 本轮优先覆盖：
  - 同一允许来源列表中默认端口、punycode / Unicode、IPv6 交叉样本
  - 与现有样本不重复、但仍可能打出规范化差异的边缘组合

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
- 不继续插件 CLI 治理。
- 不修改缓存策略。
- 不做 UI、数据库结构、认证业务逻辑改动。

## 假设
- 当前矩阵已经覆盖大量主流样本，但仍可能在“允许来源列表中的规范化交叉样本”上打出边缘缺陷。

## 风险
- 样本过多会降低可解释性，因此本轮仍控制为极少量。

## 完成标准
- 已补一组新的高价值 `Host / Origin` 交叉样本。
- 若命中问题，完成最小修复并通过回归。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`

## TODO
1. 盘点下一组高价值 `Host / Origin` 交叉样本。
2. 选定应允许的组合。
3. 选定应拒绝的组合。
4. 补自动化回归。
5. 运行安全与认证回归。
6. 若命中问题，做最小修复并复测。
7. 回写执行记录、验证结果、复盘。
8. 若有代码改动，提交 Git。

## 执行顺序
1. 样本盘点。
2. 允许样本回归。
3. 拒绝样本回归。
4. 执行与修复。
5. 文档回写。
6. Git 提交。
