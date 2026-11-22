// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * IP 字面量纯判据 —— 解析、网段归类与拒绝名单的唯一实现(2026-10-21 从 ssrf-guard 拆出)。
 *
 * 为什么必须与 `ssrf-guard.ts` 分家(不是"整理代码"):
 * `ssrf-guard.ts` 为了"域名先解析再逐 IP 判"而 import `node:dns/promises`。而
 * `apps/web/proxy.ts`(Next 16 的 proxy,原 middleware)跑在 **Edge 运行时**,Edge 产物里
 * 出现 Node 内建模块会让 `next build` 在构建期直接报错 —— 红的是全站部署,不是那一个文件。
 * 守卫要的那两把尺子(`parseIpAddress` / `isPrivateOrReservedIp`)本质是**纯字符串 +
 * BigInt 位运算**,与 DNS 毫无关系,被连带拖进不可用面纯属"同文件所致"。
 *
 * 本文件的存在形态即 AGENTS §「shared 包非 Node 宿主纯度(126)」给的修法之二:
 * **移出共享面**(把纯判据放到任何宿主都能引的那一层),而不是 adapter 注入。
 *
 * 纪律:
 *  - **零 Node 内建、零 IO、零网络**。只允许字符串运算与 BigInt 位运算。`node:dns`
 *    那两行只准留在 `ssrf-guard.ts`;反向依赖(本文件 import ssrf-guard)一旦出现,
 *    拆分即作废。
 *  - 判据内容与 `ssrf-guard.ts` 原实现**逐字节相同** —— 本次搬迁用脚本按行区间切块拼装,
 *    没有手抄,也没有顺手"优化"。安全判据一改就是另一张脸。
 *  - 行为取证沿用既有测试:`__tests__/ssrf-guard.test.ts` 经 ssrf-guard 的 re-export
 *    打到这里的同一批函数对象;不新增第二份用例、不复制判据(§0.6 / §22c)。
 *  - `ssrf-guard.ts` 继续对外导出本文件的全部公开符号,既有消费方一律不改导入路径。
 *    实现只在本文件这一处;ssrf-guard 那侧只剩 import/export,没有第二份判据。
 */

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

export type ParsedIpAddress = { family: 4; value: bigint } | { family: 6; value: bigint }

/**
 * IP 字面量归一化的唯一出口(票 G-1105310 收敛)。
 *
 * 语义:
 *  - 输入容忍首尾空白、`[...]` 方括号、`%zone` 区域索引;十六进制大小写不敏感。
 *  - IPv4:严格点分四段(0-255)→ 32 位 bigint。
 *  - IPv6:`::` 分组补零展开 → 128 位 bigint;尾部点分四段按 RFC 4291 §2.2 形态 3
 *    折叠(恰好四个十进制八位组)。
 *  - `::ffff:0:0/96`(IPv4-mapped)折回 family 4,让 v4 名单对它同样生效;
 *    6to4 / DNS64 的嵌入 v4 **不**在此折 —— 那是判据层语义(SSRF 层走
 *    `IPV6_EMBEDDED_V4_PREFIXES` 复检,字面出口层自带 64:ff9b::/96 还原),
 *    解析器只管归一化,不掺名单。
 *
 * 两份旧实现差异的裁定(为何取严格档):被删的 fetch-url-egress 副本还认 BSD 缩写
 * v4(`1.2`/`1.2.3`),但它的唯一入口收的是 WHATWG URL —— http/https 主机在 URL
 * 解析期已被规范化(缩写 → 四段字面、v6 点分尾 → 十六进制分组),fetch_url 又只在
 * http/https 上调它,缩写形态到不了解析器。故按更严格的这份为准:缩写一律解析不出,
 * fail-closed 由各判据层自行执行(SSRF 层判"不安全",字面出口层判"非字面量"归名字域)。
 */
export function parseIpAddress(text: string): ParsedIpAddress | null {
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
  const parsed = parseIpAddress(host)
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
 * 只在 family 6 上取(family 4 已在原值上判过;而 `::ffff:0:0/96` 由 `parseIpAddress`
 * 折回 family 4,结构上不会到这里 —— 那是既有行为,本函数不重复它)。
 *
 * 本文件内唯一的可见性改动:`export` 关键字。`ssrf-guard.ts` 的「信任永不放行」判据
 * (`isNeverTrustedAddress`)原本就在同文件内直接调它,拆开后必须跨模块取用 ——
 * 函数体逐字节未动(搬运算器的反向锁 16/16 已证)。
 */
export function embeddedIpv4Of(parsed: ParsedIpAddress): bigint | null {
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
  const parsed = parseIpAddress(ip)
  if (!parsed) return true // 解析不出来的形态一律按危险处理(fail-closed)
  if (DENIED_RANGES.some(({ range }) => hitsRange(parsed.value, parsed.family, range))) return true
  // 6to4 / 全局 DNS64:按"嵌进来的那个 v4"判,而不是按前缀名整段拒(见 IPV6_EMBEDDED_V4_PREFIXES)
  const embedded = embeddedIpv4Of(parsed)
  if (embedded !== null) return isDeniedIpv4Value(embedded)
  return false
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
