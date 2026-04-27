# 2026-04-27 安全性测试第十六阶段计划

## 目标
- 从 Host 来源语法边界切回安全主线，补强 CORS 与缓存相关响应头在不同来源场景下的一致性验证。
- 先通过测试确认当前行为，再判断是否存在真实缺陷；只有命中问题时才做最小修复。

## 范围
- 测试脚本：
  - `test-security-gateway.js`
- 后端实现核验：
  - `server\lib\request-security.js`
  - `server\index.js`
- 文档记录：
  - `docs\dev-records`

## 非范围
- 不继续扩展 Host / Unicode / IPv6 语法边界。
- 不修改 UI、数据库结构、认证业务流程或审计模型。
- 不做外网扫描、依赖漏洞扫描或压测。

## 假设
- 当前系统已经覆盖 Origin 允许 / 拒绝本身，但未必系统验证了 `Vary`、`Access-Control-Allow-Origin`、缓存相关头在成功、拒绝、无 Origin 三类场景下的一致性。
- 这类问题更可能是“配置与响应头不一致”，而不是深层业务逻辑缺陷。

## 风险
- 若把 CORS、缓存、预检、静态资源全混在一轮里，首次失败时根因不容易聚焦。
- 某些响应头是“缺失即风险”，某些是“多了才风险”，断言必须先定义清楚期望。
- 修复时要避免误伤现有同源与受信任跨源场景。

## 完成标准
- 已覆盖并验证至少以下场景：
  - 无 Origin 请求的缓存 / Vary 行为
  - 允许 Origin 请求的 CORS 与缓存相关头一致性
  - 拒绝 Origin 请求的 CORS 与缓存相关头一致性
  - 预检请求的响应头一致性
- 若命中问题，完成最小修复并通过回归。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`
- 必要时 `npm test`
- `git diff --check`

## TODO
1. 盘点当前 CORS 与缓存相关头的测试缺口，并定义每类请求的期望响应。
2. 为无 Origin 请求补充一致性测试。
3. 为允许 Origin 请求补充一致性测试。
4. 为拒绝 Origin 与预检请求补充一致性测试。
5. 运行安全测试并判断是否暴露真实问题。
6. 若发现问题，做最小修复并回归。
7. 回写执行记录、验证结果、复盘。
8. 若有代码改动，提交 Git。

## 执行顺序
1. 缺口盘点。
2. 无 Origin 回归。
3. 允许 Origin 回归。
4. 拒绝 Origin 与预检回归。
5. 执行与修复。
6. 文档回写。
7. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已盘点当前 CORS 相关测试现状：
    - 已覆盖允许 Origin、拒绝 Origin、部分预检成功 / 失败场景
    - 但尚未系统断言无 Origin 请求、拒绝 Origin 请求、允许 Origin 请求与预检请求在 `Vary`、`Access-Control-Allow-Origin`、`Access-Control-Allow-Credentials` 上的一致性
  - 已定义本轮期望：
    - 无 Origin：不应带 `Vary: Origin`，不应带 `Access-Control-Allow-*`
    - 允许 Origin：应带 `Vary: Origin`，应带 `Access-Control-Allow-Origin` 与 `Access-Control-Allow-Credentials`
    - 拒绝 Origin / 预检：应带 `Vary: Origin`，不应带 `Access-Control-Allow-Origin`
- 已完成 TODO 2：
  - 在 `test-security-gateway.js` 的 `testSameOriginAndAllowedCors()` 中补充无 Origin 请求一致性回归。
- 已完成 TODO 3：
  - 在 `test-security-gateway.js` 的 `testSameOriginAndAllowedCors()` 中补充允许 Origin 请求与允许预检请求的一致性断言：
    - `Vary: Origin`
    - `Access-Control-Allow-Credentials`
- 已完成 TODO 4：
  - 在 `testSameOriginAndAllowedCors()` 与 `testDisallowedOriginAndSecureCookie()` 中补充拒绝 Origin 与拒绝预检请求的一致性断言：
    - `Vary: Origin`
    - 不回显 `Access-Control-Allow-Origin`
    - 不回显 `Access-Control-Allow-Credentials`
- 已完成 TODO 5：
  - 已执行新增安全测试与认证回归。
  - 本轮新增用例全部通过，没有打出新的 CORS / 缓存相关头实现缺陷。
- 已完成 TODO 6：
  - 因本轮未发现新的真实问题，无需新增服务端代码修复。
- 已完成 TODO 7：
  - 已回写执行记录、验证结果与复盘。
- TODO 8 待执行：
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
  - 本轮把 CORS 与 `Vary` 一致性从“隐含正确”变成了“有正式回归约束”。
- 边界条件：
  - 当前系统没有显式设置 `Cache-Control`、`Pragma`、`Expires` 等缓存头，本轮只覆盖与 CORS 直接相关的头一致性，不扩展到完整缓存策略设计。
  - 当前 `Vary: Origin` 只在存在 Origin 头时设置，这与当前实现预期一致。
- 遗漏点：
  - 本轮尚未覆盖静态资源响应在不同 Origin 下的缓存行为。
  - 本轮尚未覆盖跨源失败时是否需要更细的缓存策略约束。
- 残余风险：
  - 当前未发现无 Origin、允许 Origin、拒绝 Origin、预检请求之间的 CORS 头不一致问题。
- 是否回写规划：
  - 是。本轮已回写测试缺口、期望定义、验证结论与后续缺口。

## 当前结果
- 第十六阶段安全测试已完成：
  - 新增无 Origin 请求一致性回归
  - 新增允许 Origin 请求一致性回归
  - 新增拒绝 Origin 与预检请求一致性回归
  - 当前未发现新的 CORS / `Vary` 缺陷

## 下一阶段建议 TODO
1. 若继续主线，可补静态资源与非 API 路径在不同 Origin 下的缓存 / 头部行为。
2. 可更新安全总报告，把第十二到第十六阶段新增覆盖纳入正式统计口径。
3. 若阶段目标改为收口，可整理一份“当前安全测试完成面与残余风险总览”。
