# 2026-04-25 语音转文字组件颜色统一计划

## 目标
修复语音转文字区域中上传壳子、上传框、文件预览、提示条和结果卡片颜色不统一、不协调的问题。

## 范围
- `public\css\style.css` 中 `.transcription-*` 相关样式。
- 必要时补充最小样式契约测试。
- 不改语音合成、歌声翻唱、接口逻辑和页面结构。

## 假设
- 用户反馈的是 `tab-transcription` 页面里的几个视觉组件。
- 当前问题优先由 CSS 色彩系统不一致导致，最小方案是统一到现有主题变量与青色强调色体系。
- 不需要新增功能或调整上传交互。

## 风险
- 如果只改单个组件，仍可能与周围卡片不协调。
- 如果改得过重，可能影响其它共用 `.drop-zone` 或 `.result-area` 样式，因此应限定 `.transcription-*` 作用域。

## TODO
1. 复核语音转文字 HTML 结构和现有 `.transcription-*` CSS。
2. 设计最小颜色统一方案，限定到语音转文字区域。
3. 修改相关 CSS。
4. 运行样式与页面标记验证。
5. 回写执行记录与复盘。

## 完成标准
- 上传入口、拖拽框、文件预览、说明条、结果卡片使用同一套背景、边框、文字层级和强调色。
- 不改变语音转文字功能行为。
- 相关测试通过。

## 验证方式
- `node test-page-markup.js`
- `node test-style-contract.js`
- 如新增测试，则运行新增测试。

## 执行记录
- 2026-04-25：已确认本轮只处理语音转文字区域颜色统一问题。
- TODO 1 已完成：
  - 复核 `tab-transcription` 结构，涉及上传说明卡、拖拽上传框、文件预览、状态说明条、结果卡片和转写文本块。
  - 现有 CSS 中这些组件混用蓝色渐变、通用 surface、浅蓝提示、深色文本块，视觉来源不统一。
- TODO 1 复盘：
  - 新问题：转写文本块在浅色和纸张主题下仍使用深色背景，容易显得突兀。
  - 边界条件：不改页面结构和上传交互。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 2 已完成：
  - 采用 `.transcription-shell` 局部色彩 token：`--transcription-accent`、`--transcription-accent-soft`、`--transcription-panel`、`--transcription-border`、`--transcription-text-panel`。
  - 暗色主题保留青色科技感，浅色主题切到蓝色轻面板，纸张主题切到暖棕金。
- TODO 2 复盘：
  - 新问题：无。
  - 边界条件：局部 token 只影响 `.transcription-*` 组件，不改变通用 `.drop-zone`。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 3 已完成：
  - 已统一上传说明卡、拖拽框、文件预览、状态说明条、结果卡片的背景和边框来源。
  - 已让转写文本块使用主题化文本面板色，不再固定深色。
- TODO 3 复盘：
  - 新问题：无。
  - 边界条件：按钮颜色不在本轮范围内，继续使用全局按钮体系。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 4 已完成：
  - 新增 `test-transcription-color-consistency.js`，锁定语音转文字区域共享色彩 token。
  - 已运行相关验证。

## 验证结果
- `node test-transcription-color-consistency.js`：通过。
- `node test-page-markup.js`：通过。
- `node test-style-contract.js`：通过。

## 复盘
- 新问题：本轮未发现新的功能级问题。
- 边界条件：未运行浏览器截图，当前以 CSS 契约和页面标记验证为准。
- 遗漏点：未提交推送；当前工作区还包含上一轮品牌标题修复。
- 是否回写规划：已完成。
