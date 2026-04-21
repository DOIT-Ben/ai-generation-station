# 2026-04-21 Daily Use Polish Round 11 Regression

## 回归策略
- 阶段 2-3 完成后执行一轮功能回归。
- 视觉压缩完成后刷新视觉基线并执行视觉回归。
- 提交前做一次最终范围核对，确认不带入 `public/js/app-shell.js`。

## 执行记录
### 阶段回归 1
- 执行时间：2026-04-21 10:05 +08:00
- 已执行：
  - `node --check public/js/app.js`
  - `node test-page-markup.js`
  - `node test-ui-flow-smoke.js --launch-server`
- 结果：
  - 语法检查通过。
  - 页面结构断言通过。
  - 前端烟测通过。
  - 烟测期间继续出现 Node 的 SQLite experimental warning，属于现有运行时提示，不影响本轮结论。

### 阶段回归 2
- 执行时间：2026-04-21 10:06 +08:00
- 已执行：
  - `node --check public/js/app.js`
  - `node test-page-markup.js`
  - `node test-ui-flow-smoke.js --launch-server`
  - `npm run test:ui-visual:update -- --port 18797 --launch-server`
  - `npm run test:ui-visual -- --port 18797 --launch-server`
- 结果：
  - 功能回归继续通过。
  - 视觉基线已按最终 round-11 样式刷新。
  - 视觉回归通过，`chat-card-light` 出现 18px 微差，低于阈值。
  - 浏览器回归期间的 SQLite experimental warning 依旧存在，但不影响结果。

### 最终收口核对
- 已核对本轮纳入提交的文件为：
  - `public/js/app.js`
  - `public/css/style.css`
  - `docs/dev/2026-04-21-daily-use-polish-round-11-plan.md`
  - `docs/dev/2026-04-21-daily-use-polish-round-11-execution.md`
  - `docs/dev/2026-04-21-daily-use-polish-round-11-regression.md`
- 已确认外部脏文件 `public/js/app-shell.js` 继续保留在工作区，不纳入本轮提交。
