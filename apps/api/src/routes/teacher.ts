// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, desc, eq, ilike, inArray, isNotNull, sql } from 'drizzle-orm'
import { lessons, userFollows, users } from '@ihui/database'
import { success, error } from '../utils/response.js'
import { authenticate, checkAuth, hasHumanJwtCredential } from '../plugins/auth.js'
import { db, dbRead } from '../db/index.js'

const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
    keyword: z
      .string()
      .trim()
      .max(100)
      .optional()
      .transform((v) => v || undefined),
  })
  .strict()

const idParamSchema = z.object({ id: z.uuid() }).strict()
const followBodySchema = z.object({ follow: z.boolean() }).strict()

const publishedLessonConditions = () => [
  eq(lessons.isPublished, true),
  eq(lessons.status, 1),
  isNotNull(lessons.lecturerId),
]

interface TeacherAggregate {
  id: string
  name: string | null
  courses: number
  students: number
}

async function findTeacherAggregates(
  page: number,
  pageSize: number,
  keyword?: string,
): Promise<TeacherAggregate[]> {
  const conditions = publishedLessonConditions()
  if (keyword) conditions.push(ilike(lessons.lecturerName, `%${keyword}%`))
  const rows = await dbRead
    .select({
      id: lessons.lecturerId,
      name: sql<string | null>`max(${lessons.lecturerName})`,
      courses: sql<number>`count(*)::int`,
      students: sql<number>`coalesce(sum(${lessons.signupCount}), 0)::int`,
    })
    .from(lessons)
    .where(and(...conditions))
    .groupBy(lessons.lecturerId)
    .orderBy(desc(sql`count(*)`), lessons.lecturerId)
    .limit(pageSize)
    .offset((page - 1) * pageSize)
  return rows.flatMap((row) =>
    row.id ? [{ id: row.id, name: row.name, courses: row.courses, students: row.students }] : [],
  )
}

async function findTeacherAggregate(id: string): Promise<TeacherAggregate | undefined> {
  const rows = await dbRead
    .select({
      id: lessons.lecturerId,
      name: sql<string | null>`max(${lessons.lecturerName})`,
      courses: sql<number>`count(*)::int`,
      students: sql<number>`coalesce(sum(${lessons.signupCount}), 0)::int`,
    })
    .from(lessons)
    .where(and(eq(lessons.lecturerId, id), ...publishedLessonConditions()))
    .groupBy(lessons.lecturerId)
    .limit(1)
  const row = rows[0]
  return row?.id
    ? { id: row.id, name: row.name, courses: row.courses, students: row.students }
    : undefined
}

async function findProfiles(ids: string[]) {
  if (ids.length === 0) return []
  return dbRead
    .select({
      id: users.id,
      nickname: users.nickname,
      avatar: users.avatar,
      bio: users.bio,
    })
    .from(users)
    .where(inArray(users.id, ids))
}

async function findFanCounts(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map()
  const rows = await dbRead
    .select({
      id: userFollows.followingId,
      fans: sql<number>`count(*)::int`,
    })
    .from(userFollows)
    .where(inArray(userFollows.followingId, ids))
    .groupBy(userFollows.followingId)
  return new Map(rows.map((row) => [row.id, row.fans]))
}

function toTeacher(
  aggregate: TeacherAggregate,
  profile: { nickname: string | null; avatar: string | null; bio: string | null } | undefined,
  fans: number,
) {
  return {
    id: aggregate.id,
    name: aggregate.name ?? profile?.nickname ?? '',
    avatar: profile?.avatar ?? null,
    title: null,
    intro: profile?.bio ?? null,
    courses: aggregate.courses,
    students: aggregate.students,
    fans,
  }
}

export const teacherRoutes: FastifyPluginAsync = async (server) => {
  server.get('/teacher/list', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, keyword } = parsed.data
    const conditions = publishedLessonConditions()
    if (keyword) conditions.push(ilike(lessons.lecturerName, `%${keyword}%`))

    const [aggregates, totalRows] = await Promise.all([
      findTeacherAggregates(page, pageSize, keyword),
      dbRead
        .select({ total: sql<number>`count(distinct ${lessons.lecturerId})::int` })
        .from(lessons)
        .where(and(...conditions)),
    ])

    const ids = aggregates.map((row) => row.id)
    const [profiles, fansByTeacher] = await Promise.all([findProfiles(ids), findFanCounts(ids)])
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
    const list = aggregates.map((row) =>
      toTeacher(row, profileById.get(row.id), fansByTeacher.get(row.id) ?? 0),
    )
    return reply.send(
      success({ list, total: totalRows[0]?.total ?? 0, page, pageSize }),
    )
  })

  server.get('/teacher/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { id } = parsed.data
    const aggregate = await findTeacherAggregate(id)
    if (!aggregate) {
      return reply.status(404).send(error(404, '讲师不存在'))
    }

    if (!request.userId && hasHumanJwtCredential(request)) {
      try {
        await authenticate(request)
      } catch {
        // 匿名可读:凭据无效只意味着 isFollowed 无从判定,不把详情页变成 401
      }
    }

    const [profiles, fansByTeacher] = await Promise.all([
      findProfiles([id]),
      findFanCounts([id]),
    ])
    let isFollowed = false
    if (request.userId) {
      const rows = await dbRead
        .select({ id: userFollows.id })
        .from(userFollows)
        .where(
          and(eq(userFollows.followerId, request.userId), eq(userFollows.followingId, id)),
        )
        .limit(1)
      isFollowed = rows.length > 0
    }

    return reply.send(
      success({
        ...toTeacher(aggregate, profiles[0], fansByTeacher.get(id) ?? 0),
        isFollowed,
      }),
    )
  })

  server.get('/teacher/:id/courses', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { id } = parsed.data
    const rows = await dbRead
      .select({
        id: lessons.id,
        title: lessons.title,
        coverImage: lessons.coverImage,
        price: lessons.price,
        signupCount: lessons.signupCount,
      })
      .from(lessons)
      .where(
        and(
          eq(lessons.lecturerId, id),
          eq(lessons.isPublished, true),
          eq(lessons.status, 1),
        ),
      )
      .orderBy(desc(lessons.createdAt))
    const list = rows.map((row) => ({
      id: row.id,
      title: row.title,
      coverUrl: row.coverImage,
      price: Math.round(Number(row.price ?? 0) * 100),
      students: row.signupCount,
    }))
    return reply.send(success({ list }))
  })

  server.post('/teacher/:id/follow', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId
    if (!userId) {
      return reply.status(401).send(error(401, 'Authentication required'))
    }
    const parsedId = idParamSchema.safeParse(request.params)
    if (!parsedId.success) {
      return reply.status(400).send(error(400, parsedId.error.issues[0]?.message ?? '参数错误'))
    }
    const parsedBody = followBodySchema.safeParse(request.body ?? {})
    if (!parsedBody.success) {
      return reply.status(400).send(error(400, parsedBody.error.issues[0]?.message ?? '参数错误'))
    }
    const { id } = parsedId.data
    if (id === userId) {
      return reply.status(400).send(error(400, '不能关注自己'))
    }
    const aggregate = await findTeacherAggregate(id)
    if (!aggregate) {
      return reply.status(404).send(error(404, '讲师不存在'))
    }

    if (parsedBody.data.follow) {
      await db
        .insert(userFollows)
        .values({ followerId: userId, followingId: id })
        .onConflictDoNothing()
    } else {
      await db
        .delete(userFollows)
        .where(
          and(eq(userFollows.followerId, userId), eq(userFollows.followingId, id)),
        )
    }
    return reply.send(success({ following: parsedBody.data.follow }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
