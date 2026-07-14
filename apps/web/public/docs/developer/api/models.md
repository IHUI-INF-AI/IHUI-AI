# 模型API

## 获取模型列表

### 端点

```
GET /v1/models
```

### 请求

```http
GET /v1/models
Authorization: Bearer YOUR_API_KEY
```

### 响应

```json
{
  "code": 200,
  "success": true,
  "data": {
    "models": [
      {
        "id": "gpt-4",
        "name": "GPT-4",
        "provider": "openai",
        "capabilities": ["chat", "completion"],
        "pricing": {
          "input": 0.03,
          "output": 0.06
        }
      }
    ]
  }
}
```

## 获取模型详情

### 端点

```
GET /v1/models/:id
```

### 请求

```http
GET /v1/models/gpt-4
Authorization: Bearer YOUR_API_KEY
```

### 响应

```json
{
  "code": 200,
  "success": true,
  "data": {
    "id": "gpt-4",
    "name": "GPT-4",
    "provider": "openai",
    "description": "GPT-4 is a large language model",
    "capabilities": ["chat", "completion"],
    "pricing": {
      "input": 0.03,
      "output": 0.06
    },
    "limits": {
      "max_tokens": 8192,
      "context_length": 128000
    }
  }
}
```

## 支持的模型

### OpenAI

- `gpt-4` - GPT-4模型
- `gpt-4-turbo` - GPT-4 Turbo
- `gpt-3.5-turbo` - GPT-3.5 Turbo

### Anthropic

- `claude-3-5-sonnet` - Claude 3.5 Sonnet
- `claude-3-opus` - Claude 3 Opus

### Google

- `gemini-pro` - Gemini Pro
- `gemini-ultra` - Gemini Ultra

## 代码示例

### JavaScript

```javascript
// 获取模型列表
const response = await fetch('https://api.example.com/v1/models', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
})

const data = await response.json()
console.log(data.data.models)

// 获取模型详情
const modelResponse = await fetch('https://api.example.com/v1/models/gpt-4', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
})

const modelData = await modelResponse.json()
console.log(modelData.data)
```

---

*最后更新: 2026-01-10*
