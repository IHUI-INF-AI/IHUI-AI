/**
 * 监控工具集（合并版）
 *
 * 合并自旧架构 utils/ 下的 4 个监控相关文件：
 * - monitor / monitoring / monitoring-websocket / webVitals
 *
 * 新架构基于纯 TypeScript + Web API，无 Vue 依赖。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'

/* ------------------------------------------------------------------ */
/* Web Vitals（webVitals）                                             */
/* ------------------------------------------------------------------ */

export interface WebVitalsMetric {
  name: 'CLS' | 'LCP' | 'FID' | 'FID' | 'TTFB' | 'INP' | 'FCP'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  id: string
  timestamp: number
}

const vitalsBuffer: WebVitalsMetric[] = []
const MAX_VITALS = 100

const vitalsHandlers = new Set<(metric: WebVitalsMetric) => void>()

export function onVitals(handler: (metric: WebVitalsMetric) => void): () => void {
  vitalsHandlers.add(handler)
  return () => vitalsHandlers.delete(handler)
}

export function recordVital(metric: Omit<WebVitalsMetric, 'timestamp'>): void {
  const full: WebVitalsMetric = { ...metric, timestamp: Date.now() }
  vitalsBuffer.push(full)
  if (vitalsBuffer.length > MAX_VITALS) vitalsBuffer.shift()
  for (const h of vitalsHandlers) {
    try {
      h(full)
    } catch {
      // 忽略
    }
  }
}

export function getVitals(): WebVitalsMetric[] {
  return vitalsBuffer.slice()
}

export function getVitalsSummary(): Record<string, { value: number; rating: string }> {
  const summary: Record<string, { value: number; rating: string }> = {}
  const byName = new Map<string, WebVitalsMetric>()
  for (const v of vitalsBuffer) {
    const existing = byName.get(v.name)
    if (!existing || v.timestamp > existing.timestamp) {
      byName.set(v.name, v)
    }
  }
  for (const [name, v] of byName) {
    summary[name] = { value: v.value, rating: v.rating }
  }
  return summary
}

/** 评级阈值（依据 Google 建议） */
export function rateVital(name: WebVitalsMetric['name'], value: number): WebVitalsMetric['rating'] {
  const thresholds: Record<WebVitalsMetric['name'], [number, number]> = {
    LCP: [2500, 4000],
    FID: [100, 300],
    CLS: [0.1, 0.25],
    FCP: [1800, 3000],
    TTFB: [800, 1800],
    INP: [200, 500],
  }
  const [good, poor] = thresholds[name] ?? [0, 0]
  if (value <= good) return 'good'
  if (value <= poor) return 'needs-improvement'
  return 'poor'
}

/* ------------------------------------------------------------------ */
/* 性能监控（monitor）                                                 */
/* ------------------------------------------------------------------ */

export interface PerfMetric {
  name: string
  value: number
  unit: 'ms' | 'count' | 'byte' | 'percent'
  tags?: Record<string, string>
  timestamp: number
}

const perfBuffer: PerfMetric[] = []
const MAX_PERF = 500

export function recordMetric(
  name: string,
  value: number,
  unit: PerfMetric['unit'] = 'ms',
  tags?: Record<string, string>,
): void {
  perfBuffer.push({ name, value, unit, tags, timestamp: Date.now() })
  if (perfBuffer.length > MAX_PERF) perfBuffer.shift()
}

export function getMetrics(name?: string): PerfMetric[] {
  return name ? perfBuffer.filter((m) => m.name === name) : perfBuffer.slice()
}

export function aggregateMetric(
  name: string,
  windowMs = 60_000,
): { avg: number; min: number; max: number; count: number; p95: number } {
  const now = Date.now()
  const values = perfBuffer
    .filter((m) => m.name === name && now - m.timestamp <= windowMs)
    .map((m) => m.value)
    .sort((a, b) => a - b)
  if (values.length === 0) {
    return { avg: 0, min: 0, max: 0, count: 0, p95: 0 }
  }
  const sum = values.reduce((s, v) => s + v, 0)
  const p95Idx = Math.min(values.length - 1, Math.floor(values.length * 0.95))
  return {
    avg: sum / values.length,
    min: values[0] ?? 0,
    max: values[values.length - 1] ?? 0,
    count: values.length,
    p95: values[p95Idx] ?? 0,
  }
}

/** 计时器辅助 */
export function startTimer(name: string): () => number {
  const start = performance.now()
  return () => {
    const duration = performance.now() - start
    recordMetric(name, duration, 'ms')
    return duration
  }
}

/* ------------------------------------------------------------------ */
/* 监控上报（monitoring）                                              */
/* ------------------------------------------------------------------ */

export interface MonitoringConfig {
  endpoint: string
  flushInterval: number
  batchSize: number
  enabled: boolean
}

const defaultConfig: MonitoringConfig = {
  endpoint: '/monitoring/report',
  flushInterval: 30_000,
  batchSize: 50,
  enabled: true,
}

let config: MonitoringConfig = { ...defaultConfig }
let flushTimer: ReturnType<typeof setInterval> | null = null

export function configureMonitoring(next: Partial<MonitoringConfig>): void {
  config = { ...config, ...next }
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  if (config.enabled) startFlushTimer()
}

export async function flushMetrics(): Promise<void> {
  if (!config.enabled || perfBuffer.length === 0) return
  const batch = perfBuffer.splice(0, config.batchSize)
  try {
    await fetchApi<{ accepted: number }>(config.endpoint, {
      method: 'POST',
      body: JSON.stringify({ metrics: batch }),
    })
  } catch {
    // 上报失败时把数据放回头部，等待下次重试
    perfBuffer.unshift(...batch)
  }
}

function startFlushTimer(): void {
  if (typeof window === 'undefined') return
  flushTimer = setInterval(() => {
    void flushMetrics()
  }, config.flushInterval)
}

export function stopMonitoring(): void {
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
}

/* ------------------------------------------------------------------ */
/* WebSocket 实时监控（monitoring-websocket）                          */
/* ------------------------------------------------------------------ */

export type MonitoringWsEvent = 'metric' | 'alert' | 'log' | 'trace' | 'health'

export interface MonitoringWsMessage {
  type: MonitoringWsEvent
  payload: Record<string, unknown>
  timestamp: number
}

export class MonitoringWebSocket {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnect = 5
  private reconnectDelay = 1000
  private handlers = new Map<MonitoringWsEvent, Set<(msg: MonitoringWsMessage) => void>>()
  private closed = false

  constructor(url: string) {
    this.url = url
  }

  connect(): void {
    if (typeof WebSocket === 'undefined') return
    this.closed = false
    try {
      this.ws = new WebSocket(this.url)
      this.ws.onopen = () => {
        this.reconnectAttempts = 0
      }
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as MonitoringWsMessage
          const set = this.handlers.get(msg.type)
          if (set) for (const h of set) h(msg)
        } catch {
          // 忽略无法解析的消息
        }
      }
      this.ws.onclose = () => {
        if (this.closed) return
        if (this.reconnectAttempts < this.maxReconnect) {
          this.reconnectAttempts += 1
          setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts)
        }
      }
      this.ws.onerror = () => {
        // 触发 onclose 后会重连
      }
    } catch {
      // WebSocket 不可用时静默降级到 HTTP 轮询
    }
  }

  on(type: MonitoringWsEvent, handler: (msg: MonitoringWsMessage) => void): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(handler)
    return () => set?.delete(handler)
  }

  send(type: MonitoringWsEvent, payload: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }))
    }
  }

  close(): void {
    this.closed = true
    this.ws?.close()
    this.ws = null
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

/* ------------------------------------------------------------------ */
/* 错误上报                                                            */
/* ------------------------------------------------------------------ */

export interface ErrorReport {
  type: 'js_error' | 'promise_rejection' | 'resource_error' | 'api_error'
  message: string
  stack?: string
  filename?: string
  lineno?: number
  colno?: number
  url: string
  userAgent: string
  timestamp: number
  metadata?: Record<string, unknown>
}

export async function reportError(
  report: Omit<ErrorReport, 'timestamp' | 'url' | 'userAgent'>,
): Promise<ApiResult<{ reported: boolean }>> {
  const full: ErrorReport = {
    ...report,
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    timestamp: Date.now(),
  }
  return fetchApi<{ reported: boolean }>('/monitoring/errors', {
    method: 'POST',
    body: JSON.stringify(full),
  })
}

/** 全局错误监听（在客户端调用一次） */
export function setupGlobalErrorReporting(): () => void {
  if (typeof window === 'undefined') return () => {}
  const onError = (event: ErrorEvent) => {
    void reportError({
      type: 'js_error',
      message: event.message,
      stack: event.error?.stack,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  }
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason
    void reportError({
      type: 'promise_rejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}
