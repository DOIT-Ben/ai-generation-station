# 聊天模型下拉真实体感复检记录

## 目标
- 继续上一轮遗留项，复检聊天模型下拉初始化在真实浏览器里的主观体感。
- 对比低速接口下“无缓存占位”和“有缓存首屏直出”两种场景。
- 判断是否需要补充新的修复计划。

## 范围
- 仅验证聊天页模型下拉初始化体验。
- 本轮默认不改业务代码。
- 允许查看和运行的文件限定为：
  - `package.json`
  - `test-chat-input-paper-and-dropdown-init.js`
  - `test-page-markup.js`
  - 与浏览器复检直接相关的临时脚本或命令
  - `docs\dev-records\2026-04-25-chat-input-paper-and-dropdown-init-plan.md`

## 假设
- 上一轮实现已经完成缓存首屏直出与 loading 占位。
- 当前需要确认的问题不是静态断言，而是浏览器真实体感是否仍有明显卡顿。
- 低速网络可以通过 Playwright 拦截 `/api/chat/models` 并人为延迟来模拟。
- 若复检只发现主观可接受的短暂等待，不直接扩大到新功能开发。

## 风险
- 浏览器体感受本机性能、服务启动状态、缓存状态影响，单次观察可能不稳定。
- 人为延迟接口只能覆盖模型列表请求，不代表完整真实慢网。
- 如果发现新问题，需要先归类并补规划，不能在本轮直接发散修复。

## TODO
1. 确认当前工作树与服务运行状态，避免把无关变更或旧服务状态误判为体验问题。
2. 执行现有专项自动化验证，确认上一轮静态与逻辑断言仍通过。
3. 用浏览器复检无缓存低速场景：下拉首屏应立即展示当前模型与 loading 占位，接口返回后平滑切换为真实列表。
4. 用浏览器复检有缓存低速场景：下拉首屏应直接展示缓存模型列表，后台刷新后保持可用。
5. 完成复盘：记录新问题、边界条件、遗漏点、是否需要补规划。

## 完成标准
- 专项自动化测试通过。
- 无缓存低速场景下，下拉打开时不出现空白菜单。
- 有缓存低速场景下，下拉打开时能看到缓存模型列表。
- 接口返回后，真实模型列表正常替换占位或缓存内容，当前模型标识保持正确。
- 若发现新问题，已按“当前必修、可延后、规划缺失”归类并写回本记录。

## 验证方式
- 运行：
  - `node test-chat-input-paper-and-dropdown-init.js`
  - `node test-page-markup.js`
- 使用 Playwright 打开本地页面，并拦截 `/api/chat/models` 延迟返回。
- 分别清空和预置 `localStorage` 中的模型缓存，采集下拉菜单文本、数据来源标记与选项数量。

## 执行记录
- 2026-04-25 11:30
  - 已从上一轮记录确认遗留项：
    - 尚未做浏览器肉眼检查。
    - 尚未专门验证低速网络下“无缓存、只有占位”与“有缓存、后台刷新”两种场景的主观差异。
  - 已确认本轮不直接改业务代码，先按 TODO 顺序做复检。
- 2026-04-25 11:36
  - 已完成 TODO 1：确认当前工作树与服务运行状态。
  - `git status --short` 显示当前工作树已有大量既有改动和未跟踪文件，其中包含上一轮相关文件。
  - 3000 和 18797 端口当前未发现监听服务。
  - 判断：
    - 工作树脏状态不阻塞本轮复检。
    - 本轮不回滚、不整理无关改动。
    - 后续如需启动服务，应使用本轮验证命令显式启动，避免误连旧服务。

### TODO 1 复盘
- 新问题
  - 当前仓库存在大量既有改动，后续若要提交或清理，需要单独规划。
- 边界条件
  - 本轮只读取状态，不处理无关变更。
- 遗漏点
  - 未逐个审查无关改动来源，因为这会扩大本轮范围。
- 是否回写规划
  - 已回写；不新增修复 TODO。
- 2026-04-25 11:38
  - 已完成 TODO 2：执行现有专项自动化验证。
  - 验证通过：
    - `node test-chat-input-paper-and-dropdown-init.js`
    - `node test-page-markup.js`

### TODO 2 复盘
- 新问题
  - 未发现自动化断言退化。
- 边界条件
  - 当前验证只能证明结构、样式规则和初始化逻辑关键字仍存在，不能替代浏览器体感判断。
- 遗漏点
  - 尚未验证慢接口下真实打开下拉的可见表现。
- 是否回写规划
  - 已回写；继续执行 TODO 3。
- 2026-04-25 11:47
  - 执行浏览器复检脚本时发生超时。
  - 已按调试复核归类：
    - 当前必修：修复复检脚本的登录等待条件，否则无法完成 TODO 3。
    - 可延后：Playwright skill 自带检测脚本缺少依赖，后续可单独处理 skill 环境。
    - 规划缺失：无，本轮计划允许使用与浏览器复检直接相关的临时脚本。
  - 根因：
    - 页面 `domcontentloaded` 时 URL 仍是 `/`，随后前端才跳转到 `/auth/?next=%2F`。
    - 复检脚本过早判断“无需登录”，随后一直等待工作台元素，导致超时。
  - 已最小修复复检脚本：
    - 先等待登录表单、侧边栏或模型下拉任一关键元素出现。
    - 若出现登录表单则登录，再等待回到工作台。

### TODO 3 阻塞分支复盘
- 新问题
  - 验证脚本需要适配前端认证跳转的异步时序。
- 边界条件
  - 本次只修复验证脚本，不改认证流程。
- 遗漏点
  - 尚未重新执行浏览器复检。
- 是否回写规划
  - 已回写；继续执行 TODO 3。
- 2026-04-25 11:55
  - 第二次执行浏览器复检仍超时。
  - 根因：
    - `firstOpen` 打开下拉后菜单保持打开。
    - `waitForLive` 复用采集函数时再次点击 trigger，实际把菜单关闭，随后等待菜单可见直到超时。
  - 已最小修复复检脚本：
    - 采集前先判断 `.dropdown-menu.hidden` 状态。
    - 仅在菜单隐藏时点击 trigger。
    - 增加分段日志和 `finally` 关闭浏览器，避免后续失败残留 Playwright 进程。

### TODO 3 二次阻塞分支复盘
- 新问题
  - 验证脚本的下拉打开动作需要兼容“已打开”状态。
- 边界条件
  - 这仍属于复检脚本问题，不是产品功能结论。
- 遗漏点
  - 尚未得到最终无缓存慢接口结果。
- 是否回写规划
  - 已回写；继续执行 TODO 3。
- 2026-04-25 12:02
  - 已完成 TODO 3：无缓存低速场景浏览器复检。
  - 条件：
    - Playwright 打开 `http://localhost:18791`。
    - 拦截 `/api/chat/models` 并延迟约 `1200ms`。
    - 清空 `aigs.chat.model-options` 缓存。
  - 结果：
    - 首次打开下拉：
      - `source = loading`
      - `triggerText = GPT-4.1 Mini`
      - `menuText = 当前模型 GPT-4.1 Mini 模型列表 正在加载模型列表...`
      - `optionCount = 2`
      - `activeLabel = GPT-4.1 Mini`
      - `firstOpenAfterWorkspaceMs = 345`
    - 接口返回后：
      - `source = live`
      - `optionCount = 36`
      - `activeLabel = GPT-5.5 推荐高质量`
      - `liveAfterWorkspaceMs = 2543`
  - 截图已保存：
    - `docs\dev-records\2026-04-25-chat-dropdown-no-cache-slow.png`

### TODO 3 复盘
- 新问题
  - 未发现空白菜单；无缓存低速场景能立即展示当前模型和 loading 占位。
- 边界条件
  - 首屏占位到 live 的切换时间受登录完成后模型请求发起时机影响，本次数据仅代表本机验证。
- 遗漏点
  - 已补充截图记录；未做人工手动点击复测。
- 是否回写规划
  - 已回写；继续执行 TODO 4。
- 2026-04-25 12:03
  - 已完成 TODO 4：有缓存低速场景浏览器复检。
  - 条件：
    - Playwright 打开 `http://localhost:18791`。
    - 拦截 `/api/chat/models` 并延迟约 `1200ms`。
    - 预置 `aigs.chat.model-options` 缓存：
      - `Cached Fast Model`
      - `GPT-4.1 Mini`
  - 结果：
    - 首次打开下拉：
      - `source = cache`
      - `triggerText = GPT-4.1 Mini`
      - `menuText` 包含 `Cached Fast Model`
      - `optionCount = 2`
      - `activeLabel = GPT-4.1 Mini 默认`
      - `firstOpenAfterWorkspaceMs = 323`
    - 接口返回后：
      - `source = live`
      - `optionCount = 36`
      - `activeLabel = GPT-5.5 推荐高质量`
      - `liveAfterWorkspaceMs = 1428`
  - 截图已保存：
    - `docs\dev-records\2026-04-25-chat-dropdown-cache-slow.png`

### TODO 4 复盘
- 新问题
  - 未发现空白菜单；有缓存低速场景能首屏展示缓存模型列表。
- 边界条件
  - 缓存命中仅代表本地已有最近成功模型列表时的体验。
  - 接口返回后会按服务端默认模型刷新当前选中项，本次为 `GPT-5.5`。
- 遗漏点
  - 未测试缓存数据损坏场景，因为上一轮已有缓存读取容错逻辑，且本轮范围聚焦体感复检。
- 是否回写规划
  - 已回写；继续执行 TODO 5。

## 验证结果
- 已通过：
  - `node test-chat-input-paper-and-dropdown-init.js`
  - `node test-page-markup.js`
  - `node docs\dev-records\2026-04-25-chat-dropdown-recheck.playwright.js`
- 浏览器复检脚本最终输出：
  - 无缓存低速：
    - 首开 `source = loading`
    - 首开菜单包含 `正在加载模型列表...`
    - live 后 `source = live`
    - live 后 `optionCount = 36`
  - 有缓存低速：
    - 首开 `source = cache`
    - 首开菜单包含 `Cached Fast Model`
    - live 后 `source = live`
    - live 后 `optionCount = 36`
- 最新一次复跑数据：
  - 无缓存低速：
    - `firstOpenAfterWorkspaceMs = 342`
    - `liveAfterWorkspaceMs = 2249`
  - 有缓存低速：
    - `firstOpenAfterWorkspaceMs = 330`
    - `liveAfterWorkspaceMs = 1401`
- 截图产物：
  - `docs\dev-records\2026-04-25-chat-dropdown-no-cache-slow.png`
  - `docs\dev-records\2026-04-25-chat-dropdown-cache-slow.png`
- 进程检查：
  - 未发现仍在运行的 `2026-04-25-chat-dropdown-recheck.playwright.js`。
  - 未发现本轮残留的 `playwright_chromiumdev_profile-*` 浏览器进程。

## 复盘
- 新问题
  - 当前 `http://localhost:18791` 已有同项目服务运行。首次尝试再启动服务时出现 `EADDRINUSE`，本轮最终复用该服务完成验证。
  - Playwright skill 自带检测脚本在 skill 目录缺少 `playwright` 依赖，不能直接使用其 `detectDevServers()`，本轮改用项目已安装的 Playwright。
  - 复检脚本最初暴露两个脚本自身问题：
    - 登录等待过早判断，未等前端跳转到认证页。
    - 下拉菜单已打开时再次点击 trigger 会关闭菜单。
- 边界条件
  - 本轮只做复检和复检脚本修正，没有修改业务代码。
  - 低速网络通过延迟 `/api/chat/models` 模拟，不代表完整网络限速。
  - `GPT-5.5` 是本次服务端 live 返回后的默认选中表现，属于接口数据刷新后的结果。
- 遗漏点
  - 未做用户手动肉眼点击；但已用可见浏览器、截图和 DOM 数据完成自动化体感复检。
  - 未处理 Playwright skill 依赖缺失问题，因为这属于工具环境，可延后单独规划。
- 是否回写规划
  - 已回写。
  - 当前不需要新增业务修复 TODO；上一轮“卡一下才出来下拉框内容”的两个关键场景均已复检通过。
