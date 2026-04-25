# UI 自动验收 Skill 最小落地方案

## 目标
- 为当前项目落地一个最小可用的 Playwright 验收 skill 方案。
- 在不扩大改动面的前提下，完成：
  - skill 安装
  - 与当前项目 UI 验收命令的衔接
  - 对之前未完成的浏览器级验收再做一次尝试

## 范围
- 仅处理 skill 安装与验收衔接。
- 不修改业务代码。
- 不引入与当前 UI 验收无关的额外工作流。

## 假设
- 选型结果沿用上一轮结论：优先 `lackeyjb/playwright-skill`。
- 本轮只做“最小落地”，不追求完整集成一整套新平台能力。

## 风险
- 安装 GitHub skill 仍依赖网络与本地权限。
- 即使安装成功，若本地浏览器权限限制仍在，验收脚本依然可能被 `spawn EPERM` 阻断。
- 外部 skill 的目录结构若与预期不同，可能需要临时调整安装路径。

## TODO
1. 查清目标 skill 的实际安装结构和使用说明。
2. 形成当前项目的最小落地方案。
3. 安装 skill。
4. 使用现有 UI 验收命令再次尝试补跑之前未完成的浏览器级验收。
5. 回写执行记录、验证结果与复盘。

## 最小落地方案
- 安装目标：
  - `lackeyjb/playwright-skill`
- 最小原则：
  - 只安装该 skill 本体
  - 不同步引入其他浏览器代理框架
  - 不改当前项目测试脚本名称与入口
- 项目内使用方式：
  - 继续保留现有命令：
    - `node test-ui-flow-smoke.js --port 18791`
    - `node test-ui-visual.js --port 18791`
  - skill 的作用是补 Playwright 浏览器自动验收能力与工作流支持，而不是替换现有测试脚本
- 验收目标：
  - 安装后重新尝试浏览器级 UI 流程与视觉回归验收
  - 若仍失败，则明确区分“skill 安装成功”与“本地浏览器权限仍阻塞”

## 完成标准
- skill 成功安装或得到明确失败原因。
- 之前未完成的浏览器级验收至少被再次尝试，并记录结果。
- 过程与结果全部落到 `docs\dev-records`。

## 验证方式
- 读取目标 skill 仓库说明。
- 执行安装命令。
- 再次执行浏览器级验收命令。

## 执行记录
- 2026-04-24 已按最小方案准备安装目标 skill：
  - `lackeyjb/playwright-skill`
- 已执行安装命令：
  - `python "C:\Users\HB\.codex\skills\.system\skill-installer\scripts\install-skill-from-github.py" --repo lackeyjb/playwright-skill --path skills/playwright-skill`
- 实际结果：
  - 已成功安装到 `C:\Users\HB\.codex\skills\playwright-skill`
- 安装后已继续执行浏览器级验收补跑。

## 验证结果
- 当前状态：
  - 最小落地方案已完成
  - GitHub skill 已安装成功
  - 后续浏览器级验收已可继续执行
- 结论：
  - 本轮最小落地目标已完成
  - 该 skill 已进入本机 Codex skills 目录，可供后续 UI 自动验收使用

## 复盘
- 这轮最重要的变化是权限链路恢复后，skill 安装本身没有额外技术阻碍。
- 说明前面阻塞确实来自执行环境，而不是方案或命令设计错误。
