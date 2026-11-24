<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Webhook集成

## 概述

Webhook允许您接收平台事件的实时通知。

## 配置Webhook

### 1. 创建Webhook端点

在您的服务器上创建一个HTTP端点来接收Webhook事件：

```javascript
// Express.js示例
app.post('/webhook', (req, res) => {
  const event = req.body
  console.log('收到事件:', event)
  
  // 处理事件
  handleWebhookEvent(event)
  
  res.status(200).send('OK')
})
```

### 2. 注册Webhook URL

在开发者平台注册您的Webhook URL：

```bash
curl -X POST https://api.example.com/v1/webhooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/webhook",
    "events": ["chat.completed", "file.uploaded"]
  }'
```

## 事件类型

### chat.completed

对话完成事件：

```json
{
  "type": "chat.completed",
  "data": {
    "chat_id": "chat-123",
    "user_id": "user-123",
    "model": "gpt-4",
    "tokens": 100
  },
  "timestamp": 1677652288
}
```

### file.uploaded

文件上传事件：

```json
{
  "type": "file.uploaded",
  "data": {
    "file_id": "file-123",
    "filename": "example.pdf",
    "bytes": 1024
  },
  "timestamp": 1677652288
}
```

## 安全验证

### 签名验证

**仅适用于开发者平台的 relay 事件订阅**(`POST /api/developer/webhooks/subscriptions`)。
平台发送的头是 `X-IHUI-Signature: sha256=<hex>`,签名对象为**请求体的原始字节串**,
Secret 只在创建订阅时返回一次(丢失需重建订阅)。
证据:`apps/api/src/services/webhook-relay-notifier.ts:84-96`(带头)、`:159-165`(签名对象)、
`apps/api/src/routes/developer/webhooks.ts:200-221`(secret 一次性下发)。

```javascript
const crypto = require('crypto')

function verifyWebhookSignature(rawBody, header, secret) {
  if (typeof header !== 'string' || !header.startsWith('sha256=')) return false
  const received = header.slice('sha256='.length)
  if (received.length !== 64) return false // 先判长度,避免把任意输入喂进比对
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest()
  // 必须比原始字节:JSON.stringify(req.body) 重排键序或改动空白都会让签名对不上
  return crypto.timingSafeEqual(digest, Buffer.from(received, 'hex'))
}

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  if (!verifyWebhookSignature(req.body, req.headers['x-ihui-signature'], WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature')
  }
  handleWebhookEvent(JSON.parse(req.body.toString('utf8')))
  res.status(200).send('OK')
})
```

> **不要把它挂到 `/v1/messages/subscribe` 上。** 消息总线的回调**不附带任何签名头**
> (`apps/ai-service/app/services/message_bus.py:392` 的投递只有 `client.post(url, json=payload)`),
> 按上面这套验签会把 100% 真实回调判为无效。该链路的可用校验手段见
> `docs/developer/best-practices.md` 的「`/v1/messages/subscribe` 的回调不附带任何签名头」一节。

## 重试机制

如果Webhook端点返回非2xx状态码，平台会自动重试：

- 重试间隔：1秒、5秒、30秒、5分钟
- 最大重试次数：5次
- 超时时间：30秒

## 最佳实践

1. **快速响应** - Webhook端点应在5秒内响应
2. **幂等性** - 确保事件处理是幂等的
3. **日志记录** - 记录所有接收的事件
4. **错误处理** - 妥善处理错误情况
5. **验证签名** - 始终验证Webhook签名

---

*最后更新: 2026-01-10*
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
