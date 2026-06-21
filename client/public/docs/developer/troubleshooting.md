# 故障排查

## 常见问题

### API请求失败

**问题**: API请求返回错误

**排查步骤**:
1. 检查API密钥是否正确
2. 检查请求URL是否正确
3. 检查请求参数格式
4. 查看错误响应详情

**解决方案**:
- 验证API密钥有效性
- 检查网络连接
- 查看API文档确认参数格式

### 认证失败

**问题**: 返回401 Unauthorized

**排查步骤**:
1. 检查Authorization header格式
2. 验证API密钥是否有效
3. 检查API密钥是否过期

**解决方案**:
```javascript
// 确保Authorization header格式正确
headers: {
  'Authorization': `Bearer ${apiKey}` // 注意Bearer后面有空格
}
```

### 速率限制

**问题**: 返回429 Too Many Requests

**排查步骤**:
1. 检查请求频率
2. 查看速率限制说明
3. 实现请求队列

**解决方案**:
- 降低请求频率
- 实现请求重试机制
- 升级账户套餐

### 网络超时

**问题**: 请求超时

**排查步骤**:
1. 检查网络连接
2. 增加超时时间
3. 实现重试机制

**解决方案**:
```javascript
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 30000)

try {
  const response = await fetch(url, {
    ...options,
    signal: controller.signal
  })
} catch (error) {
  if (error.name === 'AbortError') {
    console.error('请求超时')
  }
} finally {
  clearTimeout(timeoutId)
}
```

## 调试技巧

### 1. 启用详细日志

```javascript
const DEBUG = true

function log(...args) {
  if (DEBUG) {
    console.log('[API]', ...args)
  }
}

async function apiCall(url, options) {
  log('请求:', url, options)
  const response = await fetch(url, options)
  log('响应:', response.status, await response.clone().json())
  return response
}
```

### 2. 使用网络工具

- 浏览器开发者工具Network面板
- Postman
- cURL

### 3. 检查响应头

```javascript
const response = await fetch(url, options)
console.log('状态码:', response.status)
console.log('响应头:', Object.fromEntries(response.headers))
```

## 获取帮助

如果问题仍未解决：

1. **查看文档** - 查阅完整API文档
2. **联系支持** - 发送邮件到 support@example.com
3. **提交工单** - 在开发者平台提交工单

---

*最后更新: 2026-01-10*
