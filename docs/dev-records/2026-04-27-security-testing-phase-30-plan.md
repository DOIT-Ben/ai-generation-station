# 2026-04-27 安全性测试第三十阶段计划

## 目标
- 进入缓存策略设计化阶段，以最小方案收紧 API 响应缓存行为。
- 目标是对 `\api\` 路径统一建立更安全的默认缓存策略，同时尽量不影响非 API HTML、静态资源和已显式定义的流式响应行为。

## 范围
- 后端实现：
  - `server\index.js`
  - 必要时 `server\lib\http.js`
- 测试脚本：
  - `test-security-gateway.js`
- 文档记录：
  - `docs\dev-records`
  - `docs\test\security-testing-report.md`

## 非范围
- 不继续扩展 `Host / Origin` 组合矩阵。
- 不修改插件 CLI 逻辑。
- 不对非 API 静态资源缓存策略做全面重构。

## 假设
- 当前最小安全收益最大的一步，是让所有 `\api\` 响应默认不被缓存。
- 已显式设置的更具体缓存头，例如 SSE 的 `no-cache, no-transform`，不应被覆盖。

## 风险
- 如果直接覆盖所有响应头，可能误伤现有 SSE 流式接口。
- 如果连非 API 路径一起改，改动面会显著扩大。

## 完成标准
- `\api\` 路径默认具有统一安全缓存策略。
- 现有 SSE / 流式接口缓存头行为不被破坏。
- 对应测试回归通过。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check server\\index.js`
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`

## TODO
1. 盘点当前 API 缓存头行为与最小改动面。
2. 设计 API 默认缓存策略。
3. 实现最小代码改动。
4. 更新 API 缓存相关回归。
5. 运行安全与认证回归。
6. 若命中问题，做最小修复并复测。
7. 回写执行记录、验证结果、复盘。
8. 若有代码改动，提交 Git。

## 执行顺序
1. 现状盘点。
2. 策略定义。
3. 最小实现。
4. 回归更新。
5. 执行与修复。
6. 文档回写。
7. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已盘点当前 API 缓存头行为：
    - `\api\auth\csrf`、`\api\auth\session`、`\api\auth\logout` 已显式 `no-store`
    - SSE 流式接口已显式 `no-cache, no-transform`
    - 普通 API 路径此前无默认缓存头
- 已完成 TODO 2：
  - 已定义最小策略：
    - 所有 `\api\` 路径默认 `Cache-Control: no-store`
    - 若 handler 已自行设置 `Cache-Control`，则不覆盖
    - 非 API HTML、静态资源、404 路径暂时不动
- 已完成 TODO 3：
  - 已在 `server\index.js` 实现最小代码改动：
    - 对 `\api\` 路径统一设置默认 `Cache-Control: no-store`
    - 仅在当前未设置该头时生效
- 已完成 TODO 4：
  - 已更新 `test-security-gateway.js` 中的 API 缓存断言：
    - `\api\health` 现在要求返回 `Cache-Control: no-store`
- 已完成 TODO 5：
  - 已执行主仓库安全与认证回归：
    - `node --check server\index.js`
    - `node --check test-security-gateway.js`
    - `node test-security-gateway.js`
    - `node test-auth-history.js`
  - 本轮全部通过，没有打出新的回归问题。
- 已完成 TODO 6：
  - 已回写执行记录、验证结果与复盘。
- TODO 8 待执行：
  - 待本轮 Git 提交。

## 验证结果
- 语法检查通过：
  - `node --check server\index.js`
  - `node --check test-security-gateway.js`
- 安全测试通过：
  - `node test-security-gateway.js`
- 认证回归通过：
  - `node test-auth-history.js`

## 复盘
- 新问题：
  - 本轮没有打出新的代码问题。
  - 当前 API 缓存策略已从“局部敏感接口显式 no-store”升级为“所有 API 默认 no-store，SSE 特例保留”。
- 边界条件：
  - 本轮没有改动非 API 路径缓存策略。
  - SSE 接口因已显式设置 `no-cache, no-transform`，未被默认头覆盖。
- 遗漏点：
  - 当前仍未设计更细的非 API 缓存策略。
- 残余风险：
  - 当前主仓库缓存策略已经在 API 层形成统一收口，剩余风险主要在非 API 缓存设计是否需要进一步细化。
- 是否回写规划：
  - 是。本轮已回写策略、实现与验证结果。

## 当前结果
- 第三十阶段已完成：
  - 所有 API 路径默认 `Cache-Control: no-store`
  - SSE 流式接口缓存头保持不变
  - 主仓库安全与认证回归通过

## 下一阶段建议 TODO
1. 若准备最终收口，可统一整理最终完成面与残余风险总结。
2. 若继续深入，可讨论是否对非 API 路径设计更细缓存策略。
