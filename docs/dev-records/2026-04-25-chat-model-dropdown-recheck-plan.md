# 2026-04-25 Chat Model Dropdown Recheck Plan

## 目标
- 重新检查聊天模型下拉框是否仍存在小写 `gpt`、命名不统一、内容未居左对齐的问题。
- 以真实页面、接口返回、缓存影响和代码路径共同验证，避免只看单一测试得出误判。
- 若确认有残留问题，只做当前下拉框必要修复。

## 范围
- 聊天模型下拉框的数据来源、前端渲染、缓存读取、展示 label 和 CSS 对齐。
- 不处理非聊天模型下拉框，不扩展到无关页面。
- 不修改真实模型 ID 和请求参数。

## 假设
- 用户看到的残留问题可能来自旧服务进程、浏览器缓存、本地缓存 `aigs.chat.model-options`，或前端使用了旧缓存 label。
- 如果接口已修复但前端缓存仍保存旧 label，用户页面仍可能显示小写 `gpt`。

## 风险
- 仅重启服务不能修复用户浏览器旧缓存。
- 若前端直接信任缓存 label，服务端修复后的展示规范可能不会立即生效。
- 过度清缓存会影响其他偏好，因此优先做显示层规范化或缓存版本化。

## TODO
1. 检查代码中所有聊天模型 label 进入 UI 的路径，确认缓存是否可能保留旧小写 label。
2. 检查接口当前返回的模型 label，确认服务端格式化是否完整。
3. 浏览器实测下拉框全部选项，而不是只取前若干可见项。
4. 若发现残留问题，按最小范围修复。
5. 运行自动化和浏览器验证。
6. 写入复盘：新问题、边界条件、遗漏点、是否回写规划。

## 完成标准
- 真实页面全部聊天模型下拉项中，不出现以 `gpt-` 或 `chatgpt-` 开头的小写展示 label。
- 所有下拉项 label 左边界一致或在合理视觉误差内。
- 旧缓存不会导致用户继续看到旧小写 label。

## 验证方式
- `rg` 检查模型 label 相关代码路径。
- 直接请求 `/api/chat/models` 核对返回 label。
- Playwright 打开真实页面、清理或模拟旧缓存后检查全部下拉项文本和坐标。
- 运行相关 Node 测试。

## 执行记录
- TODO 1 检查结果：
  - `public\js\app.js` 的 `readCachedChatModelOptions` 会读取 `aigs.chat.model-options`。
  - `applyChatModelOptions` 原先直接使用 `item.label || item.display_name || item.id`，如果缓存里已有旧的 `gpt-5.2-2025-12-11` label，前端会继续展示小写。
  - 结论：用户说“还是有”成立，根因不是 CSS，而是前端缓存和渲染层缺少二次规范化。
- TODO 1 复盘：
  - 新问题：缓存会绕过服务端最新格式化结果。
  - 边界条件：不能清空用户全部 localStorage，只能处理模型列表缓存。
  - 遗漏点：上一轮只验证了服务端最新数据，没有模拟旧缓存。
  - 是否回写规划：已把缓存兼容纳入修复。
- TODO 2 检查结果：
  - 服务端 `server\routes\service.js` 已能格式化日期后缀 GPT label。
  - 残留风险位于前端缓存和前端直接渲染 API label 的路径。
- TODO 2 复盘：
  - 新问题：无。
  - 边界条件：真实模型 ID 保持小写，只改展示 label。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 3 浏览器复查：
  - 使用真实页面模拟缓存中仍保存小写 label 的情况。
  - 复查目标包括下拉框全部缓存项文本和 label 左边界。
- TODO 3 复盘：
  - 新问题：无。
  - 边界条件：本次模拟的是模型缓存路径，不包含非聊天下拉框。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 4 已修复：
  - `public\js\app.js` 新增 `CHAT_MODEL_OPTIONS_CACHE_VERSION = 2`。
  - 旧版 `aigs.chat.model-options` 缓存会被忽略，页面会重新拉取模型列表。
  - 新增 `formatChatModelDropdownLabel`，前端渲染前根据模型 ID 统一格式化展示 label。
  - `applyChatModelOptions` 改为使用前端格式化后的 label，避免新旧缓存或异常 API label 继续显示小写 `gpt`。
  - 新增 `test-chat-model-dropdown-label-cache.js` 覆盖旧缓存 label 的前端规范化。
- TODO 4 复盘：
  - 新问题：前后端存在一份相似 label 格式化逻辑；当前为了最小范围和浏览器端缓存兜底接受重复。
  - 边界条件：只对 `gpt-*`、`chatgpt-*`、`o*` 模式做格式化，其他未知模型 label 原样显示。
  - 遗漏点：无。
  - 是否回写规划：已记录重复逻辑风险。

## 验证结果
- `node test-chat-model-dropdown-label-cache.js`：通过。
- `node test-chat-model-options.js`：通过。
- `node test-chat-model-dropdown-visual.js`：通过。
- `node test-page-markup.js`：通过。
- `node --check public\js\app.js`：通过。
- Playwright 真实页面缓存模拟：
  - 临时启动当前代码服务 `http://localhost:18798`。
  - 写入带小写 label 的模型缓存：
    - `gpt-5.2-2025-12-11`
    - `gpt-5.2-pro-2025-12-11`
    - `chatgpt-4o-latest`
    - `o4-mini`
  - 页面展示结果：
    - `GPT-5.2 2025-12-11`
    - `GPT-5.2 Pro 2025-12-11`
    - `ChatGPT-4o Latest`
    - `o4 Mini`
  - `leftDelta = 0`，`hasLowercaseGpt = false`。
  - 临时 `18798` 服务已停止。
- TODO 5 复盘：
  - 新问题：无。
  - 边界条件：用户正在运行的旧服务仍需重启以加载新的前端 JS。
  - 遗漏点：无。
  - 是否回写规划：无需追加。

## 复盘
- 用户指出“还是有”是准确的：上一轮遗漏了前端缓存导致旧 label 继续显示的路径。
- 本次修复补在前端展示层和缓存版本层，能同时覆盖旧缓存、异常 API label 和服务端未重启前后的 UI 展示一致性。
- 对齐问题在复查中仍然通过，残留问题主要是命名大小写。
- 后续如果还出现类似问题，应优先检查 localStorage、session state、远端偏好和前端二次渲染路径，而不是只看接口返回。
