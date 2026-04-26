# 2026-04-26 主线第十五阶段连续开发计划

## 目标
- 在不扩大风险的前提下，继续对 `public\js\app.js` 做最后一轮低收益收尾。
- 本轮优先拆分前端转录/媒体文件 helper 簇；后端仅做停手评估，不为拆而拆。

## 范围
- 前端：
  - 拆分 `public\js\app.js` 中媒体文件体积格式化、类型标签、转录文件预览与实验提示 helper。
- 后端：
  - 评估 `server\state-store.js` 是否还存在同等级低耦合块；若无，则记录停手判断，不强行继续拆分。
- 测试：
  - 更新 `test-page-markup.js` 等契约检查，验证新模块接入与导出。

## 非范围
- 不新增产品功能。
- 不修改数据库 schema。
- 不调整页面视觉样式。
- 不处理与本轮无关的未跟踪文档文件。

## 假设
- 媒体文件与转录预览 helper 边界清晰，适合抽成独立前端模块。
- 后端当前剩余主要是 statement/schema/工厂壳层，继续拆的收益可能低于风险。
- 现有测试集足以覆盖本轮风险；若发现遗漏，只补最小必要契约检查。

## 风险
- 前端转录预览 helper 会影响上传后反馈、实验提示与表单持久化联动，依赖注入遗漏会影响转录体验。
- 后端如果继续强拆低收益块，可能只会增加模块跳转成本，不改善维护性。

## 完成标准
- `public\js\app.js` 不再直接承载完整的转录/媒体文件 helper 实现，只保留装配或薄封装。
- 对后端剩余壳层给出明确停手判断，并回写到 `docs\dev-records`。
- 新模块已接入加载链，相关测试通过。
- 本轮执行记录、验证结果、复盘完整写入 `docs\dev-records`。
- 本轮改动完成后提交一次 Git。

## 验证方式
- `node --check public\js\app.js`
- `node --check public\js\workspace-media-tools.js`
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
1. 盘点 `public\js\app.js` 中转录/媒体文件 helper 的职责边界。
2. 抽离前端媒体 helper 模块并接入首页脚本链。
3. 更新页面契约测试。
4. 执行前端阶段回归并修复问题。
5. 评估 `server\state-store.js` 是否还有同等级低耦合块。
6. 若无继续拆分收益，则回写停手判断。
7. 执行统一回归并修复问题。
8. 回写开发日志、验证结果、复盘。
9. 提交 Git。

## 执行顺序
1. 前端媒体 helper 盘点与拆分。
2. 前端契约测试更新。
3. 前端阶段回归。
4. 后端停手评估。
5. 统一回归。
6. 文档回写。
7. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 盘点 `public\js\app.js` 中 `fileToBase64`、`formatFileSize`、`normalizeMediaTypeLabel`、`getTranscriptionSelectedFile`、`syncTranscriptionFilePreview`、`renderTranscriptionExperimentalPlan` 的职责边界。
  - 确认该簇职责集中在媒体文件描述、转录文件预览和实验态结果文案，适合抽为独立前端模块。
- 已完成 TODO 2：
  - 新增 `public\js\workspace-media-tools.js`。
  - 抽离 `AigsWorkspaceMediaTools`，承接媒体文件编码、大小格式化、类型标签、转录文件选择与实验提示逻辑。
  - 在 `public\index.html` 中接入 `/js/workspace-media-tools.js`。
  - 在 `public\js\app.js` 中新增 `requireWorkspaceMediaTools()`，并把相关实现改为薄封装委托。
- 已完成 TODO 3：
  - 更新 `test-page-markup.js`，校验新 workspace media 模块接入、浏览器导出与装配契约。
- 已完成 TODO 4：
  - 执行前端阶段回归，确认语法检查、页面契约、前端状态与 UI smoke 测试通过。
- 已完成 TODO 5：
  - 评估 `server\state-store.js` 剩余内容结构。
  - 确认剩余主体已主要是建表 SQL、`db.prepare(...)` 语句集合与最外层工厂壳层。
- 已完成 TODO 6：
  - 基于停手评估，决定本轮不再继续拆分 `server\state-store.js`。
  - 判断原因：当前继续拆分只会把紧耦合 SQL/statement 壳层切散，模块跳转成本高于维护收益。
- 已完成 TODO 7：
  - 执行统一回归，覆盖前端、后端、迁移、契约、总 smoke 与提交前 diff 检查。
- 已完成 TODO 8：
  - 已回写执行记录、验证结果、复盘与停手判断。
- TODO 9 待执行：
  - 待完成本轮 Git 提交。

## 复盘
- 新问题：
  - 本轮没有发现新的结构性回归问题，阶段性风险主要集中在测试覆盖之外的真实媒体上传体验，但现有 smoke 与状态测试已覆盖核心装配链。
- 边界条件：
  - 本轮只处理前端媒体 helper 簇，不改动数据库 schema、接口协议和视觉样式。
  - `server\state-store.js` 本轮仅做停手评估，没有为了追求数字继续机械拆分。
- 遗漏点：
  - `public\js\app.js` 仍保留一部分协调层薄封装，这是当前模块化形态下的正常剩余，不再属于高价值拆分目标。
  - `server\state-store.js` 仍然偏长，但长度主要来自 schema/statement 壳层，不是新的行为混杂。
- 是否回写规划：
  - 是。已回写本轮停手判断，下一轮若继续推进，更适合做最终维护建议和残余风险清单，而不是继续大面积拆文件。

## 验证结果
- 语法检查通过：
  - `node --check public\js\workspace-media-tools.js`
  - `node --check public\js\app.js`
- 契约检查通过：
  - `node test-page-markup.js`
- 前端阶段回归通过：
  - `npm run test:frontend`
  - `$env:UI_SMOKE_LAUNCH_SERVER='1'; npm run test:ui-flow -- --launch-server --port 18797`
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
- `public\js\app.js` 已由本轮开始前的 `3249` 行下降到 `3206` 行。
- `server\state-store.js` 维持 `827` 行不变。
- 本轮新增 `public\js\workspace-media-tools.js`，承接转录/媒体 helper 簇。

## 下一阶段建议 TODO
1. 对当前模块化结果做最终维护性总结，整理剩余长文件的“可继续拆”与“不建议再拆”边界。
2. 若用户仍要求继续推进，只建议处理极少量独立 helper，不再触碰 `server\state-store.js` 主体壳层。
3. 将后续重心从“继续拆文件”转向“回归体验、性能与安全细修”。
