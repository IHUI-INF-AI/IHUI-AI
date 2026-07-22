# 模型 API

> 权限点:`models:read`(查询)、`models:write`(创建/更新/删除用户模型 + MoA 预设)。本模块覆盖 8 个端点,用于查询可用模型、厂商模型、MoA 预设,以及管理用户自定义模型配置。

## GET /v1/models

模型列表,OpenAI 兼容格式。

**权限点**:`models:read`

### 请求

```http
GET /v1/models
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4",
      "object": "model",
      "created": 1677610602,
      "ownedBy": "openai"
    },
    {
      "id": "gpt-4-vision-preview",
      "object": "model",
      "created": 1677610602,
      "ownedBy": "openai"
    }
  ]
}
```

> camelCase:`ownedBy`(非 `owned_by`)。

### 代码示例

```typescript
const models = await client.ai.listModels()
console.log(models.data.map(m => m.id))
```

```python
models = client.ai.list_models()
print([m["id"] for m in models["data"]])
```

## GET /v1/models/:id

模型详情,含能力标签与上下文窗口。

**权限点**:`models:read`

### 请求

```http
GET /v1/models/gpt-4
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "id": "gpt-4",
  "object": "model",
  "created": 1677610602,
  "ownedBy": "openai",
  "capabilities": ["chat", "function-calling", "vision"],
  "contextWindow": 8192,
  "supportsStream": true
}
```

### 代码示例

```typescript
const model = await client.ai.getModel('gpt-4')
console.log(model.contextWindow)
```

## GET /v1/vendors/:vendor/models

指定厂商的模型列表。

**权限点**:`models:read`

### 请求

```http
GET /v1/vendors/openai/models
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "vendor": "openai",
  "object": "list",
  "data": [
    { "id": "gpt-4", "object": "model" },
    { "id": "gpt-4-vision-preview", "object": "model" }
  ]
}
```

### 代码示例

```typescript
const vendorModels = await client.ai.listVendorModels('openai')
```

## GET /v1/moa-presets

MoA(Mixture of Agents)预设列表。

**权限点**:`models:read`

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "id": "preset-abc",
      "name": "三模型聚合",
      "models": ["gpt-4", "claude-3-opus", "gemini-pro"],
      "strategy": "vote"
    }
  ]
}
```

### 代码示例

```typescript
const presets = await client.ai.listMoaPresets()
```

## POST /v1/moa-presets

创建 MoA 预设。

**权限点**:`models:write`

### 请求

```json
{
  "name": "三模型聚合",
  "models": ["gpt-4", "claude-3-opus", "gemini-pro"],
  "strategy": "vote"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 预设名称 |
| models | string[] | 是 | 参与聚合的模型 ID 列表 |
| strategy | string | 是 | 聚合策略,如 `vote` / `cascade` / `parallel` |

### 响应(201)

```json
{
  "id": "preset-abc",
  "name": "三模型聚合",
  "models": ["gpt-4", "claude-3-opus", "gemini-pro"],
  "strategy": "vote"
}
```

### 代码示例

```typescript
const preset = await client.ai.createMoaPreset({
  name: '三模型聚合',
  models: ['gpt-4', 'claude-3-opus', 'gemini-pro'],
  strategy: 'vote',
})
```

## GET /v1/user/models

用户自定义模型配置列表。

**权限点**:`models:read`

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "id": "um-123",
      "name": "我的 GPT-4",
      "provider": "openai",
      "model": "gpt-4",
      "apiKey": "sk-***",
      "baseUrl": "https://api.openai.com/v1",
      "createdAt": "2026-07-22T08:00:00Z",
      "updatedAt": "2026-07-22T08:00:00Z"
    }
  ]
}
```

## POST /v1/user/models

创建用户自定义模型配置(绑定自己的 API Key 与 baseUrl)。

**权限点**:`models:write`

### 请求

```json
{
  "name": "我的 GPT-4",
  "provider": "openai",
  "model": "gpt-4",
  "apiKey": "sk-xxx",
  "baseUrl": "https://api.openai.com/v1"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 配置名称 |
| provider | string | 是 | 厂商标识 |
| model | string | 是 | 模型 ID |
| apiKey | string | 是 | 用户自己的厂商 API Key |
| baseUrl | string | 否 | 厂商 API 地址 |

### 响应(201)

返回完整的 `V1UserModelConfig` 对象(同 GET 响应单项)。

### 代码示例

```typescript
const userModel = await client.ai.createUserModel({
  name: '我的 GPT-4',
  provider: 'openai',
  model: 'gpt-4',
  apiKey: 'sk-xxx',
  baseUrl: 'https://api.openai.com/v1',
})
```

## PUT /v1/user/models/:id

更新用户模型配置。

**权限点**:`models:write`

### 请求

```json
{
  "name": "我的 GPT-4(更新)",
  "apiKey": "sk-new"
}
```

字段均可选,仅传需更新的字段。响应(200)返回更新后的完整对象。

### 代码示例

```typescript
const updated = await client.ai.updateUserModel('um-123', {
  name: '我的 GPT-4(更新)',
})
```

## DELETE /v1/user/models/:id

删除用户模型配置。

**权限点**:`models:write`

### 响应(204)

无内容。

### 代码示例

```typescript
await client.ai.deleteUserModel('um-123')
```

## 错误码

| 状态码 | 场景 |
|--------|------|
| 400 | 请求参数错误(如 model 为空) |
| 401 | API Key 无效 |
| 403 | 缺少 `models:read` / `models:write` 权限 |
| 404 | 模型/预设/用户模型不存在 |
| 429 | 配额超限 |

---

*最后更新: 2026-07-22*
