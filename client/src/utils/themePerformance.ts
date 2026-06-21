export interface ThemePerformanceMetric {
  timestamp: number
  fromMode: string
  toMode: string
  duration: number
  renderTime: number
  paintTime: number
  domElements: number
  memoryUsage?: number
}

export interface ThemePerformanceReport {
  metrics: ThemePerformanceMetric[]
  averageDuration: number
  averageRenderTime: number
  averagePaintTime: number
  totalSwitches: number
  lastSwitch: ThemePerformanceMetric | null
}

export interface ThemePerformanceThresholds {
  good: number
  warning: number
  poor: number
}

export interface ThemePerformanceAlert {
  type: 'warning' | 'poor'
  metric: ThemePerformanceMetric
  message: string
}

export type ThemePerformanceAlertHandler = (alert: ThemePerformanceAlert) => void

const STORAGE_KEY = 'theme-performance-metrics'
const MAX_METRICS = 100

const DEFAULT_THRESHOLDS: ThemePerformanceThresholds = {
  good: 100,
  warning: 200,
  poor: 300
}

class ThemePerformanceMonitor {
  private metrics: ThemePerformanceMetric[] = []
  private startTime: number = 0
  private fromMode: string = ''
  private thresholds: ThemePerformanceThresholds = DEFAULT_THRESHOLDS
  private alertHandler: ThemePerformanceAlertHandler | null = null

  constructor() {
    this.loadMetrics()
  }

  private loadMetrics() {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.metrics = JSON.parse(stored)
      }
    } catch {
      this.metrics = []
    }
  }

  private saveMetrics() {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.metrics))
    } catch {
      this.metrics = this.metrics.slice(-MAX_METRICS / 2)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.metrics))
      } catch {
        // Ignore storage quota exceeded
      }
    }
  }

  setThresholds(thresholds: Partial<ThemePerformanceThresholds>): void {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds }
  }

  setAlertHandler(handler: ThemePerformanceAlertHandler | null): void {
    this.alertHandler = handler
  }

  private checkPerformance(metric: ThemePerformanceMetric): 'good' | 'warning' | 'poor' {
    if (metric.duration <= this.thresholds.good) return 'good'
    if (metric.duration <= this.thresholds.warning) return 'warning'
    return 'poor'
  }

  private triggerAlert(metric: ThemePerformanceMetric): void {
    const level = this.checkPerformance(metric)
    if (level === 'good') return

    const alert: ThemePerformanceAlert = {
      type: level,
      metric,
      message: `主题切换耗时 ${metric.duration.toFixed(2)}ms，${level === 'poor' ? '严重超标' : '需要优化'}`
    }

    this.alertHandler?.(alert)
  }

  startSwitch(fromMode: string) {
    this.startTime = performance.now()
    this.fromMode = fromMode
  }

  endSwitch(toMode: string): ThemePerformanceMetric {
    const endTime = performance.now()
    const duration = endTime - this.startTime

    let renderTime = 0
    let paintTime = 0

    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      const paintEntries = performance.getEntriesByType('paint')
      const lastPaint = paintEntries[paintEntries.length - 1]
      if (lastPaint) {
        paintTime = lastPaint.startTime
      }

      const measureName = `theme-switch-${Date.now()}`
      performance.measure(measureName)
      const measures = performance.getEntriesByName(measureName)
      if (measures.length > 0) {
        renderTime = measures[0].duration
      }
      performance.clearMeasures(measureName)
    }

    const domElements = document.querySelectorAll('*').length

    let memoryUsage: number | undefined
    const perfWithMemory = performance as Performance & { memory?: { usedJSHeapSize: number } }
    if ('memory' in performance && perfWithMemory.memory) {
      memoryUsage = perfWithMemory.memory.usedJSHeapSize
    }

    const metric: ThemePerformanceMetric = {
      timestamp: Date.now(),
      fromMode: this.fromMode,
      toMode,
      duration,
      renderTime,
      paintTime,
      domElements,
      memoryUsage
    }

    this.metrics.push(metric)

    if (this.metrics.length > MAX_METRICS) {
      this.metrics = this.metrics.slice(-MAX_METRICS)
    }

    this.saveMetrics()
    this.triggerAlert(metric)

    return metric
  }

  getReport(): ThemePerformanceReport {
    const totalSwitches = this.metrics.length
    const lastSwitch = this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null

    if (totalSwitches === 0) {
      return {
        metrics: [],
        averageDuration: 0,
        averageRenderTime: 0,
        averagePaintTime: 0,
        totalSwitches: 0,
        lastSwitch: null
      }
    }

    const sumDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0)
    const sumRenderTime = this.metrics.reduce((sum, m) => sum + m.renderTime, 0)
    const sumPaintTime = this.metrics.reduce((sum, m) => sum + m.paintTime, 0)

    return {
      metrics: this.metrics,
      averageDuration: sumDuration / totalSwitches,
      averageRenderTime: sumRenderTime / totalSwitches,
      averagePaintTime: sumPaintTime / totalSwitches,
      totalSwitches,
      lastSwitch
    }
  }

  getMetrics(): ThemePerformanceMetric[] {
    return [...this.metrics]
  }

  clearMetrics() {
    this.metrics = []
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  isPerformanceGood(): boolean {
    const report = this.getReport()
    if (report.totalSwitches < 3) return true
    return report.averageDuration < this.thresholds.warning
  }

  getPerformanceScore(): number {
    const report = this.getReport()
    if (report.totalSwitches === 0) return 100

    const durationScore = Math.max(0, 100 - (report.averageDuration / 10))
    const renderScore = Math.max(0, 100 - (report.averageRenderTime / 5))

    return Math.round((durationScore + renderScore) / 2)
  }

  getPerformanceRating(): 'good' | 'warning' | 'poor' {
    const score = this.getPerformanceScore()
    if (score >= 80) return 'good'
    if (score >= 50) return 'warning'
    return 'poor'
  }

  exportReport(): string {
    const report = this.getReport()
    return JSON.stringify({
      ...report,
      score: this.getPerformanceScore(),
      rating: this.getPerformanceRating(),
      thresholds: this.thresholds,
      exportedAt: new Date().toISOString()
    }, null, 2)
  }

  getStatistics(): {
    minDuration: number
    maxDuration: number
    medianDuration: number
    p95Duration: number
  } {
    if (this.metrics.length === 0) {
      return { minDuration: 0, maxDuration: 0, medianDuration: 0, p95Duration: 0 }
    }

    const durations = this.metrics.map(m => m.duration).sort((a, b) => a - b)
    const minDuration = durations[0]
    const maxDuration = durations[durations.length - 1]
    const medianIndex = Math.floor(durations.length / 2)
    const medianDuration = durations.length % 2 === 0
      ? (durations[medianIndex - 1] + durations[medianIndex]) / 2
      : durations[medianIndex]
    const p95Index = Math.ceil(durations.length * 0.95) - 1
    const p95Duration = durations[Math.min(p95Index, durations.length - 1)]

    return { minDuration, maxDuration, medianDuration, p95Duration }
  }
}

export const themePerformanceMonitor = new ThemePerformanceMonitor()
