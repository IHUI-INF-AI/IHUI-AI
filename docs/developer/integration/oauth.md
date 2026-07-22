# OAuth集成

## 概述

OAuth 2.0允许第三方应用安全地访问用户资源。

## 授权流程

### 1. 获取授权码

重定向用户到授权页面：

```
https://api.example.com/oauth/authorize?
  client_id=YOUR_CLIENT_ID&
  redirect_uri=YOUR_REDIRECT_URI&
  response_type=code&
  scope=read write
```

### 2. 获取访问令牌

使用授权码换取访问令牌：

```bash
curl -X POST https://api.example.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=AUTHORIZATION_CODE" \
  -d "redirect_uri=YOUR_REDIRECT_URI" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

### 3. 使用访问令牌

```bash
curl https://api.example.com/v1/user \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

## 刷新令牌

访问令牌过期后，使用刷新令牌获取新令牌：

```bash
curl -X POST https://api.example.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=REFRESH_TOKEN" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

## 权限范围

- `read` - 读取权限
- `write` - 写入权限
- `admin` - 管理员权限

## 代码示例

### JavaScript

```javascript
// 1. 重定向到授权页面
const authUrl = `https://api.example.com/oauth/authorize?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${REDIRECT_URI}&` +
  `response_type=code&` +
  `scope=read write`

window.location.href = authUrl

// 2. 在回调页面获取授权码并换取令牌
const code = new URLSearchParams(window.location.search).get('code')

const tokenResponse = await fetch('https://api.example.com/oauth/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
  })
})

const tokenData = await tokenResponse.json()
const accessToken = tokenData.access_token
```

---

*最后更新: 2026-01-10*
