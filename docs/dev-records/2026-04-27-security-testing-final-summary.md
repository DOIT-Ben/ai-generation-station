# 2026-04-27 安全测试最终完成面与残余风险总结

## 目标
- 对本轮安全测试与插件治理形成最终完成面与残余风险总结，作为本阶段主线收口结论。

## 当前完成面

### 一、主仓库安全主线
- 已完成认证、会话、密码重置、邀请、公开注册相关安全回归。
- 已完成 CSRF、防跨源、同源判定、安全响应头相关回归。
- 已完成上传入口、输出路径边界、错误泄露、请求体限制相关回归。
- 已完成代理头信任、审计 `actorIp`、network-level 回退地址相关回归。
- 已完成 Host / Origin 语法边界与规范化行为回归：
  - 空标签
  - 尾随点
  - 尾随冒号
  - 显式异常端口格式
  - IPv6 authority
  - punycode / Unicode Host
- 已完成 `Host / Origin` 组合矩阵的高价值样本回归。
- 已完成 CORS 与 `Vary` 一致性回归。
- 已完成非 API HTML、静态资源、404 路径的头部行为回归。
- 已完成 API 默认 `Cache-Control: no-store` 的统一收口，且 SSE 保持 `no-cache, no-transform` 特例。

### 二、主仓库已确认并修复的真实安全问题
1. 畸形 Cookie 解码会触发请求级异常。
2. 畸形输出路径编码会落入 500，而不是受控 400。
3. `TRUST_PROXY=true` 时垃圾代理 IP 值可绕过限流并污染审计 IP。
4. 非法 `Origin` 头会被错误当成无 Origin 放行。
5. 带 path / fragment / userinfo 的 Origin 会被过宽规范化。
6. 空标签 Host 会被错误视为合法同源来源。
7. 尾随点 Host 会被错误视为合法同源来源。
8. 显式异常端口格式 Host 会被 URL 规范化后错误视为合法同源来源。

### 三、插件 CLI 治理主线
- 已完成主仓库依赖扫描：0 漏洞。
- 已完成 `ui-ux-pro-max-0.1.0\cli` 子工程依赖扫描：0 漏洞。
- 已完成 `extract.ts` 命令执行路径最小安全收敛：
  - `exec` -> 参数化 `execFile`
- 已完成插件子工程真实构建验证：
  - `bun install`
  - `bun run build`
- 已完成插件 CLI 只读运行时 smoke：
  - `--help`
  - `versions`
- 已完成插件 CLI 写入型安装 smoke：
  - `init --offline --ai codex`
- 已完成插件 CLI 更新与卸载 smoke：
  - `update --ai codex`
  - `uninstall --ai codex`
- 已完成多平台抽样模板安装 smoke：
  - `codex`
  - `claude`
  - `continue`
  - `copilot`
  - `droid`

## 当前残余风险

### 一、主仓库残余风险
- 当前仍未把 `Host / Origin` 组合矩阵扩展成更大规模的系统枚举。
- 当前非 API 路径没有进一步设计化的缓存策略，只完成了 API 层收口。
- 当前仍未覆盖更系统化的异常 Header / Query / Cookie 矩阵。

### 二、插件目录残余风险
- 当前插件 CLI 仍依赖系统命令可用性，例如 PowerShell、unzip、xcopy、cp。
- 当前只做了多平台抽样，不是全平台穷举验证。
- 当前未对 `update` / `uninstall` 的所有 AI 类型分支做全覆盖。

### 三、环境与外部依赖残余风险
- 外部 API 密钥仍未配置。
- 邮件通知服务仍未配置。
- Node.js SQLite 仍处于实验性使用状态。

## 结论
- 本轮主仓库安全主线已经形成完整收口：
  - 有真实问题发现
  - 有最小修复
  - 有回归
  - 有文档
- 插件 CLI 治理第一轮也已形成完整收口：
  - 有依赖扫描
  - 有命令执行路径收敛
  - 有构建验证
  - 有运行时 smoke
  - 有多平台抽样
- 若以“完成本轮安全测试与治理主线”为目标，当前可以视为已完成。

## 建议
1. 若继续主线，优先做更系统化的 `Host / Origin` 组合矩阵。
2. 若继续主线，再考虑是否需要把非 API 缓存策略做设计化。
3. 若切到治理视角，可继续扩大插件 CLI 平台抽样覆盖，但优先级已低于主仓库矩阵扩展。
