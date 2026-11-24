// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 启动/首屏指标取数。
 *
 * 口径复用既有 `ui-perf-telemetry` 的 STARTUP_MAX_SANE_MS（300s）作异常值闸：
 * - appStartMs：Provider 挂载时的 `performance.now()`（相对 navigationStart）
 * - firstPaintMs：Paint Timing 的 `first-contentful-paint`；拿不到时退回导航时序的
 *   `domContentLoadedEventEnd`，两者都不可用则留空（不拿 0 冒充"已可见"）。
 *
 * 只发出一个 `rum_app_start` 事件；首屏时间晚于上报时用 PerformanceObserver 等待一次，
 * 10s 仍等不到就以空值发出，避免无限挂起。
 */

import { STARTUP_MAX_SANE_MS } from '@/lib/ui-perf-telemetry'
import type { RumCollector } from './collector'

export interface StartupTiming {
  appStartMs: number
  firstPaintMs: number | null
}

type PerformanceLike = Pick<Performance, 'now' | 'getEntriesByType'>

const FIRST_PAINT_TIMEOUT_MS = 10_000

export function readStartupTiming(
  perf: PerformanceLike | null | undefined = typeof performance !== 'undefined'
    ? performance
    : null,
): StartupTiming | null {
  if (!perf) return null
  const appStartMs = Math.round(perf.now())
  if (!Number.isFinite(appStartMs) || appStartMs < 0 || appStartMs > STARTUP_MAX_SANE_MS) {
    return null
  }
  let firstPaintMs: number | null = null
  try {
    const paintEntries = perf.getEntriesByType('paint')
    const fcp = paintEntries.find((entry) => entry.name === 'first-contentful-paint')
    if (fcp) {
      firstPaintMs = Math.round(fcp.startTime)
    } else {
      const navigation = perf.getEntriesByType('navigation')[0] as
        PerformanceNavigationTiming | undefined
      if (navigation && navigation.domContentLoadedEventEnd > 0) {
        firstPaintMs = Math.round(navigation.domContentLoadedEventEnd)
      }
    }
  } catch {
    firstPaintMs = null
  }
  if (
    firstPaintMs !== null &&
    (!Number.isFinite(firstPaintMs) || firstPaintMs < 0 || firstPaintMs > STARTUP_MAX_SANE_MS)
  ) {
    firstPaintMs = null
  }
  return { appStartMs, firstPaintMs }
}

/**
 * 安装启动指标上报。返回清理函数（仅用于等待首屏时的 observer/timer）。
 * 未同意时 record 内部直接丢弃，这里不额外发请求。
 */
export function installStartupRum(collector: RumCollector): () => void {
  const timing = readStartupTiming()
  if (!timing) return () => {}
  const emit = (firstPaintMs: number | null) => {
    const observed = recordStartupMarks(firstPaintMs)
    collector.record('rum_app_start', {
      app_start_ms: timing.appStartMs,
      ...(firstPaintMs === null ? {} : { first_paint_ms: firstPaintMs }),
      ...startupMarkFields(observed),
    })
  }
  if (timing.firstPaintMs !== null) {
    emit(timing.firstPaintMs)
    return () => {}
  }
  if (typeof PerformanceObserver === 'undefined') {
    emit(null)
    return () => {}
  }
  let done = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let observer: PerformanceObserver | null = null
  const finish = (firstPaintMs: number | null) => {
    if (done) return
    done = true
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    try {
      observer?.disconnect()
    } catch {
      // ignore
    }
    observer = null
    emit(firstPaintMs)
  }
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          finish(Math.round(entry.startTime))
          return
        }
      }
    })
    observer.observe({ type: 'paint', buffered: true })
  } catch {
    emit(null)
    return () => {}
  }
  timer = setTimeout(() => finish(null), FIRST_PAINT_TIMEOUT_MS)
  return () => finish(null)
}

export type StartupMarkReport = {
  disposition: 'complete' | 'incomplete' | 'unjudged'
  reason:
    | 'all-present'
    | 'marks-missing'
    | 'schema-unmeasured'
    | 'observation-unmeasured'
    | 'schema-empty'
    | 'schema-invalid'
    | 'observation-invalid'
    | 'undeclared-hit'
  missing: readonly string[]
}

function startupMarkIdOk(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !/[\s\0]/.test(value)
}

/**
 * 对照声明过的启动点，把没出现的点逐条列出来。
 * 声明或观测还没量到时，不把缺席说成「一个都没漏」。
 * 声明是空的也不算全齐。观测里多出来的点同样不算通过。
 */
const DECLARED_STARTUP_MARKS = ['app-start', 'first-paint'] as const

/**
 * 只把 performance.mark 真正收下的名字交出去。
 * 接口本身不在时返回 null，调用方不得把 null 说成「一个都没漏」。
 */
export function recordStartupMarks(firstPaintMs: number | null): readonly string[] | null {
  const perf = globalThis.performance
  if (perf === undefined || typeof perf.mark !== 'function') return null
  const wanted = firstPaintMs === null ? ['app-start'] : ['app-start', 'first-paint']
  const landed: string[] = []
  for (const name of wanted) {
    try {
      perf.mark(name)
      landed.push(name)
    } catch {
      // 这一笔没落到观测面，不记入已打点
    }
  }
  return landed
}

/** 只声明这两点。观测名单来自打点接口，不来自首屏毫秒数。 */
export function startupMarkFields(observed: readonly string[] | null): {
  startup_mark_disposition: StartupMarkReport['disposition']
  startup_marks_missing?: string
} {
  const report = reportStartupMarks({ declared: DECLARED_STARTUP_MARKS, observed })
  if (report.missing.length === 0) return { startup_mark_disposition: report.disposition }
  return {
    startup_mark_disposition: report.disposition,
    startup_marks_missing: report.missing.join(','),
  }
}

export function reportStartupMarks(input: {
  declared: readonly string[] | null
  observed: readonly string[] | null
}): StartupMarkReport {
  const none = (reason: StartupMarkReport['reason']): StartupMarkReport => ({
    disposition: 'unjudged',
    reason,
    missing: [],
  })
  if (input.declared === null) return none('schema-unmeasured')
  if (input.observed === null) return none('observation-unmeasured')
  if (input.declared.length === 0) return none('schema-empty')
  if (
    input.declared.some((id) => !startupMarkIdOk(id)) ||
    new Set(input.declared).size !== input.declared.length
  ) {
    return none('schema-invalid')
  }
  if (input.observed.some((id) => !startupMarkIdOk(id))) return none('observation-invalid')
  const declared = new Set(input.declared)
  if (input.observed.some((id) => !declared.has(id))) return none('undeclared-hit')
  const seen = new Set(input.observed)
  const missing = input.declared.filter((id) => !seen.has(id))
  if (missing.length === 0) return { disposition: 'complete', reason: 'all-present', missing: [] }
  return { disposition: 'incomplete', reason: 'marks-missing', missing }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
