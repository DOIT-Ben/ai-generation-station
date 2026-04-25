# 2026-04-25 Project Code Review Plan

## 目标
- 以代码审查专家视角审查当前项目，优先发现真实 bug、回归风险、安全风险、状态一致性问题和测试缺口。
- 输出清晰的问题列表，包含文件位置、影响、建议修复方向。
- 不直接修改代码，除非用户后续明确要求修复。

## 范围
- 当前项目 `AI-Generation-Stations` 的前端、后端、测试与配置。
- 优先审查当前工作区已有改动、聊天模型下拉框相关链路、服务端接口、认证/状态存储关键路径。
- 不做大规模重构，不审查第三方依赖源码。

## 假设
- 用户希望进行项目级代码审查，而不是仅审查刚才的下拉框修复。
- 当前工作区存在大量历史改动，审查会优先关注可验证的高风险问题。
- 审查输出以问题为先，摘要为辅。

## 风险
- 项目体量较大，一次审查可能无法覆盖所有边角功能。
- 工作区已有未提交改动较多，需区分当前可见风险与历史变更噪音。
- 若本地服务或外部 API 状态不稳定，部分动态验证可能受影响。

## TODO
1. 梳理仓库结构、当前 git 状态、关键入口和测试脚本。
2. 检查高风险代码路径：认证、聊天接口、模型列表、状态存储、前端缓存和 UI 渲染。
3. 检查近期改动的测试覆盖与潜在回归。
4. 运行必要验证命令。
5. 形成审查报告：发现、开放问题、测试缺口、简短总结。
6. 复盘：新问题、边界条件、遗漏点、是否回写规划。

## 完成标准
- 至少覆盖前端主入口、后端路由、状态存储、测试入口和当前 UI 修复链路。
- 所有发现都有可定位的文件和行号。
- 验证命令结果记录到本文档。

## 验证方式
- `git status --short`
- `rg` 检查高风险模式。
- `node --check` 检查关键 JS 文件语法。
- 运行相关已有测试，优先选择低成本、高信号测试。

## 执行记录
- TODO 1 已完成：
  - 当前工作区存在大量未提交改动，包含前端页面、CSS、后端路由、状态存储和新增测试。
  - 项目脚本包含核心测试、前端测试、UI flow、视觉测试、安全网关测试。
  - JS/HTML/CSS/MD 文件约 258 个，本次优先审查高风险入口。
- TODO 1 复盘：
  - 新问题：工作区噪音较多，审查需聚焦行为风险。
  - 边界条件：不回滚、不修改非审查文件。
  - 遗漏点：无法在一次审查中覆盖所有视觉细节。
  - 是否回写规划：无需追加。
- TODO 2 已完成：
  - 检查 `server\index.js` 的全局路由、CSRF、API key gate。
  - 检查 `server\routes\state.js` 的认证保护，状态类接口有 `requireReadyUser` / `requireAdmin`。
  - 检查 `server\routes\local.js`、`server\routes\service.js`、`server\routes\tasks\*.js`，发现生成类、上传类、输出类接口没有登录保护。
  - 直接匿名请求 `http://localhost:18791\api\files` 返回 200，确认输出文件列表可匿名读取。
  - 直接匿名请求 `http://localhost:18791\api\voices` 返回 200；该接口本身可公开风险较低，但说明本地路由没有统一鉴权。
- TODO 2 复盘：
  - 新问题：CSRF 被当成请求安全校验，但不能替代登录鉴权；匿名用户可以先拿 CSRF。
  - 边界条件：`/output/*` 当前直接路径遍历未用简单 URL 复现，但代码仍缺少目录约束和查询参数处理。
  - 遗漏点：未对所有生成接口做真实外部 API 请求，避免消耗额度。
  - 是否回写规划：已纳入发现。
- TODO 3 已完成：
  - 检查近期聊天模型下拉框修复链路，新增缓存测试覆盖通过。
  - 检查 CSS 契约测试，发现 `test-style-contract.js` 当前失败。
- TODO 3 复盘：
  - 新问题：`.chat-card` 直接设置 `padding: 0`，违反现有测试契约。
  - 边界条件：该问题可能是近期 UI 设计刻意改动，但测试未更新；无论哪边为准，当前代码与测试不一致。
  - 遗漏点：未跑完整 release browser 套件。
  - 是否回写规划：已纳入发现。

## 验证结果
- `node --check server\index.js`：通过。
- `node --check server\routes\service.js`：通过。
- `node --check public\js\app.js`：通过。
- `node test-chat-model-dropdown-label-cache.js && node test-chat-model-options.js && node test-page-markup.js`：通过。
- `node test-security-gateway.js`：通过。
- `node test-frontend-state.js`：通过。
- `node test-style-contract.js`：失败，断言为 `.chat-card should not replace the shared card padding`。
- 匿名请求验证：
  - `GET /api/files`：200，返回输出文件列表。
  - `GET /api/voices`：200，返回 voice 列表。

## 复盘
- 本次审查发现的最高优先级问题是“生成/上传/输出接口缺少登录鉴权”，不是单点 UI 问题。
- 安全网关测试通过但没有覆盖匿名访问生成类接口和输出文件列表，说明测试覆盖存在盲区。
- 样式契约测试失败说明当前 UI 改动与既有约束冲突，需要决定是修 CSS 还是更新契约。
- 未跟踪文件中存在 `data\app-state.sqlite-wal.baiduyun.uploading.cfg`，需要加入忽略规则或清理，避免同步/临时文件进入提交。
