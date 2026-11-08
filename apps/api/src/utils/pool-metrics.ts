// © 2026 IHUI AI (智汇AI) · 版权所有:李春川 (Li Chunchuan) · https://aizhs.top
// 版权归属与商用授权以仓库根 NOTICE 与 LICENSE 为准。

/**
 * F-324:postgres.js 连接池状态采样。
 *
 * 背景:postgres.js 3.4.9 的 `sql` 对象只暴露 `options` / `reserve` 等公开面,
 * 不提供连接池内部 `state`(idle/active/connections)。旧采样器读到 undefined
 * 就 `continue`,导致池打满 40/40 时仍上报 in_use=0 —— 假绿。
 *
 * 这里的契约是"不可采样就显式不可用",绝不返回伪造的 0:
 * - available=true  → inUse/checkedOut 来自真实内部状态;
 * - available=false → 调用方必须上报 `db_pool_metrics_available 0`,且 usage 三条序列不输出。
 *
 * 不采用 reserve() 探测:为测量 in_use 需同时占满 max 个连接,会在生产上
 * 短暂耗尽连接池并与真实查询互相阻塞,代价远高于"显式不可用"。
 */

/** postgres.js 可能暴露的内部形状(不同版本不一致,仅用于兼容读取) */
interface PostgresClientInternals {
  options?: { max?: number }
  state?: {
    connections?: unknown[]
    idle?: unknown[]
    active?: unknown[]
  }
}

export type PoolMetricsSample =
  | {
      available: true
      size: number
      inUse: number
      checkedOut: number
      overflow: number
    }
  | {
      available: false
      size: number
      reason: string
    }

/** 可注入的 metrics 写入面(便于夹具不启动定时器直接验证映射) */
export type PoolMetricSink = (opts: {
  available: boolean
  size?: number
  inUse?: number
  checkedOut?: number
  overflow?: number
}) => void

/**
 * 把一次采样写入 metrics。
 * 可采样 → 真实四元组;不可采样 → only available=false + size(usage 由 metrics 侧省略)。
 */
export function reportPoolMetricsToSink(
  setMetrics: PoolMetricSink,
  client: unknown,
): PoolMetricsSample {
  const sample = samplePostgresPoolMetrics(client)
  if (sample.available) {
    setMetrics({
      available: true,
      size: sample.size,
      inUse: sample.inUse,
      checkedOut: sample.checkedOut,
      overflow: sample.overflow,
    })
  } else {
    // max 仍可读(options.max);usage 三项由 metrics 侧省略(不输出 NaN)
    setMetrics({ available: false, size: sample.size })
  }
  return sample
}

/**
 * 采样 postgres.js 连接池。
 * @param client `postgres()` 返回的 sql 对象(或任何兼容形状)
 */
export function samplePostgresPoolMetrics(client: unknown): PoolMetricsSample {
  const internal = client as PostgresClientInternals | null | undefined
  const size = typeof internal?.options?.max === 'number' ? internal.options.max : 0
  const state = internal?.state

  if (!state) {
    return {
      available: false,
      size,
      reason: 'postgres.js 未暴露连接池内部 state(3.x 公开面仅有 options/reserve),无法采样 in_use 与 checkedout',
    }
  }

  const allConns = state.connections
  const idleConns = state.idle
  const activeConns = state.active
  if (!Array.isArray(allConns) || !Array.isArray(idleConns) || !Array.isArray(activeConns)) {
    return {
      available: false,
      size,
      reason: '连接池内部 state 字段不完整(需要 connections/idle/active 三个数组)',
    }
  }

  return {
    available: true,
    size,
    inUse: activeConns.length,
    checkedOut: allConns.length - idleConns.length,
    // postgres.js 没有 overflow 概念(max 固定),真实可用时该值恒 0 是语义事实。
    overflow: 0,
  }
}
