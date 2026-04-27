# 2026-04-27 安全性测试第二十六阶段计划

## 目标
- 继续按插件治理收口顺序推进，在隔离目录内验证 `update` 与 `uninstall` 命令的最小行为。
- 若命中问题，做最小修复并复测；否则形成插件 CLI 主要命令链路已打通的结论。

## 范围
- 插件子工程：
  - `ui-ux-pro-max-0.1.0\cli`
- 验证命令：
  - `node dist\index.js update --ai codex`
  - `node dist\index.js uninstall --ai codex`
- 文档记录：
  - `docs\dev-records`
  - `docs\test\security-testing-report.md`

## 非范围
- 不在主仓库根目录执行这些命令。
- 不继续扩展主仓库安全测试矩阵。
- 不对插件 CLI 做完整端到端功能测试。

## 假设
- 在隔离目录中先执行一次 `init --offline --ai codex`，再测 `update` / `uninstall`，最符合最小主链。
- `update` 可能依赖联网或远端 release 数据；需要先观察其最小成功路径。

## 风险
- `update` 可能受网络状态影响。
- `uninstall` 会删除生成目录，必须严格限制在临时目录内。

## 完成标准
- 已完成 `update` 隔离目录 smoke。
- 已完成 `uninstall` 隔离目录 smoke。
- 若命中问题，完成最小修复并复测。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- 隔离目录内：
  - `node dist\index.js init --offline --ai codex`
  - `node dist\index.js update --ai codex`
  - `node dist\index.js uninstall --ai codex`

## TODO
1. 盘点 `update` 与 `uninstall` 的命令行为和前置条件。
2. 创建隔离目录并先执行 `init --offline --ai codex`。
3. 执行 `update --ai codex`。
4. 检查更新结果。
5. 执行 `uninstall --ai codex`。
6. 检查卸载结果。
7. 若失败，判断是网络问题、路径问题还是代码问题。
8. 若是代码问题，做最小修复并复测。
9. 回写执行记录、验证结果、复盘。
10. 若有代码改动，提交 Git。

## 执行顺序
1. 命令行为盘点。
2. 隔离目录初始化。
3. update smoke。
4. uninstall smoke。
5. 问题归因。
6. 必要修复与复测。
7. 文档回写。
8. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已盘点命令行为：
    - `update` 会先查最新 release，再调用 `initCommand(force: true)`
    - `uninstall` 默认要求交互确认
- 已完成 TODO 2：
  - 已创建隔离目录并执行 `init --offline --ai codex` 作为前置安装。
- 已完成 TODO 3：
  - 已在隔离目录执行 `update --ai codex`。
  - 当前结果：更新链路通过，命令正常完成并重写 `.codex` 安装内容。
- 已完成 TODO 4：
  - 已在隔离目录执行 `uninstall --ai codex`。
  - 通过输入管道自动确认卸载：
    - 目标技能目录卸载前存在
    - 卸载后已删除
- 已完成 TODO 5：
  - 本轮未命中新的运行时问题。
  - 当前可以确认插件 CLI 主要命令链路已验证：
    - `init --offline`
    - `update`
    - `uninstall`
- 已完成 TODO 6：
  - 本轮无需新增代码修复。
- 已完成 TODO 7：
  - 已回写执行记录、验证结果与复盘。
- TODO 10 待执行：
  - 待本轮 Git 提交。

## 验证结果
- 隔离目录安装通过：
  - `node dist\index.js init --offline --ai codex`
- 隔离目录更新通过：
  - `node dist\index.js update --ai codex`
- 隔离目录卸载通过：
  - `node dist\index.js uninstall --ai codex`
- 关键结果检查通过：
  - 卸载前 `SKILL.md` 存在
  - 卸载后 `SKILL.md` 不存在

## 复盘
- 新问题：
  - 本轮没有打出新的 `update` / `uninstall` 运行时问题。
  - 当前插件 CLI 已完成主要命令链路验证。
- 边界条件：
  - 本轮在隔离目录中完成验证，没有污染主仓库。
  - `uninstall` 通过自动输入确认完成，说明最小自动化链路可用。
- 遗漏点：
  - 仍未覆盖全 AI 类型组合，只覆盖 Codex 安装路径。
- 残余风险：
  - 当前残余风险更多在“多平台模板差异”和更复杂交互分支，而不是主命令链路本身。
- 是否回写规划：
  - 是。本轮已回写 update / uninstall smoke 结论。

## 当前结果
- 第二十六阶段已完成：
  - `update` 隔离目录 smoke 通过
  - `uninstall` 隔离目录 smoke 通过
  - 当前插件 CLI 主要命令链路已打通

## 下一阶段建议 TODO
1. 若继续插件治理，可补其他 AI 类型模板路径的抽样 smoke。
2. 若回到主仓库安全主线，可继续更系统化的 `Host / Origin` 组合矩阵。
3. 若准备最终收口，可统一提交本轮命令链路 smoke 结论与总报告更新。
