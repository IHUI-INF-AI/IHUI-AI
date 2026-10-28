// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SSRF 防护工具(2026-08-02 立)。
 * 统一校验用户可控 URL,拒绝内网/保留地址访问。
 * 抽取自 ai-feed-service.ts 的 isPrivateOrReservedIp + proxyImage 防护逻辑。
 */
import { lookup } from 'node:dns/promises'
import { networkInterfaces } from 'node:os'

const PRIVATE_IP_PATTERNS = [
  /^127\./, // loopback v4
  /^10\./, // private A
  /^172\.(1[6-9]|2\d|3[01])\./, // private B
  /^192\.168\./, // private C
  /^169\.254\./, // link-local
  /^0\./, // current network
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT
  /^192\.0\.0\./, // IETF protocol assignments
  /^198\.(1[8-9])\./, // benchmarking
  /^::1$/, // loopback v6
  /^fc00:/, // unique local v6
  /^fe80:/, // link-local v6
  /^::$/, // unspecified v6
  /^::ffff:/, // v4-mapped v6(需检查内嵌的 v4)
]

/**
 * URL 的 hostname 对 IPv6 字面量带方括号(`http://[::1]:8000` → hostname = `[::1]`)。
 * 不剥掉这两层括号,后面所有 `startsWith('fe80:')` / `=== '::1'` 形态判定全部落空 ——
 * 实测这曾让 `[::1]` 与 `[fe80::1]` 在**默认档**就穿过守卫(2026-10-28 补)。
 */
function normalizeIpLiteral(raw: string): string {
  return raw.replace(/^\[/, '').replace(/\]$/, '')
}

/**
 * 从 IPv6 字面量里取出**内嵌的 IPv4**。
 *
 * 覆盖三型实测形态（`new URL()` 会把点分写成十六进制段，前缀匹配一律落空）：
 *  - `::ffff:127.0.0.1`（点分尾巴）
 *  - `::ffff:7f00:1`（URL 规范化后的 v4-mapped，等价 127.0.0.1）
 *  - `::7f00:1`（v4-compatible，同样等价 127.0.0.1）
 * 取出来之后按 IPv4 逐段判族，元数据/回环/本机就无处藏。
 *
 * 已知残余（不在本轮范围，写破不装看不见）：6to4 `2002::/16` 与 NAT64 `64:ff9b::/96`
 * 也能承载 IPv4 字面量，但二者都需要外部路由/前缀才可达，应用侧 SSRF 打不到；
 * 真要覆盖得做完整 v6→字节展开，届时也只改本函数一处。
 */
function embeddedIpv4FromV6(lower: string): string | null {
  const dotted = lower.match(/^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/i)
  if (dotted?.[1]) return dotted[1]
  const hex = lower.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (!hex?.[1] || !hex[2]) return null
  const hi = Number.parseInt(hex[1], 16)
  const lo = Number.parseInt(hex[2], 16)
  if (!Number.isFinite(hi) || !Number.isFinite(lo) || hi > 0xffff || lo > 0xffff) return null
  return [(hi >> 8) & 255, hi & 255, (lo >> 8) & 255, lo & 255].join('.')
}

/** 守卫侧的目标归一：剥 IPv6 方括号 → 小写 → 提出内嵌 IPv4。两个判据函数共用（§0.6）。 */
function normalizeGuardTarget(raw: string): string {
  const stripped = normalizeIpLiteral(raw).toLowerCase()
  return embeddedIpv4FromV6(stripped) ?? stripped
}

/** 检查 IP 是否为内网/保留地址 */
export function isPrivateOrReservedIp(ip: string): boolean {
  // 处理 IPv4-mapped IPv6 (::ffff:x.x.x.x)
  const normalizedIp = normalizeGuardTarget(ip)
  // IPv4 数字格式逐段判定(更精确,与 ai-feed-service.ts 行为一致)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalizedIp)) {
    const parts = normalizedIp.split('.').map(Number)
    if (parts.length !== 4 || parts.some((p) => p < 0 || p > 255)) return true
    const [a, b] = parts as [number, number, number, number]
    if (a === 0) return true // 0.0.0.0/8
    if (a === 10) return true // 10.0.0.0/8
    if (a === 127) return true // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local(含云元数据)
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
    if (a === 192 && b === 168) return true // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGN
    if (a >= 224 && a <= 239) return true // 224.0.0.0/4 multicast
    return false
  }
  // 正则兜底(覆盖 IPv6 简写 / 主机名形式)
  if (PRIVATE_IP_PATTERNS.some((p) => p.test(normalizedIp))) return true
  // IPv6 链路本地 fe80::/10 完整判定
  if (normalizedIp.includes(':')) {
    const lower = normalizedIp.toLowerCase()
    if (lower === '::1' || lower === '::') return true
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true // fc00::/7 unique-local
    if (
      lower.startsWith('fe80:') ||
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb')
    )
      return true
    return false
  }
  // 主机名形式:localhost + 常见内部域名
  const lower = normalizedIp.toLowerCase()
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true
  }
  return false
}

/** 获取本机所有 IPv4/IPv6 地址 */
function getLocalIpAddresses(): string[] {
  const ifaces = networkInterfaces()
  const result: string[] = []
  for (const ifaceList of Object.values(ifaces)) {
    if (!ifaceList) continue
    for (const iface of ifaceList) {
      result.push(iface.address)
    }
  }
  return result
}

const LOCAL_IPS = getLocalIpAddresses()

const ALLOWED_PROTOCOLS = ['http:', 'https:']
const ALLOWED_PORTS = ['', '80', '443']

/**
 * 危险地址族 —— **即便调用方允许私网**也绝不放行的一类目标。
 *
 * 与 isPrivateOrReservedIp 的分工:后者是"内网整族拦"(allowPrivate=false 档);
 * 本判据专门服务于"渠道上游允许 LAN 自托管服务,但仍不能碰元数据/回环/本机"的场景
 * (relay 转发即此档)。两处判据同住本文件,禁止在任何调用侧再写一份(§0.6)。
 */
export function isBlockedTargetIp(ip: string): boolean {
  const normalizedIp = normalizeGuardTarget(ip)

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalizedIp)) {
    const parts = normalizedIp.split('.').map(Number)
    if (parts.length !== 4 || parts.some((p) => p < 0 || p > 255)) return true
    const [a, b] = parts as [number, number]
    if (a === 0) return true // 0.0.0.0/8 本机网络
    if (a === 127) return true // 回环
    if (a === 169 && b === 254) return true // link-local(含云元数据 169.254.169.254)
    return LOCAL_IPS.includes(normalizedIp)
  }

  const lower = normalizedIp.toLowerCase()
  if (lower === '::1' || lower === '::') return true // v6 回环 / 未指定
  if (lower.startsWith('fe8') || lower.startsWith('fb')) return true // v6 link-local 族
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true
  }
  return LOCAL_IPS.includes(normalizedIp)
}

export interface SsrfCheckResult {
  safe: boolean
  reason?: string
}

/**
 * 校验 URL 是否安全可访问(SSRF 防护)
 * - 拒绝非 http/https 协议(防 file://, gopher://, dict://)
 * - 拒绝非标准端口(80/443)
 * - 拒绝内网 IP(解析 hostname,IPv4 和 IPv6)
 * - 拒绝本机 IP
 * - 防止 DNS rebinding:解析后逐个 IP 校验
 */
export async function assertSafeFetchUrl(
  rawUrl: string,
  opts?: { allowPrivate?: boolean; allowCustomPort?: boolean },
): Promise<SsrfCheckResult> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { safe: false, reason: 'URL is empty' }
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { safe: false, reason: 'Invalid URL format' }
  }

  // 协议白名单
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return { safe: false, reason: `Protocol ${parsed.protocol} not allowed` }
  }

  // 端口白名单(空=默认端口);allowCustomPort 供"自托管上游跑非常端"的档使用
  if (!ALLOWED_PORTS.includes(parsed.port) && !opts?.allowCustomPort) {
    return { safe: false, reason: `Port ${parsed.port} not allowed` }
  }

  // hostname 是 IP 直连,直接校验
  const hostname = parsed.hostname
  const isDirectIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':')
  if (isDirectIp) {
    // 危险族先判:它不受 allowPrivate 影响(允许 LAN 自托管 ≠ 允许打元数据)
    if (isBlockedTargetIp(hostname)) {
      return {
        safe: false,
        reason: 'Direct IP access to a blocked target (loopback/link-local/local host) denied',
      }
    }
    if (!opts?.allowPrivate && isPrivateOrReservedIp(hostname)) {
      return { safe: false, reason: 'Direct IP access to private/local network denied' }
    }
    return { safe: true }
  }

  // hostname 是域名,做 DNS 解析后逐个 IP 校验(防 DNS rebinding)
  let addresses: string[]
  try {
    const records = await lookup(hostname, { all: true })
    addresses = records.map((r) => r.address)
  } catch {
    return { safe: false, reason: 'DNS resolution failed' }
  }

  // 逐 IP 复检(DNS rebinding 面):危险族恒拦,私网族按 allowPrivate 分档
  for (const addr of addresses) {
    if (isBlockedTargetIp(addr)) {
      return {
        safe: false,
        reason: `Resolved IP ${addr} is a blocked target (loopback/link-local/local host)`,
      }
    }
    if (!opts?.allowPrivate && isPrivateOrReservedIp(addr)) {
      return { safe: false, reason: `Resolved IP ${addr} is private/local network` }
    }
  }

  return { safe: true }
}

/**
 * 校验 URL 并在不安全时抛错(方便调用方使用)
 */
export async function ensureSafeFetchUrl(
  rawUrl: string,
  opts?: { allowPrivate?: boolean; allowCustomPort?: boolean },
): Promise<void> {
  const result = await assertSafeFetchUrl(rawUrl, opts)
  if (!result.safe) {
    throw new Error(`SSRF blocked: ${result.reason}`)
  }
}

/** 安全出站 fetch 的重定向跟随上限(与浏览器默认量级对齐,不无限续跳)。 */
const SAFE_FETCH_MAX_REDIRECTS = 5

/**
 * 安全出站 fetch:每一次实际请求(含每个重定向落点)前都过 ensureSafeFetchUrl。
 *
 * 裸 fetch 默认 redirect:'follow' —— 传输层会替我们把已校验的公网地址换成重定向落点,
 * 落点本身不再经过守卫(302 → 内网即可绕过首跳校验)。本出口改 manual 逐跳复检,
 * 口径与 url-preview 的手动跟随一致;方法语义按 fetch 标准降级(303 与 301/302 的 POST 转 GET)。
 */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  opts?: { allowPrivate?: boolean; allowCustomPort?: boolean; maxRedirects?: number },
): Promise<Response> {
  const maxRedirects = opts?.maxRedirects ?? SAFE_FETCH_MAX_REDIRECTS
  let currentUrl = rawUrl
  let currentInit = init
  for (let hop = 0; ; hop++) {
    await ensureSafeFetchUrl(currentUrl, opts)
    const res = await fetch(currentUrl, { ...currentInit, redirect: 'manual' })
    const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
    if (!location) return res
    if (hop >= maxRedirects) throw new Error('SSRF blocked: too many redirects')
    let nextUrl: string
    try {
      nextUrl = new URL(location, currentUrl).toString()
    } catch {
      throw new Error('SSRF blocked: invalid redirect location')
    }
    const method = (currentInit.method ?? 'GET').toUpperCase()
    if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === 'POST')) {
      currentInit = { ...currentInit, method: 'GET', body: undefined }
    }
    try {
      await res.body?.cancel()
    } catch {
      // 中间跳响应体回收失败不影响落点判定
    }
    currentUrl = nextUrl
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
