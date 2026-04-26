# 2026-04-26 主线第六阶段连续开发计划

## 目标
- 继续按主线 TODO 收缩 `public\js\app.js` 与 `server\state-store.js`。
- 本轮优先拆分前端工作区状态与草稿模块，再拆分后端模板读取与审计查询职责，保持现有用户行为不变。

## 范围
- 前端：
  - 拆分 `public\js\app.js` 中工作区状态保存、草稿快照、字段默认值、翻唱来源模式、草稿清理等职责。
- 后端：
  - 拆分 `server\state-store.js` 中模板读取、审计日志读取与审计日志查询职责。
- 测试：
  - 更新 `test-page-markup.js` 等契约检查，验证新模块接入与导出。

## 非范围
- 不新增产品功能。
- 不修改数据库 schema。
- 不调整页面视觉样式。
- 不处理与本轮无关的未跟踪文档文件。

## 假设
- 现有首页脚本允许继续新增一个工作区状态模块。
- 工作区状态逻辑已经具备相对独立的输入、输出与依赖注入边界。
- 后端模板读取与审计查询主要依赖 helper、statement 和 `db.prepare(...)`，适合抽为独立 helper 模块。

## 风险
- 工作区草稿逻辑同时触及本地字段默认值、用户偏好、自动保存节流和翻唱来源切换，依赖注入遗漏会影响恢复与保存体验。
- 审计查询依赖动态 SQL 片段，拆分时若参数顺序或分页边界错位，会导致后台审计页结果错误。
- 测试若仍绑定 `app.js` 单文件文本，后续继续拆分还会反复误报。

## 完成标准
- `public\js\app.js` 不再直接承载完整的工作区状态与草稿实现，只保留薄封装或装配逻辑。
- `server\state-store.js` 中模板读取与审计查询职责至少完成一轮可验证抽离。
- 新模块已接入加载链，相关测试通过。
- 本轮执行记录、验证结果、复盘完整写入 `docs\dev-records`。
- 本轮改动完成后提交一次 Git。

## 验证方式
- `node --check public\js\app.js`
- `node --check public\js\workspace-state-tools.js`
- `node --check server\state-store.js`
- `node --check server\state-store-queries.js`
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
1. 盘点 `public\js\app.js` 中工作区状态、草稿、字段默认值与清理职责边界。
2. 抽离前端工作区状态模块并接入首页脚本链。
3. 更新页面契约测试。
4. 执行前端阶段回归并修复问题。
5. 盘点 `server\state-store.js` 中模板读取、审计读取与查询职责边界。
6. 抽离后端读取查询模块。
7. 执行统一回归并修复问题。
8. 回写开发日志、验证结果、复盘。
9. 提交 Git。

## 执行顺序
1. 前端工作区状态模块盘点与拆分。
2. 前端契约测试更新。
3. 前端阶段回归。
4. 后端读取查询职责盘点与拆分。
5. 统一回归。
6. 文档回写。
7. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 盘点 `public\js\app.js` 中 `getWorkspaceStateDraft`、`captureInitialFieldValues`、`getFieldDefaultValue`、`getVoiceSourceMode`、`applyVoiceSourceMode`、`buildWorkspaceDraftSnapshot`、`persistWorkspaceState`、`scheduleWorkspaceStateSave`、`resetFieldToDefault`、`clearFeatureDraft` 的职责边界。
  - 确认这一组函数负责工作区草稿快照、字段默认值、翻唱来源模式与自动保存调度，适合收敛为独立工作区状态模块。
- 已完成 TODO 2：
  - 新增 `public\js\workspace-state-tools.js`。
  - 抽离 `AigsWorkspaceStateTools`，承接工作区草稿读取、字段默认值、自动保存、翻唱来源模式与草稿清理逻辑。
  - 在 `public\index.html` 中接入 `/js/workspace-state-tools.js`。
  - 在 `public\js\app.js` 中新增 `requireWorkspaceStateTools()`，并将对应入口改为薄封装委托。
- 已完成 TODO 3：
  - 更新 `test-page-markup.js`，校验新工作区状态模块接入、浏览器导出与关键契约。
- 已完成 TODO 4：
  - 执行前端阶段回归，确认首页脚本链、工作区草稿恢复、自动保存相关状态与 UI 流程测试均通过。
- 已完成 TODO 5：
  - 盘点 `server\state-store.js` 中模板读取、审计读取和审计查询职责边界。
  - 确认 `listTemplates`、`listAuditLogs`、`queryAuditLogs` 主要依赖 helper、statement 与 `db.prepare(...)`，适合抽离为独立读取查询模块。
- 已完成 TODO 6：
  - 新增 `server\state-store-queries.js`。
  - 抽离模板读取、审计日志列表读取与审计分页查询逻辑。
  - 在 `server\state-store.js` 中改为通过 `stateStoreQueries` 委托调用。
  - 同时将 `stateStoreMutations` 内部依赖的 `listTemplates` 接入同一读取查询模块，避免双份实现。
- 已完成 TODO 7：
  - 执行统一回归，覆盖前端、后端、契约和总 smoke。
- TODO 8 进行中：
  - 正在回写执行记录、验证结果、复盘。
- TODO 9 待执行：
  - 待完成提交前检查后执行 Git 提交。

## 复盘
- 新问题：
  - `app.js` 进一步退回装配层后，剩余热点已经更集中在聊天渲染、下拉框和初始化绑定逻辑，后续可以更清晰地按 UI 控制层继续拆。
- 边界条件：
  - 本轮只拆了工作区状态与后端读取查询职责，没有碰聊天流式链路、数据库 schema 或页面视觉层。
- 遗漏点：
  - `state-store.js` 仍保留会话读取、消息读取、用户与审计写入等职责，后续可继续拆一组低耦合读取 helper 或会话读取 helper。
- 是否回写规划：
  - 是。本轮结果已回写，下一阶段可以继续遵循“前端主控剩余 UI 状态优先，后端状态仓储剩余读取 helper 跟进”的顺序。

## 验证结果
- 语法检查通过：
  - `node --check public\js\workspace-state-tools.js`
  - `node --check public\js\app.js`
  - `node --check server\state-store-queries.js`
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
- `public\js\app.js` 已由本轮开始前的 `4004` 行下降到 `3938` 行。
- `server\state-store.js` 已由本轮开始前的 `1353` 行下降到 `1300` 行。

## 下一阶段建议 TODO
1. 盘点 `public\js\app.js` 剩余的下拉框控制、初始化绑定与局部 UI 状态职责。
2. 抽离一组工作区 UI 控制或初始化绑定模块。
3. 更新页面契约测试，继续减少对 `app.js` 文本实现的耦合。
4. 盘点 `server\state-store.js` 剩余的会话读取、消息读取或用户查询职责。
5. 再拆一组低耦合读取 helper。
6. 执行阶段回归。
7. 回写文档并提交。
