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

Webhook请求包含签名，用于验证请求来源：

```javascript
const crypto = require('crypto')

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret)
  const digest = hmac.update(payload).digest('hex')
  return digest === signature
}

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature']
  const payload = JSON.stringify(req.body)
  
  if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature')
  }
  
  // 处理事件
  handleWebhookEvent(req.body)
  res.status(200).send('OK')
})
```

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
