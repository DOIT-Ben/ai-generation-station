# 2026-04-25 灰度发布策略

## 目标
为 AI Generation Station 建立最小可执行灰度策略：任何实验功能或高风险变更上线前，都必须有开关、分组、指标、回滚和 CI gate。

## Feature Flags
- 配置型开关：继续使用显式环境变量控制高风险入口，例如 `PUBLIC_REGISTRATION_ENABLED` 默认关闭，只允许显式开启。
- 前端实验标记：未正式开放的功能必须使用 `data-feature-state="experimental"`，例如语音转文字入口。
- 新功能默认关闭：新增高风险功能必须先以关闭或实验态提交，不能默认对所有用户开放。
- 开关命名规则：使用功能域前缀和明确动作，例如 `FEATURE_TRANSCRIPTION_ENABLED`、`FEATURE_IMAGE_BETA_ENABLED`。

## 用户分组
- 内部组：管理员和测试账号先验证核心流程。
- 小流量组：通过显式账号列表或配置名单开放，不按匿名流量随机放开。
- 全量组：只有完成灰度验收流程后才允许打开。
- 记录要求：每次灰度必须记录目标用户、开放比例、开始时间、负责人和回滚人。

## 监控指标
- 可用性：核心接口 5xx、401/403 异常比例、健康检查状态。
- 体验：关键操作成功率、失败 reason、平均响应时间和 p95。
- 成本：外部模型调用次数、失败重试次数、上传文件数量和大小。
- 安全：secret scan、异常登录、CSRF 拦截、上传校验失败、公开注册开关状态。

## 回滚策略
- 功能回滚：优先关闭 feature flag 或实验入口。
- 配置回滚：恢复上一份环境变量配置，并记录变更人和时间。
- 代码回滚：若配置无法止血，回滚到上一稳定 commit。
- 数据回滚：涉及 schema 变更时先停止写入，再按迁移记录和备份决定是否回滚数据。

## CI Gate
- 必跑：`npm ci`、`npm audit --audit-level=high`、`node test-secret-scan.js`、`npm run check`。
- 安全：`node test-security-gateway.js`、`node test-state-foreign-keys.js`、`node test-upload-magic-bytes.js`。
- 发布核心：`npm run test:release-core`。
- 策略防回归：`node test-gray-release-strategy.js`。
- 浏览器和视觉回归：作为人工发布 gate 或独立重型 CI gate，不阻塞当前 core gate 的落地。

## 灰度验收流程
1. 写入 `docs\dev-records`：目标、范围、假设、风险、TODO、完成标准、验证方式。
2. 先在本地跑聚焦测试和 `npm run test:release-core`。
3. 开启内部组，观察核心指标和错误 reason。
4. 小流量组运行至少一个完整业务周期。
5. 验证无阻塞问题后全量开放。
6. 如果任一关键指标异常，立即执行回滚策略并记录复盘。

## 完成标准
- 每个实验功能都有明确开关或实验状态。
- 每次灰度都有用户分组、指标、回滚人和验收记录。
- CI core gate 通过后才能进入灰度。
- 灰度异常必须先回滚或关闭开关，再进入问题修复。
