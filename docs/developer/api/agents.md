# 智能体 API

> 权限点:`agents:read`(列表/详情/任务状态/会话)、`agents:call`(调用/执行/Pipeline/并行/取消)。本模块覆盖 12 个端点,内部转发到 ai-service(LangGraph),支持 PermissionGuard、流式执行、Pipeline 编排、并行执行、任务分解。

## GET /v1/agents

Agent 列表。

**权限点**:`agents:read`

### 请求

```http
GET /v1/agents
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "id": "agent-123",
      "name": "AI 助手",
      "description": "通用 AI 助手",
      "capabilities": ["chat", "tool_use"]
    }
  ]
}
```

### 代码示例

```typescript
const agents = await client.agents.list()
```

## GET /v1/agents/:id

Agent 详情。

**权限点**:`agents:read`

### 请求

```http
GET /v1/agents/agent-123
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "id": "agent-123",
  "name": "AI 助手",
  "description": "通用 AI 助手",
  "capabilities": ["chat", "tool_use"]
}
```

### 代码示例

```typescript
const agent = await client.agents.get('agent-123')
```

## POST /v1/agents/:id/call

调用 Agent,同步返回结果。

**权限点**:`agents:call`

### 请求

```http
POST /v1/agents/agent-123/call
Authorization: Bearer ihui_xxx
Content-Type: application/json
```

```json
{
  "input": "帮我写一首诗",
  "sessionId": "session-abc"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| input | string | 是 | 用户输入 |
| sessionId | string | 否 | 会话 ID,用于多轮对话 |

### 响应(200)

```json
{
  "agentId": "agent-123",
  "sessionId": "session-abc",
  "output": "春风拂面花满枝...",
  "usage": { "totalTokens": 120 }
}
```

### 代码示例

```typescript
const result = await client.agents.call('agent-123', {
  input: '帮我写一首诗',
  sessionId: 'session-abc',
})
```

## POST /v1/agents/execute

Agent 高级执行,支持 PermissionGuard 与迭代控制。

**权限点**:`agents:call`

### 请求

```json
{
  "agentId": "agent-123",
  "input": "分析这段代码并修复 bug",
  "sessionId": "session-abc",
  "permissionMode": "accept-edits",
  "maxIterations": 10
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| agentId | string | 是 | Agent ID |
| input | string | 是 | 输入内容 |
| sessionId | string | 否 | 会话 ID |
| permissionMode | string | 否 | 权限模式:`read-only`/`accept-edits`/`accept-all`/`bypass-permissions`/`plan-only` |
| maxIterations | number | 否 | 最大迭代轮数 |

### 响应(200)

```json
{
  "taskId": "task-456",
  "sessionId": "session-abc",
  "status": "completed",
  "output": "已修复 bug,修改了 3 个文件...",
  "iterations": 5,
  "usage": { "totalTokens": 1500 }
}
```

### 代码示例

```typescript
const result = await client.agents.execute({
  agentId: 'agent-123',
  input: '分析代码并修复 bug',
  permissionMode: 'accept-edits',
  maxIterations: 10,
})
```

## POST /v1/agents/execute/stream

Agent 流式执行,SSE 格式返回增量输出。

**权限点**:`agents:call`

### 请求

同 `POST /v1/agents/execute`。

### 响应

`Content-Type: text/event-stream`,每个事件 `data: {JSON}\n\n`,含 `delta` 增量内容,以 `data: [DONE]` 结束。

### 代码示例

```typescript
const stream = await client.agents.executeStream({
  agentId: 'agent-123',
  input: '逐步分析代码',
})
for await (const event of stream) {
  process.stdout.write(event.delta ?? '')
}
```

## GET /v1/agents/tasks/:id/status

异步任务状态查询。

**权限点**:`agents:read`

### 请求

```http
GET /v1/agents/tasks/task-456/status
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "taskId": "task-456",
  "status": "running",
  "progress": 60,
  "result": null,
  "error": null,
  "createdAt": "2026-07-22T08:00:00Z",
  "updatedAt": "2026-07-22T08:05:00Z"
}
```

`status` 取值:`running` / `completed` / `failed` / `cancelled`。

### 代码示例

```typescript
const status = await client.agents.getTaskStatus('task-456')
```

## POST /v1/agents/tasks/:id/cancel

取消正在运行的任务。

**权限点**:`agents:call`

### 响应(200)

```json
{
  "taskId": "task-456",
  "status": "cancelled"
}
```

### 代码示例

```typescript
await client.agents.cancelTask('task-456')
```

## GET /v1/agents/sessions

Agent 会话列表。

**权限点**:`agents:read`

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "id": "session-abc",
      "agentId": "agent-123",
      "title": "代码分析会话",
      "messageCount": 8,
      "lastMessageAt": "2026-07-22T09:00:00Z",
      "createdAt": "2026-07-22T08:00:00Z"
    }
  ]
}
```

### 代码示例

```typescript
const sessions = await client.agents.listSessions()
```

## DELETE /v1/agents/sessions/:id

删除会话。

**权限点**:`agents:read`

### 响应(204)

无内容。

### 代码示例

```typescript
await client.agents.deleteSession('session-abc')
```

## POST /v1/agents/pipeline

Pipeline 编排,按步骤依赖顺序执行多个 Agent。

**权限点**:`agents:call`

### 请求

```json
{
  "steps": [
    { "agentId": "agent-1", "input": "搜索资料" },
    { "agentId": "agent-2", "input": "整理结果", "dependsOn": [0] },
    { "agentId": "agent-3", "input": "生成报告", "dependsOn": [1] }
  ]
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| steps | array | 是 | 步骤列表 |
| steps[].agentId | string | 是 | Agent ID |
| steps[].input | string | 是 | 输入内容 |
| steps[].dependsOn | number[] | 否 | 依赖的前置步骤索引 |

### 响应(200)

```json
{
  "pipelineId": "pipe-789",
  "results": [
    { "stepIndex": 0, "status": "completed", "output": "找到 5 篇资料..." },
    { "stepIndex": 1, "status": "completed", "output": "整理为 3 个要点..." },
    { "stepIndex": 2, "status": "completed", "output": "报告已生成..." }
  ]
}
```

### 代码示例

```typescript
const result = await client.agents.pipeline({
  steps: [
    { agentId: 'agent-1', input: '搜索资料' },
    { agentId: 'agent-2', input: '整理结果', dependsOn: [0] },
  ],
})
```

## POST /v1/agents/parallel

并行执行多个 Agent 任务。

**权限点**:`agents:call`

### 请求

```json
{
  "tasks": [
    { "agentId": "agent-1", "input": "翻译成英文" },
    { "agentId": "agent-2", "input": "翻译成日文" },
    { "agentId": "agent-3", "input": "翻译成韩文" }
  ]
}
```

### 响应(200)

```json
{
  "batchId": "batch-012",
  "results": [
    { "index": 0, "status": "completed", "output": "Hello..." },
    { "index": 1, "status": "completed", "output": "こんにちは..." },
    { "index": 2, "status": "completed", "output": "안녕하세요..." }
  ]
}
```

### 代码示例

```typescript
const result = await client.agents.parallel({
  tasks: [
    { agentId: 'agent-1', input: '翻译成英文' },
    { agentId: 'agent-2', input: '翻译成日文' },
  ],
})
```

## POST /v1/agents/decompose

任务分解,将复杂任务拆分为子任务。

**权限点**:`agents:call`

### 请求

```json
{
  "input": "搭建一个电商网站"
}
```

### 响应(200)

返回分解后的子任务列表(具体结构由 ai-service 决定)。

### 代码示例

```typescript
const result = await client.agents.decompose({
  input: '搭建一个电商网站',
})
```

## 错误码

| 状态码 | 场景 |
|--------|------|
| 400 | agentId 为空 / input 为空 |
| 401 | API Key 无效 |
| 403 | 缺少 `agents:read` / `agents:call` 权限 |
| 404 | Agent / 任务 / 会话不存在 |
| 429 | 配额超限 |
| 502 | 上游 ai-service(LangGraph)错误 |
| 503 | ai-service 不可用 |

---

*最后更新: 2026-07-22*
