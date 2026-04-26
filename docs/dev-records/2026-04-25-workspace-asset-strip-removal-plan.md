# 2026-04-25 底部最近资产组件移除计划

## 目标
移除工作台页面底部的 `workspace-asset-strip`（“最近资产”组件），避免用户页面底端继续出现额外信息块。

## 范围
- `public\index.html`
- `public\js\app.js`
- `public\css\style.css`
- `test-page-markup.js`
- `test-ui-flow-smoke.js`
- 如有必要，`test-workspace-resume-card-ui.js`

## 假设
- 用户当前明确不希望页面底端再出现“最近资产”组件。
- 本轮只移除工作台底部展示层，不清理聊天资产的底层数据结构与管理能力。
- 如果“最近资产”的交互仍有价值，应保留在聊天相关区域或后续单独设计，而不是挂在页面底端。

## 风险
- `workspace-asset-strip` 的事件分支和渲染逻辑较多，若漏删会留下死引用。
- 若其它测试仍要求该结构存在，需要同步更新契约。
- 如果后续团队仍想保留资产复用入口，需要再为它找新的安置位置。

## TODO
1. 复核底部最近资产组件的结构、渲染函数和事件分支，确认最小移除范围。
2. 删除工作台 HTML 中的 `workspace-asset-strip` 结构。
3. 清理 `app.js` 中 `renderWorkspaceAssetStrip()` 调用、函数和仅服务于该底部条的事件分支。
4. 清理无用 CSS，并同步更新相关测试。
5. 运行聚焦验证与前端回归。
6. 回写执行记录、验证结果与复盘。

## 完成标准
- 工作台页面底端不再出现“最近资产”组件。
- `public\index.html` 不再包含 `workspace-asset-strip` 结构。
- `app.js` 不再保留仅服务于底部最近资产条的渲染和点击处理。
- 相关测试通过。

## 验证方式
- `node test-page-markup.js`
- `npm run test:frontend`
- `node test-ui-flow-smoke.js --port 18871 --launch-server`

## 执行记录
- 2026-04-25：已确认当前页面底端组件为 `workspace-asset-strip`，不是已退役的 `workspace-resume-card`。
- TODO 1 已完成。
- TODO 2 已完成。
  - 已删除工作台 HTML 中的 `workspace-asset-strip` 结构。
- TODO 3 已完成。
  - 已删除 `app.js` 中仅服务底部最近资产条的点击分支：
    - `data-workspace-asset-apply`
    - `data-workspace-asset-copy`
    - `data-workspace-asset-jump`
    - `data-workspace-asset-open-archived`
  - 已将 `renderWorkspaceAssetStrip()` 收口为 no-op 兼容层，避免额外波及其它状态逻辑。
- TODO 4 已完成。
  - 已清理 `public\css\style.css` 中底部最近资产条相关样式。
  - 已更新 `test-page-markup.js`、`test-ui-flow-smoke.js`、`test-workspace-resume-card-ui.js`。
- TODO 5 已完成。
  - 已运行聚焦验证、前端回归与浏览器 smoke。
- TODO 6 已完成。

## TODO 1 复盘
- 新问题：
  - 上一轮只清掉了 resume 壳，仍保留了底部资产条，这与当前用户预期不一致。
- 边界条件：
  - 不清理底层聊天资产数据，先只移除前台底部展示。
- 遗漏点：暂无。
- 是否回写规划：已回写，继续按 TODO 推进。

## TODO 2 复盘
- 新问题：无。
- 边界条件：
  - 只删除页面底部结构，不清理底层聊天资产数据。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 3 复盘
- 新问题：无。
- 边界条件：
  - 为了最小改动，保留 `renderWorkspaceAssetStrip()` 兼容函数，但它不再向页面渲染任何组件。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 4 复盘
- 新问题：无。
- 边界条件：
  - 仅清除底部条专属样式与测试契约，不改聊天资产管理主流程。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 5 复盘
- 新问题：无。
- 边界条件：
  - 本轮验证覆盖静态结构、前端回归与浏览器 smoke。
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
- `node test-ui-flow-smoke.js --port 18871 --launch-server`：通过。

## 复盘
- 新问题：
  - 本轮未发现新的功能级问题。
- 边界条件：
  - 本轮只移除了用户前台页面底部的“最近资产”展示，不清理聊天资产的底层管理能力。
- 遗漏点：
  - `renderWorkspaceAssetStrip()` 当前保留为 no-op 兼容层；如果你后面想进一步做代码洁癖式收尾，可以再开一轮把相关调用一并彻底剔除。
- 是否回写规划：
  - 已完成回写。
