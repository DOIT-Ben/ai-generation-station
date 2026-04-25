# 聊天输入区仅保留 chat-input-row 计划

## 目标
- 将聊天输入区收敛为仅保留 `chat-input-row` 作为主对话框组件。
- 移除外层多余的 composer 包裹层，降低结构复杂度。

## 范围
- 仅处理聊天输入区相关 HTML、CSS 和必要测试。
- 修改范围限定在：
  - `public\index.html`
  - `public\css\style.css`
  - `test-page-markup.js`
- 不改后端，不改聊天逻辑，不改其他功能页。

## 假设
- 用户当前要的是结构简化，不是再做新的视觉设计。
- 模型选择框仍保留在聊天主区左上角浮层，不需要依附输入区外层容器。

## 风险
- 去掉外层包裹后，输入区的边框、背景和圆角需要回收到 `chat-input-row` 自身，否则视觉会塌。
- 相关测试若仍检查旧结构，需要同步更新。

## TODO
1. 移除输入区外层多余包裹结构。
2. 将必要视觉样式收敛到 `chat-input-row`。
3. 清理对应的旧样式与测试断言。
4. 执行回归并回写记录。

## 完成标准
- 输入区只保留 `chat-input-row` 作为主对话框组件。
- 现有输入、停止、发送功能不受影响。
- 前端测试继续通过。

## 验证方式
- 执行：
  - `node test-page-markup.js`
  - `node test-frontend-state.js`
  - `node test-ui-flow-smoke.js --port 18791`

## 执行记录
- 2026-04-24 已完成：
  - 移除 `public\index.html` 中 `chat-composer-shell` 外层结构
  - 将输入区主结构收敛为仅保留 `chat-input-row`
  - 将原本属于外层容器的主要视觉样式并回 `chat-input-row`
  - 同步更新 `test-page-markup.js`，不再要求 `chat-composer-shell` 存在

## 验证结果
- 已执行：
  - `node test-page-markup.js`
  - `node test-frontend-state.js`
  - `node test-ui-flow-smoke.js --port 18791`
- 结果：
  - 页面标记测试通过
  - 前端状态测试通过
  - UI flow smoke 通过

## 复盘
- 这轮结构收敛已经达成目标：
  - 输入区只保留 `chat-input-row`
  - 现有交互和验收链未受影响
