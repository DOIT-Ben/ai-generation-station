# 2026-04-28 视觉 Baseline 更新计划

## 目标
在已完成视觉差异 triage 并确认剩余差异主要来自历史 baseline 滞后的前提下，更新当前项目视觉回归基线，并复验 `node test-ui-visual.js --launch-server` 可通过。

## 范围
- 运行视觉回归 baseline 更新命令。
- 更新 `test-artifacts\visual-baseline` 下由视觉脚本管理的 PNG 基线文件。
- 复验视觉回归普通比对命令。
- 回写本记录的执行结果、验证结果和复盘。

## 不在范围
- 不修改业务页面 UI。
- 不继续拆分 `public\js\app.js`。
- 不修改视觉阈值、截图命名或新增截图场景。
- 不清理与本任务无关的既有未提交文件。

## 假设
- 上一轮已修正 `test-ui-visual.js` 的登录入口、登录卡片 selector 和欢迎 toast 稳定化问题。
- 当前截图已经过人工 triage，登录页、聊天卡片、账号安全、管理台和歌词卡片当前视觉状态可接受。
- `--update-baseline` 会用当前截图覆盖对应 baseline，不应改变业务代码。

## 风险
- 如果当前页面存在未发现的视觉问题，更新 baseline 会把问题固化为新基线。
- 浏览器渲染、字体或环境差异可能导致 baseline 更新后仍有微小 diff。
- `test-artifacts\visual-baseline` 会出现多张二进制 PNG 修改，后续审查需要结合当前截图确认。

## TODO
1. 记录视觉 baseline 更新计划。
2. 运行 `node test-ui-visual.js --launch-server --update-baseline`。
3. 复验 `node test-ui-visual.js --launch-server`。
4. 回写执行记录、验证结果和复盘。

## 完成标准
- baseline 更新命令成功完成，并输出各截图 `baseline-updated`。
- 普通视觉回归命令成功完成，并输出 `UI visual regression passed`。
- 本记录包含执行记录、验证结果和复盘。

## 验证方式
- `node test-ui-visual.js --launch-server --update-baseline`
- `node test-ui-visual.js --launch-server`
- 必要时补跑 `node --check test-ui-visual.js`

## 执行记录
- TODO 1：已创建本计划，完成严格开发模式前置规划。
- TODO 2：已运行 `node test-ui-visual.js --launch-server --update-baseline`。
  - 输出 `auth-portal-card: baseline-updated`。
  - 输出 `utility-cluster-authenticated: baseline-updated`。
  - 输出 `account-center-security: baseline-updated`。
  - 输出 `admin-console: baseline-updated`。
  - 输出 `chat-card-dark: baseline-updated`。
  - 输出 `chat-card-light: baseline-updated`。
  - 输出 `lyrics-card-light: baseline-updated`。
  - 最终输出 `UI visual baselines updated`。
  - 同时出现 Node.js SQLite experimental warning，属于既有环境提示，不影响命令成功。
- TODO 3：已运行 `node test-ui-visual.js --launch-server`。
  - 输出 `auth-portal-card: 0 px`。
  - 输出 `utility-cluster-authenticated: 0 px`。
  - 输出 `account-center-security: 0 px`。
  - 输出 `admin-console: 0 px`。
  - 输出 `chat-card-dark: 0 px`。
  - 输出 `chat-card-light: 0 px`。
  - 输出 `lyrics-card-light: 0 px`。
  - 最终输出 `UI visual regression passed`。
  - 同时出现 Node.js SQLite experimental warning，属于既有环境提示，不影响命令成功。
- TODO 4：已检查变更清单和 baseline 文件时间。
  - `test-artifacts\visual-baseline` 下 7 个 PNG 的更新时间均为 2026-04-28 10:13。
  - `test-artifacts\visual-diff` 当前无残留 diff PNG。
  - `git status --short` 仍显示本轮前已存在的若干未提交项；未做回退或清理。
  - 完成前复核 `node --check test-ui-visual.js`：通过，命令无输出且退出码为 0。
  - 完成前复核 `git ls-files test-artifacts\visual-baseline`：无输出，说明当前 baseline PNG 未被 Git 跟踪。

## 验证结果
- `node test-ui-visual.js --launch-server --update-baseline`：通过，7 个截图 baseline 均已更新。
- `node test-ui-visual.js --launch-server`：通过，7 个截图 diff 均为 `0 px`，输出 `UI visual regression passed`。
- `node --check test-ui-visual.js`：通过，命令无输出且退出码为 0。

## 复盘
- TODO 1 复盘：本轮范围限定为视觉 baseline 更新和复验，不扩大到业务页面或阈值调整。新问题：无。边界条件：只有在更新命令和普通复验都通过后，才可认为视觉回归恢复可用。
- TODO 2 复盘：baseline 已由当前截图覆盖，符合用户确认后的更新目标。新问题：仍需普通比对复验确认更新后的基线可被当前环境稳定通过；归类为当前必修，下一步执行 TODO 3。边界条件：不因 baseline 更新成功就跳过复验。
- TODO 3 复盘：普通视觉回归已通过，说明更新后的 baseline 与当前环境一致。新问题：无。边界条件：本轮未额外运行完整 release browser，只恢复当前视觉脚本的普通通过状态。
- TODO 4 复盘：执行记录、验证结果和复盘已回写。新问题：`test-artifacts\visual-baseline` 可能被仓库忽略，`git status --short` 未列出这些 PNG；如果后续需要提交基线，需要用仓库规则确认 artifact 跟踪策略。边界条件：不改 `.gitignore`，不清理既有未提交项。
