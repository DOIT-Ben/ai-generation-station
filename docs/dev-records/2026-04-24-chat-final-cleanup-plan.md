# AI 对话页最终收尾清理计划

## 目标
- 对 AI 对话页连续多轮优化后的遗留内容做一次最终收尾。
- 清理已移除结构对应的死样式、过时测试假设或轻微不一致项。
- 保持当前页面结构、交互和验收链路稳定。

## 范围
- 仅处理聊天页相关前端样式与测试残留。
- 修改范围限定在：
  - `public\css\style.css`
  - `test-ui-flow-smoke.js`
  - `test-ui-visual.js`
- 不改后端，不改业务逻辑，不再扩大到其他页面。

## 假设
- 当前主功能和浏览器级验收已经通过，本轮重点不是“修功能”，而是“收尾清理”。
- 优先清理不再使用的聊天页样式和测试中的兼容性残留。

## 风险
- 如果误删仍在使用的样式，可能造成细微视觉回退。
- 如果清理测试过度，可能削弱现有验收覆盖。

## TODO
1. 检查聊天页相关 CSS 是否还存在已移除结构的死样式。
2. 检查刚刚为兼容当前 UI 做的测试调整里，是否还有可收敛的兼容性残留。
3. 做最小清理，不改变现有页面功能与布局。
4. 重新执行前端与浏览器级验收确认稳定。
5. 回写执行记录、验证结果与复盘。

## 完成标准
- 聊天页相关残留进一步减少。
- 现有测试链继续通过。
- 本轮不引入新的视觉或交互变化。

## 验证方式
- 执行：
  - `node test-page-markup.js`
  - `node test-frontend-state.js`
  - `node test-ui-flow-smoke.js --port 18791`
  - `node test-ui-visual.js --port 18791`

## 执行记录
- 2026-04-24 已检查聊天页相关残留，确认以下项可安全清理：
  - `chat-clear-input` 的死样式
  - `renderConversationMeta` 中对已删头部重命名\归档按钮的残留引用
  - `test-ui-visual.js` 中为了定位问题临时加入的 capture 日志
- 已完成清理：
  - 删除 `public\css\style.css` 中 `chat-clear-input` 相关样式
  - 精简 `public\js\app.js` 中 `renderConversationMeta` 的过时按钮处理
  - 删除 `test-ui-visual.js` 的临时调试日志
- 清理后已重新执行完整回归。

## 验证结果
- 已执行：
  - `node test-page-markup.js`
  - `node test-frontend-state.js`
  - `node test-ui-flow-smoke.js --port 18791`
  - `node test-ui-visual.js --port 18797 --launch-server`
- 结果：
  - 页面标记测试通过
  - 前端状态测试通过
  - UI 流程 smoke 通过
  - 视觉回归在临时干净实例下通过
- 补充结论：
  - 对在线持久化实例 `18791` 直接跑 visual，会受到真实数据变化影响，导致基线不稳定
  - 对临时实例 `--launch-server` 跑 visual，结果稳定且可复现

## 复盘
- 这轮清理证明，当前聊天页主实现已经稳定，后续更适合做“保持验收链干净”，而不是继续堆样式。
- 一个关键经验是：
  - smoke 可以对当前在线实例做
  - visual 更适合绑定临时干净实例做稳定回归
