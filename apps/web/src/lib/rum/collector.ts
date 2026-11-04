// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 客户端 RUM 采集核心（无第三方 SDK）。
 *
 * 三类指标：
 * - 启动/首屏：`rum_app_start`（appStartMs + first-contentful-paint，取数口径见 startup.ts）
 * - AI 交互：`rum_ai_ttft`（请求下发 → 首 token）、`rum_ai_stream_done`（首 token → 完成 + 流式窗口长任务数）
 * - 错误：`rum_error_uncaught`（未捕获异常/未处理 rejection）、`rum_request_failure`（按接口路径聚合）
 *
 * 边界（硬要求）：
 * - 同意闸关闭 ⇒ record 直接返回 false，连缓冲都不入；flush 也直接返回，网络请求数为 0。
 * - 采样率可配但上限 1%，超限按 1% 执行；采样不通过的事件直接丢弃，不补报。
 * - 缓冲上限 50 条，溢出直接丢弃；单批最多 20 条。
 * - 上报失败静默丢弃（不重排队），连续失败 2 次熔断，本次会话不再发请求 ⇒ 无重试风暴。
 */

import {
  getCoarsePlatform,
  sanitizeApiPath,
  sanitizeRumProps,
  type CoarsePlatform,
  type RumProps,
} from './privacy'

export const RUM_SAMPLING_RATE_MAX = 0.01
export const RUM_DEFAULT_SAMPLING_RATE = 0.01
export const RUM_MAX_BUFFERED_EVENTS = 50
export const RUM_MAX_BATCH_SIZE = 20
export const RUM_FLUSH_INTERVAL_MS = 30_000
export const RUM_MAX_CONSECUTIVE_FAILURES = 2
/** 单次同意周期内的硬上限：即使采样随机源异常，也不会无界上报。 */
export const RUM_MAX_EVENTS_PER_SESSION = 200
/** 请求失败聚合键上限：防止异常路径把基数打爆。 */
export const RUM_MAX_REQUEST_FAILURE_KEYS = 20
/** 已记录完成的 messageId 上限：只做幂等去重，不做历史归档。 */
const RUM_MAX_COMPLETION_KEYS = 200

export type RumEventName =
  | 'rum_app_start'
  | 'rum_ai_ttft'
  | 'rum_ai_stream_done'
  | 'rum_error_uncaught'
  | 'rum_request_failure'

export interface RumEvent {
  name: RumEventName
  props: RumProps
  timestamp: number
}

export type RumTransport = (events: RumEvent[]) => Promise<unknown> | unknown

/** 采样判定：candidateIndex 从 1 开始递增。返回 true 才入队。 */
export type RumSampler = (candidateIndex: number, samplingRate: number, offset: number) => boolean

export interface RumCollectorOptions {
  transport: RumTransport
  /** 同意判定；默认由调用方传入（生产用 isRumConsentGranted）。 */
  consent: () => boolean
  samplingRate?: number
  random?: () => number
  now?: () => number
  platform?: () => CoarsePlatform
  /** 测试可注入恒真采样；生产用默认的系统采样。 */
  sampler?: RumSampler
}

export interface RumCollectorStats {
  buffered: number
  sent: number
  sampledOut: number
  sessionDropped: number
  overflowDropped: number
  consecutiveFailures: number
  breakerOpen: boolean
  requestFailureKeys: number
}

interface RequestFailureAggregate {
  apiPath: string
  status: number | null
  count: number
}

/** 采样率夹取：非有限值/负数 ⇒ 0；超过 1% ⇒ 1%。 */
export function clampRumSamplingRate(rate: unknown): number {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return 0
  return Math.min(rate, RUM_SAMPLING_RATE_MAX)
}

/**
 * 系统采样（默认）：第 i 个候选跨过 rate 的整数格时接受。
 * 对任意 N 都有确定上界（N=1000、rate=1% ⇒ 恰好 10 条），优于随机数的期望值语义。
 */
export const systematicSampler: RumSampler = (candidateIndex, samplingRate, offset) => {
  if (samplingRate <= 0) return false
  const previous = Math.floor((candidateIndex - 1 + offset) * samplingRate)
  const current = Math.floor((candidateIndex + offset) * samplingRate)
  return current > previous
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message || error.name
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  try {
    return String(error)
  } catch {
    return 'unknown'
  }
}

export class RumCollector {
  private readonly transport: RumTransport
  private readonly consent: () => boolean
  private readonly random: () => number
  private readonly sampler: RumSampler
  private readonly now: () => number
  private readonly platform: () => CoarsePlatform

  private samplingRate: number
  /**
   * 系统采样的固定相位（0~1）。用"第 i 个候选是否跨过 rate 的整数格"判定，
   * 而不是逐事件 Math.random() < rate：前者对任意 N 都有确定上界
   * （1000 条 @1% ⇒ 恰好 10 条），满足"上报条数不超过上限"；
   * 后者只有期望值，尾部会超限。相位只是把采样点错开，不改变数量上界。
   */
  private readonly samplingOffset: number
  private candidateCount = 0
  private acceptedCount = 0
  private buffer: RumEvent[] = []
  private requestFailures = new Map<string, RequestFailureAggregate>()
  private completionKeys = new Set<string>()

  private timer: ReturnType<typeof setInterval> | null = null
  private flushing = false
  private consecutiveFailures = 0
  private breakerOpen = false

  private sent = 0
  private sampledOut = 0
  private sessionDropped = 0
  private overflowDropped = 0

  constructor(options: RumCollectorOptions) {
    this.transport = options.transport
    this.consent = options.consent
    this.samplingRate = clampRumSamplingRate(options.samplingRate ?? RUM_DEFAULT_SAMPLING_RATE)
    this.random = options.random ?? Math.random
    this.samplingOffset = Math.min(Math.max(this.random(), 0), 0.999_999)
    this.sampler = options.sampler ?? systematicSampler
    this.now = options.now ?? (() => Date.now())
    this.platform = options.platform ?? (() => getCoarsePlatform())
  }

  getStats(): RumCollectorStats {
    return {
      buffered: this.buffer.length,
      sent: this.sent,
      sampledOut: this.sampledOut,
      sessionDropped: this.sessionDropped,
      overflowDropped: this.overflowDropped,
      consecutiveFailures: this.consecutiveFailures,
      breakerOpen: this.breakerOpen,
      requestFailureKeys: this.requestFailures.size,
    }
  }

  /** 供测试替换采样率；生产不在运行期改。 */
  setSamplingRate(rate: unknown): void {
    this.samplingRate = clampRumSamplingRate(rate)
  }

  start(): void {
    if (this.timer !== null) return
    // 未同意不建定时器：关闭态连"每 30s 空转"都不要。
    if (!this.consent()) return
    this.timer = setInterval(() => {
      void this.flush()
    }, RUM_FLUSH_INTERVAL_MS)
  }

  /** 停止采集（撤回同意/卸载）。缓冲与聚合计数一并清空，熔断状态复位。 */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.buffer = []
    this.requestFailures.clear()
    this.consecutiveFailures = 0
    this.breakerOpen = false
    this.flushing = false
    this.candidateCount = 0
    this.acceptedCount = 0
  }

  /** 采集一条指标。返回是否真正入队（false = 未同意/采样未命中/溢出/熔断）。 */
  record(name: RumEventName, props?: Record<string, unknown>): boolean {
    if (!this.consent() || this.breakerOpen) return false
    if (this.samplingRate <= 0) {
      this.sampledOut += 1
      return false
    }
    this.candidateCount += 1
    if (!this.sampler(this.candidateCount, this.samplingRate, this.samplingOffset)) {
      this.sampledOut += 1
      return false
    }
    if (this.acceptedCount >= RUM_MAX_EVENTS_PER_SESSION) {
      this.sessionDropped += 1
      return false
    }
    if (this.buffer.length >= RUM_MAX_BUFFERED_EVENTS) {
      // 超限直接丢弃新事件，不延后补报（补报会破坏"上限"语义）。
      this.overflowDropped += 1
      return false
    }
    this.acceptedCount += 1
    this.buffer.push({
      name,
      props: sanitizeRumProps(props),
      timestamp: this.now(),
    })
    if (this.buffer.length >= RUM_MAX_BATCH_SIZE) {
      void this.flush()
    }
    return true
  }

  /**
   * 请求失败按「接口路径 + 状态码」聚合。聚合事件不经采样（一个键只产一条），
   * 但键数有上限，避免异常路径打爆基数。
   */
  recordRequestFailure(path: string, status?: number): void {
    if (!this.consent() || this.breakerOpen) return
    const apiPath = sanitizeApiPath(path)
    const normalizedStatus =
      typeof status === 'number' && Number.isFinite(status) && status >= 0 && status <= 999
        ? Math.round(status)
        : null
    const key = `${apiPath}|${normalizedStatus ?? ''}`
    const existing = this.requestFailures.get(key)
    if (existing) {
      existing.count += 1
      return
    }
    if (this.requestFailures.size >= RUM_MAX_REQUEST_FAILURE_KEYS) return
    this.requestFailures.set(key, { apiPath, status: normalizedStatus, count: 1 })
  }

  /**
   * AI 交互指标：复用既有 CompletionFact 口径（firstTokenMs = 下发→首 token，
   * durationMs = 下发→完成），首 token→完成 = durationMs - firstTokenMs。
   * key 用于同一消息幂等去重（流式 hook 会在多次渲染中触发）。
   */
  recordAiCompletion(input: {
    key?: string
    firstTokenMs?: number | null
    durationMs: number
    longTasks?: number
  }): void {
    if (input.key) {
      if (this.completionKeys.has(input.key)) return
      if (this.completionKeys.size >= RUM_MAX_COMPLETION_KEYS) this.completionKeys.clear()
      this.completionKeys.add(input.key)
    }
    const duration = Number.isFinite(input.durationMs)
      ? Math.max(0, Math.round(input.durationMs))
      : 0
    if (duration <= 0) return
    const ttft =
      typeof input.firstTokenMs === 'number' &&
      Number.isFinite(input.firstTokenMs) &&
      input.firstTokenMs > 0
        ? Math.round(input.firstTokenMs)
        : null
    const platform = this.platform()
    if (ttft !== null) {
      this.record('rum_ai_ttft', { first_token_ms: ttft, platform })
    }
    const streamMs = ttft === null ? duration : Math.max(0, duration - ttft)
    const longTasks =
      typeof input.longTasks === 'number' && Number.isFinite(input.longTasks)
        ? Math.max(0, Math.round(input.longTasks))
        : 0
    this.record('rum_ai_stream_done', {
      stream_ms: streamMs,
      duration_ms: duration,
      long_tasks: longTasks,
      platform,
    })
  }

  /** 错误指标：只报类型 + 脱敏后的摘要，不报 stack / 文件路径 / URL。 */
  recordError(kind: 'error' | 'unhandledrejection', error: unknown): void {
    this.record('rum_error_uncaught', {
      error_type: kind,
      message: extractErrorMessage(error),
      platform: this.platform(),
    })
  }

  /**
   * 安装全局未捕获异常监听。
   * 关键：不调用 preventDefault —— 控制台/上层错误上报照常收到，业务异常不被吞。
   */
  installGlobalErrorHandlers(
    target: EventTarget | null = typeof window !== 'undefined' ? window : null,
  ): () => void {
    if (!target) return () => {}
    const onError = (event: Event) => {
      const errorEvent = event as ErrorEvent
      this.recordError('error', errorEvent.error ?? errorEvent.message)
    }
    const onRejection = (event: Event) => {
      const rejectionEvent = event as PromiseRejectionEvent
      this.recordError('unhandledrejection', rejectionEvent.reason)
    }
    target.addEventListener('error', onError)
    target.addEventListener('unhandledrejection', onRejection)
    return () => {
      target.removeEventListener('error', onError)
      target.removeEventListener('unhandledrejection', onRejection)
    }
  }

  /**
   * 清空缓冲并上报。
   * - 未同意 ⇒ 直接返回 0（不发任何请求）。
   * - 失败批次直接丢弃，不重新入队；连续 2 次失败后熔断。
   */
  async flush(): Promise<number> {
    if (!this.consent()) {
      this.buffer = []
      this.requestFailures.clear()
      return 0
    }
    if (this.breakerOpen || this.flushing) return 0
    const events = this.drain()
    if (events.length === 0) return 0
    this.flushing = true
    let sentNow = 0
    try {
      for (let index = 0; index < events.length; index += RUM_MAX_BATCH_SIZE) {
        if (!this.consent()) break
        const batch = events.slice(index, index + RUM_MAX_BATCH_SIZE)
        try {
          await this.transport(batch)
          sentNow += batch.length
          this.consecutiveFailures = 0
        } catch {
          // 静默丢弃：batch 已从缓冲移除，这里不重排、不延时重试。
          this.consecutiveFailures += 1
          if (this.consecutiveFailures >= RUM_MAX_CONSECUTIVE_FAILURES) {
            this.breakerOpen = true
            this.buffer = []
            this.requestFailures.clear()
            break
          }
        }
      }
      this.sent += sentNow
      return sentNow
    } finally {
      this.flushing = false
    }
  }

  private drain(): RumEvent[] {
    const events: RumEvent[] = []
    for (const aggregate of this.requestFailures.values()) {
      events.push({
        name: 'rum_request_failure',
        props: sanitizeRumProps({
          api_path: aggregate.apiPath,
          count: aggregate.count,
          ...(aggregate.status === null ? {} : { status: aggregate.status }),
          platform: this.platform(),
        }),
        timestamp: this.now(),
      })
    }
    this.requestFailures.clear()
    for (const event of this.buffer) events.push(event)
    this.buffer = []
    return events
  }
}

/**
 * 流式窗口长任务计数器。
 * 优先 PerformanceObserver 的 `long-animation-frame`（LoAF），不支持时退回 `longtask`；
 * 两者都没有时返回 0，不伪造读数。
 */
export interface RumLongTaskWindow {
  stop(): number
}

export function startRumLongTaskWindow(): RumLongTaskWindow {
  const noop: RumLongTaskWindow = { stop: () => 0 }
  if (typeof PerformanceObserver === 'undefined') return noop
  const supported = PerformanceObserver.supportedEntryTypes
  const entryType = supported?.includes('long-animation-frame')
    ? 'long-animation-frame'
    : supported?.includes('longtask')
      ? 'longtask'
      : null
  if (!entryType) return noop
  let count = 0
  let observer: PerformanceObserver | null = null
  try {
    observer = new PerformanceObserver((list) => {
      count += list.getEntries().length
    })
    observer.observe({ type: entryType, buffered: true })
  } catch {
    return noop
  }
  return {
    stop() {
      try {
        observer?.disconnect()
      } catch {
        // ignore
      }
      const total = count
      count = 0
      return total
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
