# 2026-04-25 导航品牌与 workspace-resume-card 修复计划

## 目标
修复前台工作台中两个明确的界面问题：
- 导航栏 logo 文字过扁、过长，当前观感压迫且存在超出导航栏的风险。
- `workspace-resume-card` 不应继续出现在用户前台界面底部。

## 范围
- `public\index.html` 中工作台品牌文案结构。
- `public\css\style.css` 中 `.logo`、`.logo-text` 及 `workspace-resume-card` 相关样式。
- `public\js\app.js` 中 `renderWorkspaceResumeCard()` 的前台显示逻辑。
- `test-brand-title-typography.js`
- `test-workspace-resume-card-ui.js`
- 如有必要，补充 `test-page-markup.js` 中与工作台前台结构相关的最小契约。

## 假设
- 用户说的“用户页面”按当前项目语境解释为前台工作台，而不是 `account` 或 `admin` 页面。
- 本轮最小方案是不改 logo 图片资源，只调整品牌文字结构与样式。
- 本轮按用户要求将 `workspace-resume-card` 从前台界面隐藏，而不是继续保留条件显示。

## 风险
- 若品牌文字压缩过度，可能影响辨识度。
- 若只改样式不改结构，可能在不同主题或宽度下仍出现溢出。
- 隐藏 `workspace-resume-card` 后，前台将失去该组件承载的显式续接提示，但不应影响底层状态保存。

## TODO
1. 复核当前品牌结构、侧边栏宽度约束与 `workspace-resume-card` 显示逻辑，确认最小改动点。
2. 调整工作台 logo 文案结构与样式，降低横向长度并保证不超出导航栏。
3. 修改前台工作台逻辑，隐藏 `workspace-resume-card`。
4. 更新相关测试契约，使测试与当前需求一致。
5. 运行验证命令并记录结果。
6. 回写执行记录、验证结果与复盘。

## 完成标准
- 工作台 logo 文字在默认桌面布局下不超出导航栏。
- logo 文字层级比当前更紧凑，不再呈现“太扁太长”的观感。
- `workspace-resume-card` 不再出现在前台用户界面底部。
- 相关测试通过。

## 验证方式
- `node test-brand-title-typography.js`
- `node test-workspace-resume-card-ui.js`
- `node test-page-markup.js`
- `npm run test:frontend`

## 执行记录
- 2026-04-25：已定位问题入口。
  - 工作台品牌结构位于 `public\index.html`。
  - 品牌样式位于 `public\css\style.css`，当前 `.logo-text` 为双层结构，但主标题仍为 `AI Generation`，横向占用偏长。
  - `workspace-resume-card` 结构位于 `public\index.html`，渲染逻辑位于 `public\js\app.js` 的 `renderWorkspaceResumeCard()`。
  - `account` 页面模板未直接包含 `workspace-resume-card`，当前更可能是用户所指的前台工作台底部组件。
- TODO 1 已完成。
- TODO 2 已完成。
  - 已将工作台侧边栏品牌从双层长词改为三层紧凑结构：`AI` / `Generation` / `Station`。
  - 已同步调整 `public\css\style.css` 中 `.logo-text` 的宽度、字号、字距和层级，降低横向占用。
  - 已同步调整 `public\js\site-shell.js` 与 `.portal-brand-copy`，保持门户页品牌节奏一致。
- TODO 3 已完成。
  - 已将 `public\js\app.js` 中 `renderWorkspaceResumeCard()` 收口为前台始终隐藏，仅保留 `renderWorkspaceAssetStrip()`。
- TODO 4 已完成。
  - 已更新 `test-brand-title-typography.js`，使其约束新的三层紧凑品牌结构。
  - 已更新 `test-workspace-resume-card-ui.js`，使其约束前台强制隐藏 `workspace-resume-card`。
- TODO 5 已完成。
  - 已运行聚焦测试和前端聚合测试。
- TODO 6 已完成。

## TODO 1 复盘
- 新问题：
  - 现有测试 `test-workspace-resume-card-ui.js` 仍要求保留该组件，这与本轮需求冲突，需要同步调整测试。
- 边界条件：
  - 不修改 `account`、`admin` 页面结构。
  - 不删除工作台底层状态保存逻辑。
- 遗漏点：暂无。
- 是否回写规划：已回写，后续按既定 TODO 继续执行。

## TODO 2 复盘
- 新问题：
  - 品牌结构改为三层后，门户页顶部品牌也需要同步，否则工作台和门户页会出现两套表达。
- 边界条件：
  - 不替换 logo 图片，不放大侧边栏，不新增额外品牌文案。
- 遗漏点：无。
- 是否回写规划：已回写，无需新增 TODO。

## TODO 3 复盘
- 新问题：
  - `workspace-resume-card` 虽然前台隐藏，但底层状态与资产条仍需保留，避免牵连工作台其它逻辑。
- 边界条件：
  - 只处理前台显示，不删除 HTML 结构，不清理持久化状态。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 4 复盘
- 新问题：无。
- 边界条件：
  - 测试只锁定本轮需求，不额外扩展到无关 UI。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 5 复盘
- 新问题：无。
- 边界条件：
  - 本轮验证以静态契约和前端聚合测试为主，未追加浏览器截图比对。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 6 复盘
- 新问题：无。
- 边界条件：
  - 文档已落到当前项目 `docs\dev-records`。
- 遗漏点：无。
- 是否回写规划：已完成。

## 验证结果
- `node test-brand-title-typography.js`：通过。
- `node test-workspace-resume-card-ui.js`：通过。
- `node test-page-markup.js`：通过。
- `npm run test:frontend`：通过。

## 复盘
- 新问题：
  - 本轮未发现新的功能性阻塞问题。
- 边界条件：
  - 本轮按“前台隐藏 `workspace-resume-card`”执行；若后续你希望彻底删掉 HTML 结构和相关文案，可再开一轮最小清理。
- 遗漏点：
  - 未做浏览器截图级视觉验收，当前以结构和测试验证为准。
- 是否回写规划：
  - 已完成回写。
