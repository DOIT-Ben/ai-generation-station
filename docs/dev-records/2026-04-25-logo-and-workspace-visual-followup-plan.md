# 2026-04-25 导航品牌与工作台视觉验收续处理计划

## 目标
对刚完成的导航品牌压缩与 `workspace-resume-card` 隐藏进行浏览器级视觉验收，确认页面真实观感已改善，并在确认属于预期变化后同步刷新视觉基线。

## 范围
- `test-ui-flow-smoke.js`
- `test-ui-visual.js`
- `test-artifacts\visual-baseline` 下与本轮变更相关的基线图片
- 当前项目 `docs\dev-records` 中的执行记录

## 假设
- 本轮代码主修改已完成，续处理重点是视觉验收与基线对齐，不新增功能。
- 如果 `test-ui-visual.js` 失败且差异仅来自本轮 logo 或底部组件消失，则可刷新基线。
- 若发现额外非预期视觉漂移，则先记录并评估，再决定是否继续改代码。

## 风险
- 视觉回归可能因基线过期失败，而不是因为当前实现有 bug。
- 浏览器截图存在端口占用或环境波动，需要串行运行。
- 刷新基线若判断失误，可能把非预期变化一并固化。

## TODO
1. 复核当前视觉验收脚本与本轮变更范围，明确本轮只接受哪些差异。
2. 运行浏览器 smoke 验证，确认工作台能正常打开且没有明显结构异常。
3. 运行视觉回归；若失败，检查差异是否仅来自本轮预期变更。
4. 若差异属于预期，刷新视觉基线并复跑视觉回归。
5. 回写验证结果、执行记录与复盘。

## 完成标准
- 浏览器 smoke 通过。
- 视觉回归最终通过。
- 如果刷新了视觉基线，有明确记录说明原因和范围。
- 文档完整回写到 `docs\dev-records`。

## 验证方式
- `node test-ui-flow-smoke.js --port 18831 --launch-server`
- `node test-ui-visual.js --port 18832 --launch-server`
- 如需刷新：`node test-ui-visual.js --port 18833 --launch-server --update-baseline`
- 刷新后复验：`node test-ui-visual.js --port 18834 --launch-server`

## 执行记录
- 2026-04-25：续处理开始，目的为补齐浏览器级视觉验收，避免只靠静态契约判断 UI 已经足够自然。
- TODO 1 已完成。
  - 已复核 `test-ui-flow-smoke.js` 与 `test-ui-visual.js`。
  - 已确认本轮允许的视觉差异主要来自两处：品牌字标压缩、`workspace-resume-card` 隐藏带来的工作台底部变化。
- TODO 2 已完成。
  - 首次执行 `node test-ui-flow-smoke.js --port 18831 --launch-server` 失败。
  - 失败原因不是产品异常，而是 smoke 仍沿用旧假设，要求 `workspace-resume-card` 参与可见性续接断言。
  - 已将 smoke 脚本同步到当前产品行为：组件默认隐藏，续接只验证状态恢复本身。
  - 修改后复跑 `node test-ui-flow-smoke.js --port 18831 --launch-server` 通过。
- TODO 3 已完成。
  - 首次执行 `node test-ui-visual.js --port 18832 --launch-server` 失败，差异集中在 `admin-console`。
  - 已对比 `visual-current`、`visual-baseline`、`visual-diff`，确认差异主要来自左上品牌字标区域，属于本轮预期变化，不是布局损坏。
- TODO 4 已完成。
  - 已执行 `node test-ui-visual.js --port 18833 --launch-server --update-baseline` 刷新视觉基线。
  - 已执行 `node test-ui-visual.js --port 18834 --launch-server` 复验，全部截图 `0 px` 差异，通过。
- TODO 5 已完成。

## 验证结果
- `node test-ui-flow-smoke.js --port 18831 --launch-server`：首次失败，修正 smoke 旧断言后通过。
- `node test-ui-visual.js --port 18832 --launch-server`：首次失败，差异为预期内品牌变化。
- `node test-ui-visual.js --port 18833 --launch-server --update-baseline`：已刷新视觉基线。
- `node test-ui-visual.js --port 18834 --launch-server`：通过，全部截图 `0 px` 差异。
- `node test-brand-title-typography.js`：通过。
- `node test-workspace-resume-card-ui.js`：通过。

## 复盘
- 新问题：
  - 浏览器 smoke 覆盖里仍残留了旧产品假设，说明 UI 行为调整后，除了静态契约，还需要同步检查浏览器级验收脚本。
- 边界条件：
  - 本轮没有继续修改产品 UI，只修正了与当前产品行为冲突的 smoke 脚本，并刷新了预期内的视觉基线。
- 遗漏点：
  - 本轮未新增移动端截图验收，仍以当前桌面 visual 覆盖为准。
- 是否回写规划：
  - 已完成回写。
