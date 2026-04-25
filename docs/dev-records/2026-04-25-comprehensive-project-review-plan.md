# 2026-04-25 项目全面审查计划

## 目标
全面审查当前 `AI-Generation-Stations` 项目，覆盖前端、后端、数据库设计、用户体验、安全性和灰度测试能力，输出按严重程度排序的问题、证据位置和改进建议。

## 范围
- 前端：`public` 页面结构、核心交互、视觉一致性、可访问性、渲染安全。
- 后端：`server` 路由、鉴权、配置、HTTP 处理、外部 API 调用、错误处理。
- 数据库：`server\state-store.js` 中 SQLite schema、索引、数据生命周期、迁移和备份。
- 测试与灰度：`test-*.js`、`package.json` 脚本、现有测试报告、发布前与灰度发布能力。
- 当前工作区未提交改动也纳入审查，但不直接修复。

## 假设
- 用户要求的是审查报告，不要求本轮编码修复。
- 当前工作区存在多轮未提交改动，审查以当前可见工作区为准。
- 外部 API live 测试可能受 key 和额度影响，本轮默认不调用真实生成接口。

## 风险
- 项目体量较大，一次审查无法穷尽所有 UI 像素问题和所有业务路径。
- 未提交改动可能包含正在修复中的问题，报告需标注工作区状态。
- 若只依赖测试通过，可能漏掉配置、密钥、灰度和运营风险。

## TODO
1. 梳理项目结构、Git 状态、依赖和测试脚本。
2. 审查后端路由、鉴权、配置、HTTP 安全和外部 API 边界。
3. 审查数据库 schema、索引、状态存储、备份和迁移设计。
4. 审查前端架构、聊天渲染、状态管理、可访问性和视觉一致性。
5. 审查安全性：密钥、XSS、CSRF、CORS、路径、上传、依赖。
6. 审查测试体系与灰度发布能力。
7. 运行低风险验证命令。
8. 汇总发现、开放问题、建议优先级，并回写复盘。

## 完成标准
- 输出覆盖前后端、数据库、用户体验、安全性、灰度测试。
- 每个主要发现有文件路径和行号证据。
- 明确严重程度、影响、建议。
- 审查过程与结果记录在 `docs\dev-records`。

## 验证方式
- 静态读取关键文件和测试脚本。
- `git status --short --branch`
- `npm run check`
- `npm run test:frontend`
- 视情况运行安全、样式、公式、语音转文字相关测试。

## 执行记录
- 2026-04-25：已开始全面审查，当前工作区存在未提交前端视觉和公式修复。
- TODO 1 已完成：
  - 项目形态为 Node 原生 HTTP 服务 + 静态前端。
  - 当前工作区有未提交视觉/公式修复和本轮审查文档。
  - `package.json` 有较完整本地测试脚本，但根目录无项目级 `.github` CI。
- TODO 1 复盘：
  - 新问题：`package-lock.json` 存在但被 `.gitignore` 忽略，且未被 Git 跟踪。
  - 边界条件：本轮审查不修改提交策略。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 2 已完成：
  - 审查 `server\index.js`、`server\route-meta.js`、`server\routes\local.js`、`server\routes\service.js`、`server\lib\request-security.js`。
  - 发现错误消息直返客户端、上传只按扩展名校验、health 信息暴露等问题。
- TODO 2 复盘：
  - 新问题：当前安全网关测试通过，但未覆盖生产错误脱敏和 health 信息最小化。
  - 边界条件：不触发真实外部 API。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 3 已完成：
  - 审查 `server\state-store.js` SQLite schema、索引、外键、迁移、保留策略。
  - 发现 SQLite 外键未启用、`user_history_entries` 缺少用户外键、迁移方式不可追踪。
- TODO 3 复盘：
  - 新问题：现有表结构较完整，但迁移治理仍偏手工。
  - 边界条件：未直接打开本地数据库文件，避免扰动运行状态。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 4 已完成：
  - 审查前端主页面、聊天渲染、导航语义、语音转文字壳子、近期公式/品牌/颜色修复。
  - 发现语音转文字仍为占位功能，导航 ARIA menubar 语义需复核。
- TODO 4 复盘：
  - 新问题：工作区未提交改动本身已改善部分体验，但尚未进入远端。
  - 边界条件：未跑浏览器截图。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 5 已完成：
  - 审查密钥、CSP/CORS/CSRF、cookie、上传、XSS 渲染、依赖审计。
  - 发现 `minimax_api_docs\MiniMax_API_Models.md` 中存在真实形态 API key。
- TODO 5 复盘：
  - 新问题：密钥泄露处置应先于普通代码修复。
  - 边界条件：本轮不展示完整密钥到最终回复。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 6 已完成：
  - 审查测试脚本、回归跳过参数、健康检查脚本和灰度相关关键词。
  - 结论：本地测试体系较全，但缺少 CI、灰度开关、分批发布和回滚指标。
- TODO 6 复盘：
  - 新问题：灰度能力目前更多是“发布前验证”，不是“线上灰度”。
  - 边界条件：不设计完整发布平台，只给优先建议。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 7 已完成：
  - 已运行低风险验证命令。
- TODO 8 已完成：
  - 已输出审查报告 `docs\dev-records\2026-04-25-comprehensive-project-review-report.md`。

## 验证结果
- `npm run check`：通过。
- `npm run test:frontend`：通过。
- `node test-security-gateway.js`：通过。
- `node test-chat-formula-rendering.js`：通过。
- `node test-transcription-color-consistency.js`：通过。
- `node test-brand-title-typography.js`：通过。
- `node test-regression.js --skip-live --skip-browser`：Total 12, Passed 10, Skipped 2, Failed 0。
- `npm audit --json`：0 vulnerabilities。

## 复盘
- 新问题：最高优先级不是测试失败，而是已跟踪文档中的真实形态 API key。
- 边界条件：本轮没有运行浏览器 UI 和 live API 测试。
- 遗漏点：未做真实部署环境验证、真实数据库数据抽样和真实用户路径访谈。
- 是否回写规划：已完成。
