import { StorageManager } from '@/utils/storage'

export interface PerformanceMetric {
  name: string
  value: number
  unit: 'ms' | 'bytes' | 'count' | 'percent'
  timestamp: number
  tourId?: string
  metadata?: Record<string, unknown>
}

export interface PerformanceThreshold {
  metric: string
  warning: number
  critical: number
  enabled: boolean
}

export interface PerformanceAlert {
  id: string
  metric: string
  level: 'warning' | 'critical'
  value: number
  threshold: number
  message: string
  timestamp: number
  acknowledged: boolean
}

export interface PerformanceReport {
  period: { start: number; end: number }
  metrics: {
    avgLoadTime: number
    avgRenderTime: number
    avgMemoryUsage: number
    errorRate: number
    totalSessions: number
  }
  trends: {
    loadTime: number[]
    renderTime: number[]
    memoryUsage: number[]
    timestamps: number[]
  }
  recommendations: string[]
}

const METRICS_KEY = 'tour_performance_metrics'
const THRESHOLDS_KEY = 'tour_performance_thresholds'
const ALERTS_KEY = 'tour_performance_alerts'

const DEFAULT_THRESHOLDS: PerformanceThreshold[] = [
  { metric: 'loadTime', warning: 1000, critical: 3000, enabled: true },
  { metric: 'renderTime', warning: 100, critical: 300, enabled: true },
  { metric: 'memoryUsage', warning: 50 * 1024 * 1024, critical: 100 * 1024 * 1024, enabled: true },
  { metric: 'errorRate', warning: 5, critical: 10, enabled: true },
]

class TourPerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private thresholds: PerformanceThreshold[] = []
  private alerts: PerformanceAlert[] = []
  private observers: PerformanceObserver | null = null
  private alertListeners: ((alert: PerformanceAlert) => void)[] = []

  constructor() {
    this.load()
    this.startObserving()
  }

  private load(): void {
    this.metrics = StorageManager.getItem<PerformanceMetric[]>(METRICS_KEY) || []
    this.thresholds = StorageManager.getItem<PerformanceThreshold[]>(THRESHOLDS_KEY) || DEFAULT_THRESHOLDS
    this.alerts = StorageManager.getItem<PerformanceAlert[]>(ALERTS_KEY) || []
  }

  private save(): void {
    StorageManager.setItem(METRICS_KEY, this.metrics.slice(-10000))
    StorageManager.setItem(THRESHOLDS_KEY, this.thresholds)
    StorageManager.setItem(ALERTS_KEY, this.alerts.slice(-100))
  }

  private startObserving(): void {
    if (typeof PerformanceObserver === 'undefined') return

    try {
      this.observers = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.name.includes('tour')) {
            this.recordMetric('renderTime', entry.duration, 'ms')
          }
        })
      })
      this.observers.observe({ entryTypes: ['measure', 'paint'] })
    } catch {
      // PerformanceObserver not supported
    }
  }

  recordMetric(
    name: string,
    value: number,
    unit: PerformanceMetric['unit'],
    tourId?: string,
    metadata?: Record<string, unknown>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tourId,
      metadata,
    }

    this.metrics.push(metric)
    this.checkThreshold(metric)
    this.save()
  }

  measureLoadTime(tourId: string, startTime: number): void {
    const loadTime = performance.now() - startTime
    this.recordMetric('loadTime', loadTime, 'ms', tourId)
  }

  measureRenderTime(tourId: string, stepId: string, startTime: number): void {
    const renderTime = performance.now() - startTime
    this.recordMetric('renderTime', renderTime, 'ms', tourId, { stepId })
  }

  measureMemoryUsage(): void {
    const perfWithMemory = performance as { memory?: { usedJSHeapSize: number } }
    if ('memory' in performance && perfWithMemory.memory) {
      const memory = perfWithMemory.memory
      this.recordMetric('memoryUsage', memory.usedJSHeapSize, 'bytes')
    }
  }

  recordError(tourId: string, error: Error): void {
    this.recordMetric('error', 1, 'count', tourId, {
      message: error.message,
      stack: error.stack,
    })
  }

  private checkThreshold(metric: PerformanceMetric): void {
    const threshold = this.thresholds.find(t => t.metric === metric.name && t.enabled)
    if (!threshold) return

    if (metric.value >= threshold.critical) {
      this.createAlert(metric, 'critical', threshold.critical)
    } else if (metric.value >= threshold.warning) {
      this.createAlert(metric, 'warning', threshold.warning)
    }
  }

  private createAlert(metric: PerformanceMetric, level: 'warning' | 'critical', threshold: number): void {
    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}`,
      metric: metric.name,
      level,
      value: metric.value,
      threshold,
      message: `${metric.name} ${level === 'critical' ? '严重' : '警告'}: ${metric.value} 超过阈值 ${threshold}`,
      timestamp: Date.now(),
      acknowledged: false,
    }

    this.alerts.push(alert)
    this.alertListeners.forEach(listener => listener(alert))
  }

  setThreshold(metric: string, warning: number, critical: number): void {
    const index = this.thresholds.findIndex(t => t.metric === metric)
    if (index > -1) {
      this.thresholds[index] = { ...this.thresholds[index], warning, critical }
    } else {
      this.thresholds.push({ metric, warning, critical, enabled: true })
    }
    this.save()
  }

  getThresholds(): PerformanceThreshold[] {
    return [...this.thresholds]
  }

  getAlerts(acknowledged?: boolean): PerformanceAlert[] {
    let filtered = [...this.alerts]
    if (acknowledged !== undefined) {
      filtered = filtered.filter(a => a.acknowledged === acknowledged)
    }
    return filtered.sort((a, b) => b.timestamp - a.timestamp)
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
      this.save()
      return true
    }
    return false
  }

  onAlert(callback: (alert: PerformanceAlert) => void): () => void {
    this.alertListeners.push(callback)
    return () => {
      const index = this.alertListeners.indexOf(callback)
      if (index > -1) {
        this.alertListeners.splice(index, 1)
      }
    }
  }

  getMetrics(name?: string, tourId?: string, timeRange?: { start: number; end: number }): PerformanceMetric[] {
    let filtered = [...this.metrics]
    
    if (name) {
      filtered = filtered.filter(m => m.name === name)
    }
    if (tourId) {
      filtered = filtered.filter(m => m.tourId === tourId)
    }
    if (timeRange) {
      filtered = filtered.filter(m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end)
    }
    
    return filtered
  }

  getAggregatedMetrics(name: string, period: 'hour' | 'day' | 'week'): {
    avg: number
    min: number
    max: number
    count: number
  } {
    const now = Date.now()
    const periodMs = period === 'hour' ? 60 * 60 * 1000 : period === 'day' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
    const filtered = this.metrics.filter(m => m.name === name && m.timestamp >= now - periodMs)

    if (filtered.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 }
    }

    const values = filtered.map(m => m.value)
    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    }
  }

  generateReport(period: 'hour' | 'day' | 'week' = 'day'): PerformanceReport {
    const now = Date.now()
    const periodMs = period === 'hour' ? 60 * 60 * 1000 : period === 'day' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
    const start = now - periodMs

    const loadTimes = this.getMetrics('loadTime', undefined, { start, end: now })
    const renderTimes = this.getMetrics('renderTime', undefined, { start, end: now })
    const memoryUsages = this.getMetrics('memoryUsage', undefined, { start, end: now })
    const errors = this.getMetrics('error', undefined, { start, end: now })

    const recommendations: string[] = []
    
    const avgLoadTime = loadTimes.length > 0 
      ? loadTimes.reduce((a, b) => a + b.value, 0) / loadTimes.length 
      : 0
    if (avgLoadTime > 1000) {
      recommendations.push('引导加载时间较长，建议优化引导数据大小或使用懒加载')
    }

    const avgRenderTime = renderTimes.length > 0 
      ? renderTimes.reduce((a, b) => a + b.value, 0) / renderTimes.length 
      : 0
    if (avgRenderTime > 100) {
      recommendations.push('引导渲染时间较长，建议简化步骤内容或优化动画效果')
    }

    const avgMemory = memoryUsages.length > 0 
      ? memoryUsages.reduce((a, b) => a + b.value, 0) / memoryUsages.length 
      : 0
    if (avgMemory > 50 * 1024 * 1024) {
      recommendations.push('内存使用较高，建议检查内存泄漏或减少缓存数据')
    }

    const errorRate = errors.length / Math.max(loadTimes.length, 1) * 100
    if (errorRate > 5) {
      recommendations.push('错误率较高，建议检查引导配置和错误日志')
    }

    return {
      period: { start, end: now },
      metrics: {
        avgLoadTime,
        avgRenderTime,
        avgMemoryUsage: avgMemory,
        errorRate,
        totalSessions: loadTimes.length,
      },
      trends: {
        loadTime: loadTimes.slice(-100).map(m => m.value),
        renderTime: renderTimes.slice(-100).map(m => m.value),
        memoryUsage: memoryUsages.slice(-100).map(m => m.value),
        timestamps: loadTimes.slice(-100).map(m => m.timestamp),
      },
      recommendations,
    }
  }

  clearMetrics(): void {
    this.metrics = []
    this.save()
  }

  clearAlerts(): void {
    this.alerts = []
    this.save()
  }

  destroy(): void {
    if (this.observers) {
      this.observers.disconnect()
      this.observers = null
    }
    this.alertListeners = []
  }
}

export const tourPerformanceMonitor = new TourPerformanceMonitor()

export function usePerformanceMonitor() {
  return {
    recordMetric: (name: string, value: number, unit: PerformanceMetric['unit'], tourId?: string) => 
      tourPerformanceMonitor.recordMetric(name, value, unit, tourId),
    measureLoadTime: (tourId: string, startTime: number) => 
      tourPerformanceMonitor.measureLoadTime(tourId, startTime),
    measureRenderTime: (tourId: string, stepId: string, startTime: number) => 
      tourPerformanceMonitor.measureRenderTime(tourId, stepId, startTime),
    measureMemoryUsage: () => tourPerformanceMonitor.measureMemoryUsage(),
    recordError: (tourId: string, error: Error) => tourPerformanceMonitor.recordError(tourId, error),
    getMetrics: (name?: string, tourId?: string, timeRange?: { start: number; end: number }) => 
      tourPerformanceMonitor.getMetrics(name, tourId, timeRange),
    getAggregatedMetrics: (name: string, period: 'hour' | 'day' | 'week') => 
      tourPerformanceMonitor.getAggregatedMetrics(name, period),
    generateReport: (period: 'hour' | 'day' | 'week') => tourPerformanceMonitor.generateReport(period),
    getAlerts: (acknowledged?: boolean) => tourPerformanceMonitor.getAlerts(acknowledged),
    acknowledgeAlert: (alertId: string) => tourPerformanceMonitor.acknowledgeAlert(alertId),
    onAlert: (callback: (alert: PerformanceAlert) => void) => tourPerformanceMonitor.onAlert(callback),
    setThreshold: (metric: string, warning: number, critical: number) => 
      tourPerformanceMonitor.setThreshold(metric, warning, critical),
    getThresholds: () => tourPerformanceMonitor.getThresholds(),
  }
}
