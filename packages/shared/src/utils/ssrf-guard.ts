// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SSRF 守卫 —— 出站 URL 的唯一判据源(2026-09-26 立)。
 *
 * 立因:第七/八轮机制取证发现「出站请求没有服务端侧 SSRF 防护」。实测锚点
 * `apps/cli/src/tools/fetch-url.ts` 只查 `http(s)://` 前缀,对内网 / 回环 /
 * 链路本地 / 云元数据地址零判据,且 `redirect: 'follow'` 让一次 302 就能把
 * 校验过的公网 URL 变成未校验的内网请求。
 *
 * 单一源头说明(不得再抄第二份):
 * - IP 字面量解析、CIDR 拒绝名单与网段归类(`parseIpAddress` / `isPrivateOrReservedIp` /
 *   `DENIED_CIDRS` / `IPV6_EMBEDDED_V4_PREFIXES`)的唯一实现 = `./ip-literal.ts`(2026-10-21 拆出:
 *   纯字符串 + 位运算、零 Node 内建,好让 Edge 运行时宿主能引它;本文件 import 后原样
 *   re-export,公开路径不变)。URL 裁决与 DNS 层(`assertSafeFetchUrl`)仍以本文件为唯一实现。
 * - `apps/api/src/utils/ssrf-guard.ts` 是同型的端内副本(用正则逐段判定),
 *   本票文件清单不含该端,故未在此收编;迁移方式见交付报告的「撞到但没动」。
 * - 票 G-1105310:IP 字面量归一化同样只有这一份出口(现居 `./ip-literal.ts`,经本文件
 *   re-export)—— `parseIpAddress` 给 `apps/cli/src/tools/fetch-url-egress.ts` 共用,该处
 *   原有的第二份 `::ffff:` 折叠 + `::` 补零解析副本已删(它只保留自己的公网 allow-list
 *   名单与谓词,解析数学只此一份)。
 *
 * 为什么用 CIDR 表而不是正则表:api 那份把「169.254 走 a===169&&b===254」「组播
 * 走 a>=224&&a<=239」这类逻辑硬编码在函数体里,新增一段保留网段要改判据本体;
 * 而「拒绝哪些网段」是数据,不是算法。改成 CIDR 字面量表后,新增网段 = 往
 * `DENIED_CIDRS` 加一行,同时那一行能被「名单正向证明对账」守门当成输入取证。
 */

import { lookup } from 'node:dns/promises'
import type { LookupAddress } from 'node:dns'

// 纯 IP 判据(解析 / CIDR 名单 / 网段归类)的实现源在 ./ip-literal.ts —— 那侧零 Node 内建,
// 好让 Edge 运行时宿主(next proxy/middleware)能直接引它而不把 node:dns 拖进构建图。
// 下面这段 re-export 是模块边界:公开路径不变、既有消费方一律不改,而实现只有一处。
// 不得在本文件另写第二份解析或名单(§0.6;搬运算器的反向锁已证逐字节同源)。
import { embeddedIpv4Of, isPrivateOrReservedIp, parseIpAddress } from './ip-literal'

export {
  DENIED_CIDRS,
  IPV6_EMBEDDED_V4_PREFIXES,
  type Ipv6EmbeddedV4Prefix,
  type ParsedIpAddress,
  isPrivateOrReservedIp,
  parseIpAddress,
} from './ip-literal'

/** 允许的协议(其余一律拒,含 file: / gopher: / dict: / data: 与自定义 scheme) */
export const ALLOWED_FETCH_PROTOCOLS = ['http:', 'https:'] as const

/** 拒发主机名(精确匹配,大小写不敏感) */
export const DENIED_HOST_NAMES = ['localhost', 'ip6-localhost', 'ip6-loopback', 'metadata'] as const

/** 回环主机名(仅供 D-1 自家端点信任判据;仍不等于「默认放行」) */
export const LOOPBACK_HOST_NAMES = ['localhost', 'ip6-localhost', 'ip6-loopback'] as const

/** D-1 可信任的回环网段:只有真正的 loopback(127/8、::1)才配得上「自家端点」 */
export const SELF_HOSTABLE_LOOPBACK_CIDRS = ['127.0.0.0/8', '::1/128'] as const

/** 信任来源档位。远端下发/SSE 回调不得声明;字符串顺序是测试锁定的对外契约。 */
export const SELF_HOSTED_TRUST_SOURCES = ['user-settings', 'user-env', 'code-default'] as const

/** 拒发主机名后缀(内网/服务发现常用域) */
export const DENIED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.internaldomain',
] as const

/** 拒绝原因的稳定枚举 —— 调用方按 code 分流,不得按 reason 文案判流程。 */
export type SsrfBlockCode =
  | 'empty-url'
  | 'invalid-url'
  | 'protocol-denied'
  | 'host-missing'
  | 'host-denied'
  | 'direct-ip-denied'
  | 'dns-failed'
  | 'no-address'
  | 'resolved-denied'

export interface SsrfDecision {
  readonly safe: boolean
  /** 不安全时的机器可读原因码 */
  readonly code?: SsrfBlockCode
  /** 被裁定的主机名(已去端口、去 IPv6 方括号、小写) */
  readonly host?: string
  /** 实际参与裁决的目标 IP 列表(DNS 解析结果;直连 IP 时即该 IP) */
  readonly resolvedIps?: readonly string[]
  /** 命中拒绝名单的那一个 IP / 主机名(用于错误信息定位,不含任何响应体) */
  readonly deniedTarget?: string
  /** 人读一句说明;只描述"为什么拒",绝不含响应体 / 凭据 */
  readonly reason?: string
  /** D-1:本次放行来自调用方声明的自家端点信任(默认放行不带此字段) */
  readonly trustedSelfHosted?: boolean
  /** D-1:信任来源档位(仅 trustedSelfHosted=true 时出现) */
  readonly trustSource?: (typeof SELF_HOSTED_TRUST_SOURCES)[number]
  /** D-1:声明了信任但没配上时,为什么不认(与 trustedSelfHosted 互斥) */
  readonly selfHostedDenied?: string
}

/** 主机名层面(未走 DNS 前)的拒绝判据 */
export function isDeniedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, '')
  if ((DENIED_HOST_NAMES as readonly string[]).includes(lower)) return true
  return DENIED_HOST_SUFFIXES.some((suffix) => lower.endsWith(suffix))
}

/** 是否真正的回环地址(127.0.0.0/8 与 ::1;IPv4-mapped 由 parseIpAddress 折回 v4)。 */
export function isLoopbackAddress(ip: string): boolean {
  const parsed = parseIpAddress(ip)
  if (!parsed) return false
  if (parsed.family === 4) return parsed.value >> 24n === 127n
  return parsed.value === 1n
}

function decision(block: Omit<SsrfDecision, 'safe'>): SsrfDecision {
  return { safe: false, ...block }
}

/**
 * 裁决一个「即将由我们自己发起」的 URL 是否可出站。
 *
 * 判序(每一条都对应一类真实绕过,顺序有意义):
 *  1. 协议白名单 —— 拦 `file://` / `gopher://` / 自定义 scheme
 *  2. 主机名黑名单 —— 拦 `localhost` / `*.internal`(有些环境 DNS 会把它解析成公网)
 *  3. 直连 IP —— 不查 DNS 直接判网段
 *  4. 域名先解析再逐 IP 判 —— 拦「域名指向内网」;解析失败按不安全处理(fail-closed)
 *
 * 注意:本函数**不**消除 DNS rebinding 的 TOCTOU 窗口 —— 校验与真正发连接之间
 * 记录仍可能被改。彻底闭合要把连接钉到已解析的 IP(undici 需自定义 connector),
 * 属另一票。调用方须配合「每跳重定向都重新过一次本函数」,那是真实存在的那一半攻击面。
 */
/**
 * 「这条出站 URL 出自用户自己写的配置」的声明。
 *
 * 为什么必须带基准(`configuredEndpoint`)而不是一个布尔:布尔只能表达"调用方说可以",
 * 而调用方会在 SSE 回调、重定向、元数据发现里把**远端下发的 URL** 也带进同一层 ——
 * 那正是 SSRF 的入口。基准把信任钉在"用户亲手配置的那一条端点"上,逐字匹配才生效。
 */
export interface SelfHostedTrust {
  /** 信任的来源种类;远端下发一律不得声明。 */
  readonly source: (typeof SELF_HOSTED_TRUST_SOURCES)[number]
  /** 人读定位:配置文件里的哪一条(如 `mcpServers[].url`) */
  readonly settingsKey: string
  /** 基准端点:同协议/主机/端口才享受信任;基准带具体路径时请求路径还须逐字相等 */
  readonly configuredEndpoint: string
}

export interface SsrfGuardOptions {
  readonly selfHosted?: SelfHostedTrust
}

/** 信任**永不**放行的主机名(云元数据服务与链路本地发现域) */
const NEVER_TRUSTED_HOST_NAMES = ['metadata', 'metadata.google.internal', 'instance-data'] as const

/** 169.254.0.0/16 —— 链路本地(含 IMDS 169.254.169.254),按 32 位数值域判 */
function isLinkLocalIpv4Value(value: bigint): boolean {
  return value >> 16n === 0xa9fen
}

/**
 * 信任永不放行的网段:链路本地(含 IMDS 169.254.169.254)与 IPv6 链路本地/唯一本地。
 *
 * 取值一律经 `parseIpAddress` 那**一份**解析器(旧写法在此处自己调 `parseIpv4ToNumber` +
 * `parseIpv6ToBigInt` 两遍,等于同一件事的第二处解析 —— 于是它既看不见 `::ffff:` 折档,
 * 也看不见本票新增的 6to4 / DNS64 嵌入档:`64:ff9b::a9fe:a9fe`(= 经 NAT64 打 IMDS)
 * 会被信任层放行。`fc00::/7` 与 `fe80::/10` 的原有结论逐字保持。)
 */
function isNeverTrustedAddress(text: string): boolean {
  const parsed = parseIpAddress(text)
  if (!parsed) return false
  if (parsed.family === 4) return isLinkLocalIpv4Value(parsed.value)
  const top = Number(parsed.value >> 112n)
  // fe80::/10 链路本地、fc00::/7 唯一本地(私网性质,自配端点无需它)
  if ((top & 0xffc0) === 0xfe80 || (top & 0xfe00) === 0xfc00) return true
  // 带嵌入 IPv4 的那一族:嵌进来的若是链路本地,同样永不放行
  const embedded = embeddedIpv4Of(parsed)
  return embedded !== null && isLinkLocalIpv4Value(embedded)
}

function isNeverTrustedHostname(host: string): boolean {
  return (NEVER_TRUSTED_HOST_NAMES as readonly string[]).includes(host)
}

/** URL 的 origin(协议 + 主机 + 端口);D-1 只信任同一条自家端点,不按路径放宽。 */
function originOf(u: URL): string {
  const host = u.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1')
  const port = u.port || (u.protocol === 'https:' ? '443' : '80')
  return `${u.protocol}//${host}:${port}`
}

/**
 * 请求 URL 是否与用户自配的基准端点同一条。
 *
 * 基准是 origin 根(无路径或 `/`)⇒ 视为该 origin 的基址,同 origin 的任意路径都算;
 * 基准带具体路径 ⇒ 请求路径必须逐字相等(旧 `/mcp` 配 `/admin` 仍拒)。
 */
function endpointMatches(requestUrl: string, configuredEndpoint: string): boolean {
  try {
    const request = new URL(requestUrl)
    const base = new URL(configuredEndpoint)
    if (originOf(request) !== originOf(base)) return false
    const basePath = base.pathname === '' ? '/' : base.pathname
    if (basePath === '/') return true
    return (request.pathname === '' ? '/' : request.pathname) === basePath
  } catch {
    return false
  }
}

export interface SelfHostedLoopbackMatch {
  readonly matched: boolean
  readonly reason?: string
}

/**
 * D-1 的唯一信任判据:只有「声明基准是回环地址」且「请求与基准同 origin」才认。
 *
 * 为什么单列一个出口:调用方(CLI 工具层)与守卫层必须用同一把尺子;信任档位、
 * 配置键出处、基准端点三项缺一即不认,远端下发/SSE 回调永远不会走到这里。
 */
export function selfHostedLoopbackMatch(
  endpoint: string,
  trust?: SelfHostedTrust,
): SelfHostedLoopbackMatch {
  if (!trust) return { matched: false, reason: '没有信任声明' }
  if (!(SELF_HOSTED_TRUST_SOURCES as readonly string[]).includes(trust.source)) {
    return { matched: false, reason: '信任档位不在枚举内' }
  }
  if (typeof trust.settingsKey !== 'string' || !trust.settingsKey.trim()) {
    return { matched: false, reason: '缺少配置键出处(settingsKey)' }
  }
  if (typeof trust.configuredEndpoint !== 'string' || !trust.configuredEndpoint.trim()) {
    return { matched: false, reason: '缺少基准端点(configuredEndpoint)' }
  }
  let requestUrl: URL
  let baseUrl: URL
  try {
    requestUrl = new URL(endpoint)
    baseUrl = new URL(trust.configuredEndpoint)
  } catch {
    return { matched: false, reason: '端点 URL 解析失败' }
  }
  const hostOf = (u: URL) => u.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1')
  const isLoop = (h: string) =>
    isLoopbackAddress(h) || (LOOPBACK_HOST_NAMES as readonly string[]).includes(h)
  if (!isLoop(hostOf(requestUrl)) || !isLoop(hostOf(baseUrl))) {
    return { matched: false, reason: `声明的端点 ${hostOf(baseUrl)} 不是回环地址` }
  }
  if (originOf(requestUrl) !== originOf(baseUrl)) {
    return {
      matched: false,
      reason: `请求 origin ${originOf(requestUrl)} ≠ 声明 origin ${originOf(baseUrl)}`,
    }
  }
  const basePath = baseUrl.pathname === '' ? '/' : baseUrl.pathname
  const requestPath = requestUrl.pathname === '' ? '/' : requestUrl.pathname
  if (!endpointMatches(endpoint, trust.configuredEndpoint)) {
    return { matched: false, reason: `请求路径 ${requestPath} ≠ 声明路径 ${basePath}` }
  }
  return { matched: true }
}

export async function assertSafeFetchUrl(
  rawUrl: string,
  options?: SsrfGuardOptions,
): Promise<SsrfDecision> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return decision({ code: 'empty-url', reason: 'URL 为空' })
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return decision({ code: 'invalid-url', reason: 'URL 格式非法' })
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1')

  /**
   * 信任能否覆盖这一目标。三个条件同时成立才放行,缺任一即回落原判定:
   * ① 调用方显式声明了 user-settings 来源;② 请求 URL 与自配基准端点逐字同条;
   * ③ 目标不在"永不放行"集(元数据主机名 / 链路本地与唯一本地地址)。
   */
  const trust = options?.selfHosted
  const trustMatch = trust ? selfHostedLoopbackMatch(rawUrl, trust) : null
  const trustedFor = (targetHost: string, address?: string): boolean => {
    if (!trust || !trustMatch?.matched) return false
    if (isNeverTrustedHostname(targetHost)) return false
    if (isNeverTrustedAddress(targetHost)) return false
    if (address && address !== targetHost && isNeverTrustedAddress(address)) return false
    return true
  }
  const allowTrusted = (block: Omit<SsrfDecision, 'safe'>): SsrfDecision => ({
    safe: true,
    ...block,
    trustedSelfHosted: true,
    trustSource: trust?.source,
  })
  if (!(ALLOWED_FETCH_PROTOCOLS as readonly string[]).includes(parsed.protocol)) {
    return decision({
      code: 'protocol-denied',
      host,
      reason: `协议 ${parsed.protocol} 不在白名单内`,
    })
  }
  if (!host) {
    return decision({ code: 'host-missing', reason: 'URL 无主机名' })
  }
  if (isDeniedHostname(host)) {
    if (trustedFor(host)) return allowTrusted({ host })
    return decision({
      code: 'host-denied',
      host,
      deniedTarget: host,
      reason: '主机名在拒绝名单内',
      selfHostedDenied: trustMatch?.reason,
    })
  }

  const directIp = parseIpAddress(host)
  if (directIp) {
    if (isPrivateOrReservedIp(host)) {
      if (trustedFor(host, host)) return allowTrusted({ host, resolvedIps: [host] })
      return decision({
        code: 'direct-ip-denied',
        host,
        resolvedIps: [host],
        deniedTarget: host,
        reason: `直连地址 ${host} 属于内网/保留网段`,
        selfHostedDenied: trustMatch?.reason,
      })
    }
    return { safe: true, host, resolvedIps: [host] }
  }

  let records: LookupAddress[]
  try {
    records = await lookup(host, { all: true, verbatim: true })
  } catch {
    return decision({ code: 'dns-failed', host, reason: `域名 ${host} 解析失败,按不安全处理` })
  }

  const ips = records.map((record) => record.address)
  if (ips.length === 0) {
    return decision({ code: 'no-address', host, reason: `域名 ${host} 无可用地址记录` })
  }
  const hit = ips.find((ip) => isPrivateOrReservedIp(ip))
  if (hit) {
    if (trustedFor(host, hit)) return allowTrusted({ host, resolvedIps: ips })
    return decision({
      code: 'resolved-denied',
      host,
      resolvedIps: ips,
      deniedTarget: hit,
      reason: `域名 ${host} 解析到内网/保留地址 ${hit}`,
      selfHostedDenied: trustMatch?.reason,
    })
  }

  return { safe: true, host, resolvedIps: ips }
}

/**
 * 结构化拒绝信息 —— 给工具层直接当 `error` 用。
 *
 * 只落 host / 解析到的 IP / 原因码,**不接任何响应体**:本仓守门 67
 * (`check-credential-leak-in-message.mjs`)管的就是"把上游响应倒进 error message"
 * 这条脱敏旁路,这里从形态上就不给它命中机会。
 */
export function formatSsrfRejection(verdict: SsrfDecision): string {
  const parts = [`SSRF 拒绝(${verdict.code ?? 'unknown'}):${verdict.reason ?? '目标不安全'}`]
  if (verdict.host) parts.push(`host=${verdict.host}`)
  if (verdict.deniedTarget) parts.push(`denied=${verdict.deniedTarget}`)
  if (verdict.resolvedIps && verdict.resolvedIps.length > 0) {
    parts.push(`resolved=${verdict.resolvedIps.join(',')}`)
  }
  return parts.join(' ')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
