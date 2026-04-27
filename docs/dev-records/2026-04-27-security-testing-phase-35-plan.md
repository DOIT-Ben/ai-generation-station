# 2026-04-27 安全性测试第三十五阶段计划

## 目标
- 在不扩散矩阵规模的前提下，再补一组高价值样本：
  - `ALLOWED_ORIGINS` 中 IPv6 默认端口的规范化组合

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
- 不继续扩大到更多平台或更多主题。
- 不修改缓存策略。
- 不修改插件 CLI。

## 假设
- 当前 `ALLOWED_ORIGINS` 已覆盖 IPv6 显式端口，但还未明确覆盖 IPv6 默认端口规范化等价关系。

## 风险
- 这类样本边际收益已低，因此只适合做极小增量。

## 完成标准
- 已补 IPv6 默认端口相关允许来源组合回归。
- 若命中问题，完成最小修复并通过回归。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`

## TODO
1. 盘点 IPv6 默认端口相关允许来源组合。
2. 选定应允许的样本。
3. 选定应拒绝的样本。
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

## 执行记录
- 已完成 TODO 1：
  - 已盘点 IPv6 默认端口相关允许来源组合：
    - `Origin: http://[::1]:80`
    - `Origin: http://[::1]:18860`
- 已完成 TODO 2：
  - 已在 `testSameOriginAndAllowedCors()` 中补充应允许样本：
    - `Origin: http://[::1]:80`
- 已完成 TODO 3：
  - 已补充应拒绝样本：
    - `Origin: http://[::1]:18862`
- 已完成 TODO 4：
  - 首次执行稳定暴露真实问题：
    - `Expected allowed IPv6 default-port origin request to return 200, got 403`
  - 根因定位：
    - `server\lib\request-security.js` 中 `normalizeOrigin()` 处理 IPv6 authority 时，把“未显式带端口”的样本错误视作端口非法
    - 导致 `http://[::1]` 这类允许来源被错误拒绝，而 `http://[::1]:80` 又被规范化成 `http://[::1]`
- 已完成 TODO 5：
  - 已做最小修复：
    - 对 IPv6 authority 的 `portCandidate`，仅在存在显式端口时才校验格式
    - 不再把“无端口”错误归为非法
  - 修复后已执行：
    - `node --check server\lib\request-security.js`
    - `node --check test-security-gateway.js`
    - `node test-security-gateway.js`
    - `node test-auth-history.js`
  - 结果通过
- 已完成 TODO 7：
  - 已回写执行记录、验证结果与复盘。
- TODO 8 待执行：
  - 待本轮 Git 提交。

## 验证结果
- 语法检查通过：
  - `node --check server\lib\request-security.js`
  - `node --check test-security-gateway.js`
- 安全测试通过：
  - `node test-security-gateway.js`
- 认证回归通过：
  - `node test-auth-history.js`

## 复盘
- 新问题：
  - 已确认存在一个新的来源规范化缺陷：
    - IPv6 默认端口允许来源组合此前会被错误拒绝
- 边界条件：
  - 本轮修复只针对 IPv6 authority 的“无显式端口”误判，不扩大到其他主机名规则。
- 遗漏点：
  - 若继续扩矩阵，仍可再看更边缘的 IPv6 规范化样本，但收益已很低。
- 残余风险：
  - 当前未发现 `http://[::1]:80` 与 `http://[::1]` 的允许来源规范化仍存在错误拒绝。
- 是否回写规划：
  - 是。本轮已回写缺陷、根因、修复与验证。

## 当前结果
- 第三十五阶段已完成：
  - 新增 IPv6 默认端口允许来源组合回归
  - 修复了 1 个新的允许来源规范化缺陷

## 下一阶段建议 TODO
1. 若继续主线，可冻结矩阵口径并结束。
2. 若还要继续，只建议补极少量边缘 IPv6 规范化样本。
