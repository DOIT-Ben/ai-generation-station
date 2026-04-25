# 2026-04-25 品牌标题不换行修复计划

## 目标
修复侧边栏品牌标题 `AI Generation` 字体变矮、被压窄并换行的问题，让标题恢复自然、稳定、美观的一行展示。

## 范围
- `public\css\style.css`
- `test-brand-title-typography.js`
- 必要时补充页面标记或前端状态测试，不改其它功能。

## 假设
- 用户反馈的是侧边栏顶部 `AI Generation` 品牌字标。
- 当前不需要更换 logo 图片，也不需要改登录页品牌文案。
- 最小方案是移除强制两行和窄宽度规则，保留现有色彩与主题适配。

## 风险
- 一行展示可能占用侧边栏横向空间，需要设置 `white-space: nowrap` 与合理字体尺寸。
- 若测试仍要求两行字标，会继续误导后续改动，需要同步更新测试契约。

## TODO
1. 复核现有 `.logo`、`.logo-text` 样式和测试契约。
2. 修改品牌标题样式为一行、不压窄、不变矮。
3. 更新品牌标题测试，锁定“不换行”的契约。
4. 运行相关验证。
5. 回写执行记录与复盘。

## 完成标准
- `AI Generation` 在桌面侧边栏一行显示。
- 不再使用 `width: min-content` 强制拆行。
- 标题高度、字重、字距更自然，不截断、不换行。
- 相关测试通过。

## 验证方式
- `node test-brand-title-typography.js`
- `node test-page-markup.js`
- 如 CSS 改动影响范围较大，补跑 `node test-style-contract.js`。

## 执行记录
- 2026-04-25：已确认用户反馈指向侧边栏品牌标题换行与视觉压缩问题。
- TODO 1 已完成：
  - `.logo-text` 当前使用 `width: min-content`、`white-space: normal`、`text-wrap: balance`，会主动把 `AI Generation` 压成窄列并换行。
  - `test-brand-title-typography.js` 旧契约也在要求两行字标，需要同步修正。
- TODO 1 复盘：
  - 新问题：旧测试保护了错误视觉方向。
  - 边界条件：本轮只修侧边栏品牌标题，不改登录页 `portal-brand`。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 2 已完成：
  - 已移除 `width: min-content`、`white-space: normal`、`text-wrap: balance`。
  - 已将标题设为 `max-width: 172px`、`font-size: 1.18rem`、`line-height: 1.08`、`white-space: nowrap`。
- TODO 2 复盘：
  - 新问题：无。
  - 边界条件：移动端窄侧栏仍沿用既有隐藏 `.logo-text` 的规则。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 3 已完成：
  - 已更新 `test-brand-title-typography.js`，锁定品牌标题不再被 `min-content` 压窄，不再使用两行平衡，并必须保持一行展示。
- TODO 3 复盘：
  - 新问题：无。
  - 边界条件：测试用字符串契约，适合当前 CSS 文件结构。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 4 已完成：
  - 已运行相关验证命令。

## 验证结果
- `node test-brand-title-typography.js`：通过。
- `node test-page-markup.js`：通过。
- `node test-style-contract.js`：通过。

## 复盘
- 新问题：本轮未发现新的功能级问题。
- 边界条件：当前未启动浏览器截图，只用 CSS 契约和页面标记验证；如需要肉眼确认，可再跑视觉截图。
- 遗漏点：未提交推送，等待用户确认是否需要一起提交。
- 是否回写规划：已完成。
