/**
 * Bug-158: 指标基数控制.
 *
 * 高基数 (用户 ID / 手机号 / 邮箱) 会打爆 Prometheus,
 * 需要: 桶化降基数 + 黑名单 + 自动截断 label.
 *
 * 参考: git show 3ee96cf0:server/app/utils/bug158_cardinality.py
 */

import { createHash } from 'node:crypto'

/** 基数控制配置. */
export interface CardinalityConfig {
  /** 单 label 不同值上限, 默认 1000 */
  maxLabelValues: number
  /** 高基数 key 集合 (会被桶化) */
  highCardKeys: Set<string>
  /** 高基数 key 桶数 (降低基数), 默认 64 */
  bucketCount: number
  /** 黑名单 label (直接丢弃), 默认空 */
  blacklist: Set<string>
  /** 截断 value 最大长度, 默认 128; 0 表示不截断 */
  truncateValue: number
  /** 驱逐检查间隔秒, 默认 60 */
  evictWindowSec: number
}

export const DEFAULT_CARDINALITY_CONFIG: CardinalityConfig = {
  maxLabelValues: 1000,
  highCardKeys: new Set(['user_id', 'phone', 'email', 'id_card', 'request_id', 'trace_id']),
  bucketCount: 64,
  blacklist: new Set(),
  truncateValue: 128,
  evictWindowSec: 60,
}

/** 标签策略. */
export interface LabelPolicy {
  name: string
  /** 是否桶化 */
  bucket: boolean
  /** 是否丢弃 */
  redact: boolean
}

/** 单条观测样本 (用于窗口内统计). */
interface Sample {
  value: number
  ts: number
}

/**
 * 指标注册 + 标签基数控制 + 桶化降基数.
 *
 * 设计:
 *   - 高基数 key (user_id/phone/email) 通过 md5 取模映射到 bucket_N, 降低不同值数量
 *   - 黑名单 label 直接丢弃
 *   - 单 label 超过 maxLabelValues 时, 驱逐最久未更新的 series
 *   - value 过长时截断
 */
export class MetricRegistry {
  private readonly config: CardinalityConfig
  /** metric -> "label=value" -> samples */
  private readonly values = new Map<string, Map<string, Sample[]>>()
  /** (metric,label) -> 上次驱逐时间 */
  private readonly evictTs = new Map<string, number>()
  /** label -> 被丢弃次数 */
  private readonly dropped = new Map<string, number>()
  private readonly maxSamples = 1000

  constructor(config: Partial<CardinalityConfig> = {}) {
    this.config = { ...DEFAULT_CARDINALITY_CONFIG, ...config }
    // 合并 highCardKeys / blacklist (允许传入 Set 或数组)
    if (!config.highCardKeys)
      this.config.highCardKeys = new Set(DEFAULT_CARDINALITY_CONFIG.highCardKeys)
    if (!config.blacklist) this.config.blacklist = new Set()
  }

  /** 计算 label 实际存储 key (桶化 / 截断). */
  private keyOf(_metric: string, label: string, value: string): string {
    const cfg = this.config
    // 黑名单丢弃: 返回特殊标记
    if (cfg.blacklist.has(label)) return '__dropped__'
    let v = value
    if (cfg.truncateValue > 0 && v.length > cfg.truncateValue) {
      v = v.slice(0, cfg.truncateValue)
    }
    if (cfg.highCardKeys.has(label) && cfg.bucketCount > 0) {
      const h = createHash('md5').update(v, 'utf8').digest()
      const idx = h[0]! % cfg.bucketCount
      return `bucket_${idx}`
    }
    return v
  }

  /** 超过上限时驱逐最久未更新的 series. */
  private evictIfNeeded(metric: string, label: string): void {
    const cfg = this.config
    const key = `${metric}:${label}`
    const now = Date.now() / 1000
    const last = this.evictTs.get(key) ?? 0
    if (now - last < cfg.evictWindowSec) return
    this.evictTs.set(key, now)
    const store = this.values.get(metric)
    if (!store || store.size <= cfg.maxLabelValues) return
    // 删除最久未更新的 key
    const items = Array.from(store.entries()).sort((a, b) => {
      const aTs = a[1].length > 0 ? a[1][a[1].length - 1]!.ts : 0
      const bTs = b[1].length > 0 ? b[1][b[1].length - 1]!.ts : 0
      return aTs - bTs
    })
    const removeCount = store.size - cfg.maxLabelValues
    for (let i = 0; i < removeCount; i++) {
      const k = items[i]?.[0]
      if (k) {
        store.delete(k)
        this.dropped.set(label, (this.dropped.get(label) ?? 0) + 1)
      }
    }
  }

  /** 观测一次指标. */
  observe(metric: string, labels: Record<string, string>, value: number): void {
    const now = Date.now() / 1000
    for (const [label, raw] of Object.entries(labels)) {
      const v = this.keyOf(metric, label, raw)
      if (v === '__dropped__') {
        this.dropped.set(label, (this.dropped.get(label) ?? 0) + 1)
        continue
      }
      const storeKey = `${label}=${v}`
      let store = this.values.get(metric)
      if (!store) {
        store = new Map()
        this.values.set(metric, store)
      }
      let q = store.get(storeKey)
      if (!q) {
        q = []
        store.set(storeKey, q)
      }
      q.push({ value, ts: now })
      if (q.length > this.maxSamples) q.shift()
      this.evictIfNeeded(metric, label)
    }
  }

  /** 查询某 metric 的 series 数量. */
  seriesCount(metric: string): number {
    return this.values.get(metric)?.size ?? 0
  }

  /** 统计信息. */
  stats(): { trackedMetrics: number; dropped: Record<string, number> } {
    const dropped: Record<string, number> = {}
    for (const [k, v] of this.dropped) dropped[k] = v
    return {
      trackedMetrics: this.values.size,
      dropped,
    }
  }
}

/** 全局单例. */
export const metricRegistry = new MetricRegistry()
