// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 大模型配置运行遥测 v2(2026-11-27 深化版)。
 *
 * v1 只给配置级 1h 快照。v2 补上管理面真正需要的维度:
 * - 时间窗可切换 1h / 24h / 7d,长尾模型不再因为 1h 样本不足永远不可评级;
 * - 配置级 + 模型级双层聚合,可展开看出是哪个模型在拖后腿;
 * - TTFT 与完成 P95 分开,避免长输出模型被生成耗时误伤;
 * - 错误分类(鉴权/限流/5xx/超时/客户端/其他)与 retryable 计数;
 * - cost_cents 聚合与成本覆盖率,缺价不冒充 0;
 * - 10 秒进程内缓存,避免多个管理员同时打开时反复扫 llm_call_logs。
 */
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { aiModelConfig, aiModelConfigModels, llmCallLogs } from '@ihui/database'
import { dbRead } from '../db/index.js'
import { toSafeCount } from '../utils/safe-count.js'
import { redactCredentialText } from '../utils/redact-credential-text.js'
import { gradeRuntime, perSecond, ratio, type RuntimeGrade } from './ai-model-telemetry.js'

export type TelemetryWindow = '1h' | '24h' | '7d'

export const TELEMETRY_WINDOWS: Record<
  TelemetryWindow,
  { minutes: number; bucketSeconds: number; label: string }
> = {
  '1h': { minutes: 60, bucketSeconds: 60, label: '1h' },
  '24h': { minutes: 1_440, bucketSeconds: 300, label: '24h' },
  '7d': { minutes: 10_080, bucketSeconds: 3_600, label: '7d' },
}

export const TELEMETRY_REALTIME_MINUTES_V2 = 5
const CACHE_TTL_MS = 10_000
const MAX_SERIES_POINTS = 400

/**
 * 把调用流水里的 actualModel 归一化到配置模型 ID。
 * 只剥离与当前配置 provider_code 一致的首段,例如 agnes + "agnes/agnes-3.0-flash"
 * -> "agnes-3.0-flash"; provider 不同或没有斜杠时原样返回,避免误伤真实模型名。
 */
export function normalizeTelemetryModelName(raw: unknown, providerCode: string): string {
  const model = String(raw ?? '').trim()
  const provider = String(providerCode ?? '').trim()
  if (!provider) return model
  const prefix = `${provider.toLowerCase()}/`
  return model.toLowerCase().startsWith(prefix) ? model.slice(prefix.length) : model
}

/**
 * 调用明细会原样展示上游错误信息,而该端点已豁免整端点响应脱敏。
 * 错误串里可能夹带 Authorization / URL userinfo / sk- 前缀密钥,必须先脱敏再截断;
 * 保留前 2000 字符足以排障,又避免把超长上游响应整段回给管理端。
 */
export function sanitizeTelemetryErrorMessage(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  const text = String(raw).trim()
  if (!text) return null
  return redactCredentialText(text).slice(0, 2000)
}

export interface ErrorBreakdown {
  auth: number
  rateLimit: number
  server: number
  timeout: number
  client: number
  other: number
}

export interface TelemetrySeriesPointV2 {
  t: number
  calls: number
  tokens: number
  errors: number
}

export interface ModelTelemetryV2 {
  model: string
  displayName: string | null
  configured: boolean
  enabled: boolean
  isRelayPublic: boolean
  calls: number
  tokens: number
  errors: number
  errorRate: number | null
  p95LatencyMs: number | null
  ttftP95Ms: number | null
  costCents: number
  pricedCalls: number
  lastCallAt: string | null
  grade: RuntimeGrade
}

export interface ConfigTelemetryV2 {
  calls: number
  tokens: number
  calls5m: number
  tokens5m: number
  errors: number
  errorRate: number | null
  p95LatencyMs: number | null
  ttftP95Ms: number | null
  costCents: number
  pricedCalls: number
  retryableErrors: number
  errorBreakdown: ErrorBreakdown
  lastCallAt: string | null
  grade: RuntimeGrade
}

export interface AiModelTelemetryV2 {
  generatedAt: string
  window: TelemetryWindow
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
    ttftP95Ms: number | null
    costCents: number
    pricedCalls: number
    costCoverage: number | null
    retryableErrors: number
    errorBreakdown: ErrorBreakdown
    activeConfigs: number
    unattributedCalls: number
    unattributedTokens: number
    attributedRate: number | null
    byTier: Record<string, number>
    grade: RuntimeGrade
  }
  realtime: {
    calls: number
    tokens: number
    qps: number
    tps: number
  }
  series: TelemetrySeriesPointV2[]
  byConfig: Record<string, ConfigTelemetryV2>
}

export interface AiModelModelsTelemetryV2 {
  generatedAt: string
  window: TelemetryWindow
  windowMinutes: number
  configId: number
  models: ModelTelemetryV2[]
}

export interface RecentAiModelCall {
  id: string
  createdAt: string
  model: string
  providerCode: string | null
  status: string
  httpStatus: number | null
  latencyMs: number
  ttftMs: number | null
  totalTokens: number
  costCents: number | null
  retryable: number
  errorMessage: string | null
  traceId: string | null
}

export function resolveTelemetryWindow(value: unknown): TelemetryWindow {
  return value === '24h' || value === '7d' ? value : '1h'
}

/** 窗口起点按桶对齐;桶数固定,避免图表因当前时刻产生空桶抖动。 */
export function alignTelemetryBucketStart(
  nowMs: number,
  bucketSeconds: number,
  bucketCount: number,
): number {
  const bucketMs = bucketSeconds * 1_000
  return Math.floor(nowMs / bucketMs) * bucketMs - (bucketCount - 1) * bucketMs
}

export function telemetryBucketCount(minutes: number, bucketSeconds: number): number {
  if (
    !Number.isFinite(minutes) ||
    !Number.isFinite(bucketSeconds) ||
    minutes <= 0 ||
    bucketSeconds <= 0
  ) {
    return 0
  }
  return Math.min(MAX_SERIES_POINTS, Math.max(1, Math.ceil((minutes * 60) / bucketSeconds)))
}

/** 把 SQL 的秒级桶铺成连续序列;缺桶补 0,窗口外丢弃。 */
export function fillTelemetrySeries(
  rows: Array<{ bucket: number; calls: number; tokens: number; errors: number }>,
  nowMs: number,
  minutes: number,
  bucketSeconds: number,
): TelemetrySeriesPointV2[] {
  const count = telemetryBucketCount(minutes, bucketSeconds)
  const start = alignTelemetryBucketStart(nowMs, bucketSeconds, count)
  const points: TelemetrySeriesPointV2[] = Array.from({ length: count }, (_, i) => ({
    t: start + i * bucketSeconds * 1_000,
    calls: 0,
    tokens: 0,
    errors: 0,
  }))
  for (const row of rows) {
    const bucketMs = toSafeCount(row.bucket) * 1_000
    const idx = Math.round((bucketMs - start) / (bucketSeconds * 1_000))
    if (idx < 0 || idx >= points.length) continue
    const point = points[idx]!
    point.calls += toSafeCount(row.calls)
    point.tokens += toSafeCount(row.tokens)
    point.errors += toSafeCount(row.errors)
  }
  return points
}

function round0(value: number | null): number | null {
  return value === null ? null : Math.round(value)
}

function round1(value: number | null): number | null {
  return value === null ? null : Number(value.toFixed(1))
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function asBreakdown(row: {
  authErrors?: unknown
  rateLimitErrors?: unknown
  serverErrors?: unknown
  timeoutErrors?: unknown
  clientErrors?: unknown
  errors?: unknown
}): ErrorBreakdown {
  const auth = toSafeCount(row.authErrors)
  const rateLimit = toSafeCount(row.rateLimitErrors)
  const server = toSafeCount(row.serverErrors)
  const timeout = toSafeCount(row.timeoutErrors)
  const client = toSafeCount(row.clientErrors)
  const total = toSafeCount(row.errors)
  return {
    auth,
    rateLimit,
    server,
    timeout,
    client,
    other: Math.max(0, total - auth - rateLimit - server - timeout - client),
  }
}

type TelemetryCacheEntry = { expiresAt: number; data: AiModelTelemetryV2 }
const telemetryCache = new Map<TelemetryWindow, TelemetryCacheEntry>()

const errorCondition = sql`${llmCallLogs.status} = 'error'`
const nonTestCall = sql`(${llmCallLogs.metadata} ->> 'isTestCall') is distinct from 'true'`
const timeoutCondition = sql`(
  ${llmCallLogs.httpStatus} = 504
  or coalesce(${llmCallLogs.errorMessage}, '') ilike '%timeout%'
  or coalesce(${llmCallLogs.errorMessage}, '') ilike '%timed out%'
  or coalesce(${llmCallLogs.errorMessage}, '') ilike '%超时%'
)`

const errorCounts = {
  errors: sql<number>`count(*) filter (where ${errorCondition})::int`,
  authErrors: sql<number>`count(*) filter (where ${llmCallLogs.httpStatus} in (401, 403))::int`,
  rateLimitErrors: sql<number>`count(*) filter (where ${llmCallLogs.httpStatus} = 429)::int`,
  serverErrors: sql<number>`count(*) filter (where ${llmCallLogs.httpStatus} >= 500)::int`,
  timeoutErrors: sql<number>`count(*) filter (where ${errorCondition} and ${timeoutCondition})::int`,
  clientErrors: sql<number>`count(*) filter (where ${llmCallLogs.httpStatus} between 400 and 499 and ${llmCallLogs.httpStatus} not in (401, 403, 429))::int`,
  retryableErrors: sql<number>`count(*) filter (where ${errorCondition} and ${llmCallLogs.retryable} = 1)::int`,
}

const latencyAgg = {
  p95LatencyMs: sql<
    number | null
  >`percentile_cont(0.95) within group (order by ${llmCallLogs.latencyMs}) filter (where ${llmCallLogs.latencyMs} > 0)`,
  ttftP95Ms: sql<
    number | null
  >`percentile_cont(0.95) within group (order by ${llmCallLogs.ttftMs}) filter (where ${llmCallLogs.ttftMs} > 0)`,
  avgLatencyMs: sql<
    number | null
  >`avg(${llmCallLogs.latencyMs}) filter (where ${llmCallLogs.latencyMs} > 0)`,
}

const costAgg = {
  costCents: sql<number>`coalesce(sum(${llmCallLogs.costCents}), 0)::float8`,
  pricedCalls: sql<number>`count(*) filter (where ${llmCallLogs.costCents} is not null)::int`,
}

function windowRange(window: TelemetryWindow, now: Date) {
  const cfg = TELEMETRY_WINDOWS[window]
  const bucketCount = telemetryBucketCount(cfg.minutes, cfg.bucketSeconds)
  const startMs = alignTelemetryBucketStart(now.getTime(), cfg.bucketSeconds, bucketCount)
  return {
    cfg,
    bucketCount,
    start: new Date(startMs),
    realtimeStart: new Date(now.getTime() - TELEMETRY_REALTIME_MINUTES_V2 * 60_000),
  }
}

export async function collectAiModelTelemetryV2(
  window: TelemetryWindow = '1h',
  now: Date = new Date(),
  useCache = true,
): Promise<AiModelTelemetryV2> {
  const cached = telemetryCache.get(window)
  if (useCache && cached && cached.expiresAt > Date.now()) return cached.data

  const range = windowRange(window, now)
  const windowWhere = and(
    gte(llmCallLogs.createdAt, range.start),
    lte(llmCallLogs.createdAt, now),
    nonTestCall,
  )
  const realtimeWhere = and(
    gte(llmCallLogs.createdAt, range.realtimeStart),
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
        ...errorCounts,
        ...latencyAgg,
        ...costAgg,
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
        ...errorCounts,
        ...latencyAgg,
        ...costAgg,
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
        bucket: sql<number>`floor(extract(epoch from ${llmCallLogs.createdAt}) / ${range.cfg.bucketSeconds})::bigint`,
        calls: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint`,
        errors: sql<number>`count(*) filter (where ${errorCondition})::int`,
      })
      .from(llmCallLogs)
      .where(windowWhere)
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ])

  const total = totalRows[0]
  const calls = toSafeCount(total?.calls)
  const errors = toSafeCount(total?.errors)
  const tokens = toSafeCount(total?.tokens)
  const byConfig: Record<string, ConfigTelemetryV2> = {}
  for (const row of configRows) {
    const id = toSafeCount(row.configId)
    if (id <= 0) continue
    const rowCalls = toSafeCount(row.calls)
    const rowErrors = toSafeCount(row.errors)
    const p95LatencyMs = round0(toNullableNumber(row.p95LatencyMs))
    byConfig[String(id)] = {
      calls: rowCalls,
      tokens: toSafeCount(row.tokens),
      calls5m: 0,
      tokens5m: 0,
      errors: rowErrors,
      errorRate: ratio(rowErrors, rowCalls),
      p95LatencyMs,
      ttftP95Ms: round0(toNullableNumber(row.ttftP95Ms)),
      costCents: round1(toNullableNumber(row.costCents)) ?? 0,
      pricedCalls: toSafeCount(row.pricedCalls),
      retryableErrors: toSafeCount(row.retryableErrors),
      errorBreakdown: asBreakdown(row),
      lastCallAt: toIso(row.lastCallAt),
      grade: gradeRuntime({ calls: rowCalls, errors: rowErrors, p95LatencyMs }),
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
      errorRate: null,
      p95LatencyMs: null,
      ttftP95Ms: null,
      costCents: 0,
      pricedCalls: 0,
      retryableErrors: 0,
      errorBreakdown: { auth: 0, rateLimit: 0, server: 0, timeout: 0, client: 0, other: 0 },
      lastCallAt: null,
      grade: gradeRuntime({ calls: 0, errors: 0, p95LatencyMs: null }),
    })
    entry.calls5m = toSafeCount(row.calls)
    entry.tokens5m = toSafeCount(row.tokens)
  }

  const byTier: Record<string, number> = {
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
    insufficient: 0,
  }
  for (const entry of Object.values(byConfig)) {
    byTier[entry.grade.tier] = (byTier[entry.grade.tier] ?? 0) + 1
  }

  const breakdown = asBreakdown(total ?? {})
  const totalPriced = toSafeCount(total?.pricedCalls)
  const totalP95LatencyMs = round0(toNullableNumber(total?.p95LatencyMs))
  const data: AiModelTelemetryV2 = {
    generatedAt: now.toISOString(),
    window,
    windowMinutes: range.cfg.minutes,
    realtimeMinutes: TELEMETRY_REALTIME_MINUTES_V2,
    totals: {
      calls,
      tokens,
      promptTokens: toSafeCount(total?.promptTokens),
      completionTokens: toSafeCount(total?.completionTokens),
      errors,
      errorRate: ratio(errors, calls),
      avgLatencyMs: toNullableNumber(total?.avgLatencyMs),
      p95LatencyMs: round0(toNullableNumber(total?.p95LatencyMs)),
      ttftP95Ms: round0(toNullableNumber(total?.ttftP95Ms)),
      costCents: round1(toNullableNumber(total?.costCents)) ?? 0,
      pricedCalls: totalPriced,
      costCoverage: ratio(totalPriced, calls),
      retryableErrors: toSafeCount(total?.retryableErrors),
      errorBreakdown: breakdown,
      activeConfigs: Object.keys(byConfig).length,
      unattributedCalls: toSafeCount(total?.unattributedCalls),
      unattributedTokens: toSafeCount(total?.unattributedTokens),
      attributedRate:
        calls > 0 ? ratio(calls - toSafeCount(total?.unattributedCalls), calls) : null,
      byTier,
      grade: gradeRuntime({ calls, errors, p95LatencyMs: totalP95LatencyMs }),
    },
    realtime: {
      calls: toSafeCount(realtimeRows[0]?.calls),
      tokens: toSafeCount(realtimeRows[0]?.tokens),
      qps: perSecond(toSafeCount(realtimeRows[0]?.calls), TELEMETRY_REALTIME_MINUTES_V2),
      tps: perSecond(toSafeCount(realtimeRows[0]?.tokens), TELEMETRY_REALTIME_MINUTES_V2),
    },
    series: fillTelemetrySeries(
      seriesRows.map((row) => ({
        bucket: toSafeCount(row.bucket),
        calls: toSafeCount(row.calls),
        tokens: toSafeCount(row.tokens),
        errors: toSafeCount(row.errors),
      })),
      now.getTime(),
      range.cfg.minutes,
      range.cfg.bucketSeconds,
    ),
    byConfig,
  }

  telemetryCache.set(window, { data, expiresAt: Date.now() + CACHE_TTL_MS })
  return data
}

export async function collectAiModelModelsTelemetryV2(
  configId: number,
  window: TelemetryWindow = '1h',
  now: Date = new Date(),
): Promise<AiModelModelsTelemetryV2> {
  const range = windowRange(window, now)
  const where = and(
    gte(llmCallLogs.createdAt, range.start),
    lte(llmCallLogs.createdAt, now),
    eq(llmCallLogs.configId, configId),
    nonTestCall,
  )
  const rows = await dbRead
    .select({
      model: llmCallLogs.model,
      calls: sql<number>`count(*)::int`,
      tokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint`,
      ...errorCounts,
      ...latencyAgg,
      ...costAgg,
      lastCallAt: sql<Date | string | null>`max(${llmCallLogs.createdAt})`,
    })
    .from(llmCallLogs)
    .where(where)
    .groupBy(llmCallLogs.model)
    .orderBy(desc(sql`count(*)`))

  const configMetaRows = await dbRead
    .select({ providerCode: aiModelConfig.providerCode })
    .from(aiModelConfig)
    .where(eq(aiModelConfig.id, configId))
    .limit(1)
  const providerCode = String(configMetaRows[0]?.providerCode ?? '').trim()
  // llm_call_logs.actualModel 常见形如 "agnes/agnes-3.0-flash" / "openai/gpt-4o",
  // 而 ai_model_config_models.model_id 只存裸模型名。若直接按字符串匹配,
  // 抽屉会显示"调用 16 次但每个模型都未调用"(8890 真机已复现)。
  // 只剥掉与当前配置 provider_code 完全一致的首段,避免误伤 qwen/qwen3 这类真实斜杠模型。
  const normalizeModel = (raw: unknown): string => normalizeTelemetryModelName(raw, providerCode)

  // 模型行可能一个调用都没有。只查日志会让"已配置但未跑过"的模型从抽屉里消失,
  // 因此把配置的模型行作为左表,日志聚合作为右表;日志里多出来的别名保留在末尾。
  const configuredRows = await dbRead
    .select({
      modelId: aiModelConfigModels.modelId,
      displayName: aiModelConfigModels.displayName,
      enabled: aiModelConfigModels.enabled,
      isRelayPublic: aiModelConfigModels.isRelayPublic,
    })
    .from(aiModelConfigModels)
    .where(eq(aiModelConfigModels.configId, configId))
    .orderBy(aiModelConfigModels.sortOrder)

  const logByModel = new Map<string, (typeof rows)[number]>()
  for (const row of rows) {
    const key = normalizeModel(row.model)
    const previous = logByModel.get(key)
    if (!previous) {
      logByModel.set(key, row)
      continue
    }
    const previousLast = previous.lastCallAt ? new Date(previous.lastCallAt).getTime() : 0
    const currentLast = row.lastCallAt ? new Date(row.lastCallAt).getTime() : 0
    logByModel.set(key, {
      ...previous,
      calls: toSafeCount(previous.calls) + toSafeCount(row.calls),
      tokens: toSafeCount(previous.tokens) + toSafeCount(row.tokens),
      errors: toSafeCount(previous.errors) + toSafeCount(row.errors),
      pricedCalls: toSafeCount(previous.pricedCalls) + toSafeCount(row.pricedCalls),
      costCents: (toNullableNumber(previous.costCents) ?? 0) + (toNullableNumber(row.costCents) ?? 0),
      p95LatencyMs: Math.max(
        toNullableNumber(previous.p95LatencyMs) ?? 0,
        toNullableNumber(row.p95LatencyMs) ?? 0,
      ),
      ttftP95Ms: Math.max(
        toNullableNumber(previous.ttftP95Ms) ?? 0,
        toNullableNumber(row.ttftP95Ms) ?? 0,
      ),
      lastCallAt: currentLast > previousLast ? row.lastCallAt : previous.lastCallAt,
    })
  }
  const consumed = new Set<string>()
  const models: ModelTelemetryV2[] = configuredRows.map((row) => {
    const model = String(row.modelId)
    const attributionKey = normalizeModel(model)
    consumed.add(attributionKey)
    const log = logByModel.get(attributionKey)
    const calls = toSafeCount(log?.calls)
    const errors = toSafeCount(log?.errors)
    const p95LatencyMs = round0(toNullableNumber(log?.p95LatencyMs))
    return {
      model,
      displayName: row.displayName ?? null,
      configured: true,
      enabled: row.enabled === true,
      isRelayPublic: row.isRelayPublic === true,
      calls,
      tokens: toSafeCount(log?.tokens),
      errors,
      errorRate: ratio(errors, calls),
      p95LatencyMs,
      ttftP95Ms: round0(toNullableNumber(log?.ttftP95Ms)),
      costCents: round1(toNullableNumber(log?.costCents)) ?? 0,
      pricedCalls: toSafeCount(log?.pricedCalls),
      lastCallAt: toIso(log?.lastCallAt),
      grade: gradeRuntime({ calls, errors, p95LatencyMs }),
    }
  })

  for (const row of rows) {
    const model = String(row.model)
    if (consumed.has(normalizeModel(model))) continue
    const calls = toSafeCount(row.calls)
    const errors = toSafeCount(row.errors)
    const p95LatencyMs = round0(toNullableNumber(row.p95LatencyMs))
    models.push({
      model,
      displayName: null,
      configured: false,
      enabled: true,
      isRelayPublic: false,
      calls,
      tokens: toSafeCount(row.tokens),
      errors,
      errorRate: ratio(errors, calls),
      p95LatencyMs,
      ttftP95Ms: round0(toNullableNumber(row.ttftP95Ms)),
      costCents: round1(toNullableNumber(row.costCents)) ?? 0,
      pricedCalls: toSafeCount(row.pricedCalls),
      lastCallAt: toIso(row.lastCallAt),
      grade: gradeRuntime({ calls, errors, p95LatencyMs }),
    })
  }

  return {
    generatedAt: now.toISOString(),
    window,
    windowMinutes: range.cfg.minutes,
    configId,
    models,
  }
}

export async function collectRecentAiModelCalls(
  configId: number,
  model: string | null,
  window: TelemetryWindow = '1h',
  limit = 20,
): Promise<RecentAiModelCall[]> {
  const now = new Date()
  const range = windowRange(window, now)
  const where = and(
    gte(llmCallLogs.createdAt, range.start),
    lte(llmCallLogs.createdAt, now),
    eq(llmCallLogs.configId, configId),
    nonTestCall,
    model ? eq(llmCallLogs.model, model) : undefined,
  )
  const rows = await dbRead
    .select({
      id: llmCallLogs.id,
      createdAt: llmCallLogs.createdAt,
      model: llmCallLogs.model,
      providerCode: llmCallLogs.providerCode,
      status: llmCallLogs.status,
      httpStatus: llmCallLogs.httpStatus,
      latencyMs: llmCallLogs.latencyMs,
      ttftMs: llmCallLogs.ttftMs,
      totalTokens: llmCallLogs.totalTokens,
      costCents: llmCallLogs.costCents,
      retryable: llmCallLogs.retryable,
      errorMessage: llmCallLogs.errorMessage,
      traceId: llmCallLogs.traceId,
    })
    .from(llmCallLogs)
    .where(where)
    .orderBy(desc(llmCallLogs.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100))

  return rows.map((row) => ({
    id: row.id,
    createdAt: toIso(row.createdAt) ?? '',
    model: row.model,
    providerCode: row.providerCode,
    status: row.status,
    httpStatus: row.httpStatus,
    latencyMs: toSafeCount(row.latencyMs),
    ttftMs: row.ttftMs === null ? null : toSafeCount(row.ttftMs),
    totalTokens: toSafeCount(row.totalTokens),
    costCents: toNullableNumber(row.costCents),
    retryable: toSafeCount(row.retryable),
    errorMessage: sanitizeTelemetryErrorMessage(row.errorMessage),
    traceId: row.traceId,
  }))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
