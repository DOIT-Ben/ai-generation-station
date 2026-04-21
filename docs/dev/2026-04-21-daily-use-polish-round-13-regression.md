# 2026-04-21 Daily Use Polish Round 13 Regression

## 回归策略
- 阶段 2-4 完成后先跑一轮功能回归。
- 样式与列表交互收口后刷新视觉基线并执行视觉回归。
- 提交前核对纳入文件范围，继续排除 `public/js/app-shell.js`。

## 执行记录
### 阶段回归 1
- 执行时间：2026-04-21 10:56 +08:00
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
- 执行时间：2026-04-21 10:59 +08:00
- 已执行：
  - `npm run test:ui-visual:update -- --port 18797 --launch-server`
  - `npm run test:ui-visual -- --port 18797 --launch-server`
- 结果：
  - 视觉基线已按 round-13 最终样式刷新。
  - 视觉脚本增加了聊天页时间文案规范化处理后，视觉回归恢复稳定。
  - 视觉回归通过，`chat-card-dark` 为 18px，`chat-card-light` 为 19px，均低于阈值。
  - 浏览器回归期间的 SQLite experimental warning 依旧存在，但不影响结果。

### 最终收口核对
- 已核对本轮纳入提交的文件为：
  - `public/index.html`
  - `public/js/app.js`
  - `public/css/style.css`
  - `test-page-markup.js`
  - `test-ui-visual.js`
  - `docs/dev/2026-04-21-daily-use-polish-round-13-plan.md`
  - `docs/dev/2026-04-21-daily-use-polish-round-13-execution.md`
  - `docs/dev/2026-04-21-daily-use-polish-round-13-regression.md`
- 已确认外部脏文件 `public/js/app-shell.js` 继续保留在工作区，不纳入本轮提交。
