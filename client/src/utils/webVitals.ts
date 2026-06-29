/**
 * Web Vitals 性能监控
 * 用于监控 Core Web Vitals 指标
 */

import { logger } from './logger'

export interface WebVitalsMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta?: number
  id: string
  navigationType?: string
}

export type WebVitalsCallback = (metric: WebVitalsMetric) => void

export interface AlertThresholds {
  LCP: { good: number; poor: number }
  FID: { good: number; poor: number }
  CLS: { good: number; poor: number }
  FCP: { good: number; poor: number }
  TTFB: { good: number; poor: number }
  INP: { good: number; poor: number }
}

export interface AlertHandler {
  (metric: WebVitalsMetric, threshold: 'warning' | 'critical'): void
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 100, poor: 300 },
}

interface MetricsBuffer {
  metrics: WebVitalsMetric[]
  flushTimer: ReturnType<typeof setTimeout> | null
}

const buffer: MetricsBuffer = {
  metrics: [],
  flushTimer: null,
}

const FLUSH_INTERVAL = 30000
const MAX_BUFFER_SIZE = 20
let alertHandler: AlertHandler | null = null
let thresholds = DEFAULT_THRESHOLDS
let alertUrl: string | null = null
let alertEmail: string | null = null

function initAlertConfig(): void {
  alertUrl = import.meta.env.VITE_WEB_VITALS_ALERT_URL || null
  alertEmail = import.meta.env.VITE_WEB_VITALS_ALERT_EMAIL || null
}

initAlertConfig()

export function setAlertThresholds(customThresholds: Partial<AlertThresholds>): void {
  thresholds = { ...DEFAULT_THRESHOLDS, ...customThresholds }
}

export function setAlertHandler(handler: AlertHandler): void {
  alertHandler = handler
}

function checkThreshold(metric: WebVitalsMetric): 'warning' | 'critical' | null {
  const threshold = thresholds[metric.name as keyof AlertThresholds]
  if (!threshold) return null

  if (metric.value > threshold.poor) return 'critical'
  if (metric.value > threshold.good) return 'warning'
  return null
}

function triggerAlert(metric: WebVitalsMetric): void {
  const level = checkThreshold(metric)
  if (!level) return

  if (alertHandler) {
    alertHandler(metric, level)
  }

  const message = `[WebVitals告警] ${metric.name}=${metric.value.toFixed(2)} (${level === 'critical' ? '严重' : '警告'})`
  if (level === 'critical') {
    logger.error(message)
  } else {
    logger.warn(message)
  }

  void sendAlertNotification(metric, level)
}

async function sendAlertNotification(metric: WebVitalsMetric, level: 'warning' | 'critical'): Promise<void> {
  if (!alertUrl && !alertEmail) return

  const payload = {
    metric: metric.name,
    value: metric.value,
    rating: metric.rating,
    level,
    url: window.location.href,
    timestamp: Date.now(),
    email: alertEmail,
  }

  if (alertUrl) {
    try {
      await fetch(alertUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      logger.warn('[WebVitals] Failed to send alert notification:', error)
    }
  }
}

function getRating(name: string, value: number): WebVitalsMetric['rating'] {
  switch (name) {
    case 'CLS':
      return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor'
    case 'INP':
      return value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor'
    case 'FID':
      return value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor'
    case 'LCP':
      return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor'
    case 'FCP':
      return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor'
    case 'TTFB':
      return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor'
    default:
      return 'good'
  }
}

/** RUM 上报端点：dev server 中间件接住并落盘；生产转发到自建收集服务 */
const RUM_REPORT_URL = '/api/rum'
/** RUM 应用标识 */
const RUM_APP = 'officialsite'

async function flushMetrics(): Promise<void> {
  if (buffer.metrics.length === 0) return
  const payload = {
    app: RUM_APP,
    time: new Date().toISOString(),
    url: typeof location !== 'undefined' ? location.href : '',
    metrics: buffer.metrics,
  }
  buffer.metrics = []
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
      const ok = navigator.sendBeacon(RUM_REPORT_URL, blob)
      if (!ok) {
        await fetch(RUM_REPORT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        })
      }
    } else if (typeof fetch !== 'undefined') {
      await fetch(RUM_REPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      })
    }
  } catch (error) {
    logger.warn('[WebVitals] Report failed:', error)
  }
}

function scheduleFlush(): void {
  if (buffer.flushTimer) return

  buffer.flushTimer = setTimeout(() => {
    buffer.flushTimer = null
    void flushMetrics()
  }, FLUSH_INTERVAL)
}

function addToBuffer(metric: WebVitalsMetric): void {
  buffer.metrics.push(metric)

  if (buffer.metrics.length >= MAX_BUFFER_SIZE) {
    void flushMetrics()
  } else {
    scheduleFlush()
  }
}

function reportToAnalytics(metric: WebVitalsMetric): void {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    const gtag = (window as unknown as { gtag: (...args: unknown[]) => void }).gtag
    gtag('event', metric.name, {
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      event_category: 'Web Vitals',
      event_label: metric.rating,
      non_interaction: true,
    })
  }
}

/**
 * 初始化 Web Vitals 监控
 */
export function initWebVitals(callback?: WebVitalsCallback): void {
  if (typeof window === 'undefined') return

  const reportMetric = (metric: Omit<WebVitalsMetric, 'rating'>) => {
    const fullMetric: WebVitalsMetric = {
      ...metric,
      rating: getRating(metric.name, metric.value),
    }

    logger.debug(`[WebVitals] ${metric.name}:`, {
      value: metric.value,
      rating: fullMetric.rating,
    })

    triggerAlert(fullMetric)

    callback?.(fullMetric)

    if (import.meta.env.PROD) {
      addToBuffer(fullMetric)
      reportToAnalytics(fullMetric)
    }
  }

  // 使用 Performance Observer 监控性能指标
  try {
    // LCP (Largest Contentful Paint)
    if ('PerformanceObserver' in window) {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number }
        reportMetric({
          name: 'LCP',
          value: lastEntry.startTime,
          id: 'lcp',
        })
      })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] as string[] })
    }

    // FID (First Input Delay) - 使用 FCP 作为替代
    if ('PerformanceObserver' in window) {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          const fidEntry = entry as PerformanceEntry & { processingStart: number; startTime: number }
          reportMetric({
            name: 'FID',
            value: fidEntry.processingStart - fidEntry.startTime,
            id: 'fid',
          })
        })
      })
      fidObserver.observe({ entryTypes: ['first-input'] as string[] })
    }

    // CLS (Cumulative Layout Shift)
    let clsValue = 0
    if ('PerformanceObserver' in window) {
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          const clsEntry = entry as PerformanceEntry & { value: number; hadRecentInput: boolean }
          if (!clsEntry.hadRecentInput) {
            clsValue += clsEntry.value
          }
        })
        reportMetric({
          name: 'CLS',
          value: clsValue,
          id: 'cls',
        })
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] as string[] })
    }

    // INP (Interaction to Next Paint)：取所有交互事件中 processingEnd-startTime 最大值
    let inpValue = 0
    if ('PerformanceObserver' in window) {
      try {
        const inpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry) => {
            const inpEntry = entry as PerformanceEntry & { duration: number }
            if (inpEntry.duration > inpValue) {
              inpValue = inpEntry.duration
            }
          })
          if (inpValue > 0) {
            reportMetric({
              name: 'INP',
              value: inpValue,
              id: 'inp',
            })
          }
        })
        inpObserver.observe({ entryTypes: ['event'] as string[] })
      } catch (_err) {
        // event-timing API 不支持（Firefox / Safari），静默跳过 INP
      }
    }

    // FCP (First Contentful Paint)
    const paintEntries = performance.getEntriesByType('paint')
    const fcpEntry = paintEntries.find((entry) => entry.name === 'first-contentful-paint')
    if (fcpEntry) {
      reportMetric({
        name: 'FCP',
        value: fcpEntry.startTime,
        id: 'fcp',
      })
    }

    // TTFB (Time to First Byte)
    const navigationEntries = performance.getEntriesByType('navigation')
    if (navigationEntries.length > 0) {
      const navEntry = navigationEntries[0] as PerformanceNavigationTiming
      reportMetric({
        name: 'TTFB',
        value: navEntry.responseStart - navEntry.startTime,
        id: 'ttfb',
      })
    }

    logger.debug('[WebVitals] Performance monitoring initialized')

    if (import.meta.env.PROD) {
      window.addEventListener('pagehide', () => {
        void flushMetrics()
      })
    }
  } catch (error) {
    logger.warn('[WebVitals] Initialization failed:', error)
  }
}

/**
 * 获取所有性能指标
 */
export function getAllMetrics(): WebVitalsMetric[] {
  if (typeof window === 'undefined') return []

  const metrics: WebVitalsMetric[] = []

  // 从 performance entries 获取指标
  const paintEntries = performance.getEntriesByType('paint')
  const navigationEntries = performance.getEntriesByType('navigation')

  paintEntries.forEach((entry) => {
    if (entry.name === 'first-contentful-paint') {
      metrics.push({
        name: 'FCP',
        value: entry.startTime,
        rating: getRating('FCP', entry.startTime),
        id: 'fcp',
      })
    }
  })

  if (navigationEntries.length > 0) {
    const navEntry = navigationEntries[0] as PerformanceNavigationTiming
    metrics.push({
      name: 'TTFB',
      value: navEntry.responseStart - navEntry.startTime,
      rating: getRating('TTFB', navEntry.responseStart - navEntry.startTime),
      id: 'ttfb',
    })
  }

  return metrics
}

export default {
  initWebVitals,
  getAllMetrics,
}
