/**
 * WebSocket 消息回放缓冲工具。
 *
 * 迁移自旧架构 server/app/utils/ws_replay_buffer.py（WsReplayBuffer, Redis List）。
 *
 * 场景：客户端断线重连后，服务端补发其离线期间错过的消息。
 *
 * 设计：
 * - Redis List 存储每个房间最近 N 条消息（RPUSH + LTRIM）
 * - 每条消息以 JSON 封装 { ts, data }，按时间戳过滤
 * - 断线重连时调用 replayMessages(roomId, since) 取 since 之后的消息
 * - List 设 TTL（30 分钟），空闲房间自动清理
 *
 * 使用：
 *   await bufferMessage('room_xxx', { text: 'hi' })
 *   // 重连时：
 *   const missed = await replayMessages('room_xxx', lastTs)
 */

import IORedis, { type Redis } from 'ioredis'
import { config } from '../config/index.js'
import { logger } from './logger.js'

/** 每个房间保留的最大消息条数。 */
const MAX_PER_ROOM = 500

/** List TTL（秒），默认 30 分钟。 */
const TTL_SEC = 30 * 60

/** Redis key 前缀。 */
const KEY_PREFIX = 'ws:replay:'

interface BufferedMessage {
  ts: number
  data: unknown
}

let redisClient: Redis | null = null

/**
 * 获取回放缓冲专用 Redis 客户端（惰性单例）。
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
      logger.error('[ws-replay-buffer] redis error', { error: err })
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

function listKey(roomId: string): string {
  return `${KEY_PREFIX}${roomId}`
}

/**
 * 缓冲一条消息到房间回放队列。
 *
 * 写入后立即 LTRIM 保留最近 N 条，并刷新 TTL。
 * Redis 不可用时静默降级（消息不入缓冲，重连时无法回放）。
 *
 * @param roomId 房间 ID
 * @param msg 消息体（任意可序列化对象）
 */
export async function bufferMessage(roomId: string, msg: unknown): Promise<void> {
  if (!roomId) return
  const key = listKey(roomId)
  const envelope: BufferedMessage = { ts: Date.now(), data: msg }
  try {
    const redis = getRedis()
    // pipeline 减少 RTT：RPUSH + LTRIM + EXPIRE
    const pipe = redis.pipeline()
    pipe.rpush(key, JSON.stringify(envelope))
    pipe.ltrim(key, -MAX_PER_ROOM, -1)
    pipe.expire(key, TTL_SEC)
    await pipe.exec()
  } catch {
    // Redis 异常时静默降级
  }
}

/**
 * 回放房间中 since（毫秒时间戳）之后的消息。
 *
 * 读取全部缓冲并按 ts 过滤，返回有序消息体数组。
 * Redis 不可用时返回空数组。
 *
 * @param roomId 房间 ID
 * @param since 上次收到的消息时间戳（毫秒）；传 0 回放全部缓冲
 * @returns 消息体数组（按时间升序）
 */
export async function replayMessages(roomId: string, since: number): Promise<unknown[]> {
  if (!roomId) return []
  const key = listKey(roomId)
  try {
    const rawList = await getRedis().lrange(key, 0, -1)
    const result: unknown[] = []
    // lrange 返回最新在尾，原始顺序即时间升序
    for (const item of rawList) {
      try {
        const env = JSON.parse(item) as BufferedMessage
        if (env.ts > since) {
          result.push(env.data)
        }
      } catch {
        /* 损坏条目跳过 */
      }
    }
    return result
  } catch {
    return []
  }
}

/** 仅供测试：重置内部 Redis 单例。 */
export function _resetReplayClient(): void {
  redisClient = null
}
