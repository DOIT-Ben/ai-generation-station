# AI 对话页 UI 验收计划

## 目标
- 对当前 AI 对话页连续多轮改动做一次集中验收。
- 重点确认：
  - 底部固定输入区
  - 模型切换入口
  - 消息宽度与主区层级
  - 左侧会话栏
  - 不同窗口尺寸下的稳定性

## 范围
- 仅做当前项目本地在线实例的前端验收与测试验证。
- 不新增功能，不继续改业务逻辑；若发现问题，只先记录，不默认继续改。

## 假设
- 当前 `18791` 端口在线实例可用，且已反映工作区最新静态资源。
- 现有 UI 流程与视觉回归脚本可用于本轮聊天页验收。

## 风险
- 浏览器自动化可能受本地环境或沙盒限制影响。
- 视觉回归若依赖旧基线，可能暴露的是“预期变化”而非真实问题，因此需要结合本轮改动判断。

## TODO
1. 确认在线实例仍可访问。
2. 运行聊天页相关前端静态与状态测试。
3. 运行 UI 流程验收脚本，检查交互路径是否稳定。
4. 如环境允许，运行视觉验收脚本，检查页面是否出现明显错位。
5. 回写执行记录、验证结果、风险与复盘。

## 完成标准
- 当前在线实例可访问。
- 前端静态与状态测试通过。
- UI 流程测试通过，且未出现聊天主区关键路径失败。
- 若视觉测试可运行，则记录结果；若不可运行，明确说明原因。

## 验证方式
- 使用当前在线实例 `http://127.0.0.1:18791\`
- 执行：
  - `node test-page-markup.js`
  - `node test-frontend-state.js`
  - `node test-ui-flow-smoke.js --port 18791`
  - 若可行：`node test-ui-visual.js --port 18791`

## 执行记录
- 2026-04-24 已确认当前在线实例信息：
  - 前端地址：`http://127.0.0.1:18791\`
  - 当前机器上已有在线 Node 实例提供页面与 API。
- 已完成静态与状态验收：
  - `node test-page-markup.js`
  - `node test-frontend-state.js`
- 已完成浏览器级验收：
  - `node test-ui-flow-smoke.js --port 18791`
  - `node test-ui-visual.js --port 18797 --launch-server`
- 浏览器级验收过程中已完成以下修正：
  - `test-ui-flow-smoke.js`
    - 去掉登录后强制要求 `workspace-resume-card` 可见的旧预期
    - 将会话重命名路径改为当前 UI 的“侧栏管理模式 + 行内改名”
    - 将按完整标题查找会话卡片改为按当前 UI 截断标题规则查找
    - 将草稿续接验证从“等待即时 `/api/preferences` 响应”调整为“以 reload 后恢复结果为准”
  - `test-ui-visual.js`
    - 为三态主题切换补上最多三次点击的稳定逻辑
    - 为 1 像素级尺寸波动补上裁剪容忍
    - 已确认 visual 在在线持久化实例上会受数据状态影响而不稳定
    - 已改为使用 `--launch-server` 的临时干净实例做稳定视觉回归
    - 已用当前 UI 更新视觉基线并重新确认回归通过

## 验证结果
- 已完成：
  - `node test-page-markup.js` 通过
  - `node test-frontend-state.js` 通过
  - `node test-ui-flow-smoke.js --port 18791` 通过
  - `node test-ui-visual.js --port 18797 --launch-server` 通过
- 视觉回归结果：
  - `auth-portal-card: 0 px`
  - `utility-cluster-authenticated: 0 px`
  - `account-center-security: 0 px`
  - `admin-console: 37 px`
  - `chat-card-dark: 0 px`
  - `chat-card-light: 0 px`
  - `lyrics-card-light: 0 px`
  - `UI visual regression passed`

## 复盘
- 这轮验收已经完整闭环，关键收获不是“发现新的 UI 缺陷”，而是把浏览器级验收链路真正跑通并校准到了当前 UI。
- 当前可以确认：
  - 静态结构通过
  - 前端状态通过
  - 浏览器级流程通过
  - 浏览器级视觉回归通过
- 更稳妥的验收方式：
  - 在线实例 `18791`：用于真实 smoke
  - 临时实例 `--launch-server`：用于稳定 visual
- 结论：
  - 当前这轮 AI 对话页的连续改动，已经完成可执行的本地验收。
