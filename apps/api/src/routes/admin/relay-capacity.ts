// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/admin/relay/capacity 容量与趋势看板端点(2026-09-16 立,补强 X,对标
 * 竞品 /capacity-summary + /api-keys-trend)。
 *
 * 端点(requireAdmin,注册主会话接线):
 * 1. GET /relay/capacity/summary  — Key 池容量汇总(总数/活跃/吊销/无限额度/低余额
 *    告警/池内 token 总余额 + 近 7 天平均延迟与错误率)
 * 2. GET /relay/capacity/key-trend?days=N — Key 增长趋势(按 created_at 日期聚合)
 * 3. GET /relay/capacity/call-trend?days=N — 调用趋势(按 UTC+8 日期聚合:
 *    调用数/失败数/成本/平均延迟,与 db/mobile-stats-queries 同口径)
 *
 * 全部实测聚合(llm_call_logs / developer_api_keys),无新表。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { dbRead } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'

const daysSchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
})

const adminRelayCapacityRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // 1. 容量汇总
  server.get('/relay/capacity/summary', async (request, reply) => {
    try {
      const [keyAgg] = await dbRead
        .select({
          total: sql<number>`count(*)::int`,
          active: sql<number>`sum(CASE WHEN status = 'active' THEN 1 ELSE 0 END)::int`,
          revoked: sql<number>`sum(CASE WHEN status <> 'active' THEN 1 ELSE 0 END)::int`,
          infiniteBalance: sql<number>`sum(CASE WHEN token_balance = -1 THEN 1 ELSE 0 END)::int`,
          lowBalance: sql<number>`sum(CASE WHEN status = 'active' AND (token_balance = 0 OR (cost_balance_cents >= 0 AND cost_balance_cents < 1000))) THEN 1 ELSE 0 END)::int`,
          poolTokenBalance: sql<number>`COALESCE(sum(CASE WHEN status = 'active' AND token_balance > 0 THEN token_balance ELSE 0 END), 0)::bigint`,
        })
        .from(sql`developer_api_keys`)
      const [callAgg] = await dbRead
        .select({
          total: sql<number>`count(*)::int`,
          failed: sql<number>`sum(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::int`,
          avgLatency: sql<number>`COALESCE(AVG(latency_ms), 0)`,
        })
        .from(sql`llm_call_logs`)
        .where(sql`created_at >= now() - interval '7 days'`)
      const total7d = Number(callAgg?.total ?? 0)
      const failed7d = Number(callAgg?.failed ?? 0)
      return reply.send(
        success({
          keys: {
            total: Number(keyAgg?.total ?? 0),
            active: Number(keyAgg?.active ?? 0),
            revoked: Number(keyAgg?.revoked ?? 0),
            infiniteBalance: Number(keyAgg?.infiniteBalance ?? 0),
            lowBalance: Number(keyAgg?.lowBalance ?? 0),
          },
          pool: {
            totalTokenBalance: Number(keyAgg?.poolTokenBalance ?? 0),
            avgLatency7d: Math.round(Number(callAgg?.avgLatency ?? 0)),
            errorRate7d: total7d > 0 ? failed7d / total7d : 0,
            calls7d: total7d,
          },
          generatedAt: new Date().toISOString(),
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询容量汇总失败'))
    }
  })

  // 2. Key 增长趋势
  server.get('/relay/capacity/key-trend', async (request, reply) => {
    const parsed = daysSchema.safeParse(request.query ?? {})
    const days = parsed.success ? (parsed.data.days ?? 30) : 30
    try {
      const rows = await dbRead
        .select({
          date: sql<string>`to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`,
          created: sql<number>`count(*)::int`,
          active: sql<number>`sum(CASE WHEN status = 'active' THEN 1 ELSE 0 END)::int`,
        })
        .from(sql`developer_api_keys`)
        .where(sql`created_at >= now() - (${days} || ' days')::interval`)
        .groupBy(sql`to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`)
      return reply.send(
        success({
          days,
          points: rows.map((r) => ({
            date: r.date,
            created: Number(r.created),
            active: Number(r.active),
          })),
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 Key 增长趋势失败'))
    }
  })

  // 3. 调用趋势(UTC+8 日聚合)
  server.get('/relay/capacity/call-trend', async (request, reply) => {
    const parsed = daysSchema.safeParse(request.query ?? {})
    const days = parsed.success ? (parsed.data.days ?? 30) : 30
    try {
      const rows = await dbRead
        .select({
          date: sql<string>`to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`,
          calls: sql<number>`count(*)::int`,
          failed: sql<number>`sum(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::int`,
          costCents: sql<number>`COALESCE(sum(cost_used_total_cents), 0)`,
          avgLatencyMs: sql<number>`COALESCE(AVG(latency_ms), 0)`,
        })
        .from(sql`llm_call_logs`)
        .where(sql`created_at >= now() - (${days} || ' days')::interval`)
        .groupBy(sql`to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`)
      return reply.send(
        success({
          days,
          points: rows.map((r) => ({
            date: r.date,
            calls: Number(r.calls),
            failed: Number(r.failed),
            costCents: Number(r.costCents),
            avgLatencyMs: Math.round(Number(r.avgLatencyMs)),
          })),
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询调用趋势失败'))
    }
  })
}

export default adminRelayCapacityRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
