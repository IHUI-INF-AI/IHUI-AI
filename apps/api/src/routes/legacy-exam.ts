import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { authenticate } from '../plugins/auth.js'
import { z } from 'zod'
import { db } from '../db/index.js'
import { sql, eq, and, desc } from 'drizzle-orm'
import { examPapers, examWrongQuestion, examSignups } from '@ihui/database'

/**
 * 历史项目缺失端点补齐 — 考试模块(D1/D2/D16)。
 * 从原 legacy-completion.ts 拆分,注册 prefix 为 /api/legacy,完整路径保持不变。
 * - D1: 考试报名 sign-up CRUD(5端点 /exam/signups*)
 * - D2: 考试收藏/推荐/热门(3端点 /exam/recommend|hot|favorites)
 * - D16: 错题删除(/exam/wrong-questions/:id)
 */
export const legacyExamRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const idParam = z.object({ id: z.string() })
  const userIdQuery = z.object({ userId: z.string() })

  // ========== D1: 考试报名 sign-up CRUD (5端点) ==========
  // 报名列表
  fastify.get('/exam/signups', { preHandler: authenticate }, async (request) => {
    const { examId, userId, page, pageSize } = z
      .object({
        examId: z.string().optional(),
        userId: z.string().optional(),
        page: z.coerce.number().optional().default(1),
        pageSize: z.coerce.number().optional().default(20),
      })
      .parse(request.query)
    const conditions = []
    if (examId) conditions.push(eq(examSignups.paperId, examId))
    if (userId) conditions.push(eq(examSignups.userId, userId))
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const list = await db
      .select()
      .from(examSignups)
      .where(where)
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    return { list, total: list.length, page: Number(page), pageSize: Number(pageSize) }
  })

  // 创建报名
  fastify.post('/exam/signups', { preHandler: authenticate }, async (request, reply) => {
    const body = z
      .object({ examId: z.string().uuid(), userId: z.string().uuid() })
      .parse(request.body)
    const [created] = await db
      .insert(examSignups)
      .values({
        paperId: body.examId,
        userId: body.userId,
      })
      .returning()
    return reply.code(201).send(created)
  })

  // 报名详情
  fastify.get('/exam/signups/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const result = await db.select().from(examSignups).where(eq(examSignups.id, id)).limit(1)
    if (!result[0]) return reply.code(404).send({ error: '报名记录不存在' })
    return result[0]
  })

  // 取消报名
  fastify.delete('/exam/signups/:id', { preHandler: authenticate }, async (request) => {
    const { id } = idParam.parse(request.params)
    await db.delete(examSignups).where(eq(examSignups.id, id))
    return { deleted: true }
  })

  // 检查是否已报名
  fastify.get('/exam/signups/check', { preHandler: authenticate }, async (request) => {
    const { examId, userId } = z
      .object({ examId: z.string(), userId: z.string() })
      .parse(request.query)
    const result = await db
      .select()
      .from(examSignups)
      .where(and(eq(examSignups.paperId, examId), eq(examSignups.userId, userId)))
      .limit(1)
    return { signed: !!result[0], signup: result[0] || null }
  })

  // ========== D2: 考试收藏/推荐/热门 (3端点) ==========
  fastify.get('/exam/recommend', async () => {
    const list = await db
      .select()
      .from(examPapers)
      .where(eq(examPapers.status, 1))
      .orderBy(desc(examPapers.createdAt))
      .limit(10)
    return { list }
  })

  fastify.get('/exam/hot', async () => {
    const list = await db
      .select()
      .from(examPapers)
      .where(eq(examPapers.status, 1))
      .orderBy(desc(examPapers.createdAt))
      .limit(10)
    return { list }
  })

  fastify.get('/exam/favorites', { preHandler: authenticate }, async (request) => {
    const { userId } = userIdQuery.parse(request.query)
    // user_favorites 使用 resource_type / resource_id
    const rows = await db.execute(
      sql`SELECT e.* FROM exam_papers e JOIN user_favorites f ON f.resource_id::text = e.id::text WHERE f.user_id = ${userId} AND f.resource_type = 'exam'`,
    )
    return { list: rows as Record<string, unknown>[] }
  })

  // ========== D16: 错题删除 ==========
  fastify.delete('/exam/wrong-questions/:id', { preHandler: authenticate }, async (request) => {
    const { id } = idParam.parse(request.params)
    await db.delete(examWrongQuestion).where(eq(examWrongQuestion.id, id))
    return { deleted: true }
  })
}
