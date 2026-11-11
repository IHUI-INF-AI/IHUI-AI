// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/**
 * 窗口内最大消息数（msg/sec），硬上限，超出即限流。
 *
 * F-711 选型：不做「30/s 稳态 + 50 突发」令牌桶，只保留单一 30/s 阈值。
 * 理由：旧代码两档阈值顺序判断且 BURST(50) > MAX_PER_WINDOW(30)，等价单一
 * `count <= 50`，稳态被抬到 50/s（比设计高 67%）；而本机 messageRateLimiter
 * 已按每用户 60 条/分钟收口，跨实例窗口只需与设计口径一致的共享硬上限，
 * 产品不接受额外突发，故删除突发档（见 5828640196）。
 */
const MAX_PER_WINDOW = 30

/** ZSET TTL（秒），空闲后自动清理。 */
const KEY_TTL_SEC = 10

/** Redis key 前缀。 */
const KEY_PREFIX = 'ws:rate:'

let redisClient: Redis | null = null

/** F-285:Redis 不可达时命令必须快速 reject 走 catch 降级,不得永久挂起。 */
const REDIS_OPTIONS = {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  commandTimeout: 1000,
  connectTimeout: 1000,
  lazyConnect: false,
} as const

/**
 * 获取限流专用 Redis 客户端（惰性单例）。
 *
 * 工具层不持有 FastifyInstance 引用，自建独立连接。
 * 进程退出时优雅断开，避免连接泄漏。
 */
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new IORedis(config.REDIS_URL, REDIS_OPTIONS)
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
 * 未超 MAX_PER_WINDOW 放行；超出则限流。
 *
 * Redis 不可用时降级为放行（返回 true），避免影响正常连接。
 *
 * @param userId 用户 ID
 * @param roomId 房间 ID
 * @param nowMs 当前毫秒时间戳，仅测试注入可控时钟用，默认 Date.now()
 * @returns true 表示允许发送，false 表示被限流
 */
export async function checkWsRateLimit(
  userId: string,
  roomId: string,
  nowMs: number = Date.now()
): Promise<boolean> {
  if (!userId || !roomId) return true
  const key = rateKey(userId, roomId)
  const now = nowMs
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
    // 窗口计数含本条消息：未超上限放行，超出即限流
    return count <= MAX_PER_WINDOW
  } catch {
    // Redis 异常时放行
    return true
  }
}

/** 仅供测试：重置内部 Redis 单例。 */
export function _resetRateLimitClient(): void {
  redisClient = null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
