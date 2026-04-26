# 2026-04-25 workspace-resume-card 残留结构清理计划

## 目标
把前台已经不再使用的 `workspace-resume-card` 做真正的最小清理：移除工作台 HTML 残留结构、删掉无效渲染分支和无用交互引用，保留仍在使用的 `workspace-asset-strip` 能力。

## 范围
- `public\index.html`
- `public\js\app.js`
- `public\css\style.css`
- `test-page-markup.js`
- `test-workspace-resume-card-ui.js`
- 如有必要，`test-ui-flow-smoke.js`

## 假设
- 当前真正需要保留的是 `workspace-asset-strip`，不是 `workspace-resume-card` 外层壳。
- `workspace-resume-card` 相关按钮、文案、显示逻辑都已失去用户价值，可以删除。
- 本轮只做结构清理，不改工作台草稿持久化和资产复用逻辑。

## 风险
- `workspace-asset-strip` 目前嵌在 `workspace-resume-card` 内，清理时需要先安全上提，避免连带删除。
- `app.js` 中可能有多个 `renderWorkspaceResumeCard()` 调用和按钮事件分支，若漏删会留下死引用。
- 旧测试仍可能要求该结构存在，需要同步修正契约。

## TODO
1. 复核 `workspace-resume-card` 与 `workspace-asset-strip` 的结构依赖和脚本引用。
2. 调整工作台 HTML，删除 `workspace-resume-card`，保留并上提 `workspace-asset-strip`。
3. 清理 `app.js` 中无效的 `workspace-resume-card` 渲染与交互残留。
4. 清理无用 CSS，并更新相关测试契约。
5. 运行聚焦验证与前端回归。
6. 回写执行记录、验证结果与复盘。

## 完成标准
- 前台页面不再包含 `workspace-resume-card` 结构和相关文案。
- `workspace-asset-strip` 仍能被脚本正常渲染和使用。
- `app.js` 不再保留无意义的 `renderWorkspaceResumeCard()` 占位逻辑或 `workspace-clear-draft` 死引用。
- 相关测试通过。

## 验证方式
- `node test-workspace-resume-card-ui.js`
- `node test-page-markup.js`
- `npm run test:frontend`
- `node test-ui-flow-smoke.js --port 18851 --launch-server`

## 执行记录
- 2026-04-25：已确认当前残留状态。
  - `public\index.html` 仍保留 `workspace-resume-card` 外层和旧文案。
  - `workspace-asset-strip` 仍嵌套在该外层内部。
  - `public\js\app.js` 仍保留 `renderWorkspaceResumeCard()` 和多处调用。
  - 事件分支中仍存在 `#workspace-clear-draft` 引用。
- TODO 1 已完成。
- TODO 2 已完成。
  - 已删除工作台底部 `workspace-resume-card` 外层、旧文案和 `workspace-clear-draft` 按钮。
  - 已将 `workspace-asset-strip` 上提为独立 section，继续保留在主内容底部。
- TODO 3 已完成。
  - 已将 `app.js` 中原有 `renderWorkspaceResumeCard();` 调用统一替换为 `renderWorkspaceAssetStrip();`。
  - 已删除 `renderWorkspaceResumeCard()` 占位函数。
  - 已删除 `#workspace-clear-draft` 事件分支和 `clearCurrentWorkspaceDraft()` 死函数。
- TODO 4 已完成。
  - 已清理 `workspace-resume-strip` 相关旧 CSS。
  - 已将 `workspace-asset-strip` 调整为独立容器样式。
  - 已同步更新 `test-page-markup.js`、`test-workspace-resume-card-ui.js`、`test-ui-flow-smoke.js`。
- TODO 5 已完成。
  - 已运行聚焦验证、前端回归与浏览器 smoke。
- TODO 6 已完成。

## TODO 1 复盘
- 新问题：
  - 本轮真正要保护的是 `workspace-asset-strip`，不能直接整体删掉底部区块。
- 边界条件：
  - 不清理工作台状态保存逻辑，不影响资产复用。
- 遗漏点：暂无。
- 是否回写规划：已回写，继续按 TODO 推进。

## TODO 2 复盘
- 新问题：无。
- 边界条件：
  - 只删已退役的外层壳和文案，不动资产条本体。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 3 复盘
- 新问题：无。
- 边界条件：
  - 调用替换只做名称收口，不改业务判断顺序。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 4 复盘
- 新问题：无。
- 边界条件：
  - 样式调整只围绕独立后的资产条，不额外改其它卡片系统。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 5 复盘
- 新问题：无。
- 边界条件：
  - 本轮验证覆盖静态结构、前端聚合和浏览器 smoke，未额外刷新 visual 基线。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 6 复盘
- 新问题：无。
- 边界条件：
  - 文档已按要求落在当前项目 `docs\dev-records`。
- 遗漏点：无。
- 是否回写规划：已完成。

## 验证结果
- `node test-workspace-resume-card-ui.js`：通过。
- `node test-page-markup.js`：通过。
- `npm run test:frontend`：通过。
- `node test-ui-flow-smoke.js --port 18851 --launch-server`：通过。

## 复盘
- 新问题：
  - 本轮未发现新的功能级问题。
- 边界条件：
  - 本轮只做退役结构清理，没有触碰工作台状态保存与最近资产生成逻辑。
- 遗漏点：
  - 视觉基线未刷新；如果你还要继续做工作台底部视觉收口，可以再补一轮 visual。
- 是否回写规划：
  - 已完成回写。
