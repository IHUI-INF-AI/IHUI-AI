// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/** DB-26:进程内 RYW 读屏障窗口(毫秒),与 DEFAULT_RYW_CONFIG.windowSec=2s 同一口径。 */
export const RYW_READ_BARRIER_WINDOW_MS = 2000

/** DB-26:匿名/后台任务(无 Principal ALS 上下文)写入的作用域键。 */
const ANONYMOUS_RYW_SCOPE = 'anonymous'

/**
 * DB-26:识别写 SQL。
 *
 * 写路径在仓库里有 drizzle / 原生 unsafe / 事务三种形态,查询文本都以语句动词开头
 * (CTE 写以 `WITH ... INSERT/UPDATE/DELETE` 开头),因此按首段动词判定即可,
 * 不新增第二套 SQL 解析器。事务控制(BEGIN/COMMIT)不是写。
 */
const WRITE_SQL_RE =
  /^\s*(?:with\b[\s\S]*?\b(?:insert|update|delete|merge)\b|(?:insert|update|delete|merge|truncate|alter|create|drop|comment|grant|revoke|reindex|vacuum|refresh)\b)/i

/** 判断一条 SQL 是否为写语句(纯函数,供 SQL 日志回调与单测复用)。 */
export function isWriteSql(query: string): boolean {
  return WRITE_SQL_RE.test(query)
}

/**
 * DB-26:同步的进程内「写后读」屏障。
 *
 * 为什么不用上面的 RywConsistency(Redis):dbRead 是 Proxy 的同步 `get` 陷阱,
 * 无法 `await`;而 RYW 语义的时效只有在**同一请求**链上才有意义。因此本屏障按
 * 调用主体(subjectId)记录「最后一次写完成时刻 + 窗口」,窗口内该主体的读强制走主库。
 *
 * 多实例部署下 Redis 版仍可用于跨实例场景;本屏障负责本进程内的确定性 RYW。
 */
export class RywReadBarrier {
  private readonly windowMs: number
  /** scope → 窗口截止时间戳(epoch ms) */
  private readonly deadlines = new Map<string, number>()

  constructor(windowMs: number = RYW_READ_BARRIER_WINDOW_MS) {
    if (!Number.isFinite(windowMs) || windowMs <= 0) {
      throw new Error(`RYW 读屏障窗口必须是正有限值(收到 ${windowMs})`)
    }
    this.windowMs = windowMs
  }

  /** 记录一次写完成,开启该作用域的 RYW 窗口。 */
  markWrite(scope: string | null | undefined, now: number = Date.now()): void {
    this.prune(now)
    this.deadlines.set(scope ?? ANONYMOUS_RYW_SCOPE, now + this.windowMs)
  }

  /** 当前作用域是否处于 RYW 窗口内(是 ⇒ 读必须走主库)。 */
  mustReadPrimary(scope: string | null | undefined, now: number = Date.now()): boolean {
    const key = scope ?? ANONYMOUS_RYW_SCOPE
    const deadline = this.deadlines.get(key)
    if (deadline === undefined) return false
    if (deadline <= now) {
      this.deadlines.delete(key)
      return false
    }
    return true
  }

  /** 当前窗口数(诊断/测试用)。 */
  size(): number {
    return this.deadlines.size
  }

  /** 清理已过期条目,避免 Map 随活跃主体无限增长。 */
  private prune(now: number): void {
    for (const [scope, deadline] of this.deadlines) {
      if (deadline <= now) this.deadlines.delete(scope)
    }
  }
}

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
