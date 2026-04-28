# 2026-04-26 CSS 模块拆分与堆叠代码排查计划

## 目标
- 将当前集中在 `public\css\style.css` 的样式拆分为可维护的多文件结构。
- 检查项目中是否还有类似“全部代码堆叠到一个文件”的情况，并记录结果。

## 范围
- 只处理前端 CSS 文件拆分与 HTML 引用调整。
- 保持现有页面视觉和交互行为不变。
- 更新依赖 `public\css\style.css` 的测试断言。
- 对其他大文件只做排查、归类和记录；不在本 TODO 中重构 JS 或后端。

## 假设
- 当前项目是无构建静态前端，CSS 拆分需要通过多个 `<link rel="stylesheet">` 直接加载。
- CSS 顺序会影响覆盖关系，因此拆分后必须保持原 `style.css` 中的规则顺序。
- 用户给出的结构是参考方向，不要求文件名完全一致，但应接近 `reset.css`、`common.css`、页面专属 CSS、模块 CSS 的维护方式。

## 风险
- 样式拆分如果顺序错误，会导致主题、响应式或页面局部样式被覆盖。
- 测试中读取 `style.css` 的断言需要迁移到新的 CSS 聚合读取方式。
- 单次同时重构大型 JS 文件风险高，容易影响业务逻辑，应先记录为后续计划缺口。

## TODO
1. 排查 `public\css\style.css` 的内部结构、HTML 引用和测试引用。
2. 制定 CSS 拆分映射，确保顺序不变。
3. 新增拆分后的 CSS 文件，并将原 `style.css` 缩减为兼容入口或废弃说明入口。
4. 更新所有页面 `<link>` 引用，按顺序加载拆分后的 CSS。
5. 更新测试读取方式与样式断言。
6. 扫描其他超大代码文件并记录是否属于堆叠问题。
7. 运行验证。
8. 复盘并回写本记录。

## 完成标准
- 页面不再只依赖单一 `public\css\style.css` 承载全部样式。
- CSS 至少拆分为基础、公共、首页、账号、认证、后台、主题esponsiveness 等清晰文件。
- `public\css\style.css` 不再是 200KB 级别的全部样式堆叠文件。
- HTML 页面按需引用 CSS，且视觉关键测试通过。
- 其他堆叠文件已列出并归类为当前必修或可延后。

## 验证方式
- `node test-page-markup.js`
- `node test-ui-ux-security-polish.js`
- `npm run test:frontend`
- `npm run check`
- 必要时运行 `npm run test:ui-flow`

## 执行记录
- 已确认 `public\css\style.css` 约 232KB，属于当前必修拆分对象。
- 已确认 `public\js\app.js` 约 262KB，属于可延后堆叠问题；本轮先记录，不重构业务 JS。
- TODO 1 已执行：`public\index.html`、`public\auth\index.html`、`public\login\index.html`、`public\register\index.html`、`public\account\index.html`、`public\admin\index.html` 均直接引用单一 `public\css\style.css`。
- TODO 1 已执行：测试中 `test-ui-ux-security-polish.js`、`test-style-contract.js` 等存在直接读取 `public\css\style.css` 的断言，需要改为读取模块化 CSS 聚合内容。
- TODO 2 拆分映射：`reset.css` 承载变量、主题 token、全局 reset；`common.css` 承载布局、按钮、卡片、输入、上传、toast、modal 等公共组件；`index.css` 承载首页工作台、AI 对话、模板、历史等首页专属样式；`admin.css` 承载后台用户、审计、批量操作等后台样式；`portal.css` 承载外层 portal 页面壳；`auth.css` 承载登录\注册\恢复认证样式；`portal-components.css` 承载 portal 表单、导航、反馈等共享组件；`account.css` 承载账号中心与部分纸张主题覆盖；`responsive.css` 承载拆分尾部的跨页面响应式规则。
- TODO 2 复盘补充：初次拆分后 `public\css\index.css` 仍有约 122KB，属于“换了文件名但仍堆叠”的问题，已补充二次拆分。
- TODO 3 已执行：`public\css\style.css` 已缩减为兼容入口，只保留模块 `@import`，不再承载全部样式代码。
- TODO 3 已执行：新增 `public\css\reset.css`、`public\css\common.css`、`public\css\index.css`、`public\css\chat-message.css`、`public\css\chat-workspace.css`、`public\css\chat-dropdown.css`、`public\css\workspace-responsive.css`、`public\css\auth-gate.css`、`public\css\templates.css`、`public\css\admin.css`、`public\css\portal.css`、`public\css\auth.css`、`public\css\portal-components.css`、`public\css\account.css`、`public\css\responsive.css`。
- TODO 4 已执行：6 个 HTML 页面已改为按固定顺序加载模块 CSS，不再直接依赖 `\css\style.css`。
- TODO 5 已执行：新增 `test-css-utils.js` 聚合读取模块 CSS；相关测试已从直接读取 `style.css` 改为读取模块集合。
- TODO 6 已执行：排查发现仍需后续治理的堆叠文件包括 `public\js\app.js` 约 6858 行、`server\state-store.js` 约 2352 行、`public\js\app-shell.js` 约 1362 行、`server\routes\state.js` 约 1360 行、`public\index.html` 约 860 行。当前任务只要求找出，未纳入本轮重构。
- 当前 CSS 拆分后最大模块为 `public\css\chat-workspace.css` 约 1772 行；该文件仍偏大，但已从原 10401 行单文件和 5456 行首页堆叠显著下降，后续可继续按会话列表、摘录、输入区细分。

## 验证结果
- `node test-page-markup.js`：通过。
- `node test-ui-ux-security-polish.js`：通过。
- `node test-style-contract.js`：通过。
- `node test-chat-formula-rendering.js`：通过。
- `node test-brand-title-typography.js`：通过。
- `node test-chat-scroll-latest-button.js`：通过。
- `node test-chat-model-series-badge.js`：通过。
- `node test-chat-input-paper-and-dropdown-init.js`：通过。
- `node test-chat-model-dropdown-visual.js`：通过。
- `node test-paper-theme-component-colors.js`：通过。
- `node test-transcription-color-consistency.js`：通过。
- `npm run test:frontend`：通过。
- `npm run check`：通过。
- `npm run test:ui-flow`：通过。

## 复盘
- CSS 单文件堆叠问题已处理为模块化结构，`style.css` 只作为兼容入口存在。
- 为了降低视觉回归风险，本轮采用“保持原始级联顺序”的拆分方式，因此部分模块仍有主题覆盖交错，后续可以在新 TODO 中继续做语义归位。
- 其他堆叠文件中，`public\js\app.js` 是最明显的下一个治理对象；它同时包含模板、对话、模型下拉、渲染、上传等逻辑，不宜在 CSS 拆分任务里顺手重构。
- 测试失败中发现部分旧测试仍断言早期 logo 结构和纸张主题选择器，已同步为当前 UI 契约；这属于测试契约修正，不改变产品行为。
