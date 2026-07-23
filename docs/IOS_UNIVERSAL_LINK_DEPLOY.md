# iOS UniversalLink 部署说明

本文档说明 IHUI-AI 移动端的 Apple App Site Association(AASA)文件部署流程,用于支持 iOS UniversalLink,使微信支付等场景能够通过 HTTPS 链接回调到原生 App。

---

## 1. 什么是 apple-app-site-association(AASA)

`apple-app-site-association`(简称 AASA)是 Apple 官方约定的、部署在 Web 服务器根目录或 `.well-known/` 目录下的 JSON 文件,用于声明「哪些 HTTPS 域名路径可以被指定的 iOS App 直接打开」。

iOS 系统在 App 安装时会自动请求 `https://<域名>/.well-known/apple-app-site-association`,校验通过后,该 App 即获得对应域名的 UniversalLink 唤起能力。

**核心作用:**
- 让 HTTPS 链接(例如微信支付回调链接)能直接打开 App,而不是走浏览器中转。
- 替代旧的 URL Scheme 方案,安全性更高(域名归属 + App 签名双校验)。
- 微信开放平台在 iOS 端要求移动应用必须配置 UniversalLink,否则支付/分享回调失败。

---

## 2. 文件部署位置

```
https://file.aizhs.top/.well-known/apple-app-site-association
```

- 域名:`file.aizhs.top`(与 `app.json` 的 `associatedDomains`、`WX_UNIVERSAL_LINK` 一致)
- 路径:`/.well-known/apple-app-site-association`
- 项目源文件位置:`apps/mobile-rn/public/.well-known/apple-app-site-association`

> 也可同时部署在根路径 `https://file.aizhs.top/apple-app-site-association`,Apple 会优先读取 `.well-known/`,根路径作为兼容备份。

---

## 3. 服务器要求

| 项目 | 要求 |
| --- | --- |
| 协议 | **必须 HTTPS**(证书有效,不能自签) |
| Content-Type | `application/json` |
| 文件格式 | 纯 JSON,**无需 plist 签名**(iOS 13+ 已废弃签名要求) |
| 文件大小 | **< 128KB** |
| 重定向 | 不允许 3xx 重定向到其他域名 |
| 状态码 | HTTP 200 |

> Nginx 配置示例(供参考,实际服务器按自身情况配置):
> ```nginx
> location /.well-known/apple-app-site-association {
>   default_type application/json;
>   alias /var/www/aasa/apple-app-site-association;
> }
> ```

---

## 4. 替换 TEAMID 占位符

当前 AASA 文件中 `appIDs` 字段使用占位符 `TEAMID`,**部署前必须替换为真实的 Apple Team ID**。

### 获取 Team ID

1. 登录 [Apple Developer](https://developer.apple.com/)。
2. 进入 **Account → Membership** 页面。
3. 在 **Membership Details** 区域找到 **Team ID**(10 位字母数字,例如 `A1B2C3D4E5`)。

### 替换示例

替换前(JSON 文件中):
```json
"appIDs": ["TEAMID.ai.ihui.mobile"]
```

替换后(假设 Team ID 为 `A1B2C3D4E5`):
```json
"appIDs": ["A1B2C3D4E5.ai.ihui.mobile"]
```

> - `appIDs` 格式为 `<TeamID>.<BundleIdentifier>`,两者用 `.` 连接。
> - **Bundle Identifier**: `ai.ihui.mobile`(来自 `apps/mobile-rn/app.json` 的 `ios.bundleIdentifier` 字段,**不要修改**)。
> - 一个 AASA 文件可配置多个 App,在 `appIDs` 数组中并列即可。

---

## 5. 验证方法

部署完成后,按以下 3 步逐项验证:

### 5.1 浏览器直查 JSON

用 Safari 或 Chrome 直接访问:
```
https://file.aizhs.top/.well-known/apple-app-site-association
```
- 应返回完整 JSON 文本(不能是 404 / HTML / 下载文件)。
- 检查 `appIDs` 中已替换为真实 Team ID(无 `TEAMID` 字样残留)。

### 5.2 Apple AASA Validator 工具验证

使用第三方校验工具(任选其一):
- [Branch AASA Validator](https://branch.io/resources/aasa-validator/)
- [AirServe AASA Validator](https://app-site-association.cdn-apple.com/)

输入域名 `file.aizhs.top`,校验结果应全部 ✅ 通过。常见报错:
- `Content-Type` 不是 `application/json` → 修服务器 MIME。
- `appIDs` 格式错误 → 检查 `TeamID.bundleId` 拼接。
- 文件大小超限 → 精简 components 配置。

### 5.3 真机跳转测试

1. iOS 设备安装带 UniversalLink 配置的 App(通过 TestFlight / Ad Hoc / EAS Build)。
2. 打开「备忘录」App,粘贴一个 UniversalLink,例如:
   ```
   https://file.aizhs.top/wechat/pay
   ```
3. 长按链接,若弹出菜单中显示「在 "IHUI AI" 中打开」 → UniversalLink 配置成功。
4. 直接点击链接也应直接唤起 App(而不是 Safari 中转页)。

> 首次校验可能需要 iOS 联网重新拉取 AASA(可重启设备或重装 App 触发)。

---

## 6. app.json 关联配置

以下配置已存在于 `apps/mobile-rn/app.json`,**无需修改**,仅供核对:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "ai.ihui.mobile",
      "associatedDomains": ["applinks:file.aizhs.top"]
    },
    "extra": {
      "WX_APP_APPID": "wx85fa429a9331b5c8",
      "WX_UNIVERSAL_LINK": "https://file.aizhs.top/"
    }
  }
}
```

字段说明:
- `bundleIdentifier`:App 的 Bundle ID,与 AASA 中 `appIDs` 的后半段一致。
- `associatedDomains`:iOS 系统声明「本 App 要关联 `file.aizhs.top` 域名」,与 AASA 文件双向匹配。
- `WX_APP_APPID`:微信开放平台移动应用 AppID。
- `WX_UNIVERSAL_LINK`:微信 SDK 初始化时传入的 UniversalLink,必须以 `/` 结尾。

---

## 7. 微信开放平台配置

在 [微信开放平台](https://open.weixin.qq.com/) 配置移动应用:

1. 进入「管理中心 → 移动应用 → 你的应用 → iOS 应用」。
2. 在 **UniversalLink** 字段填写:
   ```
   https://file.aizhs.top/
   ```
   - 必须以 `/` 结尾。
   - 必须与 AASA 文件中声明的域名一致。
   - 必须与 `app.json` 的 `WX_UNIVERSAL_LINK` 完全一致。
3. 保存后等待微信审核(部分场景即时生效)。

### 微信支付回调流程

```
App 发起支付
   ↓
拉起微信客户端完成支付
   ↓
微信客户端通过 UniversalLink 回调到 App
   ↓
App 收到回调,处理支付结果(查询订单状态)
```

- 回调路径建议使用 `https://file.aizhs.top/wechat/*`(AASA 中已配置 `/wechat/*` 规则)。
- 若微信 SDK 配置的 UniversalLink 是 `https://file.aizhs.top/`,微信会自动在末尾拼接回调路径,无需手动拼参。
- 兜底规则 `/*` 保证任何路径都能回到 App,避免回调路径变更导致失败。

---

## 8. 常见问题

| 问题 | 原因 | 解决 |
| --- | --- | --- |
| 链接在 Safari 打开而非唤起 App | AASA 未生效或 `appIDs` 不匹配 | 等 iOS 重新拉取 AASA(重装 App);检查 Team ID |
| 微信支付后不回 App | UniversalLink 配置不一致 | 三处核对:`app.json` / AASA / 微信开放平台 |
| AASA Validator 报 Content-Type 错误 | 服务器返回非 JSON MIME | Nginx 加 `default_type application/json` |
| iOS 13+ 设备 OK,iOS 12 不识别 | 旧版需要签名版 AASA | 一般无需兼容 iOS 12(已低于 1% 占比) |
| 改了 AASA 但没生效 | iOS 缓存 | 重启设备 / 重装 App / 等 24h |

---

## 9. 文件清单

| 文件 | 位置 | 说明 |
| --- | --- | --- |
| AASA 源文件 | `apps/mobile-rn/public/.well-known/apple-app-site-association` | 项目内源文件,需部署到服务器 |
| 部署文档 | `docs/IOS_UNIVERSAL_LINK_DEPLOY.md` | 本文档 |
| App 配置 | `apps/mobile-rn/app.json` | 已配置 `associatedDomains` + `WX_UNIVERSAL_LINK`(无需修改) |

---

## 10. 部署 Checklist

- [ ] 获取真实 Apple Team ID
- [ ] 替换 AASA 文件中的 `TEAMID` 占位符
- [ ] 上传 AASA 到 `https://file.aizhs.top/.well-known/apple-app-site-association`
- [ ] 服务器返回 `Content-Type: application/json`
- [ ] 浏览器直查 JSON 可见
- [ ] Apple AASA Validator 全绿
- [ ] 微信开放平台 UniversalLink 填写 `https://file.aizhs.top/`
- [ ] iOS 真机跳转测试通过
- [ ] 微信支付真机回调测试通过
