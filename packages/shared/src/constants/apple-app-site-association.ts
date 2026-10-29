// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Apple App Site Association (AASA) 常量件。
 *
 * 为什么放在 @ihui/shared:api(8802)与 web(8801)要吐**同一份** AASA ——
 * 公网 file.aizhs.top 的隧道可能转发到 api,也可能落到 web,两边内容漂开会让
 * iOS 在不同入口拿到不同 appID,表现为"有时能唤起、有时不能"。
 *
 * 依据(2026-10-28 从历史保全提交 ac7d339fba6^ 的
 * apps/web/app/.well-known/apple-app-site-association/route.ts 逐字还原语义):
 *  - Team ID 复用 Apple 登录同款 APPLE_TEAM_ID(兼容 NEXT_PUBLIC_APPLE_TEAM_ID);
 *  - iOS Bundle ID 默认 ai.ihui.mobile,可用 NEXT_PUBLIC_APPLE_APP_BUNDLE_ID 覆盖;
 *  - 未配置 Team ID 时回退占位符 TEAMID.<bundle>,仅供本地/预发 —— 真实 iOS
 *    Universal Link 校验必须填真 Team ID,否则 iOS 拒绝,这是**刻意的 fail-visible**,
 *    不要把它改成"没配就返回空数组"(那会让故障从"唤起失败"退化成"静默无配置")。
 *
 * 本文件是纯函数 + 常量,不直接读 process.env —— shared 会被打进浏览器产物,
 * 读 env 的职责留给调用方(api 路由 / web route handler)。
 */

export const DEFAULT_APPLE_APP_BUNDLE_ID = 'ai.ihui.mobile'
/** 未配置 Team ID 时的占位符,见上方 fail-visible 说明 */
export const PLACEHOLDER_APPLE_TEAM_ID = 'TEAMID'

export interface AppleAppSiteAssociationEnv {
  APPLE_TEAM_ID?: string
  NEXT_PUBLIC_APPLE_TEAM_ID?: string
  NEXT_PUBLIC_APPLE_APP_BUNDLE_ID?: string
}

export interface AppleAppSiteAssociation {
  applinks: {
    details: Array<{
      appIDs: string[]
      components: Array<Record<string, string>>
    }>
  }
}

/** Universal Link 覆盖路径:微信支付回调优先,其余路径兜底 */
export const APPLE_UNIVERSAL_LINK_COMPONENTS: Array<Record<string, string>> = [
  { '/': '/wechat/*' },
  { '/': '/*' },
]

/** Apple 硬性要求:该路径的 Content-Type 必须为 application/json */
export const APPLE_AASA_CONTENT_TYPE = 'application/json; charset=utf-8'
/** 缓存语义两端必须一致,否则同一份内容在两个入口的有效期不同 */
export const APPLE_AASA_CACHE_CONTROL =
  'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'

export interface AppleAppIdOptions {
  /** `<TeamID>.<BundleID>`,未配 Team ID 时用占位符 */
  appId: string
  /** 真实 Team ID;未配置为 null(调用方据此判断是否处于占位态) */
  teamId: string | null
  bundleId: string
}

/**
 * 读取并归一化 Team ID / Bundle ID,拼出 appID。
 * 纯函数:调用方把 process.env 传进来,便于单测与两端共用。
 */
export function readAppleAppIdOptions(env: AppleAppSiteAssociationEnv = {}): AppleAppIdOptions {
  const teamId = (env.APPLE_TEAM_ID ?? env.NEXT_PUBLIC_APPLE_TEAM_ID ?? '').trim()
  const bundleId = (env.NEXT_PUBLIC_APPLE_APP_BUNDLE_ID ?? DEFAULT_APPLE_APP_BUNDLE_ID).trim()
  const appId = teamId ? `${teamId}.${bundleId}` : `${PLACEHOLDER_APPLE_TEAM_ID}.${bundleId}`

  return { appId, teamId: teamId || null, bundleId }
}

/** 组装 AASA 文档对象:形状只在这里定义一次(两端共用,禁各自再抄 JSON) */
function assembleAppleAppSiteAssociation(options: AppleAppIdOptions): AppleAppSiteAssociation {
  return {
    applinks: {
      details: [
        {
          appIDs: [options.appId],
          components: APPLE_UNIVERSAL_LINK_COMPONENTS,
        },
      ],
    },
  }
}

/**
 * web route handler 用:返回**可直接作为 Response body 的 JSON 字符串**。
 * 名字里的 Body 指 HTTP 响应体,不是对象 —— 路由整份交给 `new Response(...)`,
 * 而 BodyInit 只收字符串/二进制,传对象在类型层就过不去。
 */
export function buildAppleAppSiteAssociationBody(options: AppleAppIdOptions): string {
  return JSON.stringify(assembleAppleAppSiteAssociation(options))
}

/**
 * 一步到位的便捷入口(api 侧用,fastify `.send(obj)` 负责序列化)。
 * 刻意复用上面两步,不再复制一遍取源/形状 —— §0.6 单一真相源。
 */
export function buildAppleAppSiteAssociation(
  env: AppleAppSiteAssociationEnv = {},
): AppleAppSiteAssociation {
  return assembleAppleAppSiteAssociation(readAppleAppIdOptions(env))
}

/** 向后兼容别名:api 路由早期用的是这个名字,保留以免两处各写一份字符串 */
export const APPLE_APP_SITE_ASSOCIATION_CACHE_CONTROL = APPLE_AASA_CACHE_CONTROL
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
