/**
 * Course 模块 /course/*(5 个端点:顶层 GET + 报名 + 进度 + 完成 + 我的课程)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { sql } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db } from '../../db/index.js'
import { lessons } from '@ihui/database'
import { authenticate } from '../../plugins/auth.js'
import {
  findMyLessons,
  signUpLesson,
  isSignedUp,
  findSignUp,
  updateProgress,
} from '../../db/learn-queries.js'
import { parsePagination, parseIdParam } from './_shared.js'

const courseRoutes: FastifyPluginAsync = async (server) => {
  server.get('/course', async (request, reply) => {
    await authenticate(request)
    const q = parsePagination(request, reply)
    if (!q) return
    const { keyword, categoryId, status } = request.query as Record<string, string | undefined>
    const conds = [sql`TRUE`]
    if (keyword) conds.push(sql`${lessons.title} ILIKE ${`%${keyword}%`}`)
    if (status !== undefined) conds.push(sql`${lessons.status} = ${Number(status)}`)
    if (categoryId) conds.push(sql`${lessons.categoryId} = ${categoryId}`)
    const where = sql.join(conds, sql` AND `)
    const offset = (q.page - 1) * q.pageSize
    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(lessons)
        .where(where)
        .orderBy(sql`${lessons.createdAt} DESC`)
        .limit(q.pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(lessons)
        .where(where),
    ])
    const list = rows.map((r) => ({
      id: r.id,
      title: r.title,
      cover: r.coverImage ?? null,
      description: r.intro ?? '',
      categoryId: r.categoryId ?? '',
      categoryName: '',
      instructor: r.lecturerName ?? '',
      instructorAvatar: null,
      price: Number(r.price ?? 0),
      originalPrice:
        r.originalPrice !== null && r.originalPrice !== undefined ? Number(r.originalPrice) : null,
      lessonCount: 0,
      studentCount: 0,
      rating: 0,
      level: '',
      tags: [],
      isEnrolled: false,
      isFree: Number(r.price ?? 0) === 0,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }))
    return reply.send(
      success({
        list,
        total: Number(totalRows[0]?.count ?? 0),
        page: q.page,
        pageSize: q.pageSize,
      }),
    )
  })

  server.post('/course/:id/enroll', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const userId = request.userId!
    const already = await isSignedUp(id, userId)
    if (!already) await signUpLesson(id, userId)
    return reply.status(201).send(success({ success: true, enrolled: !already }))
  })

  server.get('/course/:id/progress', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const signup = await findSignUp(id, request.userId!)
    if (!signup) return reply.status(404).send(error(404, '未报名该课程'))
    return reply.send(
      success({
        progress: signup.progress,
        status: signup.status,
        completedLessons: signup.status >= 2 ? 1 : 0,
        totalLessons: 1,
      }),
    )
  })

  server.post('/course/lesson-complete', async (request, reply) => {
    const body = (request.body as { lessonId?: string } | null) ?? {}
    if (!body.lessonId) return reply.status(400).send(error(400, '缺少 lessonId'))
    const updated = await updateProgress(body.lessonId, request.userId!, 100)
    if (!updated) return reply.status(404).send(error(404, '未报名该课程'))
    return reply.send(
      success({ success: true, progress: updated.progress, status: updated.status }),
    )
  })

  server.get('/course/my', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findMyLessons(request.userId!, { page: q.page, pageSize: q.pageSize })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })
}

export default courseRoutes
