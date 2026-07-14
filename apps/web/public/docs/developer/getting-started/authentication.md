# 身份认证

## API密钥

### 获取API密钥

1. 登录开发者平台
2. 进入"API令牌管理"
3. 点击"创建令牌"
4. 设置令牌名称和权限
5. 生成并保存API密钥

### 使用API密钥

在API请求的Header中添加：

```http
Authorization: Bearer YOUR_API_KEY
```

### 示例

#### cURL

```bash
curl -X POST https://api.example.com/v1/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

#### JavaScript

```javascript
const response = await fetch('https://api.example.com/v1/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Hello' }
    ]
  })
})
```

#### Python

```python
import requests

headers = {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
}

data = {
    'model': 'gpt-4',
    'messages': [
        {'role': 'user', 'content': 'Hello'}
    ]
}

response = requests.post(
    'https://api.example.com/v1/chat',
    headers=headers,
    json=data
)
```

## 安全建议

- **保护API密钥** - 不要将API密钥提交到代码仓库
- **使用环境变量** - 将API密钥存储在环境变量中
- **定期轮换** - 定期更换API密钥
- **限制权限** - 只授予必要的权限
- **监控使用** - 定期检查API使用情况

## 错误处理

### 401 Unauthorized

API密钥无效或已过期。

```json
{
  "code": 401,
  "message": "Invalid API key",
  "data": null
}
```

### 403 Forbidden

API密钥权限不足。

```json
{
  "code": 403,
  "message": "Insufficient permissions",
  "data": null
}
```

---

*最后更新: 2026-01-10*
