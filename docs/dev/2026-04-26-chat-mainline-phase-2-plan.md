# 2026-04-26 聊天主链第二阶段连续开发计划

## 目标
- 按既定顺序继续拆分前端与后端剩余大文件，降低 `public\js\app.js`、`server\state-store.js`、`server\routes\state.js` 的耦合与维护成本。
- 在不改变现有业务行为的前提下，完成本轮模块化、回归验证、文档回写与 Git 提交。

## 范围
- 前端：
  - 拆分会话操作层
  - 拆分阅读提纲层
  - 更新首页脚本加载链与相关测试
- 后端：
  - 拆分 `server\state-store.js`
  - 拆分 `server\routes\state.js`
- 工程化：
  - 统一执行阶段回归
  - 持续回写开发日志、验证结果、复盘

## 非范围
- 不新增业务功能
- 不调整数据库 schema 语义
- 不修改与本轮 TODO 无关的页面、接口、测试基线
- 不处理当前工作区内无关的脏文件

## 假设
- 现有前端模块化模式继续适用：新增脚本通过 `public\index.html` 顺序加载。
- 现有后端文件可先通过“同目录 helper 模块 + 原导出接口不变”方式渐进拆分，避免一次性改动过大。
- 现有测试集足以覆盖本轮拆分回归风险；如发现空白，再补最小必要验证。

## 风险
- 会话操作层与当前活动会话、归档列表、工作区持久化强耦合，依赖注入遗漏会导致会话切换或归档异常。
- 阅读提纲层与消息渲染 DOM 结构耦合，拆分时若遗漏选择器或时序，会导致提纲丢失或高亮不同步。
- `server\state-store.js` 兼顾 schema、归一化、业务存储与维护任务，拆分边界不清会放大回归面。
- `server\routes\state.js` 包含认证、CSRF、通知、管理员流程，若抽离方式不稳，容易影响登录与后台管理。

## 完成标准
- `public\js\app.js` 不再直接承载会话操作层与阅读提纲层完整实现，仅保留薄封装或装配逻辑。
- `server\state-store.js` 与 `server\routes\state.js` 至少各完成一轮可验证的职责拆分，且对外行为保持一致。
- 相关脚本检查与回归测试通过。
- 开发日志、验证结果、复盘完整落到 `docs\dev`。
- 所有本轮改动完成后提交一次 Git。

## 验证方式
- `node --check public\js\app.js`
- `node --check public\js\conversation-action-tools.js`
- `node --check public\js\chat-outline-tools.js`
- `node --check server\state-store.js`
- `node --check server\routes\state.js`
- `npm run test:frontend`
- `npm run test:ui-flow`
- `npm run check`
- 视拆分结果补充后端直接验证命令

## TODO
1. 盘点前端会话操作层依赖、边界与测试耦合点。
2. 抽离前端会话操作层模块并接入 `public\index.html`。
3. 更新与会话操作层相关的测试断言。
4. 盘点阅读提纲层与 DOM 时序依赖。
5. 抽离阅读提纲层模块并接入首页。
6. 执行前端阶段回归测试并修复发现的问题。
7. 盘点 `server\state-store.js` 内部职责聚类与低风险拆分边界。
8. 拆分 `server\state-store.js`。
9. 盘点 `server\routes\state.js` 的 helper、guard、auth 流程边界。
10. 拆分 `server\routes\state.js`。
11. 执行最终统一回归测试并修复问题。
12. 回写执行记录、验证结果、复盘。
13. 提交 Git。

## 执行顺序
1. 前端会话操作层
2. 前端阅读提纲层
3. 前端阶段回归
4. 后端 `server\state-store.js`
5. 后端 `server\routes\state.js`
6. 最终统一回归
7. 文档回写
8. Git 提交

## 执行记录
- 已建立本轮总计划文档，后续按 TODO 顺序持续补充。
- 阶段 1 已完成：前端会话操作层
  - 新增 `public\js\conversation-action-tools.js`
  - 已抽离：
    1. `selectConversation`
    2. `renameConversationById`
    3. `archiveConversationById`
    4. `restoreArchivedConversation`
    5. `deleteArchivedConversation`
    6. `loadConversations`
  - `public\js\app.js` 已改为对应薄封装。
- 阶段 2 已完成：前端阅读提纲层
  - 新增 `public\js\chat-outline-tools.js`
  - 已抽离：
    1. `annotateChatMessageHeadings`
    2. `renderChatReadingOutline`
    3. `syncChatReadingOutlineActiveTarget`
  - `public\js\app.js` 已改为对应薄封装。
- 前端加载链与验证更新：
  - `public\index.html` 已接入 `chat-outline-tools.js`、`conversation-action-tools.js`
  - `test-page-markup.js` 已从旧的 `app.js` 文本位置检查，补齐到新模块加载与发布契约检查
- 前端阶段验证结果：
  - `node --check public\js\conversation-action-tools.js`：通过
  - `node --check public\js\chat-outline-tools.js`：通过
  - `node --check public\js\app.js`：通过
  - `node test-page-markup.js`：通过
  - `npm run test:frontend`：通过
  - `npm run test:ui-flow`：通过
- 前端阶段过程修复：
  - 发现 `test-page-markup.js` 仍硬编码检查会话归档提示文案位于 `app.js`，拆分后误报失败。
  - 已调整为检查 `conversation-action-tools.js` 的模块契约与文案存在性，保持测试目标与新结构一致。
- 阶段 3 已完成：`server\state-store.js`
  - 新增 `server\state-store-helpers.js`
  - 已抽离：
    1. JSON 安全解析
    2. 透明 token 生成与 hash
    3. 用户、凭据、偏好、会话消息、任务、审计、auth token 归一化
    4. 对话标题/摘要/时间线/展示版本聚合
    5. 审计查询构造
    6. 系统模板 seed 构造
  - `server\state-store.js` 保留数据库 schema、prepared statements、事务型业务写路径。
- 阶段 4 已完成：`server\routes\state.js`
  - 新增 `server\routes\state-route-helpers.js`
  - 已抽离：
    1. 路径、用户名、邮箱、日期、token 规范化
    2. 用户名/密码/邮箱校验
    3. session user / user payload / invitation payload 构造
    4. 认证 session cookie、CSRF seed 与 token 生成
    5. 邀请链接签发与通知分发辅助逻辑
    6. 限流规则、审计 actor、统一限流响应
    7. 当前 session 解析、用户守卫、管理员守卫
  - `server\routes\state.js` 现在更偏向路由表本身，主流程可读性更高。
- 后端阶段验证结果：
  - `node --check server\state-store-helpers.js`：通过
  - `node --check server\state-store.js`：通过
  - `node -e "require('./server/state-store.js')"`：通过
  - `node --check server\routes\state-route-helpers.js`：通过
  - `node --check server\routes\state.js`：通过
  - `node -e "require('./server/routes/state.js')"`：通过
  - `node test-state-maintenance.js`：通过
  - `node test-state-foreign-keys.js`：通过
  - `node test-state-migrations.js`：通过
  - `node test-auth-history.js`：通过
- 最终统一回归结果：
  - `npm run test:frontend`：通过
  - `npm run test:ui-flow`：通过
  - `npm run check`：通过
  - `npm test`：通过

## 最终结果
- `public\js\app.js` 由上轮完成后的 `4665` 行继续下降到 `4518` 行。
- `server\state-store.js` 当前 `1829` 行，已剥离通用 helper。
- `server\routes\state.js` 当前 `889` 行，已剥离认证与守卫 helper。
- 本轮新增模块：
  1. `public\js\conversation-action-tools.js`
  2. `public\js\chat-outline-tools.js`
  3. `server\state-store-helpers.js`
  4. `server\routes\state-route-helpers.js`

## 复盘
- 前端剩余聊天主链热点已基本剥离完成，`app.js` 继续向“装配层 + 少量业务入口”收缩。
- 这轮测试暴露的主要不是运行时 bug，而是测试与文件物理位置的耦合，说明当前拆分策略稳定，但测试还需继续去位置耦合。
- 后端拆分验证了一个判断：先抽纯 helper、guard、payload builder，能在不扩大回归面的前提下快速压缩大文件。
- 目前距离“最终目标”已经不远，剩余更适合继续处理的是：
  1. `public\js\app.js` 中模板工作台与多功能业务流
  2. `server\state-store.js` 中高耦合写路径进一步分层
  3. `server\routes\state.js` 路由表按 auth / account / admin 分块

## 下一轮 TODO
1. 盘点 `public\js\app.js` 中模板工作台与业务 tab 的高耦合入口。
2. 拆分模板工作台逻辑，继续压缩首页主控文件。
3. 复查 `server\state-store.js` 中用户、会话、conversation、template 四类写路径的进一步边界。
4. 选择一组低风险写路径继续拆分并补针对性测试。
5. 将 `server\routes\state.js` 的路由表按 `auth`、`account`、`admin` 分块整理。
6. 执行下一轮全量回归。
