// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SSE 流注册表状态层(2026-09-19 立,多副本部署就绪,#22 的多副本演进)。
 *
 * 架构:连接绑定层(sse-stream-registry.ts)+ 可插拔状态层(本文件)。
 * - 连接绑定层持有不可序列化资源(raw socket / AbortController / 宽限定时器),
 *   永远留在本进程;对外同步 API 签名不变。
 * - 状态层只共享三类可序列化状态:
 *   ①回放帧(Redis List,旁路异步复制,本地镜像始终存在——同副本 takeover 仍是
 *     零延迟同步读,跨副本重连兜底走异步 fetchReplayEvents)
 *   ②会话元数据(跨副本可见流的归属/上游会话 ID,供 steer 转发等场景)
 *   ③abort 广播(Pub/Sub,各副本订阅后对本进程持有连接的会话执行 abort)
 *
 * 后端选择(config.SSE_REGISTRY_BACKEND):
 * - memory(默认):全部委托 sse-replay-buffer.ts 现有函数,行为与改造前完全一致。
 * - redis:本地双写(旁路)+ 跨副本共享。Redis 异常时静默降级(本地镜像兜底,
 *   回放/重放不中断,仅失去跨副本能力),warn 一次不刷屏。
 */

import IORedis, { type Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { config } from '../config/index.js'
import { logger } from './logger.js'
import {
  getEventsAfter,
  pushEvent,
  registerStream,
  releaseStream,
  type ReplayEvent,
} from './sse-replay-buffer.js'

/** 本副本标识(进程级;跨副本 abort 广播的自回环判定与会话元数据归属)。 */
export const SSE_REPLICA_ID = randomUUID()

/** 跨副本可见的会话元数据(不含 controller/raw 等进程内资源)。 */
export interface SseSessionMeta {
  /** replayKey = `${conversationId}:${messageId}` */
  replayKey: string
  /** 归属副本(流的本进程持有者) */
  replicaId: string
  /** 网关预生成的上游会话 ID(steer 端点凭此拼 ai-service 转发地址) */
  upstreamSessionId: string | null
  /** 登记时间(毫秒) */
  createdAt: number
}

/** abort 广播消息(频道 payload)。 */
export interface SseAbortBroadcast {
  conversationId: string
  /** 精确 messageId;null = 中止该会话下所有流 */
  messageId: string | null
  /** 发起副本;订阅方跳过自己发的(自回环避免) */
  fromReplicaId: string
}

/**
 * 状态层接口:回放帧热路径方法为同步(Redis 实现内部旁路异步复制,不阻塞写帧);
 * 跨副本读取(带 Remote/Fetch 语义)为异步,供未来接线,不进现有同步调用路径。
 */
export interface SseStateStore {
  readonly backend: 'memory' | 'redis'

  // —— 回放帧(热路径,同步;实现保证本地镜像始终有写) ——
  /** 注册流缓冲(清旧缓冲 + 取消其待释放定时器)。 */
  registerStream(replayKey: string): void
  /** 追加回放帧(带上限裁剪语义)。 */
  appendReplayEvent(replayKey: string, event: ReplayEvent): void
  /** 调度缓冲释放(流结束后保留窗口,供 Last-Event-ID 重放)。 */
  releaseStream(replayKey: string): void

  // —— 跨副本回放读取(异步;memory 实现等价本地同步读的 Promise 包装) ——
  fetchReplayEvents(replayKey: string, seq: number): Promise<ReplayEvent[]>

  // —— 会话元数据(跨副本可见;memory 实现为进程内 Map) ——
  upsertSessionMeta(meta: SseSessionMeta): void
  deleteSessionMeta(replayKey: string): void
  fetchSessionMeta(replayKey: string): Promise<SseSessionMeta | null>

  // —— abort 广播(memory 实现下无远端,no-op) ——
  publishAbort(broadcast: SseAbortBroadcast): void
  /** 订阅远端 abort(绑定层注入本地执行回调;幂等,重复调用覆盖)。 */
  onRemoteAbort(handler: (broadcast: SseAbortBroadcast) => void): void

  /** 生命周期:进程退出/插件 onClose 时断开连接(memory 实现 no-op)。 */
  dispose(): void
}

// ---------------------------------------------------------------------------
// Memory 实现:全部委托 sse-replay-buffer.ts(行为与抽象化改造前完全一致)
// ---------------------------------------------------------------------------

class MemorySseStateStore implements SseStateStore {
  readonly backend = 'memory' as const
  /** 进程内元数据镜像(单副本场景仅保接口完整性;跨副本需求由 Redis 实现满足) */
  private readonly metaByReplayKey = new Map<string, SseSessionMeta>()

  registerStream(replayKey: string): void {
    registerStream(replayKey)
  }

  appendReplayEvent(replayKey: string, event: ReplayEvent): void {
    pushEvent(replayKey, event)
  }

  releaseStream(replayKey: string): void {
    releaseStream(replayKey)
  }

  async fetchReplayEvents(replayKey: string, seq: number): Promise<ReplayEvent[]> {
    return getEventsAfter(replayKey, seq)
  }

  upsertSessionMeta(meta: SseSessionMeta): void {
    this.metaByReplayKey.set(meta.replayKey, meta)
  }

  deleteSessionMeta(replayKey: string): void {
    this.metaByReplayKey.delete(replayKey)
  }

  async fetchSessionMeta(replayKey: string): Promise<SseSessionMeta | null> {
    return this.metaByReplayKey.get(replayKey) ?? null
  }

  /** 单副本无远端:广播即本地执行(本地执行由绑定层 abortConversationStreams 完成),无订阅对象。 */
  publishAbort(): void {
    /* no-op */
  }

  onRemoteAbort(): void {
    /* no-op:memory 下没有远端消息源 */
  }

  dispose(): void {
    this.metaByReplayKey.clear()
  }
}

// ---------------------------------------------------------------------------
// Redis 实现:本地双写(旁路复制,失败静默降级)+ 跨副本共享 + Pub/Sub abort
// ---------------------------------------------------------------------------

/** 回放帧 List 上限(与 sse-replay-buffer 的 MAX_EVENTS_PER_STREAM 对齐)。 */
const REDIS_MAX_EVENTS_PER_STREAM = 2000
/** 缓冲整体 TTL(秒):60s 保留窗口 + 流进行中不断续期,兜底防泄漏。 */
const REDIS_BUFFER_TTL_SEC = 300
/** 元数据 TTL(秒):流进行中续期;异常退出后自动清理。 */
const REDIS_META_TTL_SEC = 600

const KEY_PREFIX = 'sse:'
const REPLAY_KEY = (replayKey: string) => `${KEY_PREFIX}replay:${replayKey}`
const SESSION_KEY = (replayKey: string) => `${KEY_PREFIX}session:${replayKey}`
/** abort 广播频道(专用订阅连接,与命令连接隔离)。 */
const ABORT_CHANNEL = `${KEY_PREFIX}abort`

class RedisSseStateStore implements SseStateStore {
  readonly backend = 'redis' as const
  private commandClient: Redis | null = null
  private subscriberClient: Redis | null = null
  private abortHandler: ((b: SseAbortBroadcast) => void) | null = null
  /** 降级提示只记一次(Redis 恢复后重置,避免刷屏)。 */
  private degradedWarned = false

  /** 命令连接惰性单例(参照 ws-replay-buffer:自建独立连接 + 优雅退出)。 */
  private getRedis(): Redis {
    if (!this.commandClient) {
      const client = new IORedis(config.REDIS_URL, {
        maxRetriesPerRequest: null,
        lazyConnect: false,
      })
      client.on('error', (err) => {
        logger.error('[sse-state-store] redis error', { error: err })
      })
      const quit = (): void => {
        client.quit().catch(() => {
          /* ignore */
        })
      }
      process.once('SIGTERM', quit)
      process.once('SIGINT', quit)
      this.commandClient = client
    }
    return this.commandClient
  }

  /** 订阅连接(订阅模式的连接不能再发普通命令,须独立于命令连接)。 */
  private getSubscriber(): Redis {
    if (!this.subscriberClient) {
      const sub = this.getRedis().duplicate()
      sub.on('error', (err) => {
        logger.error('[sse-state-store] subscriber error', { error: err })
      })
      void sub.subscribe(ABORT_CHANNEL)
      sub.on('message', (_channel: string, message: string) => {
        try {
          const broadcast = JSON.parse(message) as SseAbortBroadcast
          if (broadcast.fromReplicaId === SSE_REPLICA_ID) return // 自回环跳过
          this.abortHandler?.(broadcast)
        } catch {
          /* 损坏消息跳过 */
        }
      })
      const quit = (): void => {
        sub.quit().catch(() => {
          /* ignore */
        })
      }
      process.once('SIGTERM', quit)
      process.once('SIGINT', quit)
      this.subscriberClient = sub
    }
    return this.subscriberClient
  }

  /** 旁路操作统一封装:本地镜像始终先写(兜底),Redis 失败静默降级 + 一次性 warn。 */
  private sideEffect(op: (redis: Redis) => Promise<unknown>): void {
    try {
      // getRedis() 同步返回连接(惰性建立);op 的 Promise 失败才走降级
      void op(this.getRedis()).catch((err: unknown) => this.warnDegradedOnce(err))
    } catch (err) {
      this.warnDegradedOnce(err)
    }
  }

  private warnDegradedOnce(err: unknown): void {
    if (this.degradedWarned) return
    this.degradedWarned = true
    logger.warn('[sse-state-store] redis 旁路写入失败,已降级为本地镜像(跨副本能力暂不可用)', {
      error: err,
    })
  }

  registerStream(replayKey: string): void {
    // 本地镜像:清旧缓冲(现状行为);远端:DEL 旧 List,随首帧重建
    registerStream(replayKey)
    this.sideEffect((redis) => redis.del(REPLAY_KEY(replayKey), SESSION_KEY(replayKey)))
  }

  appendReplayEvent(replayKey: string, event: ReplayEvent): void {
    // 本地镜像先行(同副本 takeover 仍是同步零延迟读)
    pushEvent(replayKey, event)
    // 远端旁路:RPUSH + LTRIM + EXPIRE pipeline(RTT 合并),fire-and-forget
    this.sideEffect((redis) => {
      const key = REPLAY_KEY(replayKey)
      const pipe = redis.pipeline()
      pipe.rpush(key, JSON.stringify(event))
      pipe.ltrim(key, -REDIS_MAX_EVENTS_PER_STREAM, -1)
      pipe.expire(key, REDIS_BUFFER_TTL_SEC)
      return pipe.exec()
    })
  }

  releaseStream(replayKey: string): void {
    releaseStream(replayKey)
    // 远端对齐 60s 保留窗口后自动过期
    this.sideEffect((redis) => redis.expire(REPLAY_KEY(replayKey), 60))
  }

  async fetchReplayEvents(replayKey: string, seq: number): Promise<ReplayEvent[]> {
    try {
      const rawList = await this.getRedis().lrange(REPLAY_KEY(replayKey), 0, -1)
      const result: ReplayEvent[] = []
      for (const item of rawList) {
        try {
          const event = JSON.parse(item) as ReplayEvent
          if (event.id > seq) result.push(event)
        } catch {
          /* 损坏条目跳过 */
        }
      }
      return result
    } catch {
      return []
    }
  }

  upsertSessionMeta(meta: SseSessionMeta): void {
    // 元数据为小对象整体读写,直接 String JSON(无部分字段更新需求)
    this.sideEffect((redis) =>
      redis.set(SESSION_KEY(meta.replayKey), JSON.stringify(meta), 'EX', REDIS_META_TTL_SEC),
    )
  }

  deleteSessionMeta(replayKey: string): void {
    this.sideEffect((redis) => redis.del(SESSION_KEY(replayKey)))
  }

  async fetchSessionMeta(replayKey: string): Promise<SseSessionMeta | null> {
    try {
      const raw = await this.getRedis().get(SESSION_KEY(replayKey))
      return raw ? (JSON.parse(raw) as SseSessionMeta) : null
    } catch {
      return null
    }
  }

  publishAbort(broadcast: SseAbortBroadcast): void {
    this.sideEffect((redis) => redis.publish(ABORT_CHANNEL, JSON.stringify(broadcast)))
  }

  onRemoteAbort(handler: (broadcast: SseAbortBroadcast) => void): void {
    this.abortHandler = handler
    // 触发订阅连接建立(handler 已注入,首条远端消息即可执行)
    this.getSubscriber()
  }

  dispose(): void {
    this.abortHandler = null
    this.commandClient?.quit().catch(() => {
      /* ignore */
    })
    this.subscriberClient?.quit().catch(() => {
      /* ignore */
    })
    this.commandClient = null
    this.subscriberClient = null
  }
}

// ---------------------------------------------------------------------------
// 工厂:模块级单例,按 config.SSE_REGISTRY_BACKEND 选择实现(默认 memory)
// ---------------------------------------------------------------------------

let storeInstance: SseStateStore | null = null

/** 获取状态层单例(绑定层与 sse-registry 插件共用同一实例)。 */
export function getSseStateStore(): SseStateStore {
  if (!storeInstance) {
    storeInstance =
      config.SSE_REGISTRY_BACKEND === 'redis' ? new RedisSseStateStore() : new MemorySseStateStore()
  }
  return storeInstance
}

/** 仅供测试:重置单例(切换 backend 后重建)。 */
export function _resetSseStateStore(): void {
  storeInstance?.dispose()
  storeInstance = null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
