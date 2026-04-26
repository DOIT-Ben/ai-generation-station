# 2026-04-26 聊天主链后续拆分执行计划

## 目标
- 继续拆分 `public\js\app.js`，完成聊天主链后续分层。
- 本次按既定顺序连续完成三个阶段：
  1. 发送编排层
  2. 失败恢复层
  3. 下一条主线拆分
- 每完成多个小阶段后统一做回归测试，测试通过后继续下一阶段。

## 范围
- 本次只处理前端聊天主链相关代码。
- 允许新增独立 JS 模块并更新首页脚本链。
- 允许更新测试，使其从“实现必须位于 app.js”转为“模块契约 + 加载链”。

## 不在范围
- 不修改后端接口行为。
- 不修改数据库设计。
- 不处理无关页面样式与业务 tab。
- 不清理当前工作区中用户已有的其他改动。

## 假设
- 当前无构建静态脚本架构继续适用，新增模块通过 `public\index.html` 顺序加载。
- `app.js` 保留同名薄封装是当前最低风险路径。
- 回归测试以现有前端与 UI smoke 为主，足以覆盖本次拆分回归。

## 风险
- 发送编排层和失败恢复层靠近聊天主入口，若依赖注入遗漏会直接影响聊天主流程。
- 摘录资产链状态较多，若拆分边界过大可能引发 UI 同步偏差。
- 旧测试仍有少量物理文件位置耦合，需要同步修正。

## 执行顺序
1. 阶段 A：发送编排层
2. 阶段 B：失败恢复层
3. 阶段 A+B 联合回归测试
4. 阶段 C：摘录资产链
5. 阶段 C 回归测试
6. 回写开发日志、验证结果、复盘
7. 提交 Git

## TODO
1. 盘点发送编排层依赖并抽离模块。
2. 盘点失败恢复层依赖并抽离模块。
3. 对阶段 A+B 做联合回归测试。
4. 评估“摘录资产链 vs 会话动作层”，择优继续。
5. 抽离摘录资产链模块。
6. 对阶段 C 做回归测试。
7. 更新开发文档与完整执行日志。
8. 提交 Git。

## 完成标准
- `public\js\app.js` 不再直接承载发送编排、失败恢复、摘录资产链完整实现。
- 首页聊天发送、流式显示、失败重试、摘录展示与摘录操作行为保持不变。
- 相关测试通过。

## 验证方式
- `node --check public\js\*.js`
- `node test-page-markup.js`
- `npm run test:frontend`
- `npm run test:ui-flow`
- `npm run check`

## 开发日志
- 已创建本次连续执行总计划，后续每阶段完成后持续补充。
- 阶段 A 已完成：发送编排层
  - 新增 `public\js\chat-send-tools.js`
  - 已抽离：
    1. `setChatLoading`
    2. `updateQueueIndicator`
    3. `performChatSend`
    4. `drainChatQueue`
    5. `stopChatGeneration`
    6. `sendChatMessageFromQueue`
  - `public\js\app.js` 已改为发送编排薄封装。
- 阶段 B 已完成：失败恢复层
  - 新增 `public\js\chat-failure-tools.js`
  - 已抽离：
    1. `describeChatFailure`
    2. `createFailedChatEntries`
  - `retryTransientAssistantMessage` 保留在 `app.js` 作为主流程入口。
- 阶段 A+B 联合验证结果：
  - `node --check public\js\chat-failure-tools.js`：通过
  - `node --check public\js\chat-send-tools.js`：通过
  - `node --check public\js\app.js`：通过
  - `node test-page-markup.js`：通过
  - `npm run test:frontend`：通过
  - `npm run test:ui-flow`：通过
  - `npm run check`：通过
- 阶段 A+B 过程修复：
  - 发现 `loadQuota` 采用 `window.loadQuota = async function ...` 的写法会导致根页面启动时出现 `loadQuota is not defined` 与 TDZ 类问题。
  - 已修复为函数声明 `loadQuota` 后再挂到 `window`，恢复未登录用户自动跳转到 `/login/` 的行为。
  - 发现 `test-ui-flow-smoke.js` 中 `waitForURL` 对当前跳转链路不稳定，已改为轮询 `page.url()` 的 `waitForPath()` 实现，减少导航事件时序抖动。
- 阶段 C 已完成：摘录资产链
  - 评估结论：相比会话动作层，摘录资产链状态更集中、依赖更自洽，更适合连续推进。
  - 新增 `public\js\chat-excerpt-tools.js`
  - 已抽离：
    1. 摘录状态默认值与规范化
    2. 摘录本地存储读写与 hydrate
    3. 摘录搜索、筛选、可见列表与 bundle 构造
    4. 摘录保存、删除、归档、批量归档、清空归档
    5. 摘录复制、插入输入框、跳回原文
    6. 摘录面板渲染
    7. `toggleChatExcerpt`
  - `public\js\app.js` 中对应函数均已改为薄封装。
- 阶段 C 验证结果：
  - `node --check public\js\chat-excerpt-tools.js`：通过
  - `node --check public\js\app.js`：通过
  - `node test-page-markup.js`：通过
  - `npm run test:frontend`：通过
  - `npm run test:ui-flow`：通过
  - `npm run check`：通过

## 最终结果
- `public\js\app.js` 已从本轮开始前约 `5055` 行进一步下降到 `4665` 行。
- 本次连续执行新增模块：
  1. `public\js\chat-failure-tools.js`
  2. `public\js\chat-send-tools.js`
  3. `public\js\chat-excerpt-tools.js`
- 首页脚本链已接入上述模块，并同步更新了 `test-page-markup.js`。
- `test-ui-flow-smoke.js` 已做稳定性修正，当前回归通过。

## 复盘
1. 聊天主链目前已经形成更清晰的层次：
   - 消息节点生成层
   - 消息显示运行层
   - 流式解析层
   - 发送编排层
   - 失败恢复层
   - 摘录资产层
2. 继续拆分的最大前端收益点，已经从聊天主链本身转移到：
   - 会话动作层
   - 阅读大纲层
   - 多功能工作台业务流
3. 旧测试的“物理文件位置耦合”已经明显减少，后续再拆 `app.js` 的阻力会比之前低很多。
