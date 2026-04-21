# 2026-04-21 Daily Use Polish Round 17 Regression

## 回归策略
- 先执行脚本语法检查和静态断言，确认新增底部资产区与复用函数存在。
- 再执行 UI 流程与视觉回归，检查聊天页和底部续接区在不同主题下无明显回归。
- 提交前继续排除 `public/js/app-shell.js`。

## 执行记录
### 阶段回归 1
- 执行时间：2026-04-21 12:03 +08:00
- 已执行：
  - `node --check public/js/app.js`
  - `node test-page-markup.js`
  - `node test-ui-flow-smoke.js --launch-server`
- 结果：全部通过。脚本语法、静态结构断言和基础 UI 流程均无新增错误。

### 阶段回归 2
- 执行时间：2026-04-21 12:07 +08:00
- 已执行：
  - `npm run test:ui-visual:update -- --port 18799 --launch-server`
  - `npm run test:ui-visual -- --port 18799 --launch-server`
- 结果：串行执行后通过。视觉差异维持在阈值内：
  - `admin-console: 41 px`
  - `chat-card-dark: 22 px`
  - `chat-card-light: 22 px`
  - 其余基线：`0 px`

### 异常记录
- 初次视觉对比时，`chat-card-light` 因聊天页动态标题/时间文本未完全归一化，出现 `60 px` 伪差异。
- 处理方式：在 `test-ui-visual.js` 的 `normalizeChatPanel()` 中补充聊天标题与消息时间归一化后，视觉回归恢复稳定。
- 另一次执行中，误把视觉基线刷新与视觉比对并行跑在同一端口，触发 `EADDRINUSE`。
- 结论：属于测试执行顺序问题，不是产品代码问题；改为串行执行后恢复正常。

### 最终收口核对
- 工作区中本轮目标文件处于变更状态，外部脏文件 `public/js/app-shell.js` 继续排除在提交范围之外。
- 本轮新增一处测试稳定性修正：`test-ui-visual.js`。
- 本轮未新增后端接口、数据库迁移或环境变量依赖。
