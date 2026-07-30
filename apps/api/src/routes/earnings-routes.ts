/**
 * 挣钱中心仪表盘后端(P0 挣钱核心,2026-07-31 立)。
 *
 * 4 端点:
 *   GET /api/earnings/overview       — 今日收入/BYOK 抽成/引流数/付费转化率 + 同比昨天趋势
 *   GET /api/earnings/byok-trend     — 最近 N 天 BYOK 抽成收入趋势(每日聚合)
 *   GET /api/earnings/referral       — 各渠道引流数(free-model/publish/direct)
 *   GET /api/earnings/funnel         — 转化漏斗(register→active→byok→vip)
 *
 * 数据源(基于真实 schema,非任务描述猜测):
 *   - llm_call_logs.metadata JSONB(由 relay-billing-service.recordCall 写入):
 *       * metadata.byokMode=true   → BYOK 模式,平台抽成 = metadata.platformFeeCents(分)
 *       * metadata.byokMode IS NULL → 中转站模式,平台收入 = metadata.costCents(分)
 *   - users:created_at(引流)/ is_vip > 0(付费转化)
 *   - publish_accounts.user_id:平台发布渠道引流
 *
 * admin(roleId >= 1)看全平台,普通用户 403(简化:挣钱中心是运营看板)。
 * 金额单位:分→元(/100),趋势单位:%,保留 2 位小数。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'

import { dbRead } from '../db/index.js'
import { checkAuth } from '../plugins/auth.js'
import { success, error, parseOrThrow } from '../utils/response.js'

// =============================================================================
// 响应类型(精确,对齐前端 apps/web/src/hooks/use-earnings.ts)
// =============================================================================

export interface EarningsOverview {
  todayIncome: number
  todayIncomeTrend: number
  byokIncome: number
  byokIncomeTrend: number
  referralCount: number
  referralTrend: number
  conversionRate: number
  conversionTrend: number
}

export interface ByokIncomePoint {
  date: string
  amount: number
}

export type ReferralChannelCode = 'free-model' | 'publish' | 'direct'

export interface ReferralChannelStat {
  channel: ReferralChannelCode
  count: number
}

export type ConversionStageCode = 'register' | 'active' | 'byok' | 'vip'

export interface ConversionStageStat {
  stage: ConversionStageCode
  count: number
}

// =============================================================================
// 常量
// =============================================================================

/**
 * 免费 provider 前缀(与 relay-billing-service.FREE_PROVIDER_PREFIXES 对齐)。
 * 命中即视为"免费模型引流"渠道(用户调用过免费 provider 的 LLM)。
 */
const FREE_PROVIDER_PREFIXES = [
  'cloudflare/',
  '@cf/',
  'github/',
  'huggingface/',
  'pollinations/',
  'llm7/',
  'ovh/',
  'aihorde/',
  'reka/',
  'routeway/',
  'bazaarlink/',
  'ainative/',
  'opencode/',
  'vercel/',
  'modal/',
  'inferencenet/',
  'nlpcloud/',
  'scaleway/',
  'alibaba-intl/',
]

/**
 * 判断 model 名是否属于免费 provider(引流渠道判定)。
 * 大小写不敏感(对齐 relay-billing-service.isFreeProvider)。
 */
export function isFreeProviderModel(model: string): boolean {
  const m = model.toLowerCase()
  return FREE_PROVIDER_PREFIXES.some((p) => m.startsWith(p))
}

/**
 * 构建免费 provider 引流匹配的 WHERE SQL 片段(类型安全 + 自动参数化)。
 * 用 drizzle sql.join 拼接 `lower(model) LIKE $1 OR lower(model) LIKE $2 OR ...`,
 * 由 drizzle 自动参数化,防 SQL 注入。
 */
function buildFreeProviderWhereSql(): SQL {
  const conds: SQL[] = FREE_PROVIDER_PREFIXES.map((p) =>
    sql`lower(model) LIKE ${p.toLowerCase() + '%'}`,
  )
  return sql.join(conds, sql` OR `)
}

/** byok-trend query 校验(days 1-365,默认 30)。optional + ?? 30 避免 zod .default() 与 parseOrThrow 泛型推断冲突。 */
const ByokTrendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
})

/** 计算趋势百分比:(today - yesterday) / max(yesterday, 1) * 100,保留 1 位小数。
 *  yesterday = 0 时:today > 0 → 100%(新增),today = 0 → 0%。 */
function computeTrend(today: number, yesterday: number): number {
  if (yesterday <= 0) return today > 0 ? 100 : 0
  const pct = ((today - yesterday) / yesterday) * 100
  return Number(pct.toFixed(1))
}

/** 分 → 元(2 位小数)。空值/NULL 视为 0。 */
function centsToYuan(cents: unknown): number {
  const n = typeof cents === 'number' ? cents : Number(cents ?? 0)
  return Number((n / 100).toFixed(2))
}

/** admin 校验。roleId >= 1 视为 admin;失败时 reply 已发送响应,返回 false。 */
async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (!(await checkAuth(request, reply))) return false
  const roleId = (request as FastifyRequest & { jwtPayload?: { roleId?: number } }).jwtPayload
    ?.roleId
  // roleId >= 1 视为 admin(AGENTS.md §5:admin 路由 preHandler 校验 roleId >= 1)
  if (typeof roleId !== 'number' || roleId < 1) {
    reply.status(403).send(error(403, '需要管理员权限访问挣钱中心'))
    return false
  }
  return true
}

// =============================================================================
// Fastify plugin
// =============================================================================

export const earningsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // -------------------------------------------------------------------------
  // GET /overview — 今日收入概览 + 同比昨天趋势
  // -------------------------------------------------------------------------
  server.get('/overview', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    try {
      const today = new Date()
      const todayStart = new Date(today)
      todayStart.setHours(0, 0, 0, 0)
      const yesterdayStart = new Date(todayStart)
      yesterdayStart.setDate(yesterdayStart.getDate() - 1)
      const yesterdayEnd = todayStart // 昨天结束 = 今天开始

      // 并行查 4 个指标(今日 + 昨天各一次,共 8 个查询,但用 UNION ALL 合并成 2 个查询)
      // Q1: 今日 + 昨日 BYOK 抽成 + 中转站收入(分)
      // Q2: 今日 + 昨日 引流数 + 付费用户数 + 总用户数
      const [incomeRow] = await dbRead.execute<{
        today_byok: string | null
        today_relay: string | null
        yesterday_byok: string | null
        yesterday_relay: string | null
      }>(sql`
        SELECT
          COALESCE(SUM(CASE
            WHEN metadata->>'byokMode' = 'true'
              AND created_at >= ${todayStart}
            THEN (metadata->>'platformFeeCents')::numeric
            ELSE 0
          END), 0) AS today_byok,
          COALESCE(SUM(CASE
            WHEN (metadata->>'byokMode' IS NULL OR metadata->>'byokMode' != 'true')
              AND created_at >= ${todayStart}
            THEN (metadata->>'costCents')::numeric
            ELSE 0
          END), 0) AS today_relay,
          COALESCE(SUM(CASE
            WHEN metadata->>'byokMode' = 'true'
              AND created_at >= ${yesterdayStart} AND created_at < ${yesterdayEnd}
            THEN (metadata->>'platformFeeCents')::numeric
            ELSE 0
          END), 0) AS yesterday_byok,
          COALESCE(SUM(CASE
            WHEN (metadata->>'byokMode' IS NULL OR metadata->>'byokMode' != 'true')
              AND created_at >= ${yesterdayStart} AND created_at < ${yesterdayEnd}
            THEN (metadata->>'costCents')::numeric
            ELSE 0
          END), 0) AS yesterday_relay
        FROM llm_call_logs
        WHERE created_at >= ${yesterdayStart}
      `)

      const todayByokCents = Number(incomeRow?.today_byok ?? 0)
      const todayRelayCents = Number(incomeRow?.today_relay ?? 0)
      const yesterdayByokCents = Number(incomeRow?.yesterday_byok ?? 0)
      const yesterdayRelayCents = Number(incomeRow?.yesterday_relay ?? 0)

      const todayIncome = centsToYuan(todayByokCents + todayRelayCents)
      const yesterdayIncome = centsToYuan(yesterdayByokCents + yesterdayRelayCents)
      const byokIncome = centsToYuan(todayByokCents)
      const yesterdayByokIncome = centsToYuan(yesterdayByokCents)

      // Q2: 引流 + 付费转化(今日新注册 + 昨日新注册 + 总付费用户 + 总用户)
      const [funnelRow] = await dbRead.execute<{
        today_referral: string | null
        yesterday_referral: string | null
        paid_count: string | null
        total_count: string | null
      }>(sql`
        SELECT
          (SELECT COUNT(*) FROM users WHERE created_at >= ${todayStart}) AS today_referral,
          (SELECT COUNT(*) FROM users WHERE created_at >= ${yesterdayStart} AND created_at < ${yesterdayEnd}) AS yesterday_referral,
          (SELECT COUNT(*) FROM users WHERE is_vip > 0) AS paid_count,
          (SELECT COUNT(*) FROM users) AS total_count
      `)

      const todayReferral = Number(funnelRow?.today_referral ?? 0)
      const yesterdayReferral = Number(funnelRow?.yesterday_referral ?? 0)
      const paidCount = Number(funnelRow?.paid_count ?? 0)
      const totalCount = Number(funnelRow?.total_count ?? 0)

      const todayConversionRate =
        totalCount > 0 ? Number(((paidCount / totalCount) * 100).toFixed(2)) : 0

      // 昨日付费转化率:付费用户总数(快照)/ 昨日 23:59 的总用户数
      // 简化:用 (paidCount - 今日新付费(无字段,简化为 0)) / (totalCount - 今日新注册)
      // 这是近似(无法精确算昨日快照,需历史归档表),简化用当日付费率反推昨日付费率
      // 当无今日新注册时,昨日付费转化率 = 今日付费转化率(趋势 0)
      const yesterdayTotalCount = Math.max(0, totalCount - todayReferral)
      const yesterdayConversionRate =
        yesterdayTotalCount > 0
          ? Number(((paidCount / yesterdayTotalCount) * 100).toFixed(2))
          : todayConversionRate

      const overview: EarningsOverview = {
        todayIncome,
        todayIncomeTrend: computeTrend(todayIncome, yesterdayIncome),
        byokIncome,
        byokIncomeTrend: computeTrend(byokIncome, yesterdayByokIncome),
        referralCount: todayReferral,
        referralTrend: computeTrend(todayReferral, yesterdayReferral),
        conversionRate: todayConversionRate,
        conversionTrend: computeTrend(todayConversionRate, yesterdayConversionRate),
      }

      return reply.send(success(overview))
    } catch (e) {
      request.log.error({ err: e }, 'earnings/overview failed')
      return reply.status(500).send(error(500, (e as Error).message || 'Failed to load overview'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /byok-trend?days=30 — 最近 N 天 BYOK 抽成收入趋势(每日聚合)
  // -------------------------------------------------------------------------
  server.get('/byok-trend', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    let days: number
    try {
      const q = parseOrThrow(ByokTrendQuerySchema, request.query)
      days = q.days ?? 30
    } catch {
      return reply.status(400).send(error(400, 'days 必须是 1-365 之间的整数'))
    }

    try {
      // 按日期分组聚合 BYOK 抽成(分),返回日期 + 金额(元)
      const rows = await dbRead.execute<{ date: string; amount: string | null }>(sql`
        SELECT
          to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') AS date,
          COALESCE(SUM((metadata->>'platformFeeCents')::numeric), 0) AS amount
        FROM llm_call_logs
        WHERE metadata->>'byokMode' = 'true'
          AND created_at >= NOW() - MAKE_INTERVAL(days => ${days})
        GROUP BY 1
        ORDER BY 1 ASC
      `)

      // 客户端期望连续 N 天(缺失日期填 0),用 JS 端补全
      const today = new Date()
      const fullPoints: ByokIncomePoint[] = []
      const map = new Map<string, number>()
      for (const r of rows) {
        map.set(r.date, centsToYuan(r.amount))
      }
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        // 用 Asia/Shanghai 时区格式化(与 SQL 一致)
        const ymd = formatShanghaiDate(d)
        fullPoints.push({ date: ymd, amount: map.get(ymd) ?? 0 })
      }

      return reply.send(success(fullPoints))
    } catch (e) {
      request.log.error({ err: e }, 'earnings/byok-trend failed')
      return reply.status(500).send(error(500, (e as Error).message || 'Failed to load trend'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /referral — 各渠道引流数(free-model/publish/direct)
  // -------------------------------------------------------------------------
  server.get('/referral', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    try {
      // 三渠道用 set 去重(用户可能同时命中多渠道,优先级 free-model → publish → direct)
      // 1. free-model:在 llm_call_logs 中调用过免费 provider 的用户
      const where = buildFreeProviderWhereSql()
      const freeRows = await dbRead.execute<{ user_id: string }>(sql`
        SELECT DISTINCT user_id FROM llm_call_logs WHERE ${where}
      `)

      // 2. publish:配置过 publish_accounts 的用户
      const publishRows = await dbRead.execute<{ user_id: string }>(sql`
        SELECT DISTINCT user_id FROM publish_accounts WHERE user_id IS NOT NULL
      `)

      // 3. direct:其他用户(总用户 - free-model - publish,避免重复)
      const [totalRow] = await dbRead.execute<{ total: string | null }>(sql`
        SELECT COUNT(*) AS total FROM users
      `)
      const totalCount = Number(totalRow?.total ?? 0)

      const freeSet = new Set<string>(freeRows.map((r) => r.user_id))
      const publishSet = new Set<string>(publishRows.map((r) => r.user_id))

      const freeCount = freeSet.size
      const publishCount = publishSet.size
      const freeAndPublish = new Set<string>([...freeSet, ...publishSet])
      const directCount = Math.max(0, totalCount - freeAndPublish.size)

      const stats: ReferralChannelStat[] = [
        { channel: 'free-model', count: freeCount },
        { channel: 'publish', count: publishCount },
        { channel: 'direct', count: directCount },
      ]

      return reply.send(success(stats))
    } catch (e) {
      request.log.error({ err: e }, 'earnings/referral failed')
      return reply.status(500).send(error(500, (e as Error).message || 'Failed to load referral'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /funnel — 转化漏斗(register→active→byok→vip)
  // -------------------------------------------------------------------------
  server.get('/funnel', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return

    try {
      // 4 阶段并行查询(用一个 SQL 4 子查询合并,减少 RTT)
      const [row] = await dbRead.execute<{
        register_count: string | null
        active_count: string | null
        byok_count: string | null
        vip_count: string | null
      }>(sql`
        SELECT
          (SELECT COUNT(*) FROM users) AS register_count,
          (SELECT COUNT(DISTINCT user_id) FROM llm_call_logs) AS active_count,
          (SELECT COUNT(DISTINCT user_id) FROM llm_call_logs WHERE metadata->>'byokMode' = 'true') AS byok_count,
          (SELECT COUNT(*) FROM users WHERE is_vip > 0) AS vip_count
      `)

      const stats: ConversionStageStat[] = [
        { stage: 'register', count: Number(row?.register_count ?? 0) },
        { stage: 'active', count: Number(row?.active_count ?? 0) },
        { stage: 'byok', count: Number(row?.byok_count ?? 0) },
        { stage: 'vip', count: Number(row?.vip_count ?? 0) },
      ]

      return reply.send(success(stats))
    } catch (e) {
      request.log.error({ err: e }, 'earnings/funnel failed')
      return reply.status(500).send(error(500, (e as Error).message || 'Failed to load funnel'))
    }
  })
}

/** 把日期格式化为 Asia/Shanghai 时区的 YYYY-MM-DD(与 SQL to_char 一致)。 */
function formatShanghaiDate(d: Date): string {
  // 用 Intl.DateTimeFormat 走 Asia/Shanghai 时区(避免本地时区差异)
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  // en-CA 输出 YYYY-MM-DD
  return fmt.format(d)
}
