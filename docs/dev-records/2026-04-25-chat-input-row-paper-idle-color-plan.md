# 聊天输入行护眼模式未交互态颜色修复记录

## 目标
- 修复 `chat-input-row` 在护眼模式下未聚焦、鼠标未悬停时颜色与整个输入框不一致的问题。
- 保持聚焦态、悬停态和其他主题不被扩大影响。

## 范围
- 仅处理聊天页输入区 `chat-input-row` 在 `paper` 主题下的未交互态样式。
- 允许修改的文件限定为：
  - `public\css\style.css`
  - 与本问题直接相关的测试文件
  - 本记录文件
- 不调整聊天模型下拉、不改 JS 初始化逻辑、不做额外 UI 重构。

## 假设
- 用户说的“没有聚焦鼠标的时候”指 `chat-input-row` 的普通 idle 状态，不是 `:hover` 或 `:focus-within`。
- “整个输入框”指外层 `chat-input` 容器的护眼模式视觉底色和边框体系。
- 当前问题很可能来自基础 `.chat-input-row` 样式在 `paper` 主题下没有覆盖完整，或 idle 态与 hover/focus 态使用了不同色系。

## 风险
- 如果只改背景不改边框，仍可能在 idle 态看起来割裂。
- 如果覆盖选择器太宽，可能影响其他主题或其他页面输入行。
- 如果测试只检查字符串，可能无法完全代表浏览器实际计算值，因此必要时补浏览器实检。

## TODO
1. 定位 `chat-input`、`chat-input-row`、textarea 在默认、hover、focus、paper 主题下的现有 CSS 规则。
2. 判定 idle 态颜色不一致的根因，并确认最小修改点。
3. 修改 `paper` 主题下 `chat-input-row` 未交互态颜色，使其与外层输入框一致。
4. 补充或更新专项测试，覆盖 `paper` 主题 idle 态颜色规则。
5. 执行验证并完成复盘，记录新问题、边界条件、遗漏点、是否需要补规划。

## 完成标准
- `paper` 主题下 `chat-input-row` 未悬停、未聚焦时的背景和边框与外层输入框视觉体系一致。
- `paper` 主题下 hover 和 focus 状态仍保留清晰反馈。
- 其他主题不因本轮改动发生无关变化。
- 专项测试通过。

## 验证方式
- 静态检查 CSS 选择器和改动范围。
- 运行：
  - `node test-chat-input-paper-and-dropdown-init.js`
  - `node test-page-markup.js`
- 必要时使用 Playwright 读取 `paper` 主题下 idle、hover、focus 的计算样式。

## 执行记录
- 2026-04-25 12:20
  - 已接到用户反馈：`chat-input-row` 在护眼模式下未聚焦、鼠标未悬停时颜色不符合整个输入框。
  - 已归类：
    - 当前必修：修复 `paper` 主题下聊天输入行 idle 态颜色一致性。
    - 可延后：其他主题和其他输入组件的统一审查。
    - 规划缺失：无，本记录已补规划。
- 2026-04-25 12:24
  - 已完成 TODO 1：定位相关 CSS 规则。
  - 关键规则：
    - `[data-theme="paper"] .input-group textarea, ... [data-theme="paper"] .chat-input-row textarea` 为聊天 textarea 设置了 `background: rgba(255, 250, 239, 0.88)`。
    - `[data-theme="paper"] .chat-input-row` 本身已有纸张色渐变背景。
    - `.chat-input-row textarea:focus` 在后面设置 `background: transparent`。
  - 已完成 TODO 2：判定根因和最小修改点。
  - 根因：
    - `paper` 主题下聊天 textarea 被通用输入框样式赋予内层浅色背景。
    - 未聚焦时内层背景可见，与外层 `chat-input-row` 的纸张渐变不一致。
    - 聚焦时由于 `textarea:focus` 变为透明，视觉反而恢复一致，因此问题集中在 idle 态。
  - 最小修改点：
    - 在 `[data-theme="paper"] .chat-input-row textarea` 专项规则中显式设置 `background: transparent` 和 `border-color: transparent`。

### TODO 1-2 复盘
- 新问题
  - 发现聊天 textarea 曾被纳入通用 `paper` 输入控件规则，后续若继续统一输入体系，可以单独整理选择器边界。
- 边界条件
  - 本轮只修复聊天输入 textarea，不移除通用规则中的选择器，避免影响其他输入框。
- 遗漏点
  - 尚未验证浏览器计算样式。
- 是否回写规划
  - 已回写；继续执行 TODO 3。
- 2026-04-25 12:28
  - 已完成 TODO 3：修改 `paper` 主题下 `chat-input-row textarea` 未交互态样式。
  - 修改内容：
    - 在 `[data-theme="paper"] .chat-input-row textarea` 中增加 `background: transparent`。
    - 在同一规则中增加 `border-color: transparent`。
  - 已完成 TODO 4：更新专项测试。
  - 测试新增断言：
    - `paper` 聊天 textarea idle 态背景应保持透明。
    - `paper` 聊天 textarea idle 态不应显示内层边框。

### TODO 3-4 复盘
- 新问题
  - 未发现需要扩大到其他主题的问题。
- 边界条件
  - 本轮没有移除通用 `paper` 输入规则中的 `.chat-input-row textarea`，只是用后续专项规则覆盖聊天输入框，改动更窄。
- 遗漏点
  - 尚未执行自动化验证和浏览器计算样式验证。
- 是否回写规划
  - 已回写；继续执行 TODO 5。

## 验证结果
- 已通过：
  - `node test-chat-input-paper-and-dropdown-init.js`
  - `node test-page-markup.js`
- 浏览器计算样式验证已通过：
  - 条件：
    - 打开 `http://localhost:18791`
    - 登录测试账号
    - 强制设置 `data-theme="paper"`
    - 鼠标移出输入区并让 `#chat-input` 失焦
  - idle 态结果：
    - `theme = paper`
    - `rowBackgroundColor = rgba(255, 249, 236, 0.88)`
    - `rowBackgroundImage = linear-gradient(rgba(255, 251, 241, 0.97), rgba(245, 236, 213, 0.94)), none`
    - `rowBorderColor = rgba(96, 72, 30, 0.1)`
    - `inputBackgroundColor = rgba(0, 0, 0, 0)`
    - `inputBorderColor = rgba(0, 0, 0, 0)`
    - `inputColor = rgb(60, 47, 29)`
    - `activeElement = BODY`
  - hover 态结果：
    - `inputBackgroundColor = rgba(0, 0, 0, 0)`
    - `inputBorderColor = rgba(0, 0, 0, 0)`
  - focus 态结果：
    - `rowBorderColor = rgba(197, 151, 70, 0.196)`
    - `inputBackgroundColor = rgba(0, 0, 0, 0)`
    - `activeElement = chat-input`

## 复盘
- 新问题
  - 未发现新的业务问题。
  - 发现通用 `paper` 输入控件规则里仍包含 `.chat-input-row textarea`，但本轮通过更靠后的专项规则完成最小覆盖；是否整理选择器边界可延后。
- 边界条件
  - 本轮只修复 `paper` 主题聊天输入 textarea 的 idle 内层背景和边框。
  - 未调整外层 `chat-input-row` 的背景、阴影、圆角。
  - 未调整其他主题和其他表单输入控件。
- 遗漏点
  - 未做肉眼手动点击截图验收；已用浏览器计算样式确认 idle、hover、focus 三种状态。
- 是否回写规划
  - 已回写。
  - 当前不需要新增业务修复 TODO。
