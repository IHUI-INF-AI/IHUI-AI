// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 中转站告警规则引擎服务(2026-09-16 立,深度对标补强 U)。
 *
 * 职责:
 * 1. CRUD(管理端配置自定义规则)
 * 2. evaluateAllAlertRules() — 评估全部启用规则:按 metric 聚合当前值,
 *    命中(含冷却检查)→ 落 relay_alert_events + pushAlert 推送
 *
 * 内置指标(全部来自 llm_call_logs / developer_api_keys 实测聚合,无臆造):
 * - error_rate_1h    近 1 小时失败率(0-1)= failed / total(status='error' 占比)
 * - avg_latency_1h   近 1 小时平均延迟(ms)
 * - failed_calls_24h 近 24 小时失败调用数
 * - low_balance_keys 余额低于 1000 分(¥10)的 active Key 数
 *
 * 防风暴:cooldownMinutes(默认 30)内同规则不重复触发;评估失败单规则隔离,不影响其他规则。
 */
import { and, or, eq, desc, gte, lte, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import {
  relayAlertRules,
  relayAlertEvents,
  relayAlertSilences,
  developerApiKeys,
  llmCallLogs,
  type RelayAlertRule,
  type RelayAlertSilence,
} from '@ihui/database'
import { logger } from '../utils/logger.js'
import { roundCents } from './relay-billing-service.js'

export type AlertMetric =
  'error_rate_1h' | 'avg_latency_1h' | 'failed_calls_24h' | 'low_balance_keys'
const METRICS: AlertMetric[] = [
  'error_rate_1h',
  'avg_latency_1h',
  'failed_calls_24h',
  'low_balance_keys',
]

/** 校验规则入参,返回错误信息(undefined = 通过)。 */
export function validateAlertRuleInput(input: {
  name: string
  metric: string
  comparison: string
  threshold: number
  cooldownMinutes?: number
}): string | undefined {
  if (!input.name || input.name.trim().length === 0) return 'name_required'
  if (input.name.length > 100) return 'name_too_long'
  if (!METRICS.includes(input.metric as AlertMetric)) return 'metric_invalid'
  if (input.comparison !== 'gt' && input.comparison !== 'lt') return 'comparison_invalid'
  if (!Number.isFinite(input.threshold)) return 'threshold_invalid'
  if (
    input.cooldownMinutes !== undefined &&
    (input.cooldownMinutes < 0 || input.cooldownMinutes > 1440)
  ) {
    return 'cooldown_invalid'
  }
  return undefined
}

// =============================================================================
// CRUD
// =============================================================================

export async function listAlertRules(): Promise<RelayAlertRule[]> {
  const rows = await dbRead.select().from(relayAlertRules).orderBy(desc(relayAlertRules.createdAt))
  return rows as RelayAlertRule[]
}

export async function createAlertRule(input: {
  name: string
  metric: AlertMetric
  comparison: 'gt' | 'lt'
  threshold: number
  cooldownMinutes?: number
  enabled?: boolean
  remark?: string | null
}): Promise<RelayAlertRule> {
  const [row] = await db
    .insert(relayAlertRules)
    .values({
      name: input.name.trim(),
      metric: input.metric,
      comparison: input.comparison,
      threshold: String(input.threshold),
      cooldownMinutes: input.cooldownMinutes ?? 30,
      enabled: input.enabled ?? true,
      remark: input.remark ?? null,
    })
    .returning()
  return row as RelayAlertRule
}

export async function updateAlertRule(
  id: string,
  patch: Partial<{
    name: string
    metric: AlertMetric
    comparison: 'gt' | 'lt'
    threshold: number
    cooldownMinutes: number
    enabled: boolean
    remark: string | null
  }>,
): Promise<RelayAlertRule | null> {
  const setData: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.name !== undefined) setData.name = patch.name.trim()
  if (patch.metric !== undefined) setData.metric = patch.metric
  if (patch.comparison !== undefined) setData.comparison = patch.comparison
  if (patch.threshold !== undefined) setData.threshold = patch.threshold
  if (patch.cooldownMinutes !== undefined) setData.cooldownMinutes = patch.cooldownMinutes
  if (patch.enabled !== undefined) setData.enabled = patch.enabled
  if (patch.remark !== undefined) setData.remark = patch.remark
  const [row] = await db
    .update(relayAlertRules)
    .set(setData)
    .where(eq(relayAlertRules.id, id))
    .returning()
  return (row as RelayAlertRule) ?? null
}

export async function deleteAlertRule(id: string): Promise<boolean> {
  const rows = await db
    .delete(relayAlertRules)
    .where(eq(relayAlertRules.id, id))
    .returning({ id: relayAlertRules.id })
  return rows.length > 0
}

/** 最近告警事件(管理端"最近告警"查询)。 */
export async function listRecentAlertEvents(limit = 50) {
  const rows = await dbRead
    .select({
      id: relayAlertEvents.id,
      ruleId: relayAlertEvents.ruleId,
      ruleName: relayAlertRules.name,
      metric: relayAlertRules.metric,
      observedValue: relayAlertEvents.observedValue,
      threshold: relayAlertEvents.threshold,
      message: relayAlertEvents.message,
      pushStatus: relayAlertEvents.pushStatus,
      createdAt: relayAlertEvents.createdAt,
    })
    .from(relayAlertEvents)
    .innerJoin(relayAlertRules, eq(relayAlertEvents.ruleId, relayAlertRules.id))
    .orderBy(desc(relayAlertEvents.createdAt))
    .limit(Math.min(Math.max(1, limit), 200))
  return rows
}

// =============================================================================
// 评估引擎
// =============================================================================

export interface MetricObservation {
  value: number
  label: string
}

/** 计算单个指标的当前值(全部来自实测聚合)。 */
async function observeMetric(metric: AlertMetric): Promise<MetricObservation> {
  if (metric === 'error_rate_1h' || metric === 'avg_latency_1h') {
    // 近 1 小时窗口,llm_call_logs 实测聚合
    const [agg] = await dbRead
      .select({
        total: sql<number>`count(*)::int`,
        failed: sql<number>`sum(CASE WHEN ${llmCallLogs.status} = 'error' THEN 1 ELSE 0 END)::int`,
        avgLatency: sql<number>`COALESCE(AVG(${llmCallLogs.latencyMs}), 0)`,
      })
      .from(llmCallLogs)
      .where(gte(llmCallLogs.createdAt, new Date(Date.now() - 3600_000)))
    const total = Number(agg?.total ?? 0)
    const failed = Number(agg?.failed ?? 0)
    if (metric === 'error_rate_1h') {
      const rate = total > 0 ? failed / total : 0
      return {
        value: rate,
        label: `近 1 小时失败率 ${(rate * 100).toFixed(2)}%(失败 ${failed}/${total})`,
      }
    }
    const avgLatency = roundCents(Number(agg?.avgLatency ?? 0))
    return {
      value: avgLatency,
      label: `近 1 小时平均延迟 ${avgLatency.toFixed(0)}ms(${total} 次调用)`,
    }
  }

  if (metric === 'failed_calls_24h') {
    const [agg] = await dbRead
      .select({ failed: sql<number>`count(*)::int` })
      .from(llmCallLogs)
      .where(
        and(
          gte(llmCallLogs.createdAt, new Date(Date.now() - 86_400_000)),
          eq(llmCallLogs.status, 'error'),
        ),
      )
    const failed = Number(agg?.failed ?? 0)
    return { value: failed, label: `近 24 小时失败调用 ${failed} 次` }
  }

  // low_balance_keys:active 且(token 耗尽 或 成本余额低于 1000 分=¥10)的 Key 数
  const [agg] = await dbRead
    .select({ n: sql<number>`count(*)::int` })
    .from(developerApiKeys)
    .where(
      and(
        eq(developerApiKeys.status, 'active'),
        sql`(${developerApiKeys.tokenBalance} = 0 OR (${developerApiKeys.costBalanceCents} >= 0 AND ${developerApiKeys.costBalanceCents} < 1000))`,
      ),
    )
  const n = Number(agg?.n ?? 0)
  return { value: n, label: `余额告警线以下的活跃 Key ${n} 个` }
}

/** 命中判定:gt = value > threshold;lt = value < threshold。 */
function hits(rule: RelayAlertRule, value: number): boolean {
  const t = Number(rule.threshold)
  return rule.comparison === 'gt' ? value > t : value < t
}

/**
 * 判断某规则当前是否被静默(2026-09-16 立,对标竞品 /alert-silences)。
 * 命中条件:存在 scope=all 的生效静默,或 scope=rule 且 ruleId 匹配的生效静默。
 * 异常时按"不静默"处理(保证告警不因查询失败被吞)。
 */
export async function isAlertSilenced(ruleId: string, now = new Date()): Promise<boolean> {
  try {
    const rows = await dbRead
      .select({ id: relayAlertSilences.id })
      .from(relayAlertSilences)
      .where(
        and(
          or(
            eq(relayAlertSilences.scope, 'all'),
            and(eq(relayAlertSilences.scope, 'rule'), eq(relayAlertSilences.ruleId, ruleId)),
          ),
          lte(relayAlertSilences.startsAt, now),
          gte(relayAlertSilences.endsAt, now),
        ),
      )
      .limit(1)
    return (rows[0]?.id ?? '') !== ''
  } catch {
    return false
  }
}

/** 静默 CRUD(管理端维护窗口用)。 */
export async function listAlertSilences(includeExpired = false): Promise<RelayAlertSilence[]> {
  const rows = await dbRead
    .select()
    .from(relayAlertSilences)
    .orderBy(desc(relayAlertSilences.createdAt))
  return (
    includeExpired ? rows : rows.filter((r) => r.endsAt.getTime() >= Date.now())
  ) as RelayAlertSilence[]
}

export async function createAlertSilence(input: {
  scope: 'rule' | 'all'
  ruleId?: string | null
  reason?: string | null
  startsAt?: Date
  endsAt: Date
  createdBy?: string | null
}): Promise<RelayAlertSilence> {
  const [row] = await db
    .insert(relayAlertSilences)
    .values({
      scope: input.scope,
      ruleId: input.scope === 'rule' ? (input.ruleId ?? null) : null,
      reason: input.reason ?? null,
      startsAt: input.startsAt ?? new Date(),
      endsAt: input.endsAt,
      createdBy: input.createdBy ?? null,
    })
    .returning()
  return row as RelayAlertSilence
}

export async function deleteAlertSilence(id: string): Promise<boolean> {
  const rows = await db
    .delete(relayAlertSilences)
    .where(eq(relayAlertSilences.id, id))
    .returning({ id: relayAlertSilences.id })
  return rows.length > 0
}

/**
 * 评估全部启用规则。
 * 单规则异常隔离(try/catch per rule);触发走 pushAlert(既有推送通道)+ 事件落表。
 * 返回 { evaluated, triggered, skipped } 供管理端手动评估接口展示。
 */
export async function evaluateAllAlertRules(now = new Date()): Promise<{
  evaluated: number
  triggered: number
  skippedCooldown: number
}> {
  const rules = await dbRead.select().from(relayAlertRules).where(eq(relayAlertRules.enabled, true))

  let triggered = 0
  let skippedCooldown = 0
  let evaluated = 0

  for (const rule of rules) {
    try {
      evaluated++
      // 冷却检查:冷却窗口内已有事件 → 跳过
      const cooldownStart = new Date(now.getTime() - rule.cooldownMinutes * 60_000)
      const [recent] = await dbRead
        .select({ id: relayAlertEvents.id })
        .from(relayAlertEvents)
        .where(
          and(eq(relayAlertEvents.ruleId, rule.id), gte(relayAlertEvents.createdAt, cooldownStart)),
        )
        .limit(1)
      if (recent) {
        skippedCooldown++
        continue
      }

      // 静默检查(2026-09-16 立):维护窗口/已知故障期抑制告警。
      // scope=all(全局静默)或 scope=rule 且指向本规则,且当前时间在 [startsAt, endsAt] 内 → 跳过。
      const silenced = await isAlertSilenced(rule.id, now)
      if (silenced) {
        skippedCooldown++
        continue
      }

      const observation = await observeMetric(rule.metric as AlertMetric)
      if (!hits(rule, observation.value)) continue

      const message = `[${rule.name}] ${observation.label}(阈值 ${Number(rule.threshold)},${rule.comparison === 'gt' ? '>' : '<'})`
      await db.insert(relayAlertEvents).values({
        ruleId: rule.id,
        observedValue: String(observation.value),
        threshold: String(Number(rule.threshold)),
        message,
        pushStatus: 'pushed',
      })
      triggered++
      logger.warn('[relay-alert] 规则触发', { rule: rule.name, value: observation.value })

      // 推送:动态 import 避免与 alert-notification-service 潜在循环依赖
      const { pushAlert } = await import('./alert-notification-service.js')
      try {
        await pushAlert({
          title: `[中转站告警] ${rule.name}`,
          message,
          severity: 'critical',
          source: 'relay-alert-rules',
          metadata: {
            ruleId: rule.id,
            metric: rule.metric,
            observed: observation.value,
            threshold: Number(rule.threshold),
          },
        })
      } catch (pushErr) {
        // 推送失败不回滚事件(事件流保留触发记录)
        logger.error('[relay-alert] 推送失败', {
          rule: rule.name,
          err: pushErr instanceof Error ? pushErr.message : String(pushErr),
        })
      }
    } catch (e) {
      // 单规则隔离:评估异常不中断其他规则
      logger.error('[relay-alert] 规则评估异常', {
        ruleId: rule.id,
        err: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return { evaluated, triggered, skippedCooldown }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
