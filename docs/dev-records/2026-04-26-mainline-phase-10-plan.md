# 2026-04-26 主线第十阶段连续开发计划

## 目标
- 继续按主线 TODO 收缩 `public\js\app.js` 与 `server\state-store.js`。
- 本轮优先拆分前端主题与配额壳层 helper，再拆分后端启动引导 helper，保持现有用户行为不变。

## 范围
- 前端：
  - 拆分 `public\js\app.js` 中主题切换、额度卡片折叠状态与额度摘要渲染 helper。
- 后端：
  - 拆分 `server\state-store.js` 中种子用户初始化、旧 JSON 迁移、系统模板种子与中断任务收尾 helper。
- 测试：
  - 更新 `test-page-markup.js` 等契约检查，验证新模块接入与导出。

## 非范围
- 不新增产品功能。
- 不修改数据库 schema。
- 不调整页面视觉样式。
- 不处理与本轮无关的未跟踪文档文件。

## 假设
- 主题与额度卡片逻辑主要依赖 `localStorage`、DOM 节点与用户偏好写回，适合抽成单独前端壳层模块。
- 启动引导逻辑虽然依赖较多 statement，但边界集中在初始化阶段，适合抽成单独后端 helper。
- 现有测试集足以覆盖本轮风险；若发现遗漏，只补最小必要契约检查。

## 风险
- 前端壳层 helper 会参与主题按钮、配额折叠和初始化流程，依赖注入遗漏会影响工作台首屏交互。
- 后端启动引导 helper 会影响默认账号、旧数据迁移和模板种子，若边界错位会影响历史测试与启动路径。
- 契约测试若仍绑定 `app.js` 文本细节，后续继续拆分时仍会误报。

## 完成标准
- `public\js\app.js` 不再直接承载完整的主题与额度卡片 helper 实现，只保留装配或薄封装。
- `server\state-store.js` 中启动引导职责至少完成一轮可验证抽离。
- 新模块已接入加载链，相关测试通过。
- 本轮执行记录、验证结果、复盘完整写入 `docs\dev-records`。
- 本轮改动完成后提交一次 Git。

## 验证方式
- `node --check public\js\app.js`
- `node --check public\js\workspace-shell-tools.js`
- `node --check server\state-store.js`
- `node --check server\state-store-bootstrap.js`
- `node test-page-markup.js`
- `npm run test:frontend`
- `npm run test:ui-flow`
- `node test-auth-history.js`
- `node test-state-maintenance.js`
- `node test-state-foreign-keys.js`
- `node test-state-migrations.js`
- `npm run check`
- `npm test`
- `git diff --check`

## TODO
1. 盘点 `public\js\app.js` 中主题切换与配额卡片 helper 的职责边界。
2. 抽离前端主题与配额壳层模块并接入首页脚本链。
3. 更新页面契约测试。
4. 执行前端阶段回归并修复问题。
5. 盘点 `server\state-store.js` 中启动引导 helper 的职责边界。
6. 抽离后端启动引导 helper。
7. 执行统一回归并修复问题。
8. 回写开发日志、验证结果、复盘。
9. 提交 Git。

## 执行顺序
1. 前端主题与配额壳层 helper 盘点与拆分。
2. 前端契约测试更新。
3. 前端阶段回归。
4. 后端启动引导 helper 盘点与拆分。
5. 统一回归。
6. 文档回写。
7. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 盘点 `public\js\app.js` 中 `normalizeTheme`、`setTheme`、`syncQuotaCardState`、`renderQuotaContent`、`bindQuotaToggle` 的职责边界。
  - 确认这组逻辑主要依赖 `localStorage`、DOM 节点、用户偏好对象与配额刷新回调，适合抽为独立前端壳层 helper。
- 已完成 TODO 2：
  - 新增 `public\js\workspace-shell-tools.js`。
  - 抽离 `AigsWorkspaceShellTools`，承接主题切换、额度卡片折叠、额度摘要与刷新按钮绑定逻辑。
  - 在 `public\index.html` 中接入 `/js/workspace-shell-tools.js`。
  - 在 `public\js\app.js` 中新增 `requireWorkspaceShellTools()`，并将相关入口改为薄封装委托。
- 已完成 TODO 3：
  - 更新 `test-page-markup.js`，校验新 workspace shell 模块接入、浏览器导出与装配契约。
- 已完成 TODO 4：
  - 执行前端阶段回归，确认页面契约、前端状态与 UI smoke 测试通过。
- 已完成 TODO 5：
  - 盘点 `server\state-store.js` 中 `ensureSeedUser`、`migrateLegacyJsonIfNeeded`、系统模板种子初始化与中断任务收尾逻辑的职责边界。
  - 确认这组逻辑集中发生在启动阶段，适合抽为独立后端启动引导 helper。
- 已完成 TODO 6：
  - 新增 `server\state-store-bootstrap.js`。
  - 抽离种子用户初始化、旧 JSON 迁移、系统模板种子写入与中断任务恢复逻辑。
  - 在 `server\state-store.js` 中改为通过 `stateStoreBootstrap.runStartupBootstrap()` 委托调用。
- 已完成 TODO 7：
  - 执行统一回归，覆盖前端、后端、迁移、契约和总 smoke。
- 已完成 TODO 8：
  - 已回写执行记录、验证结果、复盘。
- TODO 9 待执行：
  - 待完成提交前检查后执行 Git 提交。

## 复盘
- 新问题：
  - `app.js` 进一步退回装配层后，剩余热点已更明确地集中在聊天流程编排、通用表单交互与少量零散 UI helper。
- 边界条件：
  - 本轮只拆了前端主题/额度壳层和后端启动引导 helper，没有碰数据库 schema、接口协议或页面视觉层。
- 遗漏点：
  - `app.js` 里仍有聊天发送编排、通用输入反馈和部分本地页面 helper，下一轮需要继续按簇下刀。
  - `state-store.js` 仍保留事务、审计装配与模块注入 glue code，但体量已经明显下降。
- 是否回写规划：
  - 是。本轮结果已回写，下一阶段可以继续沿着“前端聊天流程编排优先，后端装配层继续瘦身”的顺序推进。

## 验证结果
- 语法检查通过：
  - `node --check public\js\workspace-shell-tools.js`
  - `node --check public\js\app.js`
  - `node --check server\state-store-bootstrap.js`
  - `node --check server\state-store.js`
- 契约检查通过：
  - `node test-page-markup.js`
- 前端阶段回归通过：
  - `npm run test:frontend`
  - `npm run test:ui-flow`
- 后端阶段回归通过：
  - `node test-auth-history.js`
  - `node test-state-maintenance.js`
  - `node test-state-foreign-keys.js`
  - `node test-state-migrations.js`
- 统一检查通过：
  - `npm run check`
  - `npm test`
- 提交前检查通过：
  - `git diff --check`
  - 说明：输出仅包含 CRLF 提示告警，无 diff 错误。

## 当前结果
- `public\js\app.js` 已由本轮开始前的 `3529` 行下降到 `3458` 行。
- `server\state-store.js` 已由本轮开始前的 `1227` 行下降到 `1166` 行。

## 下一阶段建议 TODO
1. 盘点 `public\js\app.js` 剩余的聊天发送编排、通用输入反馈与页面级绑定 helper。
2. 再抽离一组前端聊天编排或表单反馈模块。
3. 更新契约测试，继续降低对 `app.js` 文本实现的耦合。
4. 盘点 `server\state-store.js` 剩余的事务、审计装配与小型运行时 glue code。
5. 再拆一组低耦合后端 helper。
6. 执行阶段回归。
7. 回写文档并提交。
