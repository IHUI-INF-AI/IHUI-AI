/**
 * Read-Your-Write 一致性 + 一致性窗口（bug200 + bug178）。
 *
 * 写入后在 RYW 窗口内强制从主库读，保证客户端能立刻读到自己的写。
 * 跨地域写入时，在一致性窗口内禁止读 follower，避免读到旧数据。
 *
 * PendingWrite 跟踪使用 Redis SET + TTL，支持多实例共享（分布式一致）。
 *
 * 迁移自旧架构 bug200_ryw.py 和 bug178_consistency_window.py。
 */

import type IORedis from 'ioredis'

/** RYW 配置。 */
export interface RywConfig {
  /** 默认 RYW 窗口时长（秒），默认 2 */
  windowSec: number
  /** 窗口上限（秒），防止过大窗口导致长时间走主库，默认 30 */
  maxWindowSec: number
}

/** 默认配置。 */
export const DEFAULT_RYW_CONFIG: RywConfig = {
  windowSec: 2,
  maxWindowSec: 30,
}

/** 待决写入记录。 */
export interface PendingWrite {
  key: string
  userId: string
  /** 区域标识（跨地域一致性窗口用） */
  region?: string
  /** 截止时间戳（epoch ms） */
  deadline: number
}

/** RYW 统计。 */
export interface RywStats {
  /** 强制走主库次数 */
  forcedMaster: number
  /** 允许走从库次数 */
  allowedFollower: number
}

/** Redis key 前缀。 */
const RYW_PREFIX = 'ihui:ryw:'

/**
 * Read-Your-Write 一致性管理器。
 *
 * 使用 Redis 存储 PendingWrite 状态，确保多实例部署时所有实例都能感知到写入。
 *
 * 使用方式：
 * 1. 写操作后调用 markWrite(userId, key) 标记
 * 2. 读操作前调用 canReadFollower(userId, key) 判断是否可走从库
 *
 * @example
 * await ryw.markWrite(userId, 'user:profile');
 * if (!await ryw.canReadFollower(userId, 'user:profile')) {
 *   // 强制从主库读
 *   return await dbWriter.select().from(users).where(eq(users.id, userId));
 * }
 * // 可安全从从库读
 * return await dbReader.select().from(users).where(eq(users.id, userId));
 */
export class RywConsistency {
  private readonly cfg: RywConfig
  private readonly redis: IORedis
  private readonly stats: RywStats = { forcedMaster: 0, allowedFollower: 0 }

  constructor(redis: IORedis, config: RywConfig = DEFAULT_RYW_CONFIG) {
    this.redis = redis
    this.cfg = config
  }

  /**
   * 标记一次写入，开启 RYW 窗口。
   *
   * 在窗口内，canReadFollower() 返回 false，强制从主库读。
   *
   * @param userId 用户 ID
   * @param key 读写操作的缓存 key（如 'user:profile:123'）
   * @param opts.windowSec 自定义窗口时长，默认用配置值
   * @param opts.region 区域标识（跨地域一致性窗口用）
   */
  async markWrite(
    userId: string,
    key: string,
    opts?: { windowSec?: number; region?: string },
  ): Promise<void> {
    const w = Math.min(opts?.windowSec ?? this.cfg.windowSec, this.cfg.maxWindowSec)
    const redisKey = this.buildKey(userId, key, opts?.region)
    // Redis SET + TTL：窗口到期后自动清除
    await this.redis.set(redisKey, String(Date.now() + w * 1000), 'EX', w)
  }

  /**
   * 判断是否可以从从库读取。
   *
   * @returns true 表示可安全走从库；false 表示 RYW 窗口内，必须走主库
   */
  async canReadFollower(userId: string, key: string, region?: string): Promise<boolean> {
    const redisKey = this.buildKey(userId, key, region)
    const exists = await this.redis.exists(redisKey)
    if (exists > 0) {
      // RYW 窗口内：强制走主库
      this.stats.forcedMaster++
      return false
    }
    this.stats.allowedFollower++
    return true
  }

  /**
   * 批量标记多个 key 的写入。
   * 使用 pipeline 减少 Redis 往返。
   */
  async markWrites(
    userId: string,
    keys: string[],
    opts?: { windowSec?: number; region?: string },
  ): Promise<void> {
    if (keys.length === 0) return
    const w = Math.min(opts?.windowSec ?? this.cfg.windowSec, this.cfg.maxWindowSec)
    const pipeline = this.redis.pipeline()
    for (const key of keys) {
      const redisKey = this.buildKey(userId, key, opts?.region)
      pipeline.set(redisKey, String(Date.now() + w * 1000), 'EX', w)
    }
    await pipeline.exec()
  }

  /**
   * 清除指定 key 的 RYW 标记（主动失效时使用）。
   */
  async clear(userId: string, key: string, region?: string): Promise<void> {
    const redisKey = this.buildKey(userId, key, region)
    await this.redis.del(redisKey)
  }

  /** 获取统计快照。 */
  getStats(): RywStats {
    return { ...this.stats }
  }

  /** 构建 Redis key。 */
  private buildKey(userId: string, key: string, region?: string): string {
    // 格式: ihui:ryw:{region}:{userId}:{key} 或 ihui:ryw:{userId}:{key}
    if (region) {
      return `${RYW_PREFIX}${region}:${userId}:${key}`
    }
    return `${RYW_PREFIX}${userId}:${key}`
  }
}
