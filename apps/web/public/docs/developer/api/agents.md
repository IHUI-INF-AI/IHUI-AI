# 智能体 API

> 所需权限：`agents:read`（列表/详情）、`agents:call`（调用）

## 获取智能体列表

### 端点

```
GET /v1/agents
```

**实现状态**：已实现

### 请求

```http
GET /v1/agents
Authorization: Bearer ihui_xxx
```

### 响应

```json
{
  "object": "list",
  "data": [
    {
      "id": "agent-123",
      "name": "AI助手",
      "description": "智能AI助手",
      "capabilities": ["chat", "tool_use"]
    }
  ]
}
```

## 获取智能体详情

### 端点

```
GET /v1/agents/:id
```

**实现状态**：已实现

### 请求

```http
GET /v1/agents/agent-123
Authorization: Bearer ihui_xxx
```

### 响应

```json
{
  "id": "agent-123",
  "name": "AI助手",
  "description": "智能AI助手",
  "capabilities": ["chat", "tool_use"]
}
```

## 调用智能体

### 端点

```
POST /v1/agents/:id/call
```

**实现状态**：转发到 ai-service（LangGraph）

### 请求

```http
POST /v1/agents/agent-123/call
Authorization: Bearer ihui_xxx
Content-Type: application/json
```

```json
{
  "input": "用户输入",
  "sessionId": "session-abc"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| input | string | 是 | 用户输入内容 |
| sessionId | string | 否 | 会话 ID，用于多轮对话 |

### 响应

```json
{
  "agentId": "agent-123",
  "sessionId": "session-abc",
  "output": "智能体输出内容",
  "usage": {
    "totalTokens": 100
  }
}
```

## 代码示例

### JavaScript

```javascript
// 获取智能体列表
const agentsResponse = await fetch('https://api.example.com/v1/agents', {
  headers: {
    'Authorization': 'Bearer ihui_xxx'
  }
})

const agentsData = await agentsResponse.json()
console.log(agentsData.data)

// 调用智能体
const callResponse = await fetch('https://api.example.com/v1/agents/agent-123/call', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ihui_xxx',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    input: 'Hello',
    sessionId: 'session-abc'
  })
})

const callData = await callResponse.json()
console.log(callData.output)
```

---

*最后更新: 2026-07-22*
