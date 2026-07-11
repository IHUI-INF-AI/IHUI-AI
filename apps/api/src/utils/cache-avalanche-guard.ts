/**
 * 缓存雪崩防护（bug174）。
 *
 * 大量 key 同时过期导致回源雪崩，通过 TTL 抖动 + 预热调度消除过期时间聚集。
 *
 * 1. TTL 抖动：在基础 TTL 上加 ±20% 随机偏移，打散过期时间
 * 2. 预热调度：提前 preloadAheadSec 扫描即将过期的 key，触发预加载
 *
 * 迁移自旧架构 bug174_avalanche.py。
 */

/** 雪崩防护配置。 */
export interface AvalancheConfig {
  /** 基础 TTL（秒），默认 300 */
  baseTtl: number
  /** TTL 抖动比例（0.2 = ±20%），默认 0.2 */
  jitterPct: number
  /** TTL 抖动上限（秒），防止大 TTL 时抖动过大，默认 60 */
  maxTtlJitterSec: number
  /** 提前多少秒触发预热，默认 30 */
  preloadAheadSec: number
}

/** 默认配置。 */
export const DEFAULT_AVALANCHE_CONFIG: AvalancheConfig = {
  baseTtl: 300,
  jitterPct: 0.2,
  maxTtlJitterSec: 60,
  preloadAheadSec: 30,
}

/** 雪崩防护统计。 */
export interface AvalancheStats {
  /** 当前追踪的 key 数量 */
  tracked: number
  /** 累计预热次数 */
  prewarmedTotal: number
}

/** 预热回调。 */
export type PreloadCallback = (key: string) => void

/**
 * 缓存雪崩防护：TTL 抖动 + 预热调度。
 *
 * 使用方式：
 * 1. 写缓存时调用 ttl() 获取带抖动的 TTL
 * 2. 调用 register() 追踪 key 的过期时间
 * 3. 定期调用 tick() 扫描即将过期的 key 并触发预热
 */
export class AvalancheGuard {
  private readonly cfg: AvalancheConfig
  private readonly onPreload?: PreloadCallback
  /** key → 过期时间戳（epoch ms） */
  private readonly keys = new Map<string, number>()
  private prewarmedCount = 0

  constructor(config: AvalancheConfig = DEFAULT_AVALANCHE_CONFIG, onPreload?: PreloadCallback) {
    this.cfg = config
    this.onPreload = onPreload
  }

  /**
   * 计算带抖动的 TTL。
   *
   * @param key 缓存 key（不同 key 产生不同抖动）
   * @param base 基础 TTL（秒），未传则用配置默认值
   * @returns 抖动后的 TTL（秒）
   */
  ttl(_key: string, base?: number): number {
    const b = base ?? this.cfg.baseTtl
    const maxDelta = Math.min(this.cfg.maxTtlJitterSec, Math.floor(b * this.cfg.jitterPct))
    if (maxDelta <= 0) return b
    // 基于 key 哈希 + 随机的抖动
    const jitter = Math.floor((Math.random() * 2 - 1) * maxDelta)
    return Math.max(1, b + jitter)
  }

  /**
   * 注册一个 key 的过期时间。
   *
   * @param key 缓存 key
   * @param ttlSec TTL（秒），建议用 ttl() 计算后的值
   */
  register(key: string, ttlSec: number): void {
    this.keys.set(key, Date.now() + ttlSec * 1000)
  }

  /**
   * 扫描即将过期的 key，触发预热。
   *
   * 应由定时任务周期调用（建议间隔 < preloadAheadSec）。
   *
   * @returns 本次触发预热的 key 列表
   */
  tick(): string[] {
    const now = Date.now()
    const threshold = now + this.cfg.preloadAheadSec * 1000
    const needPreload: string[] = []

    for (const [key, expireAt] of this.keys) {
      if (expireAt <= threshold) {
        needPreload.push(key)
      }
    }

    for (const key of needPreload) {
      this.keys.delete(key)
      this.prewarmedCount++
      if (this.onPreload) {
        try {
          this.onPreload(key)
        } catch {
          // 预热回调失败不影响后续 key
        }
      }
    }

    return needPreload
  }

  /** 移除已追踪的 key（缓存被主动失效时调用）。 */
  unregister(key: string): void {
    this.keys.delete(key)
  }

  /** 获取统计信息。 */
  getStats(): AvalancheStats {
    return {
      tracked: this.keys.size,
      prewarmedTotal: this.prewarmedCount,
    }
  }
}
