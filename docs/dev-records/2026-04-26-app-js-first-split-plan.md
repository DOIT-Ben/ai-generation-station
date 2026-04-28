# 2026-04-26 app.js 第一轮拆分计划

## 目标
- 对 `public\js\app.js` 做第一轮结构化拆分，降低单文件堆叠程度。
- 优先拆出依赖较少、可独立验证的纯逻辑模块，不改变现有业务行为。

## 范围
- 本轮只处理 `public\js\app.js`。
- 优先拆出两块：
  - 聊天模型标签与分组工具。
  - 聊天 Markdown\公式渲染工具。
- 调整 `public\index.html` 的脚本加载顺序。
- 更新相关测试与记录。

## 不在范围
- 不拆会话状态、模板状态、生成任务、上传流程。
- 不拆 `server\state-store.js`、`server\routes\state.js`。
- 不改业务接口和页面交互。

## 假设
- 当前前端是无构建静态脚本架构，新增 JS 文件通过 `<script>` 顺序加载即可。
- 纯工具模块适合挂到 `window` 命名空间，供 `app.js` 调用。
- 第一轮拆分以“先把最独立的块切出去”为目标，不追求一次性把 `app.js` 完全拆散。

## 风险
- 如果工具模块加载顺序不对，`app.js` 初始化会报错。
- 现有测试有些直接从 `app.js` 文本中提取函数，需要同步调整。
- Markdown 渲染对聊天显示影响较敏感，必须补足回归验证。

## TODO
1. 抽离聊天模型工具到独立脚本。
2. 抽离聊天 Markdown\公式渲染工具到独立脚本。
3. 修改 `public\index.html` 脚本加载顺序。
4. 更新 `public\js\app.js` 为模块调用。
5. 更新相关测试。
6. 运行验证。
7. 回写执行记录、验证结果和复盘。

## 完成标准
- `public\js\app.js` 不再直接承载上述两块完整实现。
- 新增模块文件命名和职责清晰。
- 首页工作台正常加载，聊天模型下拉与聊天消息渲染行为不变。
- 相关测试通过。

## 验证方式
- `node test-chat-model-series-badge.js`
- `node test-chat-formula-rendering.js`
- `node test-chat-model-dropdown-visual.js`
- `node test-page-markup.js`
- `npm run test:frontend`
- `npm run test:ui-flow`
- `npm run check`

## 执行记录
- 已确认本轮切分对象为 `public\js\app.js` 中两块纯逻辑：聊天模型工具和聊天 Markdown\公式渲染工具。
- TODO 1 已执行：新增 `public\js\chat-model-utils.js`，承载 `formatChatModelDropdownLabel`、模型分组、系列 badge、tag class 等纯工具。
- TODO 2 已执行：新增 `public\js\chat-markdown.js`，承载 Markdown、代码块、表格、公式片段渲染等纯工具，并通过 `createTools()` 注入 `escapeHtml` 与 origin 依赖。
- TODO 3 已执行：`public\index.html` 已在 `app.js` 前加载 `chat-model-utils.js` 与 `chat-markdown.js`。
- TODO 4 已执行：`public\js\app.js` 已改为通过 `requireChatModelUtils()` 和 `requireChatMarkdownTools()` 调用外部模块，原函数名保留为薄封装，业务调用点未变。
- TODO 5 已执行：更新 `test-page-markup.js`、`test-chat-model-series-badge.js`、`test-chat-formula-rendering.js`，使测试契约从“实现必须写在 app.js 本体”转为“实现必须存在于独立模块并被首页加载”。
- 当前结果：
  - `public\js\app.js` 约 6858 行降到 6575 行。
  - 新增 `public\js\chat-model-utils.js` 153 行。
  - 新增 `public\js\chat-markdown.js` 263 行。
- 第二轮执行记录：
  - TODO 1 已执行：新增 `public\js\template-tools.js`，承载模板预览、搜索、最近使用、模板列表渲染、模板草稿提取等逻辑。
  - TODO 2 已执行：`public\index.html` 已在 `app.js` 前加载 `template-tools.js`。
  - TODO 3 已执行：`public\js\app.js` 的模板相关函数已改为调用 `requireTemplateTools()`，保留原函数名为薄封装。
  - TODO 4 已执行：更新 `test-page-markup.js`，验证首页脚本链已接入 `template-tools.js`，并验证模块对外暴露。
  - 第二轮结果：
    - `public\js\app.js` 进一步降到 6410 行。
    - 新增 `public\js\template-tools.js` 208 行。

## 验证结果
- `node --check public\js\chat-model-utils.js`：通过。
- `node --check public\js\chat-markdown.js`：通过。
- `node --check public\js\app.js`：通过。
- `node test-page-markup.js`：通过。
- `node test-chat-model-series-badge.js`：通过。
- `node test-chat-formula-rendering.js`：通过。
- `npm run test:frontend`：通过。
- `npm run test:ui-flow`：通过。
- `node --check public\js\template-tools.js`：通过。
- `node test-page-markup.js`：通过。
- `node test-chat-model-series-badge.js`：通过。
- `node test-chat-formula-rendering.js`：通过。
- `npm run check`：通过。

## 复盘
- 这轮拆分选择了低依赖纯逻辑块，风险可控，验证成本也低，适合作为 `app.js` 的第一刀。
- 为了避免一次性打碎现有调用关系，`app.js` 里保留了同名薄封装函数；第二轮可以继续把会话列表、模板库、聊天流式请求拆出去。
- 测试层面已从“强依赖单文件实现位置”转成“验证独立模块和加载链”，后续再拆不会每次都被旧测试结构阻碍。
- 第二轮表明模板块也适合同样策略：先抽工具与渲染，再保留 `app.js` 包装层。下一轮最合适的目标是会话列表与归档面板，因为它们仍然是一大块集中逻辑。
- 用户追加要求：继续拆分 `app.js`。已判定第二轮优先切模板库相关逻辑，暂不动会话归档和聊天流式请求主链。
- 第二轮 TODO：
  1. 抽离模板库工具与渲染逻辑到独立脚本。
  2. 修改 `public\index.html` 脚本加载顺序。
  3. 更新 `public\js\app.js` 为模板模块调用。
  4. 更新相关测试。
  5. 运行验证。
- 第三轮策略：先切会话展示层，不切会话动作层。范围限定为标题\摘要\时间\分组\排序\筛选\列表渲染\归档列表渲染\侧边摘要\搜索反馈，避免把 `selectConversation`、`archiveConversationById`、流式消息状态一起卷入。
- 第三轮补充规划：
  - 目标：继续削减 `public\js\app.js` 的展示层体积，把会话列表与归档侧栏的纯展示逻辑拆到独立模块。
  - 范围：
    1. 标题、摘要、时间、排序、分组、筛选。
    2. 进行中会话列表渲染。
    3. 已归档会话列表渲染。
    4. 侧栏摘要、搜索反馈、定位当前会话。
  - 不在范围：
    1. `setConversationList`、`setArchivedConversationList` 状态落盘入口。
    2. `selectConversation`、`createConversationAndSelect`、归档\恢复\删除等动作层。
    3. 聊天流式请求、消息恢复、会话 payload 合并。
  - 假设：
    1. 现有 `window` 模块挂载模式继续适用第三轮。
    2. 会话展示层可通过依赖注入拿到状态、DOM 查询、格式化工具和回调。
    3. 为控制风险，`app.js` 继续保留同名函数作为薄封装。
  - 风险：
    1. 列表渲染与归档区渲染互相调用，若回调注入不当，可能出现递归或渲染遗漏。
    2. `focusCurrentConversationInList` 若直接依赖全局 `document`，会降低模块可测性。
    3. 搜索反馈和侧栏摘要依赖当前筛选状态，若状态读取不一致，会出现 UI 显示偏差。
  - 第三轮 TODO：
    1. 校验 `public\js\conversation-list-tools.js` 依赖与导出是否完整。
    2. 将新模块接入 `public\index.html`。
    3. 在 `public\js\app.js` 中实例化模块并把展示层函数改为薄封装。
    4. 更新 `test-page-markup.js` 的模块断言。
    5. 运行语法与前端回归验证。
    6. 回写执行记录、验证结果与复盘。
  - 完成标准：
    1. `public\js\app.js` 不再直接承载上述会话展示层完整实现。
    2. 首页继续正常渲染会话列表、归档区、搜索反馈与侧栏摘要。
    3. 相关测试全部通过。
  - 验证方式：
    1. `node --check public\js\conversation-list-tools.js`
    2. `node --check public\js\app.js`
    3. `node test-page-markup.js`
    4. `npm run test:frontend`
    5. `npm run test:ui-flow`
    6. `npm run check`
- 第三轮执行记录：
  1. 已检查 `public\js\conversation-list-tools.js` 的导出与依赖注入点，补充 `queryOne` 注入，移除对全局 `document.querySelector` 的硬依赖。
  2. `public\index.html` 已在 `app.js` 前新增加载 `conversation-list-tools.js`。
  3. `public\js\app.js` 已新增 `conversationListTools` 实例与 `requireConversationListTools()`，并将以下函数改为薄封装：
     - `sanitizeConversationText`
     - `getConversationTitlePreview`
     - `getConversationCardTitle`
     - `getConversationPreview`
     - `getConversationCardPreview`
     - `getConversationRowPillsMarkup`
     - `getConversationTimestamp`
     - `getConversationTimeLabel`
     - `groupConversationsByDay`
     - `getConversationPriorityRank`
     - `getConversationSortValue`
     - `getArchivedConversationSortValue`
     - `sortConversationSummaries`
     - `sortArchivedConversationSummaries`
     - `getActiveConversation`
     - `getConversationSearchQuery`
     - `getConversationFilterMode`
     - `matchesConversationFilter`
     - `getFilteredActiveConversations`
     - `getFilteredArchivedConversations`
     - `renderConversationList`
     - `renderArchivedConversationList`
     - `renderConversationSidebarSummary`
     - `renderConversationSearchFeedback`
     - `updateConversationSearch`
     - `updateConversationFilterMode`
     - `focusCurrentConversationInList`
  4. `setConversationList`、`setArchivedConversationList`、`selectConversation`、归档\恢复\删除等动作层保持在 `app.js`，未扩大改动面。
  5. `test-page-markup.js` 已增加首页加载链与 `AigsConversationListTools` 暴露断言。
  6. 第三轮结果：
     - `public\js\app.js` 从 6410 行进一步降到 5446 行。
     - 新增 `public\js\conversation-list-tools.js` 384 行。
- 第三轮验证结果：
  1. `node --check public\js\conversation-list-tools.js`：通过。
  2. `node --check public\js\app.js`：通过。
  3. `node test-page-markup.js`：通过。
  4. `npm run test:frontend`：通过。
  5. `npm run test:ui-flow`：通过。
  6. `npm run check`：通过。
- 第三轮复盘：
  1. 这轮拆分已把会话展示层从动作层剥离出来，`app.js` 体积下降明显，但行为入口仍保持原位，回归风险可控。
  2. 新发现的边界点是“渲染函数之间互相调用”会让模块注入关系更敏感，因此后续若继续拆动作层，建议先梳理回调方向，再切请求与状态更新链。
  3. 当前遗漏风险主要在“会话状态更新函数仍聚集在 `app.js`”，后续可评估把会话动作和状态管理继续分层，但必须另起新 TODO，避免与本轮展示层拆分混做。
- 第四轮补充规划：
  - 目标：继续削减 `public\js\app.js`，抽离会话工作流状态与本地偏好相关逻辑。
  - 范围：
    1. `pinnedIds`、`parkedIds` 的默认值、规范化、存取与 hydrate。
    2. `重点\稍后` 状态判断与切换。
    3. 会话管理模式开关。
    4. 已归档区折叠偏好读取、持久化、同步。
  - 不在范围：
    1. `selectConversation`、`loadConversations`、`archiveConversationById`、`restoreArchivedConversation`、`deleteArchivedConversation`。
    2. 真实会话数据列表更新。
    3. 聊天消息渲染与流式请求。
  - 假设：
    1. 此块逻辑适合继续采用 `window` 模块 + 依赖注入模式。
    2. 状态本体仍留在 `app.js`，模块只负责围绕状态的规则与 UI 同步。
  - 风险：
    1. 本地状态切换会触发列表重渲染，若回调接线错误会造成 UI 不更新。
    2. 归档折叠状态同时影响侧栏摘要和归档区，若只同步一侧会出现显示不一致。
  - 第四轮 TODO：
    1. 新增会话工作流工具模块。
    2. 在 `public\index.html` 中接入脚本。
    3. 将 `public\js\app.js` 对应函数改为薄封装。
    4. 更新 `test-page-markup.js` 断言。
    5. 运行语法与前端回归验证。
    6. 回写执行记录、验证结果与复盘。
- 第四轮执行记录：
  1. 新增 `public\js\conversation-workflow-tools.js`，承载会话工作流状态与归档折叠偏好逻辑。
  2. 新模块已抽离以下函数：
     - `createDefaultChatWorkflowState`
     - `normalizeChatWorkflowState`
     - `getChatWorkflowStorageKey`
     - `readChatWorkflowStatePreference`
     - `persistChatWorkflowState`
     - `hydrateChatWorkflowState`
     - `isConversationPinned`
     - `isConversationParked`
     - `removeConversationFromWorkflowState`
     - `toggleConversationWorkflowState`
     - `closeConversationActionMenu`
     - `toggleConversationActionMenu`
     - `setConversationManageMode`
     - `toggleConversationManageMode`
     - `readChatArchivedCollapsedPreference`
     - `persistChatArchivedCollapsedPreference`
     - `syncChatArchivedSectionState`
     - `setChatArchivedCollapsed`
  3. `public\js\app.js` 已通过 `conversationWorkflowTools` 注入状态 getter\setter、DOM 查询和渲染回调，并保留同名薄封装。
  4. `public\index.html` 已在 `app.js` 前加载 `conversation-workflow-tools.js`。
  5. `test-page-markup.js` 已增加首页脚本链和 `AigsConversationWorkflowTools` 暴露断言。
  6. 第四轮结果：
     - `public\js\app.js` 从 5446 行进一步降到 5404 行。
     - 新增 `public\js\conversation-workflow-tools.js` 220 行。
- 第四轮验证结果：
  1. `node --check public\js\conversation-workflow-tools.js`：通过。
  2. `node --check public\js\conversation-list-tools.js`：通过。
  3. `node --check public\js\app.js`：通过。
  4. `node test-page-markup.js`：通过。
  5. `npm run test:frontend`：通过。
  6. `npm run test:ui-flow`：通过。
  7. `npm run check`：通过。
- 第四轮复盘：
  1. 这轮成功把“会话工作流规则”和“会话展示层”继续分开，后续若再拆会话动作层，模块边界会更清晰。
  2. 行数下降不算巨大，说明当前 `app.js` 的剩余重量更多集中在聊天动作链、消息渲染和多功能工作台逻辑，而不是本地偏好工具。
  3. 下一轮最值得继续拆的候选已经比较明确：会话动作层或聊天消息渲染层，但这两块都比本轮更敏感，必须单独立 TODO 再推进。
- 第五轮补充规划：
  - 目标：继续削减 `public\js\app.js`，抽离聊天消息显示运行层。
  - 范围：
    1. 聊天滚动跟随与“回到最新”按钮状态。
    2. 聊天消息 UI state 读写与操作面板切换。
    3. `restoreChatMessages` 的消息恢复流程。
  - 不在范围：
    1. `addChatMessage` 消息节点生成本体。
    2. 聊天 SSE、发送、停止生成、重试回复。
    3. 阅读大纲、摘录资产、模板与会话动作层。
  - 假设：
    1. 这组逻辑虽然依赖较多，但可通过状态 getter\setter 与渲染回调注入维持低风险拆分。
    2. `app.js` 继续保留同名薄封装，避免事件绑定和调用点大面积改写。
  - 风险：
    1. `restoreChatMessages` 同时牵动 starter panel、transient messages、reading outline、auto-follow，若漏注入任一依赖会直接影响聊天显示。
    2. 消息操作面板切换依赖 DOM 结构与 `CSS.escape`，若查询逻辑变动会导致版本面板无法展开或收起。
  - 第五轮 TODO：
    1. 审查聊天显示运行层函数依赖，确定最小抽离集合。
    2. 新增聊天显示运行工具模块。
    3. 在 `public\index.html` 中接入脚本。
    4. 将 `public\js\app.js` 对应函数改为薄封装。
    5. 更新 `test-page-markup.js` 断言。
    6. 运行语法与前端回归验证。
    7. 回写执行记录、验证结果与复盘。
- 第五轮执行记录：
  1. 已确认本轮最小抽离集合为：
     - `isChatNearBottom`
     - `updateChatScrollButton`
     - `handleChatMessagesScroll`
     - `setChatAutoFollow`
     - `followChatToBottom`
     - `getChatMessageUiState`
     - `setChatMessageUiState`
     - `syncChatMessageActionPanelDom`
     - `collapseOtherChatMessagePanels`
     - `toggleChatMessageActionPanel`
     - `toggleAssistantMessageCompact`
     - `restoreChatMessages`
  2. 新增 `public\js\chat-render-runtime-tools.js`，通过状态 getter\setter、DOM 查询、`addChatMessage`、阅读大纲与 viewport 同步回调完成依赖注入。
  3. `public\js\app.js` 已新增 `chatRenderRuntimeTools` 实例与 `requireChatRenderRuntimeTools()`，上述函数改为薄封装。
  4. `public\index.html` 已在 `app.js` 前加载 `chat-render-runtime-tools.js`。
  5. `test-page-markup.js` 已增加首页加载链与 `AigsChatRenderRuntimeTools` 暴露断言。
  6. 第五轮结果：
     - `public\js\app.js` 从 5404 行进一步降到 5282 行。
     - 新增 `public\js\chat-render-runtime-tools.js` 248 行。
- 第五轮验证结果：
  1. `node --check public\js\chat-render-runtime-tools.js`：通过。
  2. `node --check public\js\app.js`：通过。
  3. `node test-page-markup.js`：通过。
  4. `npm run test:frontend`：通过。
  5. `npm run test:ui-flow`：通过。
  6. `npm run check`：通过。
- 第五轮复盘：
  1. 这轮把聊天显示运行层从 `app.js` 里剥出来后，消息滚动、消息操作面板和恢复流程已经有了更清晰的边界。
  2. `addChatMessage` 本体仍留在 `app.js`，说明聊天 DOM 生成与富文本渲染链依然是后续最大的一块前端重量。
  3. 下一轮如果继续拆前端，最优先候选已经收敛到两块：`addChatMessage` 为核心的聊天消息节点生成层，或会话动作层。前者更贴近当前模块边界，预计会比直接切动作层更稳。
- 第六轮补充规划：
  - 目标：继续削减 `public\js\app.js`，抽离聊天消息节点生成与插入层。
  - 范围：
    1. 助手消息操作区 HTML 生成。
    2. 消息节点插入规则。
    3. thinking message 节点创建。
    4. `addChatMessage` 主体。
  - 不在范围：
    1. 流式响应解析与 `streamChatMessage`。
    2. 阅读大纲与摘录面板逻辑。
    3. 版本切换、复制、重试等动作函数本体。
  - 假设：
    1. 这组逻辑可通过富文本格式化、状态查询和 DOM 工具注入独立成模块。
    2. `app.js` 继续保留同名薄封装，避免事件绑定与调用点改写。
  - 风险：
    1. `addChatMessage` 同时依赖 meta、compact summary、heading 注释、auto-follow 和 transient 状态，任一注入缺失都会直接影响聊天区渲染。
    2. 助手操作区按钮包含多个 data- 属性，若拼装变化会影响后续点击事件代理。
  - 第六轮 TODO：
    1. 审查消息节点生成层依赖，确定最小抽离集合。
    2. 新增聊天消息节点工具模块。
    3. 在 `public\index.html` 中接入脚本。
    4. 将 `public\js\app.js` 对应函数改为薄封装。
    5. 更新 `test-page-markup.js` 断言。
    6. 运行语法与前端回归验证。
    7. 回写执行记录、验证结果与复盘。
- 第六轮执行记录：
  1. 已确认本轮最小抽离集合为：
     - `buildChatAssistantActions`
     - `insertChatMessageNode`
     - `createThinkingMessage`
     - `addChatMessage`
  2. 新增 `public\js\chat-message-node-tools.js`，通过 meta 构造、富文本格式化、compact summary、消息 UI 状态、excerpt 状态与 auto-follow 回调完成依赖注入。
  3. `public\js\app.js` 已新增 `chatMessageNodeTools` 实例与 `requireChatMessageNodeTools()`，上述函数改为薄封装。
  4. `public\index.html` 已在 `app.js` 前加载 `chat-message-node-tools.js`，并保持其位于 `chat-render-runtime-tools.js` 之前。
  5. `test-page-markup.js` 已增加首页加载链与 `AigsChatMessageNodeTools` 暴露断言，并把“正在思考”“版本切换按钮”断言从 `app.js` 文本迁移到模块契约。
  6. 第六轮结果：
     - `public\js\app.js` 从 5282 行进一步降到 5178 行。
     - 新增 `public\js\chat-message-node-tools.js` 128 行。
- 第六轮验证结果：
  1. `node --check public\js\chat-message-node-tools.js`：通过。
  2. `node --check public\js\app.js`：通过。
  3. `node test-page-markup.js`：通过。
  4. `npm run test:frontend`：通过。
  5. `npm run test:ui-flow`：通过。
  6. `npm run check`：通过。
- 第六轮复盘：
  1. 这轮完成后，聊天区的“消息节点生成”和“消息显示运行时”已经分成两层，后续再拆流式响应或阅读大纲时边界会更干净。
  2. 新发现的重点是：旧测试仍有少量“实现必须留在 app.js”倾向，后续继续拆分时要同步把测试重心放在模块契约，而不是文件物理位置。
  3. 现在 `app.js` 的剩余重量更集中在流式对话链、摘录资产链、会话动作链和工作台多功能业务流。下一轮若继续前端拆分，优先级最高的候选是 `streamChatMessage` 周边的聊天流式链，或者摘录资产链。
- 第七轮补充规划：
  - 目标：继续削减 `public\js\app.js`，抽离聊天流式解析与流式渲染壳。
  - 范围：
    1. `parseSseBlock`
    2. `streamChatMessage`
  - 不在范围：
    1. `performChatSend`、失败恢复、队列编排。
    2. `setChatLoading`、`updateQueueIndicator`、`stopChatGeneration`。
    3. 版本切换、摘录资产、会话动作层。
  - 假设：
    1. 流式解析层可通过 `addChatMessage`、`formatChatMessageHtml`、`followChatToBottom` 与 meta 构造回调注入独立模块。
    2. `app.js` 继续保留同名薄封装，避免发送链调用点改写。
  - 风险：
    1. `streamChatMessage` 同时覆盖 SSE 解析、thinking message 切换、partial reply 累积和错误包装，任一行为偏差都会直接影响聊天主流程。
    2. 若 `pendingMessage` 和 streaming content 的 DOM 接线不一致，可能出现首帧不显示或结束后内容不替换的问题。
  - 第七轮 TODO：
    1. 审查流式解析层依赖，确定最小抽离集合。
    2. 新增聊天流式工具模块。
    3. 在 `public\index.html` 中接入脚本。
    4. 将 `public\js\app.js` 对应函数改为薄封装。
    5. 更新 `test-page-markup.js` 断言。
    6. 运行语法与前端回归验证。
    7. 回写执行记录、验证结果与复盘。
- 第七轮执行记录：
  1. 已确认本轮最小抽离集合为：
     - `parseSseBlock`
     - `streamChatMessage`
  2. 新增 `public\js\chat-stream-tools.js`，通过 `addChatMessage`、`buildChatMessageMeta`、`followChatToBottom`、`formatChatMessageHtml` 与 `TextDecoder` 工厂完成依赖注入。
  3. `public\js\app.js` 已新增 `chatStreamTools` 实例与 `requireChatStreamTools()`，上述函数改为薄封装。
  4. `public\index.html` 已在 `app.js` 前加载 `chat-stream-tools.js`。
  5. `test-page-markup.js` 已增加首页加载链与 `AigsChatStreamTools` 暴露断言，并把 `conversation_state` 断言从 `app.js` 文本迁移到模块契约。
  6. 第七轮结果：
     - `public\js\app.js` 从 5178 行进一步降到 5055 行。
     - 新增 `public\js\chat-stream-tools.js` 174 行。
- 第七轮验证结果：
  1. `node --check public\js\chat-stream-tools.js`：通过。
  2. `node --check public\js\app.js`：通过。
  3. `node test-page-markup.js`：通过。
  4. `npm run test:frontend`：通过。
  5. `npm run test:ui-flow`：通过。
  6. `npm run check`：通过。
- 第七轮复盘：
  1. 这轮完成后，聊天主链已经被拆成“消息节点生成”“消息显示运行时”“流式解析”三层，继续拆发送编排时边界会更明确。
  2. 测试层继续暴露出物理文件位置耦合问题，但已经逐步转成模块契约，后续拆分阻力会更小。
  3. 现在 `app.js` 的剩余重量更集中在发送编排与失败恢复、摘录资产链、会话动作链以及工作台多功能业务流。下一轮若继续砍前端，最值得动的是 `performChatSend` 周边的发送编排壳，或者单独处理摘录资产链。
