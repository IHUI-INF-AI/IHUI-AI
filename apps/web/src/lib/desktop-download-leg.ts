// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面安装包的「按访客地域选腿」判据(纯函数,零 IO)。
 *
 * 为什么要有这一格(2026-11-04 机主问"国内外是否各走最快的那条腿"时现读出来的):
 * 站点给桌面端只发**一条**腿 —— `desktop-feed-live.ts` 在字节等值成立时把资产 href 换成 Gitee 直链,
 * 而 GitHub Releases 才是原生 + 签名配对那一份。于是:国内是快的,但**海外访客被强制走 Gitee**
 * (通常更慢、大附件还可能限速),且 `sync-gitee.py` 那一步一旦断,桌面下载对所有人一起断,没有第二腿。
 *
 * 这里只回答"这一次点击该 302 去哪",不重造任何取数判据:
 *   · 两条腿的 URL 与"字节是否等值"都由 `config/desktop-feed-live.ts` 那一份实现给(§0.6 单一真相源);
 *   · 失败方向照该文件的原口径:**量不到字节 ⇒ 不选国内腿**(慢而正确 > 快而验不过);
 *   · 只有 `CN` 才走 Gitee,HK/MO/TW 与其它一律 GitHub —— 地域不是"我猜它在国内"的理由。
 */
import type { GiteeParity } from '../config/desktop-feed-live'

export type DesktopLeg = 'cn' | 'origin'

export interface PickedLeg {
  leg: DesktopLeg
  url: string
  /** 为什么选这条(给人看图/给日志用,不参与判定) */
  reason: string
}

/**
 * 回跳落点的 origin 白名单。本器只跳"发布资产自己的域名",绝不跳请求方给的地址
 * (⇒ 结构上没有开放重定向的输入面)。与门 278(`check-redirect-target-origin-pinned.mjs`)
 * 要求"调用点必须交出一份字面量落点集"同纪律 —— 这份清单必须是**字面量**,不得拼变量。
 */
export const RELEASE_TARGET_ALLOWED_ORIGINS: readonly string[] = [
  'https://gitee.com',
  'https://github.com',
  'https://objects.githubusercontent.com',
  'https://www.aizhs.top',
]

/** 资产文件名字符集白名单(含空格与中文一律拒;这是进 URL 的唯一一段用户可控文本) */
const ASSET_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._+ -]{0,159}$/

export function isSafeAssetName(name: string): boolean {
  const n = String(name ?? '')
  if (!ASSET_NAME_RE.test(n)) return false
  // 目录穿越与"看起来像 URL 的一部分"都不收
  return !n.includes('/') && !n.includes('\\') && !n.includes('..') && !n.includes(':')
}

export function originAllowed(url: string): boolean {
  try {
    return RELEASE_TARGET_ALLOWED_ORIGINS.includes(new URL(url).origin)
  } catch {
    return false
  }
}

/**
 * 选腿。**只看三样输入**:访客国家码、字节等值裁决、两条腿各自的 URL。
 * 任一条不满足"国内腿成立"的条件就退回 GitHub 权威腿;两条都没有 ⇒ null(调用方 404,不猜)。
 */
export function pickDesktopLeg(args: {
  countryCode: string | null | undefined
  parity: GiteeParity | null
  originUrl: string | null | undefined
  cnUrl: string | null | undefined
}): PickedLeg | null {
  const { countryCode, parity, originUrl, cnUrl } = args
  const cc = String(countryCode ?? '').trim().toUpperCase()
  const known = cc.length > 0
  const hasOrigin = typeof originUrl === 'string' && originUrl.length > 0 && originAllowed(originUrl)
  const hasCn = typeof cnUrl === 'string' && cnUrl.length > 0 && originAllowed(cnUrl)
  // 地域信号**取不到时不改变现状**:站点入口换过三层(Cloudflare 隧道 → EdgeOne → 自建节点直连),
  // `cf-ipcountry` 未必存在;把"没信号"读成"在海外"会让全部国内访客一夜之间退回 GitHub 直连,
  // 而这种劣化是静默的(页面照开、下载照成,只是慢)。失败方向:没信号 ⇒ 维持今天的国内腿。
  const abroadByGeo = known && cc !== 'CN'
  if (!abroadByGeo && parity === 'same' && hasCn) {
    return {
      leg: 'cn',
      url: cnUrl as string,
      reason: known
        ? '访客地域=CN ∧ Gitee 字节对账=same'
        : '无地域信号 ⇒ 保持现状(国内腿)∧ 字节对账=same',
    }
  }
  if (hasOrigin) {
    const why = abroadByGeo
      ? `访客地域=${cc} ⇒ 走权威 GitHub 腿`
      : parity === null
        ? '本轮没做字节对账 ⇒ 不选国内腿(§0.3 未判定不猜)'
        : `Gitee 字节对账=${parity} ⇒ 慢而正确优先于快而验不过`
    return { leg: 'origin', url: originUrl as string, reason: why }
  }
  if (hasCn) {
    return {
      leg: 'cn',
      url: cnUrl as string,
      reason: '权威 GitHub 腿本轮取不到 ⇒ 退回国内腿(如实降级,不 404)',
    }
  }
  return null
}

/** 从资产直链反解文件名(gitee 那份是 encodeURIComponent 形态,要先解回来再比对) */
export function assetNameFromHref(href: string): string {
  const last = String(href ?? '').split('/').pop() ?? ''
  try {
    return decodeURIComponent(last.split('?')[0])
  } catch {
    return last.split('?')[0]
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
