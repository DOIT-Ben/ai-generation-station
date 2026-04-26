# 2026-04-26 主线第十一阶段连续开发计划

## 目标
- 继续按主线 TODO 收缩 `public\js\app.js` 与 `server\state-store.js`。
- 本轮优先拆分前端聊天发送入口 helper，再拆分后端事务与审计核心 helper，保持现有用户行为不变。

## 范围
- 前端：
  - 拆分 `public\js\app.js` 中消息发送入口、重试入口与排队提示 orchestrator。
- 后端：
  - 拆分 `server\state-store.js` 中事务包装与审计写入核心 helper。
- 测试：
  - 更新 `test-page-markup.js` 等契约检查，验证新模块接入与导出。

## 非范围
- 不新增产品功能。
- 不修改数据库 schema。
- 不调整页面视觉样式。
- 不处理与本轮无关的未跟踪文档文件。

## 假设
- 聊天发送入口逻辑主要依赖聊天请求工具、toast、队列状态与会话侧边栏刷新，适合抽成独立前端 helper。
- 事务与审计写入逻辑边界清晰，适合抽成独立后端核心 helper，供 auth、maintenance 与 users 继续复用。
- 现有测试集足以覆盖本轮风险；若发现遗漏，只补最小必要契约检查。

## 风险
- 前端发送入口 helper 直接控制队列、重试与消息输入框清理，依赖注入遗漏会影响聊天主流程。
- 后端事务与审计写入是多个模块的公共底座，若抽离失误会同时影响认证、后台和维护逻辑。
- 契约测试若继续绑定 `app.js` 单文件文本实现，后续拆分仍会出现误报。

## 完成标准
- `public\js\app.js` 不再直接承载完整的聊天发送入口与重试入口实现，只保留装配或薄封装。
- `server\state-store.js` 中事务与审计核心职责至少完成一轮可验证抽离。
- 新模块已接入加载链，相关测试通过。
- 本轮执行记录、验证结果、复盘完整写入 `docs\dev-records`。
- 本轮改动完成后提交一次 Git。

## 验证方式
- `node --check public\js\app.js`
- `node --check public\js\chat-entry-tools.js`
- `node --check server\state-store.js`
- `node --check server\state-store-core.js`
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
1. 盘点 `public\js\app.js` 中聊天发送入口、重试入口与排队反馈的职责边界。
2. 抽离前端聊天发送入口模块并接入首页脚本链。
3. 更新页面契约测试。
4. 执行前端阶段回归并修复问题。
5. 盘点 `server\state-store.js` 中事务与审计核心 helper 的职责边界。
6. 抽离后端事务与审计核心 helper。
7. 执行统一回归并修复问题。
8. 回写开发日志、验证结果、复盘。
9. 提交 Git。

## 执行顺序
1. 前端聊天发送入口 helper 盘点与拆分。
2. 前端契约测试更新。
3. 前端阶段回归。
4. 后端事务与审计核心 helper 盘点与拆分。
5. 统一回归。
6. 文档回写。
7. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 盘点 `public\js\app.js` 中 `retryTransientAssistantMessage`、`sendChatMessage`、排队提示与侧边栏刷新逻辑的职责边界。
  - 确认这组逻辑主要依赖聊天底层请求工具、toast、队列状态与会话侧边栏刷新，适合抽为独立前端 helper。
- 已完成 TODO 2：
  - 新增 `public\js\chat-entry-tools.js`。
  - 抽离 `AigsChatEntryTools`，承接聊天发送入口与失败重试入口逻辑。
  - 在 `public\index.html` 中接入 `/js/chat-entry-tools.js`。
  - 在 `public\js\app.js` 中新增 `requireChatEntryTools()`，并将对应入口改为薄封装委托。
- 已完成 TODO 3：
  - 更新 `test-page-markup.js`，校验新聊天入口模块接入、浏览器导出与装配契约。
- 已完成 TODO 4：
  - 执行前端阶段回归，确认页面契约、前端状态与 UI smoke 测试通过。
- 已完成 TODO 5：
  - 盘点 `server\state-store.js` 中 `runInTransaction`、`appendAuditLogRecord` 的职责边界。
  - 确认这组逻辑是 auth、maintenance 与 users 的公共底座，适合抽为独立后端核心 helper。
- 已完成 TODO 6：
  - 新增 `server\state-store-core.js`。
  - 抽离事务包装与审计写入核心逻辑。
  - 在 `server\state-store.js` 中改为通过 `stateStoreCore` 委托调用。
- 已完成 TODO 7：
  - 执行统一回归，覆盖前端、后端、迁移、契约和总 smoke。
- 已完成 TODO 8：
  - 已回写执行记录、验证结果、复盘。
- TODO 9 待执行：
  - 待完成提交前检查后执行 Git 提交。

## 复盘
- 新问题：
  - `npm run test:ui-flow` 默认依赖现成的 `127.0.0.1:18791` 服务，本轮为保持可复现性补充了“自启临时服务”的验证方式。
- 边界条件：
  - 本轮只拆了前端聊天发送入口与后端事务/审计核心 helper，没有碰接口协议、数据库 schema 或视觉层。
- 遗漏点：
  - `app.js` 里仍有自定义下拉、输入错误提示和页面级绑定 helper，下一轮可以继续按交互簇收缩。
  - `state-store.js` 仍保留模块装配层与少量查询/注入 glue code，但已经更接近纯装配文件。
- 是否回写规划：
  - 是。本轮结果已回写，下一阶段可以继续沿着“前端交互簇优先，后端装配层继续瘦身”的顺序推进。

## 验证结果
- 语法检查通过：
  - `node --check public\js\chat-entry-tools.js`
  - `node --check public\js\app.js`
  - `node --check server\state-store-core.js`
  - `node --check server\state-store.js`
- 契约检查通过：
  - `node test-page-markup.js`
- 前端阶段回归通过：
  - `npm run test:frontend`
  - `$env:UI_SMOKE_LAUNCH_SERVER='1'; npm run test:ui-flow`
- 后端阶段回归通过：
  - `node test-auth-history.js`
  - `node test-state-maintenance.js`
  - `node test-state-foreign-keys.js`
  - `node test-state-migrations.js`
- 统一检查通过：
  - `npm run check`
  - `npm test`（通过临时本地服务环境执行）
- 提交前检查通过：
  - `git diff --check`
  - 说明：输出仅包含 CRLF 提示告警，无 diff 错误。

## 当前结果
- `public\js\app.js` 已由本轮开始前的 `3458` 行下降到 `3429` 行。
- `server\state-store.js` 已由本轮开始前的 `1166` 行下降到 `1127` 行。

## 下一阶段建议 TODO
1. 盘点 `public\js\app.js` 剩余的自定义下拉、输入错误提示与页面级绑定 helper。
2. 再抽离一组前端交互或表单反馈模块。
3. 更新契约测试，继续降低对 `app.js` 文本实现的耦合。
4. 盘点 `server\state-store.js` 剩余的模块装配层与小型注入 glue code。
5. 再拆一组低耦合后端 helper。
6. 执行阶段回归。
7. 回写文档并提交。
