// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CLI 导入 preview 的 Redis 缓存。
 *
 * 场景:用户上传配置文件后,服务端解析得到 ImportedProvider[] 列表,
 * 落库前先返回 previewId 让用户在 UI 勾选要导入的项;用户确认后
 * 用 previewId 回取原始 preview 数据,避免重新解析或在前端往返大对象。
 *
 * 设计:
 * - 单条 preview 以 JSON 字符串存 String key,TTL 10 分钟
 * - key 前缀 cli-import:preview:<ownerUuid>:<uuid> —— F-74:必须绑定归属,
 *   否则任何拿到 previewId 的人都能用他人明文 apiKey 落进自己账户
 * - value 为 { ownerUuid, preview } 信封,读回时双重核对 owner;历史裸 value 一律 fail-closed
 * - Redis 不可用时降级为进程内 Map(单实例部署兜底)
 */
import IORedis, { type Redis } from 'ioredis'

import { config } from '../../config/index.js'
import { logger } from '../../utils/logger.js'
import type { ImportPreview } from '@ihui/types'

const KEY_PREFIX = 'cli-import:preview:'
const TTL_SEC = 10 * 60

/** 缓存信封:owner 与 preview 同存,读回时两处都要对得上 */
interface CachedPreview {
  ownerUuid: string
  preview: ImportPreview
}

function previewKey(ownerUuid: string, previewId: string): string {
  return `${KEY_PREFIX}${ownerUuid}:${previewId}`
}

/** 只接受新信封且 owner 一致;旧裸 value / owner 不符一律当不存在 */
function unwrap(raw: string, ownerUuid: string): ImportPreview | undefined {
  try {
    const parsed = JSON.parse(raw) as Partial<CachedPreview> & { previewId?: unknown }
    if (!parsed || typeof parsed !== 'object') return undefined
    if (parsed.ownerUuid !== ownerUuid) return undefined
    const preview = parsed.preview
    if (!preview || typeof preview !== 'object') return undefined
    // 旧裸 ImportPreview(带 previewId)没有信封,按未命中处理
    if (typeof parsed.previewId === 'string') return undefined
    return preview as ImportPreview
  } catch {
    return undefined
  }
}

// fallback 内存降级存储 LRU 上限(防止 Redis 不可用时 OOM,preview 单条较大,上限 1000)
const FALLBACK_MAX = 1000
const FALLBACK_CLEANUP_INTERVAL_MS = 5 * 60 * 1000

const fallbackStore = new Map<string, { value: CachedPreview; expireAt: number }>()

/**
 * Map 写入并保持 LRU 上限。
 * Map 的 keys() 按插入顺序迭代,超限时删除最早插入的 key(简易 LRU)。
 * 已存在 key 时直接覆盖(不触发淘汰),保持 LRU 语义。
 */
function setWithLRU<K, V>(map: Map<K, V>, key: K, value: V, max: number): void {
  if (map.size >= max && !map.has(key)) {
    const firstKey = map.keys().next().value
    if (firstKey !== undefined) map.delete(firstKey)
  }
  map.set(key, value)
}

let redisClient: Redis | null = null

function getRedis(): Redis | null {
  try {
    if (!redisClient) {
      redisClient = new IORedis(config.REDIS_URL, {
        maxRetriesPerRequest: 1,
        lazyConnect: false,
      })
      redisClient.on('error', (err) => {
        logger.warn('[cli-import/redis-cache] redis error, fallback to in-memory', {
          error: err.message,
        })
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
  } catch (err) {
    logger.warn('[cli-import/redis-cache] init redis failed', {
      error: (err as Error).message,
    })
    return null
  }
}

/**
 * 缓存一条 preview,返回时也已带 previewId。
 * F-74:必须带 owner 才落缓存 —— 没有归属的条目谁都能读,不如不缓存。
 */
export async function savePreview(preview: ImportPreview, ownerId?: string): Promise<void> {
  if (!ownerId) return
  const key = previewKey(ownerId, preview.previewId)
  const cached: CachedPreview = { ownerUuid: ownerId, preview }
  const payload = JSON.stringify(cached)
  const redis = getRedis()
  if (redis) {
    try {
      await redis.set(key, payload, 'EX', TTL_SEC)
      return
    } catch (err) {
      logger.warn('[cli-import/redis-cache] set failed, fallback', {
        error: (err as Error).message,
      })
    }
  }
  setWithLRU(
    fallbackStore,
    key,
    { value: cached, expireAt: Date.now() + TTL_SEC * 1000 },
    FALLBACK_MAX,
  )
}

/**
 * 读取 preview;不存在、过期或归属不符返回 undefined。
 */
export async function loadPreview(
  previewId: string,
  ownerId?: string,
): Promise<ImportPreview | undefined> {
  if (!previewId || !ownerId) return undefined
  const key = previewKey(ownerId, previewId)
  const redis = getRedis()
  if (redis) {
    try {
      const raw = await redis.get(key)
      if (raw) return unwrap(raw, ownerId)
      // Redis 没命中,可能已过期或降级写入 fallback;查一下
    } catch (err) {
      logger.warn('[cli-import/redis-cache] get failed, fallback', {
        error: (err as Error).message,
      })
    }
  }
  const entry = fallbackStore.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expireAt) {
    fallbackStore.delete(key)
    return undefined
  }
  return entry.value.ownerUuid === ownerId ? entry.value.preview : undefined
}

/**
 * 删除 preview(commit 后或显式取消)。
 */
export async function deletePreview(previewId: string, ownerId?: string): Promise<void> {
  if (!previewId || !ownerId) return
  const key = previewKey(ownerId, previewId)
  const redis = getRedis()
  if (redis) {
    try {
      await redis.del(key)
    } catch {
      /* ignore */
    }
  }
  fallbackStore.delete(key)
}

/**
 * 定期清理过期 fallback 条目(long-running server 有效)。
 * 与 loadPreview 处的懒清理互补,防止长期不访问的 preview 累积导致 OOM。
 *
 * F-367:定时器改为显式生命周期 —— 模块 import 不再产生副作用,
 * 由 API 进程入口调用 startFallbackCleanup();worker 进程不调用,避免空转。
 */
let cleanupTimer: NodeJS.Timeout | null = null

/** 启动 fallback 清理定时器(幂等)。 */
export function startFallbackCleanup(): void {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [k, v] of fallbackStore) {
      if (now > v.expireAt) fallbackStore.delete(k)
    }
  }, FALLBACK_CLEANUP_INTERVAL_MS)
  // unref 避免定时器阻止进程退出
  cleanupTimer.unref?.()
}

/** 停止 fallback 清理定时器(幂等)。 */
export function stopFallbackCleanup(): void {
  if (!cleanupTimer) return
  clearInterval(cleanupTimer)
  cleanupTimer = null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
