# MiniMax API 模型调用指南

> 本文档记录 MiniMax 开放平台支持的 AI 模型 API 调用方式
> 
> 更新时间：2026-04-10
> 
> API 密钥：请通过环境变量 `MINIMAX_API_KEY` 配置，不要把真实密钥写入文档或代码。
> 
> API 基础地址：`https://api.minimaxi.com`

---

## 目录

1. [语音合成 (TTS)](#1-语音合成-tts)
2. [音乐生成 (Music)](#2-音乐生成-music)
3. [歌词生成 (Lyrics)](#3-歌词生成-lyrics)
4. [歌声翻唱 (Music Cover)](#4-歌声翻唱-music-cover)
5. [图片生成 (Image)](#5-图片生成-image)
6. [视频生成 (Video)](#6-视频生成-video)

---

## API 调用通用规范

### 认证方式

所有 API 请求需要在 Header 中携带 API Key：

```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

### 通用错误码

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 1001 | 认证失败，请检查 API Key |
| 1002 | 参数错误 |
| 1003 | 余额不足 |
| 1004 | 请求过于频繁，超出速率限制 |
| 1005 | 账户已被封禁 |
| 2001 | 资源不存在 |
| 2002 | 任务不存在或已过期 |
| 3001 | 服务内部错误 |
| 3002 | 模型服务暂时不可用 |

---

## 1. 语音合成 (TTS)

### 模型信息

| 项目 | 值 |
|------|-----|
| 模型名称 | `speech-2.8-hd` (推荐), `speech-02-hd` |
| API 端点 | `/v1/t2a_v2` |
| 方法 | POST |
| 功能 | 文本转语音，支持多种音色和情绪控制 |
| 费用 | 按字符数计费 |

### 请求示例

```javascript
const response = await fetch('https://api.minimaxi.com/v1/t2a_v2', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        model: 'speech-2.8-hd',      // 模型名称
        text: '你好，这是测试文本',     // 要转换的文本
        voice_id: '声音ID',            // 音色ID
        emotion: 'happy',              // 情绪：happy, sad, angry, fearful, surprised, disgusted
        output_format: 'mp3',         // 输出格式：mp3, wav, pcm
        speed: 1.0,                   // 语速：0.5-2.0
        pitch: 1.0,                   // 音调：0.5-2.0
        vol: 1.0                      // 音量：0-100
    })
});
```

### 响应示例

```json
{
    "base_resp": {
        "status_code": 0,
        "status_msg": "success"
    },
    "data": {
        "audio_file": "base64编码的音频数据",
        "extra_info": {
            "audio_length": 5.2,
            "audio_sample_rate": 32000,
            "usage_characters": 15
        }
    }
}
```

### 代码调用位置

- **前端**：`public/js/app.js` - `initTTSEvents()`
- **后端**：`server/index.js` - `/api/tts` 路由

---

## 2. 音乐生成 (Music)

### 模型信息

| 项目 | 值 |
|------|-----|
| 模型名称 | `music-2.6` (推荐), `music-01` |
| API 端点 | `/v1/music_generation` |
| 方法 | POST |
| 功能 | 根据文本描述生成背景音乐 |
| 费用 | 按生成时长计费 |
| 是否异步 | 是（需要轮询任务状态） |

### 请求示例

```javascript
const response = await fetch('https://api.minimaxi.com/v1/music_generation', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        model: 'music-2.6',                // 模型名称
        prompt: '欢快的电子音乐，适合派对场景',  // 音乐描述
        duration: 30,                      // 时长（秒）：10-300
        lyrics: '[intro][outro]',          // 歌词（可选）
        genre: 'electronic',               // 风格：pop, rock, electronic, classical, jazz, folk, hiphop, rnb, ambient
        tempo: 120,                       // BPM（可选）
        vocal: false                      // 是否有人声（默认 false）
    })
});
```

### 响应示例（异步任务）

```json
{
    "task_id": "music_task_xxxxxxxx",
    "status": "pending",
    "created_at": 1710000000
}
```

### 查询任务状态

```
GET /v1/music_generation_result?task_id=xxx
```

### 代码调用位置

- **前端**：`public/js/app.js` - `initMusicEvents()`
- **后端**：`server/index.js` - `/api/music` 路由和 `processMusicTask()` 函数

---

## 3. 歌词生成 (Lyrics)

### 模型信息

| 项目 | 值 |
|------|-----|
| 模型名称 | `lyrics_generation` |
| API 端点 | `/v1/lyrics_generation` |
| 方法 | POST |
| 功能 | 根据主题和风格生成原创歌词 |
| 费用 | 按生成字数计费 |
| 是否异步 | 否（同步返回） |

### 请求示例

```javascript
const response = await fetch('https://api.minimaxi.com/v1/lyrics_generation', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        mode: 'write_full_song',          // 模式：write_full_song
        prompt: '一首关于夏日海边浪漫邂逅的情歌'  // 歌词主题描述
    })
});
```

### 响应示例

```json
{
    "song_title": "夏日海风",
    "style_tags": "romantic, pop, summer, beach, dreamy",
    "lyrics": "[Verse 1]\n海风轻轻吹过\n阳光洒在沙滩\n\n[Chorus]\n在这个夏天\n我遇见了你...",
    "base_resp": {
        "status_code": 0,
        "status_msg": "success"
    }
}
```

### 代码调用位置

- **前端**：`public/js/app.js` - `initLyricsEvents()`
- **后端**：`server/index.js` - `/api/lyrics` 路由和 `callLyricsAPI()` 函数

---

## 4. 歌声翻唱 (Music Cover)

### 模型信息

| 项目 | 值 |
|------|-----|
| 模型名称 | `music-cover` |
| API 端点 | `/v1/music_cover` |
| 方法 | POST |
| 功能 | 将音频转换为不同的演唱风格/音色 |
| 费用 | 按音频时长计费 |
| 是否异步 | 是（需要轮询任务状态） |

### 请求示例

```javascript
const response = await fetch('https://api.minimaxi.com/v1/music_cover', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        model: 'music-cover',              // 模型名称
        audio_url: 'https://example.com/audio.mp3',  // 源音频URL
        prompt: '转换为女声，保持原曲风格'  // 翻唱描述
    })
});
```

### 响应示例（异步任务）

```json
{
    "task_id": "cover_task_xxxxxxxx",
    "status": "pending",
    "created_at": 1710000000
}
```

### 查询任务状态

```
GET /v1/music_cover_result?task_id=xxx
```

### 代码调用位置

- **前端**：`public/js/app.js` - `initCoverEvents()`
- **后端**：`server/index.js` - `/api/music-cover` 路由

---

## 5. 图片生成 (Image)

### 模型信息

| 项目 | 值 |
|------|-----|
| 模型名称 | `image-01` (推荐), `image-01-mini` |
| API 端点 | `/v1/image_generation` |
| 方法 | POST |
| 功能 | 根据文本描述生成图片（文生图） |
| 费用 | 按图片数量/分辨率计费 |
| 是否异步 | 是（需要轮询任务状态） |

### 请求示例

```javascript
const response = await fetch('https://api.minimaxi.com/v1/image_generation', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        model: 'image-01',                // 模型名称
        prompt: '科技感紫色渐变背景，未来城市天际线',  // 图片描述
        aspect_ratio: '16:9'             // 比例：1:1, 16:9, 9:16, 3:4, 4:3
    })
});
```

### 响应示例（异步任务）

```json
{
    "task_id": "image_task_xxxxxxxx",
    "status": "pending",
    "created_at": 1710000000
}
```

### 查询任务状态

```
GET /v1/image_generation_result?task_id=xxx
```

### 返回图片信息

```json
{
    "task_id": "image_task_xxxxxxxx",
    "status": "completed",
    "image_urls": ["https://cdn.minimax.io/xxx.png"],
    "metadata": {
        "width": 1920,
        "height": 1080,
        "format": "png"
    }
}
```

### 代码调用位置

- **前端**：`public/js/app.js` - `initImageEvents()`
- **后端**：`server/index.js` - `/api/image` 路由和 `processImageTask()` 函数

---

## 6. 视频生成 (Video)

### 模型信息

| 项目 | 值 |
|------|-----|
| 模型名称 | `video-01` |
| API 端点 | `/v1/video_generation` |
| 方法 | POST |
| 功能 | 根据文本或图片生成视频 |
| 费用 | 按视频时长计费 |
| 是否异步 | 是（需要轮询任务状态） |

### 请求示例

```javascript
const response = await fetch('https://api.minimaxi.com/v1/video_generation', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        model: 'video-01',
        prompt: '一只猫在草地上奔跑，阳光明媚',  // 视频描述
        duration: 5,                       // 时长（秒）：5-60
        resolution: '720p'                // 分辨率：720p, 1080p
    })
});
```

### 响应示例（异步任务）

```json
{
    "task_id": "video_task_xxxxxxxx",
    "status": "pending",
    "created_at": 1710000000
}
```

### 查询任务状态

```
GET /v1/query/video_generation?task_id=xxx
```

### 下载视频文件

```
GET /v1/files/retrieve?file_id=xxx
```

### 状态说明

⚠️ **注意**：视频生成 API 可能需要额外权限或配额，如提示无权限请联系 MiniMax 客服。

---

## 支持模型汇总表

| 功能 | 模型名称 | API 端点 | 同步/异步 | 状态 |
|------|----------|----------|-----------|------|
| 语音合成 | `speech-2.8-hd`, `speech-02-hd` | `/v1/t2a_v2` | 同步 | ✅ 已实现 |
| 音乐生成 | `music-2.6`, `music-01` | `/v1/music_generation` | 异步 | ✅ 已实现 |
| 歌词生成 | `lyrics_generation` | `/v1/lyrics_generation` | 同步 | ✅ 已实现 |
| 歌声翻唱 | `music-cover` | `/v1/music_cover` | 异步 | ✅ 已实现 |
| 图片生成 | `image-01`, `image-01-mini` | `/v1/image_generation` | 异步 | ✅ 已实现 |
| 视频生成 | `video-01` | `/v1/video_generation` | 异步 | ⚠️ 待测试 |

---

## 异步任务处理流程

对于异步 API（音乐、图片、视频、歌声翻唱），需要：

1. **发起任务** → 获取 `task_id`
2. **轮询状态** → 定时请求 `/v1/{task}_result?task_id=xxx`
3. **任务完成** → 从响应中获取生成结果

### 轮询间隔建议

| 任务类型 | 建议轮询间隔 | 最大等待时间 |
|----------|-------------|-------------|
| 音乐生成 | 2-5 秒 | 5-10 分钟 |
| 图片生成 | 1-3 秒 | 1-3 分钟 |
| 视频生成 | 5-10 秒 | 10-30 分钟 |
| 歌声翻唱 | 2-5 秒 | 5-10 分钟 |

---

## 注意事项

1. **API Key 安全**：不要在前端代码中暴露完整的 API Key，建议通过后端代理转发请求

2. **异步任务超时**：异步任务有最大等待时间，超过后任务会被自动取消

3. **余额不足**：调用前建议检查账户余额，避免任务中途失败

4. **请求频率限制**：注意 API 的 QPS 限制，超出可能导致请求被拒绝

---

## 相关文件

- 服务器代码：`E:\Agents\AI-Generation-Stations\server\index.js`
- 前端代码：`E:\Agents\AI-Generation-Stations\public\js\app.js`
- 样式文件：`E:\Agents\AI-Generation-Stations\public\css\style.css`
- 输出目录：`D:\openclaw\minimax-output`

---

*本文档由 AI 助手自动生成，如有疑问请联系 MiniMax 技术支持。*
