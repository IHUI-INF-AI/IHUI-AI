# 对话 API

> 所需权限：`chat:write`

## 发起对话补全

### 端点

```
POST /v1/chat/completions
```

**实现状态**：转发到 ai-service（LiteLLM），OpenAI 兼容格式

### 请求

```http
POST /v1/chat/completions
Authorization: Bearer ihui_xxx
Content-Type: application/json
```

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
  "maxTokens": 1000,
  "stream": false
}
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 模型名称 |
| messages | array | 是 | 消息列表，每项含 `role` 和 `content` |
| temperature | number | 否 | 温度参数（0-2） |
| maxTokens | number | 否 | 最大生成 token 数 |
| stream | boolean | 否 | 是否流式输出，默认 false |

> **注意**：字段使用 camelCase（`maxTokens`），非 OpenAI 的 snake_case（`max_tokens`）。

### 响应

```json
{
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
      "finishReason": "stop"
    }
  ],
  "usage": {
    "promptTokens": 10,
    "completionTokens": 20,
    "totalTokens": 30
  }
}
```

> **字段命名**：`finishReason`（非 `finish_reason`）、`promptTokens`（非 `prompt_tokens`）、`completionTokens`（非 `completion_tokens`）、`totalTokens`（非 `total_tokens`）。

## 流式输出

设置 `stream: true` 启用流式输出：

```json
{
  "model": "gpt-4",
  "messages": [...],
  "stream": true
}
```

响应为 Server-Sent Events (SSE) 格式，每个 chunk 的 `choices[].delta` 包含增量内容。

## 代码示例

### JavaScript

```javascript
const response = await fetch('https://api.example.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ihui_xxx',
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
console.log(data.choices[0].message.content)
```

### Python

```python
import requests

headers = {
    'Authorization': 'Bearer ihui_xxx',
    'Content-Type': 'application/json'
}

data = {
    'model': 'gpt-4',
    'messages': [
        {'role': 'user', 'content': 'Hello'}
    ]
}

response = requests.post(
    'https://api.example.com/v1/chat/completions',
    headers=headers,
    json=data
)

result = response.json()
print(result['choices'][0]['message']['content'])
```

---

*最后更新: 2026-07-22*
