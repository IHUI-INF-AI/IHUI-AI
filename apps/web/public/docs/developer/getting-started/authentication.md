# 身份认证

## API Key 鉴权

IHUI 开发者平台对外 API（`/v1/*` 路由）使用 API Key 进行鉴权。JWT 仅用于 `/api/*` 内部管理路由，不适用于对外 API。

### 鉴权方式

支持以下两种 HTTP Header 传递 API Key（任选其一）：

| Header | 格式 | 说明 |
|--------|------|------|
| `Authorization` | `Bearer ihui_xxx` | 主鉴权方式，OpenAI 兼容格式 |
| `X-Api-Key` | `ihui_xxx` | 备选方式，直接传 Key 值 |

### 可选 Secret 校验

创建或轮换 API Key 时，平台会返回一个 Secret（格式 `sk_xxx`）。对于需要更高安全性的场景，可在请求中附加 `X-Api-Secret` Header 进行二次校验：

```http
X-Api-Secret: sk_xxx
```

> **注意**：Secret 仅在创建/轮换时返回一次，平台以 SHA-256 哈希存储，无法找回。请务必在收到后立即保存。

### 获取 API Key

1. 登录管理后台，进入「开发者中心」
2. 点击「创建密钥」
3. 设置密钥名称和权限点（从 7 个权限点枚举中选择）
4. 创建成功后立即复制保存 API Key（`ihui_xxx`）和 Secret（`sk_xxx`）

### 轮换密钥

在管理后台「开发者中心」的 API 密钥卡片中，点击重置按钮可轮换 Secret。轮换后：

- 旧 Secret 立即失效
- API Key（`ihui_xxx`）保持不变
- 新 Secret 仅显示一次，需更新所有接入方

## 示例

### cURL

```bash
curl -X POST https://api.example.com/v1/chat/completions \
  -H "Authorization: Bearer ihui_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

### JavaScript

```javascript
const response = await fetch('https://api.example.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ihui_xxx',
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

### Python

```python
import requests

headers = {
    'Authorization': 'Bearer ihui_xxx',
    'Content-Type': 'application/json'
}

data = {
    'model': 'gpt-4',
    'messages': [
        {'role': 'user', 'content': 'Hello'}
    ]
}

response = requests.post(
    'https://api.example.com/v1/chat/completions',
    headers=headers,
    json=data
)
```

## 安全建议

- **保护 API Key** — 不要将密钥提交到代码仓库
- **使用环境变量** — 将密钥存储在环境变量中
- **定期轮换** — 定期重置 Secret
- **最小权限** — 只授予必要的权限点
- **监控使用** — 定期检查 API 调用日志

---

*最后更新: 2026-07-22*
