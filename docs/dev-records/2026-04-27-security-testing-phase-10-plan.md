# 2026-04-27 安全性测试第十阶段计划

## 目标
- 继续补强来源校验安全测试，聚焦“表面像 Origin、但实际带了 path / fragment / userinfo 的非法 Origin 字符串”，验证服务端不会把它们宽松归一化后错误放行。
- 保持最小改动原则，优先通过自动化测试命中真实缺陷；只有测试暴露问题时才做最小修复。

## 范围
- 测试脚本：
  - `test-security-gateway.js`
- 后端实现核验：
  - `server\lib\request-security.js`
- 文档记录：
  - `docs\dev-records`

## 非范围
- 不修改 UI、数据库结构、认证业务流程或审计模型。
- 不扩展到更大范围的 Host 解析重写。
- 不做外网扫描或依赖漏洞扫描。

## 假设
- 当前 `normalizeOrigin()` 基于 `new URL(...).origin` 做规范化，可能会把带 path / fragment / userinfo 的非法 Origin 头过度收敛成合法 origin。
- 合法浏览器 `Origin` 头不应带 path、query、fragment、username、password。
- 当前已有非法 Origin 被拒绝的基础回归，可在此基础上继续细化。

## 风险
- 若断言过严，可能把“大小写归一化”“默认端口归一化”这类合法规范化误判为缺陷。
- 若修复直接要求原始字符串与 `parsed.origin` 完全相等，可能会误伤大小写主机名这类应允许的情况。
- 需要把“规范允许的收敛”和“非法附加成分被吞掉”这两类情况分清。

## 完成标准
- 已覆盖并验证至少以下边界：
  - 带 path 的 Origin 不会被错误放行
  - 带 fragment 的 Origin 不会被错误放行
  - 带 userinfo 的 Origin 不会被错误放行
- 若命中问题，完成最小修复并通过回归。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`
- 必要时 `npm test`
- `git diff --check`

## TODO
1. 盘点 Origin 规范化当前测试缺口，并确认哪些样本会被过宽归一化。
2. 为带 path / fragment / userinfo 的非法 Origin 输入补充安全测试。
3. 运行安全测试并判断是否暴露真实问题。
4. 若发现问题，做最小修复并回归。
5. 回写执行记录、验证结果、复盘。
6. 若有代码改动，提交 Git。

## 执行顺序
1. 缺口盘点。
2. 非法 Origin 样本回归。
3. 执行与修复。
4. 文档回写。
5. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已确认当前缺少以下 Origin 规范化边界：
    - 带 path 的 Origin
    - 带 fragment 的 Origin
    - 带 userinfo 的 Origin
  - 已用本地样本确认当前 `new URL(...).origin` 会吞掉这些附加成分，具备过宽收敛风险。
- 已完成 TODO 2：
  - 在 `test-security-gateway.js` 中补充非法 Origin 样本回归：
    - `Origin: http://localhost:18818/path`
    - `Origin: http://localhost:18818#frag`
    - `Origin: http://user@localhost:18818`
- 已完成 TODO 3：
  - 首次执行时稳定暴露真实问题：
    - `Expected path-bearing origin request to return 403, got 200`
  - 根因定位：
    - `server\lib\request-security.js` 中 `normalizeOrigin()` 直接返回 `parsed.origin`
    - path / fragment / userinfo 会被 URL API 吞掉，导致非法 Origin 被错误视为合法同源
- 已完成 TODO 4：
  - 已做最小修复：
    - 拒绝带 `username` / `password` 的 Origin
    - 拒绝带 `search` / `hash` 的 Origin
    - 拒绝非根路径的 Origin
  - 修复后重新执行安全网关测试与认证历史回归，结果通过
- 已完成 TODO 5：
  - 已回写执行记录、验证结果、复盘
- 已完成 TODO 6：
  - 本轮提交信息已确定为：`fix: tighten origin normalization`

## 验证结果
- 语法检查通过：
  - `node --check test-security-gateway.js`
- 安全测试通过：
  - `node test-security-gateway.js`
- 认证回归通过：
  - `node test-auth-history.js`
- 提交前检查待执行：
  - `git diff --check`

## 复盘
- 新问题：
  - 已确认存在真实安全缺陷：
    - 带 path / fragment / userinfo 的非法 Origin 头此前会被吞成合法 origin
    - 可能导致本应拒绝的异常跨源请求被错误放行
- 边界条件：
  - 合法规范化仍需保留，例如主机名大小写归一化、默认端口归一化
  - 本轮修复只收紧“非法附加成分”，没有动这些合法规范化行为
- 遗漏点：
  - 本轮尚未覆盖尾部斜杠 Origin 是否应接受
  - 本轮尚未覆盖 Host 变体，例如尾点、大小写、异常端口格式
- 残余风险：
  - 当前未发现 path / fragment / userinfo 样本仍可绕过来源校验
  - 仍建议继续补 Host 变体与更细的 Origin 语法边界
- 是否回写规划：
  - 是。本轮已回写缺陷、根因、修复策略与后续缺口

## 当前结果
- 第十阶段安全测试已完成并已提交：
  - 新增 path / fragment / userinfo Origin 回归
  - 修复了非法 Origin 被过宽规范化的问题
  - 已完成 Git 提交：`fix: tighten origin normalization`

## 下一阶段建议 TODO
1. 继续转向 Host 变体边界。
2. 继续补更多 Origin 规范化回归，例如尾部斜杠与更细语法边界。
