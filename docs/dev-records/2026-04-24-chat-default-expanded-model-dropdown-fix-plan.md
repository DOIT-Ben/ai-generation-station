# AI 对话默认全文、模型下拉与 AI 头像 Logo 计划

## 目标
- 将 AI 长回复改为默认展示全文，不再默认折叠。
- 修复聊天模型下拉框只显示一个模型的问题。
- 将 AI 对话消息头像替换为项目 Logo。

## 范围
- 仅处理聊天页前端展示逻辑与模型下拉初始化。
- 修改范围限定在：
  - `public\js\app.js`
  - `public\css\style.css`
  - 必要时：`public\index.html`
- 不改后端接口协议。

## 假设
- 用户明确要求默认全文，因此当前 compact 逻辑要改成 opt-in，而不是默认生效。
- 下拉框只显示一个模型，优先判断为前端初始化时序或选项刷新逻辑问题。
- AI 头像可直接复用现有 `AG-logo.png`。

## TODO
1. 将 AI 长回复默认展开。
2. 修复模型下拉初始化时序，确保动态模型列表真正可见。
3. 将 AI 回复头像替换为 Logo。
4. 执行回归并回写记录。

## 执行记录
- 2026-04-24 已完成：
  - AI 长回复默认改为全文展示，不再默认折叠
  - AI 思考态头像与聊天回复头像改为 `AG-logo.png`
  - 调整聊天模型下拉初始化时序：
    - 先初始化 dropdown
    - 再异步加载模型列表
  - 已通过本地模型列表验证，确认下拉可加载 36 个模型

## 验证结果
- 已执行：
  - `node test-page-markup.js`
  - `node test-frontend-state.js`
  - 本地模型列表接口抽样验证
  - `node test-ui-flow-smoke.js --port 18791`
  - `node test-ui-visual.js --port 18822 --launch-server`
- 结果：
  - 页面标记测试通过
  - 前端状态测试通过
  - 模型列表接口返回 `36` 个可用聊天模型
  - UI flow smoke 通过
  - UI visual regression 通过
  - 最终 visual：
    - `auth-portal-card: 0 px`
    - `utility-cluster-authenticated: 0 px`
    - `account-center-security: 0 px`
    - `admin-console: 39 px`
    - `chat-card-dark: 0 px`
    - `chat-card-light: 0 px`
    - `lyrics-card-light: 0 px`

## 复盘
- 这轮主要修的是“默认行为”和“初始化时序”。
- 当前结论：
  - AI 回复默认全文
  - 模型下拉不再只显示一个模型
  - AI 对话头像已替换为项目 Logo
