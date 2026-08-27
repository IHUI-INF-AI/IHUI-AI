/**
 * Apple App Site Association (AASA) — iOS / 微信 Universal Link 校验文件。
 *
 * 路径固定为 /.well-known/apple-app-site-association(Apple 强制,不能带扩展名),
 * 由 iOS 系统在企业微信/微信唤起 App 时回源校验,Content-Type 必须为 application/json。
 *
 * 用 App Router Route Handler 直接提供 AASA(而非 public/ 静态文件),
 * 兼容性更稳(静态文件在某些 Tunnel/边缘场景 Content-Type/缓存行为不一致)。
 *
 * 路由宿主说明(2026-08-27 核查):
 *  - IHUI-AI 的 Cloudflare Tunnel(e675929a)实际 ingress 仅含
 *    aizhs.top / bsm.aizhs.top / api.aizhs.top / ai.aizhs.top,**不含 file.aizhs.top**。
 *  - 公网 file.aizhs.top 当前被 Cloudflare 路由到另一个应用(「写字楼租金管理系统」),
 *    与本项目无关,故其 404 是"指错了 origin",并非本应用代码问题。
 *  - 本 Route Handler 对任意 Host 都返回正确 AASA(local 8801 已验证
 *    Host=file.aizhs.top 也能拿到 200+json)。一旦 file.aizhs.top 的 Cloudflare
 *    DNS/隧道改指本机 8801,无需改代码即可在 file.aizhs.top 上生效。
 *  - 当前已验证:aizhs.top/.well-known/apple-app-site-association 公网 200 + application/json。
 *
 * Team ID 配置(部署时必填,复用 Apple 登录的 APPLE_TEAM_ID):
 *  - 本 Route Handler 自动读取 process.env.APPLE_TEAM_ID(即下方 Apple 登录同款
 *    Team ID),拼接 iOS Bundle ID 生成 appID = "<TeamID>.<BundleID>"。
 *  - 未配置时回退占位符 TEAMID.ai.ihui.mobile(仅本地/预发验证用,真实 iOS
 *    Universal Link 校验必须填真实 Team ID,否则 iOS 拒绝)。
 *  - iOS Bundle ID 默认 ai.ihui.mobile,可用 NEXT_PUBLIC_APPLE_APP_BUNDLE_ID 覆盖。
 */
export const dynamic = 'force-static'

const APPLE_TEAM_ID = (process.env.APPLE_TEAM_ID ?? process.env.NEXT_PUBLIC_APPLE_TEAM_ID ?? '')
  .trim()
const APPLE_BUNDLE_ID = (process.env.NEXT_PUBLIC_APPLE_APP_BUNDLE_ID ?? 'ai.ihui.mobile').trim()
const APP_ID = APPLE_TEAM_ID ? `${APPLE_TEAM_ID}.${APPLE_BUNDLE_ID}` : `TEAMID.${APPLE_BUNDLE_ID}`

const AASA = {
  applinks: {
    details: [
      {
        appIDs: [APP_ID],
        components: [
          {
            '/': '/wechat/*',
            comment: '微信支付回调 UniversalLink 路径',
          },
          {
            '/': '/*',
            comment: '兜底:所有路径都可作为 UniversalLink 回调',
          },
        ],
      },
    ],
  },
}

export function GET() {
  return new Response(JSON.stringify(AASA, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
