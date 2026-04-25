# SQLite 外键一致性修复记录

## 目标
修复审查报告中的 SQLite 外键一致性问题：启用连接级外键约束，并为 `user_history_entries` 补齐用户外键，避免继续产生孤儿数据。

## 范围
- 修改 `server\state-store.js` 的数据库初始化和历史表迁移。
- 新增聚焦测试覆盖外键启用、历史表外键迁移、孤儿历史清理。
- 不处理 CI、lockfile、公开注册、上传校验、迁移版本化等其它审查项。

## 假设
- 当前 SQLite 使用 `node:sqlite` 的 `DatabaseSync`。
- 连接创建后执行 `PRAGMA foreign_keys = ON` 可以启用该连接的外键约束。
- SQLite 不能直接给已有表 `ALTER TABLE ADD FOREIGN KEY`，需要重建 `user_history_entries`。
- 已存在的 `user_history_entries` 孤儿数据应在迁移时清理；仍能关联到现有用户的历史数据应保留。

## 风险
- 重建历史表如果处理不当会丢失有效历史数据。
- 启用外键后，过去依赖“写入不存在用户 ID”的调用会开始抛错；这是目标行为，但需要测试覆盖。
- 当前不是完整 schema migration 体系，本轮只做必要的最小迁移，避免扩大范围。

## TODO
1. 新增聚焦测试：验证 `createSession` 写入不存在用户时会被外键拒绝。
2. 新增聚焦测试：验证 `appendHistory` 写入不存在用户时会被外键拒绝。
3. 新增聚焦测试：验证旧版 `user_history_entries` 表迁移后具备外键，并清理孤儿历史、保留有效历史。
4. 修改 `server\state-store.js`，启用 `PRAGMA foreign_keys = ON`。
5. 修改 `server\state-store.js`，为 `user_history_entries` 新建表定义补外键。
6. 增加最小表迁移逻辑，重建旧版历史表并清理孤儿行。
7. 运行聚焦测试、状态维护测试、任务持久化测试、语法检查。
8. 复盘新问题、边界条件、遗漏点，并回写本文件。

## 完成标准
- 新连接强制执行 SQLite 外键。
- 新建数据库的 `user_history_entries` 带 `FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE`。
- 旧版历史表会被迁移到带外键的新表。
- 旧版孤儿历史行被清理，有效用户历史保留。
- 相关测试和语法检查通过。

## 验证方式
- `node test-state-foreign-keys.js`
- `node test-state-maintenance.js`
- `node test-task-persistence.js`
- `npm run check`

## 执行记录
- 已完成根因调查：`server\state-store.js` 连接初始化只设置 WAL、synchronous、busy_timeout，未启用 `foreign_keys`；`user_history_entries` 建表缺少用户外键。
- TODO 1-3 已新增聚焦测试：`test-state-foreign-keys.js` 覆盖不存在用户的 session 写入、history 写入，以及旧版 history 表迁移。
- 预修复验证：`node test-state-foreign-keys.js` 失败，失败点为 `appendHistory` 可写入不存在用户，证明 `user_history_entries` 缺少外键约束。
- TODO 4 已完成：`server\state-store.js` 连接初始化显式执行 `PRAGMA foreign_keys = ON`。
- TODO 5 已完成：新建 `user_history_entries` 表定义补充 `FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE`。
- TODO 6 已完成：增加旧版 `user_history_entries` 重建迁移，复制有效用户历史并丢弃孤儿历史行。
- 修复后聚焦验证：`node test-state-foreign-keys.js` 通过。

## 验证结果
- `node test-state-foreign-keys.js`：通过。覆盖不存在用户的 session/history 写入被外键拒绝、旧版历史表迁移、孤儿历史清理、有效历史保留。
- `node test-state-maintenance.js`：通过。维护摘要和审计日志清理路径未回归。
- `node test-task-persistence.js`：通过。任务持久化和重启恢复路径未回归。
- `npm run check`：通过。`server\index.js` 语法检查通过。

## 复盘
- TODO 1-3 复盘：测试同时覆盖连接级外键和历史表专属外键。`createSession` 已被当前运行环境拒绝不存在用户，但 `appendHistory` 未被拒绝，说明历史表缺口是实际阻塞点；仍需要显式启用 `PRAGMA foreign_keys = ON`，避免依赖运行环境默认行为。
- TODO 4-6 复盘：本轮采用最小表重建迁移，没有引入完整 schema 版本表；这解决当前历史表外键缺口，但迁移版本化仍属于审查报告里的后续 Medium 项。
- TODO 7-8 复盘：相关回归通过。新发现的非阻塞事项是测试输出仍提示 `node:sqlite` ExperimentalWarning，这是运行时状态提示，不影响本轮外键修复；后续如升级 Node 或替换 SQLite driver，应单独规划。
