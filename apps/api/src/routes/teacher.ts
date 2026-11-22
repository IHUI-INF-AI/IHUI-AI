// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { and, eq, ilike, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { liveLecturers, liveChannels } from '@ihui/database'
import { requireAuth } from '../plugins/require-permission.js'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().max(100).optional(),
})

const idParam = z.object({ id: z.uuid({ error: '无效的讲师 ID' }) })

const followBody = z.object({ follow: z.boolean() })

/** 讲师课程数/学员数/粉丝数的聚合表达式（单一 SQL，避免列表 N+1）。 */
function aggregateColumns() {
  return {
    courses: sql<number>`(
      select count(*)::int from live_channels c
      where c.lecturer_id = live_lecturers.id and c.is_published = true and c.status = 1
    )`,
    students: sql<number>`(
      select coalesce(sum(c.view_count), 0)::int from live_channels c
      where c.lecturer_id = live_lecturers.id and c.is_published = true and c.status = 1
    )`,
    fans: sql<number>`(
      select count(*)::int from behavior_follow f where f.target_user_id = live_lecturers.id::text
    )`,
  }
}

async function isFollowed(userId: string | undefined, lecturerId: string): Promise<boolean> {
  if (!userId) return false
  const rows = await db.execute(sql`
    select 1 from behavior_follow
    where user_id = ${userId} and target_user_id = ${lecturerId}
    limit 1
  `)
  return Array.isArray(rows) && rows.length > 0
}

/**
 * 公开读端点上的可选身份：带凭据时解析出 userId，未带或凭据失效都按匿名处理。
 * 公开面不在全局鉴权钩子的射程内，详情页要按登录态返回 isFollowed 就必须自己问一次。
 */
async function optionalUserId(request: FastifyRequest): Promise<string | undefined> {
  if (!request.headers.authorization && !request.cookies?.auth_token) return undefined
  try {
    return (await authenticate(request)).userId
  } catch {
    return undefined
  }
}

const teacherRoutes: FastifyPluginAsync = async (server) => {
  // GET /teacher/list — 公开讲师目录（仅启用讲师 + 已发布课程聚合）
  server.get('/teacher/list', async (request, reply) => {
    const parsed = listQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, keyword } = parsed.data
    const where = keyword
      ? and(eq(liveLecturers.status, 1), ilike(liveLecturers.name, `%${keyword}%`))
      : eq(liveLecturers.status, 1)
    const [list, totalRows] = await Promise.all([
      db
        .select({
          id: liveLecturers.id,
          name: liveLecturers.name,
          avatar: liveLecturers.avatar,
          title: liveLecturers.title,
          intro: liveLecturers.intro,
          ...aggregateColumns(),
        })
        .from(liveLecturers)
        .where(where)
        .orderBy(liveLecturers.sort, liveLecturers.id)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(liveLecturers)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  // GET /teacher/:id — 讲师详情（公开；登录时附带 isFollowed）
  server.get('/teacher/:id', async (request, reply) => {
    const parsed = idParam.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [lecturer] = await db
      .select({
        id: liveLecturers.id,
        name: liveLecturers.name,
        avatar: liveLecturers.avatar,
        title: liveLecturers.title,
        intro: liveLecturers.intro,
        ...aggregateColumns(),
      })
      .from(liveLecturers)
      .where(and(eq(liveLecturers.id, parsed.data.id), eq(liveLecturers.status, 1)))
      .limit(1)
    if (!lecturer) return reply.status(404).send(error(404, '讲师不存在'))
    return reply.send(
      success({
        ...lecturer,
        rating: 0,
        isFollowed: await isFollowed(await optionalUserId(request), lecturer.id),
      }),
    )
  })

  // GET /teacher/:id/courses — 讲师已发布课程
  server.get('/teacher/:id/courses', async (request, reply) => {
    const parsed = idParam.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db
      .select({
        id: liveChannels.id,
        title: liveChannels.title,
        coverUrl: liveChannels.coverImage,
        students: liveChannels.viewCount,
      })
      .from(liveChannels)
      .where(
        and(
          eq(liveChannels.lecturerId, parsed.data.id),
          eq(liveChannels.isPublished, true),
          eq(liveChannels.status, 1),
        ),
      )
      .orderBy(liveChannels.sort, liveChannels.id)
    return reply.send(success({ list: rows.map((r) => ({ ...r, price: 0 })) }))
  })

  // GET /teacher/:id/reviews — 学员评价（全仓无评价表，保持空列表，不造数据）
  server.get('/teacher/:id/reviews', async (_request, reply) => reply.send(success({ list: [] })))

  // POST /teacher/:id/follow — 关注/取消关注（需登录）
  server.post('/teacher/:id/follow', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = idParam.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = followBody.safeParse(request.body ?? {})
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [lecturer] = await db
      .select({ id: liveLecturers.id })
      .from(liveLecturers)
      .where(and(eq(liveLecturers.id, parsed.data.id), eq(liveLecturers.status, 1)))
      .limit(1)
    if (!lecturer) return reply.status(404).send(error(404, '讲师不存在'))

    const userId = request.userId!
    if (body.data.follow) {
      await db.execute(sql`
        insert into behavior_follow (user_id, target_user_id, is_mutual)
        select ${userId}, ${lecturer.id}, false
        where not exists (
          select 1 from behavior_follow where user_id = ${userId} and target_user_id = ${lecturer.id}
        )
      `)
    } else {
      await db.execute(sql`
        delete from behavior_follow where user_id = ${userId} and target_user_id = ${lecturer.id}
      `)
    }
    return reply.send(success({ follow: body.data.follow }))
  })
}

export { teacherRoutes }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
