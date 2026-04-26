# 2026-04-26 主线第十三阶段连续开发计划

## 目标
- 继续按主线 TODO 收缩 `public\js\app.js` 与 `server\state-store.js`。
- 本轮优先拆分前端页面初始化簇，再拆分后端服务装配簇，保持现有用户行为不变。

## 范围
- 前端：
  - 拆分 `public\js\app.js` 中 `initSpeechTab`、`init` 与页面初始化编排 helper。
- 后端：
  - 拆分 `server\state-store.js` 中 `stateStore*` 服务构造与注入装配逻辑。
- 测试：
  - 更新 `test-page-markup.js` 等契约检查，验证新模块接入与导出。

## 非范围
- 不新增产品功能。
- 不修改数据库 schema。
- 不调整页面视觉样式。
- 不处理与本轮无关的未跟踪文档文件。

## 假设
- 页面初始化簇主要依赖现有页面 helper、toast 与认证入口，适合抽成独立前端模块。
- 服务装配簇虽然依赖项很多，但职责集中在构造期，适合抽成独立后端 helper。
- 现有测试集足以覆盖本轮风险；若发现遗漏，只补最小必要契约检查。

## 风险
- 前端初始化簇会影响首屏、主题、欢迎提示与语音生成入口，依赖注入遗漏会影响页面可用性。
- 后端服务装配簇连接 auth、maintenance、queries、mutations 等核心模块，抽离失误会影响全局行为。
- 契约测试若继续绑定 `app.js` 单文件文本实现，后续拆分仍会出现误报。

## 完成标准
- `public\js\app.js` 不再直接承载完整的页面初始化簇实现，只保留装配或薄封装。
- `server\state-store.js` 中服务装配簇至少完成一轮可验证抽离。
- 新模块已接入加载链，相关测试通过。
- 本轮执行记录、验证结果、复盘完整写入 `docs\dev-records`。
- 本轮改动完成后提交一次 Git。

## 验证方式
- `node --check public\js\app.js`
- `node --check public\js\workspace-page-init-tools.js`
- `node --check server\state-store.js`
- `node --check server\state-store-services.js`
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
1. 盘点 `public\js\app.js` 中 `initSpeechTab`、`init` 与页面初始化簇的职责边界。
2. 抽离前端页面初始化模块并接入首页脚本链。
3. 更新页面契约测试。
4. 执行前端阶段回归并修复问题。
5. 盘点 `server\state-store.js` 中服务装配簇职责边界。
6. 抽离后端服务装配 helper。
7. 执行统一回归并修复问题。
8. 回写开发日志、验证结果、复盘。
9. 提交 Git。

## 执行顺序
1. 前端页面初始化簇盘点与拆分。
2. 前端契约测试更新。
3. 前端阶段回归。
4. 后端服务装配簇盘点与拆分。
5. 统一回归。
6. 文档回写。
7. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 盘点 `public\js\app.js` 中 `initSpeechTab`、`init`、欢迎提示与页面初始化编排逻辑的职责边界。
  - 确认这组逻辑主要依赖页面 DOM、toast、认证入口与现有页面 helper，适合抽为独立前端模块。
- 已完成 TODO 2：
  - 新增 `public\js\workspace-page-init-tools.js`。
  - 抽离 `AigsWorkspacePageInitTools`，承接语音页初始化与页面启动编排逻辑。
  - 在 `public\index.html` 中接入 `/js/workspace-page-init-tools.js`。
  - 在 `public\js\app.js` 中新增 `requireWorkspacePageInitTools()`，并将对应入口改为薄封装委托。
- 已完成 TODO 3：
  - 更新 `test-page-markup.js`，校验新 page-init 模块接入、浏览器导出与装配契约。
- 已完成 TODO 4：
  - 执行前端阶段回归，确认页面契约、前端状态与 UI smoke 测试通过。
- 已完成 TODO 5：
  - 盘点 `server\state-store.js` 中 `stateStore*` 服务构造与注入装配逻辑的职责边界。
  - 确认这组逻辑集中在构造期，适合抽成独立后端 services helper。
- 已完成 TODO 6：
  - 新增 `server\state-store-services.js`。
  - 抽离 core、bootstrap、snapshots、auth、maintenance、queries、conversations、users、mutations 与 facade 的服务装配逻辑。
  - 在 `server\state-store.js` 中改为通过 `createStateStoreServices(...)` 构建并返回 facade。
- 已完成 TODO 7：
  - 执行统一回归，覆盖前端、后端、迁移、契约和总 smoke。
- 已完成 TODO 8：
  - 已回写执行记录、验证结果、复盘。
- TODO 9 待执行：
  - 待完成提交前检查后执行 Git 提交。

## 复盘
- 新问题：
  - 本轮没有新增功能性问题，现有测试集对重构后的模块装配链覆盖仍然有效。
- 边界条件：
  - 本轮只拆了前端页面初始化簇与后端服务装配簇，没有碰业务协议、数据库 schema 或视觉层。
- 遗漏点：
  - `app.js` 仍保留少量零散 helper 和装配壳层，但已基本退回协调层。
  - `state-store.js` 已明显瘦身，剩余更多是 schema、statement 定义与最外层工厂壳。
- 是否回写规划：
  - 是。本轮结果已回写，下一阶段可以进入最后一轮收尾评估或停在当前可维护状态。

## 验证结果
- 语法检查通过：
  - `node --check public\js\workspace-page-init-tools.js`
  - `node --check public\js\app.js`
  - `node --check server\state-store-services.js`
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
- `public\js\app.js` 已由本轮开始前的 `3369` 行下降到 `3317` 行。
- `server\state-store.js` 已由本轮开始前的 `966` 行下降到 `873` 行。

## 下一阶段建议 TODO
1. 评估 `public\js\app.js` 剩余装配壳层是否还有必要继续拆分。
2. 评估 `server\state-store.js` 剩余 statement/schema 壳层是否保持现状更稳妥。
3. 做一次最终可维护性复盘与停手判断。
4. 如需继续，再拆最后一组低收益 helper。
