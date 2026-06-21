import { logger } from '@/utils/logger'

export interface GrayReleaseConfig {
  tourId: string
  tourVersion: string
  strategy: ReleaseStrategy
  rolloutPercentage: number
  targetGroups: TargetGroup[]
  startDate: number
  endDate?: number
  autoPromote: boolean
  promoteThreshold: PromoteThreshold
  monitoring: MonitoringConfig
}

export interface ReleaseStrategy {
  type: 'percentage' | 'user_group' | 'region' | 'device' | 'custom'
  rules: ReleaseRule[]
}

export interface ReleaseRule {
  field: string
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'in' | 'regex'
  value: string | number | string[] | number[]
  weight: number
}

export interface TargetGroup {
  id: string
  name: string
  percentage: number
  criteria: ReleaseRule[]
  description?: string
}

export interface PromoteThreshold {
  completionRate: number
  errorRate: number
  userSatisfaction: number
  minSampleSize: number
}

export interface MonitoringConfig {
  metrics: string[]
  alertThresholds: AlertThreshold[]
  checkInterval: number
}

export interface AlertThreshold {
  metric: string
  operator: 'gt' | 'lt'
  value: number
  severity: 'warning' | 'critical'
}

export interface ReleaseStatus {
  tourId: string
  currentPhase: number
  totalPhases: number
  currentPercentage: number
  targetPercentage: number
  status: 'pending' | 'running' | 'paused' | 'completed' | 'rolled_back'
  startTime: number
  metrics: ReleaseMetrics
  phases: PhaseStatus[]
  alerts: ReleaseAlert[]
}

export interface ReleaseMetrics {
  exposedUsers: number
  completedUsers: number
  errorCount: number
  avgCompletionTime: number
  satisfactionScore: number
  conversionRate: number
  bounceRate: number
}

export interface PhaseStatus {
  phase: number
  percentage: number
  startTime?: number
  endTime?: number
  status: 'pending' | 'running' | 'completed'
  metrics?: ReleaseMetrics
}

export interface ReleaseAlert {
  id: string
  type: 'warning' | 'critical' | 'info'
  message: string
  timestamp: number
  acknowledged: boolean
}

export interface GrayReleaseRecord {
  id: string
  config: GrayReleaseConfig
  status: ReleaseStatus
  history: ReleaseHistoryEntry[]
  createdAt: number
  updatedAt: number
}

export interface ReleaseHistoryEntry {
  timestamp: number
  action: string
  details: string
  operator?: string
}

const STORAGE_KEY = 'tour_gray_releases'
const _METRICS_KEY = 'tour_gray_metrics'

class TourGrayReleaseService {
  private releases: Map<string, GrayReleaseRecord> = new Map()
  private userBuckets: Map<string, string> = new Map()
  private metricsHistory: Map<string, ReleaseMetrics[]> = new Map()
  private monitoringIntervals: Map<string, number> = new Map()

  constructor() {
    this.loadFromStorage()
  }

  createRelease(config: GrayReleaseConfig): GrayReleaseRecord {
    const existing = this.getReleaseByTour(config.tourId)
    if (existing && existing.status.status === 'running') {
      throw new Error('该引导已有正在进行的灰度发布')
    }

    const phases = this.calculatePhases(config)
    const record: GrayReleaseRecord = {
      id: `gr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      config,
      status: {
        tourId: config.tourId,
        currentPhase: 0,
        totalPhases: phases.length,
        currentPercentage: 0,
        targetPercentage: config.rolloutPercentage,
        status: 'pending',
        startTime: 0,
        metrics: this.getEmptyMetrics(),
        phases,
        alerts: []
      },
      history: [{
        timestamp: Date.now(),
        action: '创建发布',
        details: `创建灰度发布，目标比例: ${config.rolloutPercentage}%`
      }],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    this.releases.set(record.id, record)
    this.saveToStorage()
    return record
  }

  startRelease(releaseId: string): boolean {
    const record = this.releases.get(releaseId)
    if (!record || record.status.status !== 'pending') return false

    record.status.status = 'running'
    record.status.startTime = Date.now()
    record.status.currentPhase = 1
    
    if (record.status.phases.length > 0) {
      record.status.phases[0].status = 'running'
      record.status.phases[0].startTime = Date.now()
      record.status.currentPercentage = record.status.phases[0].percentage
    }

    record.history.push({
      timestamp: Date.now(),
      action: '启动发布',
      details: '灰度发布已启动'
    })
    record.updatedAt = Date.now()

    this.startMonitoring(releaseId)
    this.saveToStorage()
    return true
  }

  pauseRelease(releaseId: string): boolean {
    const record = this.releases.get(releaseId)
    if (!record || record.status.status !== 'running') return false

    record.status.status = 'paused'
    record.history.push({
      timestamp: Date.now(),
      action: '暂停发布',
      details: `当前比例: ${record.status.currentPercentage}%`
    })
    record.updatedAt = Date.now()

    this.stopMonitoring(releaseId)
    this.saveToStorage()
    return true
  }

  resumeRelease(releaseId: string): boolean {
    const record = this.releases.get(releaseId)
    if (!record || record.status.status !== 'paused') return false

    record.status.status = 'running'
    record.history.push({
      timestamp: Date.now(),
      action: '恢复发布',
      details: '灰度发布已恢复'
    })
    record.updatedAt = Date.now()

    this.startMonitoring(releaseId)
    this.saveToStorage()
    return true
  }

  promoteRelease(releaseId: string): boolean {
    const record = this.releases.get(releaseId)
    if (!record || record.status.status !== 'running') return false

    const currentPhase = record.status.currentPhase
    if (currentPhase >= record.status.totalPhases) return false

    if (!this.canPromote(record)) {
      this.addAlert(record, 'warning', '未达到推广阈值，无法进入下一阶段')
      return false
    }

    record.status.phases[currentPhase - 1].status = 'completed'
    record.status.phases[currentPhase - 1].endTime = Date.now()

    record.status.currentPhase = currentPhase + 1
    const nextPhase = record.status.phases[currentPhase]
    
    if (nextPhase) {
      nextPhase.status = 'running'
      nextPhase.startTime = Date.now()
      record.status.currentPercentage = nextPhase.percentage
    }

    record.history.push({
      timestamp: Date.now(),
      action: '推广发布',
      details: `进入第${record.status.currentPhase}阶段，比例: ${record.status.currentPercentage}%`
    })
    record.updatedAt = Date.now()

    if (record.status.currentPercentage >= record.config.rolloutPercentage) {
      this.completeRelease(releaseId)
    }

    this.saveToStorage()
    return true
  }

  rollbackRelease(releaseId: string, reason: string): boolean {
    const record = this.releases.get(releaseId)
    if (!record) return false

    record.status.status = 'rolled_back'
    record.status.currentPercentage = 0

    record.history.push({
      timestamp: Date.now(),
      action: '回滚发布',
      details: `原因: ${reason}`
    })

    this.addAlert(record, 'critical', `发布已回滚: ${reason}`)
    this.stopMonitoring(releaseId)
    this.saveToStorage()
    return true
  }

  completeRelease(releaseId: string): boolean {
    const record = this.releases.get(releaseId)
    if (!record) return false

    record.status.status = 'completed'
    record.status.currentPercentage = 100

    const lastPhase = record.status.phases[record.status.phases.length - 1]
    if (lastPhase) {
      lastPhase.status = 'completed'
      lastPhase.endTime = Date.now()
    }

    record.history.push({
      timestamp: Date.now(),
      action: '完成发布',
      details: '灰度发布已完成，全量上线'
    })
    record.updatedAt = Date.now()

    this.stopMonitoring(releaseId)
    this.saveToStorage()
    return true
  }

  shouldExposeTour(tourId: string, userId: string, _context?: Record<string, unknown>): boolean {
    const record = this.getReleaseByTour(tourId)
    if (!record || record.status.status !== 'running') return false

    if (record.status.currentPercentage >= 100) return true
    if (record.status.currentPercentage <= 0) return false

    const bucket = this.getUserBucket(userId, tourId)
    const bucketNumber = parseInt(bucket, 16) % 100
    return bucketNumber < record.status.currentPercentage
  }

  getTargetGroup(userId: string, tourId: string): TargetGroup | null {
    const record = this.getReleaseByTour(tourId)
    if (!record || !record.config.targetGroups.length) return null

    for (const group of record.config.targetGroups) {
      if (this.matchesGroup(userId, group)) {
        return group
      }
    }
    return null
  }

  recordMetrics(releaseId: string, metrics: Partial<ReleaseMetrics>): void {
    const record = this.releases.get(releaseId)
    if (!record) return

    const current = record.status.metrics
    record.status.metrics = {
      exposedUsers: metrics.exposedUsers ?? current.exposedUsers,
      completedUsers: metrics.completedUsers ?? current.completedUsers,
      errorCount: metrics.errorCount ?? current.errorCount,
      avgCompletionTime: metrics.avgCompletionTime ?? current.avgCompletionTime,
      satisfactionScore: metrics.satisfactionScore ?? current.satisfactionScore,
      conversionRate: metrics.conversionRate ?? current.conversionRate,
      bounceRate: metrics.bounceRate ?? current.bounceRate
    }

    let history = this.metricsHistory.get(releaseId) || []
    history.push({ ...record.status.metrics })
    if (history.length > 100) history = history.slice(-100)
    this.metricsHistory.set(releaseId, history)

    this.checkThresholds(record)
    this.saveToStorage()
  }

  getRelease(releaseId: string): GrayReleaseRecord | undefined {
    return this.releases.get(releaseId)
  }

  getReleaseByTour(tourId: string): GrayReleaseRecord | undefined {
    const releases = Array.from(this.releases.values())
    for (const record of releases) {
      if (record.config.tourId === tourId) return record
    }
    return undefined
  }

  getAllReleases(): GrayReleaseRecord[] {
    return Array.from(this.releases.values())
  }

  getActiveReleases(): GrayReleaseRecord[] {
    return this.getAllReleases().filter(r => r.status.status === 'running')
  }

  getMetricsHistory(releaseId: string): ReleaseMetrics[] {
    return this.metricsHistory.get(releaseId) || []
  }

  acknowledgeAlert(releaseId: string, alertId: string): boolean {
    const record = this.releases.get(releaseId)
    if (!record) return false

    const alert = record.status.alerts.find(a => a.id === alertId)
    if (!alert) return false

    alert.acknowledged = true
    this.saveToStorage()
    return true
  }

  deleteRelease(releaseId: string): boolean {
    const result = this.releases.delete(releaseId)
    if (result) {
      this.stopMonitoring(releaseId)
      this.metricsHistory.delete(releaseId)
      this.saveToStorage()
    }
    return result
  }

  reset(): void {
    this.monitoringIntervals.forEach((interval) => {
      clearInterval(interval)
    })
    this.releases.clear()
    this.userBuckets.clear()
    this.metricsHistory.clear()
    this.monitoringIntervals.clear()
    localStorage.removeItem(STORAGE_KEY)
  }

  private calculatePhases(config: GrayReleaseConfig): PhaseStatus[] {
    const phases: PhaseStatus[] = []
    const percentages = [5, 10, 25, 50, 75, 100]
    
    for (const percentage of percentages) {
      if (percentage <= config.rolloutPercentage) {
        phases.push({
          phase: phases.length + 1,
          percentage,
          status: 'pending'
        })
      }
    }

    return phases
  }

  private canPromote(record: GrayReleaseRecord): boolean {
    const { metrics } = record.status
    const { promoteThreshold } = record.config

    if (metrics.exposedUsers < promoteThreshold.minSampleSize) return false

    const completionRate = metrics.completedUsers / metrics.exposedUsers
    const errorRate = metrics.errorCount / metrics.exposedUsers

    return completionRate >= promoteThreshold.completionRate &&
           errorRate <= promoteThreshold.errorRate &&
           metrics.satisfactionScore >= promoteThreshold.userSatisfaction
  }

  private getUserBucket(userId: string, tourId: string): string {
    const key = `${userId}_${tourId}`
    if (!this.userBuckets.has(key)) {
      const hash = this.simpleHash(key)
      this.userBuckets.set(key, hash)
    }
    return this.userBuckets.get(key)!
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16).padStart(8, '0')
  }

  private matchesGroup(userId: string, group: TargetGroup): boolean {
    return group.criteria.every(rule => this.evaluateRule(userId, rule))
  }

  private evaluateRule(userId: string, rule: ReleaseRule): boolean {
    const value = this.simpleHash(`${userId}_${rule.field}`)
    
    switch (rule.operator) {
      case 'equals':
        return value === rule.value
      case 'contains':
        return value.includes(String(rule.value))
      case 'gt':
        return parseInt(value, 16) > Number(rule.value)
      case 'lt':
        return parseInt(value, 16) < Number(rule.value)
      case 'in':
        return Array.isArray(rule.value) && (rule.value as string[]).includes(value)
      case 'regex':
        return new RegExp(String(rule.value)).test(value)
      default:
        return false
    }
  }

  private checkThresholds(record: GrayReleaseRecord): void {
    const { monitoring } = record.config
    const { metrics } = record.status

    for (const threshold of monitoring.alertThresholds) {
      const metricValue = this.getMetricValue(metrics, threshold.metric)
      const triggered = threshold.operator === 'gt' 
        ? metricValue > threshold.value 
        : metricValue < threshold.value

      if (triggered) {
        this.addAlert(
          record,
          threshold.severity,
          `${threshold.metric} ${threshold.operator === 'gt' ? '超过' : '低于'} 阈值: ${metricValue} vs ${threshold.value}`
        )
      }
    }
  }

  private getMetricValue(metrics: ReleaseMetrics, metric: string): number {
    switch (metric) {
      case 'exposedUsers': return metrics.exposedUsers
      case 'completedUsers': return metrics.completedUsers
      case 'errorCount': return metrics.errorCount
      case 'avgCompletionTime': return metrics.avgCompletionTime
      case 'satisfactionScore': return metrics.satisfactionScore
      case 'conversionRate': return metrics.conversionRate
      case 'bounceRate': return metrics.bounceRate
      case 'completionRate': return metrics.exposedUsers > 0 
        ? metrics.completedUsers / metrics.exposedUsers : 0
      case 'errorRate': return metrics.exposedUsers > 0 
        ? metrics.errorCount / metrics.exposedUsers : 0
      default: return 0
    }
  }

  private addAlert(record: GrayReleaseRecord, type: 'warning' | 'critical' | 'info', message: string): void {
    record.status.alerts.push({
      id: `alert_${Date.now()}`,
      type,
      message,
      timestamp: Date.now(),
      acknowledged: false
    })
  }

  private startMonitoring(releaseId: string): void {
    if (this.monitoringIntervals.has(releaseId)) return

    const record = this.releases.get(releaseId)
    if (!record) return

    const interval = window.setInterval(() => {
      const r = this.releases.get(releaseId)
      if (!r || r.status.status !== 'running') {
        this.stopMonitoring(releaseId)
        return
      }

      if (r.config.autoPromote && this.canPromote(r)) {
        this.promoteRelease(releaseId)
      }
    }, record.config.monitoring.checkInterval * 1000)

    this.monitoringIntervals.set(releaseId, interval)
  }

  private stopMonitoring(releaseId: string): void {
    const interval = this.monitoringIntervals.get(releaseId)
    if (interval) {
      clearInterval(interval)
      this.monitoringIntervals.delete(releaseId)
    }
  }

  private getEmptyMetrics(): ReleaseMetrics {
    return {
      exposedUsers: 0,
      completedUsers: 0,
      errorCount: 0,
      avgCompletionTime: 0,
      satisfactionScore: 0,
      conversionRate: 0,
      bounceRate: 0
    }
  }

  private saveToStorage(): void {
    try {
      const data = {
        releases: Array.from(this.releases.entries()),
        userBuckets: Array.from(this.userBuckets.entries()),
        metricsHistory: Array.from(this.metricsHistory.entries())
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      logger.error('Failed to save gray release data:', e)
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        const parsed = JSON.parse(data)
        this.releases = new Map(parsed.releases || [])
        this.userBuckets = new Map(parsed.userBuckets || [])
        this.metricsHistory = new Map(parsed.metricsHistory || [])
      }
    } catch (e) {
      logger.error('Failed to load gray release data:', e)
    }
  }
}

export const tourGrayReleaseService = new TourGrayReleaseService()
