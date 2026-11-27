// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 大模型配置运行遥测(2026-11-26 立)。
 *
 * 为什么单独成服务:模型管理页(/admin/ai-models)需要"每个配置近来跑了多少、现在多快"的
 * 只读快照,而现有监控栈的回答都不是这一维 —— 生产大屏是**全站** QPS,Prometheus 面板是
 * 厂商/模型维度,且都要求额外采集腿;而 `llm_call_logs` 本身就把每次调用落在了
 * `config_id`(ai_model_config.id)上(relay 与 chat 共用同一条流水)。
 *
 * 口径(与仓库「取不到就写未判定」同一条纪律):
 * - 区间 = 含当前分钟在内的最近 60 个自然分钟(分钟对齐),5 分钟实时窗口另算;
 * - 调用数/Token 是**实测聚合**,0 是真的 0,不是"未采集";
 * - 延迟只统计 latency_ms > 0 的样本(0 是未测量,不是 0ms),没有样本时回 null;
 * - config_id 为空或 <= 0 的流水无法归属到任何配置行,单列 unattributed,不摊进任何一行;
 * - 管理端连通测试(metadata.isTestCall=true)不计入任何读数,避免人工探测污染质量评级。
 */
import { and, gte, lte, sql } from 'drizzle-orm'
import { llmCallLogs } from '@ihui/database'
import { dbRead } from '../db/index.js'
import { toSafeCount } from '../utils/safe-count.js'

/** 页面展示区间:最近 60 分钟。 */
export const TELEMETRY_WINDOW_MINUTES = 60
/** 实时窗口:QPS / Token 速率按最近 5 分钟算,避免 1 小时均值把突发抹平。 */
export const TELEMETRY_REALTIME_MINUTES = 5

const MINUTE_MS = 60_000

/** 少于 20 次/小时的样本不足以评质量,避免"1 次成功=100 分"式的假精度。 */
export const RUNTIME_GRADE_MIN_SAMPLE = 20

export type RuntimeGradeTier = 'excellent' | 'good' | 'fair' | 'poor' | 'insufficient'

/**
 * 运行质量分级(2026-11-26 立)。
 *
 * 只用两个能解释质量的维度,**不把 QPS/聚合 TPS 当质量**——它们是负载,不是好坏:
 * - 错误率(可靠性):≤0.5% 100 分(99.5% 可用性,常见 SLO 起点),≤1% 90,≤2% 78,
 *   ≤5% 60,≤10% 30,>10% 0;
 * - 端到端 P95(尾延迟):≤3s 100,≤8s 88,≤15s 70,≤30s 40,>30s 10。
 * 综合分取两项中的**较低分**(短板决定等级),避免"错误率很差但延迟很快"被平均成良好。
 * 端到端延迟含生成耗时,长输出模型要结合 Token 量解读;这是展示口径,不替代 TTFT。
 */
export interface RuntimeGrade {
  tier: RuntimeGradeTier
  /** 综合分 0-100;样本不足/无延迟样本时为 null(未判定)。 */
  score: number | null
  /** 参与判定的 60 分钟调用数。 */
  sample: number
}

export interface TelemetrySeriesPoint {
  /** 分钟桶起点(epoch ms,UTC 绝对时间;显示时区由调用方决定)。 */
  t: number
  calls: number
  tokens: number
}

export interface ConfigTelemetry {
  calls: number
  tokens: number
  calls5m: number
  tokens5m: number
  errors: number
  p95LatencyMs: number | null
  lastCallAt: string | null
  grade: RuntimeGrade
}

export interface AiModelTelemetry {
  generatedAt: string
  windowMinutes: number
  realtimeMinutes: number
  totals: {
    calls: number
    tokens: number
    promptTokens: number
    completionTokens: number
    errors: number
    errorRate: number | null
    avgLatencyMs: number | null
    p95LatencyMs: number | null
    activeConfigs: number
    unattributedCalls: number
    unattributedTokens: number
    attributedRate: number | null
    grade: RuntimeGrade
  }
  realtime: {
    calls: number
    tokens: number
    qps: number
    tps: number
  }
  series: TelemetrySeriesPoint[]
  byConfig: Record<string, ConfigTelemetry>
}

/** 窗口起点 = 分钟对齐的 now 往前 (minutes - 1) 分钟,保证恰好 minutes 个桶。 */
export function alignWindowStart(nowMs: number, minutes: number): number {
  return Math.floor(nowMs / MINUTE_MS) * MINUTE_MS - (minutes - 1) * MINUTE_MS
}

/** 把 SQL 的分钟桶铺成连续序列:缺桶补 0,越界桶丢弃(不把窗口外读数画进来)。 */
export function fillMinuteSeries(
  rows: Array<{ bucket: number; calls: number; tokens: number }>,
  nowMs: number,
  minutes: number,
): TelemetrySeriesPoint[] {
  const start = alignWindowStart(nowMs, minutes)
  const points: TelemetrySeriesPoint[] = Array.from({ length: minutes }, (_, i) => ({
    t: start + i * MINUTE_MS,
    calls: 0,
    tokens: 0,
  }))
  for (const row of rows) {
    const bucketMs = toSafeCount(row.bucket) * 1000
    const idx = Math.round((bucketMs - start) / MINUTE_MS)
    if (idx < 0 || idx >= points.length) continue
    const point = points[idx]!
    point.calls += toSafeCount(row.calls)
    point.tokens += toSafeCount(row.tokens)
  }
  return points
}

/** 速率统一两位小数;窗口非法时回 0(调用方不会传 0)。 */
export function perSecond(amount: number, minutes: number): number {
  const seconds = minutes * 60
  if (seconds <= 0) return 0
  return Number((toSafeCount(amount) / seconds).toFixed(2))
}

/** 占比统一四位小数(前端按百分比展示);分母为 0 时回 null(未判定,不是 0%)。 */
export function ratio(part: number, whole: number): number | null {
  if (whole <= 0) return null
  return Number((toSafeCount(part) / toSafeCount(whole)).toFixed(4))
}

/** 错误率分项:阈值来自常见 99.5%/99%/98%/95% 可用性档位,不是"感觉"。 */
export function scoreErrorRate(rate: number | null): number | null {
  if (rate === null) return null
  if (rate <= 0.005) return 100
  if (rate <= 0.01) return 90
  if (rate <= 0.02) return 78
  if (rate <= 0.05) return 60
  if (rate <= 0.1) return 30
  return 0
}

/** 端到端 P95 分项:比 TTFT 宽,因为本表 latency_ms 含完整生成耗时。 */
export function scoreP95Latency(ms: number | null): number | null {
  if (ms === null) return null
  if (ms <= 3_000) return 100
  if (ms <= 8_000) return 88
  if (ms <= 15_000) return 70
  if (ms <= 30_000) return 40
  return 10
}

/** 综合分取两项较低分:任一维度掉档,整体就不该被另一维度拉高。 */
export function gradeRuntime(input: {
  calls: number
  errors: number
  p95LatencyMs: number | null
}): RuntimeGrade {
  const sample = toSafeCount(input.calls)
  if (sample < RUNTIME_GRADE_MIN_SAMPLE || input.p95LatencyMs === null) {
    return { tier: 'insufficient', score: null, sample }
  }
  const errorScore = scoreErrorRate(ratio(input.errors, sample))
  const latencyScore = scoreP95Latency(input.p95LatencyMs)
  if (errorScore === null || latencyScore === null) {
    return { tier: 'insufficient', score: null, sample }
  }
  const score = Math.round(Math.min(errorScore, latencyScore))
  const tier: RuntimeGradeTier =
    score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 60 ? 'fair' : 'poor'
  return { tier, score, sample }
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function round1(value: number | null): number | null {
  return value === null ? null : Number(value.toFixed(1))
}

function round0(value: number | null): number | null {
  return value === null ? null : Math.round(value)
}

function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export async function collectAiModelTelemetry(now: Date = new Date()): Promise<AiModelTelemetry> {
  const nowMs = now.getTime()
  const windowStart = new Date(alignWindowStart(nowMs, TELEMETRY_WINDOW_MINUTES))
  const realtimeStart = new Date(nowMs - TELEMETRY_REALTIME_MINUTES * MINUTE_MS)

  // 管理端"测试连通"流水(metadata.isTestCall=true)是人工探测,不是真实负载:
  // 计入 QPS/错误率会把一次手动失败算成模型运行质量,故统计口径统一排除。
  const nonTestCall = sql`(${llmCallLogs.metadata} ->> 'isTestCall') is distinct from 'true'`
  const windowWhere = and(
    gte(llmCallLogs.createdAt, windowStart),
    lte(llmCallLogs.createdAt, now),
    nonTestCall,
  )
  const realtimeWhere = and(
    gte(llmCallLogs.createdAt, realtimeStart),
    lte(llmCallLogs.createdAt, now),
    nonTestCall,
  )

  const [totalRows, configRows, realtimeRows, realtimeConfigRows, seriesRows] = await Promise.all([
    dbRead
      .select({
        calls: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint`,
        promptTokens: sql<number>`coalesce(sum(${llmCallLogs.promptTokens}), 0)::bigint`,
        completionTokens: sql<number>`coalesce(sum(${llmCallLogs.completionTokens}), 0)::bigint`,
        errors: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'error')::int`,
        avgLatencyMs: sql<
          number | null
        >`avg(${llmCallLogs.latencyMs}) filter (where ${llmCallLogs.latencyMs} > 0)`,
        p95LatencyMs: sql<
          number | null
        >`percentile_cont(0.95) within group (order by ${llmCallLogs.latencyMs}) filter (where ${llmCallLogs.latencyMs} > 0)`,
        unattributedCalls: sql<number>`count(*) filter (where ${llmCallLogs.configId} is null or ${llmCallLogs.configId} <= 0)::int`,
        unattributedTokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}) filter (where ${llmCallLogs.configId} is null or ${llmCallLogs.configId} <= 0), 0)::bigint`,
      })
      .from(llmCallLogs)
      .where(windowWhere),
    dbRead
      .select({
        configId: llmCallLogs.configId,
        calls: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint`,
        errors: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'error')::int`,
        p95LatencyMs: sql<
          number | null
        >`percentile_cont(0.95) within group (order by ${llmCallLogs.latencyMs}) filter (where ${llmCallLogs.latencyMs} > 0)`,
        lastCallAt: sql<Date | string | null>`max(${llmCallLogs.createdAt})`,
      })
      .from(llmCallLogs)
      .where(and(windowWhere, sql`${llmCallLogs.configId} > 0`))
      .groupBy(llmCallLogs.configId),
    dbRead
      .select({
        calls: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint`,
      })
      .from(llmCallLogs)
      .where(realtimeWhere),
    dbRead
      .select({
        configId: llmCallLogs.configId,
        calls: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint`,
      })
      .from(llmCallLogs)
      .where(and(realtimeWhere, sql`${llmCallLogs.configId} > 0`))
      .groupBy(llmCallLogs.configId),
    dbRead
      .select({
        bucket: sql<number>`(extract(epoch from date_trunc('minute', ${llmCallLogs.createdAt}))::bigint)`,
        calls: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint`,
      })
      .from(llmCallLogs)
      .where(windowWhere)
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ])

  const total = totalRows[0]
  const calls = toSafeCount(total?.calls)
  const tokens = toSafeCount(total?.tokens)
  const promptTokens = toSafeCount(total?.promptTokens)
  const completionTokens = toSafeCount(total?.completionTokens)
  const errors = toSafeCount(total?.errors)
  const unattributedCalls = toSafeCount(total?.unattributedCalls)
  const unattributedTokens = toSafeCount(total?.unattributedTokens)

  const byConfig: Record<string, ConfigTelemetry> = {}
  for (const row of configRows) {
    const id = toSafeCount(row.configId)
    if (id <= 0) continue
    const calls = toSafeCount(row.calls)
    const errors = toSafeCount(row.errors)
    const p95LatencyMs = round0(toNullableNumber(row.p95LatencyMs))
    byConfig[String(id)] = {
      calls,
      tokens: toSafeCount(row.tokens),
      calls5m: 0,
      tokens5m: 0,
      errors,
      p95LatencyMs,
      lastCallAt: toIso(row.lastCallAt),
      grade: gradeRuntime({ calls, errors, p95LatencyMs }),
    }
  }
  for (const row of realtimeConfigRows) {
    const id = toSafeCount(row.configId)
    if (id <= 0) continue
    const entry = (byConfig[String(id)] ??= {
      calls: 0,
      tokens: 0,
      calls5m: 0,
      tokens5m: 0,
      errors: 0,
      p95LatencyMs: null,
      lastCallAt: null,
      grade: gradeRuntime({ calls: 0, errors: 0, p95LatencyMs: null }),
    })
    entry.calls5m = toSafeCount(row.calls)
    entry.tokens5m = toSafeCount(row.tokens)
  }

  const realtime = realtimeRows[0]
  const realtimeCalls = toSafeCount(realtime?.calls)
  const realtimeTokens = toSafeCount(realtime?.tokens)
  const p95LatencyMs = round0(toNullableNumber(total?.p95LatencyMs))

  return {
    generatedAt: now.toISOString(),
    windowMinutes: TELEMETRY_WINDOW_MINUTES,
    realtimeMinutes: TELEMETRY_REALTIME_MINUTES,
    totals: {
      calls,
      tokens,
      promptTokens,
      completionTokens,
      errors,
      errorRate: ratio(errors, calls),
      avgLatencyMs: round1(toNullableNumber(total?.avgLatencyMs)),
      p95LatencyMs,
      activeConfigs: Object.keys(byConfig).length,
      unattributedCalls,
      unattributedTokens,
      attributedRate: ratio(calls - unattributedCalls, calls),
      grade: gradeRuntime({ calls, errors, p95LatencyMs }),
    },
    realtime: {
      calls: realtimeCalls,
      tokens: realtimeTokens,
      qps: perSecond(realtimeCalls, TELEMETRY_REALTIME_MINUTES),
      tps: perSecond(realtimeTokens, TELEMETRY_REALTIME_MINUTES),
    },
    series: fillMinuteSeries(
      seriesRows.map((row) => ({
        bucket: toSafeCount(row.bucket),
        calls: toSafeCount(row.calls),
        tokens: toSafeCount(row.tokens),
      })),
      nowMs,
      TELEMETRY_WINDOW_MINUTES,
    ),
    byConfig,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
