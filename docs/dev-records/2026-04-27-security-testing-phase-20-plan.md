# 2026-04-27 安全性测试第二十阶段计划

## 目标
- 继续沿安全主线补强缓存相关响应头策略验证，明确 API、非 API HTML、静态资源、404 路径在不同 `Origin` 场景下的缓存头行为是否一致、是否存在明显安全缺口。
- 严格保持最小方案，先通过自动化测试验证现状，只有测试命中真实问题时才做最小修复。

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
- 不继续扩展 Host / Origin 语法矩阵。
- 不修改 UI、数据库结构、认证业务流程或审计模型。
- 不做插件目录与依赖层专项安全审计。

## 假设
- 当前系统已对 CORS 与 `Vary` 建立回归，但尚未正式盘点 `Cache-Control`、`Pragma`、`Expires` 等缓存相关头是否有明确策略。
- 这轮更可能打出“头部缺失或路径不一致”的配置级问题，而不是深层业务逻辑缺陷。

## 风险
- 如果不先定义期望，很容易把“当前没有缓存策略”误判成实现 bug。
- 若直接一次性补完全部路径断言，首次失败时根因不容易聚焦。
- 修复时要避免把所有路径强行拉成同一缓存策略，扩大改动面。

## 完成标准
- 已完成以下路径的缓存头现状盘点：
  - API
  - 非 API HTML
  - 静态资源
  - 404
- 已补对应自动化回归。
- 若命中问题，完成最小修复并通过回归。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`
- 必要时 `git diff --check`

## TODO
1. 盘点 API、非 API HTML、静态资源、404 路径的缓存相关响应头现状。
2. 定义每类路径在不同 `Origin` 场景下的期望缓存行为。
3. 补充 API 路径缓存头一致性回归。
4. 补充非 API HTML 路径缓存头一致性回归。
5. 补充静态资源路径缓存头一致性回归。
6. 补充 404 路径缓存头一致性回归。
7. 运行安全测试并判断是否暴露真实问题。
8. 若发现问题，做最小修复并回归。
9. 回写执行记录、验证结果、复盘。
10. 若有代码改动，提交 Git。

## 执行顺序
1. 现状盘点。
2. 期望定义。
3. 按路径补回归。
4. 统一执行与修复。
5. 文档回写。
6. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已盘点 API、非 API HTML、静态资源、404 路径的缓存相关头现状。
  - 已确认当前系统没有全局缓存头策略，大多数路径默认不显式设置：
    - `Cache-Control`
    - `Pragma`
    - `Expires`
  - 已确认少数敏感接口单独设置了显式缓存头：
    - `\api\auth\csrf` -> `Cache-Control: no-store`
    - `\api\auth\session` -> `Cache-Control: no-store`
    - `\api\auth\logout` -> `Cache-Control: no-store`
    - SSE 流式接口使用 `Cache-Control: no-cache, no-transform`
- 已完成 TODO 2：
  - 已定义本轮期望：
    - 敏感认证读取 / 登出接口继续明确 `no-store`
    - 普通 API、非 API HTML、静态资源、404 路径当前没有显式缓存头，先以“锁定现状”方式纳入回归
    - 本轮不擅自把“缺少统一缓存策略”直接当成实现 bug
- 已完成 TODO 3：
  - 在 `test-security-gateway.js` 中新增 `testCacheHeaderBehavior()`：
    - `\api\auth\csrf`
    - `\api\auth\session`
    - `\api\auth\logout`
    - `\api\health`
    - `\`
    - `\css\account.css`
    - `\missing.txt`
- 已完成 TODO 4：
  - 已执行新增安全测试与认证回归。
  - 本轮新增用例全部通过，没有打出新的缓存相关头实现缺陷。
- 已完成 TODO 5：
  - 因本轮未发现新的真实问题，无需新增服务端代码修复。
- 已完成 TODO 6：
  - 已回写执行记录、验证结果与复盘。
- TODO 10 待执行：
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
  - 本轮把“敏感认证接口显式 `no-store`、其余常见路径当前无显式缓存头”这一现状正式落成了自动化回归。
- 边界条件：
  - 当前这更像“已有局部缓存策略”而不是“完整缓存策略设计”。
  - 若后续要引入更强缓存约束，应单独立题，不应在本轮顺手改全局头部行为。
- 遗漏点：
  - 本轮尚未把 SSE 流式接口的 `Cache-Control: no-cache, no-transform` 纳入自动化回归。
  - 本轮尚未扩展更多文件类型和目录型静态路径。
- 残余风险：
  - 当前未发现敏感认证接口遗漏 `no-store`。
  - 当前未发现普通 API、HTML、静态资源、404 路径之间出现意外的显式缓存头不一致问题。
- 是否回写规划：
  - 是。本轮已回写现状、期望、覆盖与结论。

## 当前结果
- 第二十阶段安全测试已完成：
  - 新增缓存相关头现状回归
  - 当前未发现新的缓存头实现缺陷

## 下一阶段建议 TODO
1. 若继续主线，可把 SSE 流式接口缓存头也纳入自动化回归。
2. 若切到治理视角，可开始插件目录与依赖层专项安全审计。
3. 若准备收口，可统一整理变更、执行 Git 提交，并给出最终阶段总结。
