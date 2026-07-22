# 记忆 API

> 权限点:`memory:read`(召回/搜索/分类记忆)、`memory:write`(保存/遗忘/Dream)。本模块覆盖 8 个端点,支持工作记忆、情景记忆、程序记忆三类,以及 Dream 梦境系统。

## POST /v1/memory

保存记忆。

**权限点**:`memory:write`

### 请求

```json
{
  "content": "用户偏好中文回复",
  "type": "working",
  "metadata": { "source": "chat", "priority": "high" }
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | string | 是 | 记忆内容 |
| type | string | 否 | 类型:`working` / `episodic` / `procedural` / `semantic`,默认 working |
| metadata | object | 否 | 元数据 |

### 响应(201)

```json
{
  "id": "mem-123",
  "status": "saved"
}
```

### 代码示例

```typescript
const result = await client.memory.save({
  content: '用户偏好中文回复',
  type: 'working',
})
```

## GET /v1/memory

召回记忆(默认返回最近的记忆)。

**权限点**:`memory:read`

### 请求

```http
GET /v1/memory
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "id": "mem-123",
      "content": "用户偏好中文回复",
      "type": "working",
      "score": 1.0,
      "createdAt": "2026-07-22T08:00:00Z",
      "metadata": { "source": "chat" }
    }
  ]
}
```

### 代码示例

```typescript
const memories = await client.memory.recall()
```

## POST /v1/memory/search

语义搜索记忆。

**权限点**:`memory:read`

### 请求

```json
{
  "query": "用户语言偏好",
  "topK": 5,
  "type": "working"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | 是 | 搜索查询 |
| topK | number | 否 | 返回数量,默认 5 |
| type | string | 否 | 限定类型 |

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "id": "mem-123",
      "content": "用户偏好中文回复",
      "type": "working",
      "score": 0.95,
      "createdAt": "2026-07-22T08:00:00Z"
    }
  ]
}
```

### 代码示例

```typescript
const results = await client.memory.search({
  query: '用户语言偏好',
  topK: 5,
})
```

## POST /v1/memory/dream

Dream 梦境系统,对记忆进行整理/创造/分析。

**权限点**:`memory:write`

### 请求

```json
{
  "mode": "consolidate"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| mode | string | 否 | `consolidate`(整理)/ `create`(创造)/ `analyze`(分析),默认 consolidate |

### 响应(200)

```json
{
  "dreamId": "dream-456",
  "insights": [
    "用户经常在下午活跃",
    "用户偏好简洁的技术回答"
  ],
  "newMemories": 3
}
```

> `newMemories` 为 Dream 过程中新生成的记忆数量。

### 代码示例

```typescript
const dream = await client.memory.dream({ mode: 'consolidate' })
console.log(dream.insights)
```

## DELETE /v1/memory

遗忘记忆(按 ID 或条件批量删除)。

**权限点**:`memory:write`

### 请求

```http
DELETE /v1/memory
Authorization: Bearer ihui_xxx
Content-Type: application/json
```

```json
{
  "id": "mem-123"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 否 | 指定记忆 ID。不传则按其他条件批量删除 |

### 响应(204)

无内容。

### 代码示例

```typescript
await client.memory.forget({ id: 'mem-123' })
```

## GET /v1/memory/working

工作记忆(短期,当前任务相关)。

**权限点**:`memory:read`

### 响应(200)

```json
{
  "items": [
    {
      "id": "mem-1",
      "content": "正在处理订单 #12345",
      "createdAt": "2026-07-22T08:00:00Z"
    }
  ]
}
```

### 代码示例

```typescript
const working = await client.memory.working()
```

## GET /v1/memory/episodic

情景记忆(事件经历)。

**权限点**:`memory:read`

### 响应(200)

```json
{
  "episodes": [
    {
      "id": "epi-1",
      "summary": "用户完成了首次 API 集成",
      "timestamp": "2026-07-22T08:00:00Z",
      "participants": ["user-123", "agent-1"]
    }
  ]
}
```

### 代码示例

```typescript
const episodic = await client.memory.episodic()
```

## GET /v1/memory/procedural

程序记忆(操作流程/技能)。

**权限点**:`memory:read`

### 响应(200)

```json
{
  "procedures": [
    {
      "id": "proc-1",
      "name": "创建 API Key",
      "steps": ["登录后台", "进入设置", "点击创建密钥", "选择权限"],
      "successRate": 0.95
    }
  ]
}
```

### 代码示例

```typescript
const procedural = await client.memory.procedural()
```

## 错误码

| 状态码 | 场景 |
|--------|------|
| 400 | content 为空 / query 为空 |
| 401 | API Key 无效 |
| 403 | 缺少 `memory:read` / `memory:write` 权限 |
| 404 | 记忆不存在 |
| 429 | 配额超限 |
| 502 | 上游向量数据库错误 |

---

*最后更新: 2026-07-22*
