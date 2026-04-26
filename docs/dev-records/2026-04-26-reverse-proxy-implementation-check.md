# 2026-04-26 反代实现检查记录

## 目标
- 判断当前项目是否已经实现反向代理能力。

## 范围
- 只读检查服务端路由、配置项和前端 API 调用方式。
- 不修改代码、不启动新功能、不调整部署配置。

## 假设
- 用户所说“反代”指本项目后端代前端请求第三方 API，避免浏览器直接暴露第三方接口和密钥。
- 如果项目还需要 Nginx、Caddy、Cloudflare 等入口层反代，本次仅判断仓库内是否有相关实现或配置。

## 风险
- “反代”可能指两类能力：应用层 API 代理，或部署入口层反向代理。需要分别判断。

## TODO
1. 检查服务端是否存在代理第三方 API 的路由。
2. 检查配置项是否支持上游 API Base URL 和 Key。
3. 检查前端是否调用本项目后端 API，而不是直接调用第三方 API。
4. 记录结论和复盘。

## 完成标准
- 明确回答是否已实现，以及实现在哪些文件。
- 区分“应用层反代”和“入口层反代”。

## 验证方式
- 使用 `rg` 检索代理相关配置、路由和前端请求。

## 执行记录
- 已检查 `server\config.js`：存在 `API_HOST=api.minimaxi.com`、`MINIMAX_API_KEY`、`CHAT_API_BASE_URL`、`CHAT_API_KEY` 等上游配置。
- 已检查 `server\routes\service.js`：`\api\chat`、`\api\chat\models` 由服务端请求 `CHAT_API_BASE_URL`，并通过服务端注入 `CHAT_API_KEY`。
- 已检查 `server\routes\service.js` 与 `server\routes\tasks\image.js`：语音、配额、图片等生成路由由服务端通过 `https.request` 请求 MiniMax 上游，并通过服务端注入 `MINIMAX_API_KEY`。
- 已检查 `public\js\app-shell.js`：前端聊天调用为 `apiClient.fetch('\api\chat')`，不是浏览器直接请求第三方上游。
- 已检查 `docs\dev\2026-04-19-reverse-proxy-runbook.md`：仓库有 Caddy 和 Nginx 入口层反代部署示例。

## 验证结果
- 应用层反代：已实现。浏览器请求本项目 `\api\...`，本项目后端再请求 MiniMax 或 Chat 上游，API Key 保留在服务端配置中。
- 入口层反代：仓库内有部署 runbook 和 `TRUST_PROXY` 等配置支持，但当前本地启动的是 Node 直连 `18791`；未看到仓库内正在运行的 Nginx\Caddy 配置文件。

## 复盘
- 新问题：用户如果问的是“线上域名入口是否已经接入 Nginx\Caddy\Cloudflare 反代”，仅靠仓库代码无法确认，需要看服务器部署环境。
- 边界条件：本次没有修改代码，只判断实现状态。
- 遗漏点：未登录生产服务器检查实际网关配置。
- 是否回写规划：已回写应用层反代、入口层反代支持和当前限制。
