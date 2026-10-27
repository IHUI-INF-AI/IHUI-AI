// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 登录呈现地区判定 —— 「这个请求来自国内还是海外」的唯一出口。
 *
 * 消费者只有登录 UI 的呈现优先级(国内把微信扫码排第一,海外把邮箱 + Google/GitHub
 * 排第一)。这条判据**不得接入任何鉴权、限流、风控判定**:它的两个输入里
 * `CF-IPCountry` 是客户端可自带伪造的请求头(浏览器直连源站时同样会透传),
 * GeoIP 腿会因代理/VPN/IDC 出口而失真。呈现排错了没有代价,鉴权排错了是漏洞。
 *
 * 判序(任一环给出明确答复即终止;全部判不出 ⇒ null「未判定」,不猜):
 *   1. `CF-IPCountry` —— 经 Cloudflare(隧道或 CDN)进来的每条请求,CF 边缘都会注入
 *      两位国家码。零网络、零外部账号,是这里最便宜也最准的一腿。`XX` 是 CF 自己的
 *      「未知」哨兵值,不当成国家码用。
 *   2. GeoIP —— 本地 GeoLite2 mmdb(装了才生效)→ ip-api.com 远程降级。
 *      本机实测 2026-10-26:`apps/api/data/*.mmdb` 不存在、`maxmind` 未安装,故当前
 *      实际走 ip-api 腿(直连可达,590ms,免费版 45 req/min)。因此本层自带一份
 *      按 IP 的长 TTL 结果缓存,把「每次打开登录页一次远程查询」压成「每 IP 6 小时一次」;
 *      限流撞穿时落 null,由调用方按「未判定」处理。
 *   3. null —— 回环/内网 IP 不查远程(查不到也没意义),公网查不到同归此类。
 *      失效方向是「让调用方用更粗的判据(界面语言)兜底」,绝不是「默认当成海外」
 *      或「默认当成国内」—— 猜错方向会把微信扫码或 Google 按钮从用户面前挪走。
 */
import type { FastifyRequest } from 'fastify'

import { getGeoIpService } from './geoip.js'
import { isLoopbackOrInternalIp } from '../utils/code-echo-guard.js'

/** 登录呈现地区。值域即 HTTP 契约,前端只认这两个字面量,不再复算「哪个国家算国内」。 */
export type LoginRegion = 'domestic' | 'overseas'

/** 判定来源,用于线上取证(哪一腿真在起作用);'undetermined' = 整链判不出。 */
export type LoginRegionSource = 'cf-ipcountry' | 'geoip' | 'undetermined'

export interface LoginRegionVerdict {
  region: LoginRegion | null
  source: LoginRegionSource
}

/** 计为国家/地区码的两字母形态;其余(空串、国名全称、超长脏值)一律视为没给。 */
const COUNTRY_CODE_RE = /^[A-Z]{2}$/

/**
 * 形态像国家码、但不是任何国家的「未知」哨兵(Cloudflare 用 `XX` 表示判不出)。
 * 不在此挡掉,它会顺着下面「非 CN 即海外」被读成海外 —— 把「判不出」当成「判得出」
 * 是这条判据最贵的失效方向:访客会收到一套与自己无关的登录方式,而账面看不出异常。
 */
const UNKNOWN_COUNTRY_CODES: ReadonlySet<string> = new Set(['XX'])

/** 算「国内」的国家码集合。 */
const DOMESTIC_COUNTRY_CODES: ReadonlySet<string> = new Set(['CN'])

/**
 * 结果缓存 TTL。取 6 小时:登录页可能反复打开,而 IP→国家的映射对同一访客在
 * 一次会话内不会变;6 小时也保证了跨城出差/换网络最迟半天后重新判。
 * null 同样缓存 —— 判不出的 IP 反复重试只会更快撞穿 ip-api 的 45 req/min。
 */
const VERDICT_TTL_MS = 6 * 60 * 60 * 1000
const verdictCache = new Map<string, { verdict: LoginRegionVerdict; expiry: number }>()
/** 缓存条目上限:超出即整体丢弃(登录页是公网高频入口,不能无界增长)。 */
const VERDICT_CACHE_MAX = 50_000

export function countryToRegion(countryCode: string): LoginRegion | null {
  const code = countryCode.toUpperCase()
  if (!COUNTRY_CODE_RE.test(code)) return null
  if (UNKNOWN_COUNTRY_CODES.has(code)) return null
  return DOMESTIC_COUNTRY_CODES.has(code) ? 'domestic' : 'overseas'
}

function cached(ip: string): LoginRegionVerdict | null {
  const hit = verdictCache.get(ip)
  if (!hit) return null
  if (hit.expiry <= Date.now()) {
    verdictCache.delete(ip)
    return null
  }
  return hit.verdict
}

function remember(ip: string, verdict: LoginRegionVerdict): void {
  if (verdictCache.size >= VERDICT_CACHE_MAX) verdictCache.clear()
  verdictCache.set(ip, { verdict, expiry: Date.now() + VERDICT_TTL_MS })
}

/**
 * 按请求来源 IP 判定登录呈现地区。
 *
 * 用 `request.ip` 而不是手读 `x-forwarded-for`:Fastify 已按 server.ts 的
 * `TRUSTED_PROXIES` 白名单解出真实来源,手读 XFF 会把客户端自报的地址当事实。
 */
export async function resolveLoginRegion(
  request: Pick<FastifyRequest, 'headers' | 'ip'>,
): Promise<LoginRegionVerdict> {
  const fromCf = request.headers['cf-ipcountry']
  const cfCode = typeof fromCf === 'string' ? fromCf.trim().toUpperCase() : ''
  const cfRegion = countryToRegion(cfCode)
  if (cfRegion) return { region: cfRegion, source: 'cf-ipcountry' }

  const ip = request.ip
  // 回环/内网:GeoIP 查不到,且本机/局域网访问本就不该被算成某个国家。
  if (isLoopbackOrInternalIp(ip)) return { region: null, source: 'undetermined' }

  const hit = cached(ip)
  if (hit) return hit

  let verdict: LoginRegionVerdict = { region: null, source: 'undetermined' }
  try {
    const location = await getGeoIpService().lookup(ip)
    const region = location?.countryCode ? countryToRegion(location.countryCode) : null
    if (region) verdict = { region, source: 'geoip' }
  } catch {
    // 远程腿超时/报错 ⇒ 未判定。不记绿也不冒红,交给调用方的兜底判据。
  }
  remember(ip, verdict)
  return verdict
}

export const __test__ = {
  countryToRegion,
  resolveLoginRegion,
  clearVerdictCache: (): void => {
    verdictCache.clear()
  },
  verdictCacheSize: (): number => verdictCache.size,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
