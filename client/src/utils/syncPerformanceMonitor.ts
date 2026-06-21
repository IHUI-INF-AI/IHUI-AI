import { logger } from './logger'

export interface SyncPerformanceMetric {
  id: string
  timestamp: number
  operation: 'upload' | 'download' | 'full_sync'
  duration: number
  dataSize: number
  success: boolean
  errorMessage?: string
  metadata: Record<string, unknown>
}

export interface SyncPerformanceStats {
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  averageDuration: number
  minDuration: number
  maxDuration: number
  averageDataSize: number
  totalDataTransferred: number
  successRate: number
}

const METRICS_STORAGE_KEY = 'sync-performance-metrics'
const MAX_METRICS = 500

class SyncPerformanceMonitor {
  private metrics: SyncPerformanceMetric[] = []
  private currentOperation: {
    id: string
    startTime: number
    operation: 'upload' | 'download' | 'full_sync'
  } | null = null

  constructor() {
    this.loadMetrics()
  }

  private loadMetrics(): void {
    try {
      const saved = localStorage.getItem(METRICS_STORAGE_KEY)
      if (saved) {
        this.metrics = JSON.parse(saved)
      }
    } catch {
      this.metrics = []
    }
  }

  private saveMetrics(): void {
    try {
      localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(this.metrics))
    } catch {
      logger.warn('Failed to save performance metrics')
    }
  }

  startOperation(operation: 'upload' | 'download' | 'full_sync'): string {
    const id = `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    this.currentOperation = {
      id,
      startTime: performance.now(),
      operation
    }
    
    return id
  }

  endOperation(
    operationId: string,
    success: boolean,
    dataSize: number,
    errorMessage?: string,
    metadata: Record<string, unknown> = {}
  ): SyncPerformanceMetric | null {
    if (!this.currentOperation || this.currentOperation.id !== operationId) {
      return null
    }
    
    const duration = performance.now() - this.currentOperation.startTime
    
    const metric: SyncPerformanceMetric = {
      id: operationId,
      timestamp: Date.now(),
      operation: this.currentOperation.operation,
      duration,
      dataSize,
      success,
      errorMessage,
      metadata
    }
    
    this.metrics.unshift(metric)
    
    if (this.metrics.length > MAX_METRICS) {
      this.metrics = this.metrics.slice(0, MAX_METRICS)
    }
    
    this.saveMetrics()
    this.currentOperation = null
    
    return metric
  }

  cancelOperation(operationId: string): void {
    if (this.currentOperation && this.currentOperation.id === operationId) {
      this.currentOperation = null
    }
  }

  getMetrics(limit?: number): SyncPerformanceMetric[] {
    if (limit) {
      return this.metrics.slice(0, limit)
    }
    return [...this.metrics]
  }

  getMetricsByOperation(operation: 'upload' | 'download' | 'full_sync'): SyncPerformanceMetric[] {
    return this.metrics.filter(m => m.operation === operation)
  }

  getMetricsByDateRange(startDate: Date, endDate: Date): SyncPerformanceMetric[] {
    return this.metrics.filter(m => {
      const date = new Date(m.timestamp)
      return date >= startDate && date <= endDate
    })
  }

  getStats(operation?: 'upload' | 'download' | 'full_sync'): SyncPerformanceStats {
    const relevantMetrics = operation
      ? this.metrics.filter(m => m.operation === operation)
      : this.metrics
    
    if (relevantMetrics.length === 0) {
      return {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        averageDataSize: 0,
        totalDataTransferred: 0,
        successRate: 0
      }
    }
    
    const successful = relevantMetrics.filter(m => m.success)
    const failed = relevantMetrics.filter(m => !m.success)
    const durations = relevantMetrics.map(m => m.duration)
    const dataSizes = relevantMetrics.map(m => m.dataSize)
    
    return {
      totalOperations: relevantMetrics.length,
      successfulOperations: successful.length,
      failedOperations: failed.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      averageDataSize: dataSizes.reduce((a, b) => a + b, 0) / dataSizes.length,
      totalDataTransferred: dataSizes.reduce((a, b) => a + b, 0),
      successRate: (successful.length / relevantMetrics.length) * 100
    }
  }

  getRecentPerformance(minutes: number = 60): SyncPerformanceStats {
    const cutoff = Date.now() - minutes * 60 * 1000
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff)
    
    if (recentMetrics.length === 0) {
      return this.getStats()
    }
    
    const successful = recentMetrics.filter(m => m.success)
    const durations = recentMetrics.map(m => m.duration)
    const dataSizes = recentMetrics.map(m => m.dataSize)
    
    return {
      totalOperations: recentMetrics.length,
      successfulOperations: successful.length,
      failedOperations: recentMetrics.length - successful.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      averageDataSize: dataSizes.reduce((a, b) => a + b, 0) / dataSizes.length,
      totalDataTransferred: dataSizes.reduce((a, b) => a + b, 0),
      successRate: (successful.length / recentMetrics.length) * 100
    }
  }

  getPerformanceTrend(days: number = 7): { date: string; stats: SyncPerformanceStats }[] {
    const result: { date: string; stats: SyncPerformanceStats }[] = []
    
    for (let i = 0; i < days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)
      
      const dayMetrics = this.getMetricsByDateRange(date, nextDate)
      
      if (dayMetrics.length > 0) {
        const successful = dayMetrics.filter(m => m.success)
        const durations = dayMetrics.map(m => m.duration)
        
        result.push({
          date: date.toISOString().split('T')[0],
          stats: {
            totalOperations: dayMetrics.length,
            successfulOperations: successful.length,
            failedOperations: dayMetrics.length - successful.length,
            averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
            minDuration: Math.min(...durations),
            maxDuration: Math.max(...durations),
            averageDataSize: 0,
            totalDataTransferred: 0,
            successRate: (successful.length / dayMetrics.length) * 100
          }
        })
      }
    }
    
    return result.reverse()
  }

  clearMetrics(): void {
    this.metrics = []
    this.saveMetrics()
  }

  exportMetrics(): string {
    return JSON.stringify(this.metrics, null, 2)
  }

  generateReport(): string {
    const stats = this.getStats()
    const recentStats = this.getRecentPerformance(60)
    const trend = this.getPerformanceTrend(7)
    
    return `
同步性能报告
============

总体统计
--------
- 总操作数: ${stats.totalOperations}
- 成功操作: ${stats.successfulOperations}
- 失败操作: ${stats.failedOperations}
- 成功率: ${stats.successRate.toFixed(2)}%
- 平均耗时: ${stats.averageDuration.toFixed(2)}ms
- 最小耗时: ${stats.minDuration.toFixed(2)}ms
- 最大耗时: ${stats.maxDuration.toFixed(2)}ms
- 平均数据大小: ${(stats.averageDataSize / 1024).toFixed(2)}KB
- 总数据传输: ${(stats.totalDataTransferred / 1024 / 1024).toFixed(2)}MB

最近1小时
---------
- 操作数: ${recentStats.totalOperations}
- 成功率: ${recentStats.successRate.toFixed(2)}%
- 平均耗时: ${recentStats.averageDuration.toFixed(2)}ms

最近7天趋势
----------
${trend.map(t => `${t.date}: ${t.stats.totalOperations}次操作, ${t.stats.successRate.toFixed(1)}%成功率`).join('\n')}
`.trim()
  }
}

export const syncPerformanceMonitor = new SyncPerformanceMonitor()
