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
 * - key 前缀 cli-import:preview:<ownerUuid>:<uuid>
 *   2026-11-13 F-74:早期 key 只有 <uuid>,任何登录用户拿到他人 previewId 就能
 *   commit 并把他人的明文 apiKey 落到自己账户。现在 owner 是 key 的一部分,
 *   同时 value 里也带 ownerUuid 做二次强校验,读取时两处任一不匹配都判为不存在。
 *   历史遗留的无 owner 数据(旧 key / 裸 ImportPreview value)一律不可读 —— fail-closed。
 * - Redis 不可用时降级为进程内 Map(单实例部署兜底)
 */
import IORedis, { type Redis } from 'ioredis'

import { config } from '../../config/index.js'
import { logger } from '../../utils/logger.js'
import type { ImportPreview } from '@ihui/types'

const KEY_PREFIX = 'cli-import:preview:'
const TTL_SEC = 10 * 60

/** 缓存信封:owner 与数据一起落盘,读取时强校验。 */
interface CachedPreview {
  ownerUuid: string
  preview: ImportPreview
}

/** 缓存 key 必须同时含 owner 与 previewId。 */
function cacheKey(ownerUuid: string, previewId: string): string {
  return `${KEY_PREFIX}${ownerUuid}:${previewId}`
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
 *
 * ownerUuid 是读取时的唯一凭据:没有 owner 写入的条目将无法被 loadPreview 取回,
 * 因此这里拒绝空 owner(不落缓存,由上层返回的 previewId 自然失效)。
 */
export async function savePreview(preview: ImportPreview, ownerUuid: string): Promise<void> {
  if (!ownerUuid) {
    logger.warn('[cli-import/redis-cache] skip save without owner', {
      previewId: preview.previewId,
    })
    return
  }
  const key = cacheKey(ownerUuid, preview.previewId)
  const entry: CachedPreview = { ownerUuid, preview }
  const payload = JSON.stringify(entry)
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
    { value: entry, expireAt: Date.now() + TTL_SEC * 1000 },
    FALLBACK_MAX,
  )
}

/**
 * 校验缓存信封:owner 不匹配、结构损坏、或历史裸对象(无 ownerUuid)一律视为不存在。
 */
function unwrapPreview(raw: string, ownerUuid: string): ImportPreview | undefined {
  let cached: CachedPreview
  try {
    cached = JSON.parse(raw) as CachedPreview
  } catch {
    return undefined
  }
  if (!cached || typeof cached !== 'object') return undefined
  if (cached.ownerUuid !== ownerUuid) return undefined
  if (!cached.preview || typeof cached.preview !== 'object') return undefined
  return cached.preview
}

/**
 * 读取 preview;不存在、过期、或 owner 不匹配返回 undefined。
 */
export async function loadPreview(
  previewId: string,
  ownerUuid: string,
): Promise<ImportPreview | undefined> {
  if (!previewId || !ownerUuid) return undefined
  const key = cacheKey(ownerUuid, previewId)
  const redis = getRedis()
  if (redis) {
    try {
      const raw = await redis.get(key)
      if (raw) return unwrapPreview(raw, ownerUuid)
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
  if (entry.value.ownerUuid !== ownerUuid) return undefined
  return entry.value.preview
}

/**
 * 删除 preview(commit 后或显式取消)。只删本人 key。
 */
export async function deletePreview(previewId: string, ownerUuid: string): Promise<void> {
  if (!previewId || !ownerUuid) return
  const key = cacheKey(ownerUuid, previewId)
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
 * unref 避免定时器阻止进程退出;模块加载即启动,资源占用可忽略(每 5 分钟扫一次 Map)。
 * 与 loadPreview 处的懒清理互补,防止长期不访问的 preview 累积导致 OOM。
 */
const cleanupTimer = setInterval(() => {
  const now = Date.now()
  for (const [k, v] of fallbackStore) {
    if (now > v.expireAt) fallbackStore.delete(k)
  }
}, FALLBACK_CLEANUP_INTERVAL_MS)
cleanupTimer.unref?.()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
