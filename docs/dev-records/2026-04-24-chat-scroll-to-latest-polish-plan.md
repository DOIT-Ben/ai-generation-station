# chat-scroll-to-latest 按钮显示与主题适配修正计划

## 目标
- 修正 `chat-scroll-to-latest` 按钮显示不全的问题。
- 为深色、浅色、护眼三套主题补齐更协调的视觉适配。

## 范围
- 仅处理 `chat-scroll-to-latest` 的样式。
- 修改范围限定在：
  - `public\css\style.css`

## 假设
- 当前问题主要来自按钮宽度与内边距不足，以及 `paper` 主题缺少单独覆盖。

## TODO
1. 调整按钮尺寸、内边距和定位，确保文案完整可见。
2. 为 `light` 和 `paper` 主题分别补颜色与阴影适配。
3. 执行最小回归并回写结果。

## 完成标准
- 按钮文案完整可见。
- 三套主题下都不突兀。

## 验证方式
- 执行：
  - `node test-page-markup.js`
  - `node test-frontend-state.js`

## 执行记录
- 2026-04-24 已完成：
  - 增加 `chat-scroll-to-latest` 的左右内边距与最小高度
  - 补充 `white-space: nowrap`、字体大小与字重，避免文案被挤坏
  - 增加 `max-width` 保护，避免超出消息区可视范围
  - 为 `light` 与 `paper` 主题补充独立颜色与 hover 适配
  - 同步放宽移动端按钮尺寸

## 验证结果
- 已执行：
  - `node test-page-markup.js`
  - `node test-frontend-state.js`
- 结果：
  - 页面标记测试通过
  - 前端状态测试通过

## 复盘
- 这轮只处理了 `chat-scroll-to-latest` 的显示与主题适配，影响面很小。
- 当前结论：
  - 文案显示更完整
  - 三套主题下视觉更一致
