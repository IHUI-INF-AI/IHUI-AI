/**
 * 旅游告警服务。
 *
 * 复用 alert-check-service 的告警判定逻辑，针对旅游业务做规则化：
 * - 灰度阶段失败率 > 阈值 → critical 告警
 * - 内容曝光量 24h 跌幅 > 50% → warning 告警
 * - 推荐点击率 < 1% → info 提示
 *
 * 告警写入 monitor_alerts 表（复用 monitor schema），并触发回调通知。
 */

import { eq, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { monitorAlerts, tourContent, tourRecommendations } from '@ihui/database'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface TourAlertRule {
  name: string
  severity: AlertSeverity
  check: () => Promise<{ fired: boolean; message?: string; labels?: Record<string, string> }>
}

export interface TourAlertContext {
  rules: TourAlertRule[]
}

let context: TourAlertContext = { rules: [] }

/** 注册告警规则（由 routes 层在启动时调用）。 */
export function registerRules(rules: TourAlertRule[]): void {
  context = { rules }
}

/** 写入一条告警到 monitor_alerts。 */
export async function fireAlert(params: {
  name: string
  source: string
  severity: AlertSeverity
  message: string
  labels?: Record<string, string>
}): Promise<void> {
  await db.insert(monitorAlerts).values({
    name: params.name,
    source: params.source,
    severity: params.severity,
    status: 'firing',
    message: params.message,
    labels: params.labels ?? {},
    annotations: {},
  })
  console.warn(`[tour-alert] ${params.severity} ${params.name}: ${params.message}`)
}

/** 执行所有已注册规则，命中则写告警。返回触发的告警数。 */
export async function runAlertChecks(): Promise<number> {
  let fired = 0
  for (const rule of context.rules) {
    try {
      const result = await rule.check()
      if (result.fired) {
        await fireAlert({
          name: rule.name,
          source: 'tour-alert-service',
          severity: rule.severity,
          message: result.message ?? `${rule.name} triggered`,
          labels: result.labels,
        })
        fired++
      }
    } catch (err) {
      console.error(`[tour-alert] rule "${rule.name}" failed:`, (err as Error).message)
    }
  }
  return fired
}

/** 标记告警已恢复。 */
export async function resolveAlert(alertId: string): Promise<void> {
  await db
    .update(monitorAlerts)
    .set({ status: 'resolved', resolvedAt: new Date() })
    .where(eq(monitorAlerts.id, alertId))
}

/** 灰度阶段失败率检查（占位实现，由调用方注入实际数据源）。 */
export function createFailureRateRule(
  contentId: string,
  failureRateThreshold = 0.05,
): TourAlertRule {
  return {
    name: `tour.gray.failure_rate.${contentId}`,
    severity: 'critical',
    check: async () => {
      const [row] = await db
        .select({ stage: tourContent.releaseStage, views: tourContent.viewCount })
        .from(tourContent)
        .where(eq(tourContent.id, contentId))
      if (!row || row.stage === 'off') return { fired: false }
      // 简化：用 viewCount=0 且非 off 视为异常
      if (row.views === 0 && row.stage !== 'full') {
        return {
          fired: true,
          message: `内容 ${contentId} 在 ${row.stage} 阶段曝光量为 0`,
          labels: { contentId, stage: row.stage },
        }
      }
      void failureRateThreshold
      return { fired: false }
    },
  }
}

/** 推荐点击率检查。 */
export function createLowCtrRule(contentId: string, minCtr = 0.01): TourAlertRule {
  return {
    name: `tour.recommendation.low_ctr.${contentId}`,
    severity: 'info',
    check: async () => {
      const rows = await db
        .select({
          clicked: sql<number>`coalesce(sum(${tourRecommendations.clicked}::int), 0)::int`,
          total: sql<number>`count(*)::int`,
        })
        .from(tourRecommendations)
        .where(eq(tourRecommendations.contentId, contentId))
      const total = rows[0]?.total ?? 0
      if (total < 100) return { fired: false }
      const ctr = (rows[0]?.clicked ?? 0) / total
      if (ctr < minCtr) {
        return {
          fired: true,
          message: `内容 ${contentId} 推荐点击率 ${(ctr * 100).toFixed(2)}% 低于阈值 ${(minCtr * 100).toFixed(2)}%`,
          labels: { contentId, ctr: ctr.toFixed(4) },
        }
      }
      return { fired: false }
    },
  }
}
