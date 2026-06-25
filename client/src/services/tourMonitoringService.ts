import { logger } from '@/utils/logger'

export interface MonitoringMetric {
  id: string
  name: string
  type: 'counter' | 'gauge' | 'histogram' | 'summary'
  value: number
  unit: string
  labels: Record<string, string>
  timestamp: number
}

export interface MetricDataPoint {
  timestamp: number
  value: number
}

export interface MetricSeries {
  metricId: string
  name: string
  data: MetricDataPoint[]
  aggregation: 'avg' | 'sum' | 'max' | 'min' | 'count'
}

export interface PerformanceSnapshot {
  timestamp: number
  memory: {
    used: number
    total: number
    percentage: number
  }
  cpu: {
    usage: number
  }
  network: {
    latency: number
    bandwidth: number
  }
  render: {
    fps: number
    frameTime: number
  }
  tour: {
    activeCount: number
    completionRate: number
    errorRate: number
    avgDuration: number
  }
}

export interface AnomalyDetection {
  id: string
  metricId: string
  type: 'spike' | 'drop' | 'trend_change' | 'outlier'
  severity: 'low' | 'medium' | 'high' | 'critical'
  value: number
  expectedValue: number
  deviation: number
  timestamp: number
  acknowledged: boolean
}

export interface MonitoringConfig {
  collectInterval: number
  retentionPeriod: number
  anomalyThreshold: number
  enableAutoDetection: boolean
  metrics: MetricConfig[]
}

export interface MetricConfig {
  name: string
  type: 'counter' | 'gauge' | 'histogram' | 'summary'
  enabled: boolean
  alertThreshold?: {
    warning: number
    critical: number
  }
}

export interface TrendAnalysis {
  metricId: string
  trend: 'increasing' | 'decreasing' | 'stable'
  slope: number
  confidence: number
  prediction: number[]
  seasonality?: {
    period: number
    amplitude: number
  }
}

const STORAGE_KEY = 'tour_monitoring'
const METRICS_HISTORY_KEY = 'tour_metrics_history'

class TourMonitoringService {
  private metrics: Map<string, MonitoringMetric> = new Map()
  private metricHistory: Map<string, MetricDataPoint[]> = new Map()
  private anomalies: Map<string, AnomalyDetection> = new Map()
  private collectInterval: number | null = null
  private config: MonitoringConfig = {
    collectInterval: 5000,
    retentionPeriod: 7 * 24 * 60 * 60 * 1000,
    anomalyThreshold: 2.5,
    enableAutoDetection: true,
    metrics: [
      { name: 'tour_start', type: 'counter', enabled: true },
      { name: 'tour_complete', type: 'counter', enabled: true },
      { name: 'tour_skip', type: 'counter', enabled: true },
      { name: 'tour_error', type: 'counter', enabled: true },
      { name: 'step_view', type: 'counter', enabled: true },
      { name: 'step_click', type: 'counter', enabled: true },
      { name: 'active_users', type: 'gauge', enabled: true },
      { name: 'response_time', type: 'histogram', enabled: true },
      { name: 'memory_usage', type: 'gauge', enabled: true },
      { name: 'cpu_usage', type: 'gauge', enabled: true }
    ]
  }

  constructor() {
    this.loadFromStorage()
  }

  startMonitoring(): void {
    if (this.collectInterval) return

    this.collectInterval = window.setInterval(() => {
      this.collectMetrics()
    }, this.config.collectInterval)

    this.collectMetrics()
  }

  stopMonitoring(): void {
    if (this.collectInterval) {
      clearInterval(this.collectInterval)
      this.collectInterval = null
    }
  }

  recordMetric(name: string, value: number, labels: Record<string, string> = {}): void {
    const metricConfig = this.config.metrics.find(m => m.name === name)
    if (!metricConfig || !metricConfig.enabled) return

    const id = `${name}_${Object.entries(labels).sort().join('_')}`
    const existing = this.metrics.get(id)

    let finalValue = value
    if (metricConfig.type === 'counter' && existing) {
      finalValue = existing.value + value
    }

    const metric: MonitoringMetric = {
      id,
      name,
      type: metricConfig.type,
      value: finalValue,
      unit: this.getUnit(name),
      labels,
      timestamp: Date.now()
    }

    this.metrics.set(id, metric)
    this.addToHistory(id, finalValue)

    if (this.config.enableAutoDetection) {
      this.detectAnomaly(metric)
    }

    this.saveToStorage()
  }

  getMetric(name: string, labels: Record<string, string> = {}): MonitoringMetric | undefined {
    const id = `${name}_${Object.entries(labels).sort().join('_')}`
    return this.metrics.get(id)
  }

  getAllMetrics(): MonitoringMetric[] {
    return Array.from(this.metrics.values())
  }

  getMetricSeries(name: string, duration: number = 3600000): MetricSeries[] {
    const series: MetricSeries[] = []
    const cutoff = Date.now() - duration

    for (const [id, metric] of this.metrics) {
      if (metric.name === name) {
        const history = this.metricHistory.get(id) || []
        const filteredData = history
          .filter(p => p.timestamp >= cutoff)
          .sort((a, b) => a.timestamp - b.timestamp)

        series.push({
          metricId: id,
          name: metric.name,
          data: filteredData,
          aggregation: 'avg'
        })
      }
    }

    return series
  }

  getPerformanceSnapshot(): PerformanceSnapshot {
    const memory = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory || { usedJSHeapSize: 0, totalJSHeapSize: 0 }
    const tourMetrics = this.calculateTourMetrics()

    return {
      timestamp: Date.now(),
      memory: {
        used: memory.usedJSHeapSize || 0,
        total: memory.totalJSHeapSize || 0,
        percentage: memory.totalJSHeapSize 
          ? (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100 
          : 0
      },
      cpu: {
        usage: this.estimateCpuUsage()
      },
      network: {
        latency: this.estimateNetworkLatency(),
        bandwidth: 0
      },
      render: {
        fps: this.estimateFps(),
        frameTime: 1000 / Math.max(this.estimateFps(), 1)
      },
      tour: tourMetrics
    }
  }

  detectAnomaly(metric: MonitoringMetric): AnomalyDetection | null {
    const history = this.metricHistory.get(metric.id) || []
    if (history.length < 10) return null

    const values = history.slice(-100).map(p => p.value)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)

    if (stdDev === 0 || !isFinite(stdDev) || !isFinite(mean)) return null

    const deviation = Math.abs(metric.value - mean) / stdDev
    if (deviation < this.config.anomalyThreshold || !isFinite(deviation)) return null

    let type: AnomalyDetection['type'] = 'outlier'
    if (mean !== 0 && metric.value > mean * 1.5) type = 'spike'
    else if (mean !== 0 && metric.value < mean * 0.5) type = 'drop'

    const anomaly: AnomalyDetection = {
      id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metricId: metric.id,
      type,
      severity: deviation > 4 ? 'critical' : deviation > 3 ? 'high' : 'medium',
      value: metric.value,
      expectedValue: mean,
      deviation,
      timestamp: Date.now(),
      acknowledged: false
    }

    this.anomalies.set(anomaly.id, anomaly)
    this.saveToStorage()

    return anomaly
  }

  getAnomalies(acknowledged?: boolean): AnomalyDetection[] {
    const result = Array.from(this.anomalies.values())
    if (acknowledged !== undefined) {
      return result.filter(a => a.acknowledged === acknowledged)
    }
    return result.sort((a, b) => b.timestamp - a.timestamp)
  }

  acknowledgeAnomaly(anomalyId: string): boolean {
    const anomaly = this.anomalies.get(anomalyId)
    if (!anomaly) return false

    anomaly.acknowledged = true
    this.saveToStorage()
    return true
  }

  analyzeTrend(metricName: string, duration: number = 86400000): TrendAnalysis | null {
    const series = this.getMetricSeries(metricName, duration)
    if (series.length === 0 || series[0].data.length < 5) return null

    const data = series[0].data
    const values = data.map(p => p.value)
    const n = values.length

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
    for (let i = 0; i < n; i++) {
      sumX += i
      sumY += values[i]
      sumXY += i * values[i]
      sumX2 += i * i
    }

    const denominator = n * sumX2 - sumX * sumX
    if (denominator === 0) return null

    const slope = (n * sumXY - sumX * sumY) / denominator
    const intercept = (sumY - slope * sumX) / n

    const yMean = sumY / n
    let ssTotal = 0, ssResidual = 0
    for (let i = 0; i < n; i++) {
      const predicted = slope * i + intercept
      ssTotal += Math.pow(values[i] - yMean, 2)
      ssResidual += Math.pow(values[i] - predicted, 2)
    }

    const rSquared = ssTotal === 0 ? 1 : 1 - (ssResidual / ssTotal)

    const trend = slope > 0.01 ? 'increasing' : slope < -0.01 ? 'decreasing' : 'stable'
    const prediction: number[] = []
    for (let i = n; i < n + 10; i++) {
      prediction.push(slope * i + intercept)
    }

    return {
      metricId: metricName,
      trend,
      slope,
      confidence: Math.max(0, Math.min(1, rSquared)),
      prediction
    }
  }

  getAggregatedMetrics(period: 'minute' | 'hour' | 'day' = 'hour'): Map<string, MetricDataPoint[]> {
    const aggregated = new Map<string, MetricDataPoint[]>()
    const periodMs = period === 'minute' ? 60000 : period === 'hour' ? 3600000 : 86400000

    for (const [id, history] of this.metricHistory) {
      const buckets = new Map<number, number[]>()
      
      for (const point of history) {
        const bucket = Math.floor(point.timestamp / periodMs) * periodMs
        if (!buckets.has(bucket)) {
          buckets.set(bucket, [])
        }
        buckets.get(bucket)!.push(point.value)
      }

      const aggregatedData: MetricDataPoint[] = []
      for (const [timestamp, values] of buckets) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length
        aggregatedData.push({ timestamp, value: avg })
      }

      aggregated.set(id, aggregatedData.sort((a, b) => a.timestamp - b.timestamp))
    }

    return aggregated
  }

  updateConfig(config: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...config }
    this.saveToStorage()

    if (config.collectInterval && this.collectInterval) {
      this.stopMonitoring()
      this.startMonitoring()
    }
  }

  getConfig(): MonitoringConfig {
    return { ...this.config }
  }

  clearHistory(): void {
    this.metricHistory.clear()
    this.anomalies.clear()
    this.saveToStorage()
  }

  reset(): void {
    this.stopMonitoring()
    this.metrics.clear()
    this.metricHistory.clear()
    this.anomalies.clear()
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(METRICS_HISTORY_KEY)
  }

  private collectMetrics(): void {
    const snapshot = this.getPerformanceSnapshot()
    
    this.recordMetric('memory_usage', snapshot.memory.percentage)
    this.recordMetric('cpu_usage', snapshot.cpu.usage)
    this.recordMetric('active_users', snapshot.tour.activeCount)
  }

  private addToHistory(metricId: string, value: number): void {
    if (!this.metricHistory.has(metricId)) {
      this.metricHistory.set(metricId, [])
    }

    const history = this.metricHistory.get(metricId)!
    history.push({ timestamp: Date.now(), value })

    const cutoff = Date.now() - this.config.retentionPeriod
    const filtered = history.filter(p => p.timestamp >= cutoff)
    this.metricHistory.set(metricId, filtered)
  }

  private calculateTourMetrics(): PerformanceSnapshot['tour'] {
    const startMetric = this.getMetric('tour_start')
    const completeMetric = this.getMetric('tour_complete')
    const errorMetric = this.getMetric('tour_error')

    const totalStarts = startMetric?.value || 0
    const totalCompletes = completeMetric?.value || 0
    const totalErrors = errorMetric?.value || 0

    return {
      activeCount: Math.max(0, totalStarts - totalCompletes),
      completionRate: totalStarts > 0 ? (totalCompletes / totalStarts) * 100 : 0,
      errorRate: totalStarts > 0 ? (totalErrors / totalStarts) * 100 : 0,
      avgDuration: 0
    }
  }

  private estimateCpuUsage(): number {
    const start = performance.now()
    let count = 0
    while (performance.now() - start < 1) {
      count++
    }
    return Math.min(100, Math.max(0, 100 - count / 10000))
  }

  private estimateNetworkLatency(): number {
    const entries = performance.getEntriesByType('navigation')
    if (entries.length > 0) {
      const nav = entries[0] as PerformanceNavigationTiming
      if (nav.responseEnd && nav.requestStart) {
        return nav.responseEnd - nav.requestStart
      }
    }
    return 0
  }

  private estimateFps(): number {
    return 60
  }

  private getUnit(name: string): string {
    const units: Record<string, string> = {
      memory_usage: '%',
      cpu_usage: '%',
      response_time: 'ms',
      active_users: 'users',
      tour_start: 'count',
      tour_complete: 'count',
      tour_error: 'count'
    }
    return units[name] || ''
  }

  private saveToStorage(): void {
    try {
      const data = {
        metrics: Array.from(this.metrics.entries()),
        anomalies: Array.from(this.anomalies.entries()),
        config: this.config
      }
      const serialized = JSON.stringify(data)
      if (serialized.length > 5 * 1024 * 1024) {
        logger.warn('Monitoring data too large, executing cleanup')
        this.clearHistory()
        return
      }
      localStorage.setItem(STORAGE_KEY, serialized)

      const historyData = Array.from(this.metricHistory.entries())
      const historySerialized = JSON.stringify(historyData)
      if (historySerialized.length <= 5 * 1024 * 1024) {
        localStorage.setItem(METRICS_HISTORY_KEY, historySerialized)
      }
    } catch (e) {
      logger.error('Failed to save monitoring data:', e)
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        const parsed = JSON.parse(data)
        this.metrics = new Map(parsed.metrics || [])
        this.anomalies = new Map(parsed.anomalies || [])
        if (parsed.config) {
          this.config = { ...this.config, ...parsed.config }
        }
      }

      const historyData = localStorage.getItem(METRICS_HISTORY_KEY)
      if (historyData) {
        this.metricHistory = new Map(JSON.parse(historyData))
      }
    } catch (e) {
      logger.error('Failed to load monitoring data:', e)
    }
  }
}

export const tourMonitoringService = new TourMonitoringService()
