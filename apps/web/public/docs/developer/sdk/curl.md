# cURL示例

## 对话API

### 创建对话

```bash
curl -X POST https://api.example.com/v1/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ]
  }'
```

### 流式输出

```bash
curl -X POST https://api.example.com/v1/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {
        "role": "user",
        "content": "Hello"
      }
    ],
    "stream": true
  }'
```

## 模型API

### 获取模型列表

```bash
curl https://api.example.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 获取模型详情

```bash
curl https://api.example.com/v1/models/gpt-4 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 文件API

### 上传文件

```bash
curl -X POST https://api.example.com/v1/files \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@example.pdf" \
  -F "purpose=assistants"
```

### 获取文件列表

```bash
curl https://api.example.com/v1/files \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 删除文件

```bash
curl -X DELETE https://api.example.com/v1/files/file-123 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 智能体API

### 获取智能体列表

```bash
curl "https://api.example.com/v1/agents?page=1&page_size=10" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 调用智能体

```bash
curl -X POST https://api.example.com/v1/agents/agent-123/call \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Hello",
    "context": {
      "user_id": "user-123"
    }
  }'
```

## 环境变量

建议将API密钥存储在环境变量中：

```bash
export AIZHS_API_KEY="YOUR_API_KEY"
```

然后在cURL中使用：

```bash
curl https://api.example.com/v1/models \
  -H "Authorization: Bearer $AIZHS_API_KEY"
```

---

*最后更新: 2026-01-10*
