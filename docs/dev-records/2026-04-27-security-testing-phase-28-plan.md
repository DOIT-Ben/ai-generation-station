# 2026-04-27 安全性测试第二十八阶段计划

## 目标
- 继续按插件治理收口顺序推进，补一个目录结构差异更大的平台抽样 smoke。
- 本轮优先验证：
  - `copilot`
  - `droid`

## 范围
- 插件子工程：
  - `ui-ux-pro-max-0.1.0\cli`
- 验证命令：
  - `node dist\index.js init --offline --ai copilot`
  - `node dist\index.js init --offline --ai droid`
- 文档记录：
  - `docs\dev-records`
  - `docs\test\security-testing-report.md`

## 非范围
- 不做全平台穷举。
- 不继续扩展主仓库安全测试矩阵。
- 不在主仓库根目录执行写入型命令。

## 假设
- `copilot` 与 `droid` 的目录结构更特殊，抽样价值高于继续重复同类平台。

## 风险
- 若平台模板配置本身和安装器假设不一致，可能只在这些特殊目录结构上暴露。

## 完成标准
- 已完成 `copilot` 隔离目录 smoke。
- 已完成 `droid` 隔离目录 smoke。
- 已检查生成结果是否符合各自目录结构预期。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- 隔离目录内：
  - `node dist\index.js init --offline --ai copilot`
  - `node dist\index.js init --offline --ai droid`

## TODO
1. 盘点 `copilot` 与 `droid` 的预期目录结构。
2. 执行 `copilot` 平台隔离 smoke。
3. 检查 `copilot` 生成结果。
4. 执行 `droid` 平台隔离 smoke。
5. 检查 `droid` 生成结果。
6. 若失败，判断是模板配置问题还是安装逻辑问题。
7. 若是代码问题，做最小修复并复测。
8. 回写执行记录、验证结果、复盘。
9. 若有代码改动，提交 Git。

## 执行顺序
1. 平台结构盘点。
2. `copilot` smoke。
3. `droid` smoke。
4. 结果检查。
5. 问题归因。
6. 必要修复与复测。
7. 文档回写。
8. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已盘点 `copilot` 与 `droid` 的预期目录结构：
    - `copilot` -> `.github\prompts\ui-ux-pro-max\PROMPT.md`
    - `droid` -> `.factory\skills\ui-ux-pro-max\SKILL.md`
  - 两者都应包含 `data` 与 `scripts`。
- 已完成 TODO 2：
  - 已在隔离目录执行 `copilot` 平台 smoke：
    - `node dist\index.js init --offline --ai copilot`
- 已完成 TODO 3：
  - 已检查 `copilot` 生成结果：
    - `.github\prompts\ui-ux-pro-max\PROMPT.md` 生成成功
    - `data` 目录生成成功
    - `scripts` 目录生成成功
- 已完成 TODO 4：
  - 已在隔离目录执行 `droid` 平台 smoke：
    - `node dist\index.js init --offline --ai droid`
- 已完成 TODO 5：
  - 已检查 `droid` 生成结果：
    - `.factory\skills\ui-ux-pro-max\SKILL.md` 生成成功
    - `data` 目录生成成功
    - `scripts` 目录生成成功
- 已完成 TODO 6：
  - 本轮未命中模板配置问题或安装逻辑问题。
  - 当前可以确认，更特殊目录结构的平台路径也能正常工作。
- 已完成 TODO 7：
  - 本轮无需新增代码修复。
- 已完成 TODO 8：
  - 已回写执行记录、验证结果与复盘。
- TODO 9 待执行：
  - 待本轮 Git 提交。

## 验证结果
- `copilot` 平台隔离 smoke 通过：
  - `node dist\index.js init --offline --ai copilot`
- `droid` 平台隔离 smoke 通过：
  - `node dist\index.js init --offline --ai droid`
- 结果检查通过：
  - `.github\prompts\ui-ux-pro-max\PROMPT.md`
  - `.factory\skills\ui-ux-pro-max\SKILL.md`
  - 两者均包含 `data` 与 `scripts`

## 复盘
- 新问题：
  - 本轮没有打出新的特殊目录结构平台问题。
  - 当前插件 CLI 的模板生成链路已在多类结构路径上验证通过。
- 边界条件：
  - 本轮仍然是抽样验证，不是全平台穷举。
- 遗漏点：
  - 仍未覆盖全部平台，但高价值结构差异样本已明显增加。
- 残余风险：
  - 当前残余风险主要在未抽样平台和更复杂交互分支，而不是核心模板生成链路。
- 是否回写规划：
  - 是。本轮已回写特殊平台抽样 smoke 结论。

## 当前结果
- 第二十八阶段已完成：
  - `copilot` 抽样 smoke 通过
  - `droid` 抽样 smoke 通过
  - 当前多类平台目录结构都已验证通过

## 下一阶段建议 TODO
1. 若继续插件治理，可收口为“多平台抽样验证完成”的最终总结。
2. 若回到主仓库安全主线，可继续更系统化的 `Host / Origin` 组合矩阵。
3. 若准备最终收口，可统一提交本轮特殊平台抽样结论与总报告更新。
