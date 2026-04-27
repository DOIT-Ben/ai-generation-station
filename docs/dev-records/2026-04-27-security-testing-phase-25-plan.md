# 2026-04-27 安全性测试第二十五阶段计划

## 目标
- 继续按治理收口顺序推进，在隔离目录内对 `ui-ux-pro-max-0.1.0\cli` 执行一次写入型 smoke。
- 目标命令为离线安装路径，避免网络因素干扰，并验证它不会在最小成功场景下出现明显运行时问题。

## 范围
- 插件子工程：
  - `ui-ux-pro-max-0.1.0\cli`
- 验证命令：
  - `node dist\index.js init --offline --ai codex`
- 文档记录：
  - `docs\dev-records`
  - `docs\test\security-testing-report.md`

## 非范围
- 不在主仓库根目录执行写入型安装命令。
- 不对插件子工程做全面功能测试。
- 不继续扩展主仓库安全测试矩阵。

## 假设
- `init --offline --ai codex` 是可控的最小写入路径。
- 在隔离目录内执行可以避免污染主仓库工作区。

## 风险
- 命令执行后会生成目录和文件，必须严格限制在临时目录。
- 若安装逻辑依赖额外环境或路径约定，可能打出新的运行时问题。

## 完成标准
- 已在隔离目录内成功执行写入型 smoke，或定位并修复阻塞问题。
- 已检查生成结果是否符合最小预期。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node dist\index.js init --offline --ai codex`
- 隔离目录生成结果检查

## TODO
1. 盘点 `init --offline --ai codex` 的预期输出。
2. 创建隔离目录。
3. 在隔离目录执行写入型 smoke。
4. 检查生成结果。
5. 若失败，判断是环境问题、路径问题还是代码问题。
6. 若是代码问题，做最小修复并复测。
7. 回写执行记录、验证结果、复盘。
8. 若有代码改动，提交 Git。

## 执行顺序
1. 预期输出盘点。
2. 隔离目录执行。
3. 结果检查。
4. 问题归因。
5. 必要修复与复测。
6. 文档回写。
7. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已盘点 `init --offline --ai codex` 的预期输出：
    - `.codex\skills\ui-ux-pro-max\SKILL.md`
    - `.codex\skills\ui-ux-pro-max\data`
    - `.codex\skills\ui-ux-pro-max\scripts`
- 已完成 TODO 2：
  - 已创建隔离目录并执行写入型 smoke：
    - `node dist\index.js init --offline --ai codex`
- 已完成 TODO 3：
  - 已检查生成结果。
  - 当前结果：
    - `.codex` 目录生成成功
    - `SKILL.md` 生成成功
    - `data` 目录生成成功
    - `scripts` 目录生成成功
- 已完成 TODO 4：
  - 本轮未命中运行时写入问题。
  - 当前可以确认该 CLI 在隔离目录中的最小写入型安装链路可用。
- 已完成 TODO 5：
  - 本轮无需新增代码修复。
- 已完成 TODO 6：
  - 已回写执行记录、验证结果与复盘。
- TODO 8 待执行：
  - 待本轮 Git 提交。

## 验证结果
- 写入型 smoke 通过：
  - `node dist\index.js init --offline --ai codex`
- 生成结果检查通过：
  - `.codex\skills\ui-ux-pro-max\SKILL.md`
  - `.codex\skills\ui-ux-pro-max\data`
  - `.codex\skills\ui-ux-pro-max\scripts`

## 复盘
- 新问题：
  - 本轮没有打出新的写入型运行时问题。
  - 当前插件 CLI 已完成从依赖、构建、只读运行到最小写入型安装的完整主链验证。
- 边界条件：
  - 本轮是在隔离目录内验证，不会污染主仓库。
- 遗漏点：
  - 仍未验证 `update`、`uninstall` 这类其他命令链路。
- 残余风险：
  - 当前残余风险主要在更大范围命令覆盖，而不是当前最小主链。
- 是否回写规划：
  - 是。本轮已回写隔离目录 smoke 结论。

## 当前结果
- 第二十五阶段已完成：
  - 插件 CLI 写入型 smoke 通过
  - 当前插件子工程已完成依赖、构建、只读运行、最小写入型安装四层验证

## 下一阶段建议 TODO
1. 若继续插件治理，可补 `update` 与 `uninstall` 的隔离目录 smoke。
2. 若回到主仓库安全主线，可继续更系统化的 `Host / Origin` 组合矩阵。
3. 若准备最终收口，可统一提交本轮写入型 smoke 结论与总报告更新。
