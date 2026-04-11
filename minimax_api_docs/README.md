# MiniMax API 文档

> MiniMax 开放平台 API 参考文档

## 文件列表

| 文件 | 说明 |
|------|------|
| `MiniMax_API_Models.md` | 完整的 API 模型调用指南 |

## 快速导航

### 已实现的 API

| 功能 | 文档章节 |
|------|----------|
| 语音合成 (TTS) | [查看](./MiniMax_API_Models.md#1-语音合成-tts) |
| 音乐生成 | [查看](./MiniMax_API_Models.md#2-音乐生成-music) |
| 歌词生成 | [查看](./MiniMax_API_Models.md#3-歌词生成-lyrics) |
| 歌声翻唱 | [查看](./MiniMax_API_Models.md#4-歌声翻唱-music-cover) |
| 图片生成 | [查看](./MiniMax_API_Models.md#5-图片生成-image) |
| 视频生成 | [查看](./MiniMax_API_Models.md#6-视频生成-video) |

## API 基础信息

- **Base URL**: `https://api.minimaxi.com`
- **认证**: `Authorization: Bearer YOUR_API_KEY`

## 错误码

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 1001 | 认证失败 |
| 1002 | 参数错误 |
| 1003 | 余额不足 |
| 1004 | 请求过于频繁 |
| 2001 | 资源不存在 |
| 2002 | 任务不存在或已过期 |
| 3001 | 服务内部错误 |
| 3002 | 模型服务暂时不可用 |

---

*最后更新：2026-04-10*
