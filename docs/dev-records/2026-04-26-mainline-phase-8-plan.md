# 2026-04-26 主线第八阶段连续开发计划

## 目标
- 继续按主线 TODO 收缩 `public\js\app.js` 与 `server\state-store.js`。
- 本轮优先拆分前端聊天消息动作模块，再拆分后端用户查询与审计写入 helper，保持现有用户行为不变。

## 范围
- 前端：
  - 拆分 `public\js\app.js` 中消息版本切换、重写、复制、按钮反馈等聊天消息动作职责。
- 后端：
  - 拆分 `server\state-store.js` 中用户查询、用户列表、活跃管理员统计、审计写入等职责。
- 测试：
  - 更新 `test-page-markup.js` 等契约检查，验证新模块接入与导出。

## 非范围
- 不新增产品功能。
- 不修改数据库 schema。
- 不调整页面视觉样式。
- 不处理与本轮无关的未跟踪文档文件。

## 假设
- 聊天消息动作逻辑虽然依赖较多，但可以通过依赖注入把 API、消息状态、按钮反馈与 toast 分离。
- 后端用户查询与审计写入主要依赖 normalize helper、statement 与事务 helper，适合抽为独立 helper 模块。
- 现有测试集足以覆盖本轮风险；若发现遗漏，只补最小必要契约检查。

## 风险
- 前端聊天消息动作触及版本切换、重写、复制和队列态，依赖注入遗漏会直接影响聊天消息交互。
- 后端用户查询与审计写入同时服务后台管理、邀请、限流测试和审计记录，若接口边界错位会影响管理功能与测试断言。
- 测试若继续绑定 `app.js` 单文件文本，后续继续拆分还会再次误报。

## 完成标准
- `public\js\app.js` 不再直接承载完整的聊天消息动作实现，只保留装配或薄封装。
- `server\state-store.js` 中用户查询与审计写入职责至少完成一轮可验证抽离。
- 新模块已接入加载链，相关测试通过。
- 本轮执行记录、验证结果、复盘完整写入 `docs\dev-records`。
- 本轮改动完成后提交一次 Git。

## 验证方式
- `node --check public\js\app.js`
- `node --check public\js\chat-message-action-tools.js`
- `node --check server\state-store.js`
- `node --check server\state-store-users.js`
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
1. 盘点 `public\js\app.js` 中聊天消息动作、按钮反馈与版本切换职责边界。
2. 抽离前端聊天消息动作模块并接入首页脚本链。
3. 更新页面契约测试。
4. 执行前端阶段回归并修复问题。
5. 盘点 `server\state-store.js` 中用户查询、管理员统计与审计写入职责边界。
6. 抽离后端用户查询与审计 helper。
7. 执行统一回归并修复问题。
8. 回写开发日志、验证结果、复盘。
9. 提交 Git。

## 执行顺序
1. 前端聊天消息动作盘点与拆分。
2. 前端契约测试更新。
3. 前端阶段回归。
4. 后端用户查询与审计 helper 盘点与拆分。
5. 统一回归。
6. 文档回写。
7. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 盘点 `public\js\app.js` 中 `activateAssistantVersion`、`setActionButtonState`、`rewriteAssistantMessage`、`flashButtonFeedback`、`copyAssistantMessage`、`copyCodeBlock`、`switchAssistantVersion` 的职责边界。
  - 确认这一组逻辑主要负责聊天消息动作、按钮反馈和版本切换，适合收敛为独立聊天消息动作模块。
- 已完成 TODO 2：
  - 新增 `public\js\chat-message-action-tools.js`。
  - 抽离 `AigsChatMessageActionTools`，承接消息版本切换、消息重写、复制与按钮反馈逻辑。
  - 在 `public\index.html` 中接入 `/js/chat-message-action-tools.js`。
  - 在 `public\js\app.js` 中新增 `requireChatMessageActionTools()`，并将对应入口改为薄封装委托。
- 已完成 TODO 3：
  - 更新 `test-page-markup.js`，校验新聊天消息动作模块接入、浏览器导出与关键契约。
- 已完成 TODO 4：
  - 执行前端阶段回归，确认聊天消息重写、版本切换、复制按钮反馈与 UI 流程测试均通过。
- 已完成 TODO 5：
  - 盘点 `server\state-store.js` 中 `getUserByUsername`、`getUserById`、`getUserByEmail`、`listUsers`、`countActiveAdmins`、`updateUser`、`appendAuditLog` 的职责边界。
  - 确认这组逻辑主要依赖用户 statement、normalize helper、事务 helper 和审计写入 helper，适合抽离为独立用户/审计 helper。
- 已完成 TODO 6：
  - 新增 `server\state-store-users.js`。
  - 抽离用户查询、用户列表、活跃管理员统计、用户更新与审计写入逻辑。
  - 在 `server\state-store.js` 中改为通过 `stateStoreUsers` 委托调用。
- 已完成 TODO 7：
  - 执行统一回归，覆盖前端、后端、契约和总 smoke。
- TODO 8 进行中：
  - 正在回写执行记录、验证结果、复盘。
- TODO 9 待执行：
  - 待完成提交前检查后执行 Git 提交。

## 复盘
- 新问题：
  - `app.js` 继续退回装配层后，剩余热点已经更集中在聊天渲染装配、富文本辅助与少量 UI 校验 helper，后续拆分会更直观。
- 边界条件：
  - 本轮只拆了聊天消息动作与后端用户/审计 helper，没有碰聊天流式协议、数据库 schema 或页面视觉层。
- 遗漏点：
  - `state-store.js` 仍保留维护装配、密码重置判定与少量 conversation snapshot helper，后续还可以再拆一组低耦合 helper。
- 是否回写规划：
  - 是。本轮结果已回写，下一阶段可以继续遵循“前端聊天渲染与富文本装配优先，后端剩余维护/快照 helper 跟进”的顺序。

## 验证结果
- 语法检查通过：
  - `node --check public\js\chat-message-action-tools.js`
  - `node --check public\js\app.js`
  - `node --check server\state-store-users.js`
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
- `public\js\app.js` 已由本轮开始前的 `3652` 行下降到 `3551` 行。
- `server\state-store.js` 已由本轮开始前的 `1268` 行下降到 `1243` 行。

## 下一阶段建议 TODO
1. 盘点 `public\js\app.js` 剩余的聊天渲染装配、富文本辅助与表单校验 helper。
2. 抽离一组聊天渲染或表单反馈模块。
3. 更新页面契约测试，继续减少对 `app.js` 文本实现的耦合。
4. 盘点 `server\state-store.js` 剩余的维护装配、密码状态判定或 conversation snapshot helper。
5. 再拆一组低耦合 helper。
6. 执行阶段回归。
7. 回写文档并提交。
