# 2026-04-25 workspace-asset-strip 死代码清理计划

## 目标
清理 `workspace-asset-strip` 退役后遗留的空转代码，包括 no-op 的 `renderWorkspaceAssetStrip()`、残余调用，以及只为该底部条服务过的死函数和过时测试契约。

## 范围
- `public\js\app.js`
- `test-page-markup.js`
- `test-workspace-resume-card-ui.js`
- 当前项目 `docs\dev-records`

## 假设
- 底部最近资产组件已经完成前台移除，本轮只做代码层面的残余清理。
- 若某个函数只被底部资产条使用，且当前已无其它入口引用，则可以删除。
- 本轮不重构聊天资产系统本身，只删除已无用户入口且无调用方的死代码。

## 风险
- `renderWorkspaceAssetStrip();` 调用点很多，批量清理时需要避免误删相邻逻辑。
- 如果某些资产函数未来还被其它入口复用，误删会造成隐藏回归。
- 测试契约需要同步从“保留 no-op 兼容层”转为“彻底移除残留”。

## TODO
1. 复核 `workspace-asset-strip` 残余调用和仅服务底部条的死函数，确认可删范围。
2. 删除 `app.js` 中 `renderWorkspaceAssetStrip()` 的所有调用和函数定义。
3. 删除仅服务底部条且已无引用的死函数。
4. 更新相关测试契约。
5. 运行聚焦验证与前端回归。
6. 回写执行记录、验证结果与复盘。

## 完成标准
- `app.js` 不再包含 `renderWorkspaceAssetStrip()`。
- `app.js` 不再包含只服务底部资产条且无入口的死函数。
- 相关测试通过。

## 验证方式
- `node test-workspace-resume-card-ui.js`
- `node test-page-markup.js`
- `npm run test:frontend`

## 执行记录
- 2026-04-25：已确认当前残留包括：
  - `renderWorkspaceAssetStrip()` no-op 函数。
  - 多处 `renderWorkspaceAssetStrip();` 空转调用。
  - `applyChatAssetToCurrentWorkspace()` 与 `openArchivedChatAssetsPanel()` 当前仅剩定义，无前台入口触发。
- TODO 1 已完成。
- TODO 2 已完成。
  - 已删除 `app.js` 中所有 `renderWorkspaceAssetStrip();` 空转调用。
  - 已删除 `renderWorkspaceAssetStrip()` 函数定义。
- TODO 3 已完成。
  - 已删除 `applyChatAssetToCurrentWorkspace()` 死函数。
  - 已删除 `openArchivedChatAssetsPanel()` 死函数。
- TODO 4 已完成。
  - 已更新 `test-workspace-resume-card-ui.js` 与 `test-page-markup.js`，从“允许保留兼容层”改为“必须彻底移除残留”。
- TODO 5 已完成。
  - 已运行聚焦验证、前端回归与浏览器 smoke。
- TODO 6 已完成。

## TODO 1 复盘
- 新问题：
  - 上一轮为了稳妥保留了兼容层，这一轮需要把测试和代码同时收口。
- 边界条件：
  - 不动聊天资产主数据结构，不扩展到 chat excerpt shelf 主流程。
- 遗漏点：暂无。
- 是否回写规划：已回写，继续按 TODO 推进。

## TODO 2 复盘
- 新问题：无。
- 边界条件：
  - 调用清理只删除空转调用，不改相邻业务逻辑分支。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 3 复盘
- 新问题：无。
- 边界条件：
  - 只删无引用的底部条专属死函数，不清理 chat excerpt shelf 的主能力。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 4 复盘
- 新问题：无。
- 边界条件：
  - 测试契约已和当前产品状态保持一致，不再接受兼容层残留。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 5 复盘
- 新问题：无。
- 边界条件：
  - 本轮验证包含静态、前端聚合和浏览器 smoke。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 6 复盘
- 新问题：无。
- 边界条件：
  - 文档已按要求回写到当前项目 `docs\dev-records`。
- 遗漏点：无。
- 是否回写规划：已完成。

## 验证结果
- `node test-workspace-resume-card-ui.js`：通过。
- `node test-page-markup.js`：通过。
- `npm run test:frontend`：通过。
- `node test-ui-flow-smoke.js --port 18872 --launch-server`：通过。

## 复盘
- 新问题：
  - 本轮未发现新的功能级问题。
- 边界条件：
  - 本轮只做底部资产条退役后的死代码清理，没有扩展到聊天资产系统重构。
- 遗漏点：
  - 无。
- 是否回写规划：
  - 已完成回写。
