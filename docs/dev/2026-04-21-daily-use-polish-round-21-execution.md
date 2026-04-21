# 2026-04-21 Daily Use Polish Round 21 Execution

## 本轮范围
- 计划改动文件：`public/js/app.js`
- 文档文件：`docs/dev/2026-04-21-daily-use-polish-round-21-plan.md`、`docs/dev/2026-04-21-daily-use-polish-round-21-execution.md`、`docs/dev/2026-04-21-daily-use-polish-round-21-regression.md`
- 约束：不触碰外部脏文件 `public/js/app-shell.js`

## 执行记录
### TODO 1 复核归档筛选状态流
- 复核归档资产入口与筛选状态函数，确认 `setChatExcerptFilterMode()` 仍只接受 `current / all`，导致 `archived` 被错误回退到 `current`。

#### 单任务复盘
- 新问题：UI 已有“已归档”筛选和底部归档入口，但状态层没有真正支持该值，这属于实质性功能缺陷。
- 边界条件：本轮只修状态流，不重做 UI。

### TODO 2 修复筛选状态函数
- 将 `setChatExcerptFilterMode()` 改为接受 `current / all / archived` 三种模式，与状态归一化和筛选逻辑保持一致。

#### 单任务复盘
- 新问题：这类 bug 隐蔽性高，因为 UI 看起来已经齐全，但点进去行为不对。
- 遗漏补齐：修复后需要最小回归确认脚本和结构断言仍然通过。

### TODO 3 回归与收口
- 执行语法检查与静态断言，补齐本轮文档，之后提交推送。

#### 单任务复盘
- 本轮为定点修复，优先确保问题真正闭环，不额外引入新变化。
