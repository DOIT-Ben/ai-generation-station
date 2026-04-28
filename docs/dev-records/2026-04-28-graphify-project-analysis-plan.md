# 2026-04-28 Graphify 项目分析计划

## 目标
使用 `graphify` 对当前项目进行知识图谱分析，生成可审阅的项目结构、关系图和报告，为 v2.0 第二阶段规划提供项目理解依据。

## 范围
- 按 `graphify` skill 流程检查工具可用性。
- 检测当前项目 corpus 规模和文件类型。
- 根据检测结果决定是否直接执行 graphify，或先收窄分析目录。
- 生成或更新 `graphify-out` 下的图谱产物。
- 阅读输出报告并给出项目分析摘要。
- 回写执行记录、验证结果和复盘。

## 不在范围
- 不修改业务代码。
- 不提交或推送图谱产物。
- 不清理现有 `graphify-out`。
- 不处理 `ui-ux-pro-max-0.1.0` 子项目指针变化。

## 假设
- 用户希望分析当前项目目录 `e:\desktop\AI\02_Agents\lab\AI-Generation-Stations`。
- `graphify-out` 已存在历史产物，本轮可以基于当前目录重新检测并按需更新。
- 如果检测结果超过 `graphify` 的大 corpus 阈值，需要先向用户确认更具体的子目录。

## 风险
- 全项目文件可能超过 200 个，直接跑完整语义抽取会耗时、耗 token，并可能引入过多噪声。
- `graphify-out` 历史产物可能包含旧分析结果，需要根据本轮命令输出区分新旧。
- 项目中存在未跟踪大目录和临时产物，若纳入分析会污染图谱。

## TODO
1. 记录 Graphify 分析计划。
2. 检查 graphify 安装和 Python 解释器。
3. 检测当前项目 corpus。
4. 按检测结果执行 graphify 或向用户确认收窄范围。
5. 读取输出报告并整理分析摘要。
6. 回写执行记录、验证结果和复盘。

## 完成标准
- 已得到 corpus 检测摘要。
- 若规模允许，已生成或更新 `graphify-out\graph.json`、`graphify-out\graph.html`、`graphify-out\GRAPH_REPORT.md`。
- 若规模过大，已给出推荐分析范围并等待用户确认。
- 本记录包含执行记录、验证结果和复盘。

## 验证方式
- 检查 `graphify-out\.graphify_python`。
- 检查 `graphify-out\.graphify_detect.json` 或同等检测输出。
- 检查 `graphify-out\GRAPH_REPORT.md`、`graphify-out\graph.json`、`graphify-out\graph.html` 的更新时间。

## 执行记录
- TODO 1：已创建本计划，完成严格开发模式前置规划。
- TODO 2：已检查 graphify 可用性。
  - Python 解释器：`D:\Soft\python310\python.exe`。
  - 已写入 `graphify-out\.graphify_python`。
- TODO 3：已检测当前项目 corpus。
  - 总文件数：744。
  - 估算词量：1,687,259。
  - code：151 个。
  - document：352 个。
  - image：96 个。
  - video：145 个。
  - 敏感文件跳过：7 个。
  - 文件数超过 `graphify` 阈值 200，需要先收窄范围，暂不执行全量 graphify。
  - Top 5 子目录文件数：`docs` 344、`output` 196、项目根 50、`test-artifacts` 37、`server` 36。

## 验证结果
- `graphify-out\.graphify_python` 已生成。
- `graphify-out\.graphify_detect.json` 已生成。
- 当前项目检测为 744 文件，超过 `graphify` 大 corpus 阈值，需用户确认子目录后继续。

## 复盘
- TODO 1 复盘：本轮只做 graphify 分析，不改业务代码，不提交推送。新问题：需要先检测 corpus 规模，避免对全项目盲目执行高成本分析。边界条件：如果超过阈值，先停下来让用户选目录。
- TODO 2 复盘：graphify import 可用，未触发安装。新问题：无。边界条件：后续命令统一使用 `graphify-out\.graphify_python` 记录的解释器。
- TODO 3 复盘：全项目文件数超过阈值，按 graphify 规则需要先确认子目录。新问题：`output`、`test-artifacts`、视频文件较多，若纳入会让图谱偏向产物和媒体而不是代码架构；归类为范围选择问题。边界条件：未执行语义抽取，未覆盖或更新正式图谱输出。
