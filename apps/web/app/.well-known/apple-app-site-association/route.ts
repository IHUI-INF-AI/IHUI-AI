// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Apple App Site Association (AASA) — iOS / 微信 Universal Link 校验文件。
 *
 * 路径固定为 /.well-known/apple-app-site-association(Apple 强制,不能带扩展名),
 * 由 iOS 系统在企业微信/微信唤起 App 时回源校验,Content-Type 必须为 application/json。
 *
 * 用 App Router Route Handler 直接提供 AASA(而非 public/ 静态文件),
 * 兼容性更稳(静态文件在某些 Tunnel/边缘场景 Content-Type/缓存行为不一致)。
 *
 * 路由宿主说明:
 *  - 主域 aizhs.top 走进 web(8801),由本 Route Handler 直接提供(公网已验证 200 + application/json)。
 *  - file.aizhs.top 由 Cloudflare 隧道转发到本机 api(8802),故 AASA 在 api 侧同源再暴露一份:
 *    apps/api/src/routes/apple-app-site-association.ts(2026-10-28 G-100 补,修该域 404)。
 *
 * 内容来源(单一真相源,2026-10-28 G-100 抽源):
 *  - 文档形状 / 序列化 / 响应头全部来自 @ihui/shared/constants/apple-app-site-association,
 *    与 api 侧消费同一份,禁止任何一端再抄一份 JSON。
 *
 * Team ID 配置(部署时必填,复用 Apple 登录的 APPLE_TEAM_ID):
 *  - 自动读取 process.env.APPLE_TEAM_ID(即 Apple 登录同款 Team ID),拼接 iOS Bundle ID
 *    生成 appID = "<TeamID>.<BundleID>"(两端下一 env 键名,取源逻辑同在上述共享文件)。
 *  - 未配置时回退占位符 TEAMID.ai.ihui.mobile(仅本地/预发验证用,真实 iOS
 *    Universal Link 校验必须填真实 Team ID,否则 iOS 拒绝)。
 *  - iOS Bundle ID 默认 ai.ihui.mobile,可用 NEXT_PUBLIC_APPLE_APP_BUNDLE_ID 覆盖。
 */
import {
  APPLE_AASA_CACHE_CONTROL,
  APPLE_AASA_CONTENT_TYPE,
  buildAppleAppSiteAssociationBody,
  readAppleAppIdOptions,
} from '@ihui/shared/constants/apple-app-site-association'

export const dynamic = 'force-static'

export function GET() {
  return new Response(buildAppleAppSiteAssociationBody(readAppleAppIdOptions(process.env)), {
    headers: {
      'Content-Type': APPLE_AASA_CONTENT_TYPE,
      'Cache-Control': APPLE_AASA_CACHE_CONTROL,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
