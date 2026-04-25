# 侧边栏导航可访问性语义修复记录

## 目标
修复审查报告中“主导航使用 `menubar/menuitem` 但没有完整菜单键盘交互”的问题，将侧边栏导航恢复为普通导航按钮语义，并保持当前页状态同步。

## 范围
- 修改 `public\index.html` 的侧边栏导航 role/tabindex 语义。
- 修改 `public\js\app.js` 的 tab 切换逻辑，更新 `aria-current`。
- 新增聚焦测试覆盖导航不再使用 `menubar/menuitem`，且切换逻辑维护当前页状态。
- 不重做导航视觉、不新增方向键菜单交互、不改移动侧边栏行为。

## 假设
- 侧边栏不是应用菜单，而是页面内功能导航；普通 `nav` + button 更符合当前交互。
- 所有导航按钮保持自然 tab 顺序比 roving tabindex 更适合当前实现。
- `aria-current="page"` 只应标在当前 active 导航项上。

## 风险
- 移除 `tabindex="-1"` 后，键盘用户可以逐项 Tab 到所有导航按钮；这是目标行为，但 tab 停留点会增加。
- 当前 `app.js` 存在两个同名 `switchTab`，实际以后面的实现为准；本轮只做必要同步，避免重构导航。

## TODO
1. 新增聚焦测试：验证 `public\index.html` 不再包含 `role="menubar"` 或 `role="menuitem"`。
2. 新增聚焦测试：验证导航按钮不再使用 `tabindex="-1"`。
3. 新增聚焦测试：验证 `app.js` 在切换导航时设置/移除 `aria-current`。
4. 修改 `public\index.html` 导航语义。
5. 修改 `public\js\app.js` tab 切换时同步 `aria-current`。
6. 运行聚焦测试、页面标记测试、前端测试、语法检查。
7. 复盘新问题、边界条件、遗漏点，并回写本文件。
8. 提交本轮导航可访问性修复。

## 完成标准
- 侧边栏导航不再使用菜单语义。
- 导航按钮不再使用 roving tabindex。
- 当前导航项的 `aria-current` 会随 tab 切换同步。
- 相关验证命令通过。

## 验证方式
- `node test-sidebar-nav-accessibility.js`
- `node test-page-markup.js`
- `npm run test:frontend`
- `npm run check`

## 执行记录
- 已完成根因调查：`public\index.html` 使用 `role="menubar"` 和多个 `role="menuitem"`，非当前 active 项设置 `tabindex="-1"`；`public\js\app.js` 切换 active class 时未同步 `aria-current`。
- TODO 1-3 已新增聚焦测试：`test-sidebar-nav-accessibility.js` 覆盖菜单语义移除、自然 tab 顺序、`aria-current` 切换同步。
- 预修复验证：`node test-sidebar-nav-accessibility.js` 失败，失败点为侧边栏导航仍使用 `menubar` 语义，符合预期。
- TODO 4 已完成：`public\index.html` 侧边栏导航移除 `role="menubar"`、`role="menuitem"` 和 `tabindex="-1"`，改用普通 `aria-label="工作台功能"`。
- TODO 5 已完成：`public\js\app.js` 在 tab 切换时为 active 导航项设置 `aria-current="page"`，并移除 inactive 项的 `aria-current`。
- 修复后聚焦验证：`node test-sidebar-nav-accessibility.js` 通过。

## 验证结果
- `node test-sidebar-nav-accessibility.js`：通过。
- `node test-page-markup.js`：通过。
- `npm run test:frontend`：通过，前端状态和页面标记测试通过。
- `npm run check`：通过。

## 复盘
- TODO 1-3 复盘：测试使用静态标记和脚本契约检查，足以覆盖本轮最小修复；不引入浏览器方向键测试，因为本轮选择移除菜单语义而非实现菜单交互。
- TODO 4-7 复盘：自然 tab 顺序会增加键盘停留点，但比错误菜单语义更符合当前功能导航；若后续要做方向键导航，应作为独立增强规划。
