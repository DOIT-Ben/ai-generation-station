# 2026-04-26 主线第十四阶段连续开发计划

## 目标
- 继续按主线 TODO 收缩 `public\js\app.js` 与 `server\state-store.js`。
- 本轮优先拆分前端工作台认证/账号入口簇，再拆分后端 schema 迁移 helper，保持现有用户行为不变。

## 范围
- 前端：
  - 拆分 `public\js\app.js` 中工作台认证恢复、账号入口与会话失效处理 helper。
- 后端：
  - 拆分 `server\state-store.js` 中 schema 迁移与外键修复 helper。
- 测试：
  - 更新 `test-page-markup.js` 等契约检查，验证新模块接入与导出。

## 非范围
- 不新增产品功能。
- 不修改数据库 schema 结构含义。
- 不调整页面视觉样式。
- 不处理与本轮无关的未跟踪文档文件。

## 假设
- 工作台认证簇主要依赖用户偏好、持久层与重定向 helper，适合抽成独立前端模块。
- schema 迁移 helper 边界稳定，适合抽成独立后端模块，不影响运行期逻辑。
- 现有测试集足以覆盖本轮风险；若发现遗漏，只补最小必要契约检查。

## 风险
- 前端认证簇直接影响登录态恢复、账号入口和失效跳转，依赖注入遗漏会影响工作台可用性。
- 后端 schema 迁移 helper 影响数据库启动期修复，若抽离失误会影响历史库兼容。
- 契约测试若继续绑定 `app.js` 单文件文本实现，后续收尾仍会出现误报。

## 完成标准
- `public\js\app.js` 不再直接承载完整的工作台认证/账号入口簇实现，只保留装配或薄封装。
- `server\state-store.js` 中 schema 迁移 helper 至少完成一轮可验证抽离。
- 新模块已接入加载链，相关测试通过。
- 本轮执行记录、验证结果、复盘完整写入 `docs\dev-records`。
- 本轮改动完成后提交一次 Git。

## 验证方式
- `node --check public\js\app.js`
- `node --check public\js\workspace-auth-tools.js`
- `node --check server\state-store.js`
- `node --check server\state-store-schema.js`
- `node test-page-markup.js`
- `npm run test:frontend`
- `$env:UI_SMOKE_LAUNCH_SERVER='1'; npm run test:ui-flow`
- `node test-auth-history.js`
- `node test-state-maintenance.js`
- `node test-state-foreign-keys.js`
- `node test-state-migrations.js`
- `npm run check`
- `npm test`（通过临时本地服务环境执行）
- `git diff --check`

## TODO
1. 盘点 `public\js\app.js` 中工作台认证恢复、账号入口与会话失效处理 helper 的职责边界。
2. 抽离前端工作台认证模块并接入首页脚本链。
3. 更新页面契约测试。
4. 执行前端阶段回归并修复问题。
5. 盘点 `server\state-store.js` 中 schema 迁移 helper 的职责边界。
6. 抽离后端 schema 迁移 helper。
7. 执行统一回归并修复问题。
8. 回写开发日志、验证结果、复盘。
9. 提交 Git。

## 执行顺序
1. 前端工作台认证簇盘点与拆分。
2. 前端契约测试更新。
3. 前端阶段回归。
4. 后端 schema 迁移 helper 盘点与拆分。
5. 统一回归。
6. 文档回写。
7. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 盘点 `public\js\app.js` 中 `buildAuthPagePath`、`renderUserPanel`、`handleProtectedSessionLoss`、`bootstrapAuth` 等职责边界。
  - 确认这组逻辑主要依赖持久层、用户偏好、重定向与工作台状态复位，适合抽为独立前端 auth 模块。
- 已完成 TODO 2：
  - 新增 `public\js\workspace-auth-tools.js`。
  - 抽离 `AigsWorkspaceAuthTools`，承接工作台认证恢复、账号入口与会话失效处理逻辑。
  - 在 `public\index.html` 中接入 `/js/workspace-auth-tools.js`。
  - 在 `public\js\app.js` 中新增 `requireWorkspaceAuthTools()`，并将对应入口改为薄封装委托。
- 已完成 TODO 3：
  - 更新 `test-page-markup.js`，校验新 workspace auth 模块接入、浏览器导出与装配契约。
  - 同步把登录跳转、账号入口和会话失效文案的契约检查从 `app.js` 挪到新模块。
- 已完成 TODO 4：
  - 执行前端阶段回归，确认页面契约、前端状态与 UI smoke 测试通过。
- 已完成 TODO 5：
  - 盘点 `server\state-store.js` 中 schema 迁移与外键修复 helper 的职责边界。
  - 确认这组逻辑边界稳定，适合抽成独立 schema helper。
- 已完成 TODO 6：
  - 新增 `server\state-store-schema.js`。
  - 抽离 schema migration 注册、消息 metadata 列修复与 user history 外键修复逻辑。
  - 在 `server\state-store.js` 中改为通过新模块导入这些 helper。
- 已完成 TODO 7：
  - 执行统一回归，覆盖前端、后端、迁移、契约和总 smoke。
- 已完成 TODO 8：
  - 已回写执行记录、验证结果、复盘。
- TODO 9 待执行：
  - 待完成提交前检查后执行 Git 提交。

## 复盘
- 新问题：
  - 本轮暴露出两条旧契约仍绑定 `app.js` 文本位置，已同步迁到新模块，后续误报概率更低。
- 边界条件：
  - 本轮只拆了前端工作台认证/账号入口簇与后端 schema helper，没有碰数据库语义、接口协议或视觉层。
- 遗漏点：
  - `app.js` 仍保留一些壳层委托和零散 helper，但已经基本是协调层。
  - `state-store.js` 现在主要剩 statement 定义、数据库初始化和最外层工厂壳，这一层继续拆的收益已经明显下降。
- 是否回写规划：
  - 是。本轮结果已回写，下一阶段更适合做停手判断和最终可维护性总结，而不是继续大规模拆分。

## 验证结果
- 语法检查通过：
  - `node --check public\js\workspace-auth-tools.js`
  - `node --check public\js\app.js`
  - `node --check server\state-store-schema.js`
  - `node --check server\state-store.js`
- 契约检查通过：
  - `node test-page-markup.js`
- 前端阶段回归通过：
  - `npm run test:frontend`
  - `$env:UI_SMOKE_LAUNCH_SERVER='1'; npm run test:ui-flow`
- 后端阶段回归通过：
  - `node test-auth-history.js`
  - `node test-state-maintenance.js`
  - `node test-state-foreign-keys.js`
  - `node test-state-migrations.js`
- 统一检查通过：
  - `npm run check`
  - `npm test`（通过临时本地服务环境执行）
- 提交前检查通过：
  - `git diff --check`
  - 说明：输出仅包含 CRLF 提示告警，无 diff 错误。

## 当前结果
- `public\js\app.js` 已由本轮开始前的 `3317` 行下降到 `3249` 行。
- `server\state-store.js` 已由本轮开始前的 `873` 行下降到 `827` 行。

## 下一阶段建议 TODO
1. 对 `public\js\app.js` 与 `server\state-store.js` 做最终停手判断。
2. 总结当前模块化边界、剩余低收益壳层和后续维护建议。
3. 只有在用户明确要求继续极限拆分时，再处理最后一组低收益 helper。
