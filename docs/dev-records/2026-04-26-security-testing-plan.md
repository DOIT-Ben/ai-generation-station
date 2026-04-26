# 2026-04-26 安全性测试连续开发计划

## 目标
- 对当前前后端项目继续完成一轮可执行、可复核的安全性测试。
- 优先验证认证、会话、CSRF、CORS、安全响应头、上传入口、权限边界与敏感错误暴露。
- 若发现明确安全缺陷，在不扩大改动面的前提下完成最小修复，并回归验证。

## 范围
- 后端：
  - `server\index.js`
  - `server\config.js`
  - `server\lib\csrf.js`
  - `server\lib\request-security.js`
  - 认证、会话、注册、找回密码、后台入口相关路由
- 前端：
  - 登录、注册、找回密码、后台入口与工作台鉴权跳转的安全相关行为
- 测试：
  - 现有安全测试脚本
  - 必要的最小补充测试
  - 本地安全配置与路由行为核验

## 非范围
- 不进行破坏性压力测试或 DoS 测试。
- 不引入新的安全中间件框架来重构整条链路。
- 不处理与安全测试无关的 UI 样式问题。
- 不触碰与本轮无关的未跟踪文档文件。

## 假设
- 仓库中已经具备一部分安全网关与认证相关测试，可作为本轮基线。
- 当前项目运行在本地受控环境，本轮可做安全边界验证但不做外部互联网扫描。
- 若发现问题，多数可通过局部配置、鉴权判断或响应处理修复，不需要大改架构。

## 风险
- 安全测试可能暴露启动链、Cookie、CSRF、CORS、权限判断等隐性问题，修复时需避免影响正常登录流。
- 某些测试依赖本地临时服务和独立端口，若端口或状态污染可能导致假失败。
- 如果继续扩面做“全安全审计”，会打断当前主线，所以本轮只聚焦高风险入口。

## 完成标准
- 已完成认证、会话、CSRF、CORS、安全头、上传入口、权限边界与错误暴露的测试执行与记录。
- 若发现明确安全问题，已完成最小必要修复并通过回归。
- 本轮目标、范围、假设、风险、TODO、验证结果、执行记录、复盘全部写入 `docs\dev-records`。
- 输出一份当前安全状态结论：已覆盖项、发现项、残余风险。

## 验证方式
- `node test-security-gateway.js`
- `node test-auth-history.js`
- `node test-failures.js`
- `npm run test:ui-flow -- --launch-server --port 18797`
- `npm test`
- 必要时补充 `node --check ...`
- `git diff --check`

## TODO
1. 盘点现有安全测试脚本、入口与高风险代码面。
2. 执行现有安全相关自动化测试并记录结果。
3. 逐项审计认证、会话、CSRF、CORS、安全头、上传入口与权限边界实现。
4. 若发现问题，先归类影响面，再做最小修复。
5. 执行统一安全回归并确认无新增回归。
6. 回写执行记录、验证结果、复盘与残余风险。
7. 若有代码改动，提交 Git。

## 执行顺序
1. 安全测试面盘点。
2. 自动化安全测试。
3. 高风险入口代码审计。
4. 问题修复。
5. 统一回归。
6. 文档回写。
7. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已确认仓库存在安全相关入口：`server\index.js`、`server\config.js`、`server\lib\csrf.js`、`server\lib\request-security.js`、`server\routes\local.js`、认证与后台相关路由。
  - 已确认仓库存在相关测试与发布门：`test-security-gateway.js`、`test-auth-history.js`、`test-failures.js`、`test-ui-flow-smoke.js`、`npm test`。
- 已完成 TODO 2：
  - 执行 `node test-security-gateway.js`，确认安全响应头、CORS、CSRF、Secure Cookie 等基础网关测试通过。
  - 执行 `node test-failures.js`、`node test-auth-history.js`、`npm run test:ui-flow -- --launch-server --port 18797`，确认认证流、失败路径和 UI 鉴权流未出现明显回归。
- 已完成 TODO 3：
  - 审计 `server\index.js`、`server\lib\http.js`、`server\lib\request-security.js`、`server\lib\csrf.js`、`server\routes\local.js`、`server\routes\state-auth-routes.js`、`server\routes\state-admin-routes.js`。
  - 人工构造畸形 Cookie 头 `bad=%E0%A4%A` 做输入对抗验证。
  - 发现真实问题：`server\lib\http.js` 中 `parseCookies()` 直接对 Cookie 值做 `decodeURIComponent()`，遇到畸形编码会抛 `URIError`，并且异常发生在统一请求错误处理之前，存在可触发的请求级崩溃风险。
  - 补充核验 `/output/*` 路由时，发现 `decodeURIComponent()` 对畸形路径编码也会走到统一 500 路径，错误粒度过粗。
- 已完成 TODO 4：
  - 对 `server\lib\http.js` 做最小修复：Cookie 解码失败时回退到原始值，不再抛异常。
  - 对 `server\routes\local.js` 做最小修复：畸形输出路径编码返回 `400` 与 `reason=invalid_path_encoding`，不再落入 500。
  - 对 `test-security-gateway.js` 增加安全回归用例：
    - 畸形 Cookie 请求不会击穿服务
    - 登录后访问畸形 `/output/*` 路径返回可控 400
- 已完成 TODO 5：
  - 重新执行安全测试与总 smoke，确认修复未引入认证、上传、UI 鉴权或主链回归。
- 已完成 TODO 6：
  - 已回写执行记录、验证结果、复盘与残余风险。
- TODO 7 待执行：
  - 待完成本轮 Git 提交。

## 验证结果
- 安全网关测试通过：
  - `node test-security-gateway.js`
- 认证与失败路径测试通过：
  - `node test-auth-history.js`
  - `node test-failures.js`
- UI 鉴权流测试通过：
  - `npm run test:ui-flow -- --launch-server --port 18797`
- 语法检查通过：
  - `node --check server\lib\http.js`
  - `node --check server\routes\local.js`
  - `node --check test-security-gateway.js`
  - `npm run check`
- 总 smoke 测试通过：
  - `npm test`（通过临时本地服务环境执行）
- 提交前检查待执行：
  - `git diff --check`

## 复盘
- 新问题：
  - 本轮发现的核心问题不是传统“鉴权绕过”，而是输入处理缺陷导致的请求级异常中断。这类问题很容易被功能测试漏掉，但会直接影响安全稳定性。
- 边界条件：
  - 本轮没有扩展到外部网络扫描、依赖 CVE 扫描或 DoS 压测，仍然聚焦本地可控的高风险入口安全验证。
- 遗漏点：
  - 现有安全测试已覆盖基础网关、认证与部分失败路径，但仍未覆盖所有异常编码、所有静态资源路径、所有管理员行为组合。
- 残余风险：
  - 当前未发现新的高危或中危鉴权绕过问题。
  - 仍建议后续继续补充以下低到中风险测试面：
    - 更多畸形 Header 与 Query 编码输入
    - 管理员接口更细粒度的越权与业务规则测试
    - 上传入口更多文件签名与 MIME 组合测试
    - 生产配置基线核验（尤其是 `APP_PASSWORD`、`CSRF_SECRET`、Cookie 策略）
- 是否回写规划：
  - 是。本轮已将发现项、修复点和后续建议回写。

## 当前结果
- 已确认基础安全网关存在并可工作：
  - 安全响应头
  - CORS 白名单控制
  - CSRF 双提交校验
  - HTTPS 场景下的 Secure Cookie 与 HSTS
  - 登录、找回密码、后台管理相关主链回归通过
- 已修复 1 个真实输入处理缺陷：
  - 畸形 Cookie 触发 `parseCookies()` 异常
- 已补 1 组安全回归：
  - 畸形 Cookie 与畸形输出路径编码处理

## 下一阶段建议 TODO
1. 扩展管理员接口越权与审计日志完整性测试。
2. 扩展上传入口文件签名、边界大小与异常 base64 输入测试。
3. 增加更多异常 Header、异常 Query 与异常 Cookie 的统一容错回归。
