# 2026-04-27 安全性测试第二十七阶段计划

## 目标
- 继续按插件治理收口顺序推进，对非 Codex 平台模板做抽样隔离目录 smoke。
- 目标是验证不同平台的目录结构和模板生成逻辑没有只在 Codex 路径上成立。

## 范围
- 插件子工程：
  - `ui-ux-pro-max-0.1.0\cli`
- 验证命令：
  - `node dist\index.js init --offline --ai <platform>`
- 文档记录：
  - `docs\dev-records`
  - `docs\test\security-testing-report.md`

## 非范围
- 不做全平台穷举验证。
- 不继续扩展主仓库安全测试矩阵。
- 不在主仓库根目录执行写入型安装命令。

## 假设
- 抽样两个结构差异较大的平台即可覆盖高价值模板路径差异。
- 本轮优先选择：
  - `claude`
  - `continue`

## 风险
- 平台目录结构不同，检查标准必须事先明确，避免误判。
- 若模板配置本身有路径错误，可能只在非 Codex 平台暴露。

## 完成标准
- 已完成至少两个非 Codex 平台的隔离目录 smoke。
- 已检查生成结果是否符合各自目录结构预期。
- 若命中问题，完成最小修复并复测。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- 隔离目录内：
  - `node dist\index.js init --offline --ai claude`
  - `node dist\index.js init --offline --ai continue`

## TODO
1. 盘点候选平台及各自预期目录结构。
2. 创建隔离目录并执行 `claude` 平台 smoke。
3. 检查 `claude` 平台生成结果。
4. 创建隔离目录并执行 `continue` 平台 smoke。
5. 检查 `continue` 平台生成结果。
6. 若失败，判断是模板配置问题还是安装逻辑问题。
7. 若是代码问题，做最小修复并复测。
8. 回写执行记录、验证结果、复盘。
9. 若有代码改动，提交 Git。

## 执行顺序
1. 平台与目录结构盘点。
2. `claude` smoke。
3. `continue` smoke。
4. 结果检查。
5. 问题归因。
6. 必要修复与复测。
7. 文档回写。
8. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已盘点候选平台及预期目录结构：
    - `claude` -> `.claude\skills\ui-ux-pro-max\SKILL.md`
    - `continue` -> `.continue\skills\ui-ux-pro-max\SKILL.md`
  - 两者都应包含 `data` 与 `scripts` 目录。
- 已完成 TODO 2：
  - 已创建隔离目录并执行 `claude` 平台 smoke：
    - `node dist\index.js init --offline --ai claude`
- 已完成 TODO 3：
  - 已检查 `claude` 平台生成结果：
    - `.claude` 目录生成成功
    - `SKILL.md` 生成成功
    - `data` 目录生成成功
    - `scripts` 目录生成成功
- 已完成 TODO 4：
  - 已创建隔离目录并执行 `continue` 平台 smoke：
    - `node dist\index.js init --offline --ai continue`
- 已完成 TODO 5：
  - 已检查 `continue` 平台生成结果：
    - `.continue` 目录生成成功
    - `SKILL.md` 生成成功
    - `data` 目录生成成功
    - `scripts` 目录生成成功
- 已完成 TODO 6：
  - 本轮未命中平台模板配置问题或安装逻辑问题。
  - 当前可以确认，模板生成逻辑不仅在 Codex 路径成立，也在 Claude 与 Continue 路径成立。
- 已完成 TODO 7：
  - 本轮无需新增代码修复。
- 已完成 TODO 8：
  - 已回写执行记录、验证结果与复盘。
- TODO 9 待执行：
  - 待本轮 Git 提交。

## 验证结果
- `claude` 平台隔离 smoke 通过：
  - `node dist\index.js init --offline --ai claude`
- `continue` 平台隔离 smoke 通过：
  - `node dist\index.js init --offline --ai continue`
- 结果检查通过：
  - `.claude\skills\ui-ux-pro-max\SKILL.md`
  - `.continue\skills\ui-ux-pro-max\SKILL.md`
  - 两者均包含 `data` 与 `scripts`

## 复盘
- 新问题：
  - 本轮没有打出新的平台模板问题。
  - 当前插件 CLI 的模板生成链路已在至少 3 条平台路径上验证通过：
    - `codex`
    - `claude`
    - `continue`
- 边界条件：
  - 本轮仍然是抽样验证，不是全平台穷举。
- 遗漏点：
  - 仍未覆盖更多平台如 `cursor`、`windsurf`、`copilot` 的抽样安装。
- 残余风险：
  - 当前残余风险主要在未抽样的平台差异，而不是核心模板生成链路本身。
- 是否回写规划：
  - 是。本轮已回写平台抽样 smoke 结论。

## 当前结果
- 第二十七阶段已完成：
  - `claude` 抽样 smoke 通过
  - `continue` 抽样 smoke 通过
  - 当前模板生成链路已在多平台抽样下验证通过

## 下一阶段建议 TODO
1. 若继续插件治理，可再补一个目录结构不同的平台抽样 smoke，例如 `copilot` 或 `droid`。
2. 若回到主仓库安全主线，可继续更系统化的 `Host / Origin` 组合矩阵。
3. 若准备最终收口，可统一提交本轮多平台抽样结论与总报告更新。
