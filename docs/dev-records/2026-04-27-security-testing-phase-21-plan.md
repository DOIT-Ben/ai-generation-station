# 2026-04-27 安全性测试第二十一阶段计划

## 目标
- 一次性完成当前安全测试主线剩余高价值事项与治理收口：
  - `Host / Origin` 组合矩阵补强
  - SSE / 流式接口缓存头回归
  - 缓存策略现状评估
  - 插件目录专项安全盘点
  - 依赖层漏洞扫描
- 全部完成后统一执行回归、更新文档、提交 Git。

## 范围
- 测试脚本：
  - `test-security-gateway.js`
- 后端实现核验：
  - `server\index.js`
  - `server\lib\request-security.js`
  - `server\routes\service.js`
- 治理与扫描：
  - `ui-ux-pro-max-0.1.0`
  - `package.json`
  - `package-lock.json`
- 文档记录：
  - `docs\dev-records`
  - `docs\test\security-testing-report.md`

## 非范围
- 不做 UI 改版。
- 不重构完整缓存策略架构。
- 不做外网渗透或生产环境实机攻击测试。

## 假设
- 当前主线剩余最有价值的技术项是组合矩阵和流式缓存头；插件目录与依赖扫描更偏治理收口。
- 多个小阶段完成后统一跑回归更高效，但所有结论仍需分段入档。

## 风险
- 依赖扫描可能给出大量低相关警告，需要严格区分真实阻塞项与可记录残余风险。
- 插件目录体量较大，必须控制为“安全盘点与结论”，不能演变成全面代码重构。
- 若多项同时推进，文档容易脱节，因此每个子阶段都要回写到 `docs\dev-records`。

## 完成标准
- 已完成 `Host / Origin` 组合矩阵补强。
- 已完成 SSE / 流式接口缓存头回归。
- 已完成插件目录专项安全盘点结论。
- 已完成依赖层漏洞扫描与结果归档。
- 已完成统一回归、文档收口与 Git 提交。

## 验证方式
- `node --check test-security-gateway.js`
- `node test-security-gateway.js`
- `node test-auth-history.js`
- `npm audit --json`
- 必要时 `git diff --check`

## TODO
1. 盘点剩余高价值 `Host / Origin` 组合矩阵样本。
2. 补 `Host / Origin` 组合矩阵回归。
3. 盘点 SSE / 流式接口缓存头现状。
4. 补 SSE / 流式接口缓存头回归。
5. 评估当前缓存策略是否需要最小修复。
6. 盘点插件目录安全边界与潜在风险。
7. 执行依赖层漏洞扫描并归类结果。
8. 若发现真实问题，做最小修复并复测。
9. 统一执行安全与认证回归。
10. 更新 `docs\dev-records`、阶段总表与总安全报告。
11. 提交 Git。

## 执行顺序
1. 组合矩阵盘点与回归。
2. SSE 缓存头盘点与回归。
3. 缓存策略评估。
4. 插件目录盘点。
5. 依赖扫描。
6. 必要修复。
7. 统一回归。
8. 文档收口。
9. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已盘点剩余高价值 `Host / Origin` 组合样本。
  - 已确认以下组合值得纳入正式回归：
    - Unicode Host + punycode Origin
    - 显式默认端口对称组合
    - IPv6 默认端口不一致组合
    - Unicode / punycode 不一致组合
- 已完成 TODO 2：
  - 已在 `test-security-gateway.js` 中补充上述 `Host / Origin` 组合矩阵回归。
- 已完成 TODO 3：
  - 已盘点 SSE / 流式接口缓存头现状：
    - `server\routes\service.js` 的流式响应显式设置 `Cache-Control: no-cache, no-transform`
    - 同时返回 `Content-Type: text/event-stream; charset=utf-8`
- 已完成 TODO 4：
  - 已在 `test-security-gateway.js` 中新增 `testSseCacheHeaderBehavior()`，对 SSE 头部行为做正式回归。
- 已完成 TODO 5：
  - 已评估当前缓存策略现状：
    - 认证敏感接口显式 `no-store`
    - SSE 流式接口显式 `no-cache, no-transform`
    - 其余常见路径当前未显式设置缓存头
  - 本轮未发现必须立即修复的缓存头实现缺陷。
- 已完成 TODO 6：
  - 已完成插件目录专项安全盘点：
    - 未发现硬编码密钥或直接高危的前端注入链
    - 主要需要记录的风险点是 `ui-ux-pro-max-0.1.0\cli\src\utils\extract.ts` 使用 `child_process.exec` 拼接 shell / PowerShell / xcopy / cp 回退命令
    - 当前结论：属中低风险治理点，建议后续收敛为参数化调用或更严格的路径转义
- 已完成 TODO 7：
  - 已执行 `npm audit --json`
  - 当前仓库依赖扫描结果：
    - `total: 0`
    - 未发现已知 high / critical / moderate 漏洞
- 已完成 TODO 8：
  - 本轮未命中需要修复的新的真实代码问题，因此未新增业务修复。
- 已完成 TODO 9：
  - 已统一执行安全与认证回归：
    - `node --check test-security-gateway.js`
    - `node test-security-gateway.js`
    - `node test-auth-history.js`
- 已完成 TODO 10：
  - 已回写本阶段执行记录、验证结果与复盘。
- TODO 11 待执行：
  - 待本轮统一 Git 提交。

## 验证结果
- 语法检查通过：
  - `node --check test-security-gateway.js`
- 安全测试通过：
  - `node test-security-gateway.js`
- 认证回归通过：
  - `node test-auth-history.js`
- 依赖扫描通过：
  - `npm audit --json`
  - 当前结果：0 漏洞

## 复盘
- 新问题：
  - 本轮没有打出新的业务实现缺陷。
  - 本轮补齐了组合矩阵、SSE 缓存头、插件目录盘点和依赖扫描这几个收口项。
- 边界条件：
  - 插件目录盘点是“安全结论归档”，不是插件全面重构。
  - 依赖扫描以当前 `npm audit` 结果为准，不代表对插件目录内独立 Node 工程做了单独审计。
- 遗漏点：
  - 插件目录内 `cli` 子工程如需更严谨审计，后续应在其目录单独运行依赖扫描与更细的命令注入检查。
  - 仍未对更大规模 Host / Origin 组合矩阵做笛卡尔扩展。
- 残余风险：
  - 当前未发现主仓库依赖层已知漏洞。
  - 插件目录当前最值得跟踪的是命令执行回退路径，而不是已确认的高危漏洞。
- 是否回写规划：
  - 是。本轮已回写收口结果与残余风险。

## 当前结果
- 第二十一阶段已完成：
  - 新增 `Host / Origin` 组合矩阵回归
  - 新增 SSE 缓存头回归
  - 完成插件目录专项安全盘点
  - 完成主仓库依赖漏洞扫描
  - 当前未发现新的高危实现缺陷

## 下一阶段建议 TODO
1. 若继续深入插件目录，可对 `ui-ux-pro-max-0.1.0\cli` 单独做依赖扫描与命令执行路径收敛。
2. 若继续安全主线，可扩大 `Host / Origin` 组合矩阵规模。
3. 若准备彻底收口，可统一更新总报告的插件目录与依赖扫描结论并提交 Git。
