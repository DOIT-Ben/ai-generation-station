# 2026-04-27 安全性测试第九阶段计划

## 目标
- 从 mock 请求层继续下钻到 network-level，验证真实监听端口场景下 `remoteAddress` 回退是否符合预期，避免只在测试桩里看到 `unknown`，却遗漏真实网络链路的安全回退行为。
- 保持最小改动原则，优先通过自动化测试验证现状；只有命中真实缺陷时才做最小修复。

## 范围
- 测试脚本：
  - `test-security-gateway.js`
- 后端实现核验：
  - `server\lib\request-security.js`
  - `server\routes\state-route-helpers.js`
  - `server\routes\state-auth-routes.js`
  - `server\index.js`
- 文档记录：
  - `docs\dev-records`

## 非范围
- 不修改 UI、数据库结构、CORS 主逻辑或与本轮无关的业务流程。
- 不做外网扫描、压测、依赖漏洞扫描。
- 不把整套测试从 mock 迁到真实网络，只补必要的 network-level 验证。

## 假设
- 真实监听端口时，请求会带有 `socket.remoteAddress`，本地回退地址通常表现为 `127.0.0.1` 或 `::1` 归一化后的 `127.0.0.1`。
- `buildAuditActor()` 与限流仍共享 `getClientIp()` 结果。
- 通过本地 `http.request` 即可验证与 mock transport 不同的回退行为。

## 风险
- network-level 测试需要真实占用端口，若资源回收不干净，容易污染后续测试。
- 真实网络请求涉及端口选择与启动时序，若没有封装好等待逻辑，容易出现假失败。
- 若本轮同时覆盖审计与限流，失败时要先分清是 remoteAddress 读取问题还是原有代理头逻辑问题。

## 完成标准
- 已覆盖并验证至少以下边界：
  - `TRUST_PROXY=true` 且代理头无效时，真实网络请求的 `actorIp` 回退为本地回环地址
  - `TRUST_PROXY=false` 时，即使伪造 `X-Forwarded-For` / `X-Real-IP`，真实网络请求仍以 socket 地址作为 `actorIp`
- 若命中问题，完成最小修复并通过回归。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`
- 必要时 `npm test`
- `git diff --check`

## TODO
1. 盘点 network-level `remoteAddress` 当前测试缺口与最小可行验证路径。
2. 为 `TRUST_PROXY=true` 下无效代理头的真实回退地址补充测试。
3. 为 `TRUST_PROXY=false` 下忽略伪造代理头的真实回退地址补充测试。
4. 运行安全测试并判断是否暴露真实问题。
5. 若发现问题，做最小修复并回归。
6. 回写执行记录、验证结果、复盘。
7. 若有代码改动，提交 Git。

## 执行顺序
1. 缺口盘点。
2. `TRUST_PROXY=true` network-level 回归。
3. `TRUST_PROXY=false` network-level 回归。
4. 执行与修复。
5. 文档回写。
6. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已确认当前缺少真实监听端口场景下的 `remoteAddress` 回退验证。
  - 已确定最小可行路径：
    - 仅将“被测请求”切到 network-level
    - 继续用现有 mock 管理员登录与审计查询读取结果
    - 避免整套测试迁移到真实网络
- 已完成 TODO 2：
  - 在 `test-security-gateway.js` 中新增最小 network-level helper：
    - `withListeningServer(...)`
    - `requestOverNetwork(...)`
    - `registerWithCsrfOverNetwork(...)`
  - 已补充 `TRUST_PROXY=true` 下无效 `X-Real-IP` 的真实回退测试：
    - 通过真实监听端口完成公开注册
    - 查询 `user_public_register` 审计
    - 断言 `actorIp` 回退为 `127.0.0.1`
- 已完成 TODO 3：
  - 已补充 `TRUST_PROXY=false` 下忽略伪造代理头的真实回退测试：
    - 伪造 `X-Forwarded-For: 198.51.100.30`
    - 伪造 `X-Real-IP: 198.51.100.31`
    - 通过真实监听端口完成公开注册
    - 查询 `user_public_register` 审计
    - 断言 `actorIp` 仍为 `127.0.0.1`
- 已完成 TODO 4：
  - 已执行新增安全测试与认证回归
  - network-level 用例首次执行即通过，没有暴露新的真实业务缺陷
- 已完成 TODO 5：
  - 本轮未发现需要修复的真实业务问题
  - 因此无需新增服务端代码修复
- 已完成 TODO 6：
  - 已回写执行记录、验证结果、复盘
- 已完成 TODO 7：
  - 本轮提交信息已确定为：`test: add network remote address coverage`

## 验证结果
- 语法检查通过：
  - `node --check test-security-gateway.js`
- 安全测试通过：
  - `node test-security-gateway.js`
- 认证回归通过：
  - `node test-auth-history.js`
- 提交前检查通过：
  - `git diff --check`
  - 说明：仅存在 LF -> CRLF 提示，无 diff 错误

## 复盘
- 新问题：
  - 本轮没有打出新的业务实现缺陷。
  - 本轮补齐了真实监听端口场景下的 `remoteAddress` 回退验证，确认 mock transport 与真实网络的行为差异已被显式覆盖。
- 边界条件：
  - mock transport 下回退值为 `unknown`
  - real network 下回退值为 `127.0.0.1`
  - 两者都符合当前实现预期，但必须分别验证，不能混用断言
- 遗漏点：
  - 本轮仍未覆盖 Host 变体，例如尾点、大小写或特殊端口格式
  - 本轮仍未扩展更细的 Origin 规范化边界
- 残余风险：
  - 当前未发现 `TRUST_PROXY=true` 下无效代理头在真实网络中的回退异常
  - 当前未发现 `TRUST_PROXY=false` 下伪造代理头在真实网络中的越权影响
- 是否回写规划：
  - 是。本轮已回写 network-level 覆盖范围、验证结果与后续缺口

## 当前结果
- 第九阶段安全测试已完成并已提交：
  - 新增真实监听端口下的 `remoteAddress` 回退验证
  - 新增 `TRUST_PROXY=false` 忽略伪造代理头的 network-level 回归
  - 当前未发现新的业务缺陷
  - 已完成 Git 提交：`test: add network remote address coverage`

## 下一阶段建议 TODO
1. 继续扩展 Host 变体与更细的 Origin 规范化边界。
2. 继续补 CORS / 缓存相关头在异常来源下的一致性回归。
3. 若安全主线仍继续，可转向管理员敏感动作审计字段完整性。
