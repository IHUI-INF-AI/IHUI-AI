/**
 * 异常行为检测服务(国安级风控核心)。
 *
 * 检测维度(每维度返回 score 0-100,加权聚合):
 * 1. 请求频率异常:同 IP / 用户 1 分钟内 > 60 次 → 100
 * 2. 时间分布异常:凌晨密集 + 历史不活跃 → 70
 * 3. 地理位置异常:5 分钟内跨大洲登录 → 90(无 GeoIP 库时用"5 分钟内 IP 前两段剧变"代理)
 * 4. 设备指纹突变:同一用户 1 小时内 ≥3 个新设备 → 80
 * 5. 请求模式异常:URL 序列像扫描器(/admin /backup /test) → 95
 * 6. 用户行为基线:历史平均请求频率 +3σ → 75
 *
 * 输出 recommendation:allow(<30) / monitor(30-60) / challenge(60-80) / block(>80)。
 * 异步更新基线:recordUserBehavior(userId, action)。
 * 基线存储:Redis hash baseline:user:{userId} → { avgReqPerMin, stddev, lastUpdated, sampleCount }。
 *
 * 降级:Redis 不可用时回退内存,检测能力降级但不抛错。
 */

import type { Redis } from 'ioredis'
import { logger } from '../utils/logger.js'
import {
  calculateBehaviorScore,
  isBotUserAgent,
  isCurlLike,
  isHeadlessBrowser,
} from '../utils/bot-detection.js'

/* -------------------------------------------------------------------------- */
/* 类型                                                                        */
/* -------------------------------------------------------------------------- */

export interface AnomalyContext {
  ip: string
  userId?: string
  userAgent?: string
  url: string
  method: string
  referer?: string | null
  hasCookie?: boolean
  timestamp: number
  /** 设备指纹(前端上报,可选) */
  deviceFingerprint?: string
}

export interface AnomalyDimension {
  name: string
  score: number
  weight: number
}

export type AnomalyRecommendation = 'allow' | 'monitor' | 'challenge' | 'block'

export interface AnomalyResult {
  /** 加权综合分 0-100 */
  score: number
  dimensions: AnomalyDimension[]
  recommendation: AnomalyRecommendation
}

export interface AnomalyEvent {
  timestamp: number
  ip: string
  userId?: string
  url: string
  score: number
  recommendation: AnomalyRecommendation
  dimensions: AnomalyDimension[]
}

/* -------------------------------------------------------------------------- */
/* 常量                                                                        */
/* -------------------------------------------------------------------------- */

const WINDOW_1MIN_MS = 60_000
const WINDOW_5MIN_MS = 5 * 60_000
const WINDOW_1H_MS = 60 * 60_000

/** 频率阈值(次/分钟)。 */
const FREQ_THRESHOLD = 60
/** 设备指纹突变阈值(1 小时内新设备数)。 */
const DEVICE_NEW_THRESHOLD = 3

/** 扫描器常见路径特征(命中即高分)。 */
const SCANNER_PATTERNS: readonly string[] = [
  '/.env',
  '/.git',
  '/.aws',
  '/.ssh',
  '/admin',
  '/backup',
  '/wp-admin',
  '/wp-login',
  '/phpmyadmin',
  '/phpinfo',
  '/config',
  '/console',
  '/debug',
  '/test',
  '/.well-known/security',
  '/server-status',
  '/manager/html',
  '/cgi-bin',
  '/actuator',
  '/struts',
  '/solr',
  '/jenkins',
]

const MAX_EVENTS_STORED = 10_000

/* -------------------------------------------------------------------------- */
/* Redis key 命名                                                              */
/* -------------------------------------------------------------------------- */

const K_FREQ_IP = (ip: string) => `anom:freq:ip:${ip}`
const K_FREQ_USER = (uid: string) => `anom:freq:user:${uid}`
const K_URL_SEQ = (ip: string) => `anom:urlseq:${ip}`
const K_DEVICES = (uid: string) => `anom:devices:${uid}`
const K_LAST_IP = (uid: string) => `anom:lastip:${uid}`
const K_LAST_IP_TIME = (uid: string) => `anom:lastip:time:${uid}`
const K_BASELINE = (uid: string) => `baseline:user:${uid}`
const K_EVENTS = 'anomaly:events'
const K_LAST_ACTIVE_HOUR = (uid: string) => `anom:activehour:${uid}`

/* -------------------------------------------------------------------------- */
/* 服务实现                                                                    */
/* -------------------------------------------------------------------------- */

export class AnomalyDetector {
  constructor(private readonly redis: Redis | null) {}

  /* ----------------------------- 主入口 ----------------------------- */

  async detectAnomaly(ctx: AnomalyContext): Promise<AnomalyResult> {
    const ts = ctx.timestamp || Date.now()

    const dimensions: AnomalyDimension[] = [
      { ...(await this.dimRequestFrequency(ctx, ts)), weight: 0.25 },
      { ...(await this.dimTimeDistribution(ctx, ts)), weight: 0.1 },
      { ...(await this.dimGeoAnomaly(ctx, ts)), weight: 0.15 },
      { ...(await this.dimDeviceFingerprint(ctx)), weight: 0.15 },
      { ...(await this.dimRequestPattern(ctx)), weight: 0.2 },
      { ...(await this.dimBehaviorBaseline(ctx, ts)), weight: 0.15 },
    ]

    let totalWeight = 0
    let weighted = 0
    for (const d of dimensions) {
      weighted += d.score * d.weight
      totalWeight += d.weight
    }
    const score = totalWeight > 0 ? Math.round(weighted / totalWeight) : 0

    const recommendation = this.recommendFor(score)

    // 高分事件落库(异步,不阻塞响应)
    if (recommendation !== 'allow') {
      this.recordEvent({
        timestamp: ts,
        ip: ctx.ip,
        userId: ctx.userId,
        url: ctx.url,
        score,
        recommendation,
        dimensions,
      }).catch((e) => logger.warn('anomaly: recordEvent failed', { err: e }))
    }

    return { score, dimensions, recommendation }
  }

  private recommendFor(score: number): AnomalyRecommendation {
    if (score > 80) return 'block'
    if (score > 60) return 'challenge'
    if (score >= 30) return 'monitor'
    return 'allow'
  }

  /* ----------------------------- 维度 1:请求频率 ----------------------------- */

  private async dimRequestFrequency(
    ctx: AnomalyContext,
    ts: number,
  ): Promise<{ name: string; score: number }> {
    const ipCount = await this.slidingWindowCount(K_FREQ_IP(ctx.ip), ts, WINDOW_1MIN_MS)
    const userCount = ctx.userId
      ? await this.slidingWindowCount(K_FREQ_USER(ctx.userId), ts, WINDOW_1MIN_MS)
      : 0
    const max = Math.max(ipCount, userCount)
    let score = 0
    if (max > FREQ_THRESHOLD * 3) score = 100
    else if (max > FREQ_THRESHOLD * 2) score = 90
    else if (max > FREQ_THRESHOLD) score = 70
    else if (max > FREQ_THRESHOLD * 0.7) score = 40
    return { name: 'request-frequency', score }
  }

  private async slidingWindowCount(
    key: string,
    now: number,
    windowMs: number,
  ): Promise<number> {
    if (!this.redis) {
      const arr = AnomalyDetector.memFreq.get(key) ?? []
      const cutoff = now - windowMs
      const kept = arr.filter((t) => t > cutoff)
      AnomalyDetector.memFreq.set(key, kept)
      return kept.length
    }
    try {
      const pipe = this.redis.multi()
      pipe.zremrangebyscore(key, 0, now - windowMs)
      pipe.zcard(key)
      pipe.zadd(key, now, `${now}:${Math.random().toString(36).slice(2)}`)
      pipe.pexpire(key, windowMs)
      const res = await pipe.exec()
      // zcard 是第二条结果
      const card = res?.[1]?.[1]
      return typeof card === 'number' ? card : 0
    } catch (e) {
      logger.warn('anomaly: slidingWindowCount failed', { err: e })
      return 0
    }
  }

  /* ----------------------------- 维度 2:时间分布 ----------------------------- */

  private async dimTimeDistribution(
    ctx: AnomalyContext,
    ts: number,
  ): Promise<{ name: string; score: number }> {
    const hour = new Date(ts).getHours()
    const isLateNight = hour >= 0 && hour < 5
    if (!isLateNight) return { name: 'time-distribution', score: 0 }

    // 查历史活跃时段:若该用户从未在凌晨活跃过 → 可疑
    const historicallyActive = ctx.userId
      ? await this.wasUserActiveAtHour(ctx.userId, hour)
      : false
    let score = 0
    if (ctx.userId && !historicallyActive) score = 70
    else if (!ctx.userId) score = 30
    return { name: 'time-distribution', score }
  }

  private async wasUserActiveAtHour(userId: string, hour: number): Promise<boolean> {
    if (!this.redis) return AnomalyDetector.memActiveHour.get(`${userId}:${hour}`) ?? false
    try {
      const r = await this.redis.exists(K_LAST_ACTIVE_HOUR(userId) + `:${hour}`)
      return r === 1
    } catch (e) {
      logger.warn('anomaly: wasUserActiveAtHour failed', { err: e })
      return false
    }
  }

  /* ----------------------------- 维度 3:地理位置 ----------------------------- */

  private async dimGeoAnomaly(
    ctx: AnomalyContext,
    ts: number,
  ): Promise<{ name: string; score: number }> {
    if (!ctx.userId) return { name: 'geo-anomaly', score: 0 }
    const prevIp = await this.getString(K_LAST_IP(ctx.userId))
    const prevTsStr = await this.getString(K_LAST_IP_TIME(ctx.userId))
    const prevTs = prevTsStr ? Number(prevTsStr) : 0

    if (prevIp && prevIp !== ctx.ip && ts - prevTs < WINDOW_5MIN_MS) {
      // 5 分钟内 IP 变化:用前两段是否剧变做跨网段代理(无 GeoIP 时的降级判断)
      if (ipNetworkSegmentChanged(prevIp, ctx.ip)) {
        // 记录新 IP,返回高分
        await this.setString(K_LAST_IP(ctx.userId), ctx.ip, WINDOW_5MIN_MS / 1000)
        await this.setString(K_LAST_IP_TIME(ctx.userId), String(ts), WINDOW_5MIN_MS / 1000)
        return { name: 'geo-anomaly', score: 90 }
      }
      // 同网段切换(如运营商 NAT 换 IP),低分
      await this.setString(K_LAST_IP(ctx.userId), ctx.ip, WINDOW_5MIN_MS / 1000)
      await this.setString(K_LAST_IP_TIME(ctx.userId), String(ts), WINDOW_5MIN_MS / 1000)
      return { name: 'geo-anomaly', score: 25 }
    }

    if (!prevIp) {
      await this.setString(K_LAST_IP(ctx.userId), ctx.ip, WINDOW_5MIN_MS / 1000)
      await this.setString(K_LAST_IP_TIME(ctx.userId), String(ts), WINDOW_5MIN_MS / 1000)
    }
    return { name: 'geo-anomaly', score: 0 }
  }

  /* ----------------------------- 维度 4:设备指纹 ----------------------------- */

  private async dimDeviceFingerprint(
    ctx: AnomalyContext,
  ): Promise<{ name: string; score: number }> {
    if (!ctx.userId || !ctx.deviceFingerprint) return { name: 'device-fingerprint', score: 0 }
    const key = K_DEVICES(ctx.userId)
    const ttlSec = Math.floor(WINDOW_1H_MS / 1000)

    if (!this.redis) {
      const set = AnomalyDetector.memDevices.get(key) ?? new Set<string>()
      const isNew = !set.has(ctx.deviceFingerprint)
      set.add(ctx.deviceFingerprint)
      AnomalyDetector.memDevices.set(key, set)
      // 简化:内存模式不按 TTL 清理,仅按数量上限
      if (set.size > DEVICE_NEW_THRESHOLD * 2) {
        const first = set.values().next().value
        if (first) set.delete(first)
      }
      return { name: 'device-fingerprint', score: isNew && set.size >= DEVICE_NEW_THRESHOLD ? 80 : 0 }
    }

    try {
      const isNew = (await this.redis.sismember(key, ctx.deviceFingerprint)) === 0
      if (isNew) {
        await this.redis.sadd(key, ctx.deviceFingerprint)
        await this.redis.expire(key, ttlSec)
      }
      const count = await this.redis.scard(key)
      if (isNew && count >= DEVICE_NEW_THRESHOLD) return { name: 'device-fingerprint', score: 80 }
      if (count >= DEVICE_NEW_THRESHOLD * 2) return { name: 'device-fingerprint', score: 50 }
      return { name: 'device-fingerprint', score: 0 }
    } catch (e) {
      logger.warn('anomaly: dimDeviceFingerprint failed', { err: e })
      return { name: 'device-fingerprint', score: 0 }
    }
  }

  /* ----------------------------- 维度 5:请求模式(扫描器) ----------------------------- */

  private async dimRequestPattern(
    ctx: AnomalyContext,
  ): Promise<{ name: string; score: number }> {
    const path = ctx.url.split('?')[0] ?? ctx.url
    const lowerPath = path.toLowerCase()

    // 命中扫描器路径特征 → 立即高分
    for (const pattern of SCANNER_PATTERNS) {
      if (lowerPath.includes(pattern)) {
        return { name: 'request-pattern', score: 95 }
      }
    }

    // 序列模式:记录最近 20 个 URL,若大量命中扫描特征或重复探测同类敏感路径 → 中高分
    const seqKey = K_URL_SEQ(ctx.ip)
    const recent = await this.pushUrlSeq(seqKey, path)
    const scannerHits = recent.filter((u) =>
      SCANNER_PATTERNS.some((p) => u.toLowerCase().includes(p)),
    ).length
    if (scannerHits >= 3) return { name: 'request-pattern', score: 90 }
    if (scannerHits >= 1) return { name: 'request-pattern', score: 55 }

    // UA 为脚本类工具访问敏感端点 → 加分
    if (
      (isCurlLike(ctx.userAgent) || isHeadlessBrowser(ctx.userAgent) || isBotUserAgent(ctx.userAgent)) &&
      (lowerPath.includes('/api/') || lowerPath.includes('/admin'))
    ) {
      return { name: 'request-pattern', score: 60 }
    }

    return { name: 'request-pattern', score: 0 }
  }

  private async pushUrlSeq(key: string, url: string): Promise<string[]> {
    if (!this.redis) {
      const arr = AnomalyDetector.memUrlSeq.get(key) ?? []
      arr.push(url)
      if (arr.length > 20) arr.shift()
      AnomalyDetector.memUrlSeq.set(key, arr)
      return arr
    }
    try {
      const pipe = this.redis.multi()
      pipe.lpush(key, url)
      pipe.ltrim(key, 0, 19)
      pipe.expire(key, Math.floor(WINDOW_5MIN_MS / 1000))
      await pipe.exec()
      const list = await this.redis.lrange(key, 0, 19)
      return list
    } catch (e) {
      logger.warn('anomaly: pushUrlSeq failed', { err: e })
      return AnomalyDetector.memUrlSeq.get(key) ?? []
    }
  }

  /* ----------------------------- 维度 6:行为基线 ----------------------------- */

  private async dimBehaviorBaseline(
    ctx: AnomalyContext,
    ts: number,
  ): Promise<{ name: string; score: number }> {
    if (!ctx.userId) return { name: 'behavior-baseline', score: 0 }
    const baseline = await this.getBaseline(ctx.userId)
    if (!baseline || baseline.sampleCount < 10) {
      // 基线样本不足时,用行为指纹兜底(无客户端事件数据则 0)
      const behaviorScore = calculateBehaviorScore({
        userAgent: ctx.userAgent,
        referer: ctx.referer,
        hasCookie: ctx.hasCookie,
      })
      return { name: 'behavior-baseline', score: Math.min(behaviorScore, 50) }
    }

    const { avgReqPerMin, stddev } = baseline
    // 近 1 分钟请求数(复用频率窗口)
    const recentCount = await this.slidingWindowCount(K_FREQ_USER(ctx.userId), ts, WINDOW_1MIN_MS)
    if (avgReqPerMin <= 0) return { name: 'behavior-baseline', score: 0 }

    const threshold = avgReqPerMin + 3 * stddev
    if (recentCount > threshold && threshold > 0) return { name: 'behavior-baseline', score: 75 }
    if (recentCount > avgReqPerMin + 2 * stddev) return { name: 'behavior-baseline', score: 45 }
    return { name: 'behavior-baseline', score: 0 }
  }

  /* ----------------------------- 基线维护 ----------------------------- */

  /**
   * 异步记录用户行为,用 Welford 在线算法增量更新基线(均值 / 标准差)。
   * 调用方应在请求结束后 fire-and-forget 调用,不阻塞响应。
   */
  async recordUserBehavior(userId: string, action: string): Promise<void> {
    if (!userId) return
    const now = Date.now()
    const baseline = await this.getBaseline(userId)

    // 本分钟请求数 +1(作为新样本)
    const newSample = (baseline?.lastReqPerMin ?? 0) + 1
    let avgReqPerMin: number
    let stddev: number
    let sampleCount: number

    if (!baseline || baseline.sampleCount === 0) {
      avgReqPerMin = newSample
      stddev = 0
      sampleCount = 1
    } else {
      const n = baseline.sampleCount
      const prevAvg = baseline.avgReqPerMin
      const prevVar = baseline.stddev * baseline.stddev
      // Welford 增量
      const delta = newSample - prevAvg
      avgReqPerMin = prevAvg + delta / (n + 1)
      const newVar = (prevVar * (n - 1) + delta * (newSample - avgReqPerMin)) / n
      stddev = Math.sqrt(Math.max(0, newVar))
      sampleCount = n + 1
    }

    await this.setBaseline(userId, {
      avgReqPerMin,
      stddev,
      sampleCount,
      lastUpdated: now,
      lastReqPerMin: newSample,
    })

    // 记录当前活跃小时(供 dimTimeDistribution 判断"历史是否在此时段活跃过")
    const hour = new Date(now).getHours()
    await this.markActiveHour(userId, hour)

    void action
  }

  /** 标记用户在指定小时活跃过(7 天 TTL,覆盖作息周期)。 */
  private async markActiveHour(userId: string, hour: number): Promise<void> {
    const key = K_LAST_ACTIVE_HOUR(userId) + `:${hour}`
    const ttlSec = 7 * 24 * 3600
    if (!this.redis) {
      AnomalyDetector.memActiveHour.set(`${userId}:${hour}`, true)
      return
    }
    try {
      await this.redis.set(key, '1', 'EX', ttlSec)
    } catch (e) {
      AnomalyDetector.memActiveHour.set(`${userId}:${hour}`, true)
      logger.warn('anomaly: markActiveHour failed, used mem', { err: e })
    }
  }

  private async getBaseline(
    userId: string,
  ): Promise<{
    avgReqPerMin: number
    stddev: number
    sampleCount: number
    lastUpdated: number
    lastReqPerMin: number
  } | null> {
    if (!this.redis) {
      return AnomalyDetector.memBaseline.get(userId) ?? null
    }
    try {
      const raw = await this.redis.hgetall(K_BASELINE(userId))
      if (!raw || Object.keys(raw).length === 0) return null
      return {
        avgReqPerMin: Number(raw.avgReqPerMin ?? 0),
        stddev: Number(raw.stddev ?? 0),
        sampleCount: Number(raw.sampleCount ?? 0),
        lastUpdated: Number(raw.lastUpdated ?? 0),
        lastReqPerMin: Number(raw.lastReqPerMin ?? 0),
      }
    } catch (e) {
      logger.warn('anomaly: getBaseline failed', { err: e })
      return null
    }
  }

  private async setBaseline(
    userId: string,
    b: {
      avgReqPerMin: number
      stddev: number
      sampleCount: number
      lastUpdated: number
      lastReqPerMin: number
    },
  ): Promise<void> {
    if (!this.redis) {
      AnomalyDetector.memBaseline.set(userId, b)
      return
    }
    try {
      await this.redis.hset(K_BASELINE(userId), {
        avgReqPerMin: String(b.avgReqPerMin),
        stddev: String(b.stddev),
        sampleCount: String(b.sampleCount),
        lastUpdated: String(b.lastUpdated),
        lastReqPerMin: String(b.lastReqPerMin),
      })
    } catch (e) {
      AnomalyDetector.memBaseline.set(userId, b)
      logger.warn('anomaly: setBaseline failed, used mem', { err: e })
    }
  }

  /* ----------------------------- 事件查询 ----------------------------- */

  async recordEvent(event: AnomalyEvent): Promise<void> {
    if (!this.redis) {
      AnomalyDetector.memEvents.unshift(event)
      if (AnomalyDetector.memEvents.length > 200) AnomalyDetector.memEvents.length = 200
      return
    }
    try {
      const pipe = this.redis.multi()
      pipe.lpush(K_EVENTS, JSON.stringify(event))
      pipe.ltrim(K_EVENTS, 0, MAX_EVENTS_STORED - 1)
      await pipe.exec()
    } catch (e) {
      AnomalyDetector.memEvents.unshift(event)
      logger.warn('anomaly: recordEvent redis failed, used mem', { err: e })
    }
  }

  /**
   * 查询近期异常事件(分页 + 过滤)。
   * limit/offset 控制分页;minScore 过滤最低分;ipFilter 按 IP 过滤。
   */
  async getRecentAnomalies(opts?: {
    limit?: number
    offset?: number
    minScore?: number
    ipFilter?: string
  }): Promise<{ total: number; list: AnomalyEvent[] }> {
    const limit = Math.min(opts?.limit ?? 50, 200)
    const offset = Math.min(opts?.offset ?? 0, MAX_EVENTS_STORED)
    const minScore = opts?.minScore ?? 0
    const ipFilter = opts?.ipFilter

    if (!this.redis) {
      let list = AnomalyDetector.memEvents.slice()
      if (minScore > 0) list = list.filter((e) => e.score >= minScore)
      if (ipFilter) list = list.filter((e) => e.ip === ipFilter)
      const total = list.length
      list = list.slice(offset, offset + limit)
      return { total, list }
    }
    try {
      const raw = await this.redis.lrange(K_EVENTS, 0, MAX_EVENTS_STORED - 1)
      let list: AnomalyEvent[] = []
      for (const s of raw) {
        try {
          list.push(JSON.parse(s) as AnomalyEvent)
        } catch {
          /* skip malformed */
        }
      }
      if (minScore > 0) list = list.filter((e) => e.score >= minScore)
      if (ipFilter) list = list.filter((e) => e.ip === ipFilter)
      const total = list.length
      list = list.slice(offset, offset + limit)
      return { total, list }
    } catch (e) {
      logger.warn('anomaly: getRecentAnomalies failed', { err: e })
      return { total: 0, list: [] }
    }
  }

  /* ----------------------------- KV 辅助 ----------------------------- */

  private async getString(key: string): Promise<string | null> {
    if (!this.redis) {
      const v = AnomalyDetector.memKv.get(key)
      return v && v.expiresAt > Date.now() ? v.value : null
    }
    try {
      return await this.redis.get(key)
    } catch (e) {
      logger.warn('anomaly: getString failed', { err: e })
      return null
    }
  }

  private async setString(key: string, value: string, ttlSec: number): Promise<void> {
    if (!this.redis) {
      AnomalyDetector.memKv.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 })
      return
    }
    try {
      await this.redis.set(key, value, 'EX', ttlSec)
    } catch (e) {
      AnomalyDetector.memKv.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 })
      logger.warn('anomaly: setString failed, used mem', { err: e })
    }
  }

  /* ----------------------------- 内存降级存储 ----------------------------- */

  private static readonly memFreq = new Map<string, number[]>()
  private static readonly memDevices = new Map<string, Set<string>>()
  private static readonly memUrlSeq = new Map<string, string[]>()
  private static readonly memKv = new Map<string, { value: string; expiresAt: number }>()
  private static readonly memBaseline = new Map<
    string,
    {
      avgReqPerMin: number
      stddev: number
      sampleCount: number
      lastUpdated: number
      lastReqPerMin: number
    }
  >()
  private static readonly memActiveHour = new Map<string, boolean>()
  private static readonly memEvents: AnomalyEvent[] = []
}

/* -------------------------------------------------------------------------- */
/* 辅助函数                                                                    */
/* -------------------------------------------------------------------------- */

/** 判断两个 IP 是否网段剧变(前两段不同视为跨网段,作为"跨大洲"的降级代理)。 */
function ipNetworkSegmentChanged(a: string, b: string): boolean {
  const pa = a.replace(/^::ffff:/, '').split('.')
  const pb = b.replace(/^::ffff:/, '').split('.')
  if (pa.length !== 4 || pb.length !== 4) {
    // 非 IPv4,字符串不同即视为变化
    return a !== b
  }
  return pa[0] !== pb[0] || pa[1] !== pb[1]
}

/** 单例工厂。 */
let singleton: AnomalyDetector | null = null
export function getAnomalyDetector(redis: Redis | null): AnomalyDetector {
  if (!singleton) singleton = new AnomalyDetector(redis)
  return singleton
}
