import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { authenticate } from '../plugins/auth.js'
import { z } from 'zod'
import { db } from '../db/index.js'
import { sql, eq, desc } from 'drizzle-orm'
import { learnTopic } from '@ihui/database'

/**
 * 历史项目缺失端点补齐 — 学习模块(D3/D5)。
 * 从原 legacy-completion.ts 拆分,注册 prefix 为 /api/legacy,完整路径保持不变。
 * - D3: 学习时间统计(3端点 /learn/stats/*)
 * - D5: 学习专题 topic 公开接口(3端点 /learn/topics*)
 */
export const legacyLearnRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const idParam = z.object({ id: z.string() })
  const userIdQuery = z.object({ userId: z.string() })

  // ========== D3: 学习时间统计 (3端点) ==========
  fastify.get('/learn/stats/total-time', { preHandler: authenticate }, async (request) => {
    const { userId } = userIdQuery.parse(request.query)
    // learn_record 表使用 member_id / learn_time（秒）
    const rows = await db.execute(
      sql`SELECT COALESCE(SUM(learn_time), 0)::int AS total_seconds FROM learn_record WHERE member_id = ${userId}`,
    )
    const totalSeconds = (rows[0] as { total_seconds?: number } | undefined)?.total_seconds ?? 0
    return { totalMinutes: Math.floor(totalSeconds / 60) }
  })

  fastify.get('/learn/stats/today-time', { preHandler: authenticate }, async (request) => {
    const { userId } = userIdQuery.parse(request.query)
    const rows = await db.execute(
      sql`SELECT COALESCE(SUM(learn_time), 0)::int AS today_seconds FROM learn_record WHERE member_id = ${userId} AND created_at >= CURRENT_DATE`,
    )
    const todaySeconds = (rows[0] as { today_seconds?: number } | undefined)?.today_seconds ?? 0
    return { todayMinutes: Math.floor(todaySeconds / 60) }
  })

  fastify.get('/learn/stats/rank-percent', { preHandler: authenticate }, async (request) => {
    const { userId } = userIdQuery.parse(request.query)
    const rows = await db.execute(sql`
      WITH user_total AS (
        SELECT member_id, SUM(learn_time) as total FROM learn_record GROUP BY member_id
      ), ranks AS (
        SELECT member_id, PERCENT_RANK() OVER (ORDER BY total DESC) as pct FROM user_total
      )
      SELECT pct FROM ranks WHERE member_id = ${userId}
    `)
    return { rankPercent: (rows[0] as { pct?: number } | undefined)?.pct ?? 0 }
  })

  // ========== D5: 学习专题 topic 公开接口 (3端点) ==========
  fastify.get('/learn/topics', async () => {
    // 实际表名为 learn_topic（单数），status 为 varchar('draft'/'published')
    const rows = await db
      .select({
        id: learnTopic.id,
        title: learnTopic.title,
        image: learnTopic.image,
        status: learnTopic.status,
        description: learnTopic.description,
        company_id: learnTopic.companyId,
        department_id: learnTopic.departmentId,
        create_user_id: learnTopic.createUserId,
        price: learnTopic.price,
        original_price: learnTopic.originalPrice,
        created_at: learnTopic.createdAt,
        updated_at: learnTopic.updatedAt,
      })
      .from(learnTopic)
      .where(eq(learnTopic.status, 'published'))
      .orderBy(desc(learnTopic.createdAt))
    return { list: rows as Record<string, unknown>[] }
  })

  fastify.get('/learn/topics/:id', async (request) => {
    const { id } = idParam.parse(request.params)
    const rows = await db
      .select({
        id: learnTopic.id,
        title: learnTopic.title,
        image: learnTopic.image,
        status: learnTopic.status,
        description: learnTopic.description,
        company_id: learnTopic.companyId,
        department_id: learnTopic.departmentId,
        create_user_id: learnTopic.createUserId,
        price: learnTopic.price,
        original_price: learnTopic.originalPrice,
        created_at: learnTopic.createdAt,
        updated_at: learnTopic.updatedAt,
      })
      .from(learnTopic)
      .where(eq(learnTopic.id, id))
    return (rows[0] as Record<string, unknown> | undefined) || { error: '专题不存在' }
  })

  fastify.get('/learn/topics/:id/lessons', async (request) => {
    const { id } = idParam.parse(request.params)
    const rows = await db.execute(
      sql`SELECT l.* FROM lessons l JOIN learn_topic_lesson tl ON tl.lesson_id = l.id WHERE tl.topic_id = ${id}`,
    )
    return { list: rows as Record<string, unknown>[] }
  })
}
