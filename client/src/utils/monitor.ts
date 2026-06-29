/**
 * 轻量前端监控（自研，无第三方依赖）
 * 收集：错误 / 性能 / 用户行为 / API 失败
 * 上报方式：console + localStorage 缓存 + 批量上报 /api/monitor/collect
 *
 * 启用开关：VITE_ENABLE_MONITOR=true（默认 dev 开启 / 生产关闭）
 *
 * 真实生产可替换为 Sentry SDK：
 *   1. npm install @sentry/vue
 *   2. import * as Sentry from '@sentry/vue'
 *   3. Sentry.init({ dsn, app, integrations: [Sentry.browserTracingIntegration()] })
 */

import type { App } from 'vue'

const ENABLED = String(import.meta.env.VITE_ENABLE_MONITOR ?? import.meta.env.DEV).toLowerCase() === 'true'
const REPORT_URL = import.meta.env.VITE_MONITOR_REPORT_URL || '/api/monitor/collect'
const MAX_BUFFER = 50
const REPORT_INTERVAL = 30_000

interface MonitorEvent {
  type: 'error' | 'performance' | 'api_fail' | 'user_action'
  payload: Record<string, unknown>
  ts: number
  url: string
  ua: string
}

const buffer: MonitorEvent[] = []
let reported = 0
let failed = 0

function send(events: MonitorEvent[]) {
  if (events.length === 0) return
  if (!ENABLED) return
  const body = JSON.stringify({
    events,
    app: 'ihui-ai-web',
    version: import.meta.env.VITE_APP_VERSION || 'dev',
    session: getSessionId(),
  })
  // 使用 sendBeacon 异步上报，失败降级 fetch
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' })
    if (navigator.sendBeacon(REPORT_URL, blob)) {
      reported += events.length
      return
    }
  }
  fetch(REPORT_URL, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
  })
    .then(() => { reported += events.length })
    .catch(() => { failed += events.length })
}

function getSessionId(): string {
  const KEY = 'monitor_session_id'
  let id = sessionStorage.getItem(KEY)
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    sessionStorage.setItem(KEY, id)
  }
  return id
}

function push(event: Omit<MonitorEvent, 'ts' | 'url' | 'ua'>) {
  if (!ENABLED) return
  const full: MonitorEvent = {
    ...event,
    ts: Date.now(),
    url: location.href,
    ua: navigator.userAgent,
  }
  buffer.push(full)
  if (buffer.length > MAX_BUFFER) buffer.shift()
  // 控制台输出（dev 模式可见）
  if (import.meta.env.DEV) {
    const tag = `[monitor] ${event.type}`
    if (event.type === 'error') console.warn(tag, event.payload)
    else console.debug(tag, event.payload)
  }
}

function setupErrorHandlers() {
  // 全局 JS 错误
  window.addEventListener('error', (e) => {
    push({
      type: 'error',
      payload: {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        stack: e.error?.stack?.slice(0, 500),
      },
    })
  })
  // Promise 拒绝
  window.addEventListener('unhandledrejection', (e) => {
    push({
      type: 'error',
      payload: {
        message: String(e.reason?.message || e.reason),
        stack: e.reason?.stack?.slice(0, 500),
        kind: 'unhandledrejection',
      },
    })
  })
}

function setupPerformanceObserver() {
  if (typeof PerformanceObserver === 'undefined') return
  try {
    // LCP
    new PerformanceObserver((list) => {
      const last = list.getEntries().slice(-1)[0] as PerformanceEntry & { renderTime?: number; loadTime?: number }
      if (last) {
        push({
          type: 'performance',
          payload: { metric: 'lcp', value: last.renderTime || last.loadTime || last.startTime },
        })
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    // FCP
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          push({ type: 'performance', payload: { metric: 'fcp', value: entry.startTime } })
        }
      }
    }).observe({ type: 'paint', buffered: true })
  } catch {
    /* PerformanceObserver 不可用 */
  }
}

function setupFetchInterceptor() {
  if (!window.fetch) return
  const original = window.fetch
  window.fetch = function (this: typeof original, input, init) {
    const url = typeof input === 'string' ? input : (input as Request).url
    const method = init?.method || (input as Request).method || 'GET'
    const start = performance.now()
    return original.call(this, input, init)
      .then((resp: Response) => {
        const duration = performance.now() - start
        if (!resp.ok && duration > 1000) {
          push({
            type: 'api_fail',
            payload: { url, method, status: resp.status, duration: Math.round(duration) },
          })
        }
        return resp
      })
      .catch((err: unknown) => {
        push({
          type: 'api_fail',
          payload: { url, method, error: String(err), duration: Math.round(performance.now() - start) },
        })
        throw err
      })
  } as typeof fetch
}

let timer: ReturnType<typeof setInterval> | null = null

function startReporter() {
  if (timer) return
  timer = setInterval(() => {
    if (buffer.length === 0) return
    const events = buffer.splice(0, buffer.length)
    send(events)
  }, REPORT_INTERVAL)
  // 页面卸载前最后上报一次
  window.addEventListener('beforeunload', () => {
    if (buffer.length > 0) send(buffer.splice(0, buffer.length))
  })
}

export function setupMonitor(app: App) {
  if (!ENABLED) {
    console.info('[monitor] 监控未启用（设 VITE_ENABLE_MONITOR=true 启用）')
    return
  }
  setupErrorHandlers()
  setupPerformanceObserver()
  setupFetchInterceptor()
  startReporter()
  // Vue 错误处理（用类型断言避免 vue 内部 errorHandler 类型变化影响）
  ;(app as unknown as { config: { errorHandler: (err: unknown, instance: unknown, info: string) => void } }).config.errorHandler = (
    err: unknown,
    _instance: unknown,
    info: string
  ) => {
    push({
      type: 'error',
      payload: { kind: 'vue', message: String(err), info, stack: (err as Error)?.stack?.slice(0, 500) },
    })
  }
  console.info(`[monitor] 已启用（上报 URL: ${REPORT_URL}）`)
}

export function trackAction(name: string, data?: Record<string, unknown>) {
  push({ type: 'user_action', payload: { name, ...data } })
}

export function getMonitorStats() {
  return { reported, failed, buffered: buffer.length }
}

export const MONITOR_CONFIG = {
  enabled: ENABLED,
  reportUrl: REPORT_URL,
}
