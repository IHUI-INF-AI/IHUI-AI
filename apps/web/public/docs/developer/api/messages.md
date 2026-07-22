# 消息 API

> 权限点:`messages:write`(发布/订阅/取消订阅)、`messages:read`(状态查询)。本模块覆盖 4 个端点,支持频道消息发布与 Webhook 订阅。

## POST /v1/messages

发布消息到频道。

**权限点**:`messages:write`

### 请求

```json
{
  "channel": "notifications",
  "content": "新版本已发布",
  "recipients": ["user-1", "user-2"],
  "metadata": { "priority": "high" }
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| channel | string | 是 | 频道名称 |
| content | string | 是 | 消息内容 |
| recipients | string[] | 否 | 目标接收者 ID 列表。不传则广播给所有订阅者 |
| metadata | object | 否 | 元数据 |

### 响应(201)

```json
{
  "messageId": "msg-123",
  "status": "published",
  "subscriberCount": 42
}
```

### 代码示例

```typescript
const result = await client.messages.publish({
  channel: 'notifications',
  content: '新版本已发布',
})
```

```bash
curl -X POST http://localhost:3001/v1/messages \
  -H "Authorization: Bearer ihui_xxx" \
  -H "Content-Type: application/json" \
  -d '{"channel":"notifications","content":"新版本已发布"}'
```

## POST /v1/messages/subscribe

订阅频道,通过 Webhook 接收消息。

**权限点**:`messages:write`

### 请求

```json
{
  "channel": "notifications",
  "callbackUrl": "https://your-app.com/webhook/messages"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| channel | string | 是 | 频道名称 |
| callbackUrl | string | 是 | Webhook 回调 URL,平台向此 URL POST 消息 |

### 响应(201)

```json
{
  "subscriptionId": "sub-456",
  "status": "subscribed"
}
```

> 平台向 `callbackUrl` 发送 POST 请求,请求体为消息 JSON。你的服务需返回 200 确认接收。

### 代码示例

```typescript
const sub = await client.messages.subscribe({
  channel: 'notifications',
  callbackUrl: 'https://your-app.com/webhook/messages',
})
```

## DELETE /v1/messages/subscribe/:id

取消订阅。

**权限点**:`messages:write`

### 请求

```http
DELETE /v1/messages/subscribe/sub-456
Authorization: Bearer ihui_xxx
```

### 响应(204)

无内容。

### 代码示例

```typescript
await client.messages.unsubscribe('sub-456')
```

## GET /v1/messages/:id/status

查询消息投递状态。

**权限点**:`messages:read`

### 请求

```http
GET /v1/messages/msg-123/status
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "messageId": "msg-123",
  "status": "delivered",
  "deliveredCount": 40,
  "failedCount": 2
}
```

`status` 取值:`pending`(投递中)/ `delivered`(已投递)/ `failed`(投递失败)。

### 代码示例

```typescript
const status = await client.messages.getStatus('msg-123')
console.log(status.deliveredCount, '已投递')
```

## Webhook 回调格式

订阅后,平台向你的 `callbackUrl` 发送 POST 请求:

```http
POST https://your-app.com/webhook/messages
Content-Type: application/json
X-Ihui-Signature: sha256=xxx
```

```json
{
  "messageId": "msg-123",
  "channel": "notifications",
  "content": "新版本已发布",
  "metadata": { "priority": "high" },
  "publishedAt": "2026-07-22T08:00:00Z"
}
```

> `X-Ihui-Signature` 为 HMAC-SHA256 签名(以 Secret 为密钥),用于验证回调来源。你的服务应校验签名后处理消息,返回 200。

## 错误码

| 状态码 | 场景 |
|--------|------|
| 400 | channel 为空 / content 为空 / callbackUrl 无效 |
| 401 | API Key 无效 |
| 403 | 缺少 `messages:read` / `messages:write` 权限 |
| 404 | 消息/订阅不存在 |
| 429 | 配额超限 |

---

*最后更新: 2026-07-22*
