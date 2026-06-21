# 错误处理

## HTTP状态码

API使用标准的HTTP状态码：

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未授权（API密钥无效） |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 429 | 请求频率限制 |
| 500 | 服务器错误 |

## 错误响应格式

```json
{
  "code": 400,
  "success": false,
  "message": "Invalid request parameters",
  "data": null,
  "errors": [
    {
      "field": "model",
      "message": "Model is required"
    }
  ]
}
```

## 常见错误

### 401 Unauthorized

API密钥无效或已过期。

**解决方案**：
- 检查API密钥是否正确
- 确认API密钥未过期
- 重新生成API密钥

### 403 Forbidden

权限不足。

**解决方案**：
- 检查API密钥权限
- 确认账户状态正常
- 联系管理员提升权限

### 429 Too Many Requests

请求频率超过限制。

**解决方案**：
- 降低请求频率
- 使用请求队列
- 升级账户套餐

### 500 Internal Server Error

服务器内部错误。

**解决方案**：
- 稍后重试
- 检查请求参数
- 联系技术支持

## 错误处理最佳实践

### 1. 检查响应状态

```javascript
const response = await fetch(url, options)
if (!response.ok) {
  const error = await response.json()
  console.error('API Error:', error)
  throw new Error(error.message)
}
```

### 2. 处理特定错误

```javascript
try {
  const response = await fetch(url, options)
  const data = await response.json()
  
  if (!data.success) {
    switch (data.code) {
      case 401:
        // 处理认证错误
        break
      case 429:
        // 处理频率限制
        break
      default:
        // 处理其他错误
    }
  }
} catch (error) {
  // 处理网络错误
}
```

### 3. 重试机制

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options)
      if (response.ok) {
        return await response.json()
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
```

---

*最后更新: 2026-01-10*
