# 2026-04-27 安全测试阶段总表

## 目标
- 把 AI-Generation-Stations 当前安全测试主线整理成一份阶段总表，明确从主计划到第十七阶段分别做了什么、命中了哪些真实问题、哪些阶段只是补覆盖、还剩哪些缺口。

## 范围
- `docs\dev-records\2026-04-26-security-testing-plan.md`
- `docs\dev-records\2026-04-26-security-testing-phase-2-plan.md`
- `docs\dev-records\2026-04-26-security-testing-phase-3-plan.md`
- `docs\dev-records\2026-04-26-security-testing-phase-4-plan.md`
- `docs\dev-records\2026-04-26-security-testing-phase-5-plan.md`
- `docs\dev-records\2026-04-26-security-testing-phase-6-plan.md`
- `docs\dev-records\2026-04-27-security-testing-phase-7-plan.md`
- `docs\dev-records\2026-04-27-security-testing-phase-8-plan.md`
- `docs\dev-records\2026-04-27-security-testing-phase-9-plan.md`
- `docs\dev-records\2026-04-27-security-testing-phase-10-plan.md`
- `docs\dev-records\2026-04-27-security-testing-phase-11-plan.md`
- `docs\dev-records\2026-04-27-security-testing-phase-12-plan.md`
- `docs\dev-records\2026-04-27-security-testing-phase-13-plan.md`
- `docs\dev-records\2026-04-27-security-testing-phase-14-plan.md`
- `docs\dev-records\2026-04-27-security-testing-phase-15-plan.md`
- `docs\dev-records\2026-04-27-security-testing-phase-16-plan.md`
- `docs\dev-records\2026-04-27-security-testing-phase-17-plan.md`
- `docs\test\security-testing-report.md`

## 假设
- 以已入档阶段计划和安全测试报告作为正式进度来源。
- 若某阶段文档已声明“已提交”，则认为该阶段代码和测试变更已完成主线收口。

## 风险
- 当前没有 phase-1 单独文档，第一轮工作沉淀在主计划执行记录里，因此总表中把主计划执行结果视作阶段 1 基线。
- 安全总报告统计口径停在 2026-04-26，不能直接代表 2026-04-27 后续阶段新增覆盖。

## 完成标准
- 明确阶段 1 到阶段 17 的目标、结果与状态。
- 明确哪些阶段命中真实安全缺陷，哪些阶段主要是补测试覆盖。
- 明确当前剩余安全测试缺口与下一步建议。

## 验证方式
- 逐份核对安全测试主计划、phase 2 到 phase 17 文档，以及 `docs\test\security-testing-report.md`。

## TODO
1. 抽取主计划与 phase 2 到 phase 17 的关键信息。
2. 形成统一阶段总表。
3. 汇总真实缺陷、覆盖面和剩余缺口。
4. 回写执行记录、验证结果、复盘。

## 阶段总表

| 阶段 | 日期 | 主题 | 结果 | 是否命中真实缺陷 | 修复 / 产出 |
|------|------|------|------|------------------|-------------|
| 阶段 1 | 2026-04-26 | 主计划基线：认证、会话、CSRF、CORS、安全头、上传、权限边界、错误暴露 | 已完成 | 是 | 修复畸形 Cookie 解码导致请求级异常；修复畸形 `/output/*` 编码落入 500；补回归 |
| 阶段 2 | 2026-04-26 | 管理员权限边界与上传入口对抗输入 | 已完成 | 否 | 新增匿名访问、普通用户越权、自我降权保护、上传类型与体积边界测试 |
| 阶段 3 | 2026-04-26 | 邀请链、密码重置链频率限制与审计完整性 | 已完成 | 否 | 新增找回密码限流、管理员重置密码限流、邀请发放\重发\撤销与密码重置审计测试 |
| 阶段 4 | 2026-04-26 | 公开注册限流与 token 生命周期边界 | 已完成 | 否 | 新增公开注册限流、审计联动、token 缺失\重复消费\失效边界测试 |
| 阶段 5 | 2026-04-26 | 邀请激活 token 过期、异常 token 形态、异常 Cookie 容错 | 已完成 | 否 | 新增邀请 token 显式过期、异常 token、异常 session Cookie 容错测试 |
| 阶段 6 | 2026-04-26 | `TRUST_PROXY` 代理头信任边界 | 已完成 | 是 | 修复垃圾 `X-Forwarded-For` / `X-Real-IP` 可绕过限流并污染审计 IP 的问题 |
| 阶段 7 | 2026-04-27 | 审计日志 `actorIp` 与代理头修复一致性 | 已完成 | 否 | 新增 `X-Forwarded-For` 合法 IP 选择与无效 `X-Real-IP` 安全回退审计回归 |
| 阶段 8 | 2026-04-27 | Host / Origin / `X-Forwarded-Proto` 组合异常输入 | 已完成 | 是 | 修复“存在但非法”的 `Origin` 被当作“无 Origin”错误放行的问题 |
| 阶段 9 | 2026-04-27 | network-level `remoteAddress` 回退验证 | 已完成 | 否 | 新增真实监听端口下的回退地址与忽略伪造代理头回归 |
| 阶段 10 | 2026-04-27 | Origin 规范化收紧：path / fragment / userinfo | 已完成 | 是 | 修复非法 Origin 被 URL API 过宽规范化后错误放行的问题 |
| 阶段 11 | 2026-04-27 | Host 变体边界：空标签 Host | 已完成 | 是 | 修复空标签 Host 被错误视为合法同源来源的问题 |
| 阶段 12 | 2026-04-27 | Host 变体边界：尾随点与异常端口格式 | 已完成 | 是 | 修复尾随点 Host 与显式异常端口格式 Host 被错误接受的问题 |
| 阶段 13 | 2026-04-27 | Host 变体边界：尾随冒号与基础 IPv6 | 已完成 | 否 | 新增尾随冒号 Host、合法 IPv6 same-origin、IPv6 异常端口格式回归 |
| 阶段 14 | 2026-04-27 | IPv6 authority 细化边界 | 已完成 | 否 | 新增 IPv6 端口异常格式回归，如 `:018822` 与 `:00000` |
| 阶段 15 | 2026-04-27 | punycode / Unicode 主机名边界 | 已完成 | 否 | 新增合法 Unicode、合法 punycode、异常 Unicode Host 回归 |
| 阶段 16 | 2026-04-27 | CORS 与 `Vary` 一致性 | 已完成 | 否 | 新增无 Origin、允许 Origin、拒绝 Origin、预检请求头一致性回归 |
| 阶段 17 | 2026-04-27 | 非 API 与静态资源路径头部行为 | 已完成 | 否 | 新增首页、静态资源、404 路径在不同 Origin 场景下的头部行为回归 |

## 分阶段摘要

### 阶段 1 基线
- 主计划先把安全主线立住，并完成第一批真实修复。
- 这一阶段不是单纯盘点，已经修了两个真实问题：
  - `server\lib\http.js` 的 Cookie 解码异常
  - `server\routes\local.js` 的畸形输出路径编码返回 500 过粗
- 这阶段之后，安全测试主线从“基础网关验证”进入“边界下钻”。

### 阶段 2 到阶段 5
- 这一段以“补覆盖”为主，没有再打出新的实现缺陷。
- 覆盖面主要补齐：
  - 管理员权限边界
  - 上传入口对抗输入
  - 找回密码和管理员重置密码限流
  - 邀请链、公开注册审计完整性
  - token 缺失、重复消费、过期、异常形态
  - 异常 session Cookie 容错
- 这几阶段的价值在于把认证和账号生命周期相关的高风险路径基本补齐。

### 阶段 6 到阶段 11
- 这一段开始集中打请求来源、代理头、Origin、Host 规范化边界。
- 命中的真实安全缺陷有 4 类：
  - 阶段 6：无效代理 IP 头可绕过限流
  - 阶段 8：非法 Origin 被当作无 Origin 放行
  - 阶段 10：带 path / fragment / userinfo 的非法 Origin 被过宽归一化
  - 阶段 11：空标签 Host 被错误接受为合法同源
- 阶段 7 与阶段 9 主要负责把第 6 阶段修复从 mock 层验证到审计链路与真实 network-level 行为，属于补验证闭环。

### 阶段 12 到阶段 17
- 这一段完成了 Host 边界主线收口，并切回 CORS / 非 API 头部一致性主线。
- 命中的新增真实安全缺陷有 2 类：
  - 阶段 12：尾随点 Host 被错误接受
  - 阶段 12：显式异常端口格式 Host 被 URL 规范化后错误接受
- 其余阶段主要用于把以下边界正式落成自动化回归：
  - 尾随冒号与合法 / 非法 IPv6 authority
  - IPv6 端口异常格式
  - punycode / Unicode Host 规范化行为
  - CORS 与 `Vary` 一致性
  - 非 API HTML、静态资源、404 路径的当前头部行为

## 当前覆盖面
- 认证、会话、密码重置、邀请、公开注册
- CSRF、CORS、同源判定、安全响应头
- 上传入口、输出路径边界、错误泄露、请求体限制
- 代理头信任、审计 `actorIp`、network-level 回退地址
- Origin 规范化、Host 变体来源校验
- punycode / Unicode Host 规范化行为
- CORS 与 `Vary` 一致性
- 非 API HTML、静态资源、404 路径头部行为

## 当前已确认的真实缺陷
1. 畸形 Cookie 解码会触发请求级异常。
2. 畸形输出路径编码会落入 500，而不是受控 400。
3. `TRUST_PROXY=true` 时垃圾代理 IP 值可绕过限流并污染审计 IP。
4. 非法 `Origin` 头会被错误当成无 Origin 放行。
5. 带 path / fragment / userinfo 的 Origin 会被过宽规范化。
6. 空标签 Host 会被错误视为合法同源来源。
7. 尾随点 Host 会被错误视为合法同源来源。
8. 显式异常端口格式 Host 会被 URL 规范化后错误视为合法同源来源。

## 当前状态判断
- 安全测试主线已经不是“补基础测试”，而是在做“来源判定、代理信任、输入归一化”这类更细的边界下钻。
- 到 phase 17 为止，来源判定、代理头信任、Origin / Host 规范化、CORS 一致性和非 API 头部行为都已有正式回归覆盖。
- 从主计划到第十一阶段看，测试推进方式是对的：
  - 先补测试
  - 命中真实缺陷后只做最小修复
  - 再补回归和文档收口
- 到目前为止，来源校验与代理头处理是命中真实问题最多的区域。

## 剩余缺口
- 更细的 Host / IDNA 边界
- 更多 Host / Origin 组合矩阵
- 更细的缓存头策略验证
- 更系统化的异常 Header、Query、Cookie 组合矩阵
- 插件目录专项安全审计
- 依赖层专项漏洞扫描

## 下一步建议
1. 补一份更新后的总安全报告，把 2026-04-27 第 12 到第 17 阶段并入正式统计口径。
2. 若还要继续主线，优先做更系统化的 Host / Origin 组合矩阵与缓存头策略验证。
3. 若阶段目标改为收口，可整理一份当前安全测试完成面与残余风险总览。

## 执行记录
- 已完成 TODO 1：
  - 已逐份提取主计划与 phase 2 到 phase 17 的目标、执行记录、验证结果、当前结果、下一步建议。
- 已完成 TODO 2：
  - 已形成统一阶段总表与分阶段摘要。
- 已完成 TODO 3：
  - 已汇总命中的真实缺陷、覆盖面与剩余缺口。
- 已完成 TODO 4：
  - 已回写本次汇总文档。

## 验证结果
- 已完成主计划、phase 2 到 phase 17 与安全总报告的交叉核对。
- 当前可确认：
  - 安全测试主线正式推进到第十七阶段
  - 至少命中过 8 个真实安全相关实现问题
  - 其余阶段主要用于补测试覆盖、验证修复闭环和压实边界

## 复盘
- 新问题：
  - 当前“阶段计划”和“总安全报告”之间已有统计口径脱节，总报告需要补更新。
- 边界条件：
  - 本次是归档与汇总，不新增测试、不修改代码。
- 遗漏点：
  - 当前看不到 phase 1 的单独文档，只能以主计划执行记录作为基线阶段。
- 是否回写规划：
  - 是，已回写本次总表。
