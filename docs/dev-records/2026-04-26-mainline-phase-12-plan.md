# 2026-04-26 主线第十二阶段连续开发计划

## 目标
- 继续按主线 TODO 收缩 `public\js\app.js` 与 `server\state-store.js`。
- 本轮优先拆分前端交互杂项 helper，再拆分后端对外 facade，保持现有用户行为不变。

## 范围
- 前端：
  - 拆分 `public\js\app.js` 中自定义下拉、复制/下载与输入错误提示 helper。
- 后端：
  - 拆分 `server\state-store.js` 中对外返回 API 的 facade 装配逻辑。
- 测试：
  - 更新 `test-page-markup.js` 等契约检查，验证新模块接入与导出。

## 非范围
- 不新增产品功能。
- 不修改数据库 schema。
- 不调整页面视觉样式。
- 不处理与本轮无关的未跟踪文档文件。

## 假设
- 前端这组 helper 主要依赖 DOM、toast 与现有下拉同步函数，适合抽成单独交互模块。
- 后端返回对象虽然方法较多，但边界稳定，适合抽成单独 facade helper，减少 `state-store.js` 尾部体积。
- 现有测试集足以覆盖本轮风险；若发现遗漏，只补最小必要契约检查。

## 风险
- 前端下拉与错误提示 helper 触及初始化和表单交互，依赖注入遗漏会影响工作台常见操作。
- 后端 facade 装配是状态仓库的对外契约层，抽离失误会影响全局调用面。
- 契约测试若继续绑定 `app.js` 文本实现，后续拆分仍会出现误报。

## 完成标准
- `public\js\app.js` 不再直接承载完整的交互杂项 helper 实现，只保留装配或薄封装。
- `server\state-store.js` 中对外 facade 至少完成一轮可验证抽离。
- 新模块已接入加载链，相关测试通过。
- 本轮执行记录、验证结果、复盘完整写入 `docs\dev-records`。
- 本轮改动完成后提交一次 Git。

## 验证方式
- `node --check public\js\app.js`
- `node --check public\js\workspace-ui-tools.js`
- `node --check server\state-store.js`
- `node --check server\state-store-facade.js`
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
1. 盘点 `public\js\app.js` 中下拉、复制/下载与输入错误提示 helper 的职责边界。
2. 抽离前端交互杂项模块并接入首页脚本链。
3. 更新页面契约测试。
4. 执行前端阶段回归并修复问题。
5. 盘点 `server\state-store.js` 中 facade 装配职责边界。
6. 抽离后端 facade helper。
7. 执行统一回归并修复问题。
8. 回写开发日志、验证结果、复盘。
9. 提交 Git。

## 执行顺序
1. 前端交互杂项 helper 盘点与拆分。
2. 前端契约测试更新。
3. 前端阶段回归。
4. 后端 facade helper 盘点与拆分。
5. 统一回归。
6. 文档回写。
7. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 盘点 `public\js\app.js` 中 `initCustomDropdown`、`downloadFile`、`copyToClipboard`、`showInputError`、`clearInputError` 的职责边界。
  - 确认这组逻辑主要依赖 DOM、toast 与下拉同步 helper，适合抽为独立前端交互模块。
- 已完成 TODO 2：
  - 新增 `public\js\workspace-ui-tools.js`。
  - 抽离 `AigsWorkspaceUiTools`，承接自定义下拉、复制/下载与输入错误提示逻辑。
  - 在 `public\index.html` 中接入 `/js/workspace-ui-tools.js`。
  - 在 `public\js\app.js` 中新增 `requireWorkspaceUiTools()`，并将对应入口改为薄封装委托。
- 已完成 TODO 3：
  - 更新 `test-page-markup.js`，校验新 workspace ui 模块接入、浏览器导出与装配契约。
  - 同步把聊天模型下拉点击事件的契约检查从 `app.js` 挪到新模块。
- 已完成 TODO 4：
  - 执行前端阶段回归，确认页面契约、前端状态与 UI smoke 测试通过。
- 已完成 TODO 5：
  - 盘点 `server\state-store.js` 中返回对象 facade 的职责边界。
  - 确认这组逻辑边界稳定，适合抽成独立 facade helper，减少装配文件尾部体积。
- 已完成 TODO 6：
  - 新增 `server\state-store-facade.js`。
  - 抽离状态仓库对外 API 的 facade 装配逻辑。
  - 在 `server\state-store.js` 中改为通过 `createStateStoreFacade(...)` 返回对外对象。
- 已完成 TODO 7：
  - 执行统一回归，覆盖前端、后端、迁移、契约和总 smoke。
- 已完成 TODO 8：
  - 已回写执行记录、验证结果、复盘。
- TODO 9 待执行：
  - 待完成提交前检查后执行 Git 提交。

## 复盘
- 新问题：
  - `test-page-markup.js` 中有一条老契约仍绑定 `app.js` 的旧实现位置，本轮已修正为绑定新模块，避免后续继续误报。
- 边界条件：
  - 本轮只拆了前端交互杂项 helper 与后端 facade helper，没有碰业务协议、数据库 schema 或页面视觉层。
- 遗漏点：
  - `app.js` 里仍剩 `initSpeechTab`、`init` 与少量零散页面 helper，可以继续按页面初始化簇再砍一轮。
  - `state-store.js` 现在已明显收缩，剩余更多是模块注入与少量构造期 glue code。
- 是否回写规划：
  - 是。本轮结果已回写，下一阶段可以继续沿着“前端初始化簇优先，后端构造期 glue code 收尾”的顺序推进。

## 验证结果
- 语法检查通过：
  - `node --check public\js\workspace-ui-tools.js`
  - `node --check public\js\app.js`
  - `node --check server\state-store-facade.js`
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
- `public\js\app.js` 已由本轮开始前的 `3429` 行下降到 `3369` 行。
- `server\state-store.js` 已由本轮开始前的 `1127` 行下降到 `966` 行。

## 下一阶段建议 TODO
1. 盘点 `public\js\app.js` 剩余的 `initSpeechTab`、`init` 与页面初始化 helper。
2. 再抽离一组前端初始化或页面编排模块。
3. 更新契约测试，继续降低对 `app.js` 文本实现的耦合。
4. 盘点 `server\state-store.js` 剩余的构造期注入 glue code。
5. 再拆一组低耦合后端 helper。
6. 执行阶段回归。
7. 回写文档并提交。
