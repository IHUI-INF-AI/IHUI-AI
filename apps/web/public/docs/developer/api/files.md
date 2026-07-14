# 文件API

## 上传文件

### 端点

```
POST /v1/files
```

### 请求

```http
POST /v1/files
Authorization: Bearer YOUR_API_KEY
Content-Type: multipart/form-data

file: <file>
purpose: "assistants"
```

### 响应

```json
{
  "code": 200,
  "success": true,
  "data": {
    "id": "file-123",
    "object": "file",
    "bytes": 1024,
    "created_at": 1677652288,
    "filename": "example.pdf",
    "purpose": "assistants"
  }
}
```

## 获取文件信息

### 端点

```
GET /v1/files/:id
```

### 响应

```json
{
  "code": 200,
  "success": true,
  "data": {
    "id": "file-123",
    "object": "file",
    "bytes": 1024,
    "created_at": 1677652288,
    "filename": "example.pdf",
    "purpose": "assistants"
  }
}
```

## 获取文件列表

### 端点

```
GET /v1/files
```

### 响应

```json
{
  "code": 200,
  "success": true,
  "data": {
    "list": [
      {
        "id": "file-123",
        "filename": "example.pdf",
        "bytes": 1024,
        "created_at": 1677652288
      }
    ],
    "total": 10
  }
}
```

## 删除文件

### 端点

```
DELETE /v1/files/:id
```

### 响应

```json
{
  "code": 200,
  "success": true,
  "message": "File deleted successfully"
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
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: formData
})

const uploadData = await uploadResponse.json()
console.log(uploadData.data.id)

// 获取文件列表
const filesResponse = await fetch('https://api.example.com/v1/files', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
})

const filesData = await filesResponse.json()
console.log(filesData.data.list)
```

---

*最后更新: 2026-01-10*
