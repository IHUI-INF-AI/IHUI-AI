// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify'
import { authenticate } from '../plugins/auth.js'
import { z } from 'zod'
import { db } from '../db/index.js'
import { sql, eq, and, desc } from 'drizzle-orm'
import { learnTopic } from '@ihui/database'
import { error } from '../utils/response.js'

/**
 * 历史项目缺失端点补齐 — 学习模块(D3/D5)。
 * 从原 legacy-completion.ts 拆分,注册 prefix 为 /api/legacy,完整路径保持不变。
 * - D3: 学习时间统计(3端点 /learn/stats/*)
 * - D5: 学习专题 topic 公开接口(3端点 /learn/topics*)
 */
export const legacyLearnRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const idParam = z.object({ id: z.string() })

  type SelfScope = { ok: true; userId: string } | { ok: false; code: number; message: string }

  /**
   * 统计端点唯一的归属出口:**不得由 query 决定"读谁的数据"** —— 身份只从 JWT 取。
   * 显式传了别人的 userId ⇒ 403,而不是静默改写成自己的(后者会让调用方以为拿到的是
   * 那个人的数据)。判定只依赖请求形状、不发任何查询,且排在 zod 参数校验**之前**
   * (AGENTS §5:鉴权 → 授权 → 校参数 → 动作)。
   * 本面不设管理员档,理由同 legacy-exam.ts:50-54(管理员凭据被盗即等价整表导出)。
   */
  function requireSelfScope(
    request: FastifyRequest,
    selfReportedUserId: string | undefined,
  ): SelfScope {
    const callerId = request.userId!
    if (selfReportedUserId !== undefined && selfReportedUserId !== callerId) {
      return { ok: false, code: 403, message: '无权访问他人数据:归属只能由登录身份决定' }
    }
    return { ok: true, userId: callerId }
  }

  /** 从**未经校验**的 query 里取 userId,唯一目的是让授权判定排在参数校验之前。 */
  function rawQueryUserId(query: unknown): string | undefined {
    const v = (query as { userId?: unknown } | undefined)?.userId
    return typeof v === 'string' ? v : undefined
  }

  // ========== D3: 学习时间统计 (3端点) ==========
  fastify.get('/learn/stats/total-time', { preHandler: authenticate }, async (request, reply) => {
    const scope = requireSelfScope(request, rawQueryUserId(request.query))
    if (!scope.ok) return reply.status(scope.code).send(error(scope.code, scope.message))
    // learn_record 表使用 member_id / learn_time（秒）
    const rows = await db.execute(
      sql`SELECT COALESCE(SUM(learn_time), 0)::int AS total_seconds FROM learn_record WHERE member_id = ${scope.userId}`,
    )
    const totalSeconds = (rows[0] as { total_seconds?: number } | undefined)?.total_seconds ?? 0
    return { totalMinutes: Math.floor(totalSeconds / 60) }
  })

  fastify.get('/learn/stats/today-time', { preHandler: authenticate }, async (request, reply) => {
    const scope = requireSelfScope(request, rawQueryUserId(request.query))
    if (!scope.ok) return reply.status(scope.code).send(error(scope.code, scope.message))
    const rows = await db.execute(
      sql`SELECT COALESCE(SUM(learn_time), 0)::int AS today_seconds FROM learn_record WHERE member_id = ${scope.userId} AND created_at >= CURRENT_DATE`,
    )
    const todaySeconds = (rows[0] as { today_seconds?: number } | undefined)?.today_seconds ?? 0
    return { todayMinutes: Math.floor(todaySeconds / 60) }
  })

  fastify.get('/learn/stats/rank-percent', { preHandler: authenticate }, async (request, reply) => {
    const scope = requireSelfScope(request, rawQueryUserId(request.query))
    if (!scope.ok) return reply.status(scope.code).send(error(scope.code, scope.message))
    const rows = await db.execute(sql`
      WITH user_total AS (
        SELECT member_id, SUM(learn_time) as total FROM learn_record GROUP BY member_id
      ), ranks AS (
        SELECT member_id, PERCENT_RANK() OVER (ORDER BY total DESC) as pct FROM user_total
      )
      SELECT pct FROM ranks WHERE member_id = ${scope.userId}
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
      .where(and(eq(learnTopic.id, id), eq(learnTopic.status, 'published')))
    return (rows[0] as Record<string, unknown> | undefined) || { error: '专题不存在' }
  })

  fastify.get('/learn/topics/:id/lessons', async (request) => {
    const { id } = idParam.parse(request.params)
    const rows = await db.execute(
      sql`SELECT l.* FROM lessons l JOIN learn_topic_lesson tl ON tl.lesson_id = l.id WHERE tl.topic_id = ${id} AND l.is_published = true`,
    )
    return { list: rows as Record<string, unknown>[] }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
