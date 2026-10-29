// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 流式遥测纯函数层(大屏指挥台)。
 *
 * 只做"从观测值推导读数",不持状态、不取时间:时间由调用方注入(便于测试)。
 * 失效方向:缺任何一项 ⇒ 该项显示为空,绝不拿 0 冒充"很快/没花时间"
 * (与 AGENTS §5e-3 "取不到不冒充 0" 同一条纪律)。
 */

export type StreamTelemetryPhase = 'waiting' | 'thinking' | 'tool' | 'writing' | 'done'

export interface StreamTelemetryInput {
  isStreaming: boolean
  /** 本轮开始时刻;null = 从未跑过 */
  startedAt: number | null
  /** 首个正文字符到达时刻;null = 还没出字 */
  firstTokenAt: number | null
  /** 本轮结束时刻;仅在 isStreaming=false 时有意义 */
  endedAt: number | null
  /** 当前时刻(流式期间由调用方 tick 注入) */
  now: number
  /** 已到达的正文字符数(正文 + 思考) */
  chars: number
  /** token 数;null = 后端还没回 usage */
  tokens: number | null
  runningTools: number
  hasReasoning: boolean
  hasContent: boolean
}

export interface StreamTelemetrySnapshot {
  phase: StreamTelemetryPhase
  elapsedMs: number
  ttftMs: number | null
  charsPerSec: number
  tokensPerSec: number | null
}

/** 速率样本下限:不足 200ms 的窗口算速率会把"首帧"放大成假高值 */
const MIN_RATE_WINDOW_MS = 200

export function deriveStreamTelemetry(input: StreamTelemetryInput): StreamTelemetrySnapshot {
  const {
    isStreaming,
    startedAt,
    firstTokenAt,
    endedAt,
    now,
    chars,
    tokens,
    runningTools,
    hasReasoning,
    hasContent,
  } = input

  if (startedAt === null) {
    return { phase: 'waiting', elapsedMs: 0, ttftMs: null, charsPerSec: 0, tokensPerSec: null }
  }

  const end = isStreaming ? now : (endedAt ?? now)
  const elapsedMs = Math.max(0, end - startedAt)
  const phase: StreamTelemetryPhase = isStreaming
    ? runningTools > 0
      ? 'tool'
      : hasContent
        ? 'writing'
        : hasReasoning
          ? 'thinking'
          : 'waiting'
    : 'done'

  const ttftMs = firstTokenAt === null ? null : Math.max(0, firstTokenAt - startedAt)
  const streamedMs = firstTokenAt === null ? 0 : Math.max(0, end - firstTokenAt)
  const charsPerSec =
    chars > 0 && streamedMs >= MIN_RATE_WINDOW_MS ? Math.round((chars / streamedMs) * 1000) : 0
  const tokensPerSec =
    tokens !== null && tokens > 0 && elapsedMs >= MIN_RATE_WINDOW_MS
      ? Math.round((tokens / elapsedMs) * 1000 * 10) / 10
      : null

  return { phase, elapsedMs, ttftMs, charsPerSec, tokensPerSec }
}

export interface TelemetryUsageTruth {
  firstTokenMs: number
  durationMs: number
  totalTokens: number
}

/**
 * 后端 usage 帧到达后用权威值覆盖实时估算(仅覆盖"有值且为正"的字段)。
 * usage 的 firstTokenMs/durationMs 是从请求发出量到流结束,与实时口径同源。
 */
export function applyUsageTruth(
  snapshot: StreamTelemetrySnapshot,
  usage: TelemetryUsageTruth | null,
): StreamTelemetrySnapshot {
  if (!usage) return snapshot
  const ttftMs = usage.firstTokenMs > 0 ? usage.firstTokenMs : snapshot.ttftMs
  const elapsedMs = usage.durationMs > 0 ? usage.durationMs : snapshot.elapsedMs
  const tokensPerSec =
    usage.totalTokens > 0 && elapsedMs >= MIN_RATE_WINDOW_MS
      ? Math.round((usage.totalTokens / elapsedMs) * 1000 * 10) / 10
      : snapshot.tokensPerSec
  return { ...snapshot, ttftMs, elapsedMs, tokensPerSec }
}

/** 紧凑计数:999 / 1.2k / 3.4M(读数不得断行的前提是短) */
export function formatCompactCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return ''
  if (value < 1000) return String(Math.round(value))
  if (value < 1_000_000) {
    const k = value / 1000
    return `${k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)}k`
  }
  const m = value / 1_000_000
  return `${m < 10 ? m.toFixed(1).replace(/\.0$/, '') : Math.round(m)}M`
}

/** 秒表读数:8.4s / 1m03s / 1h02m */
export function formatElapsedShort(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ''
  const totalSeconds = ms / 1000
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 60) {
    const seconds = Math.floor(totalSeconds % 60)
    return `${minutes}m${String(seconds).padStart(2, '0')}s`
  }
  const hours = Math.floor(minutes / 60)
  return `${hours}h${String(minutes % 60).padStart(2, '0')}m`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
