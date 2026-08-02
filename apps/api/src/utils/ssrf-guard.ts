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

/** 检查 IP 是否为内网/保留地址 */
export function isPrivateOrReservedIp(ip: string): boolean {
  // 处理 IPv4-mapped IPv6 (::ffff:x.x.x.x)
  const normalizedIp = ip.replace(/^::ffff:/, '')
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
  opts?: { allowPrivate?: boolean },
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

  // 端口白名单(空=默认端口)
  if (!ALLOWED_PORTS.includes(parsed.port)) {
    return { safe: false, reason: `Port ${parsed.port} not allowed` }
  }

  // hostname 是 IP 直连,直接校验
  const hostname = parsed.hostname
  const isDirectIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':')
  if (isDirectIp) {
    if (!opts?.allowPrivate && (isPrivateOrReservedIp(hostname) || LOCAL_IPS.includes(hostname))) {
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

  if (!opts?.allowPrivate) {
    for (const addr of addresses) {
      if (isPrivateOrReservedIp(addr) || LOCAL_IPS.includes(addr)) {
        return { safe: false, reason: `Resolved IP ${addr} is private/local network` }
      }
    }
  }

  return { safe: true }
}

/**
 * 校验 URL 并在不安全时抛错(方便调用方使用)
 */
export async function ensureSafeFetchUrl(
  rawUrl: string,
  opts?: { allowPrivate?: boolean },
): Promise<void> {
  const result = await assertSafeFetchUrl(rawUrl, opts)
  if (!result.safe) {
    throw new Error(`SSRF blocked: ${result.reason}`)
  }
}
