# 2026-04-20 Chat Streaming Versioning Execution

## 本轮范围
- 前端：`public/js/app.js`、`public/index.html`、`public/css/style.css`
- 后端：`server/routes/service.js`、`server/routes/state.js`、`server/state-store.js`
- 校验：`test-page-markup.js`

## 执行记录
### TODO 1 审查聊天链路
- 确认当前 `/api/chat` 仍是整包 JSON 返回，前端只是在拿到整段文本后本地“逐字播放”。
- 确认用户上滑失败的根因是流式播放阶段每一批字符都会强行 `scrollTop = scrollHeight`。
- 确认消息数据结构没有 turn/version 元信息，因此无法可靠实现“同一轮回复多版本切换”。

#### 单任务复盘
- 新问题：如果只补前端按钮而不改消息数据结构，重写最终会变成“多插一条消息”，会把会话语义搞乱。
- 边界条件：旧会话历史没有 turnId，必须兼容历史数据，不能要求用户清库。
- 遗漏补齐：需要给服务端流末尾补充本地会话状态事件，否则前端拿不到更新后的 messages。

### TODO 2 扩展消息版本数据结构
- 在 `conversation_messages` 增加 `metadata_json` 列，并对现有数据库做幂等补列。
- 增加 turn timeline 和 displayed messages 组装逻辑。
- 采用“用户消息持有 activeAssistantMessageId，助手消息按同一 turnId 分版本”的结构，避免对多条 assistant 记录做批量状态回写。

#### 单任务复盘
- 新问题：老数据没有 turnId，需要在读取时按“用户消息 + 后续 assistant”补出 legacy turn。
- 边界条件：切换版本必须持久化，否则刷新页面会丢失当前选中的版本。
- 遗漏补齐：需要补一个单独的激活版本接口，不能只靠前端本地切换。

### TODO 3 接入真实流式
- 服务端 `/api/chat` 新增 `stream: true` 分支，向上游请求真实流式输出并转发 SSE 事件。
- 同时在服务端聚合 `text_delta`，在流结束后补发 `conversation_state` 和 `done` 事件。
- 非流式分支仍保留，兼容既有接口约定和兜底路径。

#### 单任务复盘
- 新问题：SSE 分隔符存在 `\\r\\n\\r\\n` 形式，前后端解析器都必须兼容 CRLF。
- 边界条件：上游返回错误事件时不能继续持久化会话，也不能再补发 done。
- 遗漏补齐：客户端断开时需要中止上游请求，避免无意义继续占用连接。

### TODO 4 改造前端流式渲染与滚动控制
- 前端不再消费整段回复，而是用 `ReadableStream` 读取 SSE 增量。
- 用户在底部时自动跟随；一旦上滑脱离底部，停止强制跟随并显示“回到最新回复”按钮。
- 保留“正在思考”占位，但在真实首个文本块到达后切换成流式内容容器。

#### 单任务复盘
- 新问题：重写历史消息时若继续强制滚底，会把用户视角从中部消息直接拉走，因此重写路径必须保留当前位置。
- 边界条件：普通发送和重写旧回复的滚动策略不同，不能共用一个“永远 force follow”分支。
- 遗漏补齐：流结束后仍需重新渲染正式消息 DOM，才能挂上复制/重写/版本切换按钮。

### TODO 5 增加消息操作与版本切换
- 为 AI 回复增加复制、重写、上一版/下一版操作。
- 重写不会新增一个独立轮次，而是为同一 turn 生成新的 assistant version，并自动切换为当前生效版本。
- 切换版本调用新的会话消息激活接口，刷新当前会话显示。

#### 单任务复盘
- 新问题：版本切换后如果只更新本地状态、不重绘消息树，按钮上的版本编号不会更新。
- 边界条件：欢迎消息没有 message id，因此不展示操作按钮。
- 遗漏补齐：复制失败要走错误反馈，不能静默失败。

### TODO 6 下移继续上次工作
- 将 `workspace-resume-strip` 从主内容顶部移动到底部。
- 保留功能但降低视觉权重，减少它对聊天主区域的干扰。

#### 单任务复盘
- 新问题：底部组件移动后仍需保持全局可见，不应被当前 tab 的 display 切换吞掉，因此保留在 `main` 下但放在所有 tab 后面。
- 边界条件：移动端下继续工作条仍需单列布局，避免底部按钮换行挤压。
- 遗漏补齐：需要同步更新静态断言，避免后续改回顶部却无人发现。

## 测试与结果
- 已执行：
  - `node --check public/js/app.js`
  - `node --check server/routes/service.js`
  - `node --check server/routes/state.js`
  - `node --check server/state-store.js`
  - `node test-page-markup.js`
  - `node test-ui-flow-smoke.js --launch-server`
  - 内联状态层校验：会话消息版本切换
  - 内联服务层校验：mock SSE 流式事件转发与末尾 `conversation_state`
- 结果：
  - 前后端语法检查通过。
  - 页面静态断言通过。
  - 前端烟测通过。
  - 消息版本切换逻辑通过。
  - 服务端 SSE 转发与本地状态事件补发通过。
  - SQLite experimental warning 仍为现有运行时提示，不影响本轮结论。

## 残留说明
- 当前版本切换 UI 采用“上一版 / 下一版”轻量交互，后续可再升级成版本时间线或下拉列表。
- 流式阶段正文仍以纯文本增量展示，结构化 Markdown 在流结束后统一格式化，这是性能与稳定性的折中。
