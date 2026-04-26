# 2026-04-25 门户页左上品牌贴边微调计划

## 目标
微调 `account` 与 `admin` 页顶部门户导航的左上品牌区域，让品牌不再显得贴边，截图和真实页面里都更从容。

## 范围
- `public\css\style.css` 中 `portal-user-nav`、`portal-brand` 相关样式
- `test-ui-visual.js`
- `test-artifacts\visual-baseline` 中受本轮影响的门户页视觉基线
- 当前项目 `docs\dev-records` 中的执行记录

## 假设
- 当前问题主要来自门户导航容器左侧偏移与内部品牌缓冲不足，而不是 HTML 结构问题。
- 本轮最小方案只改 CSS 间距，不改文案结构、不改导航功能。
- 如果视觉回归差异只来自门户页顶部品牌位置变化，则允许刷新基线。

## 风险
- 左侧留白加大后，右侧导航按钮可用宽度会略微减少。
- 若改动过大，窄屏下门户导航可能更容易拥挤。
- 视觉基线需要在确认差异属于预期后再刷新。

## TODO
1. 复核门户导航左上品牌相关样式，确认最小改动点。
2. 调整门户导航容器与品牌区域左侧留白。
3. 运行浏览器级视觉验证，确认变化属于预期。
4. 如有必要，刷新视觉基线并复验。
5. 回写执行记录、验证结果与复盘。

## 完成标准
- `account` 与 `admin` 页左上品牌不再显得贴边。
- 门户导航其余功能与布局不受影响。
- 视觉回归最终通过。

## 验证方式
- `node test-ui-visual.js --port 18841 --launch-server`
- 如需刷新：`node test-ui-visual.js --port 18842 --launch-server --update-baseline`
- 刷新后复验：`node test-ui-visual.js --port 18843 --launch-server`

## 执行记录
- 2026-04-25：已定位到门户导航主样式位于 `public\css\style.css` 的 `.portal-user-nav` 与 `.portal-brand` 段。
- TODO 1 已完成。
- TODO 2 已完成。
  - 已将 `.portal-user-nav` 的桌面左侧偏移从 `24px` 调整到 `32px`。
  - 已将 `.portal-user-nav` 内边距调整为更偏左侧友好的 `10px 18px 10px 20px`。
  - 已给 `.portal-brand` 增加极小左侧缓冲，并微调品牌 mark 与文字间距。
  - 已同步收敛窄屏门户导航的左侧内边距，避免移动端视觉节奏失衡。
- TODO 3 已完成。
  - 已执行 `node test-ui-visual.js --port 18841 --launch-server`。
  - 首次视觉回归仅 `admin-console` 出现差异，差异量级 `0.1053%`，符合本轮预期中的品牌位置微调。
- TODO 4 已完成。
  - 已执行 `node test-ui-visual.js --port 18842 --launch-server --update-baseline` 刷新基线。
  - 首次复验时误将“刷新基线”和“复验”并行执行，导致视觉产物竞争，出现假失败。
  - 已改为串行单独执行 `node test-ui-visual.js --port 18843 --launch-server`，复验通过，全部截图 `0 px` 差异。
- TODO 5 已完成。

## TODO 1 复盘
- 新问题：暂无。
- 边界条件：
  - 只动门户页顶部导航的间距，不改工作台侧边栏和功能逻辑。
- 遗漏点：暂无。
- 是否回写规划：已回写，继续按 TODO 推进。

## TODO 2 复盘
- 新问题：无。
- 边界条件：
  - 间距调整必须足够小，不能让右侧导航区明显变窄。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 3 复盘
- 新问题：
  - 视觉回归失败本身属于预期内基线差异，不代表产品异常。
- 边界条件：
  - 只接受门户顶部品牌位置相关差异，不能把无关页面漂移一并纳入。
- 遗漏点：无。
- 是否回写规划：无需新增 TODO。

## TODO 4 复盘
- 新问题：
  - 视觉相关命令不能并行共享同一套基线/当前产物，否则会制造假失败。
- 边界条件：
  - 刷新基线与复验必须串行执行。
- 遗漏点：无。
- 是否回写规划：已回写执行经验。

## TODO 5 复盘
- 新问题：无。
- 边界条件：
  - 文档和验证结果已统一落到当前项目目录。
- 遗漏点：无。
- 是否回写规划：已完成。

## 验证结果
- `node test-ui-visual.js --port 18841 --launch-server`：首次失败，`admin-console` 差异 `0.1053%`，属于预期内品牌位置变化。
- `node test-ui-visual.js --port 18842 --launch-server --update-baseline`：已刷新视觉基线。
- `node test-ui-visual.js --port 18843 --launch-server`：通过，全部截图 `0 px` 差异。
- `node test-brand-title-typography.js`：通过。

## 复盘
- 新问题：
  - 本轮未发现新的产品级问题，但确认了视觉基线相关命令必须严格串行。
- 边界条件：
  - 本轮仅做门户顶部品牌左侧留白微调，没有扩展到字体、颜色或按钮布局重做。
- 遗漏点：
  - 未额外新增移动端截图回归，仅同步了移动端内边距以保持节奏。
- 是否回写规划：
  - 已完成回写。
