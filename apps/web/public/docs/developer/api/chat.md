# 对话API

## 端点

```
POST /v1/chat
```

## 请求参数

### Headers

```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

### Body

```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "stream": false
}
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 模型名称 |
| messages | array | 是 | 消息列表 |
| temperature | number | 否 | 温度参数（0-2） |
| max_tokens | number | 否 | 最大token数 |
| stream | boolean | 否 | 是否流式输出 |

## 响应格式

### 成功响应

```json
{
  "code": 200,
  "success": true,
  "message": "Success",
  "data": {
    "id": "chatcmpl-123",
    "object": "chat.completion",
    "created": 1677652288,
    "model": "gpt-4",
    "choices": [
      {
        "index": 0,
        "message": {
          "role": "assistant",
          "content": "Hello! I'm doing well, thank you for asking."
        },
        "finish_reason": "stop"
      }
    ],
    "usage": {
      "prompt_tokens": 10,
      "completion_tokens": 20,
      "total_tokens": 30
    }
  }
}
```

## 流式输出

设置 `stream: true` 启用流式输出：

```json
{
  "model": "gpt-4",
  "messages": [...],
  "stream": true
}
```

响应为Server-Sent Events (SSE)格式。

## 代码示例

### JavaScript

```javascript
const response = await fetch('https://api.example.com/v1/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Hello' }
    ]
  })
})

const data = await response.json()
console.log(data.data.choices[0].message.content)
```

### Python

```python
import requests

headers = {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
}

data = {
    'model': 'gpt-4',
    'messages': [
        {'role': 'user', 'content': 'Hello'}
    ]
}

response = requests.post(
    'https://api.example.com/v1/chat',
    headers=headers,
    json=data
)

result = response.json()
print(result['data']['choices'][0]['message']['content'])
```

---

*最后更新: 2026-01-10*
