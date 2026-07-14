# 智能体API

## 获取智能体列表

### 端点

```
GET /v1/agents
```

### 请求参数

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码（默认1） |
| page_size | number | 每页数量（默认10） |
| category_id | number | 分类ID |
| keyword | string | 搜索关键词 |

### 响应

```json
{
  "code": 200,
  "success": true,
  "data": {
    "list": [
      {
        "id": "agent-123",
        "name": "AI助手",
        "description": "智能AI助手",
        "category": "assistant",
        "price": 0,
        "rating": 4.5
      }
    ],
    "total": 100,
    "page": 1,
    "page_size": 10
  }
}
```

## 获取智能体详情

### 端点

```
GET /v1/agents/:id
```

### 响应

```json
{
  "code": 200,
  "success": true,
  "data": {
    "id": "agent-123",
    "name": "AI助手",
    "description": "智能AI助手",
    "category": "assistant",
    "price": 0,
    "rating": 4.5,
    "usage_count": 1000,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

## 调用智能体

### 端点

```
POST /v1/agents/:id/call
```

### 请求

```json
{
  "input": "用户输入",
  "context": {
    "user_id": "user-123"
  }
}
```

### 响应

```json
{
  "code": 200,
  "success": true,
  "data": {
    "output": "智能体输出",
    "usage": {
      "tokens": 100
    }
  }
}
```

## 代码示例

### JavaScript

```javascript
// 获取智能体列表
const agentsResponse = await fetch('https://api.example.com/v1/agents?page=1&page_size=10', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
})

const agentsData = await agentsResponse.json()
console.log(agentsData.data.list)

// 调用智能体
const callResponse = await fetch('https://api.example.com/v1/agents/agent-123/call', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    input: 'Hello',
    context: {
      user_id: 'user-123'
    }
  })
})

const callData = await callResponse.json()
console.log(callData.data.output)
```

---

*最后更新: 2026-01-10*
