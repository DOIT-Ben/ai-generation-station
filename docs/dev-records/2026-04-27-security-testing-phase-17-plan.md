# 2026-04-27 安全性测试第十七阶段计划

## 目标
- 继续沿安全主线补强静态资源与非 API 路径在不同 `Origin` 场景下的响应头与缓存相关行为验证。
- 先通过测试确认当前行为，再判断是否存在真实缺陷；只有命中问题时才做最小修复。

## 范围
- 测试脚本：
  - `test-security-gateway.js`
- 后端实现核验：
  - `server\index.js`
  - `server\lib\request-security.js`
  - `server\lib\http.js`
- 文档记录：
  - `docs\dev-records`

## 非范围
- 不继续扩展 Host / Unicode / IPv6 语法边界。
- 不修改 UI、数据库结构、认证业务流程或审计模型。
- 不做外网扫描、依赖漏洞扫描或压测。

## 假设
- 当前 `applyCorsHeaders()` 在所有请求上先执行，但只有 `\api\` 路径会因为跨源被明确拒绝。
- 静态资源与非 API 路径可能不会回显 CORS 头，但仍需要确认 `Vary: Origin`、缓存头和安全头是否出现意外组合。

## 风险
- 若把首页、静态资源、404 页面全混在一轮里，首次失败时根因不容易聚焦。
- 对非 API 路径来说，有些“缺少 CORS 头”是预期，有些“带了 Vary: Origin”可能是实现副作用，需要先定义清楚期望。
- 修复时要避免影响现有 API 路径已通过的 CORS 行为。

## 完成标准
- 已覆盖并验证至少以下场景：
  - 非 API HTML 路径的无 Origin / 允许 Origin / 拒绝 Origin 行为
  - 静态资源路径的无 Origin / 允许 Origin / 拒绝 Origin 行为
  - 上述场景的 `Vary: Origin` 与 CORS 头是否符合当前实现预期
- 若命中问题，完成最小修复并通过回归。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`
- 必要时 `npm test`
- `git diff --check`

## TODO
1. 盘点静态资源与非 API 路径当前头部行为，并定义每类请求的期望响应。
2. 为非 API HTML 路径补充一致性测试。
3. 为静态资源路径补充一致性测试。
4. 运行安全测试并判断是否暴露真实问题。
5. 若发现问题，做最小修复并回归。
6. 回写执行记录、验证结果、复盘。
7. 若有代码改动，提交 Git。

## 执行顺序
1. 缺口盘点。
2. HTML 路径回归。
3. 静态资源路径回归。
4. 执行与修复。
5. 文档回写。
6. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已盘点首页、404 路径与静态资源路径的当前头部行为。
  - 已确认当前实现不是“只对 API 做 CORS 头处理”，而是所有请求先走 `applyCorsHeaders()`：
    - 非 API 路径在带 `Origin` 时也会出现 `Vary: Origin`
    - 同源形态的非 API 路径与静态资源路径也会回显 `Access-Control-Allow-Origin`
    - 非 API 路径的跨源请求不会像 `\api\` 路径那样被 403 拦截
  - 已定义本轮期望为“锁定当前实现语义”，而不是先改策略。
- 已完成 TODO 2：
  - 在 `test-security-gateway.js` 中新增 `testNonApiOriginHeaderBehavior()`：
    - 首页无 Origin
    - 首页同源形态 Origin
    - 首页拒绝 Origin
    - 缺失静态路径同源形态 Origin
- 已完成 TODO 3：
  - 在 `testNonApiOriginHeaderBehavior()` 中补充静态资源路径回归：
    - `\css\account.css` 无 Origin
    - `\css\account.css` 同源形态 Origin
    - `\css\account.css` 拒绝 Origin
- 已完成 TODO 4：
  - 已执行新增安全测试与认证回归。
  - 本轮新增用例全部通过，没有打出新的静态资源 / 非 API 头部实现缺陷。
- 已完成 TODO 5：
  - 因本轮未发现新的真实问题，无需新增服务端代码修复。
- 已完成 TODO 6：
  - 已回写执行记录、验证结果与复盘。
- TODO 7 待执行：
  - 本轮尚未提交 Git。

## 验证结果
- 语法检查通过：
  - `node --check test-security-gateway.js`
- 安全测试通过：
  - `node test-security-gateway.js`
- 认证回归通过：
  - `node test-auth-history.js`

## 复盘
- 新问题：
  - 本轮没有打出新的业务实现缺陷。
  - 本轮把“非 API 路径也统一走 CORS 头处理”这一当前实现语义正式落成了自动化回归。
- 边界条件：
  - 当前非 API 路径的跨源请求不会被 403 拦截，这与 `\api\` 路径不同。
  - 这更像当前产品策略，而不是实现 bug；后续若要改变，需要单独立题，不应在本轮顺手改。
- 遗漏点：
  - 本轮尚未覆盖目录路径、更多静态文件类型或更细的缓存头策略。
  - 当前仍未补安全总报告的统一更新。
- 残余风险：
  - 当前未发现首页、静态资源、404 路径在不同 Origin 场景下出现意外的 CORS 头不一致问题。
- 是否回写规划：
  - 是。本轮已回写当前行为、测试覆盖与后续缺口。

## 当前结果
- 第十七阶段安全测试已完成：
  - 新增非 API HTML 路径头部行为回归
  - 新增静态资源路径头部行为回归
  - 当前未发现新的静态资源 / 非 API 头部缺陷

## 下一阶段建议 TODO
1. 更新安全总报告，把第十二到第十七阶段新增覆盖纳入正式统计口径。
2. 若主线继续，可再补更细的缓存头策略验证；否则可以收口到阶段总览与残余风险整理。
