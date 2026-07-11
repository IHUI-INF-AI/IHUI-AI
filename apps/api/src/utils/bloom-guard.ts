/**
 * 布隆过滤器 + 空值缓存，防止缓存穿透。
 *
 * 缓存穿透：攻击者大量请求不存在的 key，绕过缓存直击 DB。
 * 防护策略：
 * 1. 布隆过滤器：key 不在过滤器中 → 一定不存在，直接返回 null
 * 2. 空值缓存：DB 查询返回 null 时，缓存短 TTL 空值，防止重复击穿
 *
 * 分布式实现：使用 Redis BITMAP（SETBIT / GETBIT）存储位图，
 * 多实例共享同一过滤器状态。
 */

import { createHash } from 'node:crypto'
import type IORedis from 'ioredis'

/** 布隆过滤器配置。 */
export interface BloomGuardOptions {
  /** 位图大小（位数），默认 100000 */
  size?: number
  /** hash 函数数量，默认 7 */
  hashCount?: number
  /** Redis key 前缀，默认 'bloom:' */
  prefix?: string
  /** 空值缓存 TTL（秒），默认 60 */
  nullTtl?: number
  /** 真实数据缓存 TTL（秒），默认 300 */
  dataTtl?: number
}

/** 默认配置。 */
const DEFAULTS: Required<BloomGuardOptions> = {
  size: 100_000,
  hashCount: 7,
  prefix: 'bloom:',
  nullTtl: 60,
  dataTtl: 300,
}

/**
 * 基于 Redis BITMAP 的分布式布隆过滤器。
 * 可独立于 getCachedWithBloomGuard 使用，作为通用过滤器。
 */
export class BloomGuard {
  private readonly opts: Required<BloomGuardOptions>

  constructor(
    private readonly redis: IORedis,
    options: BloomGuardOptions = {},
  ) {
    this.opts = { ...DEFAULTS, ...options }
  }

  /** 计算 key 对应的多个位图索引。 */
  private getIndexes(key: string): number[] {
    const indexes: number[] = []
    for (let i = 0; i < this.opts.hashCount; i++) {
      const h = createHash('sha256').update(`${i}:${key}`).digest()
      // 取前 4 字节作为无符号 32 位整数
      const idx = h.readUInt32BE(0) % this.opts.size
      indexes.push(idx)
    }
    return indexes
  }

  /** 将 key 加入过滤器。 */
  async add(key: string): Promise<void> {
    const indexes = this.getIndexes(key)
    const bitmapKey = this.bitmapKey()
    // 批量 SETBIT
    const pipeline = this.redis.pipeline()
    for (const idx of indexes) pipeline.setbit(bitmapKey, idx, 1)
    await pipeline.exec()
  }

  /**
   * 判断 key 是否可能在过滤器中。
   * 返回 true 表示"可能存在"（有误判率）；false 表示"一定不存在"。
   */
  async mightContain(key: string): Promise<boolean> {
    const indexes = this.getIndexes(key)
    const bitmapKey = this.bitmapKey()
    const pipeline = this.redis.pipeline()
    for (const idx of indexes) pipeline.getbit(bitmapKey, idx)
    const results = await pipeline.exec()
    if (!results) return false
    // 任一位为 0 则一定不存在
    for (const [err, bit] of results) {
      if (err) throw err
      if (bit === 0) return false
    }
    return true
  }

  /** 重置过滤器（删除位图）。慎用：会丢失全部已加入的 key。 */
  async reset(): Promise<void> {
    await this.redis.del(this.bitmapKey())
  }

  private bitmapKey(): string {
    return `${this.opts.prefix}guard`
  }

  /** 数据缓存的 Redis key。 */
  private dataCacheKey(key: string): string {
    return `${this.opts.prefix}data:${key}`
  }

  /** 空值标记的 Redis key。 */
  private nullCacheKey(key: string): string {
    return `${this.opts.prefix}null:${key}`
  }

  /**
   * 带布隆过滤器 + 空值缓存的读缓存流程。
   *
   * 流程：
   * 1. 布隆过滤器判断 → 不在 → 直接返回 null
   * 2. 命中空值缓存 → 返回 null
   * 3. 命中数据缓存 → 返回数据
   * 4. 未命中 → fetchFn → 有数据则缓存 + 加入过滤器；无数据则缓存空值
   */
  async getCached<T>(key: string, fetchFn: () => Promise<T | null | undefined>): Promise<T | null> {
    // 1. 布隆过滤器前置拦截
    const mightExist = await this.mightContain(key)
    if (!mightExist) return null

    // 2. 检查空值缓存
    const isNullCached = await this.redis.exists(this.nullCacheKey(key))
    if (isNullCached) return null

    // 3. 检查数据缓存
    const cached = await this.redis.get(this.dataCacheKey(key))
    if (cached !== null) {
      try {
        return JSON.parse(cached) as T
      } catch {
        // 缓存数据损坏，忽略后回源
      }
    }

    // 4. 回源
    const fresh = await fetchFn()
    if (fresh === null || fresh === undefined) {
      // 空值短缓存
      await this.redis.set(this.nullCacheKey(key), '1', 'EX', this.opts.nullTtl)
      return null
    }
    // 数据缓存 + 加入过滤器（防重启后位图丢失）
    await this.redis.set(this.dataCacheKey(key), JSON.stringify(fresh), 'EX', this.opts.dataTtl)
    await this.add(key)
    return fresh
  }
}

/**
 * 便捷函数：使用默认 BloomGuard 实例读缓存。
 * 调用方需先创建单例 BloomGuard，避免每次请求重建。
 */
export async function getCachedWithBloomGuard<T>(
  redis: IORedis,
  key: string,
  fetchFn: () => Promise<T | null | undefined>,
  options?: BloomGuardOptions,
): Promise<T | null> {
  const guard = new BloomGuard(redis, options)
  return guard.getCached(key, fetchFn)
}
