/**
 * 统一监控告警入口
 * - ErrorBoundary 异常捕获
 * - Web Vitals 性能监控
 * - 用户行为埋点
 * - 上报到 /api/csp-report 端点（与 CSP 违规复用）
 * 提供 Sentry 风格的 API（captureException / captureMessage / setUser）
 */

import { logger } from './logger'

/** 监控上报端点 */
const REPORT_ENDPOINT = '/api/rum'
const SAMPLE_RATE = 1.0
const MAX_BATCH = 20
const FLUSH_INTERVAL = 5000

/** 监控事件类型 */
export type MonitoringEventType = 'error' | 'performance' | 'behavior' | 'csp-violation'

/** 监控事件基类 */
export interface MonitoringEvent {
  type: MonitoringEventType
  timestamp: number
  sessionId: string
  userId?: string
  route?: string
  data: Record<string, unknown>
}

/** Sentry 风格 API 配置 */
export interface MonitoringConfig {
  enabled: boolean
  endpoint: string
  sampleRate: number
  enablePerformance: boolean
  enableBehavior: boolean
  debug: boolean
}

const config: MonitoringConfig = {
  enabled: false,
  endpoint: REPORT_ENDPOINT,
  sampleRate: SAMPLE_RATE,
  enablePerformance: true,
  enableBehavior: true,
  debug: false,
}

let userContext: { id?: string; email?: string; role?: string; tags?: Record<string, string> } = {}
let currentSessionId = ''
let batch: MonitoringEvent[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null

/**
 * 初始化监控
 * 在 main.ts 中调用一次
 */
export function initMonitoring(opts: Partial<MonitoringConfig> = {}): void {
  Object.assign(config, opts)
  if (!config.enabled) {
    if (config.debug) console.log('[monitoring] disabled')
    return
  }
  currentSessionId = generateSessionId()

  // 全局错误捕获
  window.addEventListener('error', (event) => {
    captureException(event.error || event.message, { source: 'window.onerror' })
  })

  // Promise 异常
  window.addEventListener('unhandledrejection', (event) => {
    captureException(event.reason, { source: 'unhandledrejection' })
  })

  // Vue ErrorBoundary
  setupVueErrorCapture()

  // 性能监控
  if (config.enablePerformance) {
    captureWebVitals()
  }

  // 路由变化
  if (config.enableBehavior) {
    setupBehaviorTracking()
  }

  // 启动定时上报
  flushTimer = setInterval(flush, FLUSH_INTERVAL)
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flush)
  }
  logger.info('[monitoring] initialized', { sessionId: currentSessionId })
}

/**
 * 销毁监控（用于 SSR / 测试环境）
 */
export function destroyMonitoring(): void {
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  batch = []
  userContext = {}
  currentSessionId = ''
}

/**
 * Sentry 风格 API
 */
export function captureException(error: any, context?: Record<string, unknown>): void {
  if (!config.enabled || !shouldSample()) return
  const e = error instanceof Error ? error : new Error(String(error))
  pushEvent({
    type: 'error',
    timestamp: Date.now(),
    sessionId: currentSessionId,
    userId: userContext.id,
    route: getCurrentRoute(),
    data: {
      name: e.name,
      message: e.message,
      stack: e.stack,
      context: context || {},
    },
  })
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, unknown>): void {
  if (!config.enabled) return
  pushEvent({
    type: 'behavior',
    timestamp: Date.now(),
    sessionId: currentSessionId,
    userId: userContext.id,
    route: getCurrentRoute(),
    data: {
      kind: 'message',
      level,
      message,
      context: context || {},
    },
  })
}

export function setUser(user: typeof userContext): void {
  userContext = user || {}
}

export function setTag(key: string, value: string): void {
  userContext.tags = userContext.tags || {}
  userContext.tags[key] = value
}

/**
 * CSP 违规上报（与 /api/csp-report 复用）
 */
export function captureCspViolation(violation: {
  blockedURI: string
  violatedDirective: string
  originalPolicy: string
  sourceFile?: string
  lineNumber?: number
}): void {
  if (!config.enabled) return
  pushEvent({
    type: 'csp-violation',
    timestamp: Date.now(),
    sessionId: currentSessionId,
    data: violation,
  })
}

/**
 * 手动埋点
 */
export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  if (!config.enabled || !config.enableBehavior || !shouldSample()) return
  pushEvent({
    type: 'behavior',
    timestamp: Date.now(),
    sessionId: currentSessionId,
    userId: userContext.id,
    route: getCurrentRoute(),
    data: {
      kind: 'event',
      name,
      properties: properties || {},
    },
  })
}

/**
 * 手动页面浏览
 */
export function trackPageView(path: string, title?: string): void {
  if (!config.enabled || !config.enableBehavior) return
  pushEvent({
    type: 'behavior',
    timestamp: Date.now(),
    sessionId: currentSessionId,
    userId: userContext.id,
    route: path,
    data: { kind: 'pageview', title: title || document.title },
  })
}

/**
 * 内部：压入事件 + 触发上报
 */
function pushEvent(ev: MonitoringEvent): void {
  batch.push(ev)
  if (batch.length >= MAX_BATCH) {
    void flush()
  }
}

/**
 * 内部：上报批次
 */
async function flush(): Promise<void> {
  if (batch.length === 0) return
  const events = batch
  batch = []
  try {
    const payload = { sessionId: currentSessionId, user: userContext, events }
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
      const sent = navigator.sendBeacon(config.endpoint, blob)
      if (!sent) {
        batch.unshift(...events)
      }
    } else {
      await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      })
    }
    if (config.debug) console.log(`[monitoring] flushed ${events.length} events`)
  } catch (e) {
    if (config.debug) console.error('[monitoring] flush failed', e)
    batch.unshift(...events)
  }
}

/**
 * 内部：采样
 */
function shouldSample(): boolean {
  return Math.random() < config.sampleRate
}

/**
 * 内部：生成 sessionId
 */
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 内部：获取当前路由
 */
function getCurrentRoute(): string {
  if (typeof window === 'undefined') return ''
  return window.location.pathname + window.location.search
}

/**
 * 内部：Vue 全局异常捕获
 */
function setupVueErrorCapture(): void {
  const app = (typeof window !== 'undefined' ? (window as { __VUE_APP__?: { config?: { errorHandler?: (e: any, instance: any, info: string) => void } } }).__VUE_APP__ : null)
  if (app && app.config) {
    app.config.errorHandler = (err, _instance, info) => {
      captureException(err, { vueInfo: info })
    }
  }
}

/**
 * 内部：Web Vitals 性能监控（基于 PerformanceObserver）
 */
function captureWebVitals(): void {
  if (typeof PerformanceObserver === 'undefined') return

  // FCP / LCP / FID / CLS
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1]
      if (last) {
        pushEvent({
          type: 'performance',
          timestamp: Date.now(),
          sessionId: currentSessionId,
          route: getCurrentRoute(),
          data: { metric: 'LCP', value: last.startTime },
        })
      }
    })
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })

    const clsObserver = new PerformanceObserver((list) => {
      let cls = 0
      for (const entry of list.getEntries()) {
        if (!(entry as { hadRecentInput?: boolean }).hadRecentInput) {
          cls += (entry as { value?: number }).value || 0
        }
      }
      if (cls > 0) {
        pushEvent({
          type: 'performance',
          timestamp: Date.now(),
          sessionId: currentSessionId,
          route: getCurrentRoute(),
          data: { metric: 'CLS', value: cls },
        })
      }
    })
    clsObserver.observe({ type: 'layout-shift', buffered: true })

    const fidObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        pushEvent({
          type: 'performance',
          timestamp: Date.now(),
          sessionId: currentSessionId,
          route: getCurrentRoute(),
          data: { metric: 'FID', value: (entry as { processingStart?: number; startTime?: number }).processingStart! - (entry as { startTime?: number }).startTime! },
        })
      }
    })
    fidObserver.observe({ type: 'first-input', buffered: true })
  } catch {
    // PerformanceObserver API 不支持，忽略
  }
}

/**
 * 内部：路由变化行为埋点
 */
function setupBehaviorTracking(): void {
  // 监听 history 变化
  const originalPushState = history.pushState
  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args as never)
    trackPageView(getCurrentRoute())
    return result
  }
  const originalReplaceState = history.replaceState
  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args as never)
    trackPageView(getCurrentRoute())
    return result
  }
  window.addEventListener('popstate', () => trackPageView(getCurrentRoute()))

  // 首次页面加载
  trackPageView(getCurrentRoute())
}

/**
 * 获取当前配置（测试用）
 */
export function getMonitoringConfig(): MonitoringConfig {
  return { ...config }
}

/**
 * 兼容旧的对象式 API（errorHandler / request 等老调用点）
 * 内部委托给新的函数式 API
 */
export const monitoringService = {
  recordError(
    error: Error,
    source: string,
    severityOrContext?: 'high' | 'medium' | 'low' | Record<string, unknown>,
    extraContext?: Record<string, unknown>
  ): void {
    const ctx: Record<string, unknown> = { source }
    if (typeof severityOrContext === 'string') {
      ctx.severity = severityOrContext
    } else if (severityOrContext) {
      Object.assign(ctx, severityOrContext)
    }
    if (extraContext) Object.assign(ctx, extraContext)
    captureException(error, ctx)
  },
  recordMetric(name: string, value: number, unit: string, tags?: Record<string, unknown>): void {
    trackEvent('performance', { metric: name, value, unit, ...(tags || {}) })
  },
  captureMessage,
  trackEvent,
  trackPageView,
  setUser,
  setTag,
  init: initMonitoring,
}
