# 当前任务

- 目标：修正顶部通用导航中 logo 旁品牌字体过扁的问题，让 `AI / Generation / Station` 更像品牌签名而不是被压缩的标签。
- 当前阶段：调整 `portal-brand` 文字的字号、字重、行高、字距与字体拉伸，优先改善个人中心等顶部导航页面的观感。
- 范围：仅处理顶部通用品牌区样式；不改 logo 图片、不改导航结构、不影响主工作台生成表单逻辑。
- 假设：截图来自 `/account/` 等使用 `portal-user-nav` 的页面；对应样式位于 `public/css/portal-components.css`。
- 完成标准：品牌文字纵向层级更舒展，`Generation` 和 `Station` 不再显得扁平拥挤；现有页面/样式契约测试通过。
- 验证方式：运行 `node test-style-contract.js`；必要时补跑 `node test-page-markup.js`；检查最近编辑文件诊断。
