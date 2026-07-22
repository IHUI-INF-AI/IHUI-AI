# 用户、工作区、工作流、统计 API

> 权限点:`user:read`、`workspace:read`、`workflows:read`、`workflows:write`、`stats:read`。本模块覆盖 9 个端点,包括当前用户信息、项目文件、工作流执行(Coze/n8n)、用量统计。

## GET /v1/me

当前用户信息 + API Key 配额。

**权限点**:`user:read`

### 响应(200)

```json
{
  "id": "user-123",
  "username": "zhangsan",
  "email": "zhangsan@example.com",
  "avatar": "https://example.com/avatar.jpg",
  "createdAt": "2026-01-01T00:00:00Z",
  "quota": {
    "hourlyUsed": 120,
    "hourlyLimit": 3600,
    "dailyUsed": 1200,
    "dailyLimit": 86400,
    "resetAt": "2026-07-22T09:00:00Z"
  }
}
```

### 代码示例

```typescript
const me = await client.user.me()
console.log(me.quota.dailyUsed, '/', me.quota.dailyLimit)
```

## GET /v1/projects

工作区项目列表。

**权限点**:`workspace:read`

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "id": "proj-1",
      "name": "我的项目",
      "description": "项目描述",
      "fileCount": 15,
      "createdAt": "2026-07-22T08:00:00Z",
      "updatedAt": "2026-07-22T09:00:00Z"
    }
  ]
}
```

### 代码示例

```typescript
const projects = await client.user.listProjects()
```

## GET /v1/projects/:id/files

项目文件列表。

**权限点**:`workspace:read`

### 请求

```http
GET /v1/projects/proj-1/files
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "id": "file-1",
      "object": "file",
      "filename": "main.ts",
      "bytes": 2048,
      "mimeType": "text/typescript",
      "createdAt": "2026-07-22T08:00:00Z",
      "updatedAt": "2026-07-22T08:30:00Z"
    }
  ]
}
```

### 代码示例

```typescript
const files = await client.user.listProjectFiles('proj-1')
```

## GET /v1/workflows/:id

工作流详情。

**权限点**:`workflows:read`

### 请求

```http
GET /v1/workflows/wf-1
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "id": "wf-1",
  "name": "数据处理流程",
  "description": "清洗并分析数据",
  "steps": [
    {
      "id": "step-1",
      "name": "数据清洗",
      "type": "transform",
      "config": { "removeNulls": true }
    },
    {
      "id": "step-2",
      "name": "数据分析",
      "type": "analyze",
      "config": { "method": "statistical" }
    }
  ],
  "createdAt": "2026-07-22T08:00:00Z"
}
```

### 代码示例

```typescript
const workflow = await client.user.getWorkflow('wf-1')
```

## POST /v1/workflows/instances

运行工作流实例。

**权限点**:`workflows:write`

### 请求

```json
{
  "workflowId": "wf-1",
  "inputs": {
    "dataSource": "file-123",
    "format": "json"
  }
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| workflowId | string | 是 | 工作流 ID |
| inputs | object | 否 | 输入参数,结构由工作流定义决定 |

### 响应(200)

```json
{
  "instanceId": "inst-456",
  "status": "completed",
  "outputs": {
    "result": "分析完成",
    "rows": 1000
  }
}
```

`status` 取值:`running` / `completed` / `failed`。

### 代码示例

```typescript
const result = await client.user.runWorkflow({
  workflowId: 'wf-1',
  inputs: { dataSource: 'file-123' },
})
```

## POST /v1/workflows/coze/run

运行 Coze 工作流。

**权限点**:`workflows:write`

### 请求

```json
{
  "workflowId": "coze-wf-1",
  "parameters": {
    "input": "待处理文本",
    "mode": "summary"
  }
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| workflowId | string | 是 | Coze 工作流 ID |
| parameters | object | 是 | 工作流参数,结构由 Coze 工作流定义 |

### 响应(200)

返回 Coze 工作流执行结果(结构由 Coze 决定)。

### 代码示例

```typescript
const result = await client.user.runCozeWorkflow({
  workflowId: 'coze-wf-1',
  parameters: { input: '待处理文本', mode: 'summary' },
})
```

## POST /v1/workflows/n8n/run

运行 n8n 工作流。

**权限点**:`workflows:write`

### 请求

```json
{
  "workflowId": "n8n-wf-1",
  "data": {
    "trigger": "manual",
    "payload": { "text": "hello" }
  }
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| workflowId | string | 是 | n8n 工作流 ID |
| data | object | 否 | 触发数据 |

### 响应(200)

返回 n8n 工作流执行结果(结构由 n8n 决定)。

### 代码示例

```typescript
const result = await client.user.runN8nWorkflow({
  workflowId: 'n8n-wf-1',
  data: { trigger: 'manual', payload: { text: 'hello' } },
})
```

## GET /v1/usage

用量统计(当前 API Key)。

**权限点**:`stats:read`

### 请求

```http
GET /v1/usage
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "apiKeyId": "ak-123",
  "period": "2026-07",
  "totalRequests": 15234,
  "byCategory": {
    "chat": 8000,
    "embeddings": 2000,
    "agents": 3000,
    "images": 2234
  },
  "byModel": {
    "gpt-4": 5000,
    "text-embedding-3-small": 2000,
    "claude-3-opus": 3000
  },
  "tokensUsed": 1250000
}
```

### 代码示例

```typescript
const usage = await client.user.getUsage()
console.log('总请求数:', usage.totalRequests)
console.log('Token 用量:', usage.tokensUsed)
```

## GET /v1/usage/:vendor

按厂商查询用量。

**权限点**:`stats:read`

### 请求

```http
GET /v1/usage/openai
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "vendor": "openai",
  "requests": 5000,
  "tokens": 800000,
  "cost": 12.5
}
```

### 代码示例

```typescript
const vendorUsage = await client.user.getVendorUsage('openai')
console.log('OpenAI 花费:$', vendorUsage.cost)
```

## 错误码

| 状态码 | 场景 |
|--------|------|
| 400 | workflowId 为空 / parameters 为空 |
| 401 | API Key 无效 |
| 403 | 缺少 `user:read` / `workspace:read` / `workflows:read` / `workflows:write` / `stats:read` 权限 |
| 404 | 项目/工作流不存在 |
| 429 | 配额超限 |
| 502 | 上游 Coze/n8n 服务错误 |

---

*最后更新: 2026-07-22*
