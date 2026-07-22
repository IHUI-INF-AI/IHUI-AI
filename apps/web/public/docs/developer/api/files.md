# 文件 API

> 权限点:`files:read`(查询/内容/版本)、`files:write`(上传/删除/分片上传)。本模块覆盖 9 个端点,支持 multipart 直传与大文件分片上传(3 步)。

## GET /v1/files

文件列表。

**权限点**:`files:read`

### 请求

```http
GET /v1/files
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "id": "file-123",
      "object": "file",
      "bytes": 1024,
      "createdAt": 1677652288,
      "filename": "example.pdf",
      "purpose": "assistants"
    }
  ]
}
```

> camelCase:`createdAt`(非 `created_at`)。

### 代码示例

```typescript
const files = await client.files.list()
```

## POST /v1/files

上传文件(multipart/form-data),适合小文件(单次上传)。

**权限点**:`files:write`

### 请求

```http
POST /v1/files
Authorization: Bearer ihui_xxx
Content-Type: multipart/form-data
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | binary | 是 | 文件二进制 |
| purpose | string | 否 | 用途,如 `assistants` / `vision` |

### cURL 示例

```bash
curl -X POST http://localhost:3001/v1/files \
  -H "Authorization: Bearer ihui_xxx" \
  -F "file=@example.pdf" \
  -F "purpose=assistants"
```

### 响应(201)

```json
{
  "id": "file-123",
  "object": "file",
  "bytes": 1024,
  "createdAt": 1677652288,
  "filename": "example.pdf",
  "purpose": "assistants"
}
```

### 代码示例

```typescript
const file = await client.files.upload(fs.createReadStream('example.pdf'), {
  purpose: 'assistants',
})
```

## GET /v1/files/:id

文件详情。

**权限点**:`files:read`

### 响应(200)

```json
{
  "id": "file-123",
  "object": "file",
  "bytes": 1024,
  "createdAt": 1677652288,
  "filename": "example.pdf",
  "purpose": "assistants"
}
```

### 代码示例

```typescript
const file = await client.files.get('file-123')
```

## DELETE /v1/files/:id

删除文件。

**权限点**:`files:write`

### 响应(204)

无内容。

### 代码示例

```typescript
await client.files.delete('file-123')
```

## GET /v1/files/:id/content

获取文件内容(二进制流)。

**权限点**:`files:read`

### 响应(200)

`Content-Type` 根据文件类型决定(如 `application/pdf`),响应体为文件二进制内容。

### 代码示例

```typescript
const stream = await client.files.getContent('file-123')
```

## GET /v1/files/:id/versions

文件历史版本列表。

**权限点**:`files:read`

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "id": "ver-1",
      "version": 1,
      "bytes": 1024,
      "createdAt": "2026-07-22T08:00:00Z"
    },
    {
      "id": "ver-2",
      "version": 2,
      "bytes": 2048,
      "createdAt": "2026-07-22T09:00:00Z"
    }
  ]
}
```

### 代码示例

```typescript
const versions = await client.files.getVersions('file-123')
```

## 分片上传(3 步)

大文件(>50MB)推荐使用分片上传,避免单次请求超时。

### 第 1 步:POST /v1/files/upload-init

初始化分片上传会话。

**权限点**:`files:write`

#### 请求

```json
{
  "filename": "large-video.mp4",
  "sizeBytes": 524288000,
  "chunkSize": 5242880,
  "purpose": "assistants"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| filename | string | 是 | 文件名 |
| sizeBytes | number | 是 | 文件总字节数 |
| chunkSize | number | 是 | 每片字节数(推荐 5MB = 5242880) |
| purpose | string | 否 | 用途 |

#### 响应(200)

```json
{
  "uploadId": "upload-abc",
  "chunkCount": 100,
  "chunkSize": 5242880
}
```

### 第 2 步:POST /v1/files/upload-chunk

上传单个分片(可并行上传多片)。

**权限点**:`files:write`

#### 请求

```http
POST /v1/files/upload-chunk
Authorization: Bearer ihui_xxx
Content-Type: multipart/form-data
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uploadId | string | 是 | 第 1 步返回的 uploadId |
| index | number | 是 | 分片索引(0-based) |
| chunk | binary | 是 | 分片二进制 |

#### 响应(200)

```json
{
  "uploadId": "upload-abc",
  "index": 0,
  "received": true
}
```

### 第 3 步:POST /v1/files/complete

完成分片上传,合并为最终文件。

**权限点**:`files:write`

#### 请求

```json
{
  "uploadId": "upload-abc"
}
```

#### 响应(201)

```json
{
  "id": "file-456",
  "object": "file",
  "bytes": 524288000,
  "createdAt": 1677652288,
  "filename": "large-video.mp4",
  "purpose": "assistants"
}
```

### 分片上传完整代码示例

**TypeScript(@ihui/sdk)**

```typescript
import fs from 'fs'

const filePath = 'large-video.mp4'
const stat = fs.statSync(filePath)
const chunkSize = 5 * 1024 * 1024 // 5MB

// 1. 初始化
const init = await client.files.uploadInit({
  filename: 'large-video.mp4',
  sizeBytes: stat.size,
  chunkSize,
})

// 2. 并行上传分片
const chunkCount = init.chunkCount
await Promise.all(
  Array.from({ length: chunkCount }, async (_, i) => {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, stat.size)
    const chunk = fs.createReadStream(filePath, { start, end })
    await client.files.uploadChunk({
      uploadId: init.uploadId,
      index: i,
      chunk,
    })
  })
)

// 3. 完成
const file = await client.files.uploadComplete({ uploadId: init.uploadId })
console.log(file.id)
```

**cURL(单分片示例)**

```bash
# 1. 初始化
curl -X POST http://localhost:3001/v1/files/upload-init \
  -H "Authorization: Bearer ihui_xxx" \
  -H "Content-Type: application/json" \
  -d '{"filename":"large.mp4","sizeBytes":524288000,"chunkSize":5242880}'

# 2. 上传分片(重复 chunkCount 次)
curl -X POST http://localhost:3001/v1/files/upload-chunk \
  -H "Authorization: Bearer ihui_xxx" \
  -F "uploadId=upload-abc" \
  -F "index=0" \
  -F "chunk=@chunk-0.bin"

# 3. 完成
curl -X POST http://localhost:3001/v1/files/complete \
  -H "Authorization: Bearer ihui_xxx" \
  -H "Content-Type: application/json" \
  -d '{"uploadId":"upload-abc"}'
```

## 错误码

| 状态码 | 场景 |
|--------|------|
| 400 | 文件为空 / 分片索引越界 / sizeBytes 不匹配 |
| 401 | API Key 无效 |
| 403 | 缺少 `files:read` / `files:write` 权限 |
| 404 | 文件 / uploadId 不存在 |
| 413 | 文件过大(超过单次上传限制) |
| 429 | 配额超限 |

---

*最后更新: 2026-07-22*
