# 2026-04-25 品牌字标 Station 美化计划

## 目标
修复 `AI Generation Station` 品牌字标不美观的问题，让主工作台与门户壳的品牌展示更完整、更有层级。

## 范围
- `public\index.html` 的侧边栏品牌文案结构。
- `public\js\site-shell.js` 的门户品牌文案结构。
- `public\css\style.css` 中 `.logo-text` 与 `.portal-brand-copy` 相关样式。
- `test-brand-title-typography.js` 相关契约。

## 假设
- 用户反馈的 `Ai Generation station` 指品牌标题整体观感，而不是 logo 图片。
- 最小方案是把品牌拆成主标题 `AI Generation` 与副标题 `Station`，避免硬塞成一行或随意换行。
- 不改 logo 图片、不改导航、不改页面功能。

## 风险
- 如果副标题字号过大，会挤压侧边栏宽度。
- 如果颜色层级太弱，会看起来像说明文字而不是品牌的一部分。
- 门户页与工作台品牌结构需保持一致，避免两套视觉语言。

## TODO
1. 复核当前品牌 HTML 与 CSS。
2. 调整主工作台品牌结构和样式。
3. 调整门户壳品牌结构和样式。
4. 更新测试契约并运行验证。
5. 回写执行记录与复盘。

## 完成标准
- 品牌显示完整表达 `AI Generation Station`。
- `AI Generation` 与 `Station` 有清晰层级，不拥挤、不生硬换行。
- 主工作台与门户壳品牌风格一致。
- 相关测试通过。

## 验证方式
- `node test-brand-title-typography.js`
- `node test-page-markup.js`
- `node test-style-contract.js`

## 执行记录
- 2026-04-25：已确认当前品牌主要显示为 `AI Generation`，缺少 `Station` 层级。
- TODO 1 已完成：
  - 主工作台 `public\index.html` 侧边栏当前只有 `AI Generation`。
  - 门户壳 `public\js\site-shell.js` 当前为 `AI Generation / 创作工作台`。
  - `.logo-text` 当前是一行渐变文字，缺少副标层级。
- TODO 1 复盘：
  - 新问题：品牌在工作台和门户壳表达不一致。
  - 边界条件：不更换 logo 图片，不调整导航。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 2 已完成：
  - 已将工作台品牌结构改为 `<strong>AI Generation</strong><span>Station</span>`。
  - 已将 `.logo-text` 调整为双层 lockup：主标题渐变、更重；`Station` 小号大写、增加字距。
- TODO 2 复盘：
  - 新问题：无。
  - 边界条件：移动端仍保留既有隐藏 `.logo-text` 规则。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 3 已完成：
  - 已将门户壳品牌副标题从 `创作工作台` 改为 `Station`。
  - 已统一门户壳品牌字体和 `Station` 小号大写节奏。
- TODO 3 复盘：
  - 新问题：无。
  - 边界条件：不改门户导航和用户状态区域。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 4 已完成：
  - 已更新 `test-brand-title-typography.js`，锁定双层品牌结构与门户壳一致性。
  - 已运行验证。

## 验证结果
- `node test-brand-title-typography.js`：通过。
- `node test-page-markup.js`：通过。
- `node test-style-contract.js`：通过。

## 复盘
- 新问题：本轮未发现新的功能级问题。
- 边界条件：未运行浏览器截图，当前以结构与样式契约验证为准。
- 遗漏点：本轮未提交推送；当前工作区还包含前几轮未提交修复。
- 是否回写规划：已完成。
