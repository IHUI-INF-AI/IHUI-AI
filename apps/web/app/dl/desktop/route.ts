// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面安装包的地域分流解析入口:`GET /dl/desktop?file=<资产文件名>` → 302 到该访客该走的那条腿。
 *
 * 为什么要有这条腿(2026-11-04 机主问"国内外是否各走最快的那条腿"现读出):此前站点给桌面端**只发一条**
 * 腿 —— 字节等值成立时 `desktop-feed-live.ts` 把 href 换成 Gitee,于是海外访客被强制走 Gitee(更慢、
 * 大附件还可能限速),而 `sync-gitee.py` 一断,桌面下载对所有人一起断,没有第二腿可退。
 *
 * 三条设计约束(都刻意写在代码里而不是注释里靠人自觉):
 *  ① **请求里没有任何 URL 输入**:只有文件名,且过 `isSafeAssetName` 字符集白名单;两条腿的 URL 全部由
 *     服务端从"当前 live release 的 tag + 文件名"构造 ⇒ 结构上没有开放重定向的面。落点仍再过
 *     `isSafeNavigationTarget(..., { allowedOrigins: <字面量清单> })`(与门 278 同纪律,双保险)。
 *  ② **字节等值不成立/量不到 ⇒ 不选国内腿**:沿用 `giteeByteParity` 那份判据(0.1.75 那次"同名不同字节"
 *     的冒名旧包会让客户端下载成功而验签必失败,全部门禁不响)。本器不复制判据,只 import(§0.6)。
 *  ③ **不分地域缓存**:响应 `private, no-store` —— 一旦让 CDN 按国家缓存,把"国内腿"缓存到海外边缘
 *     节点就是第二次同一事故,只是换了个方向。
 */
import { NextResponse } from 'next/server'
import { getMainDomainOrigin } from '@/lib/auth-domains'

import {
  githubDownloadUrl,
  giteeByteParity,
  giteeDownloadUrl,
  resolveLiveDesktopFeed,
} from '@/config/desktop-feed-live'
import { isSafeNavigationTarget } from '@/lib/sso-redirect-guard'
import {
  assetNameFromHref,
  isSafeAssetName,
  pageBaseOrigin,
  pickDesktopLeg,
  RELEASE_TARGET_ALLOWED_ORIGINS,
} from '@/lib/desktop-download-leg'

/**
 * 访客地域的候选头。为什么不只认 `cf-ipcountry`:站点入口换过三层(Cloudflare 隧道 → EdgeOne
 * → 自建节点直连),只认 Cloudflare 那一枚会在换入口的那天静默变成"所有人都没地域"——
 * 而"没地域"若被读成"在海外",全体国内访客就被推去 GitHub 直连(比改之前更慢)。
 * 取不到时传空串,由判据按"保持现状"处理。
 */
const COUNTRY_HEADERS = [
  'cf-ipcountry',
  'x-forwarded-ip-country',
  'x-ip-country',
  'x-edge-country',
  'ip-country',
] as const

function visitorCountry(request: Request): string {
  for (const h of COUNTRY_HEADERS) {
    const v = request.headers.get(h)
    if (v && v.trim()) return v.trim().toUpperCase()
  }
  return ''
}

const FALLBACK_PAGE = '/download/desktop'

function toPage(request: Request, reason: string): NextResponse {
  // NextResponse.redirect 只吃绝对 URL,所以必须定一个"这台访客真能打开"的 origin。
  // 直接拿 request.url 的 origin 是错的:蓝绿/路由把它转到内网 web 进程后那就是
  // http://localhost:8852 —— 公网用户点兜底会得到一条打不开的跳转(2026-11-04 实测)。
  // 取值次序与防伪造 Host 的规则都住在 pageBaseOrigin 里,本处只喂头、不复算(§0.6)。
  const base = pageBaseOrigin({
    requestOrigin: new URL(request.url).origin,
    forwardedHost: request.headers.get('x-forwarded-host') ?? request.headers.get('forwarded'),
    forwardedProto: request.headers.get('x-forwarded-proto'),
    mainDomainOrigin: getMainDomainOrigin(),
  })
  const res = NextResponse.redirect(new URL(FALLBACK_PAGE, base), 302)
  res.headers.set('Cache-Control', 'private, no-store')
  res.headers.set('X-Desktop-Leg', `fallback:${reason.slice(0, 40)}`)
  return res
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url)
  const wanted = String(url.searchParams.get('file') ?? '').trim()
  if (!wanted || !isSafeAssetName(wanted)) {
    // 文件名不合字符集 ⇒ 不猜、不拼 URL,交回下载页由页面自己给权威链接
    return toPage(request, 'bad-file')
  }
  const live = await resolveLiveDesktopFeed()
  if (live.source !== 'live') return toPage(request, 'feed-not-live')
  const tag = live.data.tag
  const asset = (live.data.assets ?? []).find((a) => assetNameFromHref(a.href) === wanted)
  if (!asset) return toPage(request, 'unknown-asset')

  const expected = Number(asset.sizeBytes ?? 0) > 0 ? Number(asset.sizeBytes) : null
  const { verdict } = await giteeByteParity(tag, wanted, expected)
  const picked = pickDesktopLeg({
    countryCode: visitorCountry(request),
    parity: verdict,
    originUrl: githubDownloadUrl(tag, wanted),
    cnUrl: giteeDownloadUrl(tag, wanted),
  })
  if (!picked) return toPage(request, 'no-leg')
  if (
    !isSafeNavigationTarget(picked.url, { allowedOrigins: [...RELEASE_TARGET_ALLOWED_ORIGINS] })
  ) {
    return toPage(request, 'origin-rejected')
  }
  const res = NextResponse.redirect(picked.url, 302)
  res.headers.set('Cache-Control', 'private, no-store')
  res.headers.set('X-Desktop-Leg', picked.leg)
  return res
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
