# 2026-04-25 项目全面审查报告

## 当前状态
- 当前分支：`main...origin\main`。
- 当前工作区存在未提交改动，涉及品牌字标、语音转文字颜色、聊天公式渲染及对应测试/记录。
- 本轮审查只做静态审查和低风险验证，不直接修复。

## 严重发现

### Critical
1. `minimax_api_docs\MiniMax_API_Models.md:7` 存在真实形态 API key。
   - 影响：该文件已被 Git 跟踪，密钥可能已经进入历史；即使后续删除，也需要在服务端立即轮换。
   - 建议：立即吊销/轮换该 key；用占位符替换文档；清理 Git 历史或至少记录泄露处置；补充 secret scanning。

### High
1. `server\index.js:301-302` 将 `error.message` 直接返回给客户端。
   - 影响：后端异常、文件路径、上游 API 错误细节可能泄漏给用户。
   - 建议：生产环境返回通用错误码和 requestId，详细错误只写服务端日志。

2. `server\state-store.js:39-78` 等 schema 声明了外键，但 `server\state-store.js:34-37` 没有启用 `PRAGMA foreign_keys = ON`。
   - 影响：SQLite 默认不强制外键，用户、会话、会话消息、任务、审计日志之间可能出现孤儿数据。
   - 建议：连接创建后启用 foreign keys，并增加删除用户/会话后的完整性测试。

3. `server\state-store.js:144-150` 的 `user_history_entries` 没有用户外键。
   - 影响：即使开启外键，该表仍会在删除用户后保留历史数据，形成隐私和数据治理风险。
   - 建议：补 `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`，并写迁移清理历史孤儿数据。

4. 根目录没有项目级 `.github` CI 工作流；`package.json:17-20` 有 release 脚本但只靠本地人工运行。
   - 影响：提交/推送不能自动阻断安全、回归、视觉或容量退化。
   - 建议：增加 CI：secret scan、npm audit、check、release-core、关键浏览器 smoke；视觉回归可作为手动 gate。

## Medium
1. `.gitignore:3` 忽略 `package-lock.json`，且 `package-lock.json` 未被 Git 跟踪。
   - 影响：依赖版本不可重复，灰度和生产环境可能安装到不同子版本。
   - 建议：提交 lockfile；CI 使用 `npm ci`。

2. `server\config.js:105` 默认 `PUBLIC_REGISTRATION_ENABLED=true`。
   - 影响：如果生产忘记显式关闭，应用默认开放注册。
   - 建议：生产默认关闭公开注册，或要求生产显式配置该项。

3. `public\js\app-shell.js:10-13` 保留了前端默认账号密码常量。
   - 影响：即便当前主要走远端认证，前端包仍公开默认凭据语义，容易误导或被旧 fallback 路径复用。
   - 建议：移除前端硬编码认证；测试用认证应放到测试夹具或 `.env.example`。

4. `server\routes\local.js:93-98` 上传仅按扩展名过滤并直接写入。
   - 影响：不能识别伪造 MIME/魔数，存在存储垃圾文件、恶意内容投递和后续处理风险。
   - 建议：按 magic bytes 校验音频/图片类型；统一文件扫描和大小限制错误。

5. `server\state-store.js:264-268` 用裸 `ALTER TABLE` 加吞异常处理迁移。
   - 影响：无法追踪 schema 版本；失败原因会被当成“列已存在”吞掉。
   - 建议：引入 `schema_migrations` 表，迁移按版本执行并记录。

6. `server\routes\system.js:7-20` health check 暴露 `activeAdminCount` 和内部错误信息。
   - 影响：对外暴露管理面信息和故障细节。
   - 建议：公开 health 只返回 `ok`；详细诊断放 admin-only 或本机-only endpoint。

7. `public\index.html:628-704` 语音转文字仍是占位壳子。
   - 影响：导航已经把它作为一等功能展示，但用户实际只能得到占位结果，体验落差大。
   - 建议：要么接入真实转写 API，要么把入口标记为“即将支持/实验功能”，并在灰度中只开放给测试用户。

8. `public\index.html:42-90` 使用 `role="menubar"` / `role="menuitem"` 但未确认完整菜单键盘交互。
   - 影响：辅助技术会期待 menubar 的方向键/roving tabindex 行为，普通 tab 导航可能更合适。
   - 建议：若不是桌面菜单语义，改为普通 nav + button；若保留 menubar，补方向键和 aria 语义测试。

## Low / Observations
1. `npm audit --json` 当前报告 0 个漏洞。
2. 安全头、CORS、CSRF、HttpOnly cookie、SameSite、路径边界、请求体大小限制已有基础实现。
3. 当前测试体系覆盖面不错：前端状态、页面标记、样式契约、安全网关、任务持久化、视觉回归、容量基线均已存在。
4. 灰度测试能力仍偏“本地发布前回归”，缺少真实灰度开关、用户分组、回滚策略、监控指标和自动化发布闸门。

## 验证结果
- `npm run check`：通过。
- `npm run test:frontend`：通过。
- `node test-security-gateway.js`：通过。
- `node test-chat-formula-rendering.js`：通过。
- `node test-transcription-color-consistency.js`：通过。
- `node test-brand-title-typography.js`：通过。
- `node test-regression.js --skip-live --skip-browser`：Total 12, Passed 10, Skipped 2, Failed 0。
- `npm audit --json`：0 vulnerabilities。

## 建议优先级
1. 立即处理密钥泄露：轮换、替换文档、加 secret scanning。
2. 修复生产错误信息泄漏、health 信息泄漏。
3. 修复 SQLite 外键启用和历史表外键缺口。
4. 提交 lockfile，并建立 CI release-core gate。
5. 定义灰度策略：feature flags、灰度用户、指标、回滚。
6. 将语音转文字从占位状态推进到真实可用，或降级为实验入口。
