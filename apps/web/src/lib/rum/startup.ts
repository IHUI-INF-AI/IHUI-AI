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
    collector.record('rum_app_start', {
      app_start_ms: timing.appStartMs,
      ...(firstPaintMs === null ? {} : { first_paint_ms: firstPaintMs }),
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
