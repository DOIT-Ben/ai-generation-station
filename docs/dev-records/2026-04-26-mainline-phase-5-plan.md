# 2026-04-26 主线第五阶段连续开发计划

## 目标
- 继续按主线 TODO 收缩 `public\js\app.js` 与 `server\state-store.js`。
- 本轮优先拆分前端会话协调层，再拆分后端维护与限流职责，保持现有用户行为不变。

## 范围
- 前端：
  - 拆分 `public\js\app.js` 中会话承接、会话创建、活跃会话保障、会话标题区渲染等协调层职责。
- 后端：
  - 拆分 `server\state-store.js` 中维护摘要、审计清理、限流窗口消费等低耦合职责。
- 测试：
  - 更新 `test-page-markup.js` 等契约检查，保证新模块接入与导出可验证。

## 非范围
- 不新增产品功能。
- 不修改数据库 schema。
- 不调整页面视觉样式。
- 不处理与本轮无关的未跟踪文档文件。

## 假设
- 现有首页脚本仍允许顺序接入一个新的会话协调模块。
- 会话协调层与后端维护职责已有相对稳定的函数边界，适合继续以 helper 工厂方式拆分。
- 现有测试集足以覆盖本轮风险；若有遗漏，只补最小必要契约检查。

## 风险
- 前端会话协调层同时触及会话列表、消息恢复、工作区状态保存和聊天上下文渲染，依赖注入遗漏会直接影响聊天入口。
- 后端限流与维护摘要依赖多个 prepared statement，若传参边界错位会让限流失效或后台统计错误。
- 测试若继续绑定单文件文本位置，后续拆分会再次出现误报。

## 完成标准
- `public\js\app.js` 不再直接承载完整的会话协调层实现，只保留薄封装或装配逻辑。
- `server\state-store.js` 中维护与限流职责至少完成一轮可验证抽离。
- 新模块已接入加载链，相关测试通过。
- 本轮执行记录、验证结果、复盘完整写入 `docs\dev-records`。
- 本轮改动完成后提交一次 Git。

## 验证方式
- `node --check public\js\app.js`
- `node --check public\js\workspace-conversation-tools.js`
- `node --check server\state-store.js`
- `node --check server\state-store-maintenance.js`
- `node test-page-markup.js`
- `npm run test:frontend`
- `npm run test:ui-flow`
- `node test-auth-history.js`
- `node test-state-maintenance.js`
- `node test-state-foreign-keys.js`
- `node test-state-migrations.js`
- `npm run check`
- `npm test`

## TODO
1. 盘点 `public\js\app.js` 中会话承接与标题区渲染职责边界。
2. 抽离前端会话协调层模块并接入首页脚本链。
3. 更新前端契约测试。
4. 执行前端阶段回归并修复问题。
5. 盘点 `server\state-store.js` 中维护摘要、限流与清理职责边界。
6. 抽离后端维护职责模块。
7. 执行统一回归并修复问题。
8. 回写开发日志、验证结果、复盘。
9. 提交 Git。

## 执行顺序
1. 前端会话协调层盘点与拆分。
2. 前端契约测试更新。
3. 前端阶段回归。
4. 后端维护职责盘点与拆分。
5. 统一回归。
6. 文档回写。
7. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 盘点 `public\js\app.js` 中 `applyConversationPayload`、`renderConversationMeta`、`createConversationAndSelect`、`startNewConversation`、`ensureActiveConversation` 的职责边界。
  - 确认这一组函数同时负责会话承接、标题区渲染、会话创建与活跃会话兜底，适合收敛为独立会话协调层。
- 已完成 TODO 2：
  - 新增 `public\js\workspace-conversation-tools.js`。
  - 抽离 `AigsWorkspaceConversationTools`，承接会话 payload 落地、会话标题区渲染、会话创建和活跃会话保障逻辑。
  - 在 `public\index.html` 中接入 `/js/workspace-conversation-tools.js`。
  - 在 `public\js\app.js` 中新增 `requireWorkspaceConversationTools()`，并将对应入口改为薄封装委托。
- 已完成 TODO 3：
  - 更新 `test-page-markup.js`，校验新模块接入、浏览器导出和关键会话协调契约。
- 已完成 TODO 4：
  - 执行前端阶段回归，确认首页脚本链、会话标题区、会话创建入口和 UI 流程测试均通过。
- 已完成 TODO 5：
  - 盘点 `server\state-store.js` 中 `consumeRateLimit`、`getMaintenanceSummary`、`pruneAuditLogs` 的依赖边界。
  - 确认这组逻辑主要依赖事务 helper、rate-limit statement 与维护统计 statement，适合独立拆分。
- 已完成 TODO 6：
  - 新增 `server\state-store-maintenance.js`。
  - 抽离限流窗口消费、维护摘要计算、审计日志清理逻辑。
  - 在 `server\state-store.js` 中改为通过 `stateStoreMaintenance` 委托调用。
- 已完成 TODO 7：
  - 执行统一回归，覆盖前端、后端、契约和总 smoke。
- TODO 8 进行中：
  - 正在回写执行记录、验证结果、复盘。
- TODO 9 待执行：
  - 待完成提交前检查后执行 Git 提交。

## 复盘
- 新问题：
  - `app.js` 已经逐步退到装配层，但仍保留大量工作区状态、下拉框、聊天渲染与移动端视口控制逻辑，下一阶段仍需继续按能力边界收缩。
- 边界条件：
  - 本轮只拆了会话协调层和后端维护职责，没有碰聊天流式渲染、模板库主链、数据库 schema 或页面视觉层。
- 遗漏点：
  - `state-store.js` 仍保留会话读写、模板、审计查询等较重职责，后续可以优先再拆一组低耦合读取或查询 helper。
- 是否回写规划：
  - 是。本轮结果已回写，下一阶段可以继续遵循“前端主控剩余职责优先，后端状态仓储低耦合 helper 跟进”的顺序。

## 验证结果
- 语法检查通过：
  - `node --check public\js\workspace-conversation-tools.js`
  - `node --check public\js\app.js`
  - `node --check server\state-store-maintenance.js`
  - `node --check server\state-store.js`
- 契约检查通过：
  - `node test-page-markup.js`
- 前端阶段回归通过：
  - `npm run test:frontend`
  - `npm run test:ui-flow`
- 后端阶段回归通过：
  - `node test-auth-history.js`
  - `node test-state-maintenance.js`
  - `node test-state-foreign-keys.js`
  - `node test-state-migrations.js`
- 统一检查通过：
  - `npm run check`
  - `npm test`
- 提交前检查通过：
  - `git diff --check`

## 当前结果
- `public\js\app.js` 已由本轮开始前的 `4018` 行下降到 `4004` 行。
- `server\state-store.js` 已由本轮开始前的 `1404` 行下降到 `1353` 行。

## 下一阶段建议 TODO
1. 盘点 `public\js\app.js` 剩余的工作区状态保存、表单草稿与下拉框交互职责。
2. 抽离工作区状态或表单交互模块。
3. 更新页面契约测试，继续减少对 `app.js` 文本实现的耦合。
4. 盘点 `server\state-store.js` 剩余的审计查询、模板查询或会话读取职责。
5. 再拆一组低耦合读取 helper。
6. 执行阶段回归。
7. 回写文档并提交。
