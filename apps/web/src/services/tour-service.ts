/**
 * 引导系统服务（合并版）
 *
 * 合并自旧架构 services/tour*Service.ts 的 7 个文件：
 * - tourGrayReleaseService / tourMonitoringService / tourAlertService
 * - tourDependencyService / tourEventBus / tourMultiPlatformService
 * - tourRecommendationService
 *
 * 新架构基于 fetchApi 与纯 TypeScript，无 Vue 依赖。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

/* ------------------------------------------------------------------ */
/* 事件总线（tourEventBus）                                            */
/* ------------------------------------------------------------------ */

export type TourEventType =
  'tour:start' | 'tour:step' | 'tour:complete' | 'tour:skip' | 'tour:error'

export interface TourEvent {
  type: TourEventType
  tourId: string
  stepId?: string
  userId?: string
  payload?: Record<string, unknown>
  timestamp: number
}

type TourEventHandler = (event: TourEvent) => void

const tourHandlers = new Map<TourEventType, Set<TourEventHandler>>()

export function onTourEvent(type: TourEventType, handler: TourEventHandler): () => void {
  let set = tourHandlers.get(type)
  if (!set) {
    set = new Set()
    tourHandlers.set(type, set)
  }
  set.add(handler)
  return () => set?.delete(handler)
}

export function emitTourEvent(event: TourEvent): void {
  const set = tourHandlers.get(event.type)
  if (!set) return
  for (const handler of set) {
    try {
      handler(event)
    } catch {
      // 处理器异常，静默忽略以保证后续回调执行
    }
  }
}

/* ------------------------------------------------------------------ */
/* 依赖管理（tourDependencyService）                                   */
/* ------------------------------------------------------------------ */

export interface TourDependency {
  tourId: string
  dependsOn: string[]
  /** 依赖必须完成的次数（默认 1 次） */
  requiredCount?: number
}

const dependencies = new Map<string, TourDependency>()
const completedTours = new Map<string, number>()

export function registerDependency(dep: TourDependency): void {
  dependencies.set(dep.tourId, dep)
}

export function markTourCompleted(tourId: string): void {
  completedTours.set(tourId, (completedTours.get(tourId) ?? 0) + 1)
}

export function checkDependencies(tourId: string): {
  ok: boolean
  missing: string[]
} {
  const dep = dependencies.get(tourId)
  if (!dep) return { ok: true, missing: [] }
  const required = dep.requiredCount ?? 1
  const missing = dep.dependsOn.filter((id) => (completedTours.get(id) ?? 0) < required)
  return { ok: missing.length === 0, missing }
}

/* ------------------------------------------------------------------ */
/* 灰度发布（tourGrayReleaseService）                                  */
/* ------------------------------------------------------------------ */

export interface GrayReleaseConfig {
  tourId: string
  tourVersion: string
  strategy: 'percentage' | 'user_group' | 'region' | 'device' | 'custom'
  rolloutPercentage: number
  targetGroups: string[]
  startDate: number
  endDate?: number
  autoPromote: boolean
  promoteThreshold: {
    completionRate: number
    errorRate: number
    minSampleSize: number
  }
}

export interface ReleaseMetrics {
  exposedUsers: number
  completedUsers: number
  errorCount: number
  avgCompletionTime: number
  satisfactionScore: number
}

export interface ReleaseStatus {
  tourId: string
  currentPercentage: number
  targetPercentage: number
  status: 'pending' | 'running' | 'paused' | 'completed' | 'rolled_back'
  startTime: number
  metrics: ReleaseMetrics
}

const releases = new Map<string, ReleaseStatus>()

export function createRelease(config: GrayReleaseConfig): ReleaseStatus {
  const status: ReleaseStatus = {
    tourId: config.tourId,
    currentPercentage: 0,
    targetPercentage: config.rolloutPercentage,
    status: 'pending',
    startTime: config.startDate,
    metrics: {
      exposedUsers: 0,
      completedUsers: 0,
      errorCount: 0,
      avgCompletionTime: 0,
      satisfactionScore: 0,
    },
  }
  releases.set(config.tourId, status)
  return status
}

export function isUserExposed(tourId: string, userId: string): boolean {
  const release = releases.get(tourId)
  if (!release || release.status !== 'running') return false
  // 简单 hash 决定是否暴露
  const hash = Array.from(userId).reduce((s, c) => s + c.charCodeAt(0), 0)
  return hash % 100 < release.currentPercentage
}

export function updateReleaseMetrics(
  tourId: string,
  metrics: Partial<ReleaseMetrics>,
): ReleaseStatus | undefined {
  const release = releases.get(tourId)
  if (!release) return undefined
  release.metrics = { ...release.metrics, ...metrics }
  return release
}

export function promoteRelease(tourId: string): ReleaseStatus | undefined {
  const release = releases.get(tourId)
  if (!release) return undefined
  const next = Math.min(100, release.currentPercentage + 25)
  release.currentPercentage = next
  if (next >= release.targetPercentage) release.status = 'completed'
  return release
}

export function rollbackRelease(tourId: string): ReleaseStatus | undefined {
  const release = releases.get(tourId)
  if (!release) return undefined
  release.status = 'rolled_back'
  release.currentPercentage = 0
  return release
}

/* ------------------------------------------------------------------ */
/* 监控（tourMonitoringService）                                       */
/* ------------------------------------------------------------------ */

export interface PerformanceSnapshot {
  timestamp: number
  memory: { used: number; total: number; percentage: number }
  render: { fps: number; frameTime: number }
  tour: {
    activeCount: number
    completionRate: number
    errorRate: number
    avgDuration: number
  }
}

export interface AnomalyDetection {
  id: string
  metric: string
  type: 'spike' | 'drop' | 'trend_change'
  severity: 'low' | 'medium' | 'high' | 'critical'
  value: number
  expectedValue: number
  timestamp: number
}

const snapshots: PerformanceSnapshot[] = []
const anomalyThreshold = 2.5 // 标准差倍数

export function recordSnapshot(snapshot: PerformanceSnapshot): void {
  snapshots.push(snapshot)
  if (snapshots.length > 500) snapshots.shift()
}

export function detectAnomalies(metric: keyof PerformanceSnapshot): AnomalyDetection[] {
  const values = snapshots
    .map((s) => {
      if (metric === 'memory') return s.memory.percentage
      if (metric === 'render') return s.render.fps
      if (metric === 'tour') return s.tour.errorRate
      return 0
    })
    .filter((v) => typeof v === 'number')
  if (values.length < 5) return []
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  const std = Math.sqrt(variance)
  if (std === 0) return []
  const anomalies: AnomalyDetection[] = []
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!
    if (Math.abs(v - mean) > anomalyThreshold * std) {
      const severity: AnomalyDetection['severity'] =
        Math.abs(v - mean) > anomalyThreshold * 3 * std
          ? 'critical'
          : Math.abs(v - mean) > anomalyThreshold * 2 * std
            ? 'high'
            : 'medium'
      anomalies.push({
        id: `an_${i}_${metric.toString()}`,
        metric: metric.toString(),
        type: v > mean ? 'spike' : 'drop',
        severity,
        value: v,
        expectedValue: mean,
        timestamp: snapshots[i]?.timestamp ?? Date.now(),
      })
    }
  }
  return anomalies
}

export function getLatestSnapshot(): PerformanceSnapshot | undefined {
  return snapshots[snapshots.length - 1]
}

/* ------------------------------------------------------------------ */
/* 告警（tourAlertService）                                            */
/* ------------------------------------------------------------------ */

export interface AlertRule {
  id: string
  name: string
  metric: string
  operator: 'gt' | 'lt' | 'gte' | 'lte'
  threshold: number
  severity: 'info' | 'warning' | 'critical'
  enabled: boolean
  cooldownMs: number
}

export interface AlertInstance {
  id: string
  ruleId: string
  status: 'firing' | 'resolved' | 'silenced'
  severity: 'info' | 'warning' | 'critical'
  value: number
  message: string
  startsAt: number
  endsAt?: number
}

const alertRules = new Map<string, AlertRule>()
const activeAlerts = new Map<string, AlertInstance>()
const lastFiredAt = new Map<string, number>()

export function addAlertRule(rule: AlertRule): void {
  alertRules.set(rule.id, rule)
}

export function evaluateAlerts(metrics: Record<string, number>): AlertInstance[] {
  const now = Date.now()
  const fired: AlertInstance[] = []
  for (const rule of alertRules.values()) {
    if (!rule.enabled) continue
    const value = metrics[rule.metric]
    if (typeof value !== 'number') continue
    const triggered = (() => {
      switch (rule.operator) {
        case 'gt':
          return value > rule.threshold
        case 'lt':
          return value < rule.threshold
        case 'gte':
          return value >= rule.threshold
        case 'lte':
          return value <= rule.threshold
      }
    })()
    const last = lastFiredAt.get(rule.id) ?? 0
    if (triggered && now - last >= rule.cooldownMs) {
      const alert: AlertInstance = {
        id: `alert_${rule.id}_${now}`,
        ruleId: rule.id,
        status: 'firing',
        severity: rule.severity,
        value,
        message: `${rule.name}: ${rule.metric}=${value} (${rule.operator} ${rule.threshold})`,
        startsAt: now,
      }
      activeAlerts.set(alert.id, alert)
      lastFiredAt.set(rule.id, now)
      fired.push(alert)
    }
  }
  return fired
}

export function resolveAlert(alertId: string): boolean {
  const alert = activeAlerts.get(alertId)
  if (!alert) return false
  alert.status = 'resolved'
  alert.endsAt = Date.now()
  return true
}

export function getActiveAlerts(): AlertInstance[] {
  return Array.from(activeAlerts.values()).filter((a) => a.status === 'firing')
}

/* ------------------------------------------------------------------ */
/* 多端适配（tourMultiPlatformService）                                */
/* ------------------------------------------------------------------ */

export type TourPlatform = 'web' | 'mobile' | 'tablet' | 'desktop' | 'miniapp'

export interface PlatformConfig {
  platform: TourPlatform
  enabled: boolean
  /** 该端步骤数 / 跳转逻辑差异 */
  stepOverrides?: Record<string, { skip?: boolean; replaceWith?: string }>
}

export function detectPlatform(): TourPlatform {
  if (typeof window === 'undefined') return 'web'
  const ua = window.navigator.userAgent
  if (/miniapp/i.test(ua)) return 'miniapp'
  if (/Mobile|Android|iPhone/i.test(ua)) return 'mobile'
  if (/iPad|Tablet/i.test(ua)) return 'tablet'
  if (/Electron|desktop/i.test(ua)) return 'desktop'
  return 'web'
}

export function applyPlatformOverrides(
  steps: Array<{ id: string }>,
  config: PlatformConfig,
): Array<{ id: string }> {
  if (!config.stepOverrides) return steps
  const result: Array<{ id: string }> = []
  for (const step of steps) {
    const override = config.stepOverrides[step.id]
    if (override?.skip) continue
    if (override?.replaceWith) {
      result.push({ id: override.replaceWith })
    } else {
      result.push(step)
    }
  }
  return result
}

/* ------------------------------------------------------------------ */
/* 推荐（tourRecommendationService）                                   */
/* ------------------------------------------------------------------ */

export interface TourRecommendation {
  tourId: string
  score: number
  reason: string
}

export function recommendTours(
  _userId: string,
  visitedTours: string[],
  allTours: Array<{ id: string; category: string; tags: string[] }>,
): TourRecommendation[] {
  // 基于用户已访问历史计算相似度，未访问过的优先推荐
  const visited = new Set(visitedTours)
  const visitedCategories = new Set(
    allTours.filter((t) => visited.has(t.id)).map((t) => t.category),
  )
  return allTours
    .filter((t) => !visited.has(t.id))
    .map((t) => {
      const catMatch = visitedCategories.has(t.category)
      const score = catMatch ? 0.8 : 0.4
      const reason = catMatch ? '基于你之前浏览的内容推荐' : '探索新功能'
      return { tourId: t.id, score, reason }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

export function shouldShowRecommendation(
  _userId: string,
  lastShownAt: number,
  intervalMs = 24 * 60 * 60 * 1000,
): boolean {
  return Date.now() - lastShownAt >= intervalMs
}

/* ------------------------------------------------------------------ */
/* 远程 API                                                            */
/* ------------------------------------------------------------------ */

export interface TourRecord {
  id: string
  userId: string
  tourId: string
  status: 'in_progress' | 'completed' | 'skipped'
  currentStep: number
  totalSteps: number
  startedAt: string
  finishedAt: string | null
}

export interface TourProgressInput {
  tourId: string
  stepId?: string
  status?: TourRecord['status']
}

export async function apiReportProgress(input: TourProgressInput): Promise<ApiResult<TourRecord>> {
  return fetchApi<TourRecord>('/tour/progress', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function apiGetMyTours(
  query: { page?: number; pageSize?: number; status?: string } = {},
): Promise<ApiResult<PageData<TourRecord>>> {
  return fetchApi<PageData<TourRecord>>(`/tour/mine${buildQs(query)}`)
}

export async function apiSkipTour(tourId: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/tour/${encodeURIComponent(tourId)}/skip`, {
    method: 'POST',
  })
}
