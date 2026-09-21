// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/developer/relay/usage/analytics — 中转站用量重度分析(对标 Sub2API UsageAnalytics,2026-09-16 立)。
 *
 * 端点清单:
 * 1. GET /developer/relay/usage/analytics — 多维聚合(成本/Token/缓存/延迟/端点/日趋势/模型)
 * 2. GET /developer/relay/usage/export    — 明细导出(CSV,上限 10000 行)
 *
 * 全部强制 userId = 当前用户(用户只能看自己的用量)。复用 llm_call_logs + ai_pricing。
 * 成本口径:
 *  - actualCents:实付成本 = sum(llm_call_logs.cost_cents)
 *  - standardCents:官方标准价口径 = 用 ai_pricing 现价(input/output 分每千 token)回算
 *    input+output;任一模型无 token 模式定价则整体为 null。
 * 延迟口径:latencyMs(总延迟)。llm_call_logs 有 ttft_ms(首 token 延迟,仅流式),
 *  本端点延迟卡统一用总延迟 latencyMs 聚合(p50/p95 用 percentile_cont)。
 * 端点维度:llm_call_logs 无端点列,用 call_type(模型维度另见 models 分解)替代。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, eq, gte, lte, sql, desc, inArray, or, isNull, type SQL } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { llmCallLogs, aiPricing } from '@ihui/database'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { requireAuth } from '../plugins/require-permission.js'

/** roundCents 语义:汇总后在 JS 侧 Math.round(x*1e6)/1e6,避免浮点累加漂移。 */
const roundCents = (x: number): number => Math.round(x * 1e6) / 1e6
const toNum = (x: unknown): number => Number(x ?? 0)

const analyticsQuerySchema = z.object({
  /** 起始日期 YYYY-MM-DD(默认近 30 天) */
  startDate: z.transform(emptyToUndefined).pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
  /** 结束日期 YYYY-MM-DD(含当天 23:59:59.999) */
  endDate: z.transform(emptyToUndefined).pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
  /** API Key 筛选(仅当前用户名下的 Key) */
  apiKeyId: z.transform(emptyToUndefined).pipe(z.uuid().optional()),
  /** 模型精确筛选 */
  model: z.transform(emptyToUndefined).pipe(z.string().max(128).optional()),
})

const exportQuerySchema = analyticsQuerySchema.extend({
  /** 导出格式,目前仅支持 csv(xlsx 无依赖返回 400) */
  format: z.enum(['csv', 'xlsx']).default('csv'),
})

const EXPORT_MAX_ROWS = 10000

/** 构造强制 userId 隔离 + 可选筛选条件的 WHERE 子句。 */
function buildWhere(userId: string, parsed: z.infer<typeof analyticsQuerySchema>): SQL | undefined {
  const conds: SQL[] = [eq(llmCallLogs.userId, userId)]
  if (parsed.startDate) {
    conds.push(gte(llmCallLogs.createdAt, new Date(`${parsed.startDate}T00:00:00Z`)))
  } else {
    conds.push(gte(llmCallLogs.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
  }
  if (parsed.endDate) {
    conds.push(lte(llmCallLogs.createdAt, new Date(`${parsed.endDate}T23:59:59.999Z`)))
  }
  if (parsed.apiKeyId) conds.push(eq(llmCallLogs.apiKeyId, parsed.apiKeyId))
  if (parsed.model) conds.push(eq(llmCallLogs.model, parsed.model))
  return and(...conds)
}

/** 取各模型当前生效(token 模式)的 ai_pricing 现价,按 modelId 取最新一条。 */
async function fetchPricingMap(
  modelIds: string[],
): Promise<Map<string, { input: number; output: number; mode: string }>> {
  const map = new Map<string, { input: number; output: number; mode: string }>()
  if (modelIds.length === 0) return map
  const now = new Date()
  const rows = await dbRead
    .select({
      modelId: aiPricing.modelId,
      inputTokenPrice: aiPricing.inputTokenPrice,
      outputTokenPrice: aiPricing.outputTokenPrice,
      billingMode: aiPricing.billingMode,
      effectiveAt: aiPricing.effectiveAt,
    })
    .from(aiPricing)
    .where(
      and(
        inArray(aiPricing.modelId, modelIds),
        lte(aiPricing.effectiveAt, now),
        or(isNull(aiPricing.expiresAt), gte(aiPricing.expiresAt, now)),
      ),
    )
    .orderBy(desc(aiPricing.effectiveAt))
  for (const r of rows) {
    if (!map.has(r.modelId)) {
      map.set(r.modelId, {
        input: toNum(r.inputTokenPrice),
        output: toNum(r.outputTokenPrice),
        mode: r.billingMode ?? 'token',
      })
    }
  }
  return map
}

const usageAnalyticsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAuth)

  // ===== 1. GET /developer/relay/usage/analytics — 多维聚合 =====
  server.get('/developer/relay/usage/analytics', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const q = analyticsQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const where = buildWhere(userId, q.data)

    try {
      // --- 全量聚合 ---
      const [agg] = await dbRead
        .select({
          totalCalls: sql<number>`count(*)::int`,
          totalInput: sql<number>`coalesce(sum(${llmCallLogs.promptTokens}), 0)::bigint::int`,
          totalOutput: sql<number>`coalesce(sum(${llmCallLogs.completionTokens}), 0)::bigint::int`,
          cacheRead: sql<number>`coalesce(sum(${llmCallLogs.cacheReadTokens}), 0)::bigint::int`,
          cacheCreation: sql<number>`coalesce(sum(${llmCallLogs.cacheCreationTokens}), 0)::bigint::int`,
          totalTokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint::int`,
          actualCents: sql<number>`coalesce(sum(${llmCallLogs.costCents}), 0)::numeric`,
          avgLatency: sql<number>`coalesce(avg(${llmCallLogs.latencyMs}), 0)`,
          p50Latency: sql<number>`percentile_cont(0.5) within group (order by ${llmCallLogs.latencyMs})`,
          p95Latency: sql<number>`percentile_cont(0.95) within group (order by ${llmCallLogs.latencyMs})`,
        })
        .from(llmCallLogs)
        .where(where)

      const totalCalls = toNum(agg?.totalCalls)
      const totalInput = toNum(agg?.totalInput)
      const totalOutput = toNum(agg?.totalOutput)
      const cacheRead = toNum(agg?.cacheRead)
      const cacheCreation = toNum(agg?.cacheCreation)
      const totalTokens = toNum(agg?.totalTokens)
      const actualCents = roundCents(toNum(agg?.actualCents))
      const cacheHitRate = totalInput > 0 ? cacheRead / totalInput : 0

      // --- 按模型聚合(含 input/output 用于标准价回算)---
      const modelRows = await dbRead
        .select({
          model: llmCallLogs.model,
          calls: sql<number>`count(*)::int`,
          costCents: sql<number>`coalesce(sum(${llmCallLogs.costCents}), 0)::numeric`,
          tokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint::int`,
          inputTokens: sql<number>`coalesce(sum(${llmCallLogs.promptTokens}), 0)::bigint::int`,
          outputTokens: sql<number>`coalesce(sum(${llmCallLogs.completionTokens}), 0)::bigint::int`,
        })
        .from(llmCallLogs)
        .where(where)
        .groupBy(llmCallLogs.model)
        .orderBy(desc(sql`count(*)::int`))
        .limit(200)

      // --- 官方标准价回算 ---
      const pricingMap = await fetchPricingMap(modelRows.map((m) => m.model))
      let standardCents: number | null = 0
      for (const m of modelRows) {
        const p = pricingMap.get(m.model)
        if (!p || p.mode !== 'token') {
          standardCents = null
          break
        }
        const part = (p.input * m.inputTokens + p.output * m.outputTokens) / 1000
        standardCents = roundCents((standardCents ?? 0) + part)
      }

      // --- 端点维度(call_type 替代,llm_call_logs 无端点列)---
      const endpointCol = sql<string>`coalesce(${llmCallLogs.callType}, 'chat')`
      const endpoints = await dbRead
        .select({
          endpoint: endpointCol.as('endpoint'),
          calls: sql<number>`count(*)::int`,
          costCents: sql<number>`coalesce(sum(${llmCallLogs.costCents}), 0)::numeric`,
        })
        .from(llmCallLogs)
        .where(where)
        .groupBy(endpointCol)
        .orderBy(desc(sql`count(*)::int`))

      // --- 日趋势(Asia/Shanghai)---
      const dateCol = sql<string>`to_char(${llmCallLogs.createdAt} at time zone 'Asia/Shanghai', 'YYYY-MM-DD')`
      const daily = await dbRead
        .select({
          date: dateCol.as('date'),
          calls: sql<number>`count(*)::int`,
          costCents: sql<number>`coalesce(sum(${llmCallLogs.costCents}), 0)::numeric`,
          tokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint::int`,
        })
        .from(llmCallLogs)
        .where(where)
        .groupBy(dateCol)
        .orderBy(dateCol)
        .limit(366)

      // --- 模型分解(对外返回)---
      const models = modelRows.map((m) => ({
        model: m.model,
        calls: toNum(m.calls),
        costCents: roundCents(toNum(m.costCents)),
        tokens: toNum(m.tokens),
      }))

      return reply.send(
        success({
          cost: {
            totalCents: actualCents,
            standardCents,
            actualCents,
          },
          tokens: {
            input: totalInput,
            output: totalOutput,
            cacheRead,
            cacheCreation,
            total: totalTokens,
            cacheHitRate,
          },
          latency: {
            avgMs: Math.round(toNum(agg?.avgLatency)),
            p50Ms: Math.round(toNum(agg?.p50Latency)),
            p95Ms: Math.round(toNum(agg?.p95Latency)),
            count: totalCalls,
          },
          endpoints: endpoints.map((e) => ({
            endpoint: e.endpoint,
            calls: toNum(e.calls),
            costCents: roundCents(toNum(e.costCents)),
          })),
          daily: daily.map((d) => ({
            date: d.date,
            calls: toNum(d.calls),
            costCents: roundCents(toNum(d.costCents)),
            tokens: toNum(d.tokens),
          })),
          models,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询用量分析失败'))
    }
  })

  // ===== 2. GET /developer/relay/usage/export — 明细导出 =====
  server.get('/developer/relay/usage/export', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const q = exportQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { format } = q.data
    if (format !== 'csv') {
      return reply.status(400).send(error(400, '仅支持 csv'))
    }
    const where = buildWhere(userId, q.data)

    try {
      const dateCol = sql<string>`to_char(${llmCallLogs.createdAt} at time zone 'Asia/Shanghai', 'YYYY-MM-DD HH24:MI:SS')`
      // 取 EXPORT_MAX_ROWS+1,用于判断是否超出上限
      const rows = await dbRead
        .select({
          date: dateCol.as('date'),
          model: llmCallLogs.model,
          status: llmCallLogs.status,
          promptTokens: llmCallLogs.promptTokens,
          completionTokens: llmCallLogs.completionTokens,
          cacheReadTokens: llmCallLogs.cacheReadTokens,
          cacheCreationTokens: llmCallLogs.cacheCreationTokens,
          costCents: llmCallLogs.costCents,
          latencyMs: llmCallLogs.latencyMs,
        })
        .from(llmCallLogs)
        .where(where)
        .orderBy(desc(llmCallLogs.createdAt))
        .limit(EXPORT_MAX_ROWS + 1)

      if (rows.length > EXPORT_MAX_ROWS) {
        return reply
          .status(400)
          .send(error(400, '数据量过大,请缩小筛选范围(日期/模型/API Key)后导出'))
      }

      const esc = (v: unknown): string => {
        const s = v === null || v === undefined ? '' : String(v)
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }
      const head = ['日期', '模型', '状态', '输入', '输出', '缓存读', '缓存写', '成本分', '延迟ms']
      const lines = rows.map((r) =>
        [
          r.date,
          r.model,
          r.status,
          r.promptTokens,
          r.completionTokens,
          r.cacheReadTokens,
          r.cacheCreationTokens,
          r.costCents,
          r.latencyMs,
        ]
          .map(esc)
          .join(','),
      )
      const csv = '﻿' + [head.join(','), ...lines].join('\n')
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      reply.header('Content-Type', 'text/csv; charset=utf-8')
      reply.header('Content-Disposition', `attachment; filename="relay-usage-detail-${stamp}.csv"`)
      return reply.send(csv)
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '导出用量明细失败'))
    }
  })
}

export default usageAnalyticsRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
