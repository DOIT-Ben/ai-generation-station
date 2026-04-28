# 2026-04-26 登录与注册拆分页面计划

## 目标
- 将登录和注册从同一个认证中心页签中拆成两个独立页面。
- 使用 `ui-ux-pro-max` 的页面设计思路，让登录页专注快速回到工作台，注册页专注创建账号和信任说明。

## 范围
- 新增 `public\login\index.html` 与 `public\register\index.html`。
- 调整 `public\auth\index.html`，保留找回密码、邀请激活、重置密码闭环，不再作为登录\注册二合一入口。
- 调整 `public\js\auth-page.js` 支持页面级默认模式与缺失 pane。
- 调整前端跳转：未登录默认去 `\login\`，注册入口去 `\register\`，忘记密码仍去 `\auth\`。
- 更新相关静态测试。

## 不在范围
- 不修改后端认证 API。
- 不改变邀请激活和密码重置 token 的后端生成路径，仍由 `\auth\?invite=` 和 `\auth\?reset=` 承接。
- 不重做个人中心或管理后台。

## 假设
- 用户要求“两个页面”指视觉和 URL 上独立的登录页、注册页，而不是同页隐藏切换。
- 公开注册是否可用仍由后端配置控制；注册页只提供入口和错误反馈。
- 登录成功后的欢迎提示仍保持“先进入主页，再显示提示”。

## 风险
- 旧测试和旧跳转仍可能断言 `\auth\` 是登录入口，需要同步更新。
- `auth-page.js` 原本默认存在登录、注册、找回三个 pane，拆页后必须允许部分 pane 不存在。
- 导航和未登录拦截如果仍指向 `\auth\`，用户会感觉拆页没有生效。

## TODO
1. 新增独立登录页 `public\login\index.html`。
2. 新增独立注册页 `public\register\index.html`。
3. 精简 `public\auth\index.html` 为账号恢复\邀请\重置页面。
4. 调整 `public\js\auth-page.js`，支持 `body[data-auth-default-mode]` 和拆页跳转。
5. 更新入口链接和未登录重定向到 `\login\`。
6. 更新测试并运行验证。
7. 复盘并记录验证结果。
8. 删除登录页和注册页之前沿用的旧 portal split UI，使用 `ui-ux-pro-max` 重新设计两个独立页面。
9. 按用户反馈回退登录\注册页的复杂展示结构，仅保留纯登录表单与纯注册表单，移除 `auth-v2-brand-panel`、预览卡片、步骤说明等无关组件。

## 完成标准
- `http://localhost:18791\login\` 是独立登录页。
- `http://localhost:18791\register\` 是独立注册页。
- `http://localhost:18791\auth\` 只承担找回密码、邀请激活、重置密码等辅助认证流程。
- 未登录访问工作台跳转到 `\login\?next=...`。
- 页面之间有清晰互链：登录页可去注册和找回密码，注册页可返回登录。
- 测试通过。

## 验证方式
- `node test-page-markup.js`
- `node test-ui-ux-security-polish.js`
- `npm run test:frontend`
- `npm run check`
- Playwright 打开 `\login\`、`\register\`、`\auth\` 做页面结构冒烟。

## 执行记录
- 已读取 `ui-ux-pro-max` 技能说明，采用“页面目标单一、状态清晰、入口互链明确”的设计约束。
- 已定位现有认证页结构在 `public\auth\index.html`，控制逻辑在 `public\js\auth-page.js`。
- 已定位旧登录入口在 `public\js\app.js` 与 `public\js\site-shell.js`。
- TODO 1 已执行：新增 `public\login\index.html`，页面只包含登录表单、去注册和找回密码的入口。
- TODO 2 已执行：新增 `public\register\index.html`，页面只包含注册表单、返回登录和找回密码入口。
- TODO 3 已执行：`public\auth\index.html` 已精简为找回密码、邀请激活、重置密码页面，不再呈现登录\注册页签。
- TODO 4 已执行：`public\js\auth-page.js` 支持 `body[data-auth-default-mode]`，并兼容拆页后部分 pane 不存在的情况；token 返回登录改为跳到 `\login\`。
- TODO 5 已执行：工作台、顶部 portal、个人中心、管理后台的未登录或退出跳转已改为 `\login\`；注册入口独立为 `\register\`。
- UI flow 初测发现 token 链接可能被带到 `\login\?invite=...`；已在 `auth-page.js` 增加 `redirectTokenIntentToRecoveryPage()`，当登录\注册页收到 `invite` 或 `reset` 参数时立即转交 `\auth\` 处理。
- TODO 6 已执行：更新 `test-page-markup.js`、`test-ui-flow-smoke.js` 与 `test-ui-ux-security-polish.js` 中拆页相关断言。
- 用户追加要求：登录和注册页面需要删除之前的 UI 设计并重新设计，且指定使用项目内 `ui-ux-pro-max-0.1.0`。已读取该 skill 的 README、`skill.json` 与 `.claude\skills\ui-ux-pro-max\SKILL.md`，本次采用其关键约束：清晰信息层级、表单标签可见、44px 以上触达尺寸、主题一致、移动端无横向滚动。
- TODO 8 已执行：删除 `public\login\index.html` 与 `public\register\index.html` 中旧 portal split 页面结构，重写为 `auth-page-v2` 独立设计。
- TODO 8 已执行：新增 `auth-v2-shell`、`auth-v2-brand-panel`、`auth-v2-form-panel`、`auth-v2-preview` 等样式，登录页展示工作区预览，注册页展示账号创建步骤。
- TODO 8 已执行：补充深色、浅色、纸张主题适配和 860px\480px 响应式规则。
- 用户追加反馈：登录和注册只需要纯表单，`auth-v2-brand-panel` 等组件属于无关内容，影响页面清爽度。
- TODO 9 计划：重写 `public\login\index.html` 与 `public\register\index.html` 为单卡片表单布局；清理 `public\css\style.css` 中 auth-v2 展示样式；更新测试断言为“不包含 auth-v2 展示组件”。
- TODO 9 已执行：`public\login\index.html` 已移除 `auth-v2-brand-panel`、工作区 preview、说明文案，保留登录表单、注册入口、找回密码入口。
- TODO 9 已执行：`public\register\index.html` 已移除 `auth-v2-brand-panel`、步骤栈、说明文案，保留注册表单、登录入口、找回密码入口。
- TODO 9 已执行：`public\css\style.css` 已将 auth-v2 复合布局替换为 `auth-simple-page`、`auth-simple-shell`、`auth-simple-card` 等纯表单样式，并保留深色、浅色、纸张主题适配。
- TODO 9 已执行：`test-page-markup.js` 与 `test-ui-ux-security-polish.js` 已增加反向断言，防止登录\注册页重新出现 `auth-v2-brand-panel`、preview、step 等无关组件。

## 验证结果
- `node test-page-markup.js`：通过。
- `node test-ui-ux-security-polish.js`：通过。
- `npm run test:frontend`：通过。
- `npm run test:ui-flow`：通过。
- `npm run check`：通过。
- Playwright 冒烟：
  - 未登录访问 `\` 自动跳转到 `\login\?next=%2F`。
  - `\login\` 显示 `#login-form`。
  - `\register\` 显示 `#register-form`。
  - `\auth\` 显示 `#forgot-form`，且不包含 `#login-form` 与 `#register-form`。
- 新登录\注册 UI 重做后验证：
  - `node test-page-markup.js`：通过。
  - `node test-ui-ux-security-polish.js`：通过。
  - `npm run test:frontend`：通过。
  - `npm run test:ui-flow`：通过。
  - `npm run check`：通过。
  - Playwright 截图已输出：`test-artifacts\auth-v2-login-desktop.png`、`test-artifacts\auth-v2-register-desktop.png`、`test-artifacts\auth-v2-login-mobile.png`。
  - 移动端检查：`scrollWidth` 等于 `clientWidth`，未产生横向滚动。
- 纯登录\注册修正后验证：
  - `node test-page-markup.js`：通过。
  - `node test-ui-ux-security-polish.js`：通过。
  - `npm run test:frontend`：通过。
  - `npm run check`：通过。
  - `npm run test:ui-flow`：通过。

## 复盘
- TODO 1 复盘：登录页目标单一，适合快速返回工作台；保留找回和注册链接，避免用户迷路。
- TODO 2 复盘：注册页目标单一，公开注册关闭时仍由后端返回明确错误，不在前端假判断。
- TODO 3 复盘：`\auth\` 不再承载登录注册，可避免“一个页面什么都放”的拥挤感；邀请和重置 token 仍保持兼容。
- TODO 4 复盘：控制脚本改为页面默认模式而不是强依赖页签，后续还可以承接恢复页。
- TODO 5 复盘：旧入口如果不改，用户会继续看到认证中心而不是独立登录页；已同步主入口和保护页跳转。
- 补充复盘：邀请\重置 token 是辅助认证流程，不能停留在登录页或注册页；拆页后必须显式做 token 转交，避免恢复流程被新入口吞掉。
- TODO 6 复盘：旧 UI flow 仍把 `\auth\` 当登录页，导致测试不符合新信息架构。已改为 `\login\` 登录、`\register\` 注册、`\auth\` 恢复，并通过完整冒烟。
- 总复盘：本次拆页没有改后端认证契约，前端信息架构已从“页签混合”调整为“三个明确入口”。当前改动尚未提交。
- TODO 8 复盘：旧登录/注册页面沿用通用 portal hero + form card，视觉像“认证中心拆出来的残留页”。新设计改为独立认证入口，表单任务更清晰；没有引入新前端框架，也没有改后端认证接口。
- 补充复盘：UI flow 曾因历史重复会话标题导致严格选择器匹配两个元素，已将该测试定位改为 `.first()`，这是对历史数据稳定性的修补，不改变业务行为。
- TODO 9 复盘：用户反馈表明登录\注册页不需要品牌展示面板、产品预览或步骤说明；这些内容虽然视觉更满，但偏离“纯认证表单”的目标。当前必修问题已处理，非阻塞项是后续若要再做视觉增强，只能围绕表单卡片本身做间距、字体、状态优化，不能再加入额外展示组件。
