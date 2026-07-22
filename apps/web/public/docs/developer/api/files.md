# 文件 API

> 所需权限：`files:read`（读取）、`files:write`（上传/删除）

## 上传文件

### 端点

```
POST /v1/files
```

**实现状态**：已实现

### 请求

```http
POST /v1/files
Authorization: Bearer ihui_xxx
Content-Type: multipart/form-data

file: <文件>
purpose: "assistants"
```

### 响应

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

> **字段命名**：`createdAt`（非 `created_at`），与 `@ihui/types` 契约一致。

## 获取文件列表

### 端点

```
GET /v1/files
```

**实现状态**：已实现

### 请求

```http
GET /v1/files
Authorization: Bearer ihui_xxx
```

### 响应

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

## 获取文件详情

### 端点

```
GET /v1/files/:id
```

**实现状态**：已实现

### 响应

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

## 删除文件

### 端点

```
DELETE /v1/files/:id
```

**实现状态**：已实现

**所需权限**：`files:write`

### 响应

```json
{
  "id": "file-123",
  "object": "file",
  "deleted": true
}
```

## 代码示例

### JavaScript

```javascript
// 上传文件
const formData = new FormData()
formData.append('file', fileInput.files[0])
formData.append('purpose', 'assistants')

const uploadResponse = await fetch('https://api.example.com/v1/files', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ihui_xxx'
  },
  body: formData
})

const uploadData = await uploadResponse.json()
console.log(uploadData.id)

// 获取文件列表
const filesResponse = await fetch('https://api.example.com/v1/files', {
  headers: {
    'Authorization': 'Bearer ihui_xxx'
  }
})

const filesData = await filesResponse.json()
console.log(filesData.data)
```

---

*最后更新: 2026-07-22*
