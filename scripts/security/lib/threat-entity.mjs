// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 威胁实体与段级升级(2026-11-24 立)。
 *
 * 解决的真问题:对手换 IP 就重来。实测 ACE 池 41 个 IP 同属 AS139341、集中在少数 /24,
 * 逐个封 IP 等于给对方「换个地址继续打」的免费额度。国家级对抗的做法是**向上一级封实体**:
 * 同段多个独立 IP 都有攻击证据 ⇒ 封该 /24。
 *
 * 为什么默认只在 /24 上扩、且要三道安全阀:
 *   · 再往上(/16、ASN 整段)必然扫到正常用户,那是运营商/云厂商该做的处置,不是站主;
 *   · 段封会误伤同段的无辜站点,所以阈值必须是「多个独立 IP + 足够命中」而不是「一个 IP 打了很多次」;
 *   · 最致命的是封到自己:本机公网 IP、内网段、白名单只要与该段有交集,一律拒绝。
 *
 * 纯函数、零 IO:可被 node:test 钉住;执行仍在 blocklist.mjs。
 */
import { inCidr } from './threat-policy.mjs'

export const ENTITY_POLICY = Object.freeze({
  version: 1,
  /** 同 /24 内至少这么多个**独立**攻击 IP,才考虑段封 */
  minIpsPerSubnet: 3,
  /** 且这些 IP 的命中总数达到该值(防「一个扫描器轮换出口」被误判成团伙) */
  minHitsPerSubnet: 6,
  /** 单轮最多新增段数:超出只登记候选,不落地 */
  maxSubnetsPerRound: 3,
  /** 段封 TTL(比单 IP 短:段是范围性措施,必须更快回收) */
  subnetTtlHours: 72,
  /** 段封禁区:与这些网段有任何交集即拒绝 */
  forbiddenCidrs: Object.freeze(['127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16']),
})

/** 统一实体键,避免同一样东西在台账里出现两种写法。 */
export function entityKey(type, value) {
  return `${String(type)}:${String(value).trim().toLowerCase()}`
}

/** IPv4 → /24 网段串;非法返回 null(IPv6 不做段升级:本机入口是 IPv4)。 */
export function subnetOf(ip, bits = 24) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip ?? '').trim())
  if (!m) return null
  const parts = m.slice(1, 5).map(Number)
  if (parts.some((n) => n > 255)) return null
  if (bits === 24) return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
  if (bits === 16) return `${parts[0]}.${parts[1]}.0.0/16`
  return null
}

/** 两个 CIDR 是否有交集(按较短前缀比较)。 */
export function cidrOverlaps(a, b) {
  const [ai, ab] = String(a).split('/')
  const [bi, bb] = String(b).split('/')
  const bits = Math.min(Number(ab ?? 32), Number(bb ?? 32))
  if (!Number.isInteger(bits) || bits < 0) return false
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  const int = (ip) => {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip ?? '').trim())
    if (!m) return null
    const p = m.slice(1, 5).map(Number)
    return p.some((n) => n > 255) ? null : (((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0)
  }
  const aInt = int(ai)
  const bInt = int(bi)
  if (aInt === null || bInt === null) return false
  return (aInt & mask) === (bInt & mask)
}

/**
 * 按 /24 聚合攻击 IP。aggregates 元素需含 { ip, hits }。
 * 返回 [{ cidr, ips, hits }],按 hits 降序。
 */
export function clusterSubnets(aggregates) {
  const map = new Map()
  for (const a of Array.isArray(aggregates) ? aggregates : []) {
    const cidr = subnetOf(a?.ip)
    if (!cidr) continue
    const cur = map.get(cidr) ?? { cidr, ips: [], hits: 0 }
    if (!cur.ips.includes(a.ip)) cur.ips.push(a.ip)
    cur.hits += Number(a.hits ?? 0) || 0
    map.set(cidr, cur)
  }
  return [...map.values()].sort((x, y) => y.hits - x.hits)
}

/**
 * 判定哪些段可以封。已封的段跳过;与本机/白名单/禁区有交集的一律拒绝并点名原因。
 * 返回 { approve: [cidr], reject: [{cidr, reason}], held: [cidr] }。
 */
export function planSubnetEscalation(clusters, { policy = ENTITY_POLICY, entries = {}, allowlist = [], infra = [] } = {}) {
  const approve = []
  const reject = []
  const held = []
  const bannedCidrs = Object.keys(entries ?? {}).filter((k) => String(k).includes('/'))

  for (const c of Array.isArray(clusters) ? clusters : []) {
    if (c.ips.length < policy.minIpsPerSubnet || c.hits < policy.minHitsPerSubnet) continue

    if (bannedCidrs.some((b) => cidrOverlaps(b, c.cidr))) {
      held.push({ cidr: c.cidr, reason: 'already-banned' })
      continue
    }
    if (infra.some((ip) => inCidr(ip, c.cidr))) {
      reject.push({ cidr: c.cidr, reason: '含本机地址,封了等于自断' })
      continue
    }
    if (policy.forbiddenCidrs.some((f) => cidrOverlaps(f, c.cidr))) {
      reject.push({ cidr: c.cidr, reason: '与内网/回环/链路本地有交集' })
      continue
    }
    if (allowlist.some((a) => inCidr(a, c.cidr))) {
      reject.push({ cidr: c.cidr, reason: '包含白名单地址' })
      continue
    }
    if (approve.length >= policy.maxSubnetsPerRound) {
      held.push({ cidr: c.cidr, reason: 'batch-limit' })
      continue
    }
    approve.push(c.cidr)
  }
  return { approve, reject, held }
}

export const __test__ = { ENTITY_POLICY, entityKey, subnetOf, cidrOverlaps, clusterSubnets, planSubnetEscalation }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
