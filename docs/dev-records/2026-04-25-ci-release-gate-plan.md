# CI 发布闸门与 lockfile 修复记录

## 目标
修复审查报告中“缺少项目级 CI gate”和“`package-lock.json` 被忽略导致依赖不可重复”的问题，建立最小自动化发布前检查。

## 范围
- 修改 `.gitignore`，允许 `package-lock.json` 纳入版本控制。
- 提交现有 `package-lock.json`。
- 新增 GitHub Actions CI 工作流。
- 新增聚焦测试，检查 CI gate 的关键命令和 lockfile 忽略规则。
- 不处理视觉回归手动 gate、真实灰度分流、部署回滚、监控告警等后续灰度体系。

## 假设
- 当前项目使用 npm，已有 `package-lock.json`，只是被 `.gitignore` 忽略。
- CI 先采用 Node 22，与当前本地运行时 `v22.22.0` 保持一致。
- 最小 CI gate 应覆盖安装、审计、secret scan、语法检查、安全测试、数据库外键测试和 release-core。

## 风险
- `npm ci` 会严格依赖 lockfile，若 `package.json` 与 lockfile 不一致，CI 会失败；这是目标行为。
- GitHub Actions 环境与本地 Windows 环境不同，可能暴露路径或平台差异。
- Browser/视觉回归较重，本轮不纳入自动 gate，避免 CI 过慢或依赖浏览器环境。

## TODO
1. 新增聚焦测试：验证 `.gitignore` 不再忽略 `package-lock.json`。
2. 新增聚焦测试：验证 CI workflow 包含 `npm ci`、`npm audit`、`test-secret-scan`、`check`、安全测试、外键测试和 `test:release-core`。
3. 修改 `.gitignore`，移除 `package-lock.json` 忽略规则。
4. 新增 `.github\workflows\ci.yml`。
5. 确认 `package-lock.json` 可被 Git 跟踪。
6. 运行聚焦测试、`npm ci --dry-run`、`npm run check`、核心相关测试。
7. 复盘新问题、边界条件、遗漏点，并回写本文件。
8. 提交本轮 CI gate 修复。

## 完成标准
- `package-lock.json` 出现在待提交文件中，不再被 `.gitignore` 忽略。
- CI workflow 在 push、pull_request 和手动触发时运行。
- CI workflow 使用 `npm ci` 并运行基础安全和 release-core gate。
- 聚焦测试覆盖 CI gate 配置，防止误删关键命令。
- 本轮验证命令通过。

## 验证方式
- `node test-ci-gate.js`
- `npm ci --dry-run`
- `npm run check`
- `node test-secret-scan.js`
- `node test-security-gateway.js`
- `node test-state-foreign-keys.js`
- `npm run test:release-core`

## 执行记录
- 已完成根因调查：`.gitignore` 第 3 行忽略 `package-lock.json`；本地存在 `package-lock.json` 但未被 Git 跟踪；项目根目录不存在 `.github` workflow。
- TODO 1-2 已新增聚焦测试：`test-ci-gate.js` 检查 lockfile 忽略规则和 CI workflow 关键命令。
- 预修复验证：`node test-ci-gate.js` 失败，失败点为 `package-lock.json` 仍被 `.gitignore` 忽略，符合预期。
- TODO 3 已完成：从 `.gitignore` 移除 `package-lock.json`。
- TODO 4 已完成：新增 `.github\workflows\ci.yml`，覆盖安装、审计、secret scan、语法、安全、外键和 release-core。
- TODO 5 已确认：`git status` 已显示 `package-lock.json` 为待跟踪文件；`git check-ignore -v package-lock.json` 无忽略命中。
- 修复后聚焦验证：`node test-ci-gate.js` 通过。

## 验证结果
- `node test-ci-gate.js`：通过。确认 lockfile 不再被忽略，CI workflow 包含关键 gate 命令。
- `npm ci --dry-run`：通过。lockfile 可用于可重复安装。
- `npm audit --audit-level=high`：通过，0 vulnerabilities。
- `npm run check`：通过。
- `node test-secret-scan.js`：通过。
- `node test-security-gateway.js`：通过。
- `node test-state-foreign-keys.js`：通过。
- `npm run test:release-core`：通过。回归总计 12 项，10 通过，2 个浏览器项按参数跳过，0 失败；容量基线完成。

## 复盘
- TODO 1-2 复盘：测试只校验 CI gate 的关键契约，不解析完整 YAML，保持最小范围。当前阻塞点为 `.gitignore` 和 workflow 缺失，需要继续 TODO 3-5。
- TODO 3-5 复盘：本轮纳入自动 gate 的是 release-core 和关键安全/状态测试；浏览器视觉测试仍保留为后续手动或独立 CI gate，避免当前 CI 初始落地过重。
- TODO 6-7 复盘：本轮 CI gate 的本地等价验证通过。`test:release-core` 会生成容量基线 artifact，但该目录已被 `.gitignore` 忽略，不纳入提交。后续灰度分流、回滚和监控指标仍未处理，应按审查报告单独规划。
