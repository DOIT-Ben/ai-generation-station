# 2026-04-25 API 密钥泄露修复计划

## 目标
移除仓库中已跟踪文档里的真实形态 API key，并增加最小防回归扫描，避免后续再次把密钥提交到仓库。

## 范围
- `minimax_api_docs\MiniMax_API_Models.md`
- 新增最小 secret 扫描测试
- 必要时记录外部轮换要求
- 不修改业务功能、不处理其它审查发现

## 假设
- 用户所说“这个问题”指全面审查报告里的 Critical 问题：文档中存在真实形态 API key。
- 本地仓库只能移除明文和增加检测，无法替用户在 MiniMax 控制台吊销或轮换密钥。
- 当前工作区已有其它未提交改动，本轮只叠加本问题相关文件。

## 风险
- 即使从当前文件删除，Git 历史中仍可能保留旧 key。
- 新增扫描规则过宽可能误报示例文本；需要排除 `.git`、`node_modules`、本地 `.env` 等非提交内容。
- 若外部 key 不轮换，泄露风险仍未真正解除。

## TODO
1. 复核当前密钥命中位置和工作区状态。
2. 将文档中的真实 key 替换为占位符。
3. 新增最小 secret 扫描测试。
4. 运行 secret 扫描和相关基础验证。
5. 回写执行记录与复盘。

## 完成标准
- 仓库当前工作区不再出现真实形态 `sk-...` 或 `ghp_...` token 命中。
- 文档只使用占位符。
- 新增测试能阻止典型 key 进入仓库。
- 明确记录“外部平台必须轮换 key”。

## 验证方式
- `node test-secret-scan.js`
- `rg` secret pattern 扫描
- `npm run check`

## 执行记录
- 2026-04-25 16:21：已确认密钥命中在 `minimax_api_docs\MiniMax_API_Models.md:7`。
- TODO 1 已完成：
  - 工作区已有前端视觉、公式和审查文档未提交改动，本轮保留并叠加安全修复。
  - 当前真实形态 secret 命中仅在 `minimax_api_docs\MiniMax_API_Models.md:7`。
- TODO 1 复盘：
  - 新问题：该文件已被 Git 跟踪，历史提交中可能仍保留旧 key。
  - 边界条件：本轮不改写 Git 历史。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 2 已完成：
  - 已将文档中的真实 key 替换为环境变量配置说明。
- TODO 2 复盘：
  - 新问题：本地删除明文不等于外部 key 已安全。
  - 边界条件：需要用户在 MiniMax 控制台轮换或吊销旧 key。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 3 已完成：
  - 新增 `test-secret-scan.js`，扫描提交候选文本文件中的 `sk-...` 和 `ghp_...` 形态 token。
  - 扫描排除 `.git`、`.env`、`node_modules`、`data`、`output` 等本地或生成内容。
- TODO 3 复盘：
  - 新问题：正则扫描不能替代平台级 secret scanning，但足够覆盖本次泄露形态。
  - 边界条件：未把测试接入 `package.json`，避免扩大脚本语义；后续可纳入 CI。
  - 遗漏点：无。
  - 是否回写规划：无需追加。
- TODO 4 已完成：
  - 已运行 secret 扫描和基础语法检查。

## 验证结果
- `node test-secret-scan.js`：通过。
- `rg` secret pattern 扫描：无命中。
- `npm run check`：通过。

## 复盘
- 新问题：旧 key 需要外部平台立即轮换；本地仓库无法完成这一步。
- 边界条件：本轮未提交推送，且未清理 Git 历史中的旧值。
- 遗漏点：未接入 CI secret scanning，后续建议补到灰度/发布 gate。
- 是否回写规划：已完成。
