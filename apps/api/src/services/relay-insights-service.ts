// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { sql } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { logger } from '../utils/logger.js'

/**
 * 运营洞察引擎(2026-09-17 立,补强 62,差异化能力:竞品无 AI/自动化运营分析)。
 *
 * 基于库内真实数据(llm_call_logs / developer_api_keys / ai_relay_key_pool /
 * relay_alert_events)自动产出诊断与建议,每条洞察:
 * { type, severity: info|warning|critical, title, detail, suggestion }
 *
 * 诚实边界:**规则驱动,非 LLM 生成**——所有数字来自 SQL 实测聚合,
 * 建议是确定性规则(如"高峰错误率>2x 基线→建议扩容或上调高峰倍率"),
 * 不做无法验证的自然语言臆断。设计为可扩展:后续可把洞察喂给 LLM 做归因叙述。
 *
 * 分析维度(全部容错,单维度失败不影响其他):
 * 1. 错误率突增:近 1h vs 前 24h 基线,>2 倍且绝对值>5% 报 critical/warning
 * 2. 成本异常:昨日成本 vs 近 7 天日均,>2 倍报 warning
 * 3. 容量预警:低余额 Key 数 / 号池不可用账号占比
 * 4. 慢调用:近 24h P95 延迟最差的模型 Top 3
 * 5. 空转检测:有调用但成本为 0 的模型(可能定价未配置=免费敞口)
 */

export type InsightSeverity = 'info' | 'warning' | 'critical'
export type InsightType =
  | 'error_spike'
  | 'cost_anomaly'
  | 'capacity_warning'
  | 'slow_calls'
  | 'free_usage'
  | 'health_summary'

export interface Insight {
  type: InsightType
  severity: InsightSeverity
  title: string
  detail: string
  suggestion: string
}

export interface InsightsResult {
  generatedAt: string
  insights: Insight[]
  summary: { critical: number; warning: number; info: number }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 维度 1:错误率突增(近 1h vs 前 24h 基线)。 */
async function detectErrorSpike(): Promise<Insight[]> {
  const out: Insight[] = []
  const result = await dbRead.execute(sql`
    SELECT
      count(*) FILTER (WHERE created_at >= now() - interval '1 hour')::int AS recent_total,
      count(*) FILTER (WHERE created_at >= now() - interval '1 hour' AND status = 'error')::int AS recent_failed,
      count(*) FILTER (WHERE created_at >= now() - interval '25 hours' AND created_at < now() - interval '1 hour')::int AS base_total,
      count(*) FILTER (WHERE created_at >= now() - interval '25 hours' AND created_at < now() - interval '1 hour' AND status = 'error')::int AS base_failed
    FROM llm_call_logs
  `)
  const row = ((result as unknown as { rows?: Array<Record<string, number>> }).rows ?? [])[0] ?? {}
  const recentTotal = Number(row.recent_total ?? 0)
  const recentFailed = Number(row.recent_failed ?? 0)
  const baseTotal = Number(row.base_total ?? 0)
  const baseFailed = Number(row.base_failed ?? 0)
  if (recentTotal < 10 || baseTotal < 10) return out // 样本不足不误报
  const recentRate = recentFailed / recentTotal
  const baseRate = baseFailed / baseTotal
  if (recentRate > 0.05 && recentRate > baseRate * 2) {
    out.push({
      type: 'error_spike',
      severity: recentRate > 0.2 ? 'critical' : 'warning',
      title: `错误率突增至 ${(recentRate * 100).toFixed(1)}%(基线 ${(baseRate * 100).toFixed(1)}%)`,
      detail: `近 1 小时 ${recentFailed}/${recentTotal} 次调用失败,是前 24 小时基线的 ${round2(recentRate / Math.max(baseRate, 0.001))} 倍。`,
      suggestion:
        '优先检查渠道健康页与号池熔断状态;若单渠道劣化可临时摘除(temp-unschedulable),并确认是否需要上调高峰倍率对冲重试成本。',
    })
  }
  return out
}

/** 维度 2:成本异常(昨日 vs 近 7 天日均,排除昨日)。 */
async function detectCostAnomaly(): Promise<Insight[]> {
  const out: Insight[] = []
  const result = await dbRead.execute(sql`
    SELECT
      COALESCE(sum(CASE WHEN to_char(created_at AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') = to_char(now() AT TIME ZONE 'Asia/Shanghai' - interval '1 day','YYYY-MM-DD') THEN cost_used_total_cents ELSE 0 END), 0)::float8 AS yesterday_cents,
      COALESCE(avg(daily_total), 0)::float8 AS avg7_cents
    FROM (
      SELECT to_char(created_at AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') AS d,
             sum(cost_used_total_cents) AS daily_total,
             max(created_at) AS latest
      FROM llm_call_logs
      WHERE created_at >= now() - interval '8 days'
      GROUP BY 1
    ) t
    WHERE d <> to_char(latest AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD')
  `)
  const row = ((result as unknown as { rows?: Array<Record<string, number>> }).rows ?? [])[0] ?? {}
  const yesterdayCents = Number(row.yesterday_cents ?? 0)
  const avg7 = Number(row.avg7_cents ?? 0)
  if (avg7 > 1000 && yesterdayCents > avg7 * 2) {
    out.push({
      type: 'cost_anomaly',
      severity: 'warning',
      title: `昨日成本 ¥${round2(yesterdayCents / 100)} 为近 7 天日均(¥${round2(avg7 / 100)})的 ${round2(yesterdayCents / avg7)} 倍`,
      detail: '成本突增可能来自新客户放量、倍率配置变更或异常调用,建议核对模型分布与调用来源。',
      suggestion:
        '在用量分析页按模型核对昨日成本构成;若为正常放量可在容量看板确认号池余量是否充足。',
    })
  }
  return out
}

/** 维度 3:容量预警(低余额 Key 数 + 号池不可用占比)。 */
async function detectCapacityWarning(): Promise<Insight[]> {
  const out: Insight[] = []
  const keyResult = await dbRead.execute(sql`
    SELECT
      count(*) FILTER (WHERE status = 'active')::int AS active_total,
      count(*) FILTER (WHERE status = 'active' AND (token_balance = 0 OR (cost_balance_cents >= 0 AND cost_balance_cents < 1000)))::int AS low_balance
    FROM developer_api_keys
  `)
  const kRow =
    ((keyResult as unknown as { rows?: Array<Record<string, number>> }).rows ?? [])[0] ?? {}
  const activeTotal = Number(kRow.active_total ?? 0)
  const lowBalance = Number(kRow.low_balance ?? 0)
  if (activeTotal > 0 && lowBalance / activeTotal > 0.3 && lowBalance >= 3) {
    out.push({
      type: 'capacity_warning',
      severity: 'warning',
      title: `${lowBalance}/${activeTotal} 个活跃 Key 余额低于 ¥10 告警线`,
      detail: '大量 Key 接近耗尽,即将产生批量失败调用与客服压力。',
      suggestion: '通过购买页引导充值,或对高价值客户使用批量属性(user-attributes)筛选后定向通知。',
    })
  }
  const poolResult = await dbRead.execute(sql`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE is_enabled = true AND temp_unschedulable = false)::int AS schedulable,
      count(*) FILTER (WHERE is_enabled = true AND health_status = 'down')::int AS down
    FROM ai_relay_key_pool
  `)
  const pRow =
    ((poolResult as unknown as { rows?: Array<Record<string, number>> }).rows ?? [])[0] ?? {}
  const schedulable = Number(pRow.schedulable ?? 0)
  const down = Number(pRow.down ?? 0)
  const poolTotal = Number(pRow.total ?? 0)
  if (poolTotal > 0 && (down / poolTotal > 0.3 || schedulable === 0)) {
    out.push({
      type: 'capacity_warning',
      severity: schedulable === 0 ? 'critical' : 'warning',
      title: `号池可调度账号仅 ${schedulable}/${poolTotal},${down} 个处于 down`,
      detail: '可调度账号不足将导致请求排队失败或全部落到单一渠道。',
      suggestion: '检查渠道健康与熔断状态;摘除不可恢复账号并补充新账号,必要时上调对应渠道倍率。',
    })
  }
  return out
}

/** 维度 4:慢调用诊断(近 24h P95 延迟 Top 3 模型,样本 ≥ 20)。 */
async function detectSlowCalls(): Promise<Insight[]> {
  const out: Insight[] = []
  const result = await dbRead.execute(sql`
    SELECT model,
           count(*)::int AS calls,
           COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::float8 AS p95
    FROM llm_call_logs
    WHERE created_at >= now() - interval '24 hours' AND status = 'success'
    GROUP BY model
    HAVING count(*) >= 20
    ORDER BY p95 DESC
    LIMIT 3
  `)
  const rows = ((result as unknown as { rows?: Array<Record<string, unknown>> }).rows ??
    []) as Array<{
    model: string
    calls: number
    p95: number
  }>
  const slow = rows.filter((r) => Number(r.p95) > 30_000)
  if (slow.length > 0) {
    out.push({
      type: 'slow_calls',
      severity: 'info',
      title: `${slow.length} 个模型近 24 小时 P95 延迟超过 30 秒`,
      detail:
        slow
          .map((r) => `${r.model}: P95 ${Math.round(Number(r.p95) / 1000)}s(${r.calls} 次)`)
          .join(';') + '。',
      suggestion:
        '核对对应渠道是否降级到慢速线路;高峰时段可考虑按分时倍率引导用户错峰,或为该模型配置备用渠道。',
    })
  }
  return out
}

/** 维度 5:空转检测(近 24h 有成功调用但成本为 0 的模型 = 免费敞口)。 */
async function detectFreeUsage(): Promise<Insight[]> {
  const out: Insight[] = []
  const result = await dbRead.execute(sql`
    SELECT model, count(*)::int AS calls
    FROM llm_call_logs
    WHERE created_at >= now() - interval '24 hours' AND status = 'success'
    GROUP BY model
    HAVING COALESCE(sum(cost_used_total_cents), 0) = 0 AND count(*) >= 5
    ORDER BY calls DESC
    LIMIT 5
  `)
  const rows = ((result as unknown as { rows?: Array<Record<string, unknown>> }).rows ??
    []) as Array<{
    model: string
    calls: number
  }>
  if (rows.length > 0) {
    const detail = rows.map((r) => `${r.model}(${r.calls} 次)`).join(';')
    out.push({
      type: 'free_usage',
      severity: 'warning',
      title: `${rows.length} 个模型有成功调用但计费成本为 0`,
      detail: `近 24 小时:${detail}。可能原因:定价未配置(calculateCost 走 default 0 价)、免费渠道未标注、或计费链路异常。`,
      suggestion:
        '在模型管理核对这些模型的定价行与中转倍率;确认属免费策略的可在目录标注 free,避免被误判为计费漏洞。',
    })
  }
  return out
}

/** 汇总生成全部洞察。 */
export async function generateInsights(): Promise<InsightsResult> {
  const insights: Insight[] = []
  const dims = [
    detectErrorSpike,
    detectCostAnomaly,
    detectCapacityWarning,
    detectSlowCalls,
    detectFreeUsage,
  ]
  for (const fn of dims) {
    try {
      insights.push(...(await fn()))
    } catch (e) {
      logger.warn('[insights] 单维度分析失败(隔离)', {
        fn: fn.name,
        err: e instanceof Error ? e.message : String(e),
      })
    }
  }
  const sevRank: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2 }
  insights.sort((a, b) => sevRank[a.severity] - sevRank[b.severity])
  return {
    generatedAt: new Date().toISOString(),
    insights,
    summary: {
      critical: insights.filter((i) => i.severity === 'critical').length,
      warning: insights.filter((i) => i.severity === 'warning').length,
      info: insights.filter((i) => i.severity === 'info').length,
    },
  }
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
