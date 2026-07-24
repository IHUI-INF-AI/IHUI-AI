/**
 * IP 信誉评估服务。
 *
 * 能力:
 * 1. getIpReputation(ip) — 综合评分 (0-100,越高越可疑),来源含本地黑名单 / 威胁情报接口 /
 *    ASN 信息 / 历史异常事件计数。结果 Redis 缓存 1 小时。
 * 2. recordBadEvent(ip, reason) — 记录异常事件,30 天 TTL。
 * 3. blockIp(ip, durationSec) / isIpBlocked(ip) / unblockIp(ip) — 临时封禁管理。
 *
 * 降级策略:Redis 不可用或未注入时,全部回退到进程内内存 Map(单实例有效)。
 * 配置(安全相关 env,缺失即空,降级运行):
 *   SECURITY_TOR_EXIT_NODES / SECURITY_PROXY_CIDRS / SECURITY_DATACENTER_CIDRS / SECURITY_MALICIOUS_ASNS
 */

import type { Redis } from 'ioredis'
import { logger } from '../utils/logger.js'

/* -------------------------------------------------------------------------- */
/* 类型                                                                        */
/* -------------------------------------------------------------------------- */

export interface IpReputation {
  /** 0-100,越高越可疑 */
  score: number
  reasons: string[]
  /** cache = 命中 Redis 缓存;live = 实时计算 */
  source: 'cache' | 'live'
}

/* -------------------------------------------------------------------------- */
/* 配置(env,缺失降级为空)                                                    */
/* -------------------------------------------------------------------------- */

function parseList(envVar: string): string[] {
  const raw = process.env[envVar]
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

const TOR_EXIT_NODES: ReadonlySet<string> = new Set(parseList('SECURITY_TOR_EXIT_NODES'))
const PROXY_CIDRS: readonly string[] = parseList('SECURITY_PROXY_CIDRS')
const DATACENTER_CIDRS: readonly string[] = parseList('SECURITY_DATACENTER_CIDRS')
const MALICIOUS_ASNS: ReadonlySet<string> = new Set(parseList('SECURITY_MALICIOUS_ASNS'))

/** 信誉缓存 TTL (秒)。 */
const REPUTATION_CACHE_TTL = 3600
/** 异常事件计数 TTL (秒) = 30 天。 */
const BAD_EVENT_TTL = 30 * 24 * 3600
/** 异常事件阈值:超过该值直接拉高信誉分。 */
const BAD_EVENT_THRESHOLD = 5

/* -------------------------------------------------------------------------- */
/* 内网 / CIDR 工具                                                            */
/* -------------------------------------------------------------------------- */

/** 是否为私有 / 内网 IP(内网自动低风险白名单)。 */
export function isPrivateIp(ip: string): boolean {
  if (!ip) return false
  if (ip === '::1' || ip === '::') return true
  // IPv4-mapped IPv6
  const v4 = ip.includes(':') ? ip.replace(/^::ffff:/, '') : ip
  return (
    v4.startsWith('10.') ||
    v4.startsWith('192.168.') ||
    v4.startsWith('127.') ||
    v4.startsWith('169.254.') || // link-local
    v4 === 'localhost'
  )
}

/** 172.16.0.0/12 范围判断(避免简单 startsWith 误判 172.32)。 */
function isIpIn172Private(ip: string): boolean {
  if (!ip.startsWith('172.')) return false
  const parts = ip.split('.')
  const second = Number(parts[1] ?? -1)
  return second >= 16 && second <= 31
}

/** 简化 CIDR 包含判断(仅支持 /8 /16 /24 /32 等按点分八位组对齐的 CIDR)。 */
function ipMatchesCidr(ip: string, cidr: string): boolean {
  if (!cidr) return false
  const slashIdx = cidr.indexOf('/')
  const base = slashIdx >= 0 ? cidr.slice(0, slashIdx) : cidr
  const prefix = slashIdx >= 0 ? Number(cidr.slice(slashIdx + 1)) : 32
  if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) return false
  const ipParts = ip.split('.').map((p) => Number(p))
  const baseParts = base.split('.').map((p) => Number(p))
  if (ipParts.length !== 4 || baseParts.length !== 4) return false
  if (ipParts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) return false
  if (baseParts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) return false
  // 逐 bit 比较 prefix 位
  let bitsLeft = prefix
  for (let i = 0; i < 4 && bitsLeft > 0; i++) {
    const ipOctet = ipParts[i] ?? 0
    const baseOctet = baseParts[i] ?? 0
    const bits = Math.min(8, bitsLeft)
    const mask = bits === 8 ? 0xff : (0xff << (8 - bits)) & 0xff
    if ((ipOctet & mask) !== (baseOctet & mask)) return false
    bitsLeft -= bits
  }
  return true
}

function ipMatchesAnyCidr(ip: string, cidrs: readonly string[]): boolean {
  for (const cidr of cidrs) {
    if (ipMatchesCidr(ip, cidr)) return true
  }
  return false
}

/* -------------------------------------------------------------------------- */
/* Redis key 命名                                                              */
/* -------------------------------------------------------------------------- */

const K_REPUTATION = (ip: string) => `iprep:${ip}`
const K_BLOCKED = (ip: string) => `ip:blocked:${ip}`
const K_BAD_EVENTS = (ip: string) => `ip:badevents:${ip}`
const K_BLACKLIST = 'ip:blacklist'

/* -------------------------------------------------------------------------- */
/* 服务实现                                                                    */
/* -------------------------------------------------------------------------- */

export class IpReputationService {
  constructor(private readonly redis: Redis | null) {}

  /* ----------------------------- 查询信誉 ----------------------------- */

  async getIpReputation(ip: string): Promise<IpReputation> {
    if (!ip) return { score: 0, reasons: [], source: 'live' }

    // 内网直接低风险
    if (isPrivateIp(ip) || isIpIn172Private(ip)) {
      return { score: 0, reasons: ['private-ip'], source: 'live' }
    }

    // 命中缓存
    const cached = await this.getCachedReputation(ip)
    if (cached) return { ...cached, source: 'cache' }

    const live = await this.computeReputation(ip)
    await this.setCachedReputation(ip, live)
    return { ...live, source: 'live' }
  }

  private async computeReputation(ip: string): Promise<IpReputation> {
    let score = 0
    const reasons: string[] = []

    // 1. 本地黑名单
    const inBlacklist = await this.isInBlacklist(ip)
    if (inBlacklist) {
      score += 60
      reasons.push('blacklisted')
    }

    // 2. TOR exit node
    if (TOR_EXIT_NODES.has(ip)) {
      score += 35
      reasons.push('tor-exit-node')
    }

    // 3. 已知代理段
    if (ipMatchesAnyCidr(ip, PROXY_CIDRS)) {
      score += 30
      reasons.push('known-proxy')
    }

    // 4. 数据中心 IP 段(标记但不强阻塞)
    if (ipMatchesAnyCidr(ip, DATACENTER_CIDRS)) {
      score += 15
      reasons.push('datacenter-ip')
    }

    // 5. 历史异常事件计数
    const badCount = await this.getBadEventCount(ip)
    if (badCount > 0) {
      reasons.push(`bad-events:${badCount}`)
      if (badCount >= BAD_EVENT_THRESHOLD) {
        score += 40
      } else {
        score += badCount * 6
      }
    }

    // 6. 威胁情报 API(简化:预留接口,默认 unknown 不加分)
    const ti = await this.queryThreatIntel(ip)
    if (ti.suspicious) {
      score += 25
      reasons.push(`threat-intel:${ti.source}`)
    }

    if (score > 100) score = 100
    if (score < 0) score = 0
    return { score, reasons, source: 'live' }
  }

  /** 威胁情报查询(简化:预留接口,默认返回 unknown)。 */
  private async queryThreatIntel(ip: string): Promise<{ suspicious: boolean; source: string }> {
    // 预留:可接入 AbuseIPDB / GreyNoise 等。未配置时不查询。
    const apiKey = process.env.SECURITY_THREAT_INTEL_API_KEY
    if (!apiKey) return { suspicious: false, source: 'unknown' }
    // 实际接入需 HTTP 调用,此处保持占位,避免引入外部依赖与网络副作用。
    void ip
    return { suspicious: false, source: 'api-not-implemented' }
  }

  /* ----------------------------- 缓存读写 ----------------------------- */

  private async getCachedReputation(ip: string): Promise<IpReputation | null> {
    if (!this.redis) {
      const v = IpReputationService.memCache.get(ip)
      if (v && v.expiresAt > Date.now()) return v.value
      return null
    }
    try {
      const raw = await this.redis.get(K_REPUTATION(ip))
      if (!raw) return null
      return JSON.parse(raw) as IpReputation
    } catch (e) {
      logger.warn('ip-reputation: cache read failed, fallback to live', { err: e })
      return null
    }
  }

  private async setCachedReputation(ip: string, rep: IpReputation): Promise<void> {
    if (!this.redis) {
      IpReputationService.memCache.set(ip, {
        value: rep,
        expiresAt: Date.now() + REPUTATION_CACHE_TTL * 1000,
      })
      return
    }
    try {
      await this.redis.set(K_REPUTATION(ip), JSON.stringify(rep), 'EX', REPUTATION_CACHE_TTL)
    } catch (e) {
      logger.warn('ip-reputation: cache write failed', { err: e })
    }
  }

  /* ----------------------------- 黑名单 ----------------------------- */

  private async isInBlacklist(ip: string): Promise<boolean> {
    if (!this.redis) return IpReputationService.memBlacklist.has(ip)
    try {
      const r = await this.redis.sismember(K_BLACKLIST, ip)
      return r === 1
    } catch (e) {
      logger.warn('ip-reputation: blacklist read failed', { err: e })
      return IpReputationService.memBlacklist.has(ip)
    }
  }

  async addToBlacklist(ip: string): Promise<void> {
    if (!this.redis) {
      IpReputationService.memBlacklist.add(ip)
      return
    }
    try {
      await this.redis.sadd(K_BLACKLIST, ip)
    } catch (e) {
      IpReputationService.memBlacklist.add(ip)
      logger.warn('ip-reputation: blacklist write failed, used mem', { err: e })
    }
  }

  async removeFromBlacklist(ip: string): Promise<void> {
    if (!this.redis) {
      IpReputationService.memBlacklist.delete(ip)
      return
    }
    try {
      await this.redis.srem(K_BLACKLIST, ip)
    } catch (e) {
      IpReputationService.memBlacklist.delete(ip)
      logger.warn('ip-reputation: blacklist remove failed, used mem', { err: e })
    }
  }

  /* ----------------------------- 异常事件 ----------------------------- */

  async recordBadEvent(ip: string, reason: string): Promise<void> {
    if (!ip) return
    if (!this.redis) {
      const cur = IpReputationService.memBadEvents.get(ip) ?? { count: 0, expiresAt: 0 }
      if (cur.expiresAt < Date.now()) cur.count = 0
      cur.count += 1
      cur.expiresAt = Date.now() + BAD_EVENT_TTL * 1000
      IpReputationService.memBadEvents.set(ip, cur)
      logger.warn('ip-reputation: bad event recorded (mem)', { ip, reason })
      return
    }
    try {
      const key = K_BAD_EVENTS(ip)
      const count = await this.redis.incr(key)
      if (count === 1) await this.redis.expire(key, BAD_EVENT_TTL)
      // 信誉缓存失效,下次查询重新计算
      await this.redis.del(K_REPUTATION(ip))
      logger.warn('ip-reputation: bad event recorded', { ip, reason, count })
    } catch (e) {
      logger.warn('ip-reputation: bad event write failed', { err: e })
    }
  }

  private async getBadEventCount(ip: string): Promise<number> {
    if (!this.redis) {
      const cur = IpReputationService.memBadEvents.get(ip)
      if (!cur || cur.expiresAt < Date.now()) return 0
      return cur.count
    }
    try {
      const raw = await this.redis.get(K_BAD_EVENTS(ip))
      return raw ? Number(raw) : 0
    } catch (e) {
      logger.warn('ip-reputation: bad event read failed', { err: e })
      return 0
    }
  }

  /* ----------------------------- 临时封禁 ----------------------------- */

  async blockIp(ip: string, durationSec: number): Promise<void> {
    if (!ip) return
    const dur = Math.max(1, Math.floor(durationSec))
    if (!this.redis) {
      IpReputationService.memBlocked.set(ip, Date.now() + dur * 1000)
      return
    }
    try {
      await this.redis.set(K_BLOCKED(ip), String(Date.now()), 'EX', dur)
      // 封禁同时记录一次异常事件
      await this.recordBadEvent(ip, 'blocked')
    } catch (e) {
      IpReputationService.memBlocked.set(ip, Date.now() + dur * 1000)
      logger.warn('ip-reputation: block write failed, used mem', { err: e })
    }
  }

  async unblockIp(ip: string): Promise<void> {
    if (!ip) return
    if (!this.redis) {
      IpReputationService.memBlocked.delete(ip)
      return
    }
    try {
      await this.redis.del(K_BLOCKED(ip))
    } catch (e) {
      IpReputationService.memBlocked.delete(ip)
      logger.warn('ip-reputation: unblock failed, used mem', { err: e })
    }
  }

  async isIpBlocked(ip: string): Promise<boolean> {
    if (!ip) return false
    if (!this.redis) {
      const until = IpReputationService.memBlocked.get(ip)
      if (!until) return false
      if (until < Date.now()) {
        IpReputationService.memBlocked.delete(ip)
        return false
      }
      return true
    }
    try {
      const r = await this.redis.exists(K_BLOCKED(ip))
      return r === 1
    } catch (e) {
      const until = IpReputationService.memBlocked.get(ip)
      logger.warn('ip-reputation: block read failed, used mem', { err: e })
      return !!until && until > Date.now()
    }
  }

  /* ----------------------------- ASN ----------------------------- */

  /**
   * 判断给定 ASN 是否在配置的恶意 ASN 列表中。
   * 注:本服务不内置 IP→ASN 解析(需 MaxMind 等 GeoIP 库),由调用方解析 ASN 后传入。
   */
  isAsnMalicious(asn: string): boolean {
    if (!asn) return false
    return MALICIOUS_ASNS.has(asn)
  }

  /* ----------------------------- 内存降级存储 ----------------------------- */

  private static readonly memCache = new Map<
    string,
    { value: IpReputation; expiresAt: number }
  >()
  private static readonly memBlacklist = new Set<string>()
  private static readonly memBadEvents = new Map<
    string,
    { count: number; expiresAt: number }
  >()
  private static readonly memBlocked = new Map<string, number>()
}

/** 单例工厂:便于在无 DI 框架时共享同一服务实例。 */
let singleton: IpReputationService | null = null
export function getIpReputationService(redis: Redis | null): IpReputationService {
  if (!singleton) singleton = new IpReputationService(redis)
  return singleton
}
