# 2026-04-26 主线第四阶段连续开发计划

## 目标
- 继续按既定 TODO 顺序压缩主控文件，优先拆分前端通用生成编排与后端鉴权写路径。
- 在不改变现有业务行为的前提下，完成阶段回归、统一回归、文档回写与 Git 提交。

## 范围
- 前端：
  - 拆分 `public\js\app.js` 中通用生成控制、封面轮询、语音生成编排与结果落盘入口。
- 后端：
  - 拆分 `server\state-store.js` 中用户、session、password、token 相关写路径。
- 测试：
  - 清理对 `public\js\app.js` 物理位置的多余文本耦合，保留模块契约与行为检查。

## 非范围
- 不新增业务功能。
- 不改数据库 schema。
- 不调整页面视觉设计。
- 不处理与本轮无关的未跟踪文档文件。

## 假设
- 现有前端脚本链允许继续新增顺序加载模块。
- `state-store` 仍适合通过 helper 工厂渐进拆分，而不是一次性改导出结构。
- 当前测试集足以覆盖本轮主风险；若发现空白，只补最小必要测试。

## 风险
- 前端生成编排同时触及 loading、轮询、历史、结果渲染、额度刷新，依赖注入遗漏会直接影响用户生成流程。
- 封面与语音链各自带轮询状态机，拆分时如果把超时或错误处理接错，会导致假成功或按钮状态残留。
- 后端鉴权写路径与 session、token、密码校验强耦合，拆分时若事务边界不清可能影响登录、邀请、重置密码。
- 测试若仍依赖 `app.js` 物理位置文本，后续继续拆分时会反复误报。

## 完成标准
- `public\js\app.js` 不再直接承载通用生成编排整段实现。
- `server\state-store.js` 中用户、session、password、token 的写路径至少完成一轮职责抽离。
- 相关测试通过，且新增模块已接入 `public\index.html`。
- 本轮开发日志、验证结果、复盘完整写入 `docs\dev-records`。
- 本轮改动完成后提交一次 Git。

## 验证方式
- `node --check public\js\app.js`
- `node --check public\js\workspace-generation-tools.js`
- `node --check server\state-store.js`
- `node --check server\state-store-auth.js`
- `node test-page-markup.js`
- `npm run test:frontend`
- `npm run test:ui-flow`
- `node test-state-maintenance.js`
- `node test-state-foreign-keys.js`
- `node test-state-migrations.js`
- `node test-auth-history.js`
- `npm run check`
- `npm test`

## TODO
1. 盘点通用生成编排、封面轮询、语音生成编排与结果落盘的重复逻辑。
2. 抽离前端生成控制模块并接入首页脚本链。
3. 更新相关测试契约。
4. 执行前端阶段回归并修复问题。
5. 盘点 `server\state-store.js` 中用户、session、password、token 写路径与事务边界。
6. 抽离鉴权写路径模块。
7. 清理测试里对 `app.js` 文件物理位置的多余依赖。
8. 执行最终统一回归。
9. 回写开发日志、验证结果、复盘。
10. 提交 Git。

## 执行顺序
1. 前端生成控制模块。
2. 前端阶段回归。
3. `server\state-store.js` 鉴权写路径拆分。
4. 测试契约去物理位置耦合。
5. 最终统一回归。
6. 文档回写。
7. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 盘点 `public\js\app.js` 中 `generateContent`、`generateMusic`、`generateLyrics`、`pollImageStatus`、`generateCover`、`generateVoiceWithFile`、`generateVoiceWithUrl`、`generateVoice`、`doVoiceGenerate` 的共用生成编排逻辑。
  - 判定这些逻辑适合收敛为独立前端模块，避免继续把轮询、落盘、额度刷新和按钮态堆在 `app.js` 中。
- 已完成 TODO 2：
  - 新增 `public\js\workspace-generation-tools.js`。
  - 抽离 `AigsWorkspaceGenerationTools`，承接音乐、歌词、封面、语音生成与轮询逻辑。
  - 在 `public\index.html` 中接入 `/js/workspace-generation-tools.js`。
  - 在 `public\js\app.js` 中新增 `requireWorkspaceGenerationTools()`，并将对应入口全部改为委托调用。
- 已完成 TODO 3：
  - 更新 `test-page-markup.js`，改为检查新模块接入、模块导出与关键生成接口契约。
- 已完成 TODO 4：
  - 执行前端阶段回归，确认模块拆分后首页脚本链、生成入口和 UI 流程测试均通过。
- 已完成 TODO 5：
  - 盘点 `server\state-store.js` 中用户、session、password、token 写路径。
  - 确认适合抽离的职责边界包括用户创建、登录鉴权、session 管理、用户 token 生命周期、密码修改和密码重置。
- 已完成 TODO 6：
  - 新增 `server\state-store-auth.js`。
  - 将用户创建、鉴权、session、token、密码相关写路径抽离为 `createStateStoreAuth(...)`。
  - 在 `server\state-store.js` 中通过委托保持原有对外接口不变。
  - 拆分过程中发现 `test-auth-history.js` 触发 `stateStoreMutations.getConversationTimeline is not a function`。
  - 已补充 `getConversationTimelineSnapshot()` 与 `getConversationMessageSnapshot()`，修正写路径委托时的内部快照依赖。
- 已完成 TODO 7：
  - 继续清理测试契约，对 `app.js` 的物理位置耦合只保留必要入口检查。
- 已完成 TODO 8：
  - 已执行统一回归，覆盖前端、后端、契约和总检查。
- 已完成 TODO 9：
  - 本文档已补齐执行记录、验证结果和复盘。
- TODO 10 进行中：
  - 待完成提交前检查后执行 Git 提交。

## 验证结果
- 语法检查通过：
  - `node --check public\js\workspace-generation-tools.js`
  - `node --check public\js\app.js`
  - `node --check server\state-store-auth.js`
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

## 复盘
- 新问题：
  - `state-store` 的内部读写依赖仍较密，后续继续拆分时必须先识别“读快照 helper”和“写事务 helper”的边界，否则容易在委托时丢掉内部依赖。
- 边界条件：
  - 本轮只拆分了生成控制与鉴权写路径，没有继续动聊天渲染、页面样式或数据库 schema，避免改动面膨胀。
- 遗漏点：
  - 仍有大文件待后续阶段继续压缩，尤其是 `public\js\app.js` 和 `server\state-store.js` 的剩余职责。
- 是否回写规划：
  - 是。本轮执行结果已经回写，下一阶段可直接沿用“先前端主控再后端状态仓储”的顺序继续切分。

## 下一阶段建议 TODO
1. 盘点 `public\js\app.js` 剩余的工作区切换、事件绑定和渲染辅助职责。
2. 抽离工作区 UI 控制或事件绑定模块。
3. 更新页面契约测试，避免继续绑定单文件文本结构。
4. 盘点 `server\state-store.js` 剩余的会话内容、历史维护与清理职责。
5. 拆分一组低耦合的状态读写 helper。
6. 执行阶段回归。
7. 回写文档并提交。
