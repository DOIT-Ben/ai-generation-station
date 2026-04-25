# 2026-04-25 Comprehensive Test Strategy And Cases

## 1. 文档目标

本文档是 `AI-Generation-Stations` 后续开发与修复阶段的测试依据。目标是在进入代码修复前，明确：

- 哪些内容必须测试。
- 哪些测试已有覆盖。
- 哪些测试需要新增。
- 每个修复阶段的准入、准出标准。
- 测试执行顺序和失败处理规则。

本文档优先覆盖代码审查后确认的高风险问题：鉴权边界、请求体大小限制、输出文件访问边界、默认管理员风险、样式契约回归、安全测试缺口。

## 2. 项目测试范围

### 2.1 后端服务

- `server\index.js`
  - 路由匹配。
  - CSRF 校验。
  - CORS 与安全响应头。
  - API key 配置 gate。
  - 静态文件服务。
  - JSON body 读取与错误处理。
- `server\routes\state.js`
  - 登录、注册、登出。
  - 会话读取。
  - 修改密码。
  - 邀请激活。
  - 找回密码与重置密码。
  - 用户偏好、历史记录、会话、模板。
  - 管理员用户与审计日志。
- `server\routes\service.js`
  - TTS。
  - Quota。
  - Chat models。
  - Chat completion。
  - Chat streaming。
- `server\routes\local.js`
  - 上传。
  - Voices。
  - 任务状态。
  - 文件列表。
  - 输出文件访问。
- `server\routes\tasks\*.js`
  - 歌词、音乐、图片、翻唱任务创建。
  - provider 同步/异步任务处理。
  - 输出文件写入。
  - 任务状态持久化。

### 2.2 前端工作台

- `public\index.html`
- `public\js\app.js`
- `public\js\app-shell.js`
- `public\css\style.css`

需覆盖：

- 登录态加载与未登录跳转。
- CSRF token 获取与失败重试。
- 顶部账号区。
- 聊天模型下拉框。
- 聊天输入、发送、停止、流式回复。
- 会话列表、归档、恢复、删除。
- 模板库。
- 历史记录。
- 护眼模式、浅色模式、深色模式。
- 移动端布局和响应式行为。

### 2.3 门户页面

- `public\auth\index.html`
- `public\account\index.html`
- `public\admin\index.html`
- `public\js\auth-page.js`
- `public\js\account-page.js`
- `public\js\admin-page.js`
- `public\js\site-shell.js`

需覆盖：

- 登录、注册、找回密码、邀请激活、密码重置。
- 账户页密码修改。
- 管理员创建用户、更新用户、邀请、重发、撤销、重置密码。
- 审计日志筛选。
- 门户页面主题切换。

### 2.4 配置与运行态

- `server\config.js`
- `.env.example`
- `.gitignore`
- `data\*`
- `output\*`

需覆盖：

- 默认配置。
- 生产环境强制配置。
- 输出目录。
- 数据库路径。
- 临时文件忽略规则。
- 外部 API key 缺失时的错误行为。

## 3. 测试分层

### 3.1 静态与语法检查

目的：快速发现 JS 语法错误和明显契约破坏。

必跑命令：

```powershell
node --check server\index.js
node --check server\routes\service.js
node --check server\routes\local.js
node --check server\lib\http.js
node --check public\js\app.js
node --check public\js\app-shell.js
```

准出标准：

- 所有命令退出码为 0。
- 不允许新增语法错误。

### 3.2 单元测试

目的：验证纯函数、配置解析、格式化、状态逻辑。

已有覆盖：

- `test-chat-model-options.js`
- `test-chat-model-dropdown-label-cache.js`
- `test-state-maintenance.js`
- `test-frontend-state.js`
- `test-style-contract.js`
- `test-page-markup.js`

需新增或强化：

- `test-config-production-safety.js`
  - 生产模式默认管理员密码拒绝启动。
  - 生产模式缺少 `CSRF_SECRET` 拒绝启动。
  - 本地开发模式允许默认配置。
- `test-http-body-limit.js`
  - 小 JSON 正常解析。
  - 超大 JSON 抛出 body too large 错误。
  - 非法 JSON 返回 400。
- `test-output-path-safety.js`
  - 合法文件路径可访问。
  - `..\`、`../`、URL 编码穿越均被拒绝。
  - query 不参与文件名。

### 3.3 后端集成测试

目的：验证真实 HTTP 路由、cookie、CSRF、session、权限。

已有覆盖：

- `test-security-gateway.js`
- `test-auth-history.js`
- `test-task-persistence.js`
- `test-failures.js`
- `test-music-route.js`
- `test-voice-cover-route.js`

需新增或强化：

- `test-api-auth-boundary.js`
  - 匿名访问受保护接口返回 401。
  - 登录用户访问受保护接口可进入业务校验。
  - 临时密码用户访问业务接口返回 403 `password_reset_required`。
  - 管理员接口普通用户返回 403。
- `test-upload-boundary.js`
  - 未登录上传返回 401。
  - 登录后合法小文件上传成功。
  - 超大 base64 返回 413。
  - 非允许扩展名返回 400。
- `test-output-access-boundary.js`
  - 未登录访问 `/api/files` 返回 401。
  - 未登录访问 `/output/<file>` 返回 401 或 403。
  - 登录后只能访问允许的输出文件。

### 3.4 浏览器 UI 测试

目的：验证真实页面、登录流、用户操作、主题和布局。

已有覆盖：

- `test-ui-flow-smoke.js`
- `test-ui-visual.js`
- `test-chat-model-dropdown-visual.js`
- `test-paper-theme-component-colors.js`
- `test-brand-title-typography.js`
- `test-chat-input-paper-and-dropdown-init.js`

需新增或强化：

- `test-ui-security-boundary.js`
  - 未登录访问工作台跳转 `/auth/?next=%2F`。
  - 登录后工作台加载。
  - 登出后后退或刷新不能继续访问工作台数据。
- `test-ui-chat-model-dropdown-live.js`
  - 模拟旧 localStorage 缓存。
  - 打开下拉框，全部可见模型 label 不出现小写 `gpt-` / `chatgpt-`。
  - 选项 label 左边界一致。
- `test-ui-paper-theme-regression.js`
  - 护眼模式下聊天输入框、模板卡片、下拉框、管理员表单、账户页风格一致。

### 3.5 安全测试

目的：验证公开面、权限边界、CSRF、CORS、路径和 body 上限。

安全测试必须覆盖：

1. **匿名访问边界**
   - `/api/files`
   - `/api/upload`
   - `/api/chat`
   - `/api/chat/models`
   - `/api/tts`
   - `/api/generate/lyrics`
   - `/api/generate/music`
   - `/api/generate/cover`
   - `/api/generate/voice`
   - `/api/music/status`
   - `/api/image/status`
   - `/api/music-cover/status`
   - `/output/<file>`

2. **CSRF**
   - POST 无 CSRF seed 返回 403 `csrf_seed_missing`。
   - POST 无 CSRF header 返回 403 `csrf_required`。
   - POST 错误 token 返回 403 `csrf_invalid`。
   - token 过期后前端会刷新并重试一次。

3. **CORS**
   - 同源允许。
   - 配置白名单 origin 允许。
   - 未配置外部恶意 origin 拒绝。
   - preflight 行为正确。

4. **路径安全**
   - `/output/../.env`
   - `/output/%2e%2e/.env`
   - `/output/..%5C.env`
   - `/output/file.png?download=1`

5. **请求体上限**
   - 超过 `MAX_JSON_BODY_BYTES` 返回 413。
   - 上传超过 `MAX_UPLOAD_BYTES` 返回 413。
   - body 超限后服务不崩溃，后续请求仍可正常响应。

6. **默认凭据**
   - `NODE_ENV=production` 且 `APP_PASSWORD=AIGS2026!` 应启动失败。
   - `NODE_ENV=production` 且未配置 `CSRF_SECRET` 应启动失败。

### 3.6 容量与稳定性测试

已有覆盖：

- `test-capacity-baseline.js`
- `test-regression.js`

需覆盖：

- 多次登录登出不会泄漏 session。
- 多次创建聊天会话后查询仍稳定。
- 任务状态查询大量不存在 taskId 不会异常。
- 超大 body 拒绝后进程仍响应 `/api/health`。
- 输出目录文件数量较多时 `/api/files` 限制返回 50 条。

### 3.7 外部 API 联调测试

外部 API 可能消耗额度，默认不作为每次修复必跑项。

仅在以下场景运行：

- 修改 provider 调用协议。
- 修改生成任务状态处理。
- 修改文件输出写入逻辑。
- 发布前人工确认。

相关命令：

```powershell
node test-lyrics.js
node test-music.js
node test-image.js
node test-cover.js
node test-voice-cover.js
```

前置条件：

- `.env` 中配置有效 `MINIMAX_API_KEY`。
- 网络可访问 provider。
- 明确接受额度消耗。

## 4. 模块测试矩阵

| 模块 | 优先级 | 测试类型 | 已有测试 | 需新增测试 |
|---|---:|---|---|---|
| 认证登录/登出 | P0 | 集成、UI、安全 | `test-security-gateway.js`、`test-ui-flow-smoke.js` | 补登出后数据不可访问 |
| CSRF | P0 | 集成、前端状态 | `test-security-gateway.js`、`test-frontend-state.js` | 覆盖新受保护接口 |
| 接口登录鉴权 | P0 | 安全集成 | 部分缺失 | `test-api-auth-boundary.js` |
| 请求体大小限制 | P0 | 单元、集成、安全 | 缺失 | `test-http-body-limit.js` |
| 上传接口 | P0 | 集成、安全 | 部分 live 间接覆盖 | `test-upload-boundary.js` |
| 输出文件访问 | P0 | 集成、安全 | 缺失 | `test-output-access-boundary.js` |
| 默认管理员配置 | P1 | 单元、配置 | 缺失 | `test-config-production-safety.js` |
| 聊天接口 | P0 | 集成、UI | `test-chat-model-options.js`、UI 部分覆盖 | 匿名/登录态边界测试 |
| 聊天模型下拉框 | P1 | 单元、UI、视觉 | 已有多项 | 补 live 全量可见项验证 |
| 会话持久化 | P1 | 集成、UI | `test-task-persistence.js`、`test-ui-flow-smoke.js` | 补失败恢复 |
| 任务生成 | P1 | 单元、集成、live | `test-music-route.js`、`test-voice-cover-route.js`、live tests | 匿名边界、状态权限 |
| 管理后台 | P1 | UI、集成 | `test-ui-flow-smoke.js`、`test-frontend-state.js` | 普通用户访问后台 403 |
| 护眼主题 | P1 | 静态、视觉 | 已有新测试 | 补真实页面截图对比 |
| 样式契约 | P1 | 静态 | `test-style-contract.js` 当前失败 | 修复后纳入必跑 |
| 临时文件忽略 | P2 | 静态 | 缺失 | git status 检查 |

## 5. P0 修复前必须先写的测试

### 5.1 `test-api-auth-boundary.js`

目标：确认匿名用户不能访问高风险接口。

用例：

1. 匿名 `GET /api/files` 返回 401。
2. 匿名 `POST /api/upload` 带合法小 body 返回 401。
3. 匿名 `POST /api/chat` 返回 401，不应先进入 API key 或外部 provider 逻辑。
4. 匿名 `GET /api/chat/models` 返回 401。
5. 匿名 `POST /api/tts` 返回 401。
6. 匿名 `POST /api/generate/lyrics` 返回 401。
7. 匿名 `POST /api/generate/music` 返回 401。
8. 匿名 `POST /api/generate/cover` 返回 401。
9. 匿名 `POST /api/generate/voice` 返回 401。
10. 匿名 `POST /api/music/status` 返回 401。
11. 匿名 `POST /api/image/status` 返回 401。
12. 匿名 `POST /api/music-cover/status` 返回 401。

登录态正向用例：

1. 登录后请求 `/api/files` 不返回 401。
2. 登录后请求缺少业务参数的生成接口，应返回业务错误，例如 `Prompt is required`，而不是 401。

### 5.2 `test-http-body-limit.js`

目标：确认请求体上限生效。

用例：

1. 小 JSON body 正常解析。
2. 超过 `MAX_JSON_BODY_BYTES` 返回 413。
3. 超大 body 请求后，继续请求 `/api/health` 仍返回 200。
4. 非法 JSON 未超限返回 400。

### 5.3 `test-output-access-boundary.js`

目标：确认输出访问不会越界。

用例：

1. 匿名访问合法输出文件返回 401 或 403。
2. 登录后访问合法输出文件返回 200。
3. 登录后访问 `/output/../.env` 返回 403 或 404。
4. 登录后访问 `/output/%2e%2e/.env` 返回 403 或 404。
5. 登录后访问 `/output/..%5C.env` 返回 403 或 404。
6. 登录后访问带 query 的合法文件仍能正确解析文件名，或按设计拒绝，但行为必须稳定。

## 6. P1 修复前必须先写的测试

### 6.1 `test-config-production-safety.js`

用例：

1. `NODE_ENV=production` 且未显式设置 `APP_PASSWORD`，配置初始化失败。
2. `NODE_ENV=production` 且 `APP_PASSWORD=AIGS2026!`，配置初始化失败。
3. `NODE_ENV=production` 且未设置 `CSRF_SECRET`，配置初始化失败。
4. `NODE_ENV=development` 可使用默认本地账号。
5. `.env.example` 包含生产部署提示字段。

### 6.2 样式契约测试处理

当前已知失败：

```powershell
node test-style-contract.js
```

失败断言：

```text
.chat-card should not replace the shared card padding
```

必须先做产品/设计判断：

- 如果 `.chat-card padding: 0` 是设计要求，则更新 `test-style-contract.js`。
- 如果不是设计要求，则修 `public\css\style.css`。

准出标准：

```powershell
node test-style-contract.js
node test-chat-model-dropdown-visual.js
node test-paper-theme-component-colors.js
```

全部通过。

## 7. 执行顺序

### 第一阶段：安全边界测试先行

1. 写 `test-api-auth-boundary.js`。
2. 运行，确认当前失败。
3. 写 `test-http-body-limit.js`。
4. 运行，确认当前失败。
5. 写 `test-output-access-boundary.js`。
6. 运行，确认当前失败。

阶段准出：

- 新测试必须能准确暴露当前问题。
- 不允许为了通过而降低断言质量。

### 第二阶段：P0 修复验证

1. 实现登录鉴权。
2. 跑 `test-api-auth-boundary.js`。
3. 实现 body size limit。
4. 跑 `test-http-body-limit.js`。
5. 实现输出路径边界。
6. 跑 `test-output-access-boundary.js`。
7. 跑安全回归：

```powershell
node test-security-gateway.js
node test-page-markup.js
node test-frontend-state.js
```

阶段准出：

- P0 新增测试全部通过。
- 原有安全、页面、前端状态测试通过。

### 第三阶段：P1 配置与 UI 契约

1. 写 `test-config-production-safety.js`。
2. 实现生产配置保护。
3. 决定并修复 `test-style-contract.js`。
4. 跑：

```powershell
node test-config-production-safety.js
node test-style-contract.js
node test-chat-model-dropdown-visual.js
node test-paper-theme-component-colors.js
```

阶段准出：

- 配置安全测试通过。
- 样式契约恢复稳定。

### 第四阶段：浏览器回归

运行：

```powershell
node test-ui-flow-smoke.js --port 18797 --launch-server
node test-ui-visual.js --port 18797 --launch-server
```

重点人工/截图检查：

- 登录页。
- 工作台首页。
- 聊天页面。
- 模型下拉框。
- 护眼模式模板区。
- 账户页。
- 管理后台。

### 第五阶段：完整回归

低成本完整回归：

```powershell
node test-regression.js --skip-live --skip-browser
```

浏览器回归：

```powershell
node test-regression.js --skip-live --port 18797
```

发布前可选 live 回归：

```powershell
node test-regression.js --port 18797
```

live 回归仅在确认 API key、网络和额度允许时执行。

## 8. 缺陷分级

### Blocker

- 匿名用户可调用生成、上传、聊天或文件列表接口。
- 超大 body 可导致服务不可用。
- 生产环境默认管理员可登录。
- 登录后核心工作台打不开。

处理规则：

- 必须立即修复。
- 不允许进入下一阶段。

### Critical

- CSRF 失效。
- 管理员接口权限绕过。
- 输出文件路径越界。
- 会话数据跨用户泄露。
- 主要测试套件无法运行。

处理规则：

- 当前修复阶段必须解决。

### Major

- 样式契约失败。
- 护眼模式明显不一致。
- 模型下拉框显示混乱。
- 任务状态不能正确持久化。
- 浏览器 smoke 测试失败。

处理规则：

- 发布前必须解决。

### Minor

- 临时文件出现在 `git status`。
- 文案大小写不统一。
- 个别视觉细节轻微偏差。

处理规则：

- 可排入 P2，但不能长期堆积。

## 9. 测试数据要求

### 9.1 默认测试账号

本地测试可使用：

- 用户名：`studio`
- 密码：`AIGS2026!`

生产配置测试必须验证默认密码不可用于生产启动。

### 9.2 临时数据库

集成测试应使用临时 SQLite 文件：

- 路径放在系统 temp 目录。
- 每个测试独立文件。
- 测试结束清理 `.sqlite`、`.sqlite-shm`、`.sqlite-wal`。

### 9.3 临时输出目录

输出文件测试应使用临时 `OUTPUT_DIR`：

- 创建测试文件。
- 测试合法访问和非法访问。
- 测试结束删除目录。

### 9.4 外部 API

默认 mock 或跳过。

只有 live 测试使用真实 API key。

## 10. 准入标准

开始每一阶段开发前必须满足：

- 当前阶段测试文档已明确测试目标。
- 新增测试文件名和用例列表已确定。
- 已知失败项已记录。
- 不修改与当前阶段无关的模块。

## 11. 准出标准

### P0 准出

必须通过：

```powershell
node --check server\index.js
node --check server\lib\http.js
node --check server\routes\local.js
node --check server\routes\service.js
node test-api-auth-boundary.js
node test-http-body-limit.js
node test-output-access-boundary.js
node test-security-gateway.js
node test-page-markup.js
node test-frontend-state.js
```

### P1 准出

必须通过：

```powershell
node test-config-production-safety.js
node test-style-contract.js
node test-chat-model-dropdown-visual.js
node test-paper-theme-component-colors.js
node test-ui-flow-smoke.js --port 18797 --launch-server
```

### 发布前准出

必须通过：

```powershell
node test-regression.js --skip-live --port 18797
```

可选：

```powershell
node test-regression.js --port 18797
```

## 12. 当前已知测试状态

截至本测试文档编写时：

已知通过：

```powershell
node --check server\index.js
node --check server\routes\service.js
node --check public\js\app.js
node test-chat-model-dropdown-label-cache.js
node test-chat-model-options.js
node test-page-markup.js
node test-security-gateway.js
node test-frontend-state.js
```

已知失败：

```powershell
node test-style-contract.js
```

失败原因：

```text
.chat-card should not replace the shared card padding
```

已知覆盖缺口：

- 匿名访问生成/上传/输出接口。
- 请求体大小限制。
- 输出路径边界。
- 生产默认管理员风险。
- 超大 body 后服务存活。

## 13. 后续开发要求

进入修复阶段后，每个修复 TODO 必须遵循：

1. 先写或补测试。
2. 运行测试确认失败。
3. 做最小代码修复。
4. 运行对应测试确认通过。
5. 运行相关回归测试。
6. 将执行记录和复盘写回 `docs\dev-records`。

不得跳过测试直接修复 P0/P1 问题。

## 14. 建议新增测试文件清单

优先新增：

- `test-api-auth-boundary.js`
- `test-http-body-limit.js`
- `test-output-access-boundary.js`
- `test-config-production-safety.js`

可选新增：

- `test-upload-boundary.js`
- `test-ui-security-boundary.js`
- `test-ui-chat-model-dropdown-live.js`
- `test-ui-paper-theme-regression.js`

## 15. 最小执行路线

如果只允许最短路径修复当前最大风险，执行：

1. `test-api-auth-boundary.js`
2. 修鉴权。
3. `test-http-body-limit.js`
4. 修 body limit。
5. `test-output-access-boundary.js`
6. 修输出边界。
7. `node test-security-gateway.js`
8. `node test-frontend-state.js`
9. `node test-page-markup.js`

这条路线完成后，项目安全基线才算真正站住。
