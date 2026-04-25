# UI 自动验收 Skill 选型记录

## 目标
- 为当前项目选择一个最适合的 GitHub skill 或相关仓库，用于本地 UI 自动验收、浏览器交互检查或视觉回归辅助。

## 范围
- 仅做选型、比较与安装方案建议。
- 不默认安装，不修改业务代码，不绕过当前本地权限限制。

## 假设
- 用户当前要的是“最适合的 skill 选型 + 安装方案”，不是立即完成安装。
- 当前项目最需要的是本地页面交互验收与 UI 稳定性检查能力。

## 风险
- GitHub 上部分 skill 可能久未维护，适配当前环境的成本高。
- 即使 skill 合适，也不能直接绕过本地浏览器执行权限限制。

## TODO
1. 搜索并核对候选 skill\repo。
2. 比较适配性、维护状态、与当前项目的匹配度。
3. 给出推荐方案、理由和安装建议。

## 完成标准
- 给出一个明确推荐，而不是泛泛列清单。
- 说明为什么选它，以及为什么不优先选其他候选。

## 验证方式
- 基于 GitHub 仓库页面信息、项目说明和当前项目需求做交叉判断。

## 执行记录
- 2026-04-24 已检索并核对以下候选：
  - `browser-use/browser-use`
  - `lackeyjb/playwright-skill`
  - `testdino-hq/playwright-skill`
  - `willmarple/playwright-skill`
- 已比对其定位、维护规模、安装结构与当前项目需求的匹配度。

## 验证结果
- 选型结论：
  - 若只选一个最适合当前项目的 GitHub skill，推荐 `lackeyjb/playwright-skill`。
  - 若从“浏览器代理能力”角度看，`browser-use/browser-use` 很强，但当前会话已经具备 `Browser Use` 插件能力，重复安装的边际收益有限。
- 选择理由：
  - `lackeyjb/playwright-skill`
    - 明确定位就是“browser automation with Playwright”，并且强调 testing and validation。
    - GitHub 页面显示约 `2.5k` stars，明显高于另外两个 Playwright skill 候选。
    - README 明确给出 project-specific installation 方式，便于按项目装到本仓库。
  - `testdino-hq/playwright-skill`
    - 更偏 Playwright 最佳实践和指南集合，适合知识补充，不是当前最优先的执行型 skill。
  - `willmarple/playwright-skill`
    - 标注为 experimental，当前成熟度与采用度都不适合做首选。
  - `browser-use/browser-use`
    - 仓库很强、很活跃，但更偏完整浏览器代理框架，而不是当前最缺的“项目内可直接接入的 Playwright 验收 skill”。

## 安装建议
- 推荐安装目标：
  - 项目级安装 `lackeyjb/playwright-skill`
- 推荐安装方式：
  1. 克隆仓库到临时目录。
  2. 只拷贝其 `skills\playwright-skill` 到当前项目的 skill 目录。
  3. 进入该目录执行其 README 中的 setup。
- 注意：
  - 即使安装了 skill，也不能直接绕过当前本地浏览器 `spawn EPERM` 的执行权限问题。
  - 它能补的是“能力组织与工作流”，不是“本地权限绕过”。

## 复盘
- 这次选型后，关键判断更清楚了：
  - 当前不是完全没有相关 skill。
  - 当前最缺的是一个更贴合本项目验收流程的 Playwright skill，而不是再叠一个泛浏览器代理。
  - 真正阻塞浏览器级验收的，依然是本地浏览器启动权限，而不是 skill 缺失。
