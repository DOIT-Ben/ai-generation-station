# AI 对话页稳定性、Markdown 清理与 Logo 接入计划

## 目标
- 修复展开长文时输入框被顶走的问题，确保输入区始终固定在页面底部。
- 清理 AI 回复中的 `---` 和未正确格式化的 Markdown 残留。
- 调整用户消息气泡在深色与护眼模式下的颜色表现。
- 修正上传按钮内部文字视觉未居中的问题。
- 将用户提供的 `AG-logo.png` 接入前端页面。

## 范围
- 仅处理聊天页前端结构、样式、消息格式化与 Logo 接入。
- 修改范围限定在：
  - `public\index.html`
  - `public\css\style.css`
  - `public\js\app.js`
  - 必要时更新测试文件
- 不改后端接口，不扩展业务功能。

## 假设
- 用户要的是当前页面稳定性与细节完善，而不是重新设计布局。
- Logo 使用用户提供文件：
  - `E:\desktop\AI\02_Agents\lab\AI-Generation-Stations\resources\images\AG-logo.png`
- “前端网址也能看到这个 logo”理解为：页面头部和浏览器页签都可见或可识别。

## 风险
- 消息格式化规则调整过大，可能影响现有 Markdown 渲染边界。
- Logo 是二进制文件，接入时需避免破坏现有资源结构。
- 输入区固定增强后，移动端与展开全文状态都要再次验证。

## TODO
1. 检查聊天输入区固定逻辑与展开全文交互的冲突点。
2. 检查消息 Markdown 格式化逻辑，清理 `---` 与未处理的 `#`、`**` 残留。
3. 调整用户消息气泡在深色与护眼模式下的颜色。
4. 修正上传区域按钮文案对齐。
5. 接入 `AG-logo.png` 到前端页面与页签。
6. 执行前端与 UI 验收，并回写执行记录、验证结果与复盘。

## 完成标准
- 输入框在展开长文后仍保持固定可输入。
- AI 回复不再出现无意义的 `---`、裸露的 `#` 或 `**` 格式残留。
- 用户消息气泡在深色模式不刺眼，在护眼模式不突兀。
- 上传按钮文字居中且视觉协调。
- 页面显式接入用户提供的 Logo。

## 验证方式
- 执行：
  - `node test-page-markup.js`
  - `node test-frontend-state.js`
  - `node test-ui-flow-smoke.js --port 18791`
  - `node test-ui-visual.js --port 18797 --launch-server`

## 执行记录
- 2026-04-24 已完成以下调整：
  - `public\js\app.js`
    - `normalizeChatMarkdownText` 增加清理规则：
      - 去掉单独占行的 `---`
      - 去掉 `· ##` 这类前置符号导致的伪标题
      - 去掉包裹标题的 `**`
      - 压缩过多空行
    - `applyInlineMarkdown` 增加对残留 `**` 的清理
    - `toggleAssistantMessageCompact` 在展开\收起长文后主动保证输入区仍保持在页面底部可见
  - `public\css\style.css`
    - 为 `chat-card` 增加固定高度，强化聊天主区与输入区的稳定高度链
    - 调整用户消息气泡：
      - 深色模式下不再过亮
      - 护眼模式下不再过深过突兀
      - 同步调整用户消息正文、链接、代码块、引用颜色
    - 调整上传区：
      - `drop-hint` 与 `drop-link` 改为更稳定的垂直居中
    - 接入 Logo：
      - 侧栏品牌位使用 `AG-logo.png`
      - logo 容器补充图片适配样式
    - 补充护眼模式覆盖：
      - `message-action-btn` 在护眼模式下提高对比度
      - 个人中心卡片、状态块和 checklist 恢复为淡黄纸感底色
  - `public\index.html`
    - 页签接入 favicon：
      - `/images/AG-logo.png`
    - 侧栏品牌位接入用户提供 Logo
- 已将用户提供图片复制到前端可访问目录：
  - `public\images\AG-logo.png`
- 已补充：
  - `test-page-markup.js`
    - 增加对 favicon 和 AG Logo 资源路径的静态校验

## 验证结果
- 已执行：
  - `node test-page-markup.js`
  - `node test-frontend-state.js`
  - `node test-ui-flow-smoke.js --port 18791`
  - `node test-ui-visual.js --port 18797 --launch-server`
- 结果：
  - 页面标记测试通过
  - 前端状态测试通过
  - UI flow smoke 通过
  - UI visual regression 通过
  - 最终 visual 结果：
    - `auth-portal-card: 0 px`
    - `utility-cluster-authenticated: 0 px`
    - `account-center-security: 0 px`
    - `admin-console: 44 px`
    - `chat-card-dark: 0 px`
    - `chat-card-light: 0 px`
    - `lyrics-card-light: 0 px`

## 复盘
- 这轮把“体验稳定性 + Markdown 清理 + 品牌接入”三个层面一次性补齐了。
- 当前结论：
  - 输入区固定性更强
  - 回复中的明显 Markdown 残留已被收敛
  - 用户消息颜色更柔和
  - 上传按钮文本对齐更稳
  - 前端已接入用户提供的 AG Logo
