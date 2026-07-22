# 对话 API

> 权限点:`chat:write`(补全/视觉/MOA)、`chat:read`(会话)。本模块覆盖 4 个端点,内部转发到 ai-service(LiteLLM),OpenAI 兼容响应格式,camelCase 字段命名。

## POST /v1/chat/completions

Chat 补全,OpenAI 兼容格式,支持流式。

**权限点**:`chat:write`

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
    { "role": "system", "content": "你是助手" },
    { "role": "user", "content": "你好" }
  ],
  "temperature": 0.7,
  "maxTokens": 1000,
  "stream": false
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 模型 ID,见 `GET /v1/models` |
| messages | array | 是 | 消息列表,每项含 `role`(`system`/`user`/`assistant`)和 `content` |
| temperature | number | 否 | 采样温度,0-2,默认 1 |
| maxTokens | number | 否 | 最大生成 token 数 |
| stream | boolean | 否 | 是否流式返回,默认 false |

> camelCase:`maxTokens`(非 `max_tokens`)。

### 响应(200)

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "你好!有什么可以帮你的吗?" },
      "finishReason": "stop"
    }
  ],
  "usage": { "promptTokens": 10, "completionTokens": 12, "totalTokens": 22 }
}
```

> camelCase:`finishReason`、`promptTokens`、`completionTokens`、`totalTokens`。

### 流式响应(stream=true)

`Content-Type: text/event-stream`,每行 `data: {JSON}\n\n`,以 `data: [DONE]` 结束:

```
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant"},"finishReason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"你"},"finishReason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"好"},"finishReason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{},"finishReason":"stop"}]}

data: [DONE]
```

### 错误码

| 状态码 | 场景 |
|--------|------|
| 400 | model 为空 / messages 为空 |
| 401 | API Key 无效 |
| 403 | 缺少 `chat:write` 权限 |
| 429 | 配额超限 |
| 502 | 上游 LiteLLM 错误 |
| 503 | ai-service 不可用 |

### 代码示例

**TypeScript(@ihui/sdk)**

```typescript
// 非流式
const response = await client.ai.completions({
  model: 'gpt-4',
  messages: [{ role: 'user', content: '你好' }],
})

// 流式
const stream = await client.ai.completionsStream({
  model: 'gpt-4',
  messages: [{ role: 'user', content: '讲个笑话' }],
  stream: true,
})
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '')
}
```

**Python(ihui-ai)**

```python
# 非流式
response = client.ai.completions(
    model="gpt-4",
    messages=[{"role": "user", "content": "你好"}],
)

# 流式
stream = client.ai.completions_stream(
    model="gpt-4",
    messages=[{"role": "user", "content": "讲个笑话"}],
    stream=True,
)
for chunk in stream:
    print(chunk["choices"][0].get("delta", {}).get("content", ""), end="", flush=True)
```

**cURL**

```bash
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer ihui_xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"你好"}]}'
```

## POST /v1/chat/vision

视觉理解,输入图片(base64 或 URL)+ prompt,返回图片描述。

**权限点**:`chat:write`

### 请求

```json
{
  "model": "gpt-4-vision-preview",
  "image": "data:image/png;base64,iVBORw0KG...",
  "prompt": "描述这张图片的内容",
  "maxTokens": 500
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 支持视觉的模型 ID |
| image | string | 是 | base64 编码(含 data URI 前缀)或图片 URL |
| prompt | string | 是 | 提问内容 |
| maxTokens | number | 否 | 最大生成 token 数 |

### 响应(200)

```json
{
  "description": "图中是一只橘色的猫,坐在窗台上晒太阳。",
  "model": "gpt-4-vision-preview",
  "usage": { "promptTokens": 150, "completionTokens": 30, "totalTokens": 180 }
}
```

### 代码示例

```typescript
const result = await client.ai.chatVision({
  model: 'gpt-4-vision-preview',
  image: 'https://example.com/cat.jpg',
  prompt: '描述这张图片',
})
console.log(result.description)
```

```python
result = client.ai.chat_vision(
    model="gpt-4-vision-preview",
    image="https://example.com/cat.jpg",
    prompt="描述这张图片",
)
print(result["description"])
```

## POST /v1/chat/moa

Mixture of Agents,多模型聚合,可选使用预设。

**权限点**:`chat:write`

### 请求

```json
{
  "messages": [{ "role": "user", "content": "解释量子计算" }],
  "presetId": "preset-abc",
  "stream": false
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| messages | array | 是 | 消息列表 |
| presetId | string | 否 | MoA 预设 ID,见 `GET /v1/moa-presets`。不传使用默认预设 |
| stream | boolean | 否 | 是否流式,默认 false |

### 响应(200)

```json
{
  "output": "量子计算利用量子叠加和纠缠原理...",
  "presetId": "preset-abc",
  "model": "moa-composite",
  "usage": { "totalTokens": 350 }
}
```

### 代码示例

```typescript
const result = await client.ai.chatMoa({
  messages: [{ role: 'user', content: '解释量子计算' }],
  presetId: 'preset-abc',
})
```

## GET /v1/chat/sessions

Chat 会话列表。

**权限点**:`chat:read`

### 请求

```http
GET /v1/chat/sessions
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "id": "session-123",
      "title": "量子计算讨论",
      "messageCount": 8,
      "lastMessageAt": "2026-07-22T10:00:00Z",
      "createdAt": "2026-07-22T09:00:00Z"
    }
  ]
}
```

### 代码示例

```typescript
const sessions = await client.ai.listSessions?.()
// 或直接 HTTP
const res = await fetch('http://localhost:3001/v1/chat/sessions', {
  headers: { Authorization: 'Bearer ihui_xxx' },
})
```

---

*最后更新: 2026-07-22*
