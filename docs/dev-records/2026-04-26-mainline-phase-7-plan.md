# 2026-04-26 主线第七阶段连续开发计划

## 目标
- 继续按主线 TODO 收缩 `public\js\app.js` 与 `server\state-store.js`。
- 本轮优先拆分前端初始化绑定与局部 UI 控制模块，再拆分后端会话读取 helper，保持现有用户行为不变。

## 范围
- 前端：
  - 拆分 `public\js\app.js` 中局部下拉框转换、初始化绑定、媒体上传交互与偏好绑定等职责。
- 后端：
  - 拆分 `server\state-store.js` 中会话列表读取、消息时间线读取、prompt 消息构建与 turn 激活读取职责。
- 测试：
  - 更新 `test-page-markup.js` 等契约检查，验证新模块接入与导出。

## 非范围
- 不新增产品功能。
- 不修改数据库 schema。
- 不调整页面视觉样式。
- 不处理与本轮无关的未跟踪文档文件。

## 假设
- 现有首页脚本允许继续新增一个初始化绑定/UI 控制模块。
- 初始化绑定虽然依赖较多，但可以通过依赖注入把 DOM、事件处理与业务动作隔离出来。
- 后端会话读取逻辑主要依赖 prepared statement 与 normalize helper，适合抽为独立 helper 模块。

## 风险
- 前端初始化绑定触及上传、快捷键、聊天输入、下拉框和偏好保存，依赖遗漏会直接影响工作台基本交互。
- 会话读取 helper 同时影响聊天加载、版本切换与 prompt 构建，若时间线还原或 metadata 读取边界错位，会影响对话上下文。
- 测试若仍绑定 `app.js` 单文件文本，后续继续拆分会再次误报。

## 完成标准
- `public\js\app.js` 不再直接承载完整的初始化绑定与局部 UI 控制实现，只保留装配或薄封装。
- `server\state-store.js` 中会话读取职责至少完成一轮可验证抽离。
- 新模块已接入加载链，相关测试通过。
- 本轮执行记录、验证结果、复盘完整写入 `docs\dev-records`。
- 本轮改动完成后提交一次 Git。

## 验证方式
- `node --check public\js\app.js`
- `node --check public\js\workspace-init-tools.js`
- `node --check server\state-store.js`
- `node --check server\state-store-conversations.js`
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
1. 盘点 `public\js\app.js` 中初始化绑定、局部下拉框控制与偏好事件职责边界。
2. 抽离前端初始化绑定/UI 控制模块并接入首页脚本链。
3. 更新页面契约测试。
4. 执行前端阶段回归并修复问题。
5. 盘点 `server\state-store.js` 中会话读取、消息时间线与 prompt 构建职责边界。
6. 抽离后端会话读取 helper。
7. 执行统一回归并修复问题。
8. 回写开发日志、验证结果、复盘。
9. 提交 Git。

## 执行顺序
1. 前端初始化绑定/UI 控制盘点与拆分。
2. 前端契约测试更新。
3. 前端阶段回归。
4. 后端会话读取 helper 盘点与拆分。
5. 统一回归。
6. 文档回写。
7. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 盘点 `public\js\app.js` 中 `init()` 内的大段初始化绑定、`convertAllSelectsToCustomDropdowns()`、`initCustomDropdownSm()`、`initMobileSidebar()` 的职责边界。
  - 确认这一组逻辑主要负责工作区交互绑定、局部 UI 控制与移动端侧栏，适合收敛为独立初始化模块。
- 已完成 TODO 2：
  - 新增 `public\js\workspace-init-tools.js`。
  - 抽离 `AigsWorkspaceInitTools`，承接工作区交互绑定、小型自定义下拉框初始化与移动端侧栏绑定逻辑。
  - 在 `public\index.html` 中接入 `/js/workspace-init-tools.js`。
  - 在 `public\js\app.js` 中新增 `requireWorkspaceInitTools()`，并将初始化绑定与局部 UI 控制改为薄封装委托。
- 已完成 TODO 3：
  - 更新 `test-page-markup.js`，校验新初始化模块接入、浏览器导出与关键契约。
  - 过程中发现旧断言仍硬编码检查 `app.js` 中存在 `loadChatModelOptions();`。
  - 已调整为检查 `workspace-init-tools.js` 对聊天模型初始化链路的模块契约。
- 已完成 TODO 4：
  - 执行前端阶段回归，确认首页脚本链、初始化绑定、上传拖拽、聊天输入、模型下拉与 UI 流程测试均通过。
- 已完成 TODO 5：
  - 盘点 `server\state-store.js` 中 `listConversations`、`listArchivedConversations`、`getConversation`、`getArchivedConversation`、`getConversationMessageTimeline`、`getConversationMessages`、`getConversationMessage`、`getConversationPromptMessages`、`setConversationTurnActiveAssistant` 的职责边界。
  - 确认这组逻辑主要依赖 conversation statement 与 normalize helper，适合抽离为独立会话读取 helper。
- 已完成 TODO 6：
  - 新增 `server\state-store-conversations.js`。
  - 抽离会话列表读取、消息时间线读取、prompt 消息构建与 turn 激活读取逻辑。
  - 在 `server\state-store.js` 中改为通过 `stateStoreConversations` 委托调用。
- 已完成 TODO 7：
  - 执行统一回归，覆盖前端、后端、契约和总 smoke。
- TODO 8 进行中：
  - 正在回写执行记录、验证结果、复盘。
- TODO 9 待执行：
  - 待完成提交前检查后执行 Git 提交。

## 复盘
- 新问题：
  - `app.js` 明显进一步退回装配层后，剩余热点已经更集中在聊天渲染主链、富文本处理和少量表单校验辅助，后续拆分路径更清晰了。
- 边界条件：
  - 本轮只拆了初始化绑定/UI 控制与后端会话读取 helper，没有碰聊天流式行为、数据库 schema 或页面视觉层。
- 遗漏点：
  - `state-store.js` 仍保留用户查询、审计写入、维护装配与部分快照 helper，后续还可以再拆一组低耦合 helper。
- 是否回写规划：
  - 是。本轮结果已回写，下一阶段可以继续遵循“前端聊天主链剩余装配优先，后端用户/审计剩余 helper 跟进”的顺序。

## 验证结果
- 语法检查通过：
  - `node --check public\js\workspace-init-tools.js`
  - `node --check public\js\app.js`
  - `node --check server\state-store-conversations.js`
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
- `public\js\app.js` 已由本轮开始前的 `3938` 行下降到 `3652` 行。
- `server\state-store.js` 已由本轮开始前的 `1300` 行下降到 `1268` 行。

## 下一阶段建议 TODO
1. 盘点 `public\js\app.js` 剩余的聊天渲染装配、富文本辅助与少量表单校验职责。
2. 抽离一组聊天 UI 装配或渲染辅助模块。
3. 更新页面契约测试，继续减少对 `app.js` 文本实现的耦合。
4. 盘点 `server\state-store.js` 剩余的用户查询、审计写入或快照 helper 职责。
5. 再拆一组低耦合 helper。
6. 执行阶段回归。
7. 回写文档并提交。
