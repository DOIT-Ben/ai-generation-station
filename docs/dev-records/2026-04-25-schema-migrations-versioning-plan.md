# SQLite schema migrations 版本化修复记录

## 目标
修复审查报告中“裸 `ALTER TABLE` 加吞异常处理迁移”的问题，引入最小 `schema_migrations` 表，让已执行的 schema 变更可追踪、可重复、可审计。

## 范围
- 修改 `server\state-store.js` 的初始化迁移流程。
- 将 `conversation_messages.metadata_json` 补列迁移纳入版本记录。
- 将 `user_history_entries` 外键重建迁移纳入版本记录。
- 新增聚焦测试覆盖旧库迁移、迁移记录和幂等初始化。
- 不设计完整迁移框架、不迁移其它业务表、不改变业务 API。

## 假设
- SQLite schema migration 先采用 `id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL` 的最小表结构即可。
- 新库已经具备最新 schema，但仍应记录当前已知迁移已应用，便于后续追踪。
- 旧库可能缺 `conversation_messages.metadata_json`，也可能缺 `user_history_entries` 外键；这两项需要幂等处理。

## 风险
- 迁移顺序如果不稳定，可能导致旧库初始化失败。
- 将历史表重建迁移纳入版本表后，必须保留上一轮孤儿历史清理行为。
- 仍不是完整 migrations 目录体系，后续大规模迁移可能需要进一步抽象。

## TODO
1. 新增聚焦测试：验证旧版 `conversation_messages` 会补 `metadata_json` 并记录迁移。
2. 新增聚焦测试：验证旧版 `user_history_entries` 会补外键并记录迁移。
3. 新增聚焦测试：验证二次初始化不会重复插入迁移记录。
4. 修改 `server\state-store.js`，创建 `schema_migrations` 表。
5. 增加 `runSchemaMigration` 幂等执行 helper。
6. 将 `conversation_messages.metadata_json` 补列改为版本化迁移。
7. 将 `user_history_entries` 外键迁移改为版本化迁移。
8. 运行聚焦测试、外键测试、状态维护测试、release-core、语法检查。
9. 复盘新问题、边界条件、遗漏点，并回写本文件。
10. 提交本轮 schema migrations 修复。

## 完成标准
- 数据库存在 `schema_migrations` 表。
- 旧库缺列会被补齐，且迁移 ID 被记录。
- 旧库历史表外键会被补齐，孤儿历史被清理，迁移 ID 被记录。
- 二次初始化不重复写迁移记录。
- 相关验证命令通过。

## 验证方式
- `node test-state-migrations.js`
- `node test-state-foreign-keys.js`
- `node test-state-maintenance.js`
- `npm run test:release-core`
- `npm run check`

## 执行记录
- 已完成根因调查：`server\state-store.js` 当前直接调用 `migrateUserHistoryForeignKey(db)`，并用 `try/catch` 吞掉 `ALTER TABLE conversation_messages ADD COLUMN metadata_json` 的失败，缺少版本记录。
- TODO 1-3 已新增聚焦测试：`test-state-migrations.js` 构造旧版 schema，验证补列、补外键、迁移记录和二次初始化幂等。
- 预修复验证：`node test-state-migrations.js` 失败，失败点为 `no such table: schema_migrations`，符合预期。
- TODO 4 已完成：`server\state-store.js` 初始化创建 `schema_migrations` 表。
- TODO 5 已完成：新增 `runSchemaMigration` helper，按迁移 ID 幂等执行并记录 `applied_at`。
- TODO 6 已完成：`conversation_messages.metadata_json` 补列迁移改为版本化执行。
- TODO 7 已完成：`user_history_entries` 外键重建迁移改为版本化执行。
- 修复后聚焦验证：`node test-state-migrations.js` 通过。

## 验证结果
- `node test-state-migrations.js`：通过。覆盖旧版 schema 补列、补外键、迁移记录和二次初始化幂等。
- `node test-state-foreign-keys.js`：通过。外键拒绝和历史表外键迁移行为未回归。
- `node test-state-maintenance.js`：通过。维护摘要和审计清理路径未回归。
- `npm run test:release-core`：通过。回归总计 12 项，10 通过，2 个浏览器项按参数跳过，0 失败；容量基线完成。
- `npm run check`：通过。

## 复盘
- TODO 1-3 复盘：测试覆盖旧库迁移和幂等记录，比只检查新库建表更能约束真实升级路径。当前阻塞点是缺少 `schema_migrations` 表和版本化执行 helper。
- TODO 4-7 复盘：当前 helper 是最小版本化迁移机制，迁移函数成功后再记录 ID；未引入迁移目录和复杂回滚机制，避免本轮扩大范围。
- TODO 8-9 复盘：相关回归通过。后续如果迁移数量继续增加，可以再把迁移定义拆出独立模块；当前两个迁移留在 `state-store.js` 内更符合最小改动范围。
