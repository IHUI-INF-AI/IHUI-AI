# 第三方登录集成

## 概述

平台支持多种第三方登录方式，包括微信、支付宝、飞书等。

## 支持的登录方式

- **微信登录** - 微信扫码登录
- **支付宝登录** - 支付宝扫码登录
- **飞书登录** - 飞书扫码登录

## 集成流程

### 1. 获取登录二维码

微信登录二维码由前端直接生成，无需调用后端API。前端会根据配置的微信AppID生成微信官方授权URL，然后转换为二维码显示。

### 2. 轮询登录状态

```bash
curl https://api.example.com/auth/wechat/status?state=random_state_string
```

响应：

```json
{
  "code": 200,
  "data": {
    "status": "success",
    "token": "access_token_here",
    "user": {
      "id": "user-123",
      "name": "用户名"
    }
  }
}
```

### 3. 使用访问令牌

```bash
curl https://api.example.com/v1/user \
  -H "Authorization: Bearer access_token_here"
```

## 状态说明

- `pending` - 等待扫码
- `scanned` - 已扫码，等待确认
- `confirming` - 确认中
- `success` - 登录成功
- `failed` - 登录失败
- `expired` - 二维码已过期

## 代码示例

### JavaScript

```javascript
// 1. 前端生成微信授权URL（无需调用后端API）
// 前端会根据配置的微信AppID直接生成授权URL
import { generateWechatQrCode } from '@/api/unified-wechat'

const qrResponse = await generateWechatQrCode()
const qrCodeUrl = qrResponse.data.qrCodeUrl
const state = qrResponse.data.state

// 2. 显示二维码（将授权URL转换为二维码图片）
document.getElementById('qr-code').src = qrCodeUrl

// 3. 轮询登录状态
const pollInterval = setInterval(async () => {
  const statusResponse = await fetch(
    `https://api.example.com/auth/wechat/status?state=${state}`
  )
  const statusData = await statusResponse.json()
  
  if (statusData.data.status === 'success') {
    clearInterval(pollInterval)
    // 保存令牌
    localStorage.setItem('access_token', statusData.data.token)
    // 跳转到主页
    window.location.href = '/'
  } else if (statusData.data.status === 'expired' || 
             statusData.data.status === 'failed') {
    clearInterval(pollInterval)
    alert('登录失败或已过期')
  }
}, 2000) // 每2秒轮询一次
```

---

*最后更新: 2026-01-10*
