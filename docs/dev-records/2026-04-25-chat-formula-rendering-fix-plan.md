# 2026-04-25 AI 对话公式渲染不完整修复计划

## 目标
修复 AI 对话消息中公式渲染不完整的问题，确保常见 LaTeX 行内公式和块级公式不会被 Markdown 渲染链路截断或破坏。

## 范围
- `public\js\app.js` 中聊天 Markdown 渲染函数。
- `public\css\style.css` 中必要的公式展示样式。
- 新增或更新最小测试，覆盖公式保真渲染。

## 假设
- 用户反馈的是 AI 对话区 `message-body` 内的数学公式。
- 当前项目没有引入 KaTeX/MathJax，最小修复应先保证公式内容完整展示，而不是引入新依赖。
- 常见输入形式包括 `$...$`、`$$...$$`、`\(...\)`、`\[...\]`。

## 风险
- Markdown 的 `_`、`*`、反斜杠处理可能破坏公式内容。
- 如果直接引入复杂数学排版库，改动面会超过当前 TODO。
- 公式中可能包含 `<`、`>`、`&`，必须保持转义，避免 XSS。

## TODO
1. 复核当前聊天 Markdown 渲染链路，定位公式被破坏的位置。
2. 补充最小失败测试，复现公式不完整。
3. 实现最小公式保护与展示逻辑。
4. 运行相关验证。
5. 回写执行记录与复盘。

## 完成标准
- 行内和块级公式内容完整展示。
- 公式内部的下划线、星号、反斜杠、尖括号不会被 Markdown 规则破坏。
- 公式 HTML 输出保持安全转义。
- 相关测试通过。

## 验证方式
- 新增公式渲染测试。
- `node test-page-markup.js`
- `node test-frontend-state.js`

## 执行记录
- 2026-04-25：已开始定位 AI 对话公式渲染链路。
- TODO 1 已完成：
  - 当前聊天渲染链路为 `formatChatMessageHtml` 先整体 `escapeHtml`，再对每个段落调用 `applyInlineMarkdown`。
  - `applyInlineMarkdown` 会把 `_..._`、`*...*`、反引号等当作 Markdown 处理。
  - 公式中的 `x_i`、`a*b`、`\frac{}` 等内容会被 Markdown 强调规则破坏，导致公式显示不完整。
- TODO 1 复盘：
  - 新问题：聊天渲染函数在 IIFE 内部，直接行为测试不方便，需要先用静态契约测试保护关键链路。
  - 边界条件：本轮不引入 KaTeX/MathJax，只保证公式内容完整和安全展示。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 2 已完成：
  - 新增 `test-chat-formula-rendering.js`。
  - 首次运行失败，断言当前缺少 `protectChatFormulaSegments` 公式保护链路。
- TODO 2 复盘：
  - 新问题：测试最初对 CSS 块解析过窄，后续修正为检查关键声明。
  - 边界条件：测试聚焦公式保护链路和展示样式，不验证真实数学排版。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 3 已完成：
  - 新增 `renderChatFormulaSegment`、`protectChatFormulaSegments`、`restoreChatFormulaSegments`。
  - 支持 `$$...$$`、`$...$`、`\(...\)`、`\[...\]`。
  - 在 `applyInlineMarkdown` 内先保护公式，再执行 Markdown inline 替换，最后恢复为安全转义后的公式 HTML。
  - 新增 `.chat-formula-inline` 和 `.chat-formula-block` 样式，行内公式不换行，块级公式横向滚动。
- TODO 3 复盘：
  - 新问题：无。
  - 边界条件：公式内容仍通过 `escapeHtml` 输出，避免引入 HTML 注入风险。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 4 已完成：
  - 已运行公式、页面、前端状态和 JS 语法验证。

## 验证结果
- `node test-chat-formula-rendering.js`：通过。
- `node test-page-markup.js`：通过。
- `node test-frontend-state.js`：通过。
- `node --check public\js\app.js`：通过。

## 复盘
- 新问题：当前只是公式保真展示，不是专业排版；如后续要漂亮渲染分式、上下标，需要另行规划引入数学排版库。
- 边界条件：未跑浏览器视觉截图，当前以渲染链路契约和基础前端测试为准。
- 遗漏点：未提交推送；当前工作区还包含前两轮视觉修复。
- 是否回写规划：已完成。
