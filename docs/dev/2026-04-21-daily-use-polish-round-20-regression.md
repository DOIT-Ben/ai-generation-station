# 2026-04-21 Daily Use Polish Round 20 Regression

## 回归策略
- 先执行脚本语法检查和静态断言，确认统计标签与归档资产跳转入口存在。
- 再执行 UI 流程与视觉回归，重点检查聊天卡片和底部资产区在深浅主题下是否稳定。
- 提交前继续排除 `public/js/app-shell.js`。

## 执行记录
### 阶段回归 1
- 执行时间：2026-04-21 12:47 +08:00
- 已执行：
  - `node --check public/js/app.js`
  - `node test-page-markup.js`
  - `node test-ui-flow-smoke.js --launch-server`
- 结果：全部通过。脚本语法、静态结构断言和基础 UI 流程均无新增错误。

### 阶段回归 2
- 执行时间：2026-04-21 13:05 +08:00
- 已执行：
  - `npm run test:ui-visual:update -- --port 18802 --launch-server`
  - `npm run test:ui-visual -- --port 18802 --launch-server`
- 结果：串行执行后通过。视觉差异维持在阈值内：
  - `admin-console: 28 px`
  - `chat-card-dark: 36 px`
  - `chat-card-light: 44 px`
  - 其余基线：`0 px`

### 异常记录
- 初次视觉对比时，`chat-card-dark` 与 `chat-card-light` 因聊天侧边栏文本归一化选择器不准确而超阈值。
- 处理方式：在 `test-ui-visual.js` 的 `normalizeChatPanel()` 中补充真实的聊天侧边栏节点选择器，包括会话标题、预览、元信息、分组标签、侧边栏摘要与快捷按钮。
- 结论：属于测试稳定性问题，不是产品代码缺陷；补齐归一化后视觉回归恢复稳定。

### 最终收口核对
- 工作区中本轮目标文件处于变更状态，外部脏文件 `public/js/app-shell.js` 继续排除在提交范围之外。
- 本轮新增一处测试稳定性修正：`test-ui-visual.js`。
- 本轮未新增后端接口、数据库迁移或环境变量依赖。
