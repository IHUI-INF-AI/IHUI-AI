/**
 * CLI 导入 preview 的 Redis 缓存。
 *
 * 场景:用户上传配置文件后,服务端解析得到 ImportedProvider[] 列表,
 * 落库前先返回 previewId 让用户在 UI 勾选要导入的项;用户确认后
 * 用 previewId 回取原始 preview 数据,避免重新解析或在前端往返大对象。
 *
 * 设计:
 * - 单条 preview 以 JSON 字符串存 String key,TTL 10 分钟
 * - key 前缀 cli-import:preview:<uuid>
 * - Redis 不可用时降级为进程内 Map(单实例部署兜底)
 */
import IORedis, { type Redis } from 'ioredis'

import { config } from '../../config/index.js'
import { logger } from '../../utils/logger.js'
import type { ImportPreview } from '@ihui/types'

const KEY_PREFIX = 'cli-import:preview:'
const TTL_SEC = 10 * 60

const fallbackStore = new Map<string, { value: ImportPreview; expireAt: number }>()

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
 */
export async function savePreview(preview: ImportPreview): Promise<void> {
  const key = `${KEY_PREFIX}${preview.previewId}`
  const payload = JSON.stringify(preview)
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
  fallbackStore.set(key, { value: preview, expireAt: Date.now() + TTL_SEC * 1000 })
}

/**
 * 读取 preview;不存在或过期返回 undefined。
 */
export async function loadPreview(previewId: string): Promise<ImportPreview | undefined> {
  if (!previewId) return undefined
  const key = `${KEY_PREFIX}${previewId}`
  const redis = getRedis()
  if (redis) {
    try {
      const raw = await redis.get(key)
      if (raw) return JSON.parse(raw) as ImportPreview
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
  return entry.value
}

/**
 * 删除 preview(commit 后或显式取消)。
 */
export async function deletePreview(previewId: string): Promise<void> {
  if (!previewId) return
  const key = `${KEY_PREFIX}${previewId}`
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
