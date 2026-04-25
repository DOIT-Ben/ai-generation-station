# chat-input-row 输入面板精修计划

## 目标
- 精修 `chat-input-row` 的边框、内边距和按钮对齐。
- 让输入区更像一个完整的对话输入面板。

## 范围
- 仅处理 `chat-input-row` 相关样式。
- 修改范围限定在：
  - `public\css\style.css`

## 假设
- 当前结构已经稳定，本轮只做视觉和节奏优化，不改 HTML。

## TODO
1. 收紧 `chat-input-row` 边框与背景层次。
2. 调整输入区内边距和 textarea 垂直节奏。
3. 调整停止/发送按钮的对齐与尺寸感。
4. 执行最小回归并回写记录。

## 完成标准
- 输入区看起来更完整、边界更清楚、按钮更齐。
- 前端回归测试继续通过。

## 验证方式
- 执行：
  - `node test-page-markup.js`
  - `node test-frontend-state.js`

## 执行记录
- 2026-04-24 已完成：
  - 强化 `chat-input-row` 本体的背景、边框和阴影层次
  - 增强 `focus-within` 态，让输入区聚焦时边界更清楚
  - 微调 `textarea` 内边距和按钮垂直对齐
  - 同步补齐 `light` 与 `paper` 主题下的输入面板表现

## 验证结果
- 已执行：
  - `node test-page-markup.js`
  - `node test-frontend-state.js`
- 结果：
  - 页面标记测试通过
  - 前端状态测试通过

## 复盘
- 这轮已经把 `chat-input-row` 做成一个更完整的输入面板了。
- 当前结论：
  - 结构更简单
  - 边界更清楚
  - 按钮和输入框更齐
