/**
 * WebSocket 消息去重工具。
 *
 * 迁移自旧架构 server/app/utils/ws_dedup.py（WsDeduper, LRU + TTL）。
 *
 * 设计：
 * - 基于 Redis SETNX 的消息幂等去重（跨实例生效）
 * - 消息 ID 经 sha256 hash 后作为 Redis key，避免特殊字符与超长 key
 * - SET key value NX EX <ttl>：首次写入返回 OK（非重复），已存在返回 nil（重复）
 * - TTL 默认 5 分钟（300s），到期自动清理，无需 LRU 淘汰
 *
 * 使用：
 *   if (await isDuplicate(msgId)) {
 *     return // 重复消息，忽略
 *   }
 *   // 处理消息...
 */

import { createHash } from 'node:crypto'
import IORedis, { type Redis } from 'ioredis'
import { config } from '../config/index.js'

/** 去重 TTL（秒），默认 5 分钟。 */
const DEFAULT_TTL_SEC = 300

/** Redis key 前缀。 */
const KEY_PREFIX = 'ws:dedup:'

let redisClient: Redis | null = null

/**
 * 获取去重专用 Redis 客户端（惰性单例）。
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
      console.error('[ws-dedup] redis error:', err)
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

/** 将 msgId 哈希为固定长度 Redis key 片段。 */
function hashMsgId(msgId: string): string {
  return createHash('sha256').update(msgId).digest('hex')
}

/**
 * 检查消息是否为重复（并原子性地标记）。
 *
 * 基于 Redis SETNX：首次见到该 msgId 时写入并返回 false（非重复），
 * 再次见到时返回 true（重复）。key 在 TTL 后自动过期。
 *
 * Redis 不可用时降级为"非重复"（放行），避免影响正常消息流。
 *
 * @param msgId 客户端携带的消息唯一 ID（UUID 等）
 * @returns true 表示重复，应忽略；false 表示首次出现，可处理
 */
export async function isDuplicate(msgId: string): Promise<boolean> {
  if (!msgId) return false
  const key = `${KEY_PREFIX}${hashMsgId(msgId)}`
  try {
    // SET key 1 NX EX <ttl>：仅在 key 不存在时设置，并设过期
    // 返回 'OK' 表示设置成功（首次，非重复）；返回 null 表示 key 已存在（重复）
    const result = await getRedis().set(key, '1', 'EX', DEFAULT_TTL_SEC, 'NX')
    return result !== 'OK'
  } catch {
    // Redis 异常时放行，避免阻断业务
    return false
  }
}

/** 仅供测试：重置内部 Redis 单例。 */
export function _resetDedupClient(): void {
  redisClient = null
}
