import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { authenticate } from '../plugins/auth.js'
import { z } from 'zod'
import { db } from '../db/index.js'
import { sql, eq, desc } from 'drizzle-orm'
import { circles } from '@ihui/database'

/**
 * 历史项目缺失端点补齐 — 圈子模块(D17/D18)。
 * 从原 legacy-completion.ts 拆分,注册 prefix 为 /api/legacy,完整路径保持不变。
 * - D17: 圈子热门列表(/circles/hot,历史 /public-api/circle/hot/list)
 * - D18: 圈子成员计数(/circles/member-count,历史 /public-api/member/count)
 */
export const legacyCommunityRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // ========== D17: 圈子热门列表 (历史 /public-api/circle/hot/list) ==========
  fastify.get('/circles/hot', async (request) => {
    const { limit } = z
      .object({ limit: z.coerce.number().optional().default(10) })
      .parse(request.query)
    const list = await db
      .select({
        id: sql`${circles.id}`,
        name: sql`${circles.name}`,
        slug: sql`${circles.slug}`,
        coverImage: sql`${circles.coverImage}`,
        memberCount: sql`${circles.memberCount}`,
        postCount: sql`${circles.postCount}`,
      })
      .from(circles)
      .where(eq(circles.isPublished, true))
      .orderBy(desc(circles.memberCount))
      .limit(Number(limit))
    return { list }
  })

  // ========== D18: 圈子成员计数 (历史 /public-api/member/count) ==========
  fastify.get('/circles/member-count', { preHandler: authenticate }, async (request) => {
    const { circleId } = z.object({ circleId: z.string().uuid() }).parse(request.query)
    const [row] = await db
      .select({ count: circles.memberCount })
      .from(circles)
      .where(eq(circles.id, circleId))
    return { circleId, memberCount: row?.count ?? 0 }
  })
}
