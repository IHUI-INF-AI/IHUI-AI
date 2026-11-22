// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Apple App Site Association(AASA)单一真相源。
 *
 * 消费方(两端,只此一份内容,禁止任何一端再抄 JSON):
 *  - web(8801):apps/web/app/.well-known/apple-app-site-association/route.ts
 *  - api(8802):apps/api/src/routes/apple-app-site-association.ts
 *    (file.aizhs.top 由 Cloudflare 隧道转发到 api,故该域也需要同一份 AASA)
 *
 * Apple 约束:路径固定为 /.well-known/apple-app-site-association(无扩展名),
 * Content-Type 必须是 application/json;iOS/微信回源校验,形状与取值不得随意变动。
 *
 * 本文件是纯常量/纯函数(不读 env、不碰 node: 内建),env 由宿主读取后经
 * readAppleAppIdOptions(env) 传入 —— 共享层保持可被 RN/小程序宿主安全引入。
 */

/** iOS Bundle ID 默认值(宿主可用 NEXT_PUBLIC_APPLE_APP_BUNDLE_ID 覆盖)。 */
export const DEFAULT_APPLE_APP_BUNDLE_ID = 'ai.ihui.mobile'

/** 未配置 Team ID 时的占位符 —— 仅本地/预发验证可用,真实 Universal Link 校验会被 iOS 拒绝。 */
export const APPLE_AASA_PLACEHOLDER_TEAM_ID = 'TEAMID'

/** AASA 响应头(与 web 既有线上取值逐字一致)。 */
export const APPLE_AASA_CONTENT_TYPE = 'application/json; charset=utf-8'

/** 缓存头(与 web 既有线上取值逐字一致;Apple CDN/隧道两侧均可缓存 1h,后台异步续 1d)。 */
export const APPLE_AASA_CACHE_CONTROL =
  'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'

export interface AppleUniversalLinkComponent {
  '/': string
}

export interface AppleAppSiteAssociationDetail {
  appIDs: string[]
  components: AppleUniversalLinkComponent[]
}

export interface AppleAppSiteAssociation {
  applinks: {
    details: AppleAppSiteAssociationDetail[]
  }
}

export interface AppleAppIdOptions {
  teamId?: string | null
  bundleId?: string | null
}

/**
 * 从宿主 env 取 Team ID / Bundle ID(两端同一键名,与 Apple 登录共用 APPLE_TEAM_ID)。
 * 传 process.env 即可;不传则退回「无 teamId + 默认 bundleId」。
 */
export function readAppleAppIdOptions(
  env: Record<string, string | undefined> = {},
): AppleAppIdOptions {
  return {
    teamId: env.APPLE_TEAM_ID ?? env.NEXT_PUBLIC_APPLE_TEAM_ID ?? '',
    bundleId: env.NEXT_PUBLIC_APPLE_APP_BUNDLE_ID ?? DEFAULT_APPLE_APP_BUNDLE_ID,
  }
}

/**
 * 由 Team ID + Bundle ID 拼出 appID = "<TeamID>.<BundleID>"。
 * 未配置 Team ID ⇒ 回退占位符 TEAMID.*(与 web 侧既有行为逐字一致)。
 */
export function resolveAppleAppId(options: AppleAppIdOptions = {}): string {
  const teamId = (options.teamId ?? '').trim()
  const bundleId = (options.bundleId ?? DEFAULT_APPLE_APP_BUNDLE_ID).trim()
  return teamId ? `${teamId}.${bundleId}` : `${APPLE_AASA_PLACEHOLDER_TEAM_ID}.${bundleId}`
}

/** AASA 文档(形状与线上 appIDs/components 逐字不变;components 顺序即匹配优先级)。 */
export function buildAppleAppSiteAssociation(appId: string): AppleAppSiteAssociation {
  return {
    applinks: {
      details: [
        {
          appIDs: [appId],
          components: [
            // 微信支付回调 UniversalLink 路径
            { '/': '/wechat/*' },
            // 兜底:所有路径都可作为 UniversalLink 回调
            { '/': '/*' },
          ],
        },
      ],
    },
  }
}

/** 序列化(2 空格缩进,与 web 线上响应体逐字节一致)。 */
export function serializeAppleAppSiteAssociation(document: AppleAppSiteAssociation): string {
  return JSON.stringify(document, null, 2)
}

/** 一句话组装:options → appID → 文档 → 响应体。两端 handler 共用,禁止各自再拼。 */
export function buildAppleAppSiteAssociationBody(options: AppleAppIdOptions = {}): string {
  return serializeAppleAppSiteAssociation(buildAppleAppSiteAssociation(resolveAppleAppId(options)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
