# 上传文件魔数校验修复记录

## 目标
修复审查报告中“上传文件只按扩展名过滤”的问题，为允许上传的音频和图片类型增加最小 magic bytes 校验，拒绝伪造扩展名的内容。

## 范围
- 修改 `server\routes\local.js` 的 `/api/upload` 校验逻辑。
- 新增聚焦测试覆盖伪造 `.mp3`、扩展名与内容不匹配、合法图片上传。
- 不引入第三方文件扫描服务、不处理杀毒扫描、不改变上传 API 请求格式。

## 假设
- 当前上传以 base64 传输，后端可在写盘前检查 `Buffer` 前几个字节。
- 本轮支持现有允许扩展名：`.mp3`、`.wav`、`.m4a`、`.aac`、`.ogg`、`.png`、`.jpg`、`.jpeg`、`.webp`。
- Magic bytes 是最小安全门槛，不能替代完整媒体解析或恶意内容扫描。

## 风险
- 部分合法但头部异常或罕见封装的音频可能被拒绝。
- 现有测试若使用随意文本伪装音频并走到上传成功路径，需要改为真实或最小合法签名。

## TODO
1. 新增聚焦测试：认证后上传文本内容伪装 `.mp3` 应被拒绝。
2. 新增聚焦测试：认证后上传 PNG 内容但使用 `.mp3` 扩展名应被拒绝。
3. 新增聚焦测试：认证后上传最小 PNG 签名内容 `.png` 应成功写盘。
4. 修改 `server\routes\local.js`，增加 magic bytes 类型识别和扩展名匹配校验。
5. 运行聚焦测试、API auth boundary、回归核心、语法检查。
6. 复盘新问题、边界条件、遗漏点，并回写本文件。
7. 提交本轮上传魔数校验修复。

## 完成标准
- 伪造扩展名内容不会写入输出目录。
- 扩展名和识别到的内容类型不匹配时返回稳定 reason。
- 合法允许类型仍可上传成功。
- 相关验证命令通过。

## 验证方式
- `node test-upload-magic-bytes.js`
- `node test-api-auth-boundary.js`
- `npm run test:release-core`
- `npm run check`

## 执行记录
- 已完成根因调查：`server\routes\local.js` 当前只检查 `path.extname(filename)` 是否在允许列表中，随后直接 `fs.writeFileSync`。
- TODO 1-3 已新增聚焦测试：`test-upload-magic-bytes.js` 覆盖文本伪装 `.mp3`、PNG 内容伪装 `.mp3`、合法 PNG 上传。
- 预修复验证：`node test-upload-magic-bytes.js` 失败，失败点为伪造 `.mp3` 被允许上传，符合预期。
- TODO 4 已完成：`server\routes\local.js` 增加 magic bytes 类型识别，并要求识别类型和扩展名匹配后才写盘。
- 修复后聚焦验证：`node test-upload-magic-bytes.js` 通过。

## 验证结果
- `node test-upload-magic-bytes.js`：通过。覆盖伪造 `.mp3`、PNG 伪装 `.mp3`、合法 `.png`。
- `node test-api-auth-boundary.js`：通过。上传接口鉴权边界未回归。
- `npm run test:release-core`：通过。回归总计 12 项，10 通过，2 个浏览器项按参数跳过，0 失败；容量基线完成。
- `npm run check`：通过。

## 复盘
- TODO 1-3 复盘：测试走真实登录和 `/api/upload` 路径，能覆盖鉴权后的上传处理；本轮不改变响应 envelope，保持现有 200 + error 的业务风格。
- TODO 4-6 复盘：当前 magic bytes 覆盖常见 PNG、JPEG、WebP、WAV、OGG、MP3、AAC、MP4/M4A 头部。它能阻止明显伪造，但不是完整媒体解析或恶意内容扫描；深度扫描仍属于后续安全增强。
