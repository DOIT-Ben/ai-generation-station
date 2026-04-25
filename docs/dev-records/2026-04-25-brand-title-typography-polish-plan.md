# AI Generation 品牌字样排版优化记录

## 目标
- 优化侧边栏品牌字样 `AI Generation` 的字体比例、字号和视觉气质。
- 解决当前看起来偏扁、不够优美的问题。
- 让品牌字样在护眼、浅色、深色主题下都更挺拔、清晰、有设计感。

## 范围
- 仅处理品牌区域文字排版和必要的主题色表现。
- 允许修改的文件限定为：
  - `public\css\style.css`
  - 与本任务直接相关的测试文件
  - 本记录文件
- 不修改 Logo 图片、不改导航结构、不调整其他页面标题。

## 假设
- 用户说的 `AI Generation` 指侧边栏顶部 `.logo-text h1`。
- “字体字号可以再高一点，好像扁了”主要指字号、行高、字重、字母间距和字体 fallback 组合导致的横向压扁感。
- 当前应做最小视觉优化，而不是重做品牌系统。

## 风险
- 字号过大可能挤压侧边栏空间或在窄屏溢出。
- 字母间距过大可能让英文品牌松散。
- 主题色过重可能破坏护眼模式的柔和感。

## TODO
1. 定位当前品牌字样相关 CSS 和 HTML 结构。
2. 判断导致“扁”的排版因素，并确定最小设计方案。
3. 修改品牌字样排版样式。
4. 补充或更新测试，覆盖品牌字样关键样式。
5. 执行验证并复盘。

## 完成标准
- `AI Generation` 字号更高、更舒展，视觉上不扁。
- 文字在侧边栏中不溢出、不挤压导航。
- 深色、浅色、护眼主题下均保持清晰和协调。
- 相关测试通过。

## 验证方式
- 静态检查 CSS 选择器和改动范围。
- 运行页面结构或样式相关测试。
- 必要时使用浏览器读取 `.logo-text h1` 的计算样式。

## 执行记录
- 2026-04-25 13:25
  - 已接到用户反馈：`AI Generation` 字体字号可以高一点，当前看起来偏扁，希望更好看、优美。
  - 已归类：
    - 当前必修：优化品牌字样排版。
    - 可延后：完整品牌系统、Logo 图标重绘、导航整体重排。
    - 规划缺失：无，本记录已补规划。
- 2026-04-25 13:29
  - 已完成 TODO 1：定位品牌字样结构和 CSS。
  - 结构：
    - `public\index.html` 中 `.logo > .logo-icon + .logo-text`，文字为 `AI Generation`。
  - 当前样式：
    - `.logo-text` 使用 `var(--font-display)`。
    - 字号 `0.96rem`，字重 `700`，仅做横向渐变文字。
  - 已完成 TODO 2：确定最小设计方案。
  - 判断：
    - 当前显得扁，主要是字号偏小、行高缺失、字重不够有品牌感、没有字形渲染细节。
  - 方案：
    - 保留现有 `Syne` 字体，避免引入新字体和网络变更。
    - 把 `.logo-text` 做成更挺拔的 wordmark：
      - 增大字号。
      - 提高字重。
      - 设置更紧致但不压扁的行高。
      - 使用轻微正字距与 `font-stretch`。
      - 深色/浅色沿用冷暖渐变，护眼模式改成暖金纸张渐变。

### TODO 1-2 复盘
- 新问题
  - 未发现必须调整 HTML 的问题。
- 边界条件
  - 不引入新字体，不改变 Logo 图片。
- 遗漏点
  - 尚未检查浏览器实际计算样式。
- 是否回写规划
  - 已回写；继续执行 TODO 3。
- 2026-04-25 13:34
  - 已完成 TODO 3：修改品牌字样排版样式。
  - 修改内容：
    - `.logo` 间距从 `10px` 调整为 `12px`。
    - `.logo-text` 字号调整为 `clamp(1.08rem, 1.18vw, 1.28rem)`。
    - 字重调整为 `800`。
    - 增加 `line-height: 1.08`、`letter-spacing: 0.018em`、`font-stretch: 105%`、`text-rendering: geometricPrecision`、`white-space: nowrap`。
    - 为护眼模式增加暖金字标渐变。
    - 移动端展开侧栏时 `.logo-text` 字号调整为 `1.04rem`。
  - 已完成 TODO 4：新增 `test-brand-title-typography.js`。

### TODO 3-4 复盘
- 新问题
  - 第一次浏览器验证发现单行 `AI Generation` 在新字号下宽度约 `192px`，超过侧边栏品牌区可用空间。
  - 已归类为当前必修边界问题：品牌字样必须更高、更美，同时不能溢出侧边栏。
  - 已最小修正为两行 wordmark：
    - `.logo-text` 增加 `display: inline-block`、`width: min-content`、`max-width: 138px`。
    - `white-space` 改为 `normal`，并用 `text-wrap: balance` 让 `AI Generation` 在空格处形成更优雅的上下两行。
    - 行高从 `1.08` 收紧为 `0.98`，保持更挺拔的品牌块。
- 边界条件
  - `font-stretch` 若当前字体不完全支持，也不会破坏布局；核心改善来自字号、字重、行高和字距。
- 遗漏点
  - 尚未执行自动化验证和浏览器计算样式验证。
- 是否回写规划
  - 已回写；继续执行 TODO 5。

## 验证结果
- 已通过：
  - `node test-brand-title-typography.js`
  - `node test-page-markup.js`
- 浏览器计算样式验证已通过：
  - 条件：
    - 打开 `http://localhost:18791`
    - 登录测试账号
    - 强制 `data-theme="paper"`
  - 结果：
    - `text = AI Generation`
    - `fontSize = 17.6px`
    - `fontWeight = 800`
    - `lineHeight = 17.248px`
    - `letterSpacing = 0.3168px`
    - `whiteSpace = normal`
    - `width = 138`
    - `height = 34`
    - `logoWidth = 243`
    - `overflow = false`
    - 护眼模式渐变为 `#7b5a1d -> #c79947 -> #8f6a2a`
- 截图产物：
  - `docs\dev-records\2026-04-25-brand-title-typography-polish.png`

## 复盘
- 新问题
  - 单行大字号会溢出侧边栏，因此已调整为两行 wordmark。
- 边界条件
  - 本轮只修改品牌文字，不修改 Logo 图标、导航项和页面标题。
  - 移动窄侧栏仍隐藏 `.logo-text`，不影响移动导航。
- 遗漏点
  - 未做人工肉眼终审；已保留截图用于查看。
- 是否回写规划
  - 已回写。
  - 当前不需要新增业务修复 TODO。
