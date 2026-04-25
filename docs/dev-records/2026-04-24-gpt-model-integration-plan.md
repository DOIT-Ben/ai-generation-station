# GPT 系列模型接入计划

## 目标
- 将聊天能力切换为使用用户提供的 OpenAI 兼容接口：
  - `https://api.suneora.com/v1`
- 测试并确认可用模型。
- 将所有可用 GPT\o 系列聊天模型接入前端下拉框，支持选择与保存默认模型。

## 范围
- 仅处理聊天模型接入、模型列表接口、前端模型下拉与验证。
- 修改范围限定在：
  - `server\config.js`
  - `server\routes\service.js`
  - `server\route-meta.js`
  - `public\index.html`
  - `public\js\app.js`
  - 必要时：`.env`、`.env.example`、测试文件
- 不处理音乐、图片、语音等其他接口。

## 假设
- 用户当前要接入的是 OpenAI 兼容聊天模型，不要求同时替换其他业务能力提供方。
- 模型列表接口 `GET /models` 可用于拉取可选模型。
- 聊天走 `chat completions` 兼容接口即可满足当前页面需求。

## 风险
- 第三方兼容接口的流式响应格式可能与当前 MiniMax SSE 逻辑不同。
- 并非所有 `/models` 返回的模型都适合当前聊天页，需筛掉明显非聊天模型。
- 若模型过多，下拉框需要更宽并支持省略，不然会影响 UI。

## TODO
1. 核对当前聊天后端实现和兼容接口模型列表。
2. 为服务端增加 OpenAI 兼容配置与模型列表接口。
3. 将聊天接口改为使用 OpenAI 兼容聊天请求。
4. 将前端模型下拉改为动态加载可用模型并保存选择。
5. 用真实模型做联调测试并回写结果。

## 完成标准
- 服务端可从 `https://api.suneora.com/v1/models` 拉取模型。
- 聊天接口能使用所选 GPT\o 模型正常返回内容。
- 前端下拉框展示所有可用聊天模型，支持选择与持久化默认值。
- 基础前端与聊天联调通过。

## 验证方式
- 使用真实模型列表接口验证可用模型集合。
- 执行本地前端测试与聊天接口实测。

## 执行记录
- 2026-04-24 已完成接入：
  - 配置：
    - `.env`
    - `.env.example`
    - `server\config.js`
  - 聊天后端：
    - `server\routes\service.js`
      - 新增 `/api/chat/models`
      - `/api/chat` 改为使用 OpenAI 兼容 `chat/completions`
    - `server\index.js`
      - 为聊天模型接口和聊天接口增加聊天专用 API key 校验
    - `server\route-meta.js`
      - 增加 `/api/chat/models`
  - 前端：
    - `public\index.html`
      - 默认聊天模型切到 `gpt-4.1-mini`
    - `public\js\app.js`
      - 初始化时动态加载 `/api/chat/models`
      - 将模型列表渲染到聊天下拉框
      - 默认聊天模型逻辑切到 `gpt-4.1-mini`
    - `public\js\app-shell.js`
      - 本地 persistence 的默认会话模型切到 `gpt-4.1-mini`
  - 测试：
    - `test-page-markup.js`
    - `test-frontend-state.js`
      - 同步更新默认模型与旧 MiniMax 预期
- 已通过真实接口探测 `https://api.suneora.com/v1/models`，可用聊天模型共 `36` 个。
- 已通过真实后端联调确认：
  - `GET /api/chat/models` 可返回模型列表
  - `POST /api/chat` 使用 `gpt-4.1-mini` 可成功返回 `ok`

## 验证结果
- 已执行：
  - `node test-page-markup.js`
  - `node test-frontend-state.js`
  - 本地服务级联调：
    - `/api/chat/models`
    - `/api/chat`
  - `node test-ui-flow-smoke.js --port 18791`
  - `node test-ui-visual.js --port 18821 --launch-server`
- 结果：
  - 页面标记测试通过
  - 前端状态测试通过
  - 聊天模型列表接口通过
  - 聊天接口真实联调通过
  - UI flow smoke 通过
  - UI visual regression 通过
- 当前可用模型（已验证从接口成功拉取）共 36 个，前 12 个如下：
  - `gpt-4.1-mini`
  - `gpt-4.1`
  - `gpt-4o`
  - `chatgpt-4o-latest`
  - `gpt-4o-mini`
  - `gpt-5.4`
  - `gpt-5.2-chat-latest`
  - `gpt-4-turbo`
  - `gpt-4`
  - `gpt-3.5-turbo`
  - `gpt-3.5-turbo-0125`
  - `gpt-3.5-turbo-1106`

## 复盘
- 这轮不是简单换个下拉框，而是把聊天能力真正从 MiniMax 路径切到了 OpenAI 兼容提供方。
- 当前结论：
  - GPT\o 系列聊天模型已接入
  - 模型列表已动态加载
  - 默认模型已切到 `gpt-4.1-mini`
  - 前后端与浏览器级验收都已跑通
