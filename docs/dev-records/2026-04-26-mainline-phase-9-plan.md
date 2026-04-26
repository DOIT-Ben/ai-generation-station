# 2026-04-26 主线第九阶段连续开发计划

## 目标
- 继续按主线 TODO 收缩 `public\js\app.js` 与 `server\state-store.js`。
- 本轮优先拆分前端聊天消息元信息 helper，再拆分后端会话快照与清理 helper，保持现有用户行为不变。

## 范围
- 前端：
  - 拆分 `public\js\app.js` 中聊天消息状态徽标、消息 meta 行与局部输入拼接 helper。
- 后端：
  - 拆分 `server\state-store.js` 中过期清理与 conversation snapshot helper。
- 测试：
  - 更新 `test-page-markup.js` 等契约检查，验证新模块接入与导出。

## 非范围
- 不新增产品功能。
- 不修改数据库 schema。
- 不调整页面视觉样式。
- 不处理与本轮无关的未跟踪文档文件。

## 假设
- 聊天消息状态与 meta 构建逻辑主要依赖时间格式化、UI state 与转义函数，可通过依赖注入抽为独立模块。
- 会话快照与清理 helper 虽然依赖 statement 和 normalize helper，但边界比较清晰，适合拆成单独后端 helper 模块。
- 现有测试集足以覆盖本轮风险；若发现遗漏，只补最小必要契约检查。

## 风险
- 前端消息 meta helper 与消息节点渲染链紧密相连，依赖遗漏会影响聊天消息头和版本状态显示。
- 后端 snapshot helper 直接参与密码历史、审计和对话恢复读取，若上下文注入不完整会影响多个测试。
- 测试若继续绑定 `app.js` 文本结构，后续继续拆分还会重复误报。

## 完成标准
- `public\js\app.js` 不再直接承载完整的聊天消息状态/meta helper 实现，只保留装配或薄封装。
- `server\state-store.js` 中过期清理与会话快照职责至少完成一轮可验证抽离。
- 新模块已接入加载链，相关测试通过。
- 本轮执行记录、验证结果、复盘完整写入 `docs\dev-records`。
- 本轮改动完成后提交一次 Git。

## 验证方式
- `node --check public\js\app.js`
- `node --check public\js\chat-message-meta-tools.js`
- `node --check server\state-store.js`
- `node --check server\state-store-snapshots.js`
- `node test-page-markup.js`
- `npm run test:frontend`
- `npm run test:ui-flow`
- `node test-auth-history.js`
- `node test-state-maintenance.js`
- `node test-state-foreign-keys.js`
- `node test-state-migrations.js`
- `npm run check`
- `npm test`
- `git diff --check`

## TODO
1. 盘点 `public\js\app.js` 中聊天消息状态、meta 与文本拼接 helper 的职责边界。
2. 抽离前端聊天消息 meta 模块并接入首页脚本链。
3. 更新页面契约测试。
4. 执行前端阶段回归并修复问题。
5. 盘点 `server\state-store.js` 中过期清理与 conversation snapshot helper 的职责边界。
6. 抽离后端 snapshot/cleanup helper。
7. 执行统一回归并修复问题。
8. 回写开发日志、验证结果、复盘。
9. 提交 Git。

## 执行顺序
1. 前端聊天消息 meta helper 盘点与拆分。
2. 前端契约测试更新。
3. 前端阶段回归。
4. 后端 snapshot/cleanup helper 盘点与拆分。
5. 统一回归。
6. 文档回写。
7. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 盘点 `public\js\app.js` 中 `getAssistantMessageStatus`、`buildChatMessageMeta`、`appendTextToField` 的职责与依赖边界。
  - 确认消息状态徽标与 meta 行主要依赖 UI state、相对时间与转义函数，适合抽为独立前端 helper。
- 已完成 TODO 2：
  - 新增 `public\js\chat-message-meta-tools.js`。
  - 抽离 `AigsChatMessageMetaTools`，承接聊天消息状态与 meta 行构建逻辑。
  - 在 `public\index.html` 中接入 `/js/chat-message-meta-tools.js`。
  - 在 `public\js\app.js` 中新增 `requireChatMessageMetaTools()`，并将相关入口改为薄封装委托。
- 已完成 TODO 3：
  - 更新 `test-page-markup.js`，校验新聊天消息 meta 模块接入、浏览器导出与装配契约。
- 已完成 TODO 4：
  - 执行前端阶段回归，确认页面契约、前端状态与 UI smoke 测试通过。
- 已完成 TODO 5：
  - 盘点 `server\state-store.js` 中 `cleanupExpiredSessions`、`cleanupAuthTokens`、`cleanupExpiredRateLimitEvents`、`getConversationTimelineSnapshot`、`getConversationMessageSnapshot` 的职责边界。
  - 确认这组逻辑主要依赖 statement 与 normalize helper，适合抽为独立后端 snapshot/cleanup helper。
- 已完成 TODO 6：
  - 新增 `server\state-store-snapshots.js`。
  - 抽离过期 session、auth token、rate-limit 事件清理逻辑。
  - 抽离会话 timeline snapshot 与单条消息 snapshot 读取逻辑。
  - 在 `server\state-store.js` 中改为通过 `stateStoreSnapshots` 委托调用。
- 已完成 TODO 7：
  - 执行统一回归，覆盖前端、后端、迁移、契约和总 smoke。
- 已完成 TODO 8：
  - 已回写执行记录、验证结果、复盘。
- TODO 9 待执行：
  - 待完成提交前检查后执行 Git 提交。

## 复盘
- 新问题：
  - `app.js` 继续退回装配层后，剩余热点进一步集中在聊天流程编排、主题/下拉 UI 状态和若干页面级绑定逻辑，下一轮切分会更清楚。
- 边界条件：
  - 本轮只拆了聊天消息 meta helper 与后端 snapshot/cleanup helper，没有碰数据库 schema、视觉样式或 API 行为。
- 遗漏点：
  - `appendTextToField` 目前仍留在 `app.js`，但尚未形成稳定复用簇，下一轮需要先确认它是否值得独立抽离。
  - `state-store.js` 仍保留装配层与少量运行时 glue code，后续还可以继续收缩。
- 是否回写规划：
  - 是。本轮结果已回写，下一阶段可以继续沿着“前端聊天流程编排优先，后端装配层继续瘦身”的顺序推进。

## 验证结果
- 语法检查通过：
  - `node --check public\js\chat-message-meta-tools.js`
  - `node --check public\js\app.js`
  - `node --check server\state-store-snapshots.js`
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
  - 说明：输出仅包含 CRLF 提示告警，无 diff 错误。

## 当前结果
- `public\js\app.js` 已由本轮开始前的 `3551` 行下降到 `3529` 行。
- `server\state-store.js` 已由本轮开始前的 `1243` 行下降到 `1227` 行。

## 下一阶段建议 TODO
1. 盘点 `public\js\app.js` 剩余的聊天发送编排、主题/下拉状态与页面级绑定 helper。
2. 再抽离一组前端页面装配或聊天编排模块。
3. 更新契约测试，继续降低对 `app.js` 文本实现的耦合。
4. 盘点 `server\state-store.js` 剩余装配层 glue code 与小型运行时 helper。
5. 再拆一组低耦合后端 helper。
6. 执行阶段回归。
7. 回写文档并提交。
