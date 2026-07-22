# 视频 API

> 权限点:`videos:write`(生成/编排)、`videos:read`(任务查询)。本模块覆盖 3 个端点,异步任务模式,按 vendor 路由。

## POST /v1/videos/generations

视频生成,异步任务,返回 taskId。

**权限点**:`videos:write`

### 请求

```json
{
  "model": "kling-v1",
  "prompt": "一只猫在花园里追蝴蝶,阳光明媚",
  "image": "base64起始图片(可选)",
  "duration": 5,
  "resolution": "1080p",
  "vendor": "kling"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 视频模型 ID |
| prompt | string | 是 | 视频描述 |
| image | string | 否 | base64 起始图片(图生视频) |
| duration | number | 否 | 时长(秒),如 5 / 10 |
| resolution | string | 否 | 分辨率:`720p` / `1080p` / `4k` |
| vendor | string | 否 | 厂商:`kling` / `jimeng` / `sora2` 等 |

### 响应(202)

```json
{
  "taskId": "video-task-123",
  "status": "pending",
  "estimatedTime": 120
}
```

> `estimatedTime` 为预估生成秒数。

### 代码示例

```typescript
const task = await client.videos.generations({
  model: 'kling-v1',
  prompt: '一只猫在花园里追蝴蝶',
  duration: 5,
  resolution: '1080p',
  vendor: 'kling',
})
console.log(task.taskId)
```

```bash
curl -X POST http://localhost:3001/v1/videos/generations \
  -H "Authorization: Bearer ihui_xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"kling-v1","prompt":"一只猫追蝴蝶","vendor":"kling"}'
```

## GET /v1/videos/tasks/:id

视频任务状态查询。支持 sora2 → jimeng4 回退查询。

**权限点**:`videos:read`

### 请求

```http
GET /v1/videos/tasks/video-task-123
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "taskId": "video-task-123",
  "status": "completed",
  "videoUrl": "https://example.com/result.mp4",
  "progress": 100,
  "error": null,
  "createdAt": "2026-07-22T08:00:00Z"
}
```

`status` 取值:`pending` / `processing` / `completed` / `failed`。`completed` 时 `videoUrl` 非空,`failed` 时 `error` 含错误信息。

### 轮询示例

```typescript
// 轮询直到完成
let task = await client.videos.getTask('video-task-123')
while (task.status === 'pending' || task.status === 'processing') {
  await new Promise(r => setTimeout(r, 5000)) // 每 5 秒查询一次
  task = await client.videos.getTask('video-task-123')
}
if (task.status === 'completed') {
  console.log('视频地址:', task.videoUrl)
} else {
  console.error('生成失败:', task.error)
}
```

## POST /v1/videos/compose

视频编排,根据分镜列表合成视频。

**权限点**:`videos:write`

### 请求

```json
{
  "scenes": [
    { "text": "开场白", "duration": 3, "imagePrompt": "城市夜景" },
    { "text": "产品介绍", "duration": 5, "imagePrompt": "产品特写" },
    { "text": "结尾", "duration": 2 }
  ],
  "bgmUrl": "https://example.com/bgm.mp3"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| scenes | array | 是 | 分镜列表 |
| scenes[].text | string | 是 | 分镜文本/旁白 |
| scenes[].duration | number | 是 | 时长(秒) |
| scenes[].imagePrompt | string | 否 | 分镜画面提示词 |
| bgmUrl | string | 否 | 背景音乐 URL |

### 响应(202)

```json
{
  "composeId": "compose-456",
  "status": "processing"
}
```

### 代码示例

```typescript
const result = await client.videos.compose({
  scenes: [
    { text: '开场白', duration: 3, imagePrompt: '城市夜景' },
    { text: '产品介绍', duration: 5 },
  ],
  bgmUrl: 'https://example.com/bgm.mp3',
})
```

## 错误码

| 状态码 | 场景 |
|--------|------|
| 400 | prompt 为空 / 分镜为空 |
| 401 | API Key 无效 |
| 403 | 缺少 `videos:write` / `videos:read` 权限 |
| 404 | 任务不存在 |
| 429 | 配额超限 |
| 502 | 上游视频厂商错误 |

---

*最后更新: 2026-07-22*
