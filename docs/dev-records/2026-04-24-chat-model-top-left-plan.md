# AI 对话页模型选择框左上角布局计划

## 目标
- 将聊天页模型选择框调整为更像 ChatGPT 首页的布局。
- 把模型选择框放到对话框左上角，而不是和输入框同一行并排。

## 范围
- 仅处理聊天 composer 的前端结构与样式。
- 修改范围限定在：
  - `public\index.html`
  - `public\css\style.css`
- 不改聊天逻辑，不改后端，不改其他功能页。

## 假设
- 用户要的是视觉与布局位置上的调整，不是更换模型逻辑。
- “左上角”理解为：位于 composer 内部左上角的小浮层位置，输入主行不再被它挤占。

## 风险
- 若绝对定位处理不当，可能在移动端遮挡输入区。
- 若 composer 上边距补偿不够，模型按钮可能压住输入框。

## TODO
1. 调整 composer 结构，让模型选择脱离输入主行。
2. 调整 CSS，使模型选择固定在对话框左上角。
3. 保持移动端可用性。
4. 执行前端验证并回写记录。

## 完成标准
- 模型选择框位于对话框左上角。
- 输入主行只保留输入框、停止、发送。
- 页面现有交互不受影响。

## 验证方式
- 执行：
  - `node test-page-markup.js`
  - `node test-frontend-state.js`

## 执行记录
- 2026-04-24 已将模型选择框从输入主行中移出，改为 composer 内部左上角位置。
- 已完成改动：
  - `public\index.html`
    - 新增 `chat-composer-corner`
    - 将 `chat-model-select` 挂到 `chat-composer-corner` 中
    - 输入主行现在只保留输入框、停止、发送
  - `public\css\style.css`
    - 将 `chat-composer-shell` 改为相对定位容器
    - 给 composer 增加顶部留白，避免模型框压住输入区
    - 为左上角模型框增加绝对定位规则
    - 同步补齐移动端下的位置与留白

## 验证结果
- 已执行：
  - `node test-page-markup.js`
  - `node test-frontend-state.js`
- 结果：
  - 页面标记测试通过
  - 前端状态测试通过

## 复盘
- 这次是一个典型的单点布局修正，不需要动逻辑。
- 当前模型选择框已经更接近你要的“ChatGPT 首页左上角”感受，同时输入主行更干净了。
