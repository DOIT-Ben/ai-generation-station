# 2026-04-25 Regression Temp DB Fix Plan

## 目标
- 修复 `test-regression.js` 在当前环境下因默认状态库路径不可写而中断的问题。

## 范围
- `test-regression.js`
- `test-failures.js`
- 与本轮按钮优化直接相关的验证链路

## 假设
- 当前失败不是业务逻辑错误，而是回归脚本未为聚合测试显式提供临时可写状态库。
- 修复测试脚本后，不应改变生产或应用运行逻辑。

## 风险
- 如果临时状态目录清理不完整，可能留下测试垃圾文件。
- 如果环境变量恢复不完整，可能影响后续单测读取配置。

## TODO
1. 为 `test-regression.js` 的内嵌服务器提供临时 SQLite 与 legacy state 文件。
2. 为 `test-failures.js` 的主服务与子服务测试入口提供临时 SQLite 与 legacy state 文件。
3. 确保测试结束后清理临时目录并恢复环境变量。
4. 重新运行无浏览器与浏览器验证。
5. 回写执行记录与复盘。

## 完成标准
- `test-regression.js --skip-live --skip-browser` 稳定通过。
- 浏览器单项验证通过。
- 不引入新的业务代码改动。

## 验证方式
- 运行目标回归脚本。
- 运行浏览器单项回归。

## 执行记录
- 2026-04-25：已定位到错误来源为 `test-regression.js` 使用默认状态库路径导致的只读数据库写入失败。
- 2026-04-25：执行 `test-regression.js --skip-live --skip-browser` 后，确认 `Smoke` 已恢复通过，但 `Failures` 仍因 `test-failures.js` 继续使用默认状态库而失败，归类为同类测试支架问题，纳入当前必修范围。
- 2026-04-25：已在 `test-regression.js` 中为内嵌服务注入临时 `APP_STATE_DB` 与 `APP_STATE_FILE`，并在结束时恢复环境变量、清理临时目录。
- 2026-04-25：已在 `test-failures.js` 中为主服务与缺省 API key 场景都注入独立临时状态库，避免共享默认只读路径。
- 2026-04-25：执行 `node test-failures.js` 通过。
- 2026-04-25：执行 `node test-regression.js --skip-live --skip-browser` 通过。
- 2026-04-25：执行 `node test-regression.js --skip-live --port 18814` 通过，浏览器链路与非浏览器链路均恢复稳定。

## 复盘
- 这次失败根因是测试支架默认依赖环境中的状态库存储位置，而不是业务逻辑回归；修复点应留在测试入口，不应下沉到生产代码。
- `test-regression.js` 与 `test-failures.js` 分别持有自己的建服流程，后续若再新增聚合测试，需同步检查是否显式隔离状态库、端口与临时文件。
