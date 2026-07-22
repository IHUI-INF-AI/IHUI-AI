# 错误处理

## HTTP 状态码

`/v1/*` API 使用标准 HTTP 状态码：

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未授权（API Key 无效或已吊销） |
| 403 | 权限不足（缺少所需权限点） |
| 404 | 资源不存在 |
| 429 | 配额超限或频率限制 |
| 500 | 服务器错误 |

## 错误响应格式

`/v1/*` 端点采用 OpenAI 兼容错误格式：

```json
{
  "error": {
    "message": "Error message",
    "type": "invalid_request_error"
  }
}
```

## 常见错误

### 401 Unauthorized

API Key 无效、已过期或已被吊销。

```json
{
  "error": {
    "message": "Invalid API key",
    "type": "authentication_error"
  }
}
```

**解决方案**：
- 检查 API Key 是否正确（格式 `ihui_xxx`）
- 确认 API Key 未被删除/吊销
- 在管理后台重新创建或轮换密钥

### 403 Forbidden

API Key 缺少调用该端点所需的权限点。

```json
{
  "error": {
    "message": "Insufficient permissions: requires 'chat:write'",
    "type": "permission_error"
  }
}
```

**解决方案**：
- 检查 API Key 是否授予了对应权限点
- 在管理后台编辑密钥权限或创建新密钥

### 429 Too Many Requests

API Key 超出每小时/每天配额限制，或超出每分钟频率限制。

响应头包含 `Retry-After`（秒数），表示建议重试的等待时间：

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/json

{
  "error": {
    "message": "Rate limit exceeded",
    "type": "rate_limit_error"
  }
}
```

**解决方案**：
- 等待 `Retry-After` 指定的秒数后重试
- 降低请求频率
- 在管理后台调整 API Key 的 rateLimit 配额
- 使用请求队列削峰

### 400 Bad Request

请求参数错误。

```json
{
  "error": {
    "message": "Model is required",
    "type": "invalid_request_error"
  }
}
```

**解决方案**：
- 检查请求体 JSON 格式
- 确认必填参数已提供
- 参考各端点文档的参数说明

### 500 Internal Server Error

服务器内部错误。

**解决方案**：
- 稍后重试
- 检查请求参数是否合法
- 联系技术支持

## 错误处理最佳实践

### 1. 检查响应状态

```javascript
const response = await fetch(url, options)
if (!response.ok) {
  const error = await response.json()
  console.error('API Error:', error.error.message)
  throw new Error(error.error.message)
}
```

### 2. 处理特定错误

```javascript
try {
  const response = await fetch(url, options)
  const data = await response.json()

  if (!response.ok) {
    switch (response.status) {
      case 401:
        // API Key 无效，引导用户重新获取
        break
      case 403:
        // 权限不足，引导用户检查权限点
        break
      case 429:
        const retryAfter = response.headers.get('Retry-After')
        // 等待 retryAfter 秒后重试
        break
      default:
        // 处理其他错误
    }
  }
} catch (error) {
  // 处理网络错误
}
```

### 3. 重试机制（含 429 退避）

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options)
      if (response.ok) {
        return await response.json()
      }
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10)
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
        continue
      }
      throw new Error(`HTTP ${response.status}`)
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
```

---

*最后更新: 2026-07-22*
