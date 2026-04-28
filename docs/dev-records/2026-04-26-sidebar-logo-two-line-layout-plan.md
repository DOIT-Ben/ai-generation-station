# 2026-04-26 侧边栏 Logo 两行字标修复计划

## 目标
- 按用户截图反馈修复侧边栏 Logo 字标被压扁的问题。
- 形成左侧 Logo 图标、右侧两行文字的结构：第一行 `AI Generation`，第二行 `STATION`。

## 范围
- 仅修改主工作台侧边栏品牌区：`public\index.html` 与 `public\css\style.css`。
- 必要时补充静态测试，避免以后回到三行压缩布局。

## 假设
- 用户文字中的 `Generaiton` 是输入误拼，界面仍应使用正确英文 `Generation`。
- `station` 可按现有视觉系统使用大写 `STATION`，与截图和当前样式一致。
- 不修改认证页\后台页顶部 portal 品牌，因为本次截图指向工作台侧边栏。

## 风险
- 侧边栏宽度有限，右侧两行字需要避免撑破导航宽度。
- 移动端侧边栏已有隐藏 `.logo-text` 的规则，需要保持不变。

## TODO
1. 调整 Logo HTML，使右侧字标具备“第一行 AI + Generation，第二行 STATION”的语义结构。
2. 调整 CSS，取消三行堆叠和矮扁视觉，保证两行文字垂直居中。
3. 增加或更新测试，验证两行结构与关键样式。
4. 运行相关验证并复盘。
5. 根据用户新截图调整为左侧大号 `AI`、右侧 `Generation` 与 `STATION` 两行的纯字标布局。

## 完成标准
- 左侧 Logo 图标独立显示。
- 右侧第一行显示 `AI Generation`，第二行显示 `STATION`。
- 字体不压扁、不异常换行，整体与侧边栏高度协调。

## 验证方式
- 静态测试检查 HTML 结构和 CSS 关键规则。
- `node test-ui-ux-security-polish.js`
- `node test-page-markup.js`
- `npm run check`

## 执行记录
- 已定位当前结构为 `.logo-text` 内三行：`strong AI`、`span Generation`、`em Station`。
- 已定位当前样式在 `public\css\style.css` 的 `.logo-text`、`.logo-text strong`、`.logo-text span`、`.logo-text em`。
- TODO 1 已执行：`public\index.html` 中 `.logo-text` 改为两行结构，第一行 `.logo-text-line--primary` 包含 `AI` 与 `Generation`，第二行 `.logo-text-line--station` 显示 `STATION`。
- TODO 2 已执行：`public\css\style.css` 中 `.logo-text` 改为居中的两行字标；新增 `.logo-text-line` 与 `.logo-text-line--primary`，并调整字号、行高和间距，避免矮扁。
- TODO 3 已执行：更新 `test-ui-ux-security-polish.js` 与 `test-page-markup.js`，验证两行 Logo 结构和关键样式。
- 浏览器初测发现第一行 `AI Generation` 实际宽度约 `183px`，原桌面侧边栏给字标的可用宽度约 `156px`，仍有挤压风险；已将桌面 `.sidebar` 与 `.main` 偏移从 `244px` 调整为 `272px`，与已有 `.auth-gate left: 272px` 保持一致。
- 二次复测发现 `.logo-text` 盒子仍限制为 `158px`，而第一行实际宽度约 `183px`；已将 `.logo-text max-width` 调整为 `185px`，让元素盒子与视觉内容一致。
- 用户追加截图要求不是图片 Logo，而是左侧大号 `AI` 字标、右侧两行文字。已将该项归类为当前 Logo 布局必修问题，继续在本计划内处理。
- TODO 5 已执行：`public\index.html` 侧边栏品牌区改为 `.logo-ai-mark` + 两行 `.logo-text-line`，左侧为大号 `AI`，右侧为 `Generation` 和 `STATION`。
- TODO 5 已执行：`public\css\style.css` 新增 `.logo-ai-mark`，统一使用红色字标，并为纸张主题补充一致颜色覆盖。

## 验证结果
- `node test-ui-ux-security-polish.js`：通过。
- `node test-page-markup.js`：通过。
- `npm run check`：通过。
- Playwright 浏览器复测：桌面侧边栏宽度为 `272px`；右侧字标第一行为 `AI Generation`，宽度约 `183px`；第二行为 `STATION`，宽度约 `106px`；两行均在侧边栏内，没有横向越界。

## 复盘
- TODO 1 复盘：用户截图里的问题不是 Logo 图标大小，而是右侧文字被拆成三行后高度和字重关系失衡。已改为更符合用户描述的两行锁定结构。
- TODO 2 复盘：需要保留 `AI` 的彩色强调，但不能让 `Generation` 被压成矮字。已降低 `AI` 的独占高度，提升 `Generation` 字号并同排对齐。
- TODO 3 复盘：静态测试已覆盖结构回归；视觉比例还需浏览器截图做最终确认。
- 补充复盘：如果只压缩字体来适配旧 `244px` 侧栏，会再次产生“矮扁”观感；因此选择小幅加宽桌面侧栏，移动端和 1023px 以下规则保持原有收起逻辑。
- 最终复盘：已按用户要求形成“左 Logo、右两行字”的结构；当前未提交，等待用户确认或后续统一提交。
- TODO 5 复盘：用户最终截图明确是纯字标布局，不应继续使用图片 Logo 作为左侧主视觉。已切换为文字 `AI`，图片仍仅作为 favicon 和消息头像等其他场景资产。
