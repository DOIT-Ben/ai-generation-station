# 2026-04-26 主线第三阶段连续开发计划

## 目标
- 继续按既定顺序拆分前后端剩余高耦合主控文件，重点处理模板工作台、多业务 tab 编排、状态存储写路径与状态路由分块。
- 在不改变现有业务行为的前提下，完成本轮代码拆分、阶段回归、统一回归、文档留痕与 Git 提交。

## 范围
- 前端：
  - 拆分 `public\js\app.js` 中模板库、历史记录、模板应用、工作台 tab 切换相关入口
- 后端：
  - 拆分 `server\state-store.js` 的低风险业务写路径
  - 将 `server\routes\state.js` 按 `auth`、`workspace/account`、`admin` 分块
- 工程化：
  - 补齐本轮开发日志、阶段复盘、验证结果

## 非范围
- 不新增业务需求
- 不修改数据库 schema 语义
- 不调整现有页面视觉设计
- 不处理本轮无关的未跟踪文档文件

## 假设
- 现有前端脚本链继续允许以独立模块形式顺序加载
- `state-store` 可先拆“写路径 helper 工厂”，保持主导出接口不变
- `state.js` 可通过子路由表聚合方式拆分，不影响现有 `server\index.js` 的接线方式

## 风险
- 模板工作台与历史恢复会穿透多个 feature 字段，若依赖注入不完整，容易导致恢复/应用模板异常
- `switchTab` 关联工作区持久化与导航高亮，拆分时若遗漏动画或状态同步，会影响使用体验
- `state-store` 写路径涉及事务与 prepared statement，拆分时若参数传递遗漏会影响数据一致性
- `state.js` 路由表分块时，如果共享 helper 依赖不全，可能导致认证、管理员操作或工作区接口回归失败

## 完成标准
- `public\js\app.js` 不再直接承载模板库/历史/工作台 tab 切换整段实现
- `server\state-store.js` 至少完成一组低风险写路径抽离，并保持现有测试通过
- `server\routes\state.js` 主文件变为路由聚合入口，业务块按 `auth`、`workspace`、`admin` 分离
- 本轮开发日志、验证结果、复盘完整落到 `docs\dev`
- 本轮改动完成后提交一次 Git

## 验证方式
- `node --check public\js\app.js`
- `node --check public\js\workspace-template-tools.js`
- `node --check server\state-store.js`
- `node --check server\state-store-mutations.js`
- `node --check server\routes\state.js`
- `node --check server\routes\state-auth-routes.js`
- `node --check server\routes\state-workspace-routes.js`
- `node --check server\routes\state-admin-routes.js`
- `npm run test:frontend`
- `npm run test:ui-flow`
- `node test-state-maintenance.js`
- `node test-state-foreign-keys.js`
- `node test-state-migrations.js`
- `node test-auth-history.js`
- `npm run check`
- `npm test`

## TODO
1. 盘点模板库、历史记录、模板应用、tab 切换的依赖与重复逻辑。
2. 抽离前端工作台模板模块并接入首页脚本链。
3. 更新相关测试契约。
4. 执行前端阶段回归并修复发现的问题。
5. 盘点 `server\state-store.js` 中适合单独抽离的低风险写路径。
6. 抽离 `state-store` 写路径模块。
7. 盘点 `server\routes\state.js` 的 `auth`、`workspace/account`、`admin` 路由边界。
8. 拆分三组子路由模块并改为聚合出口。
9. 执行最终统一回归。
10. 回写开发日志、验证结果、复盘。
11. 提交 Git。

## 执行顺序
1. 前端模板工作台模块
2. 前端阶段回归
3. `server\state-store.js` 写路径拆分
4. `server\routes\state.js` 三段路由分块
5. 最终统一回归
6. 文档回写
7. Git 提交

## 执行记录
- 已建立本轮计划文档，后续按 TODO 顺序持续补充。
- 阶段 1 已完成：前端模板工作台模块
  - 新增 `public\js\workspace-template-tools.js`
  - 已抽离：
    1. `loadTemplateLibraries`
    2. `saveCurrentTemplate`
    3. `toggleTemplateFavoriteAction`
    4. `renderHistory`
    5. `loadAllHistories`
    6. `saveHistoryEntry`
    7. `restoreHistoryEntry`
    8. `applyTemplate`
    9. `switchTab`
  - 顺手清理了 `app.js` 内重复定义的 `switchTab`
  - `public\index.html` 已接入新脚本
  - `test-page-markup.js` 已补充新模块加载与发布契约检查
- 前端阶段验证结果：
  - `node --check public\js\workspace-template-tools.js`：通过
  - `node --check public\js\app.js`：通过
  - `node test-page-markup.js`：通过
  - `npm run test:frontend`：通过
  - `npm run test:ui-flow`：通过
- 阶段 2 已完成：`server\state-store.js` 低风险写路径拆分
  - 新增 `server\state-store-mutations.js`
  - 已抽离：
    1. 会话创建、更新、归档、恢复、删除
    2. 会话消息追加
    3. 历史记录写入
    4. 偏好写入
    5. 用量累加
    6. 任务创建与更新
    7. 用户模板创建与模板收藏切换
  - `server\state-store.js` 继续保留 schema、查询、鉴权密码链与审计主逻辑
- 阶段 2 过程修复：
  - 在 `test-auth-history.js` 回归时发现会话消息持久化链错误引用了不存在的 `stateStoreMutations.getConversationTimeline`
  - 已补充本地快照 helper `getConversationTimelineSnapshot`、`getConversationMessageSnapshot`，修复聊天回复落库链路
- 阶段 3 已完成：`server\routes\state.js` 三段路由分块
  - 新增 `server\routes\state-auth-routes.js`
  - 新增 `server\routes\state-workspace-routes.js`
  - 新增 `server\routes\state-admin-routes.js`
  - `server\routes\state.js` 现已退化为路由聚合入口
  - 三个子路由模块分别负责：
    1. `auth`：登录、注册、session、邀请、找回密码、重置密码
    2. `workspace`：历史、会话、偏好、用量、模板
    3. `admin`：用户管理、邀请管理、审计日志、密码重置
- 后端阶段验证结果：
  - `node --check server\state-store-mutations.js`：通过
  - `node --check server\state-store.js`：通过
  - `node --check server\routes\state-auth-routes.js`：通过
  - `node --check server\routes\state-workspace-routes.js`：通过
  - `node --check server\routes\state-admin-routes.js`：通过
  - `node --check server\routes\state.js`：通过
  - `node test-state-maintenance.js`：通过
  - `node test-state-foreign-keys.js`：通过
  - `node test-state-migrations.js`：通过
  - `node test-auth-history.js`：通过
- 最终统一回归结果：
  - `node -e "require('./server/state-store.js'); require('./server/routes/state.js')"`：通过
  - `npm run test:frontend`：通过
  - `npm run test:ui-flow`：通过
  - `npm run check`：通过
  - `npm test`：通过

## 最终结果
- `public\js\app.js` 从上一轮后的 `4518` 行继续下降到 `4390` 行
- `server\state-store.js` 从 `1829` 行下降到 `1725` 行
- `server\routes\state.js` 从 `889` 行下降到 `107` 行
- 本轮新增模块：
  1. `public\js\workspace-template-tools.js`
  2. `server\state-store-mutations.js`
  3. `server\routes\state-auth-routes.js`
  4. `server\routes\state-workspace-routes.js`
  5. `server\routes\state-admin-routes.js`

## 复盘
- 这轮最大的收益不是单纯“少了多少行”，而是主入口文件开始真正收缩成编排层：前端的模板工作台、后端的写路径、状态路由的三大业务块都已经有了清晰边界。
- 回归中暴露的问题说明当前拆分的主要风险在“委托接线”，不是业务语义本身；只要继续维持“小块拆分 + 分阶段回归”的节奏，主线可持续推进。
- 距离最终目标已经很近了，后续更适合继续处理的是：
  1. `public\js\app.js` 中通用生成流程与多业务 feature 入口
  2. `server\state-store.js` 中用户、会话、密码、token 写路径
  3. 页面层与控制层中剩余的物理位置耦合测试

## 下一轮 TODO
1. 盘点 `public\js\app.js` 中通用生成流程与各 feature 的重复入口。
2. 抽离通用生成控制模块，统一音乐、歌词、图片、翻唱、语音相关编排。
3. 复查 `server\state-store.js` 中用户、session、password、token 写路径的边界。
4. 拆分一组鉴权写路径模块，并补充针对性回归。
5. 继续清理测试里对具体文件位置的耦合，只保留模块契约检查。
6. 再做一次全量回归并提交。
