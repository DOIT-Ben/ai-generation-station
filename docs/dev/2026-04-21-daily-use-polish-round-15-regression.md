# 2026-04-21 Daily Use Polish Round 15 Regression

## 回归策略
- 阶段 2-4 完成后先跑功能回归。
- 若视觉结构有新增，则刷新视觉基线并执行视觉回归。
- 提交前核对纳入文件范围，继续排除 `public/js/app-shell.js`。

## 执行记录
### 阶段回归 1
- 执行时间：2026-04-21 11:20 +08:00
- 已执行：
  - `node --check public/js/app.js`
  - `node test-page-markup.js`
  - `node test-ui-flow-smoke.js --launch-server`
- 结果：全部通过。语法检查、结构断言和基础 UI 流程未出现新增错误。

### 阶段回归 2
- 执行时间：2026-04-21 11:27 +08:00
- 已执行：
  - `npm run test:ui-visual:update -- --port 18797 --launch-server`
  - `npm run test:ui-visual -- --port 18797 --launch-server`
- 结果：串行执行后全部通过。视觉差异维持在阈值内：
  - `admin-console: 26 px`
  - `chat-card-dark: 15 px`
  - `chat-card-light: 20 px`

### 异常记录
- 在视觉回归过程中，曾误将基线刷新与视觉比对并发运行在同一端口，触发 `EADDRINUSE`。
- 结论：属于测试执行顺序问题，不是代码缺陷；改为串行执行后恢复正常。

### 最终收口核对
- `git status --short` 显示本轮目标文件处于变更状态，外部脏文件 `public/js/app-shell.js` 继续排除在提交范围之外。
- 本轮未新增后端接口、数据库迁移或环境变量依赖。
- 已满足提交条件：功能回归通过、视觉回归通过、文档补齐、提交范围可控。
