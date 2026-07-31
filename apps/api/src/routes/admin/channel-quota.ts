/**
 * /api/admin/relay/channels 渠道配额管理(2026-08-01 立,P0-28 配套)。
 *
 * 端点清单:
 * 1. GET   /admin/relay/channels        — 列出所有 key_pool + 4 个配额 limit + 当日/当月用量
 * 2. PATCH /admin/relay/channels/:id    — 更新 key_pool 的 4 个配额字段(null = 无限)
 *
 * 配额字段由迁移 20260801010050_add_channel_quota_fields.sql 添加到 ai_relay_key_pool 表,
 * 此处用 sql`column` 原始片段读写(与 channel-quota-service.ts 一致,不改 schema 文件)。
 *
 * 全部 requireAdmin。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sql, desc } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { dbRead } from '../../db/index.js'
import { aiRelayKeyPool } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error } from '../../utils/response.js'
import { getDailyUsage, getMonthlyUsage } from '../../services/channel-quota-service.js'

// ============================================================================
// Schemas
// ============================================================================
const updateQuotaBodySchema = z.object({
  dailyCallLimit: z.number().int().min(0).nullable().optional(),
  monthlyCallLimit: z.number().int().min(0).nullable().optional(),
  dailyTokenLimit: z.number().int().min(0).nullable().optional(),
  monthlyTokenLimit: z.number().int().min(0).nullable().optional(),
})

// ============================================================================
// 路由
// ============================================================================
const channelQuotaRoutes: FastifyPluginAsync = async (server) => {
  // 1. GET /relay/channels — 列出所有 key_pool + 配额 + 用量
  server.get('/relay/channels', { preHandler: requireAdmin }, async (_req, reply) => {
    try {
      // 查所有 key_pool + 4 个配额字段(用 sql 原始片段读新列,因 schema 文件未加新列)
      const rows = await dbRead
        .select({
          id: aiRelayKeyPool.id,
          providerCode: aiRelayKeyPool.providerCode,
          weight: aiRelayKeyPool.weight,
          isEnabled: aiRelayKeyPool.isEnabled,
          dailyCallLimit: sql<number | null>`daily_call_limit`,
          monthlyCallLimit: sql<number | null>`monthly_call_limit`,
          dailyTokenLimit: sql<number | null>`daily_token_limit`,
          monthlyTokenLimit: sql<number | null>`monthly_token_limit`,
        })
        .from(aiRelayKeyPool)
        .orderBy(desc(aiRelayKeyPool.createdAt))

      // 并行查每个 key_pool 的当日/当月用量
      const listWithUsage = await Promise.all(
        rows.map(async (row) => {
          const [daily, monthly] = await Promise.all([
            getDailyUsage(row.id).catch(() => ({ callCount: 0, totalTokens: 0, totalCostCents: 0, errorCount: 0 })),
            getMonthlyUsage(row.id).catch(() => ({ callCount: 0, totalTokens: 0, totalCostCents: 0 })),
          ])
          return {
            id: row.id,
            providerCode: row.providerCode,
            weight: row.weight,
            isEnabled: row.isEnabled,
            dailyCallLimit: row.dailyCallLimit,
            monthlyCallLimit: row.monthlyCallLimit,
            dailyTokenLimit: row.dailyTokenLimit,
            monthlyTokenLimit: row.monthlyTokenLimit,
            dailyUsedCalls: daily.callCount,
            dailyUsedTokens: daily.totalTokens,
            monthlyUsedCalls: monthly.callCount,
            monthlyUsedTokens: monthly.totalTokens,
          }
        }),
      )

      return reply.send(success({ list: listWithUsage }))
    } catch (err) {
      server.log.error({ err }, '[admin/channel-quota] list failed')
      return reply.send(error(500, '查询渠道配额列表失败'))
    }
  })

  // 2. PATCH /relay/channels/:id — 更新 key_pool 的 4 个配额字段
  server.patch<{
    Params: { id: string }
    Body: z.infer<typeof updateQuotaBodySchema>
  }>(
    '/relay/channels/:id',
    { preHandler: requireAdmin, schema: { body: updateQuotaBodySchema } },
    async (req, reply) => {
      const { id } = req.params
      const body = req.body

      try {
        // 构造 SET 子句(只更新提供的字段,null 表示无限)
        const setClauses: ReturnType<typeof sql>[] = []
        if (body.dailyCallLimit !== undefined) {
          setClauses.push(sql`daily_call_limit = ${body.dailyCallLimit}`)
        }
        if (body.monthlyCallLimit !== undefined) {
          setClauses.push(sql`monthly_call_limit = ${body.monthlyCallLimit}`)
        }
        if (body.dailyTokenLimit !== undefined) {
          setClauses.push(sql`daily_token_limit = ${body.dailyTokenLimit}`)
        }
        if (body.monthlyTokenLimit !== undefined) {
          setClauses.push(sql`monthly_token_limit = ${body.monthlyTokenLimit}`)
        }

        if (setClauses.length === 0) {
          return reply.send(error(400, '未提供任何配额字段'))
        }

        // 执行原始 SQL 更新(drizzle .update().set() 不支持未定义列,用 db.execute)
        const result = await db.execute(
          sql`UPDATE ai_relay_key_pool SET ${sql.join(setClauses, sql`, `)}, updated_at = NOW() WHERE id = ${id}`,
        )

        // postgres-js 返回数组,长度 0 表示未匹配
        const affected = Array.isArray(result) ? result.length : 0
        if (affected === 0) {
          return reply.send(error(404, '渠道不存在'))
        }

        return reply.send(success({ id }))
      } catch (err) {
        server.log.error({ err }, '[admin/channel-quota] update failed')
        return reply.send(error(500, '更新渠道配额失败'))
      }
    },
  )
}

export default channelQuotaRoutes
