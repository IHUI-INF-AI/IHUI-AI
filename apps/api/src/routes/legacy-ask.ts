import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { authenticate } from '../plugins/auth.js'
import { z } from 'zod'
import { db } from '../db/index.js'
import { sql, eq } from 'drizzle-orm'
import { asks, askAnswers } from '@ihui/database'

/**
 * 历史项目缺失端点补齐 — 问答模块(D7/D8)。
 * 从原 legacy-completion.ts 拆分,注册 prefix 为 /api/legacy,完整路径保持不变。
 * - D7: 问答分类/会员计数(5端点 /ask/*)
 * - D8: 回答删除/更新(2端点 /ask/answers/*)
 */
export const legacyAskRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const idParam = z.object({ id: z.string() })
  const userIdQuery = z.object({ userId: z.string() })
  const paginatedUserIdQuery = z.object({
    userId: z.string(),
    page: z.coerce.number().optional().default(1),
    pageSize: z.coerce.number().optional().default(20),
  })

  // ========== D7: 问答分类/会员计数 (5端点) ==========
  fastify.get('/ask/categories', async () => {
    const rows = await db.execute(
      sql`SELECT * FROM circle_categories WHERE status = 1 ORDER BY sort ASC`,
    )
    return { list: rows as Record<string, unknown>[] }
  })

  fastify.get('/ask/member/question-count', { preHandler: authenticate }, async (request) => {
    const { userId } = userIdQuery.parse(request.query)
    const rows = await db.execute(
      sql`SELECT count(*)::int AS count FROM asks WHERE user_id = ${userId}`,
    )
    return { count: (rows[0] as { count?: number } | undefined)?.count ?? 0 }
  })

  fastify.get('/ask/member/answer-count', { preHandler: authenticate }, async (request) => {
    const { userId } = userIdQuery.parse(request.query)
    const rows = await db.execute(
      sql`SELECT count(*)::int AS count FROM ask_answers WHERE user_id = ${userId}`,
    )
    return { count: (rows[0] as { count?: number } | undefined)?.count ?? 0 }
  })

  fastify.get('/ask/member/questions', { preHandler: authenticate }, async (request) => {
    const { userId, page, pageSize } = paginatedUserIdQuery.parse(request.query)
    const list = await db
      .select()
      .from(asks)
      .where(eq(asks.userId, userId))
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    return { list, page: Number(page), pageSize: Number(pageSize) }
  })

  fastify.get('/ask/member/answers', { preHandler: authenticate }, async (request) => {
    const { userId, page, pageSize } = paginatedUserIdQuery.parse(request.query)
    const list = await db
      .select()
      .from(askAnswers)
      .where(eq(askAnswers.userId, userId))
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    return { list, page: Number(page), pageSize: Number(pageSize) }
  })

  // ========== D8: 回答删除/更新 (2端点) ==========
  fastify.delete('/ask/answers/:id', { preHandler: authenticate }, async (request) => {
    const { id } = idParam.parse(request.params)
    await db.delete(askAnswers).where(eq(askAnswers.id, id))
    return { deleted: true }
  })

  fastify.patch('/ask/answers/:id', { preHandler: authenticate }, async (request) => {
    const { id } = idParam.parse(request.params)
    const { content } = z.object({ content: z.string() }).parse(request.body)
    const [updated] = await db
      .update(askAnswers)
      .set({ content })
      .where(eq(askAnswers.id, id))
      .returning()
    return updated
  })
}
