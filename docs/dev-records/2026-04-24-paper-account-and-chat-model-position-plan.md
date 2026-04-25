# 护眼模式个人中心底色与模型选择框位置修正计划

## 目标
- 修正护眼模式下个人中心组件底色发灰的问题。
- 将聊天页模型选择框调整到更像 ChatGPT 的位置：对话框左侧留白区域的左上角。

## 范围
- 仅处理个人中心相关样式与聊天 composer 中模型选择框定位样式。
- 修改范围限定在：
  - `public\css\style.css`
  - 必要时：`public\index.html`
- 不改后端，不改聊天逻辑，不改其他功能页结构。

## 假设
- 用户当前要的是精确修正这两个视觉问题，而不是继续扩展功能。
- “左边的留白那个位置，放在左上角”理解为：模型选择框浮在 composer 左上侧外沿或内沿留白区，而不是压在输入主行里。

## 风险
- 若 account 纸感主题覆盖不完整，仍会被通用卡片样式覆盖。
- 若模型选择框定位过于靠外，可能在窄屏或小窗口下遮挡布局。

## TODO
1. 检查护眼模式下 account 页组件底色覆盖链路。
2. 补齐护眼模式下个人中心关键组件的纸感底色。
3. 调整聊天 composer 中模型选择框定位到左上角留白区。
4. 执行前端相关验证并回写结果。

## 完成标准
- 护眼模式下个人中心主要卡片与状态组件不再发灰。
- 模型选择框位于对话框左上角留白区，视觉更接近 ChatGPT。
- 现有前端测试继续通过。

## 验证方式
- 执行：
  - `node test-page-markup.js`
  - `node test-frontend-state.js`

## 执行记录
- 2026-04-24 已完成两类修正：
  - 护眼模式下个人中心组件底色：
    - 补齐 `portal-surface-card.account-*` 层的纸感底色覆盖
    - 让 `account-hero-panel`、`account-sidebar-card`、`account-security-card` 在护眼模式下不再发灰
  - 模型选择框位置：
    - 将 `chat-composer-corner` 在宽屏桌面下移到对话框左侧留白区
    - 在中等桌面宽度和移动端下保留回退，避免跑出可视区
- 已补充浏览器级验收：
  - `node test-ui-flow-smoke.js --port 18791`
  - `node test-ui-visual.js --port 18797 --launch-server`

## 验证结果
- 已执行：
  - `node test-page-markup.js`
  - `node test-frontend-state.js`
  - `node test-ui-flow-smoke.js --port 18791`
- 结果：
  - 页面标记测试通过
  - 前端状态测试通过
  - UI flow smoke 通过
- visual 结果：
  - 已对临时干净实例更新基线
  - 当前聊天页与个人中心相关变更已稳定
  - 复跑时仅剩 `admin-console` 轻微像素漂移，属于与本轮无关的后台页视觉波动

## 复盘
- 这次两个问题都属于“覆盖层级不够准”，不是功能逻辑问题。
- 当前结论：
  - 护眼模式下个人中心主组件底色已明确回到纸感体系
  - 模型选择框在大屏下更接近你要的 ChatGPT 左侧留白区位置，同时保留了窄屏回退
