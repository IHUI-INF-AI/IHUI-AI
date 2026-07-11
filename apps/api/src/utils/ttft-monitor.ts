/**
 * TTFT (Time To First Token) 监控器。
 *
 * 迁移自旧架构 app/utils/ttft_monitor.py。
 *
 * 设计：
 * - 记录每次流式 LLM 调用的首 token 延迟
 * - 同时记录总耗时 / token 数 / 速率
 * - 维度：model / endpoint / tenant
 * - 滑动窗口 + 简单分位数（P50/P90/P95/P99）
 * - 超阈值告警（默认 P95 > 2s 告警）
 *
 * 使用：
 *   const ctx = ttftMonitor.startStream('gpt-4o', '/chat', 'tenant-1');
 *   try {
 *     for await (const token of stream) {
 *       ctx.onToken();
 *     }
 *   } catch (err) {
 *     ctx.setError(err);
 *   } finally {
 *     ctx.end(); // 自动上报
 *   }
 */

// =============================================================================
// 类型定义
// =============================================================================

/** 单次 TTFT 记录。 */
export interface TtftRecord {
  /** 模型名称 */
  model: string
  /** 调用端点 */
  endpoint: string
  /** 租户 ID */
  tenantId: string
  /** 首 token 延迟（秒） */
  ttftSec: number
  /** 总耗时（秒） */
  totalSec: number
  /** token 数 */
  tokenCount: number
  /** Unix 时间戳（秒） */
  ts: number
  /** 错误信息（空字符串表示成功） */
  error: string
}

/** 分位数统计结果。 */
export interface PercentileStats {
  p50: number
  p90: number
  p95: number
  p99: number
  count: number
}

/** 监控器整体统计。 */
export interface TtftStats {
  totalCalls: number
  errorCalls: number
  errorRate: number
  alertCount: number
  alertP95Sec: number
  window: number
  current: PercentileStats
}

// =============================================================================
// 常量
// =============================================================================

const DEFAULT_WINDOW = 200
const DEFAULT_ALERT_P95_SEC = 2.0
/** 告警判断的最小样本数 */
const ALERT_MIN_SAMPLES = 20
/** 告警窗口（秒） */
const ALERT_WINDOW_SEC = 300

// =============================================================================
// 分位数计算
// =============================================================================

/**
 * 计算分位数（线性插值法）。
 *
 * @param values 数值列表（无需预排序）
 * @param p 分位数（0-1），如 0.50 / 0.95
 * @returns 分位数值，空列表返回 0
 */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const k = (sorted.length - 1) * p
  const f = Math.floor(k)
  const c = Math.min(f + 1, sorted.length - 1)
  if (f === c) return sorted[f] ?? 0
  const fv = sorted[f] ?? 0
  const cv = sorted[c] ?? 0
  return fv + (cv - fv) * (k - f)
}

/** 从数值列表计算分位数统计。 */
function percentilesFrom(vals: number[]): PercentileStats {
  return {
    p50: Math.round(percentile(vals, 0.5) * 10000) / 10000,
    p90: Math.round(percentile(vals, 0.9) * 10000) / 10000,
    p95: Math.round(percentile(vals, 0.95) * 10000) / 10000,
    p99: Math.round(percentile(vals, 0.99) * 10000) / 10000,
    count: vals.length,
  }
}

// =============================================================================
// TTFT 监控器
// =============================================================================

/**
 * TTFT 监控器。
 *
 * 线程安全（通过单一 Node 事件循环保证），使用滑动窗口记录最近的 TTFT 样本。
 */
export class TtftMonitor {
  private readonly records: TtftRecord[] = []
  private readonly maxRecords: number
  private alertP95: number
  private alertCount = 0
  private totalCalls = 0
  private errorCalls = 0

  constructor(window: number = DEFAULT_WINDOW, alertP95: number = DEFAULT_ALERT_P95_SEC) {
    this.maxRecords = Math.max(10, window * 4)
    this.alertP95 = Math.max(0, alertP95)
  }

  /** 设置告警 P95 阈值（秒）。 */
  setAlertP95(sec: number): void {
    this.alertP95 = Math.max(0, sec)
  }

  /**
   * 记录一次流式 LLM 调用的 TTFT。
   *
   * @param model 模型名称
   * @param endpoint 调用端点
   * @param tenantId 租户 ID
   * @param ttftSec 首 token 延迟（秒）
   * @param totalSec 总耗时（秒）
   * @param tokenCount token 数
   * @param error 错误信息（可选）
   * @returns 创建的记录
   */
  record(
    model: string,
    endpoint: string,
    tenantId: string,
    ttftSec: number,
    totalSec: number,
    tokenCount: number,
    error: string = '',
  ): TtftRecord {
    const rec: TtftRecord = {
      model,
      endpoint,
      tenantId,
      ttftSec,
      totalSec,
      tokenCount,
      ts: Date.now() / 1000,
      error,
    }

    this.records.push(rec)
    // 超出窗口时移除最旧的
    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords)
    }

    this.totalCalls++
    if (error) {
      this.errorCalls++
    }

    // 检查 P95 告警（5min 窗口内至少 20 个样本）
    const cutoff = Date.now() / 1000 - ALERT_WINDOW_SEC
    const recent = this.records.filter((r) => r.ts >= cutoff).map((r) => r.ttftSec)
    if (recent.length >= ALERT_MIN_SAMPLES) {
      const p95 = percentile(recent, 0.95)
      if (p95 > this.alertP95) {
        this.alertCount++
        console.warn(
          `[ttft] alert: p95=${p95.toFixed(3)}s > ${this.alertP95}s ` +
            `model=${model} endpoint=${endpoint}`,
        )
      }
    }

    return rec
  }

  /**
   * 获取分位数统计。
   *
   * @param model 可选，按模型过滤
   * @param lastN 取最近 N 条样本，默认 200
   */
  percentiles(model?: string, lastN: number = DEFAULT_WINDOW): PercentileStats {
    let slice = this.records.slice(-lastN)
    if (model) {
      slice = slice.filter((r) => r.model === model)
    }
    return percentilesFrom(slice.map((r) => r.ttftSec))
  }

  /** 获取整体统计。 */
  stats(): TtftStats {
    const vals = this.records.slice(-DEFAULT_WINDOW).map((r) => r.ttftSec)
    return {
      totalCalls: this.totalCalls,
      errorCalls: this.errorCalls,
      errorRate:
        this.totalCalls > 0 ? Math.round((this.errorCalls / this.totalCalls) * 10000) / 10000 : 0,
      alertCount: this.alertCount,
      alertP95Sec: this.alertP95,
      window: this.maxRecords,
      current: percentilesFrom(vals),
    }
  }

  /** 获取最近 N 条原始记录。 */
  getRecords(lastN: number = 50): TtftRecord[] {
    return this.records.slice(-lastN)
  }

  /** 清空所有记录和计数器。 */
  clear(): void {
    this.records.length = 0
    this.totalCalls = 0
    this.errorCalls = 0
    this.alertCount = 0
  }
}

/** 全局单例。 */
export const ttftMonitor = new TtftMonitor()

// =============================================================================
// 流式 TTFT 上下文
// =============================================================================

/**
 * 流式 LLM 调用的 TTFT 计时上下文。
 *
 * 迁移自 Python StreamTTFT。
 *
 * 用法：
 *   const ctx = ttftMonitor.startStream('gpt-4o', '/chat', 't1');
 *   try {
 *     for await (const token of stream) { ctx.onToken(); }
 *   } catch (err) {
 *     ctx.setError(err instanceof Error ? err.message : String(err));
 *   } finally {
 *     ctx.end();
 *   }
 */
export class StreamTTFT {
  private readonly model: string
  private readonly endpoint: string
  private readonly tenantId: string
  private readonly startTime: number
  private firstTokenTime = 0
  private endTime = 0
  private tokenCount = 0
  private error = ''
  private gotFirstToken = false
  private ended = false
  private readonly monitor: TtftMonitor

  constructor(
    model: string,
    endpoint: string = '',
    tenantId: string = '',
    monitor: TtftMonitor = ttftMonitor,
  ) {
    this.model = model
    this.endpoint = endpoint
    this.tenantId = tenantId
    this.monitor = monitor
    this.startTime = Date.now() / 1000
  }

  /**
   * 每收到一个 token 调用。第一次调用记录 TTFT。
   */
  onToken(): void {
    if (!this.gotFirstToken) {
      this.firstTokenTime = Date.now() / 1000
      this.gotFirstToken = true
    }
    this.tokenCount++
  }

  /** 设置错误信息。 */
  setError(err: string): void {
    this.error = err
  }

  /**
   * 结束计时并上报到监控器。
   * 重复调用不会重复上报。
   *
   * @returns 首 token 延迟（秒），未收到 token 则返回总耗时
   */
  end(): number {
    if (this.ended) return 0
    this.ended = true
    this.endTime = Date.now() / 1000

    // 没有收到任何 token 时，TTFT = 总耗时
    if (!this.gotFirstToken) {
      this.firstTokenTime = this.endTime
    }

    const ttftSec = this.firstTokenTime - this.startTime
    const totalSec = this.endTime - this.startTime

    this.monitor.record(
      this.model,
      this.endpoint,
      this.tenantId,
      ttftSec,
      totalSec,
      this.tokenCount,
      this.error,
    )

    return ttftSec
  }
}
