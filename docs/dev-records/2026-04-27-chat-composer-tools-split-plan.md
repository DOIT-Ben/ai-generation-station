# 2026-04-27 Chat Composer 工具拆分计划

## 目标
继续削减 `public\js\app.js`，把聊天输入体验层拆成独立模块，保持现有页面行为不变。

## 范围
- 新增 `public\js\chat-composer-tools.js`。
- 将聊天输入框自适应、composer 状态、聊天阶段文案、上下文标签、建议提示、starter panel 与 starter prompt 应用逻辑移入新模块。
- 调整 `public\index.html` 的脚本加载顺序。
- 更新 `public\js\app.js` 为同名薄封装调用。
- 更新 `test-page-markup.js` 的模块加载与契约断言。

## 不在范围
- 不修改聊天发送链、流式响应、队列、失败恢复。
- 不修改生成任务、上传、模板、会话动作层。
- 不修改样式。
- 不做额外产品功能。

## 假设
- 当前前端继续采用无构建脚本架构，新模块通过 `window.AigsChatComposerTools` 暴露 `createTools()`。
- `app.js` 保留同名函数作为薄封装，可以降低事件绑定与其他模块调用点改动。
- 该模块依赖可通过 getter、DOM helper、渲染回调和状态回调注入。

## 风险
- `updateChatComposerState()` 被多个模块调用，若注入不完整会影响输入框、建议条或移动端视口同步。
- starter panel 被聊天消息恢复运行时调用，脚本加载顺序和依赖命名必须准确。
- 旧测试仍可能断言实现存在于 `app.js`，需要同步迁移为模块契约。

## TODO
1. 复核本轮抽离函数集合与依赖边界。
2. 新增 `public\js\chat-composer-tools.js`。
3. 接入 `public\index.html` 脚本加载链。
4. 改造 `public\js\app.js` 为 composer 模块薄封装。
5. 更新 `test-page-markup.js` 模块断言。
6. 运行验证。
7. 回写执行记录、验证结果和复盘。
8. 按用户确认追加运行 `npm run test:ui-flow`。
9. 回写追加验证结果和复盘。
10. 按用户确认追加运行 `npm run test:regression-core`。
11. 回写核心回归验证结果和复盘。
12. 按用户确认继续追加运行 `npm run test:release-core`。
13. 回写 release core 验证结果和复盘。
14. 按用户确认继续追加运行视觉回归验证。
15. 回写视觉回归验证结果和复盘。
16. 修正视觉回归脚本登录入口口径。
17. 重跑视觉回归并回写结果。
18. 按用户确认继续执行视觉差异 triage，不更新 baseline。
19. 回写视觉差异归类和复盘。

## 完成标准
- `public\js\app.js` 不再直接承载聊天输入体验层完整实现。
- 新模块暴露 `AigsChatComposerTools`，并被首页在 `app.js` 前加载。
- 聊天输入状态、建议提示、上下文标签、starter prompt 的既有行为保持不变。
- 相关语法检查和前端契约测试通过。

## 验证方式
- `node --check public\js\chat-composer-tools.js`
- `node --check public\js\app.js`
- `node test-page-markup.js`
- `npm run test:frontend`
- `npm run check`

## 执行记录
- 已创建本计划，完成规划前置要求。
- TODO 1：已复核本轮抽离函数集合与依赖边界。
  - 抽离集合限定为 `autoResizeChatInput`、`updateChatComposerState`、`getChatDraftLength`、`getConversationMessageCount`、`getAssistantMessageCount`、`getChatExperienceStage`、`renderChatExperienceState`、`getActiveConversationLastActivityLabel`、`getChatContextPills`、`renderChatContextStrip`、`getChatQuickstartPrompts`、`getChatFollowUpPrompts`、`getChatSuggestionConfig`、`renderChatSuggestionStrip`、`createChatStarterPanelMarkup`、`applyChatStarterPrompt`。
  - 依赖以 DOM helper、当前用户、聊天生成状态、队列、会话状态、会话时间格式化、会话 workflow 状态和少量回调注入。
  - 不抽离事件委托、不碰发送链和视口键盘逻辑。
- TODO 2：已新增 `public\js\chat-composer-tools.js`。
  - 新模块暴露 `window.AigsChatComposerTools.createTools()`。
  - 新模块内部实现 composer 状态、聊天阶段、上下文标签、建议提示、starter panel 和 starter prompt 应用。
  - 已保留缺失 `chat-context-strip`、`chat-suggestion-strip` 节点时直接返回的 no-op 行为。
- TODO 3：已在 `public\index.html` 中接入 `/js/chat-composer-tools.js`，位置在 `chat-message-action-tools.js` 之后、`chat-stream-tools.js` 之前，保证在 `app.js` 前加载。
- TODO 4：已改造 `public\js\app.js`。
  - 新增 `chatComposerTools` 实例与 `requireChatComposerTools()`。
  - 原 composer 相关函数已改为同名薄封装。
  - 提示词常量通过 getter 懒读取，避免模块实例创建时访问后置常量。
- TODO 5：已更新 `test-page-markup.js`。
  - 新增读取 `public\js\chat-composer-tools.js`。
  - 新增首页加载链断言与 `AigsChatComposerTools` 暴露断言。
  - 将 composer 体验相关断言从 `app.js` 实现位置迁移到新模块契约。
- TODO 6：已运行验证。
  - `node --check public\js\chat-composer-tools.js`：通过。
  - `node --check public\js\app.js`：通过。
  - `node test-page-markup.js`：通过，输出 `Page markup tests passed`。
  - `npm run test:frontend`：通过，输出 `Frontend state tests passed` 与 `Page markup tests passed`。
  - `npm run check`：通过，执行 `node --check server/index.js`。
- TODO 7：已回写执行记录、验证结果和复盘。
  - 当前 `public\js\app.js` 约 2881 行。
  - 新增 `public\js\chat-composer-tools.js` 约 295 行。
  - 本轮业务改动集中在 `public\index.html`、`public\js\app.js`、`public\js\chat-composer-tools.js`、`test-page-markup.js`。
- TODO 8：用户确认“开始”后，追加执行真实浏览器 UI flow 验证。
  - 首次执行 `npm run test:ui-flow` 未进入业务断言，失败原因是默认目标服务未启动：`UI smoke target not ready: connect ECONNREFUSED 127.0.0.1:18791`。
  - 已检查 `test-ui-flow-smoke.js`，确认支持 `--launch-server` 参数启动临时服务。
- TODO 9：已使用 `node test-ui-flow-smoke.js --launch-server` 重跑 UI flow。
  - 输出 `UI flow smoke tests passed`。
  - 同时出现 Node.js SQLite experimental warning，属于既有环境提示，不影响本次验证通过。
- TODO 10：用户确认“开始吧”后，追加执行核心回归验证 `npm run test:regression-core`。
- TODO 11：已回写核心回归验证结果。
  - `npm run test:regression-core`：通过。
  - 总计 12 项，10 项通过，2 项按 `--skip-browser` 跳过，0 失败。
  - 通过项包括 FrontendState、PageMarkup、StyleContract、SecurityGateway、AuthHistory、TaskPersistence、MusicRoute、VoiceCoverRoute、Smoke、Failures。
  - 跳过项为 UiFlowSmoke 与 UiVisualRegression，原因是该脚本使用 `--skip-browser`。
  - 输出包含既有环境提示：Node.js SQLite experimental warning、通知 provider down 测试提示、`MINIMAX_API_KEY` 未配置提示；未导致测试失败。
- TODO 12：用户确认“继续”后，追加执行 release core 验证 `npm run test:release-core`。
- TODO 13：已回写 release core 验证结果。
  - `npm run test:release-core`：通过。
  - 回归部分：总计 12 项，10 项通过，2 项按 `--skip-browser` 跳过，0 失败。
  - 容量基线 artifact：`test-artifacts\performance\capacity-baseline-1777303692123.json`。
  - low 档核心指标：
    - login：success 100%，mean 142.13ms，p95 176.72ms，throughput 64.05/s。
    - session：success 100%，mean 6.59ms，p95 7.93ms，throughput 1498.88/s。
    - admin_create_user：success 100%，mean 141.51ms，p95 186.98ms，throughput 64.52/s。
    - history_read：success 100%，mean 6.28ms，p95 7.32ms，throughput 1572.52/s。
  - medium 档核心指标：
    - login：success 100%，mean 663.56ms，p95 827.91ms，throughput 63.28/s。
    - session：success 100%，mean 26.79ms，p95 36.81ms，throughput 1839.92/s。
    - admin_create_user：success 100%，mean 647.27ms，p95 787.15ms，throughput 64.57/s。
    - history_read：success 100%，mean 27.35ms，p95 29.93ms，throughput 1781.34/s。
  - 输出包含既有环境提示：Node.js SQLite experimental warning、通知 provider down 测试提示、`MINIMAX_API_KEY` 未配置提示；未导致测试失败。
- TODO 14：用户确认“继续”后，追加执行视觉回归验证。
  - 为避免默认目标服务未启动导致误失败，本轮直接使用 `node test-ui-visual.js --launch-server`。
  - 目标：确认本轮前端模块拆分没有造成可见 UI 视觉差异。
  - 首次执行未进入视觉比对，失败点为等待 `#login-form` 可见超时：`locator.waitFor: Timeout 30000ms exceeded`。
- TODO 16：已定位视觉回归脚本口径滞后。
  - `test-ui-visual.js` 仍访问 `/auth/` 并等待 `#login-form`。
  - 当前真实登录表单在 `/login/`，`/auth/` 是找回/重置入口。
  - 该问题归类为当前必修测试脚本维护问题；本轮只修视觉脚本登录入口，不改业务页面。
  - 登录入口修正后，视觉脚本继续卡在旧 selector `.portal-layout > .portal-surface-card`；当前登录页卡片为 `.auth-simple-card`。
- TODO 17：已重跑 `node test-ui-visual.js --launch-server`。
  - 视觉脚本已进入截图比对阶段，但视觉回归未通过。
  - 失败项：
    - `auth-portal-card`：尺寸不匹配，baseline `798x653`，current `440x506`。
    - `utility-cluster-authenticated`：9986 px，59.2922%。
    - `account-center-security`：1824 px，0.4324%。
    - `admin-console`：尺寸不匹配，baseline `1180x1746`，current `1392x1995`。
    - `chat-card-dark`：尺寸不匹配，baseline `1116x999`，current `1088x999`。
    - `chat-card-light`：尺寸不匹配，baseline `1116x999`，current `1088x999`。
    - `lyrics-card-light`：尺寸不匹配，baseline `1116x629`，current `1088x629`。
  - current 与 diff artifacts 已输出到 `test-artifacts\visual-current` 与 `test-artifacts\visual-diff`。
  - 未更新 baseline。
- TODO 18：用户确认“继续”后，执行视觉差异 triage。
  - 目标：检查 `test-artifacts\visual-baseline`、`test-artifacts\visual-current`、`test-artifacts\visual-diff` 中的关键截图和尺寸，判断差异来源。
  - 边界：只读检查，不运行 `--update-baseline`，不改业务页面。
  - 已确认 `utility-cluster-authenticated` 和 `chat-card-dark` current 截图中存在欢迎 toast 覆盖；`stabilizePage()` 只隐藏 `.toast-container`，未隐藏 `.welcome-toast-host`。
  - 已确认 `account-center-security` current 与 baseline 肉眼基本一致，diff 属于小范围渲染差异。
- TODO 19：已修正视觉脚本稳定化逻辑，并重跑视觉回归。
  - `test-ui-visual.js` 的 `stabilizePage()` 已补充隐藏 `.welcome-toast-host`。
  - `node --check test-ui-visual.js`：通过。
  - 重跑 `node test-ui-visual.js --launch-server` 后，`utility-cluster-authenticated` 已不再失败。
  - 剩余失败项：
    - `auth-portal-card`：尺寸不匹配，baseline `798x653`，current `440x506`。
    - `account-center-security`：1824 px，0.4324%。
    - `admin-console`：尺寸不匹配，baseline `1180x1746`，current `1392x1995`。
    - `chat-card-dark`：尺寸不匹配，baseline `1116x999`，current `1088x999`。
    - `chat-card-light`：尺寸不匹配，baseline `1116x999`，current `1088x999`。
    - `lyrics-card-light`：尺寸不匹配，baseline `1116x629`，current `1088x629`。
  - 当前 chat 截图肉眼无明显错版，剩余主要是历史 baseline 与当前页面尺寸/布局口径不一致。

## 验证结果
- 计划内验证全部通过。
- 追加 UI flow 验证口径：
  - `npm run test:ui-flow`：未通过，原因是未启动默认目标服务 `127.0.0.1:18791`，未进入业务断言。
  - `node test-ui-flow-smoke.js --launch-server`：通过，输出 `UI flow smoke tests passed`。
- 追加核心回归验证口径：
  - `npm run test:regression-core`：通过，汇总为 `Total: 12, Passed: 10, Skipped: 2, Failed: 0`。
- 追加 release core 验证口径：
  - `npm run test:release-core`：通过。
  - 回归汇总为 `Total: 12, Passed: 10, Skipped: 2, Failed: 0`。
  - 容量基线 artifact 已生成到 `test-artifacts\performance\capacity-baseline-1777303692123.json`。
- 未运行浏览器 UI flow 或视觉回归；本轮为模块拆分与契约测试更新，已用语法检查、页面契约、前端状态组合测试和服务端入口语法检查覆盖。
- `git status --short` 显示本轮新增 `public\js\chat-composer-tools.js` 与本计划文档，修改 `public\index.html`、`public\js\app.js`、`test-page-markup.js`；同时仍存在本轮开始前已看到的其他未跟踪文档、`graphify-out` 与 `ui-ux-pro-max-0.1.0` 修改。

## 复盘
- 规划复盘：本轮目标、范围、假设、风险、TODO、完成标准和验证方式已写入 `docs\dev-records`。新问题：旧维护文档中的 `app.js` 行数已明显滞后，归类为文档口径滞后但非本轮阻塞；本轮以当前文件为准。边界条件：只拆 composer UI 层，不扩大到发送链。
- TODO 1 复盘：已确认 composer 层可独立成模块。新问题：当前 `public\index.html` 已不再包含 `chat-suggestion-strip` 和 `chat-context-strip`，相关渲染函数目前需要保持空节点安全返回；归类为当前必守边界，不新增 UI。需要回写规划：本轮模块必须保留缺失节点 no-op 行为。
- TODO 2 复盘：新模块已按现有工具模块风格落地。新问题：新增模块中不得顺手改变上下文标签内容；已移除一处额外“本地消息”标签，保持原行为。边界条件：未接入页面、未改 `app.js`，下一步按 TODO 3 和 TODO 4 继续。
- TODO 3 复盘：脚本加载链已接入。新问题：无。边界条件：只新增一个脚本引用，不调整其他脚本顺序。
- TODO 4 复盘：`app.js` 已完成薄封装改造。新问题：提示词常量定义晚于工具实例创建，已通过 getter 懒读取处理；归类为当前必修问题并已处理。边界条件：不移动大段常量、不重排主文件结构。
- TODO 5 复盘：测试契约已更新到新模块。新问题：旧测试仍保留不少 `app.js` 物理位置断言，本轮只迁移与 composer 直接相关的两条，其他断言归类为可延后测试维护，不打断主线。
- TODO 6 复盘：计划内验证全部通过。新问题：最初未做真实浏览器 UI flow，后续已按用户确认追加执行。边界条件：不额外扩大到 UI 视觉基线。
- TODO 7 复盘：记录已回写完成。新问题：工作区仍有多项既有未跟踪文件，归类为仓库整理问题，不属于本轮拆分阻塞。下一轮若继续拆，应优先从剩余 `app.js` 函数中挑选独立 UI 或状态工具块，避免碰生成主链。
- TODO 8 规划复盘：追加验证目标明确为 `npm run test:ui-flow`，用于补足真实浏览器流程覆盖。新问题：无。边界条件：只运行该验证，不扩大到完整 release browser。
- TODO 8 首次执行复盘：失败原因是验证前置服务未启动，归类为当前必修前置问题，不是本轮代码行为失败。规划回写：追加使用 `node test-ui-flow-smoke.js --launch-server` 重跑同一 UI flow 验证。
- TODO 9 复盘：带自启动服务的 UI flow 验证通过，证明本轮拆分未破坏真实浏览器 smoke 流程。新问题：`npm run test:ui-flow` 默认依赖外部服务已启动，后续若希望一键验证更稳，可另起计划考虑增加脚本别名；本轮不修改 `package.json`，避免扩大范围。
- TODO 10 规划复盘：追加验证目标明确为 `npm run test:regression-core`，用于覆盖跳过 live 和浏览器的核心回归。新问题：无。边界条件：只运行该验证，不扩大到 release browser。
- TODO 11 复盘：核心回归通过，说明本轮拆分未破坏核心前端契约、安全网关、认证历史、任务持久化、音乐与翻唱路由、smoke 和失败路径回归。新问题：UiFlowSmoke 与 UiVisualRegression 在该命令中按预期跳过，已由前一步单独补跑 UI flow；视觉回归仍未跑，归类为可延后验证。
- TODO 12 规划复盘：追加验证目标明确为 `npm run test:release-core`，用于在核心回归之外补容量基线。新问题：无。边界条件：不扩大到 `test:release-browser`。
- TODO 13 复盘：release core 通过，容量基线成功产出。新问题：该命令仍按预期跳过 browser UI 与视觉回归；UI flow 已单独补跑，视觉回归如需发布前完整把关应另起验证步骤。边界条件：不因容量 artifact 生成而清理 `test-artifacts`。
- TODO 14 规划复盘：追加验证目标明确为视觉回归，不更新 baseline。新问题：视觉回归可能因环境字体、渲染或动态内容产生差异；若失败，先记录差异并分类，不直接覆盖基线。
- TODO 14 首次执行复盘：视觉回归失败发生在测试前置登录页等待阶段，归类为当前必修验证阻塞，暂不能判定本轮 UI 有视觉差异。下一步先检查 `test-ui-visual.js` 与登录页结构。
- TODO 16 复盘：根因明确为登录页拆分后的测试口径滞后。新问题：视觉基线命名仍为 `auth-portal-card`，但实际捕获登录页；命名可延后整理，不影响本轮验证。边界条件：不更新 baseline、不改页面。
- TODO 17 复盘：视觉回归失败已进入真实比对阶段，结果显示现有 visual baseline 与当前页面状态不一致。新问题分类：当前不是 composer 拆分直接导致的单点报错，而是视觉基线滞后/页面既有变化未重新冻结；这会阻塞完整 `test:release-browser`。是否更新 baseline 属于验收口径决策，不能自动执行。边界条件：不直接运行 `--update-baseline`。
- TODO 18 规划复盘：差异 triage 范围已限定为 artifact 检查和归类。新问题：如果截图显示当前 UI 本身有明显错位，则需另起修复计划；如果只是历史基线滞后，则需用户确认后单独执行 baseline 更新。
- TODO 18 执行复盘：发现视觉脚本稳定化遗漏 `.welcome-toast-host`，归类为当前必修测试维护问题；可直接修测试脚本，不涉及业务页面。登录页 baseline 仍是旧大卡片，归类为 baseline 滞后，不能自动更新。
- TODO 19 复盘：欢迎 toast 干扰已修复，视觉失败范围收敛。新问题：剩余失败大多是历史视觉基线滞后，尤其登录页已从旧 portal auth 卡片切换为独立 login 简卡；如要让视觉回归通过，需要人工确认当前截图可接受后单独更新 baseline。边界条件：本轮仍未运行 `--update-baseline`。
