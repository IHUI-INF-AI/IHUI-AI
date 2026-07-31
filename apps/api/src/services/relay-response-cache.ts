/**
 * 响应缓存服务(基于 Redis)——省钱大法。
 *
 * 待主 agent 在 v1-public.ts 集成:对非流式 /v1/chat/completions 请求启用缓存,
 * 命中缓存直接返回,不调用上游,不计费。
 *
 * 设计:
 * - 仅缓存 stream:false 的非流式响应
 * - 缓存 key = relay:cache:<modelSlug>:<sha256(params).slice(0,32)>
 * - TTL 默认 1 天(86400s),可配置 RELAY_CACHE_TTL_SEC
 * - 统计(hits/misses/savedCostCents)持久化到 Redis,跨实例共享
 * - 严禁缓存:流式响应 / 工具调用响应 / 图像请求 / 大请求(>8KB)
 *
 * 统计 key 用 relay:cache-stats: 前缀(连字符),与 relay:cache: 前缀(冒号)区分,
 * 使 invalidatePattern('relay:cache:*') 不会误删统计,estimateSize 只数响应 key。
 *
 * 集成示例(v1-public.ts):
 *   const cache = getRelayResponseCache()
 *   if (cache) {
 *     const skip = shouldSkipCache({ stream, messages, tools, bypassHeader: req.headers['x-cache-bypass'] })
 *     if (!skip.skip) {
 *       const key = computeCacheKey({ model, messages, temperature, ... })
 *       const cached = await cache.get<ChatCompletionResponse>(key)
 *       if (cached.hit) {
 *         await cache.incrHits()
 *         await cache.incrSavedCost(savedCents)
 *         return reply.send(cached.data)
 *       }
 *       await cache.incrMisses()
 *       // ... 调用上游 ...
 *       await cache.set(key, response)
 *     }
 *   }
 */
import { createHash } from 'node:crypto'

import IORedis, { type Redis } from 'ioredis'

import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'
import type { MultimodalContentBlock } from '@ihui/types'

/** Redis 客户端类型别名(对齐 ioredis Redis) */
export type RedisClient = Redis

/** 响应缓存 key 前缀(冒号分隔,modelSlug 作为第二段,支持按模型批量失效) */
const KEY_PREFIX = 'relay:cache:'
/** 统计 key 前缀(用连字符避免被 relay:cache:* 通配命中) */
const STATS_PREFIX = 'relay:cache-stats:'
const STATS_HITS = `${STATS_PREFIX}hits`
const STATS_MISSES = `${STATS_PREFIX}misses`
const STATS_SAVED_CENTS = `${STATS_PREFIX}saved_cents`

/** 默认 TTL(1 天) */
const DEFAULT_TTL_SEC = 86400
/** 默认内存上限(MB,软上限,实际淘汰由 Redis server maxmemory 策略保障) */
const DEFAULT_MAX_SIZE_MB = 100
/** 请求体最大字节数(超过则跳过缓存,避免缓存大请求) */
const MAX_REQUEST_BYTES = 8 * 1024
/** SCAN 单次迭代建议 count */
const SCAN_COUNT = 200
/** 批量 DEL 每批大小(避免大 DEL 阻塞 Redis) */
const DEL_BATCH_SIZE = 100

/**
 * 缓存键计算用的消息(兼容 OpenAI 多模态格式)。
 *
 * `@ihui/types` 的 `ChatMessage`(`{ role, content: string }`)可直接赋值给本类型;
 * OpenAI 多模态格式的 content 为内容块数组(`MultimodalContentBlock[]`),也兼容。
 */
export interface CacheableMessage {
  role: string
  content: string | MultimodalContentBlock[]
}

/** computeCacheKey 入参 */
export interface ComputeCacheKeyParams {
  model: string
  messages: CacheableMessage[]
  temperature?: number
  top_p?: number
  max_tokens?: number
  presence_penalty?: number
  frequency_penalty?: number
  seed?: number
  response_format?: unknown
  tools?: unknown
  tool_choice?: unknown
}

/** shouldSkipCache 入参 */
export interface ShouldSkipCacheParams {
  /** 是否流式请求(stream:true 不缓存) */
  stream?: boolean
  messages: CacheableMessage[]
  /** 请求携带的 tools(工具调用结果依赖外部状态,不可缓存) */
  tools?: unknown
  /** X-Cache-Bypass header 值 */
  bypassHeader?: string
}

/** shouldSkipCache 返回 */
export interface CacheSkipResult {
  skip: boolean
  reason?: string
}

/** 缓存命中/未命中判别联合类型 */
export type CacheGetResult<T> = { hit: true; data: T } | { hit: false }

/** 缓存统计快照 */
export interface CacheStats {
  hits: number
  misses: number
  hitRate: number
  size: number
  savedCostCents: number
}

/** 从 env 读取的缓存配置 */
interface RelayCacheEnvConfig {
  enabled: boolean
  ttlSec: number
  maxSizeMb: number
}

/** 从 process.env 读取缓存配置(env 变量未在 zod config 中声明,直接读) */
function loadCacheConfig(): RelayCacheEnvConfig {
  const enabled = process.env.RELAY_CACHE_ENABLED === 'true'
  const ttlRaw = Number.parseInt(process.env.RELAY_CACHE_TTL_SEC ?? '', 10)
  const ttlSec = Number.isFinite(ttlRaw) && ttlRaw >= 60 ? ttlRaw : DEFAULT_TTL_SEC
  const sizeRaw = Number.parseInt(process.env.RELAY_CACHE_MAX_SIZE_MB ?? '', 10)
  const maxSizeMb = Number.isFinite(sizeRaw) && sizeRaw >= 1 ? sizeRaw : DEFAULT_MAX_SIZE_MB
  return { enabled, ttlSec, maxSizeMb }
}

/** 将模型名转为 URL 安全的 slug(用于 key 分段,支持按模型批量失效) */
function slugifyModel(model: string): string {
  return model.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase()
}

/** 判断内容块是否为媒体类型(图片/视频/音频,含 base64,不可缓存) */
function isMediaBlock(block: MultimodalContentBlock): boolean {
  return (
    block.type === 'image_url' ||
    block.type === 'input_image' ||
    block.type === 'input_video' ||
    block.type === 'input_audio'
  )
}

/** 检测 messages 是否包含图像/媒体内容(base64 太大,不缓存) */
function containsMediaContent(messages: CacheableMessage[]): boolean {
  for (const msg of messages) {
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block && typeof block === 'object' && isMediaBlock(block)) {
          return true
        }
      }
    }
  }
  return false
}

/** 计算 messages 序列化后的 UTF-8 字节数 */
function messagesByteLength(messages: CacheableMessage[]): number {
  return Buffer.byteLength(JSON.stringify(messages), 'utf8')
}

/**
 * 判断请求是否应跳过缓存。
 *
 * 跳过条件(任一命中即跳过):
 * - stream:true(流式响应不缓存)
 * - X-Cache-Bypass: true header
 * - 请求包含 tools(工具调用结果依赖外部状态,不可缓存)
 * - 请求 messages 包含 image_url/媒体内容(base64 太大)
 * - 请求 messages 总长度 > 8KB
 */
export function shouldSkipCache(params: ShouldSkipCacheParams): CacheSkipResult {
  if (params.stream === true) {
    return { skip: true, reason: 'stream response' }
  }
  if (params.bypassHeader === 'true') {
    return { skip: true, reason: 'X-Cache-Bypass header' }
  }
  // tools 为非空数组或非数组真值 → 跳过(tool_choice:'auto'+tools 在此一并拦截)
  if (params.tools !== undefined && (!Array.isArray(params.tools) || params.tools.length > 0)) {
    return { skip: true, reason: 'tools call' }
  }
  if (containsMediaContent(params.messages)) {
    return { skip: true, reason: 'image/media content' }
  }
  if (messagesByteLength(params.messages) > MAX_REQUEST_BYTES) {
    return { skip: true, reason: 'request too large (>8KB)' }
  }
  return { skip: false }
}

/**
 * 计算缓存 key。
 *
 * - 排除可变字段(user/agent header/时间戳),仅基于 model + messages + 采样参数
 * - SHA256 取前 32 字符,前缀 relay:cache:<modelSlug>:
 * - 含 tools/tool_choice 的请求应已被 shouldSkipCache 过滤;此处仍纳入 hash 保证确定性
 */
export function computeCacheKey(params: ComputeCacheKeyParams): string {
  const parts: readonly string[] = [
    params.model,
    JSON.stringify(params.messages),
    String(params.temperature ?? ''),
    String(params.top_p ?? ''),
    String(params.max_tokens ?? ''),
    String(params.presence_penalty ?? ''),
    String(params.frequency_penalty ?? ''),
    String(params.seed ?? ''),
    JSON.stringify(params.response_format ?? null),
    JSON.stringify(params.tools ?? null),
    JSON.stringify(params.tool_choice ?? null),
  ]
  const hash = createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 32)
  return `${KEY_PREFIX}${slugifyModel(params.model)}:${hash}`
}

/** 用 SCAN 遍历匹配 pattern 的 key(非阻塞,避免 KEYS 阻塞 Redis) */
async function scanKeys(
  redis: RedisClient,
  pattern: string,
  count = SCAN_COUNT,
): Promise<string[]> {
  const keys: string[] = []
  let cursor = '0'
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', count)
    cursor = next
    if (batch.length > 0) keys.push(...batch)
  } while (cursor !== '0')
  return keys
}

/**
 * 响应缓存服务。
 *
 * 生命周期:
 * - initRelayResponseCache(redis?, opts?) 在应用启动时调用(仅 RELAY_CACHE_ENABLED=true 时创建实例)
 * - getRelayResponseCache() 在请求处理时调用,返回实例或 null(调用方需 null 检查降级)
 *
 * Redis 异常时所有方法静默降级(缓存可选,不影响主流程):
 * - get → 返回 {hit: false}
 * - set/invalidate/invalidatePattern/incr* → 静默跳过 + warn 日志
 */
export class RelayResponseCache {
  constructor(
    private readonly redis: RedisClient,
    private readonly ttlSec: number = DEFAULT_TTL_SEC,
    private readonly maxSizeMb: number = DEFAULT_MAX_SIZE_MB,
  ) {}

  /**
   * 读取缓存。
   * - 命中返回 {hit: true, data: T}
   * - 未命中或 Redis 异常返回 {hit: false}(降级,不抛错)
   */
  async get<T>(key: string): Promise<CacheGetResult<T>> {
    try {
      const raw = await this.redis.get(key)
      if (raw === null || raw === '') return { hit: false }
      const data = JSON.parse(raw) as T
      return { hit: true, data }
    } catch (err) {
      logger.warn('[relay-response-cache] get failed, degrading to miss', {
        key,
        error: (err as Error).message,
      })
      return { hit: false }
    }
  }

  /**
   * 写入缓存。
   * - TTL 优先用 opts.ttlSec,否则用构造时默认值
   * - Redis 异常时静默降级(不抛错,缓存可选)
   * - maxSizeMb 为软上限(观测用),实际内存淘汰由 Redis server maxmemory + allkeys-lru 保障
   */
  async set<T>(key: string, data: T, opts?: { ttlSec?: number }): Promise<void> {
    const ttl = opts?.ttlSec ?? this.ttlSec
    try {
      const payload = JSON.stringify(data)
      await this.redis.set(key, payload, 'EX', ttl)
    } catch (err) {
      logger.warn('[relay-response-cache] set failed, skipping cache', {
        key,
        error: (err as Error).message,
      })
    }
  }

  /** 删除单条缓存 */
  async invalidate(key: string): Promise<void> {
    try {
      await this.redis.del(key)
    } catch (err) {
      logger.warn('[relay-response-cache] invalidate failed', {
        key,
        error: (err as Error).message,
      })
    }
  }

  /**
   * 按 pattern 批量删除缓存。
   * - relay:cache:gpt-4o:*  删除某模型所有缓存
   * - relay:cache:*          删除全部响应缓存(不影响统计 key)
   * - 用 SCAN + 分批 DEL,避免 KEYS / 大 DEL 阻塞 Redis
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await scanKeys(this.redis, pattern)
      if (keys.length === 0) return
      for (let i = 0; i < keys.length; i += DEL_BATCH_SIZE) {
        const batch = keys.slice(i, i + DEL_BATCH_SIZE)
        await this.redis.del(...batch)
      }
      logger.info('[relay-response-cache] invalidated pattern', {
        pattern,
        count: keys.length,
      })
    } catch (err) {
      logger.warn('[relay-response-cache] invalidatePattern failed', {
        pattern,
        error: (err as Error).message,
      })
    }
  }

  /** 命中次数 +1(集成层在 cache hit 后调用) */
  async incrHits(): Promise<void> {
    try {
      await this.redis.incr(STATS_HITS)
    } catch {
      /* 静默,统计可选 */
    }
  }

  /** 未命中次数 +1(集成层在 cache miss 后调用) */
  async incrMisses(): Promise<void> {
    try {
      await this.redis.incr(STATS_MISSES)
    } catch {
      /* 静默,统计可选 */
    }
  }

  /** 累加节省成本(分,基于命中缓存的 input_tokens × 模型单价) */
  async incrSavedCost(cents: number): Promise<void> {
    if (!Number.isFinite(cents) || cents <= 0) return
    try {
      await this.redis.incrbyfloat(STATS_SAVED_CENTS, cents)
    } catch {
      /* 静默,统计可选 */
    }
  }

  /**
   * 读取缓存统计快照。
   * - hits/misses/savedCostCents 从 Redis 读取(跨实例共享)
   * - size 用 SCAN 统计 relay:cache:* key 数(不含统计 key)
   * - hitRate = hits / (hits + misses)
   */
  async stats(): Promise<CacheStats> {
    try {
      const [hitsStr, missesStr, savedStr] = await Promise.all([
        this.redis.get(STATS_HITS),
        this.redis.get(STATS_MISSES),
        this.redis.get(STATS_SAVED_CENTS),
      ])
      const hits = hitsStr ? Number.parseInt(hitsStr, 10) : 0
      const misses = missesStr ? Number.parseInt(missesStr, 10) : 0
      const savedCostCents = savedStr ? Math.round(Number.parseFloat(savedStr)) : 0
      const total = hits + misses
      const size = await this.estimateSize()
      return {
        hits,
        misses,
        hitRate: total > 0 ? hits / total : 0,
        size,
        savedCostCents,
      }
    } catch (err) {
      logger.warn('[relay-response-cache] stats failed', {
        error: (err as Error).message,
      })
      return { hits: 0, misses: 0, hitRate: 0, size: 0, savedCostCents: 0 }
    }
  }

  /** 估算缓存 key 数(SCAN relay:cache:*,不含统计 key) */
  private async estimateSize(): Promise<number> {
    try {
      const keys = await scanKeys(this.redis, `${KEY_PREFIX}*`)
      return keys.length
    } catch {
      return 0
    }
  }

  /** 获取配置(用于观测/健康检查) */
  getConfig(): { ttlSec: number; maxSizeMb: number } {
    return { ttlSec: this.ttlSec, maxSizeMb: this.maxSizeMb }
  }
}

// =============================================================================
// 单例管理
// =============================================================================

let cacheInstance: RelayResponseCache | null = null

/**
 * 创建独立 Redis 客户端(参考 account-lockout / cli-import/redis-cache 模式)。
 *
 * 调用方无 fastify 实例时使用;有 fastify.redis 时优先传入,避免多余连接。
 */
function createStandaloneRedisClient(): RedisClient | null {
  try {
    const client = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: false,
    })
    client.on('error', (err) => {
      logger.warn('[relay-response-cache] redis error', { error: err.message })
    })
    const quit = (): void => {
      client.quit().catch(() => {
        /* ignore */
      })
    }
    process.once('SIGTERM', quit)
    process.once('SIGINT', quit)
    return client
  } catch (err) {
    logger.warn('[relay-response-cache] init redis failed', {
      error: (err as Error).message,
    })
    return null
  }
}

/**
 * 初始化响应缓存单例。
 *
 * - 仅当 RELAY_CACHE_ENABLED=true 时创建实例
 * - redis 参数可选:未传时从 config.REDIS_URL 创建独立连接(参考 account-lockout 模式)
 * - 在应用启动(fastify.ready)后调用;未启用 / Redis 不可用时为 no-op
 *
 * @param redis  Redis 客户端(优先传 fastify.redis;不传则自建独立连接)
 * @param opts   可选 TTL 覆盖(默认读 RELAY_CACHE_TTL_SEC 或 86400)
 */
export function initRelayResponseCache(redis?: RedisClient, opts?: { ttlSec?: number }): void {
  const cfg = loadCacheConfig()
  if (!cfg.enabled) {
    logger.info('[relay-response-cache] disabled (RELAY_CACHE_ENABLED != "true")')
    cacheInstance = null
    return
  }
  const client = redis ?? createStandaloneRedisClient()
  if (!client) {
    logger.warn('[relay-response-cache] no redis client available, cache disabled')
    cacheInstance = null
    return
  }
  const ttlSec = opts?.ttlSec ?? cfg.ttlSec
  cacheInstance = new RelayResponseCache(client, ttlSec, cfg.maxSizeMb)
  logger.info('[relay-response-cache] initialized', {
    ttlSec,
    maxSizeMb: cfg.maxSizeMb,
    standalone: redis === undefined,
  })
}

/**
 * 获取响应缓存单例。
 *
 * - 未 init 或未启用时返回 null
 * - 调用方需 null 检查降级(直接透传到上游,不缓存)
 */
export function getRelayResponseCache(): RelayResponseCache | null {
  return cacheInstance
}
