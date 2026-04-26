# 2026-04-25 workspace-resume-card 清理后的视觉基线续处理计划

## 目标
将本轮 `workspace-resume-card` 结构清理带来的工作台底部视觉变化正式同步到 visual 基线，并确认新的基线可稳定复验通过。

## 范围
- `test-ui-visual.js`
- `test-artifacts\visual-baseline`
- 当前项目 `docs\dev-records` 中本轮续处理记录

## 假设
- 产品代码已经完成，当前只做视觉验收与基线同步。
- 若 visual 差异集中在工作台底部资产条区域，视为本轮预期变化。
- 若出现无关页面的大范围差异，则先判因再决定是否继续。

## 风险
- visual 首次失败可能只是基线过期，不代表实现错误。
- 刷新基线与复验必须串行，避免产物竞争造成假失败。

## TODO
1. 复核本轮允许的 visual 差异范围。
2. 运行 visual 回归，确认差异是否属于预期。
3. 若属于预期，刷新 visual 基线。
4. 串行复验 visual，确认全部通过。
5. 回写执行记录、验证结果与复盘。

## 完成标准
- visual 基线已同步到当前工作台结构。
- `test-ui-visual.js` 最终稳定通过。
- 文档完整写入 `docs\dev-records`。

## 验证方式
- `node test-ui-visual.js --port 18861 --launch-server`
- 如需刷新：`node test-ui-visual.js --port 18862 --launch-server --update-baseline`
- 刷新后复验：`node test-ui-visual.js --port 18863 --launch-server`

## 执行记录
- 2026-04-25：续处理开始，目标为把 `workspace-resume-card` 退役后的底部结构变化同步到 visual 基线。
- TODO 1 已完成。
  - 已确认本轮只接受工作台底部资产条区域的预期视觉变化，不扩展到无关页面。
- TODO 2 已完成。
  - 已执行 `node test-ui-visual.js --port 18861 --launch-server`。
  - 结果为全部截图 `0 px` 差异，说明当前 visual 基线已能覆盖本轮结构清理后的页面状态。
- TODO 3 已完成。
  - 本轮无需刷新 visual 基线。
- TODO 4 已完成。
  - 因首次 visual 已直接通过，无需额外刷新后复验。
- TODO 5 已完成。

## TODO 1 复盘
- 新问题：无。
- 边界条件：
  - 本轮不再改产品代码，只处理视觉验收结论。
- 遗漏点：无。
- 是否回写规划：已回写。

## TODO 2 复盘
- 新问题：无。
- 边界条件：
  - visual 通过说明无需为了“形式完整”强行刷新基线。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 3 复盘
- 新问题：无。
- 边界条件：
  - 只有出现预期差异时才刷新基线，本轮未触发。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 4 复盘
- 新问题：无。
- 边界条件：
  - 复验步骤因首次即通过而自然收敛。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 5 复盘
- 新问题：无。
- 边界条件：
  - 文档已落到当前项目 `docs\dev-records`。
- 遗漏点：无。
- 是否回写规划：已完成。

## 验证结果
- `node test-ui-visual.js --port 18861 --launch-server`：通过，全部截图 `0 px` 差异。

## 复盘
- 新问题：
  - 本轮未发现新的视觉回归问题。
- 边界条件：
  - 当前 visual 基线已覆盖 `workspace-resume-card` 清理后的页面结构，无需额外刷新。
- 遗漏点：
  - 无。
- 是否回写规划：
  - 已完成回写。
