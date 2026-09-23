<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 消息 API

> 权限点:`messages:write`(发布/订阅/取消订阅)、`messages:read`(状态查询)。本模块覆盖 4 个端点。消息按**投递通道**发布(`im` / `websocket` / `webhook` / `sms` 四选一),并支持为通道注册 Webhook 订阅回调。

## POST /v1/messages

消息经指定投递通道发出。

**权限点**:`messages:write`

### 请求

```json
{
  "channel": "webhook",
  "content": "新版本已发布",
  "recipients": ["user-1", "user-2"],
  "metadata": { "priority": "high" }
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| channel | enum | 是 | 投递通道,取值 `im` / `websocket` / `webhook` / `sms`(见下方"channel 语义") |
| content | string | 是 | 消息内容 |
| recipients | string[] | 否 | 预留字段:当前**不会**传给 ai-service,对投递无任何影响(通道寻址由服务端按 channel 决定) |
| metadata | object | 否 | 元数据;webhook 通道可用 `webhook_url` / `webhook_urls` 直接指定回调地址(见下文) |

> **channel 语义(重要)**:`channel` 是"投递面"——消息要经由哪条**传输通道**发出去——而**不是**自定义的订阅频道/话题名。同一时刻多条业务消息只要走同一通道就传同一个 channel 值,想要"按业务区分"请放 `metadata`。
> 取值域唯一真相源是 `apps/ai-service/app/services/message_bus.py` 的 `ChannelType` 枚举;api 侧同值抄写为 `MESSAGE_BUS_CHANNELS`(`apps/api/src/routes/v1-knowledge-tools.ts`),并由跨语言对账测试 `apps/api/tests/v1-message-bus-contract.test.ts` 钉死。**改那边必须同步改 api 侧的 `MESSAGE_BUS_CHANNELS` 与本文档**,否则对账测试即红。缺失或值域外的 channel 在 api 网关本地即 400,不透传给 ai-service。

### 响应(200)

```json
{
  "messageId": "msg-123",
  "status": "published",
  "subscriberCount": 0
}
```

- `status: "published"` 表示请求**已受理**;真实投递结果(哪些通道成功/失败)须用 `GET /v1/messages/:id/status` 查询——即使所有通道投递失败,本端点仍返回 200 published。
- `subscriberCount` 为 v1 契约预留字段,当前实现恒为 `0`(ai-service 发布结果没有订阅者计数来源)。

### 代码示例

```typescript
const result = await client.messages.publish({
  channel: 'webhook',
  content: '新版本已发布',
})
```

```bash
curl -X POST http://localhost:8802/v1/messages \
  -H "Authorization: Bearer ihui_xxx" \
  -H "Content-Type: application/json" \
  -d '{"channel":"webhook","content":"新版本已发布"}'
```

## POST /v1/messages/subscribe

为投递通道登记 Webhook 回调地址。

**权限点**:`messages:write`

### 请求

```json
{
  "channel": "webhook",
  "callbackUrl": "https://your-app.com/webhook/messages"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| channel | enum | 是 | 订阅的投递通道,取值 `im` / `websocket` / `webhook` / `sms`(真相源与同步约束见 POST /v1/messages 的"channel 语义") |
| callbackUrl | string(url) | 是 | Webhook 回调 URL,平台向此 URL POST 消息 |

> 订阅按通道分桶,但 HTTP 订阅面当前只对 `webhook` 通道有实际效果:回调仅在消息以 `channel: "webhook"` 投递时触发;WebSocket 实时订阅走 Socket.IO、不经过本端点;`im` / `sms` 订阅无实际效果(服务端预留扩展)。

### 响应(200)

```json
{
  "subscriptionId": "sub-456",
  "status": "subscribed"
}
```

> 平台向 `callbackUrl` 发送 POST 请求,请求体为消息 JSON(格式见"Webhook 回调格式")。你的服务需返回 2xx 确认接收。

### 代码示例

```typescript
const sub = await client.messages.subscribe({
  channel: 'webhook',
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

### 响应(200)

```json
{
  "unsubscribed": true
}
```

> 订阅不存在时,上游 ai-service 返回 404,但经 v1 转发层当前以 **503** 呈现(v1 本族端点不返回 404)。

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
  "deliveredCount": 1,
  "failedCount": 0
}
```

`status` 取值:`pending`(投递中)/ `delivered`(已投递)/ `failed`(投递失败)。

> `deliveredCount` / `failedCount` 按**通道**计数(一个通道算 1,v1 契约为单通道投递,故最大为 1),不是收件人数量;上游的 `rate_limited` 通道态在 v1 三态里没有槽位,既不计成功也不计失败。

### 代码示例

```typescript
const status = await client.messages.getStatus('msg-123')
console.log(status.deliveredCount, '已投递')
```

## Webhook 回调格式

消息以 `webhook` 通道投递时,平台向回调地址 POST JSON(单次请求超时 10 秒)。回调地址解析优先级:消息 `metadata.webhook_urls` / `metadata.webhook_url` > 订阅登记的 `callbackUrl` > 服务端 env `WEBHOOK_URLS`(逗号分隔)。

```http
POST https://your-app.com/webhook/messages
Content-Type: application/json
```

```json
{
  "message_id": "msg-123",
  "content": "新版本已发布",
  "metadata": { "priority": "high" }
}
```

- 请求体字段为**蛇形** `message_id`(不是 `messageId`),且**不含** `channel` / `publishedAt` 字段。
- 当前实现**不附带任何签名头**(没有 `X-Ihui-Signature`,也没有 HMAC Secret);随机/保密的回调地址本身就是能力凭证,如需防伪造请在应用层校验 `message_id` 归属。
- 你的服务应返回 2xx 确认接收;非 2xx 或请求异常会把该通道记为投递失败(见状态查询)。

## 错误码

| 状态码 | 场景 |
|--------|------|
| 400 | channel 缺失或不在枚举值域(`im`/`websocket`/`webhook`/`sms`)/ content 为空 / callbackUrl 非合法 URL |
| 401 | API Key 无效 |
| 403 | 缺少 `messages:read` / `messages:write` 权限 |
| 429 | 配额超限 |
| 502 | ai-service 业务失败(响应 `code≠0`)或响应缺少 `code` 字段 |
| 503 | ai-service 不可达;上游 404(消息/订阅不存在)当前也归入 503,v1 不返回 404 |

---

*最后更新: 2026-09-23*
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
