# 2026-04-20 Daily Use Polish Round 10 Regression

## 回归策略
- 阶段 1-3 完成后执行一轮功能回归。
- 阶段 4 完成后执行视觉基线更新与视觉回归。
- 最终提交前再做一次收口核对。

## 执行记录
### 阶段回归 1
- 执行时间：round-10 结构改动完成后
- 已执行：
  - `node --check public/js/app.js`
  - `node test-page-markup.js`
  - `node test-ui-flow-smoke.js --launch-server`
- 结果：
  - 语法检查通过。
  - 页面结构断言通过。
  - 前端烟测通过。
  - 烟测期间仍出现 Node 的 SQLite experimental warning，属于现有运行时提示，不影响结果。

### 阶段回归 2
- 执行时间：视觉与响应式收口后
- 已执行：
  - `node --check public/js/app.js`
  - `node test-page-markup.js`
  - `node test-ui-flow-smoke.js --launch-server`
  - `npm run test:ui-visual:update -- --port 18797 --launch-server`
  - `npm run test:ui-visual -- --port 18797 --launch-server`
- 结果：
  - 功能回归继续通过。
  - 视觉基线已刷新。
  - 视觉回归通过，`chat-card-light` 出现 37px 微差，低于阈值。
  - 浏览器回归期间的 SQLite experimental warning 依旧存在，但不影响结论。

### 最终收口核对
- 已核对提交范围仅包含：
  - `public/index.html`
  - `public/js/app.js`
  - `public/css/style.css`
  - `test-page-markup.js`
  - `docs/dev/2026-04-20-daily-use-polish-round-10-plan.md`
  - `docs/dev/2026-04-20-daily-use-polish-round-10-execution.md`
  - `docs/dev/2026-04-20-daily-use-polish-round-10-regression.md`
- 已确认外部脏文件 `public/js/app-shell.js` 继续保留在工作区，不纳入本轮提交。
