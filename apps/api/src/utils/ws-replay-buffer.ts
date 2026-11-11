// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WebSocket 消息回放缓冲工具。
 *
 * 迁移自旧架构 server/app/utils/ws_replay_buffer.py（WsReplayBuffer, Redis List）。
 *
 * 场景：客户端断线重连后，服务端补发其离线期间错过的消息。
 *
 * 设计：
 * - Redis List 存储每个房间最近 N 条消息（RPUSH + LTRIM）
 * - 每条消息以 JSON 封装 { ts, seq, data }，按游标过滤
 * - 断线重连时调用 replayMessages(roomId, since) 取 since 之后的消息；
 *   新客户端可再带 sinceSeq 精确到同毫秒内的先后（F-712）
 * - List 设 TTL（30 分钟），空闲房间自动清理
 *
 * 使用：
 *   await bufferMessage('room_xxx', { text: 'hi' })
 *   // 重连时（旧游标只带 ts，同刻消息会重复补发，客户端按 id 去重）：
 *   const missed = await replayMessages('room_xxx', lastTs)
 *   // 新游标同时带 ts 与 seq，同毫秒不漏也不重：
 *   const missed = await replayMessages('room_xxx', lastTs, lastSeq)
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
  /** F-712：进程内单调递增序号，用于同毫秒内破平。老版本写入的条目不携带。 */
  seq?: number
  data: unknown
}

/**
 * F-712：进程内单调递增序号。
 *
 * 毫秒时间戳不唯一（流式分片常在同一毫秒落多条），只靠 ts 无法区分先后。
 * 该计数器不跨进程持久化：进程/Redis 重启后从 1 重来，因此只能在 ts 相等时作为
 * 破平依据，绝不能单独当游标（否则重启后 seq 回退会漏帧）。
 */
let nextSeq = 1

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
 * 获取回放缓冲专用 Redis 客户端（惰性单例）。
 *
 * 工具层不持有 FastifyInstance 引用，自建独立连接。
 * 进程退出时优雅断开，避免连接泄漏。
 */
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new IORedis(config.REDIS_URL, REDIS_OPTIONS)
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
  const envelope: BufferedMessage = { ts: Date.now(), seq: nextSeq++, data: msg }
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
 * 判断缓冲条目是否落在客户端游标之后。
 *
 * 两种游标兼容语义（F-712）：
 * - 新游标 { since(ts), sinceSeq }：`ts > since || (ts === since && seq > sinceSeq)`。
 *   seq 只在 ts 相等时破平——它是进程内计数，重启后从 1 重来，若让 seq 跨 ts 生效，
 *   重启后序号回退会让高 ts 的新消息被判为"已收到"而漏发。
 * - 旧游标 { since(ts) }（sinceSeq 缺省）：退化为 `ts >= since`。同一毫秒的消息全部
 *   重发，宁可重复（客户端按消息 id 去重）也不漏帧；旧实现用 `>` 会把同刻整批吞掉。
 * 老版本写入的 envelope 没有 seq：同刻时无法判先后，按"补发"处理（同样宁重勿漏）。
 */
function isAfterCursor(env: BufferedMessage, since: number, sinceSeq?: number): boolean {
  if (sinceSeq === undefined) return env.ts >= since
  if (env.ts > since) return true
  if (env.ts < since) return false
  return typeof env.seq === 'number' ? env.seq > sinceSeq : true
}

/**
 * 回放房间中游标之后的消息。
 *
 * 读取全部缓冲并按游标过滤，返回有序消息体数组。
 * Redis 不可用时返回空数组。
 *
 * @param roomId 房间 ID
 * @param since 上次收到的消息时间戳（毫秒）；传 0 回放全部缓冲
 * @param sinceSeq 可选的同刻序号（上次收到的消息的 envelope.seq）。
 *   缺省时走旧口径 `ts >= since`（同刻重发，不丢）；给出时按
 *   `ts > since || (ts === since && seq > sinceSeq)` 精确续传。
 * @returns 消息体数组（按时间升序）
 */
export async function replayMessages(
  roomId: string,
  since: number,
  sinceSeq?: number,
): Promise<unknown[]> {
  if (!roomId) return []
  const key = listKey(roomId)
  try {
    const rawList = await getRedis().lrange(key, 0, -1)
    const result: unknown[] = []
    // lrange 返回最新在尾，原始顺序即时间升序
    for (const item of rawList) {
      try {
        const env = JSON.parse(item) as BufferedMessage
        if (isAfterCursor(env, since, sinceSeq)) {
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
