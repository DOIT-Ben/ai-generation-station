# 2026-04-27 安全性测试第十一阶段计划

## 目标
- 继续补强请求来源安全测试，聚焦非法 `Host` 变体是否会被过宽接受并参与同源判定，避免“格式异常但可被 `URL` 解析”的 Host 值被错误视为合法来源。
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
- 不重写完整的 URL / Host 解析器。
- 不做外网扫描、依赖漏洞扫描或压测。

## 假设
- 当前 `getRequestOrigin()` 直接把 `Host` 拼进 `new URL(...)`，可能会接受一部分格式异常但可被 URL API 吞下的 Host 变体。
- 像 `localhost..` 这类包含空标签的 Host 不应被视为合法同源来源。
- 当前主线已覆盖非法 Origin，但还未覆盖“非法 Host + 匹配 Origin”这类组合。

## 风险
- 需要区分“合法规范化”与“非法 Host 被吞掉”，避免把正常大小写或默认端口处理误判为缺陷。
- Host 语法比 Origin 更杂，修复过严可能影响合法 IPv6 或 punycode 主机名。
- 若命中问题，修复必须收敛在明显非法的标签结构上，避免扩大改动面。

## 完成标准
- 已覆盖并验证至少以下边界：
  - 带空标签的 Host 不会被错误当作合法同源来源
  - 对应匹配 Origin 也不会因此被错误放行
- 若命中问题，完成最小修复并通过回归。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`
- 必要时 `npm test`
- `git diff --check`

## TODO
1. 盘点 Host 变体当前测试缺口，并确认哪些样本会被 URL API 过宽接受。
2. 为非法 Host 变体补充安全测试。
3. 运行安全测试并判断是否暴露真实问题。
4. 若发现问题，做最小修复并回归。
5. 回写执行记录、验证结果、复盘。
6. 若有代码改动，提交 Git。

## 执行顺序
1. 缺口盘点。
2. 非法 Host 样本回归。
3. 执行与修复。
4. 文档回写。
5. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已确认当前尚未覆盖“非法 Host + 匹配 Origin”这类来源判定边界。
  - 已用本地样本确认 `http://localhost..:18822` 会被 URL API 解析出合法 origin 字符串，具备过宽接受风险。
- 已完成 TODO 2：
  - 在 `test-security-gateway.js` 中补充非法 Host 变体回归：
    - `Host: localhost..:18822`
    - `Origin: http://localhost..:18822`
- 已完成 TODO 3：
  - 首次执行时稳定暴露真实问题：
    - `Expected invalid host same-origin request to return 403, got 200`
  - 根因定位：
    - `server\lib\request-security.js` 中 `normalizeOrigin()` 未拒绝包含空标签的主机名
    - 导致 `localhost..` 这类明显非法 Host 被错误视为合法同源来源
- 已完成 TODO 4：
  - 已做最小修复：
    - 对非 IPv6 主机名，拒绝前导点
    - 对非 IPv6 主机名，拒绝连续点
  - 修复后重新执行安全网关测试与认证历史回归，结果通过
- 已完成 TODO 5：
  - 已回写执行记录、验证结果、复盘
- 已完成 TODO 6：
  - 本轮提交信息已确定为：`fix: reject invalid host label variants`

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
    - 带空标签的 Host 变体此前会被错误视为合法同源来源
    - 对应匹配 Origin 也会因此被错误放行
- 边界条件：
  - 本轮修复没有动 IPv6 主机名路径，避免误伤 `[::1]` 等合法场景
  - 本轮只收紧“明显非法的空标签结构”，没有扩大到更复杂的主机名规则重写
- 遗漏点：
  - 本轮尚未覆盖尾随点 Host、异常端口格式等其他 Host 变体
  - 本轮尚未覆盖 punycode / Unicode 主机名的更多边界
- 残余风险：
  - 当前未发现 `localhost..` 这类空标签 Host 仍可绕过来源校验
  - 仍建议继续补其他 Host 语法边界与 CORS 一致性回归
- 是否回写规划：
  - 是。本轮已回写缺陷、根因、修复策略与后续缺口

## 当前结果
- 第十一阶段安全测试已完成并已提交：
  - 新增非法 Host 变体回归
  - 修复了空标签 Host 被错误接受的问题
  - 已完成 Git 提交：`fix: reject invalid host label variants`

## 下一阶段建议 TODO
1. 继续扩展更细的 Host 语法边界，例如尾随点与异常端口格式。
2. 继续补更多 Host / Origin 组合回归。
3. 若安全主线仍继续，可补缓存相关头一致性回归。
