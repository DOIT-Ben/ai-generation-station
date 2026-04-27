# 2026-04-27 安全性测试第二十二阶段计划

## 目标
- 继续按治理收口顺序推进，对 `ui-ux-pro-max-0.1.0\cli` 子工程做独立依赖扫描与命令执行路径盘点。
- 若发现可控范围内的真实问题，做最小修复并补最小验证；否则形成专项结论并回写文档。

## 范围
- 插件目录：
  - `ui-ux-pro-max-0.1.0\cli`
- 重点文件：
  - `ui-ux-pro-max-0.1.0\cli\package.json`
  - `ui-ux-pro-max-0.1.0\cli\package-lock.json`
  - `ui-ux-pro-max-0.1.0\cli\src\utils\extract.ts`
- 文档记录：
  - `docs\dev-records`
  - `docs\test\security-testing-report.md`

## 非范围
- 不对整个插件目录做全面重构。
- 不修改主仓库业务逻辑。
- 不继续扩展 Host / Origin 主线。

## 假设
- 该子工程是独立 Node CLI，适合单独做依赖扫描。
- 当前最高风险点仍然是 `extract.ts` 中的 `child_process.exec` 回退命令路径。

## 风险
- CLI 子工程可能未配置完整本地构建环境，验证手段需要以静态审查和最小运行检查为主。
- 如果直接重构命令执行路径，容易扩大改动面，因此优先判断是否存在明确可收敛的拼接风险。

## 完成标准
- 已完成 `ui-ux-pro-max-0.1.0\cli` 依赖扫描。
- 已完成 `extract.ts` 命令执行路径盘点。
- 若命中问题，完成最小修复并通过最小验证。
- 本轮目标、TODO、执行记录、验证结果、复盘全部写入 `docs\dev-records`。

## 验证方式
- `npm audit --json`（在 `ui-ux-pro-max-0.1.0\cli` 目录）
- 必要时最小语法 / 构建检查
- 文档交叉核对

## TODO
1. 在 `ui-ux-pro-max-0.1.0\cli` 目录执行依赖扫描。
2. 盘点 `extract.ts` 的命令执行路径与输入来源。
3. 判断是否存在可控范围内的最小修复机会。
4. 若存在，实施最小修复并做最小验证。
5. 回写执行记录、验证结果、复盘。
6. 若有代码改动，提交 Git。

## 执行顺序
1. 依赖扫描。
2. 命令执行路径盘点。
3. 最小修复判断。
4. 必要修复与验证。
5. 文档回写。
6. Git 提交。

## 执行记录
- 已完成 TODO 1：
  - 已在 `ui-ux-pro-max-0.1.0\cli` 目录执行 `npm audit --json`
  - 当前结果：
    - `total: 0`
    - 未发现 `moderate` / `high` / `critical` 漏洞
- 已完成 TODO 2：
  - 已盘点 `extract.ts` 命令执行路径与输入来源：
    - `extractZip()` 之前使用字符串拼接 `exec`
    - `copyFolders()` 的 shell fallback 之前使用字符串拼接 `exec`
    - 输入主要来自下载 ZIP 路径、临时目录、源目录和目标目录
- 已完成 TODO 3：
  - 已判断存在可控范围内的最小修复机会：
    - 不改行为语义
    - 只把字符串拼接 shell 命令收敛为参数化进程调用
- 已完成 TODO 4：
  - 已在 `ui-ux-pro-max-0.1.0\cli\src\utils\extract.ts` 中完成最小修复：
    - `exec` -> `execFile`
    - Windows `powershell Expand-Archive` 改为参数数组
    - `unzip` / `xcopy` / `cp` 改为参数数组
  - 已执行验证：
    - `npm audit --json` 通过
    - 主仓库 `node --check test-security-gateway.js` 通过
    - 主仓库 `node test-security-gateway.js` 通过
    - 主仓库 `node test-auth-history.js` 通过
  - 子工程构建验证：
    - `bun run build` 失败
    - 原因是当前本地未安装该子工程依赖，`commander` 无法解析
    - 当前判定为环境准备缺失，不是本轮代码修复回归失败
- 已完成 TODO 5：
  - 已回写执行记录、验证结果与复盘。
- TODO 6 待执行：
  - 待本轮 Git 提交。

## 验证结果
- 子工程依赖扫描通过：
  - `npm audit --json`
- 主仓库安全回归通过：
  - `node --check test-security-gateway.js`
  - `node test-security-gateway.js`
  - `node test-auth-history.js`
- 子工程构建验证受环境限制：
  - `bun run build`
  - 当前失败原因：本地未安装 `ui-ux-pro-max-0.1.0\cli` 依赖

## 复盘
- 新问题：
  - 子工程最大的可收敛风险点已经从字符串拼接 shell 命令改成了参数化调用。
  - 当前未发现该子工程依赖层漏洞。
- 边界条件：
  - 本轮没有在 `ui-ux-pro-max-0.1.0\cli` 内执行依赖安装，因此构建验证只能记录为“环境未就绪”。
  - 本轮修复优先保证安全收敛，不扩到安装器逻辑重构。
- 遗漏点：
  - 后续若要更强验证，应在 `ui-ux-pro-max-0.1.0\cli` 目录补完整安装环境后再跑构建。
- 残余风险：
  - 当前插件子工程的主要残余风险已从命令拼接风险下降为“外部工具调用行为仍依赖系统命令可用性”。
- 是否回写规划：
  - 是。本轮已回写修复与验证边界。

## 当前结果
- 第二十二阶段已完成：
  - 插件子工程依赖扫描完成，结果 0 漏洞
  - 命令执行路径已完成最小安全收敛
  - 主仓库安全回归未受影响

## 下一阶段建议 TODO
1. 若继续插件治理，可在子工程目录安装依赖后补完整构建验证。
2. 若准备收口，可统一提交本轮插件治理变更并更新总报告。
