# 2026-04-26 主线第十六阶段连续开发计划

## 目标
- 在不扩大改动面的前提下，继续对 `public\js\app.js` 做最后一轮高信号小块拆分。
- 本轮仅处理聊天模型下拉相关 helper，进一步收缩 `app.js` 协调层体积。

## 范围
- 前端：
  - 拆分 `public\js\app.js` 中聊天模型下拉缓存、loading 占位、模型分组渲染、远端加载相关 helper。
- 测试：
  - 更新 `test-page-markup.js` 等契约检查，验证新模块接入与装配。

## 非范围
- 不新增产品功能。
- 不修改数据库 schema 或后端接口。
- 不调整页面视觉样式。
- 不处理与本轮无关的未跟踪文档文件。
- 不继续拆分 `server\state-store.js`。

## 假设
- 聊天模型下拉 helper 职责集中，适合抽成独立前端模块。
- 现有 `chat-model-utils.js` 继续负责模型标签与系列判断，新模块只承接下拉缓存、渲染与加载流程。
- 现有测试足以覆盖本轮风险；若发现缺口，只补最小必要契约检查。

## 风险
- 模型下拉加载链直接影响聊天入口默认模型、滚动提示和推荐分组，依赖注入遗漏会影响聊天可用性。
- 本轮拆分如果误改当前默认模型回退逻辑，可能导致首次打开时下拉显示异常。

## 完成标准
- `public\js\app.js` 不再直接承载完整的聊天模型下拉 helper 实现，只保留装配或薄封装。
- 新模块已接入首页脚本链，相关契约测试通过。
- 本轮执行记录、验证结果、复盘完整写入 `docs\dev-records`。
- 本轮改动完成后提交一次 Git。

## 验证方式
- `node --check public\js\app.js`
- `node --check public\js\workspace-chat-model-tools.js`
- `node test-page-markup.js`
- `npm run test:frontend`
- `$env:UI_SMOKE_LAUNCH_SERVER='1'; npm run test:ui-flow -- --launch-server --port 18797`
- `npm run check`
- `npm test`（通过临时本地服务环境执行）
- `git diff --check`

## TODO
1. 盘点 `public\js\app.js` 中聊天模型下拉 helper 的职责边界。
2. 抽离聊天模型下拉模块并接入首页脚本链。
3. 更新页面契约测试。
4. 执行前端阶段回归并修复问题。
5. 执行统一回归并修复问题。
6. 回写开发日志、验证结果、复盘。
7. 提交 Git。

## 执行顺序
1. 聊天模型下拉 helper 盘点与拆分。
2. 页面契约测试更新。
3. 前端阶段回归。
4. 统一回归。
5. 文档回写。
6. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 盘点 `public\js\app.js` 中 `readCachedChatModelOptions`、`writeCachedChatModelOptions`、`initializeChatModelDropdownLoadingState`、`applyChatModelOptions`、`loadChatModelOptions` 等 helper 的职责边界。
  - 确认该簇职责集中在聊天模型下拉缓存、loading 占位、分组渲染与远端加载流程，适合抽为独立前端模块。
- 已完成 TODO 2：
  - 新增 `public\js\workspace-chat-model-tools.js`。
  - 抽离 `AigsWorkspaceChatModelTools`，承接聊天模型下拉缓存、分组渲染与远端加载逻辑。
  - 在 `public\index.html` 中接入 `/js/workspace-chat-model-tools.js`。
  - 在 `public\js\app.js` 中新增 `requireWorkspaceChatModelTools()`，并将对应实现改为薄封装委托。
- 已完成 TODO 3：
  - 更新 `test-page-markup.js`，校验新 workspace chat-model 模块接入、浏览器导出与装配契约。
  - 将聊天模型下拉的 scroll hint 与 loading placeholder 契约检查从 `app.js` 迁到新模块。
- 已完成 TODO 4：
  - 执行前端阶段回归，期间发现首页未跳转登录页。
  - 通过浏览器现场复核定位到 `workspaceChatModelTools` 初始化顺序问题：闭包捕获 `apiFetch` 时触发 TDZ。
  - 调整 `public\js\app.js` 中模块装配顺序后，语法检查、页面契约、前端状态与 UI smoke 测试恢复通过。
- 已完成 TODO 5：
  - 执行统一回归，覆盖语法检查、前端测试、总 smoke 与提交前 diff 检查。
- 已完成 TODO 6：
  - 已回写开发日志、验证结果、复盘与问题定位过程。
- TODO 7 待执行：
  - 待完成本轮 Git 提交。

## 复盘
- 新问题：
  - 本轮暴露出一个典型装配顺序风险：新模块接入时，依赖 `const` 初始化顺序不当会在浏览器启动期触发 TDZ。
  - 该问题已通过 UI smoke 失败信号和浏览器 `pageerror` 定位并修复。
- 边界条件：
  - 本轮只处理聊天模型下拉 helper，不改动后端接口、数据库 schema 和视觉样式。
  - 没有继续拆分 `server\state-store.js`，保持上一轮停手判断。
- 遗漏点：
  - `public\js\app.js` 仍保留部分聊天体验、模板与会话协调壳层，但进一步拆分已进入低收益区间。
- 是否回写规划：
  - 是。本轮已回写装配顺序问题与修复结论，后续若继续推进，应优先做最终维护性总结而不是继续机械拆分。

## 验证结果
- 语法检查通过：
  - `node --check public\js\workspace-chat-model-tools.js`
  - `node --check public\js\app.js`
- 契约检查通过：
  - `node test-page-markup.js`
- 前端阶段回归通过：
  - `npm run test:frontend`
  - `$env:UI_SMOKE_LAUNCH_SERVER='1'; npm run test:ui-flow -- --launch-server --port 18797`
- 统一检查通过：
  - `npm run check`
  - `npm test`（通过临时本地服务环境执行）
- 提交前检查通过：
  - `git diff --check`
  - 说明：输出仅包含 CRLF 提示告警，无 diff 错误。

## 当前结果
- `public\js\app.js` 已由本轮开始前的 `3206` 行下降到 `3054` 行。
- 本轮新增 `public\js\workspace-chat-model-tools.js`，承接聊天模型下拉 helper 簇。
- `server\state-store.js` 维持 `827` 行不变。

## 下一阶段建议 TODO
1. 对当前模块化结果做最终维护性总结，整理 `public\js\app.js` 剩余协调壳层的边界。
2. 若仍需继续拆分，只建议处理极少量独立 helper，不再拆后端主壳层。
3. 将后续重心逐步转向 UI\UX 回归、性能细修和安全细节审查。
