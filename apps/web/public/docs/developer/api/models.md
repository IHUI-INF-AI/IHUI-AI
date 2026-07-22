# 模型 API

> 所需权限：`models:read`

## 获取模型列表

### 端点

```
GET /v1/models
```

**实现状态**：已实现（从平台模型配置读取）

### 请求

```http
GET /v1/models
Authorization: Bearer ihui_xxx
```

### 响应

```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4",
      "object": "model",
      "created": 1687882411,
      "ownedBy": "openai"
    },
    {
      "id": "claude-3-5-sonnet",
      "object": "model",
      "created": 1687882411,
      "ownedBy": "anthropic"
    }
  ]
}
```

> **字段命名**：`ownedBy`（非 `owned_by`），与 `@ihui/types` 契约一致。

## 支持的模型

模型列表随平台配置动态更新，可通过 `GET /v1/models` 获取当前可用模型。常见模型包括：

- OpenAI 系列（gpt-4、gpt-4-turbo、gpt-3.5-turbo）
- Anthropic 系列（claude-3-5-sonnet、claude-3-opus）
- Google 系列（gemini-pro、gemini-ultra）

## 代码示例

### JavaScript

```javascript
const response = await fetch('https://api.example.com/v1/models', {
  headers: {
    'Authorization': 'Bearer ihui_xxx'
  }
})

const data = await response.json()
console.log(data.data)
```

### Python

```python
import requests

headers = {
    'Authorization': 'Bearer ihui_xxx'
}

response = requests.get(
    'https://api.example.com/v1/models',
    headers=headers
)

result = response.json()
for model in result['data']:
    print(model['id'], model['ownedBy'])
```

---

*最后更新: 2026-07-22*
