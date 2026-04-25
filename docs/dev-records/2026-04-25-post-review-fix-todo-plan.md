# 2026-04-25 Post Review Fix TODO Plan

## 目标
- 将代码审查后的建议整理成可执行 TODO 清单。
- 明确执行顺序、范围、风险、完成标准和验证方式。
- 当前只规划，不编码。

## 范围
- 覆盖代码审查发现的主要问题：
  - 生成、上传、输出接口缺少登录鉴权。
  - 请求体缺少大小限制。
  - 输出文件访问缺少目录边界校验。
  - 默认管理员账号风险。
  - 样式契约测试失败。
  - 安全测试覆盖缺口。
  - 临时文件忽略规则。
  - 前后端模型 label 格式化逻辑重复。
- 不在本计划内重构架构，不新增业务功能。

## 假设
- 修复优先级以真实风险为准：安全边界优先于 UI 一致性。
- 现有前端页面和接口调用应尽量保持兼容。
- 当前任务先输出 TODO，不直接修改代码。

## 风险
- 鉴权修复可能影响前端当前未携带登录态的调用路径。
- 请求体大小限制可能误伤合法大文件上传，需要合理设置上传上限。
- 默认管理员账号策略如果过严，可能影响本地开发启动体验。

## TODO 与执行顺序

### P0-1 补齐服务端登录鉴权边界
- 文件：
  - `server\routes\service.js`
  - `server\routes\local.js`
  - `server\routes\tasks\lyrics.js`
  - `server\routes\tasks\music.js`
  - `server\routes\tasks\image.js`
  - `server\routes\tasks\voice-cover.js`
  - `server\index.js` 或新增共享鉴权辅助
- 子任务：
  1. 梳理所有需要登录的接口清单。
  2. 设计最小鉴权方案：复用 `stateStore.getSession` / `req.authSession`，对受保护路由无 session 返回 401。
  3. 给 `/api/chat`、`/api/chat/models`、`/api/tts`、生成类接口、上传接口、状态查询接口、文件列表接口加鉴权。
  4. 明确 `/api/voices` 是否公开；若仅前端登录后使用，也加鉴权。
  5. 增加匿名访问测试。
  6. 跑安全测试。
- 完成标准：
  - 匿名访问生成、上传、文件列表、聊天接口均返回 401。
  - 登录用户原有功能不被破坏。
- 验证方式：
  - `node test-security-gateway.js`
  - 新增匿名访问测试。

### P0-2 给 JSON 请求体和上传内容加大小限制
- 文件：
  - `server\lib\http.js`
  - `server\routes\local.js`
  - `server\config.js`
  - `.env.example`
- 子任务：
  1. 在配置中增加 `MAX_JSON_BODY_BYTES`。
  2. 修改 `readJsonBody`，累计 chunk 超限后停止读取并抛出明确错误。
  3. 在 `server\index.js` 将超限错误转换为 413。
  4. 在 `/api/upload` 增加 base64 解码前后的大小检查。
  5. 限制上传扩展名或 MIME 映射，避免任意扩展。
  6. 增加超大 body 测试。
- 完成标准：
  - 超大 JSON 请求返回 413。
  - 合法小请求仍正常。
- 验证方式：
  - 新增 body limit 测试。
  - `node test-security-gateway.js`

### P0-3 收紧输出文件访问
- 文件：
  - `server\routes\local.js`
  - `test-security-gateway.js` 或新增测试文件
- 子任务：
  1. 用 `new URL(req.url, base).pathname` 提取路径。
  2. 解码文件名并拒绝空值、绝对路径、路径分隔符穿越。
  3. 用 `path.resolve` 计算目标路径。
  4. 校验目标路径必须位于 `OUTPUT_DIR` 内。
  5. 保留现有合法 `/output/<file>` 行为。
  6. 增加路径穿越测试和 query 参数测试。
- 完成标准：
  - `/output/../...`、编码穿越、带 query 的异常路径都不能越界。
  - 合法输出文件仍可访问。
- 验证方式：
  - 新增输出路径安全测试。
  - `node test-security-gateway.js`

### P1-1 处理默认管理员账号生产风险
- 文件：
  - `server\config.js`
  - `server\state-store.js`
  - `.env.example`
  - `docs\dev-records` 记录决策
- 子任务：
  1. 明确本地开发和生产模式判断方式，例如 `NODE_ENV=production`。
  2. 生产模式下禁止使用默认 `APP_PASSWORD=AIGS2026!`。
  3. 生产模式下要求显式配置 `CSRF_SECRET`。
  4. 本地开发保留默认账号，避免影响启动。
  5. 增加配置校验测试。
- 完成标准：
  - 生产模式默认密码启动失败并给出明确错误。
  - 本地模式不受影响。
- 验证方式：
  - 新增 config 测试。
  - `node --check server\config.js`

### P1-2 修复样式契约测试失败
- 文件：
  - `public\css\style.css`
  - `test-style-contract.js`
- 子任务：
  1. 判断 `.chat-card padding: 0` 是新设计要求还是误改。
  2. 如果是误改，删除 `.chat-card` 对共享 card padding 的覆盖。
  3. 如果是新设计，更新 `test-style-contract.js` 的契约描述。
  4. 运行样式测试。
  5. 进行一次页面视觉抽查。
- 完成标准：
  - `node test-style-contract.js` 通过。
  - 聊天主界面布局不回退。
- 验证方式：
  - `node test-style-contract.js`
  - `node test-chat-model-dropdown-visual.js`

### P1-3 补安全测试覆盖
- 文件：
  - `test-security-gateway.js`
  - 可选新增 `test-api-auth-boundary.js`
- 子任务：
  1. 增加匿名访问 `/api/files` 应返回 401 的测试。
  2. 增加匿名访问 `/api/chat` 应返回 401 的测试。
  3. 增加匿名访问生成类接口应返回 401 的测试。
  4. 增加超大 body 返回 413 的测试。
  5. 增加输出路径穿越返回 403 或 404 的测试。
- 完成标准：
  - 安全测试覆盖本次修复的主要边界。
- 验证方式：
  - `node test-security-gateway.js`
  - 新增测试命令。

### P2-1 清理临时文件和忽略规则
- 文件：
  - `.gitignore`
  - 本地文件 `data\app-state.sqlite-wal.baiduyun.uploading.cfg`
- 子任务：
  1. 增加 `*.uploading.cfg` 或 `data\*.uploading.cfg` 忽略规则。
  2. 确认不误忽略必要配置样例。
  3. 清理当前未跟踪临时文件，或仅记录由用户决定是否删除。
- 完成标准：
  - `git status --short` 不再提示该类临时文件。
- 验证方式：
  - `git status --short`

### P2-2 整理模型 label 格式化重复逻辑
- 文件：
  - `server\routes\service.js`
  - `public\js\app.js`
  - `test-chat-model-options.js`
  - `test-chat-model-dropdown-label-cache.js`
- 子任务：
  1. 保留前端兜底格式化，因为它能处理旧缓存。
  2. 抽取共享测试样例，确保前后端输出一致。
  3. 不强行做复杂共享模块，避免浏览器端加载复杂化。
  4. 增加更多 label case 测试。
- 完成标准：
  - 前后端格式化结果在测试样例上保持一致。
- 验证方式：
  - `node test-chat-model-options.js`
  - `node test-chat-model-dropdown-label-cache.js`

## 完成标准
- P0 全部完成后，项目具备基本上线安全边界。
- P1 完成后，测试回归和配置安全明显改善。
- P2 完成后，工作区更干净，可维护性更好。

## 验证方式
- 每个 TODO 独立跑对应测试。
- P0 修复完成后至少运行：
  - `node test-security-gateway.js`
  - 新增安全边界测试
  - `node test-page-markup.js`
- P1 修复完成后至少运行：
  - `node test-style-contract.js`
  - `node test-frontend-state.js`
- 全部完成后再考虑运行更完整的 release 级测试。

## 执行记录
- 当前仅完成 TODO 规划，未编码。

## 验证结果
- 未执行代码验证。

## 复盘
- 新问题：安全边界任务之间有依赖，鉴权应先于输出文件隔离和测试扩展。
- 边界条件：默认管理员策略需要兼顾本地开发便利和生产安全。
- 遗漏点：尚未列出每个接口的精确登录态测试 payload，执行时应补充。
- 是否回写规划：已将执行顺序和验收标准写入本文档。
