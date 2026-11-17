// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 签到连续天数(2026-11-17 立,对标 qoder2api-hub 的 streak 面板字段)。
 *
 * 两个端点:
 * - `GET  /api/admin/relay/accounts/:id/checkin-streak?days=365`
 *   读 `ai_relay_checkin_history` 的日期集合,交给纯判据 `computeCheckinStreak` 算当前/最长连续。
 *   无历史时返回 `available:false` + 原因,**不把"没记录"说成"0 天"**。
 * - `POST /api/admin/relay/checkin-history/record`
 *   幂等落一条(一天一条,`(account_id, day)` 唯一,重跑签到不记三条)。这是接线口:
 *   调度器/补跑流程把签到结论写进来,streak 才有序列可算。
 *
 * 判据全部在 `relay-checkin-streak.ts`(纯函数);本文件只做查询、幂等写入与投影。
 */
import { and, desc, eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { aiRelayCheckinHistory } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { error, success } from '../../utils/response.js'
import { db, dbRead } from '../../db/index.js'
import { computeCheckinStreak, todayInUtc8 } from '../../services/relay-checkin-streak.js'

const MAX_SCAN_DAYS = 1000
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

const recordSchema = z.object({
  accountId: z.string().uuid(),
  providerCode: z.string().min(1).max(64),
  /** 归属日(UTC+8);缺省取今天 */
  day: z.string().regex(DAY_RE).optional(),
  status: z.enum(['success', 'already', 'skip', 'failed']),
  message: z.string().max(500).optional(),
})

export const relayCheckinStreakRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.get('/admin/relay/accounts/:id/checkin-streak', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params)
    if (!params.success) return reply.code(400).send(error(400, '账号 id 不合法'))
    const query = z
      .object({ days: z.coerce.number().int().min(1).max(MAX_SCAN_DAYS).default(365) })
      .safeParse(request.query)
    if (!query.success) return reply.code(400).send(error(400, 'days 取值 1-1000'))
    const accountId = params.data.id

    const rows = await dbRead
      .select({ day: aiRelayCheckinHistory.day, status: aiRelayCheckinHistory.status })
      .from(aiRelayCheckinHistory)
      .where(eq(aiRelayCheckinHistory.accountId, accountId))
      .orderBy(desc(aiRelayCheckinHistory.day))
      .limit(query.data.days)

    const today = todayInUtc8()
    const streak = computeCheckinStreak(
      rows.map((r) => r.day),
      today,
    )
    return success({
      account_id: accountId,
      today,
      scanned: rows.length,
      ...streak,
    })
  })

  server.post('/admin/relay/checkin-history/record', async (request, reply) => {
    const body = recordSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send(error(400, '签到记录参数不合法'))
    const day = body.data.day ?? todayInUtc8()

    const inserted = await db
      .insert(aiRelayCheckinHistory)
      .values({
        accountId: body.data.accountId,
        providerCode: body.data.providerCode,
        day,
        status: body.data.status,
        message: body.data.message ?? null,
      })
      .onConflictDoNothing({
        target: [aiRelayCheckinHistory.accountId, aiRelayCheckinHistory.day],
      })
      .returning({ id: aiRelayCheckinHistory.id })

    return success({
      account_id: body.data.accountId,
      day,
      // 当天已有记录时不覆盖(幂等),如实说"没新增"而不是假装写成功
      inserted: inserted.length > 0,
    })
  })

  // 全池 streak 概览:一次查多账号,给面板用
  server.get('/admin/relay/checkin-streak/overview', async (request, reply) => {
    const query = z
      .object({
        providerCode: z.string().min(1).max(64).optional(),
        limit: z.coerce.number().int().min(1).max(200).default(50),
      })
      .safeParse(request.query)
    if (!query.success) return reply.code(400).send(error(400, '参数不合法'))

    const where = query.data.providerCode
      ? and(eq(aiRelayCheckinHistory.providerCode, query.data.providerCode))
      : undefined
    const rows = await dbRead
      .select({
        accountId: aiRelayCheckinHistory.accountId,
        providerCode: aiRelayCheckinHistory.providerCode,
        day: aiRelayCheckinHistory.day,
      })
      .from(aiRelayCheckinHistory)
      .where(where)
      .orderBy(desc(aiRelayCheckinHistory.day))
      .limit(query.data.limit * MAX_SCAN_DAYS)

    const today = todayInUtc8()
    const byAccount = new Map<string, { providerCode: string; days: string[] }>()
    for (const row of rows) {
      const bucket = byAccount.get(row.accountId) ?? {
        providerCode: row.providerCode,
        days: [],
      }
      bucket.days.push(row.day)
      byAccount.set(row.accountId, bucket)
    }

    const items = [...byAccount.entries()]
      .map(([accountId, v]) => ({
        account_id: accountId,
        provider_code: v.providerCode,
        ...computeCheckinStreak(v.days, today),
      }))
      .filter((it) => it.available)
      .sort((a, b) => b.current - a.current || b.longest - a.longest)
      .slice(0, query.data.limit)

    return success({ today, total: items.length, items })
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
