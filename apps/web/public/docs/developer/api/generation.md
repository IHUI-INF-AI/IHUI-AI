# 生成队列 API

> 权限点:`generation:write`(入队/状态/取消)。本模块覆盖 3 个端点,统一异步任务队列,适用于图像/视频/3D/音乐等耗时生成任务的统一管理。

## POST /v1/generation/enqueue

生成任务入队,返回排队位置。

**权限点**:`generation:write`

### 请求

```json
{
  "type": "image",
  "payload": {
    "model": "dall-e-3",
    "prompt": "一只猫"
  },
  "priority": 0
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 任务类型,如 `image` / `video` / `3d` / `music` |
| payload | object | 是 | 任务参数,结构由 type 决定(对应各模块的请求体) |
| priority | number | 否 | 优先级,数值越大越优先,默认 0 |

### 响应(202)

```json
{
  "jobId": "gen-job-123",
  "status": "queued",
  "position": 3
}
```

> `position` 为当前排队位置(0 表示立即开始处理)。

### 代码示例

```typescript
const job = await client.generation.enqueue({
  type: 'image',
  payload: { model: 'dall-e-3', prompt: '一只猫' },
  priority: 0,
})
console.log(job.jobId, '排队位置:', job.position)
```

```bash
curl -X POST http://localhost:3001/v1/generation/enqueue \
  -H "Authorization: Bearer ihui_xxx" \
  -H "Content-Type: application/json" \
  -d '{"type":"image","payload":{"model":"dall-e-3","prompt":"一只猫"}}'
```

## GET /v1/generation/status/:id

查询生成任务状态。

**权限点**:`generation:write`

### 请求

```http
GET /v1/generation/status/gen-job-123
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "jobId": "gen-job-123",
  "status": "completed",
  "result": {
    "url": "https://example.com/result.png"
  },
  "error": null,
  "progress": 100
}
```

`status` 取值:`queued` / `processing` / `completed` / `failed` / `cancelled`。

- `completed` 时 `result` 含生成结果(结构由任务类型决定)
- `failed` 时 `error` 含错误信息
- `processing` 时 `progress` 为进度百分比(0-100)

### 代码示例

```typescript
const status = await client.generation.getStatus('gen-job-123')
if (status.status === 'completed') {
  console.log('结果:', status.result)
}
```

### 轮询示例

```typescript
async function waitJob(jobId: string) {
  let status = await client.generation.getStatus(jobId)
  while (status.status === 'queued' || status.status === 'processing') {
    await new Promise(r => setTimeout(r, 3000))
    status = await client.generation.getStatus(jobId)
  }
  return status
}

const result = await waitJob('gen-job-123')
```

## POST /v1/generation/cancel/:id

取消排队或处理中的任务。

**权限点**:`generation:write`

### 请求

```http
POST /v1/generation/cancel/gen-job-123
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "jobId": "gen-job-123",
  "status": "cancelled"
}
```

> 已 `completed` 或 `failed` 的任务无法取消。

### 代码示例

```typescript
const result = await client.generation.cancel('gen-job-123')
console.log(result.status) // 'cancelled'
```

## 错误码

| 状态码 | 场景 |
|--------|------|
| 400 | type 为空 / payload 为空 |
| 401 | API Key 无效 |
| 403 | 缺少 `generation:write` 权限 |
| 404 | 任务不存在 |
| 409 | 任务已完成,无法取消 |
| 429 | 配额超限 |
| 502 | 上游生成服务错误 |

---

*最后更新: 2026-07-22*
