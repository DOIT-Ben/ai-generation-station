# 2026-04-27 安全性测试第三十六阶段执行记录

## 结果
- 已补 1 组裸 IPv6 允许来源样本：
  - `Origin: http://[::1]`
- 已补 1 组裸 IPv6 拒绝样本：
  - `Origin: http://[::2]`
- 已执行回归：
  - `node --check test-security-gateway.js`
  - `node test-security-gateway.js`
  - `node test-auth-history.js`
- 结果全部通过，未发现新的来源判定问题。

## 结论
- 当前 `Host / Origin` 组合矩阵已经覆盖到：
  - 默认端口
  - punycode / Unicode
  - IPv6 显式端口
  - IPv6 默认端口
  - 裸 IPv6
  - `ALLOWED_ORIGINS` 规范化组合
- 继续扩矩阵的收益已明显下降。
