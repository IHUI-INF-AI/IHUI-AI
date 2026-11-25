// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

 
/**
 * 威胁判据单一真相源(2026-11-24 立)。
 *
 * 本文件只放判据,零 IO、零副作用 —— 采集/落盘/防火墙执行分别在 attack-collect.mjs
 * 与 blocklist.mjs。判据与执行分离的目的:纯函数可被 node:test 直接钉住,
 * 改阈值只需改这一处,任何第二份实现都会漂移(§0.6)。
 *
 * 为什么是「打分」而不是「命中一次就封」:
 *   · 火绒 WAF 一次 Exploit 命中已是强信号(权重 10 = 直接达标),但边缘缺头
 *     (edge guard) 与限流是弱信号,单次不足以定性 —— 扫描器、爬虫、配置漂移
 *     都会触发。按权重累加,既不让真实攻击漏网,也不把一次误配封成事故。
 *   · 窗口默认 24h:攻击是多波次的(实测 10-29 首扫、11-12 连续 17h、
 *     11-22~24 多波),只看当天会让「昨天扫过的 IP 今天换端口再来」漏掉。
 */
export const SECURITY_POLICY = Object.freeze({
  version: 1,
  // 评分窗口:只统计最近 N 小时的事件
  windowHours: 24,
  // 达到该分数才进入封禁候选
  banScore: 10,
  // 单批最多自动封禁条数,防止一次误判把规则表打爆(超出部分只观察并点名)
  maxBanBatch: 50,
  // 首次封禁时长;每重犯一次翻倍,封顶 maxTtlHours
  ttlHours: 24,
  maxTtlHours: 168, // 7 天
  // 事件权重:火绒确认的漏洞利用 10(一次即达标);入口 WAF 拦下的载荷 5(需两次 ——
  // 规则有误报空间,单次误触不该换来 24h 封禁);限流 2;WAF 观察档 2;缺回源头 1。
  weights: Object.freeze({ waf: 10, 'waf-block': 5, 'waf-observe': 2, 'rate-limit': 2, 'edge-guard': 1 }),
  // 永久白名单:本机/内网/链路本地/回环,任何情况下不封
  whitelistCidrs: Object.freeze([
    '127.0.0.0/8',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '169.254.0.0/16',
    '::1',
    '::1/128',
  ]),
})

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

/** IPv4 点分十进制转 32 位无符号整数;非法返回 null。 */
export function ipv4ToInt(ip) {
  const m = IPV4_RE.exec(String(ip ?? '').trim())
  if (!m) return null
  const parts = m.slice(1, 5).map((x) => Number(x))
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

/**
 * IPv4 CIDR 归属判断。非 CIDR 形态按精确字符串匹配(用于 ::1 这类单地址)。
 * IPv6 只支持精确匹配 —— 本机公网入口是 IPv4,不为未用到的能力造第二套解析。
 */
export function inCidr(ip, cidr) {
  const raw = String(cidr ?? '').trim()
  if (!raw) return false
  if (!raw.includes('/')) return String(ip ?? '').trim() === raw
  const [base, bitsRaw] = raw.split('/')
  const bits = Number(bitsRaw)
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false
  const ipInt = ipv4ToInt(ip)
  const baseInt = ipv4ToInt(base)
  if (ipInt === null || baseInt === null) return false
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return (ipInt & mask) === (baseInt & mask)
}

/** 白名单判断:固定网段 + 调用方追加的 CIDR(来自 state allowlist)。 */
export function isWhitelisted(ip, extraCidrs = [], policy = SECURITY_POLICY) {
  const list = [...policy.whitelistCidrs, ...(Array.isArray(extraCidrs) ? extraCidrs : [])]
  return list.some((c) => inCidr(ip, c))
}

/**
 * 按窗口+白名单把事件聚合成 IP 打分。events 元素:
 *   { ts: ISO 字符串或毫秒数, ip: string, kind: 'waf'|'rate-limit'|'edge-guard',
 *     detection?: string, path?: string }
 * 返回 { aggregates, stats },aggregates 按 score 降序。
 */
export function scoreEvents(events, { policy = SECURITY_POLICY, now = Date.now(), extraWhitelist = [] } = {}) {
  const since = now - policy.windowHours * 3600_000
  const map = new Map()
  const stats = { total: 0, outsideWindow: 0, invalid: 0, whitelisted: 0, unknownKind: 0 }

  for (const ev of Array.isArray(events) ? events : []) {
    stats.total += 1
    const ts = typeof ev?.ts === 'number' ? ev.ts : Date.parse(ev?.ts)
    if (!Number.isFinite(ts)) {
      stats.invalid += 1
      continue
    }
    if (ts < since) {
      stats.outsideWindow += 1
      continue
    }
    const ip = String(ev?.ip ?? '').trim()
    if (!ip) {
      stats.invalid += 1
      continue
    }
    if (isWhitelisted(ip, extraWhitelist, policy)) {
      stats.whitelisted += 1
      continue
    }
    const weight = policy.weights[ev.kind] ?? 0
    if (!weight) {
      stats.unknownKind += 1
      continue
    }
    let agg = map.get(ip)
    if (!agg) {
      agg = {
        ip,
        score: 0,
        hits: 0,
        kinds: {},
        detections: [],
        paths: [],
        firstTs: new Date(ts).toISOString(),
        lastTs: new Date(ts).toISOString(),
      }
      map.set(ip, agg)
    }
    agg.score += weight
    agg.hits += 1
    agg.kinds[ev.kind] = (agg.kinds[ev.kind] ?? 0) + 1
    if (ev.detection && !agg.detections.includes(ev.detection)) agg.detections.push(ev.detection)
    if (ev.path && agg.paths.length < 6 && !agg.paths.includes(ev.path)) agg.paths.push(ev.path)
    const iso = new Date(ts).toISOString()
    if (iso < agg.firstTs) agg.firstTs = iso
    if (iso > agg.lastTs) agg.lastTs = iso
  }

  const aggregates = [...map.values()].sort((a, b) => b.score - a.score || b.hits - a.hits)
  return { aggregates, stats }
}

/**
 * 把聚合分数转成封禁决策。entries 是已持久化的黑名单(ip -> entry)。
 * 决策 action:
 *   observe  未达阈值,只上报
 *   ban      新增封禁(ttlHours 按重犯次数翻倍,封顶)
 *   refresh  已在封禁期,刷新 lastSeen(不重复建规则)
 *   batch-limit 已达阈值但超出单批上限,留待下一轮
 */
export function decideBans(aggregates, entries = {}, { policy = SECURITY_POLICY, now = Date.now() } = {}) {
  const list = Array.isArray(aggregates) ? aggregates : []
  const decisions = []
  let banCount = 0
  for (const a of list) {
    if (a.score < policy.banScore) {
      decisions.push({ ip: a.ip, action: 'observe', score: a.score, hits: a.hits })
      continue
    }
    const prev = entries?.[a.ip]
    const prevExpires = prev?.expiresAt ? Date.parse(prev.expiresAt) : 0
    if (prev && Number.isFinite(prevExpires) && prevExpires > now) {
      decisions.push({ ip: a.ip, action: 'refresh', score: a.score, hits: a.hits, expiresAt: prev.expiresAt })
      continue
    }
    if (banCount >= policy.maxBanBatch) {
      decisions.push({ ip: a.ip, action: 'batch-limit', score: a.score, hits: a.hits })
      continue
    }
    banCount += 1
    const rebanCount = prev ? Number(prev.rebanCount ?? 0) + 1 : 0
    const ttlHours = Math.min(policy.ttlHours * 2 ** rebanCount, policy.maxTtlHours)
    decisions.push({
      ip: a.ip,
      action: 'ban',
      score: a.score,
      hits: a.hits,
      rebanCount,
      ttlHours,
      expiresAt: new Date(now + ttlHours * 3600_000).toISOString(),
      detections: a.detections,
      kinds: a.kinds,
      paths: a.paths,
    })
  }
  return decisions
}

/** 到期条目(供 prune 解封)。 */
export function expiredEntries(entries = {}, now = Date.now()) {
  return Object.values(entries).filter((e) => {
    const t = e?.expiresAt ? Date.parse(e.expiresAt) : 0
    return Number.isFinite(t) && t > 0 && t <= now
  })
}

export const __test__ = { ipv4ToInt, inCidr, isWhitelisted, scoreEvents, decideBans, expiredEntries }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
