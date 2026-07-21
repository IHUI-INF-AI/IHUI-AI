/**
 * WebSocket 消息限流工具。
 *
 * 迁移自旧架构 server/app/utils/ws_rate_limit.py（ConnRateLimiter + 跨实例用户限流）。
 *
 * 设计：
 * - 基于 Redis 有序集合（ZSET）的滑动窗口限流
 * - 维度：每用户 + 每房间（key = ws:rate:{userId}:{roomId}）
 * - 每个请求以当前毫秒时间戳为 ZSET member（同毫秒追加唯一后缀避免覆盖）
 * - ZREMRANGEBYSCORE 清理窗口外旧记录，ZCARD 统计窗口内计数
 * - 超过阈值返回 false（限流），否则返回 true（放行）
 *
 * 使用：
 *   if (!(await checkWsRateLimit(userId, roomId))) {
 *     socket.close(4009, '消息发送过快')
 *   }
 */

import IORedis, { type Redis } from 'ioredis'
import { randomBytes } from 'node:crypto'
import { config } from '../config/index.js'
import { logger } from './logger.js'

/** 窗口大小（毫秒），默认 1 秒。 */
const WINDOW_MS = 1000

/** 窗口内最大消息数（msg/sec）。 */
const MAX_PER_WINDOW = 30

/** 短时突发上限。 */
const BURST = 50

/** ZSET TTL（秒），空闲后自动清理。 */
const KEY_TTL_SEC = 10

/** Redis key 前缀。 */
const KEY_PREFIX = 'ws:rate:'

let redisClient: Redis | null = null

/**
 * 获取限流专用 Redis 客户端（惰性单例）。
 *
 * 工具层不持有 FastifyInstance 引用，自建独立连接。
 * 进程退出时优雅断开，避免连接泄漏。
 */
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    })
    redisClient.on('error', (err) => {
      logger.error('[ws-rate-limit] redis error', { error: err })
    })
    const quit = (): void => {
      redisClient?.quit().catch(() => {
        /* ignore */
      })
    }
    process.once('SIGTERM', quit)
    process.once('SIGINT', quit)
  }
  return redisClient
}

function rateKey(userId: string, roomId: string): string {
  return `${KEY_PREFIX}${userId}:${roomId}`
}

/**
 * 检查 WS 消息发送频率是否超限（滑动窗口）。
 *
 * 基于 Redis ZSET：移除窗口外旧记录后统计当前计数，
 * 未超 MAX_PER_WINDOW 放行；允许短时突发至 BURST；超出则限流。
 *
 * Redis 不可用时降级为放行（返回 true），避免影响正常连接。
 *
 * @param userId 用户 ID
 * @param roomId 房间 ID
 * @returns true 表示允许发送，false 表示被限流
 */
export async function checkWsRateLimit(userId: string, roomId: string): Promise<boolean> {
  if (!userId || !roomId) return true
  const key = rateKey(userId, roomId)
  const now = Date.now()
  const windowStart = now - WINDOW_MS
  // 同毫秒内多消息:追加 CSPRNG 随机后缀保证 member 唯一
  // 2026-07-21 安全审计加固:用 randomBytes 替代 Math.random,
  // 防止 CWE-330 可预测随机漏洞(限流键可被预测 → 绕过限流)
  const member = `${now}:${randomBytes(4).toString('hex')}`
  try {
    const redis = getRedis()
    const pipe = redis.pipeline()
    pipe.zremrangebyscore(key, 0, windowStart)
    pipe.zadd(key, now, member)
    pipe.zcard(key)
    pipe.pexpire(key, KEY_TTL_SEC * 1000)
    const results = await pipe.exec()
    if (!results) return true
    // zcard 是第 3 条命令（index 2）
    const cardRes = results[2]
    if (!cardRes) return true
    const count = Number(cardRes[1])
    if (Number.isNaN(count)) return true
    // 正常窗口内放行；突发上限内放行；超出限流
    if (count <= MAX_PER_WINDOW) return true
    if (count <= BURST) return true
    return false
  } catch {
    // Redis 异常时放行
    return true
  }
}

/** 仅供测试：重置内部 Redis 单例。 */
export function _resetRateLimitClient(): void {
  redisClient = null
}
