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

/**
 * IPv4 字面量判定(数值化 + 进制还原)—— **本仓唯一实现**(2026-10-31 收口)。
 *
 * 来历:embed-proxy.ts 与 url-preview.ts 各带一份逐字相同的实现,而本文件的点分十进制
 * 分支只认 `a.b.c.d` ⇒ `http://2130706433/`(= 127.0.0.1)与 `http://0x7f.1/` 这类
 * 写法在本仓**规范出口**上读成公网地址。收进来不是为了合并代码,是因为三份里两份比这份强,
 * 而调用方一律以为吃的是最强的那一档。
 *
 * 只接受两种可无歧义还原的形式,其余一律 fail-closed:
 *  1) 严格点分十进制 a.b.c.d
 *  2) 纯整数(十进制/0x十六进制),还原为 32 位地址
 * 经典绕过(0x7f.1 / 0177.0.0.1 等混合进制)因无法无歧义归一而直接拒绝。
 */
export function isPrivateIPv4Literal(ip: string): boolean {
  let parts: number[]
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    // 前导零点分段(0177.0.0.1)在 BSD 语义里是**八进制**,而 Number() 按十进制读成 177 ⇒
    // 127.0.0.1 会被算成 177.0.0.1 这格公网地址。两份旧副本的注释都写"混合进制直接拒绝",
    // 实际没拒 —— 这里补上:任何一段带前导零 ⇒ 无法无歧义归一 ⇒ fail-closed。
    const octets = ip.split('.')
    if (octets.some((s) => s.length > 1 && s.startsWith('0'))) return true
    parts = octets.map(Number)
  } else if (/^(0[xX][0-9a-fA-F]+|\d+)$/.test(ip)) {
    const n = Number(ip)
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) return true
    parts = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
  } else {
    return true
  }
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
  const [a = -1, b = -1] = parts
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true // 组播/保留
  return false
}

/**
 * IPv6 字面量判定 —— **本仓唯一实现**(2026-10-31 收口,与 IPv4 同一刀)。
 *
 * 来历:embed-proxy.ts 与 url-preview.ts 各带一份逐字相同的实现(只差一行注释),
 * 覆盖面比本文件的旧 IPv6 分支更广:`ff00::/8` 组播、`100::/64` discard、NAT64 `64:ff9b::/96`、
 * 以及"`::ffff:` 前缀但不是点分"一律禁止。旧分支只认回环/ULA/link-local ⇒ 上面四族在
 * 规范出口上读成公网。收进来后两路副本删除,判据只住这一处(§0.6)。
 */
export function isPrivateIPv6Literal(ip: string): boolean {
  const v = ip.toLowerCase()
  if (v === '::' || v === '::1') return true
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped?.[1]) return isPrivateIPv4Literal(mapped[1])
  if (v.startsWith('::ffff:')) return true // mapped 但非点分 → 一律禁止
  if (v.startsWith('fc') || v.startsWith('fd')) return true // fc00::/7 unique-local
  // fe80::/10 链路本地:按前四位取 fe8/fe9/fea/feb(旧分支的覆盖面,合并时不缩)
  if (
    v.startsWith('fe80:') ||
    v.startsWith('fe8') ||
    v.startsWith('fe9') ||
    v.startsWith('fea') ||
    v.startsWith('feb')
  )
    return true
  if (v.startsWith('ff')) return true // 组播
  if (v.startsWith('64:ff9b:') || v.startsWith('100::')) return true // NAT64 / 保留
  return false
}

/** 检查 IP 是否为内网/保留地址 */
export function isPrivateOrReservedIp(ip: string): boolean {
  // 处理 IPv4-mapped IPv6 (::ffff:x.x.x.x)
  const normalizedIp = normalizeGuardTarget(ip)
  // IPv4 形态(点分十进制 / 纯整数 / 十六进制 / 任何"每一段都是数字或 0x 数字"的写法)
  // 统一走上面那一份实现。此前只认严格点分十进制 ⇒ 2130706433 这类整数写法掉到下面的
  // 正则兜底档,被读成公网放行;而 0x7f.1 / 0177.0.0.1 是同一格的变体。
  // 判据刻意要求**每一段**都是数字或 0x 数字,纯字母主机名(dead.beef 之类)不受影响。
  if (/^(?:0[xX][0-9a-fA-F]+|\d+)(?:\.(?:0[xX][0-9a-fA-F]+|\d+))*$/.test(normalizedIp)) {
    return isPrivateIPv4Literal(normalizedIp)
  }
  // 正则兜底(覆盖 IPv6 简写 / 主机名形式),必须排在下面 v6 委托之前
  if (PRIVATE_IP_PATTERNS.some((p) => p.test(normalizedIp))) return true
  // IPv6 字面量统一走上面那一份实现(旧块只认回环/ULA/link-local,
  // 漏 v6 组播 ff00::/8、NAT64 64:ff9b::/96、discard-only 100::/64 与"::ffff: 非点分")
  if (normalizedIp.includes(':')) return isPrivateIPv6Literal(normalizedIp)
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
    // 2026-10-31 安全强化第 15 批(M3):建连走带 connect.lookup 钩子的 dispatcher
    // —— 本模块 globalThis.fetch 只认 RequestInit,不带 dispatcher;undici 的
    // fetch 才接受。判定(上一行)与建连共用同一次解析,TOCTOU 窗口收口。
    const res = (await undiciFetch(currentUrl, {
      ...currentInit,
      redirect: 'manual',
      dispatcher: ssrfGuardedDispatcher({ allowPrivate: opts?.allowPrivate }),
    })) as unknown as Response
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

// =============================================================================
// 连接期守卫(2026-10-31 安全强化第 15 批,M3):判定与建连共用同一次解析
// =============================================================================
// ensureSafeFetchUrl 问的是"一次解析",fetch 建连时传输层还会再解析一次 ——
// 一条 TTL=0 的 A 记录能让"校验时公网、建连时内网"(DNS rebinding TOCTOU)。
// 收口范式 = utils/relay-egress-guard.ts 的 relayGuardedLookup(判据是它自己的
// allowPrivate:true 档):把"这个地址能不能连"的判定挪进 undici Agent 的
// connect.lookup 钩子 —— undici 拿它建 socket 的地址就是钩子交回的地址,
// 校验与建连因此共用同一次解析,rebinding 失效。
// 本工厂是通用档:判据不重写(§0.6),复用本模块 isBlockedTargetIp(危险族恒拦,
// 不受档位影响)+ isPrivateOrReservedIp(私网族按 allowPrivate 分档),与
// ensureSafeFetchUrl 的判定语义逐条同源;解析失败 ⇒ 交回错误,绝不"判不出就放行"。

import { lookup as guardedDnsLookupAll } from 'node:dns/promises'
import type { LookupFunction } from 'node:net'
import { Agent as UndiciAgent, fetch as undiciFetch } from 'undici'

export interface SsrfLookupOptions {
  all?: boolean
  family?: number
}

export type SsrfLookupCallback = (
  err: NodeJS.ErrnoException | null,
  addresses: { address: string; family: number }[] | string,
) => void

export type SsrfGuardedLookup = (
  hostname: string,
  options: SsrfLookupOptions,
  callback: SsrfLookupCallback,
) => void

export function ssrfGuardedLookup(opts?: { allowPrivate?: boolean }): SsrfGuardedLookup {
  const allowPrivate = opts?.allowPrivate ?? false
  return (hostname, options, callback) => {
    void guardedDnsLookupAll(hostname, { ...options, all: true })
      .then((rows) => {
        for (const row of rows) {
          if (
            isBlockedTargetIp(row.address) ||
            (!allowPrivate && isPrivateOrReservedIp(row.address))
          ) {
            callback(
              Object.assign(
                new Error(`SSRF blocked: ${row.address} is a blocked target (connect-time)`),
                { code: 'ESSRFBLOCKED' },
              ),
              [],
            )
            return
          }
        }
        callback(null, rows)
      })
      .catch((e: unknown) => {
        callback(e instanceof Error ? e : new Error(String(e)), [])
      })
  }
}

/** 按档位缓存的 undici dispatcher 单例(连接池按 host 复用,不能每请求新建)。 */
const guardedDispatchers = new Map<boolean, UndiciAgent>()

export function ssrfGuardedDispatcher(opts?: { allowPrivate?: boolean }): UndiciAgent {
  const allowPrivate = opts?.allowPrivate ?? false
  let agent = guardedDispatchers.get(allowPrivate)
  if (!agent) {
    // undici LookupFunction 的回调形态(net.LookupAddress 族)与 net 的 lookup 契约
    // 同形;本模块 SsrfLookupCallback 语义一致,仅签名结构差异,此处对齐。
    agent = new UndiciAgent({
      connect: { lookup: ssrfGuardedLookup({ allowPrivate }) as unknown as LookupFunction },
    })
    guardedDispatchers.set(allowPrivate, agent)
  }
  return agent
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
