# 音频 API

> 权限点:`audio:read`(音色/声纹查询、声纹比对)、`audio:write`(TTS/ASR/语音对话/声纹注册/音乐生成)。本模块覆盖 8 个端点,内部转发到 ai-service。

## GET /v1/audio/voices

音色列表(TTS 可用音色)。

**权限点**:`audio:read`

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "id": "voice-zh-female-1",
      "name": "晓晓",
      "gender": "female",
      "language": "zh-CN",
      "preview": "https://example.com/preview.mp3"
    }
  ]
}
```

### 代码示例

```typescript
const voices = await client.audio.listVoices()
```

## POST /v1/audio/speech

TTS 语音合成,文本转语音。

**权限点**:`audio:write`

### 请求

```json
{
  "model": "tts-1",
  "input": "你好,欢迎使用 IHUI-AI",
  "voice": "voice-zh-female-1",
  "responseFormat": "mp3",
  "speed": 1.0
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | TTS 模型 ID |
| input | string | 是 | 待合成文本 |
| voice | string | 是 | 音色 ID,见 `GET /v1/audio/voices` |
| responseFormat | string | 否 | 输出格式:`mp3` / `wav` / `flac`,默认 mp3 |
| speed | number | 否 | 语速,0.25-4.0,默认 1.0 |

### 响应(200)

```json
{
  "audio": "base64编码的音频数据",
  "format": "mp3",
  "durationMs": 3200
}
```

### 代码示例

```typescript
const result = await client.audio.speech({
  model: 'tts-1',
  input: '你好,欢迎使用 IHUI-AI',
  voice: 'voice-zh-female-1',
})
// result.audio 为 base64,需解码保存
fs.writeFileSync('output.mp3', Buffer.from(result.audio, 'base64'))
```

## POST /v1/audio/transcriptions

ASR 语音识别,音频转文本。

**权限点**:`audio:write`

### 请求

```json
{
  "model": "whisper-1",
  "audio": "base64编码的音频数据",
  "language": "zh",
  "prompt": "以下是中文对话"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | ASR 模型 ID |
| audio | string | 是 | base64 编码的音频 |
| language | string | 否 | 语言代码,如 `zh` / `en` |
| prompt | string | 否 | 提示词,辅助识别 |

### 响应(200)

```json
{
  "text": "你好,欢迎使用 IHUI-AI",
  "language": "zh",
  "duration": 3.2,
  "segments": [
    { "id": 0, "start": 0.0, "end": 3.2, "text": "你好,欢迎使用 IHUI-AI" }
  ]
}
```

### 代码示例

```typescript
const result = await client.audio.transcriptions({
  model: 'whisper-1',
  audio: Buffer.from(fs.readFileSync('input.mp3')).toString('base64'),
  language: 'zh',
})
console.log(result.text)
```

## POST /v1/audio/chat

语音对话,输入音频 + 文本,返回文本 + 音频。

**权限点**:`audio:write`

### 请求

```json
{
  "audio": "base64编码的音频",
  "model": "gpt-4",
  "sessionId": "session-abc"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| audio | string | 是 | base64 编码的用户语音 |
| model | string | 是 | 对话模型 ID |
| sessionId | string | 否 | 会话 ID,多轮对话 |

### 响应(200)

```json
{
  "text": "你好!有什么可以帮你的吗?",
  "audio": "base64编码的回复音频",
  "sessionId": "session-abc"
}
```

### 代码示例

```typescript
const result = await client.audio.chat({
  audio: Buffer.from(fs.readFileSync('question.mp3')).toString('base64'),
  model: 'gpt-4',
})
```

## GET /v1/audio/speakers

声纹列表(已注册的声纹)。

**权限点**:`audio:read`

### 响应(200)

```json
{
  "object": "list",
  "data": [
    { "id": "speaker-1", "name": "张三", "registeredAt": "2026-07-22T08:00:00Z" }
  ]
}
```

### 代码示例

```typescript
const speakers = await client.audio.listSpeakers()
```

## POST /v1/audio/speakers

声纹注册。

**权限点**:`audio:write`

### 请求

```json
{
  "name": "张三",
  "audio": "base64编码的音频样本"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 声纹名称 |
| audio | string | 是 | base64 编码的注册音频 |

### 响应(201)

```json
{
  "id": "speaker-1",
  "name": "张三",
  "registeredAt": "2026-07-22T08:00:00Z"
}
```

### 代码示例

```typescript
const speaker = await client.audio.registerSpeaker({
  name: '张三',
  audio: Buffer.from(fs.readFileSync('sample.mp3')).toString('base64'),
})
```

## POST /v1/audio/speakers/compare

声纹比对,验证音频是否匹配已注册声纹。

**权限点**:`audio:read`

### 请求

```json
{
  "speakerId": "speaker-1",
  "audio": "base64编码的待验证音频"
}
```

### 响应(200)

```json
{
  "score": 0.92,
  "matched": true
}
```

> `score` 为相似度(0-1),`matched` 为是否达到匹配阈值。

### 代码示例

```typescript
const result = await client.audio.compareSpeakers({
  speakerId: 'speaker-1',
  audio: Buffer.from(fs.readFileSync('verify.mp3')).toString('base64'),
})
```

## POST /v1/audio/music

音乐生成。

**权限点**:`audio:write`

### 请求

```json
{
  "prompt": "轻快的钢琴背景音乐",
  "lyrics": "可选歌词",
  "duration": 30
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| prompt | string | 是 | 音乐描述 |
| lyrics | string | 否 | 歌词(带人声时) |
| duration | number | 否 | 时长(秒) |

### 响应(202)

```json
{
  "taskId": "music-task-1",
  "status": "pending"
}
```

> 音乐生成为异步任务,需轮询任务状态(具体查询端点由 ai-service 决定)。

### 代码示例

```typescript
const result = await client.audio.music({
  prompt: '轻快的钢琴背景音乐',
  duration: 30,
})
```

## 错误码

| 状态码 | 场景 |
|--------|------|
| 400 | 音频为空 / model 为空 / 格式不支持 |
| 401 | API Key 无效 |
| 403 | 缺少 `audio:read` / `audio:write` 权限 |
| 413 | 音频过大 |
| 429 | 配额超限 |
| 502 | 上游 ai-service 错误 |

---

*最后更新: 2026-07-22*
