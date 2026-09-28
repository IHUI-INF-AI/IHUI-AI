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
 * - 本文件是 IP 分类与 URL 裁决的**唯一**实现。
 * - `apps/api/src/utils/ssrf-guard.ts` 是同型的端内副本(用正则逐段判定),
 *   本票文件清单不含该端,故未在此收编;迁移方式见交付报告的「撞到但没动」。
 *
 * 为什么用 CIDR 表而不是正则表:api 那份把「169.254 走 a===169&&b===254」「组播
 * 走 a>=224&&a<=239」这类逻辑硬编码在函数体里,新增一段保留网段要改判据本体;
 * 而「拒绝哪些网段」是数据,不是算法。改成 CIDR 字面量表后,新增网段 = 往
 * `DENIED_CIDRS` 加一行,同时那一行能被「名单正向证明对账」守门当成输入取证。
 */

import { lookup } from 'node:dns/promises'
import type { LookupAddress } from 'node:dns'

/** 允许的协议(其余一律拒,含 file: / gopher: / dict: / data: 与自定义 scheme) */
export const ALLOWED_FETCH_PROTOCOLS = ['http:', 'https:'] as const

/**
 * 拒发网段名单(CIDR,IPv4 与 IPv6 混列)。
 * 每一行都必须被测试当作**输入**用过至少一次 —— 由
 * `scripts/check-list-predicate-has-positive-proof.mjs` 对账,防止名单腐烂成死表。
 */
export const DENIED_CIDRS = [
  '0.0.0.0/8', // "本机"网络(current-node)
  '10.0.0.0/8', // 私网 A
  '100.64.0.0/10', // CGNAT(运营商级 NAT,Tailscale/部分云内网走这)
  '127.0.0.0/8', // 回环
  '169.254.0.0/16', // 链路本地 —— 含云厂商元数据端点 169.254.169.254
  '172.16.0.0/12', // 私网 B
  '192.0.0.0/24', // IETF 协议分配
  '192.168.0.0/16', // 私网 C
  '198.18.0.0/15', // 基准测试
  '224.0.0.0/4', // 组播
  '240.0.0.0/4', // 保留(含 255.255.255.255 受限广播)
  '::/128', // IPv6 未指定
  '::1/128', // IPv6 回环
  '100::/64', // Discard-Only(RFC 6666)—— 不是内网而是黑洞,判它属"特殊用途不可达"档
  '2001:db8::/32', // 文档段(RFC 3849),不得出现在真实出站上
  '64:ff9b:1::/48', // 本地使用 DNS64 前缀(RFC 8215 §3:非全局可路由),整段拒
  'fc00::/7', // IPv6 唯一本地地址(ULA)
  'fe80::/10', // IPv6 链路本地
  'ff00::/8', // IPv6 组播
] as const

/**
 * 把 IPv4 嵌进 IPv6 的那一族前缀(6to4 / 全局 DNS64)—— **不**并进 `DENIED_CIDRS` 的原因:
 *
 * 那张表只会"整段前缀拒",而这一族里 `2002:0808:0808::`(= 8.8.8.8)与
 * `64:ff9b::808:808`(= 同一个 8.8.8.8 经 NAT64)都是**真实公网目的**。按前缀名一律拒
 * 就是本仓纪律明令禁止的"新增会误杀真实公网地址的判据"。所以这一族的判法是:
 * 把嵌进来的那个 IPv4 取出来,再走一遍既有的 v4 拒绝网段 —— 于是
 * `2002:7f00:0001::`(= 127.0.0.1)与 `64:ff9b::a9fe:a9fe`(= 169.254.169.254,IMDS)
 * 被同一条 v4 名单认出,而公网那两条照旧放行。
 *
 * 位序只取有 RFC 明文依据的两档:
 *  - 6to4:RFC 3056 —— 第 2、3 组(即自最高位起第 16 位开始的 32 位)就是嵌入的 IPv4。
 *  - DNS64:RFC 6052 p=96 —— 低 32 位就是嵌入的 IPv4。
 * `64:ff9b:1::/48`(RFC 8215 本地使用档)**刻意不在这里**:它整段不可全局路由,没有任何
 * 公网目的住在里面,故按上面的 `DENIED_CIDRS` 前缀拒即可;而 RFC 6052 p=48 的嵌入位序本文件
 * 未曾取证,**不猜位序** —— 宁可按前缀整段拒,也不要按一个记错的偏移去切地址。
 */
export interface Ipv6EmbeddedV4Prefix {
  /** CIDR 字面量(与 `DENIED_CIDRS` 同一份解析器解析) */
  readonly cidr: string
  /** 嵌入 IPv4 的起始位偏移(自地址最高位数),故该 IPv4 占 bits [offset, offset+32) */
  readonly v4BitOffset: number
  readonly label: string
}

/**
 * 每一行都必须被测试当作**输入**用过至少一次(同 `DENIED_CIDRS` 的义务,守门 120 对账)。
 */
export const IPV6_EMBEDDED_V4_PREFIXES = [
  { cidr: '2002::/16', v4BitOffset: 16, label: '6to4(RFC 3056)' },
  { cidr: '64:ff9b::/96', v4BitOffset: 96, label: 'DNS64 全局前缀(RFC 6052 p=96)' },
] as const

/** 拒发主机名(精确匹配,大小写不敏感) */
export const DENIED_HOST_NAMES = ['localhost', 'ip6-localhost', 'ip6-loopback', 'metadata'] as const

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
}

function parseIpv4ToNumber(text: string): number | null {
  const octets = text.split('.')
  if (octets.length !== 4) return null
  let value = 0
  for (const octet of octets) {
    if (!/^\d{1,3}$/.test(octet)) return null
    const n = Number(octet)
    if (n > 255) return null
    value = value * 256 + n
  }
  return value
}

/** IPv6 → 128 位 BigInt;不支持 / 非法返回 null。容忍 `::` 压缩、尾部点分四段、`%zone`。 */
function parseIpv6ToBigInt(text: string): bigint | null {
  let s = text.toLowerCase()
  const zone = s.indexOf('%')
  if (zone >= 0) s = s.slice(0, zone)

  // 尾部点分四段(::ffff:192.168.0.1)先折算成两个 16 位分组,再走常规解析
  if (s.includes('.')) {
    const lastColon = s.lastIndexOf(':')
    if (lastColon < 0) return null
    const v4 = parseIpv4ToNumber(s.slice(lastColon + 1))
    if (v4 === null) return null
    const hi = Math.floor(v4 / 65536)
    const lo = v4 % 65536
    s = `${s.slice(0, lastColon + 1)}${hi.toString(16)}:${lo.toString(16)}`
  }

  const halves = s.split('::')
  if (halves.length > 2) return null
  const toGroups = (segment: string): string[] | null => {
    if (segment === '') return []
    const raw = segment.split(':')
    if (raw.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null
    return raw
  }

  if (halves.length === 1) {
    const groups = toGroups(s)
    if (!groups || groups.length !== 8) return null
    return groupsToBigInt(groups)
  }

  const left = toGroups(halves[0] ?? '')
  const right = toGroups(halves[1] ?? '')
  if (!left || !right) return null
  const fill = 8 - left.length - right.length
  if (fill < 0) return null
  return groupsToBigInt([...left, ...Array.from({ length: fill }, () => '0'), ...right])
}

function groupsToBigInt(groups: readonly string[]): bigint {
  let value = 0n
  for (const group of groups) value = (value << 16n) | BigInt(parseInt(group, 16))
  return value
}

type ParsedIp = { family: 4; value: bigint } | { family: 6; value: bigint }

/** 归一化:IPv4-mapped IPv6(`::ffff:a.b.c.d`)折回 IPv4,让 v4 名单对它同样生效。 */
function parseIp(text: string): ParsedIp | null {
  const raw = text.trim().replace(/^\[(.*)\]$/, '$1')
  const v4 = parseIpv4ToNumber(raw)
  if (v4 !== null) return { family: 4, value: BigInt(v4) }
  const v6 = parseIpv6ToBigInt(raw)
  if (v6 === null) return null
  // ::ffff:0:0/96 → 取低 32 位按 IPv4 判
  if (v6 >> 32n === 0xffffn) return { family: 4, value: v6 & 0xffffffffn }
  return { family: 6, value: v6 }
}

function parseCidr(cidr: string): { family: 4 | 6; base: bigint; mask: bigint } | null {
  const slash = cidr.indexOf('/')
  if (slash < 0) return null
  const host = cidr.slice(0, slash)
  const bits = Number(cidr.slice(slash + 1))
  const parsed = parseIp(host)
  if (!parsed) return null
  const width = parsed.family === 4 ? 32 : 128
  if (!Number.isInteger(bits) || bits < 0 || bits > width) return null
  const mask = bits === 0 ? 0n : ((1n << BigInt(bits)) - 1n) << BigInt(width - bits)
  return { family: parsed.family, base: parsed.value & mask, mask }
}

type IpRange = { family: 4 | 6; base: bigint; mask: bigint }

/**
 * 预编译后的 CIDR 表(循环装配而非 `.filter(谓词)` —— 后者在 `as const` 名单上会因
 * 字面量类型与宽化后的谓词类型互相不可赋值而报 TS2677,判据本身没有区别)。
 */
const DENIED_RANGES: readonly { cidr: string; range: IpRange }[] = (() => {
  const rows: { cidr: string; range: IpRange }[] = []
  for (const cidr of DENIED_CIDRS) {
    const range = parseCidr(cidr)
    if (range !== null) rows.push({ cidr, range })
  }
  return rows
})()

/** 命中某条 CIDR —— 循环体只此一份,`isPrivateOrReservedIp` 与嵌入 v4 复检共用,勿再抄第三遍。 */
function hitsRange(value: bigint, family: 4 | 6, range: IpRange): boolean {
  return range.family === family && (value & range.mask) === range.base
}

/** 该 32 位值(纯数字域的 IPv4)是否落在 v4 拒绝网段里。 */
function isDeniedIpv4Value(value: bigint): boolean {
  return DENIED_RANGES.some(({ range }) => hitsRange(value, 4, range))
}

/**
 * 「IPv4 嵌在 IPv6 里」那两族的 CIDR 预编译(与 `DENIED_RANGES` 共用同一份 `parseCidr`)。
 * 某行解析不到就会被跳过,而"这一行真在生效"不靠本文件自证,由
 * `__tests__/ssrf-guard.test.ts` 里逐条成对的 denied/allowed 样本证明
 * (名单类判据的正向证明义务,守门 120 同族)。
 */
const EMBEDDED_V4_RANGES: readonly { entry: Ipv6EmbeddedV4Prefix; range: IpRange }[] = (() => {
  const rows: { entry: Ipv6EmbeddedV4Prefix; range: IpRange }[] = []
  for (const entry of IPV6_EMBEDDED_V4_PREFIXES) {
    const range = parseCidr(entry.cidr)
    if (range !== null) rows.push({ entry, range })
  }
  return rows
})()

/**
 * 若该地址属于"带嵌入 IPv4"的那一族,返回被嵌进来的那个 32 位值;否则 null。
 * 只在 family 6 上取(family 4 已在原值上判过;而 `::ffff:0:0/96` 由 `parseIp`
 * 折回 family 4,结构上不会到这里 —— 那是既有行为,本函数不重复它)。
 */
function embeddedIpv4Of(parsed: ParsedIp): bigint | null {
  if (parsed.family !== 6) return null
  for (const { entry, range } of EMBEDDED_V4_RANGES) {
    if (!hitsRange(parsed.value, 6, range)) continue
    const shift = BigInt(128 - entry.v4BitOffset - 32)
    return (parsed.value >> shift) & 0xffffffffn
  }
  return null
}

/** 与 api 端内副本同名同语义,便于将来该端直接 re-export 本实现。 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const parsed = parseIp(ip)
  if (!parsed) return true // 解析不出来的形态一律按危险处理(fail-closed)
  if (DENIED_RANGES.some(({ range }) => hitsRange(parsed.value, parsed.family, range))) return true
  // 6to4 / 全局 DNS64:按"嵌进来的那个 v4"判,而不是按前缀名整段拒(见 IPV6_EMBEDDED_V4_PREFIXES)
  const embedded = embeddedIpv4Of(parsed)
  if (embedded !== null) return isDeniedIpv4Value(embedded)
  return false
}

/** 主机名层面(未走 DNS 前)的拒绝判据 */
export function isDeniedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, '')
  if ((DENIED_HOST_NAMES as readonly string[]).includes(lower)) return true
  return DENIED_HOST_SUFFIXES.some((suffix) => lower.endsWith(suffix))
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
  /** 信任的来源种类;当前只有用户配置文件一档(远端下发一律不得声明) */
  readonly source: 'user-settings'
  /** 人读定位:配置文件里的哪一条(如 `mcpServers[].url`) */
  readonly settingsKey: string
  /** 基准端点:只有与它同协议/主机/端口/路径的请求 URL 才享受信任 */
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
 * 取值一律经 `parseIp` 那**一份**解析器(旧写法在此处自己调 `parseIpv4ToNumber` +
 * `parseIpv6ToBigInt` 两遍,等于同一件事的第二处解析 —— 于是它既看不见 `::ffff:` 折档,
 * 也看不见本票新增的 6to4 / DNS64 嵌入档:`64:ff9b::a9fe:a9fe`(= 经 NAT64 打 IMDS)
 * 会被信任层放行。`fc00::/7` 与 `fe80::/10` 的原有结论逐字保持。)
 */
function isNeverTrustedAddress(text: string): boolean {
  const parsed = parseIp(text)
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

/** 请求 URL 是否与用户自配的基准端点同一条(协议/主机/端口/路径逐项等值,忽略 query 与 hash) */
function endpointMatches(requestUrl: string, configuredEndpoint: string): boolean {
  let a: URL
  let b: URL
  try {
    a = new URL(requestUrl)
    b = new URL(configuredEndpoint)
  } catch {
    return false
  }
  const normHost = (u: URL) => u.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1')
  const portOf = (u: URL) => u.port || (u.protocol === 'https:' ? '443' : '80')
  const pathOf = (u: URL) => (u.pathname === '' ? '/' : u.pathname)
  return (
    a.protocol === b.protocol &&
    normHost(a) === normHost(b) &&
    portOf(a) === portOf(b) &&
    pathOf(a) === pathOf(b)
  )
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
  const trustedFor = (targetHost: string, address?: string): boolean => {
    const trust = options?.selfHosted
    if (!trust || trust.source !== 'user-settings') return false
    if (typeof trust.configuredEndpoint !== 'string' || !trust.configuredEndpoint.trim())
      return false
    if (!endpointMatches(rawUrl, trust.configuredEndpoint)) return false
    if (isNeverTrustedHostname(targetHost)) return false
    if (isNeverTrustedAddress(targetHost)) return false
    if (address && address !== targetHost && isNeverTrustedAddress(address)) return false
    return true
  }
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
    if (trustedFor(host)) return { safe: true, host }
    return decision({ code: 'host-denied', host, deniedTarget: host, reason: '主机名在拒绝名单内' })
  }

  const directIp = parseIp(host)
  if (directIp) {
    if (isPrivateOrReservedIp(host)) {
      if (trustedFor(host, host)) return { safe: true, host, resolvedIps: [host] }
      return decision({
        code: 'direct-ip-denied',
        host,
        resolvedIps: [host],
        deniedTarget: host,
        reason: `直连地址 ${host} 属于内网/保留网段`,
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
    if (trustedFor(host, hit)) return { safe: true, host, resolvedIps: ips }
    return decision({
      code: 'resolved-denied',
      host,
      resolvedIps: ips,
      deniedTarget: hit,
      reason: `域名 ${host} 解析到内网/保留地址 ${hit}`,
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
