# 2026-04-26 单文件堆叠代码排查计划

## 目标
- 检查项目中除 CSS 外，是否还有代码集中堆叠到单个文件、难以维护的问题。
- 输出明确清单，按风险和重构优先级分类。

## 范围
- 扫描当前项目内一方源码、页面、测试文件。
- 排除 `node_modules`、技能目录 `ui-ux-pro-max-0.1.0`、锁文件、生成截图等第三方或生成内容。
- 本轮只做排查和记录，不拆 JS、不拆后端文件，避免扩大改动面。

## 假设
- 单文件超过约 800 行或职责明显混杂，可视为需要关注。
- 测试文件可比业务文件更长，但如果覆盖多个领域，也应记录为维护风险。
- HTML 页面如果包含过多结构和隐藏模块，也属于可维护性问题。

## 风险
- 仅靠行数不能完全判断架构问题，需要结合文件职责和命名。
- 大文件中可能存在合理聚合入口，不能机械要求全部拆分。
- 当前工作区已有多项未提交改动，本轮不应修改业务逻辑。

## TODO
1. 扫描源码、页面、测试文件的行数和体积。
2. 对大文件做职责粗分，判断是否属于堆叠。
3. 输出按优先级分类的清单。
4. 回写执行记录、验证结果和复盘。

## 完成标准
- 明确指出除 CSS 外还有哪些文件存在堆叠问题。
- 每个问题文件说明原因、影响、建议拆分方向。
- 不修改业务代码。

## 验证方式
- 使用 `Get-ChildItem` 和 `rg` 统计文件规模与职责线索。
- 抽样读取关键大文件前部和函数\模块分布。

## 执行记录
- TODO 1 已执行：扫描当前项目内 `.js`、`.html`、`.css` 文件，排除 `node_modules`、`ui-ux-pro-max-0.1.0` 和锁文件。
- TODO 2 已执行：对超过约 800 行或职责明显混杂的文件做职责粗分。
- 最高风险堆叠文件：`public\js\app.js`，约 6858 行，包含工作区状态、AI 对话、会话列表、模板库、历史记录、生成任务、上传、语音、Markdown\公式渲染、流式请求、主题、移动端侧栏等多个职责。
- 高风险堆叠文件：`server\state-store.js`，约 2352 行，包含 SQLite schema migration、用户、会话、任务、审计、模板、token、用量、维护清理等数据层职责。
- 高风险堆叠文件：`server\routes\state.js`，约 1360 行，包含登录、注册、CSRF、会话、用户资料、密码、邀请、找回密码、管理员用户、审计等状态 API。
- 中高风险堆叠文件：`public\js\app-shell.js`，约 1362 行，包含 API client、远程持久化、本地持久化、模板种子、工具函数等公共壳逻辑。
- 中风险堆叠文件：`public\index.html`，约 860 行，包含全部首页 tab 和大量模块 DOM；虽然是单页工作台，但后续维护会受影响。
- 中风险堆叠文件：`public\js\admin-page.js`，约 807 行，包含后台用户管理、审计筛选、批量操作、邀请等多个后台功能。
- 边界文件：`server\routes\service.js` 约 764 行，包含聊天模型、模型排序、SSE、聊天请求、持久化回复等，接近需要拆分阈值。
- 测试堆叠文件：`test-auth-history.js` 约 1855 行，覆盖认证历史、账户、邀请、审计等大量集成场景；属于测试维护风险，但不直接影响生产运行。
- CSS 剩余较大模块：`public\css\chat-workspace.css` 约 1772 行、`public\css\common.css` 约 1547 行、`public\css\reset.css` 约 1160 行、`public\css\chat-dropdown.css` 约 1048 行。CSS 已完成第一轮拆分，但这些模块仍可继续细分。
- TODO 3 已执行：已按优先级分类，见验证结果。
- TODO 4 已执行：本文件完成执行记录、验证结果和复盘回写。

## 验证结果
- 当前必修\建议尽快拆：
  - `public\js\app.js`：拆为 `workspace-state.js`、`chat-state.js`、`chat-renderer.js`、`chat-stream.js`、`chat-conversations.js`、`templates.js`、`generation-tasks.js`、`media-upload.js`、`theme-ui.js`。
  - `server\state-store.js`：拆为 `db\schema.js`、`db\migrations.js`、`stores\users.js`、`stores\sessions.js`、`stores\conversations.js`、`stores\templates.js`、`stores\audit.js`、`stores\tasks.js`。
  - `server\routes\state.js`：拆为 `auth-routes.js`、`account-routes.js`、`admin-user-routes.js`、`invitation-routes.js`、`audit-routes.js`、`csrf-routes.js`。
- 可延后但需要规划：
  - `public\js\app-shell.js`：拆 API client、persistence、template seed、browser utilities。
  - `public\index.html`：可用 HTML partial 或前端组件化方式拆分 tab 内容。
  - `public\js\admin-page.js`：拆用户管理、审计、邀请、批量操作。
  - `test-auth-history.js`：按 auth、account、admin、invitation、audit 拆测试文件。
- 暂不建议本轮动：
  - `server\routes\service.js`：虽接近阈值，但与聊天代理\SSE 强相关，建议在拆 `public\js\app.js` 的聊天模块后再同步整理。
  - 已拆出的 CSS 大模块：可以继续优化，但不应与 JS\后端拆分混在同一轮。

## 复盘
- 除 CSS 外，项目确实存在明显单文件堆叠，主要集中在首页前端逻辑、数据存储层、状态路由层。
- `public\js\app.js` 是下一个最优先拆分对象，因为它既最大，又直接影响用户前端迭代速度和 UI bug 定位。
- 后端应先拆数据层再拆路由层，否则路由拆分后仍会依赖一个巨大的 store 文件，收益有限。
- 本轮未修改业务代码，符合“先检查找出来”的范围。
