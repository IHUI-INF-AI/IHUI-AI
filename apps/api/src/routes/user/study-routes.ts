/**
 * 学习记录 /study/*(6 个端点)。
 *
 * ## 设计行为说明(2026-07-26 立,防前端误用)
 *
 * - `GET /study/progress`:返回**当前用户已报名课程的平均 progress 百分比**(`Math.round(Σ progress / N)`)。
 *   当用户**无任何学习记录**时,`progress = 0`(不是错误)。前端展示可据此显示"未开始学习"占位。
 *   **该端点不接受 sectionId 参数**(只按 userId 全局聚合);章节级进度请走 `/study/records`。
 *
 * - `GET /study/statistics`:返回用户**总学时 / 课程数 / 完成数 / 连续天数(continuousDays)**。
 *   `continuousDays` 从 lessonSignUps.createdAt DISTINCT DATE 反推,基于**数据库 UTC 时间**与服务器当前时间比较;
 *   若客户端时区偏移(例如 +08:00)且服务器使用 UTC,跨日边界可能在用户视角偏移 8 小时。
 *   (2026-07-26 已修 calcContinuousDays 时区 SQL,见 commit `ad8e96536`。)
 *
 * - `POST /study/records`:**幂等报名**(调用 `signUpLesson`),重复报名同一 lessonId 不会重复插入。
 *
 * - `PUT /study/records/:id`:仅更新 `progress` / `status` 字段;status 映射 `in_progress=1 / completed=2 / paused=1`。
 *
 * ## 鉴权
 *
 * 所有端点通过 `preHandler: [authenticate]` 注入 `request.userId`;
 * 无 token 或 token 过期 → 401;非当前用户的记录访问 → 404(防 IDOR 越权)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db } from '../../db/index.js'
import { lessonSignUps, lessons, lessonChapters, lessonChapterSections } from '@ihui/database'
import {
  findMyLessons,
  signUpLesson,
  updateProgress,
  findSignUp,
  findSignUpById,
  updateSignUpById,
} from '../../db/learn-queries.js'
import { parsePagination, parseIdParam } from './_shared.js'

const studyRoutes: FastifyPluginAsync = async (server) => {
  server.get('/study/records', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findMyLessons(request.userId!, { page: q.page, pageSize: q.pageSize })
    const list = result.list.map((item) => ({
      id: item.id,
      userId: request.userId,
      courseId: item.categoryId,
      courseTitle: item.title,
      lessonId: item.id,
      lessonTitle: item.title,
      duration: 0,
      progress: item.progress,
      status: item.signupStatus >= 2 ? 'completed' : 'in_progress',
      lastStudyAt: item.signupCreatedAt.toISOString(),
      createdAt: item.signupCreatedAt.toISOString(),
    }))
    return reply.send(success({ list, total: result.total, page: q.page, pageSize: q.pageSize }))
  })

  server.get('/study/records/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const signup = await findSignUpById(id, request.userId!)
    if (!signup) return reply.status(404).send(error(404, '学习记录不存在'))
    return reply.send(
      success({
        record: {
          id: signup.id,
          userId: signup.userId,
          lessonId: signup.lessonId,
          progress: signup.progress,
          status: signup.status >= 2 ? 'completed' : 'in_progress',
          createdAt: signup.createdAt.toISOString(),
        },
      }),
    )
  })

  server.post('/study/records', async (request, reply) => {
    const body = z
      .object({
        courseId: z.string().optional(),
        lessonId: z.string().optional(),
        duration: z.number().optional(),
        progress: z.number().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, '参数错误'))
    }
    const userId = request.userId!
    const lessonId = body.data.lessonId ?? body.data.courseId
    if (!lessonId) {
      return reply.status(400).send(error(400, '缺少 lessonId/courseId'))
    }
    await signUpLesson(lessonId, userId)
    if (body.data.progress !== undefined) {
      await updateProgress(lessonId, userId, body.data.progress)
    }
    const signup = await findSignUp(lessonId, userId)
    return reply.status(201).send(
      success({
        record: {
          id: signup?.id ?? lessonId,
          userId,
          lessonId,
          courseId: body.data.courseId ?? null,
          duration: body.data.duration ?? 0,
          progress: signup?.progress ?? 0,
          status: signup ? (signup.status >= 2 ? 'completed' : 'in_progress') : 'in_progress',
          createdAt: signup?.createdAt ?? new Date().toISOString(),
        },
      }),
    )
  })

  server.put('/study/records/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = z
      .object({
        progress: z.number().optional(),
        status: z.enum(['in_progress', 'completed', 'paused']).optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, '参数错误'))
    }
    const userId = request.userId!
    const statusMap = { in_progress: 1, completed: 2, paused: 1 } as const
    const updated = await updateSignUpById(id, userId, {
      progress: body.data.progress,
      status: body.data.status ? statusMap[body.data.status] : undefined,
    })
    if (!updated) return reply.status(404).send(error(404, '学习记录不存在或未报名'))
    return reply.send(
      success({
        record: {
          id: updated.id,
          userId,
          lessonId: updated.lessonId,
          progress: updated.progress,
          status: updated.status >= 2 ? 'completed' : 'in_progress',
          updatedAt: new Date().toISOString(),
        },
      }),
    )
  })

  server.get('/study/progress', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findMyLessons(request.userId!, { page: q.page, pageSize: q.pageSize })
    const completed = result.list.filter((l) => l.progress >= 100).length
    return reply.send(
      success({
        progress:
          result.list.length > 0
            ? Math.round(result.list.reduce((s, l) => s + l.progress, 0) / result.list.length)
            : 0,
        totalCourses: result.total,
        completedCourses: completed,
      }),
    )
  })

  server.get('/study/progress/all', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findMyLessons(request.userId!, { page: q.page, pageSize: q.pageSize })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/study/statistics', async (request, reply) => {
    const userId = request.userId!
    const activeCond = and(eq(lessonSignUps.userId, userId), sql`${lessonSignUps.status} != 3`)

    const [signupStats] = await db
      .select({
        totalCourses: sql<number>`count(DISTINCT ${lessonSignUps.lessonId})::int`,
        completedCourses: sql<number>`count(*) FILTER (WHERE ${lessonSignUps.status} = 2)::int`,
        totalLessons: sql<number>`count(*)::int`,
      })
      .from(lessonSignUps)
      .where(activeCond)

    const [durationStats] = await db
      .select({
        totalDuration: sql<number>`COALESCE(SUM(${lessonChapterSections.duration}), 0)::int`,
      })
      .from(lessonSignUps)
      .innerJoin(lessons, eq(lessonSignUps.lessonId, lessons.id))
      .innerJoin(lessonChapters, eq(lessonChapters.lessonId, lessons.id))
      .innerJoin(lessonChapterSections, eq(lessonChapterSections.chapterId, lessonChapters.id))
      .where(activeCond)

    // P0 fix(2026-07-26):PG session timezone=Asia/Shanghai,
    // DATE(timestamptz) 返回本地日期导致 UTC 边界错位。
    // AT TIME ZONE 'UTC' 强制按 UTC 提取日期,与 streak 循环 toISOString 一致。
    const dateRows = await db
      .select({
        d: sql<string>`DISTINCT (${lessonSignUps.createdAt} AT TIME ZONE 'UTC')::date::text`,
      })
      .from(lessonSignUps)
      .where(activeCond)
      .orderBy(sql`((${lessonSignUps.createdAt} AT TIME ZONE 'UTC')::date)::text DESC`)
      .limit(365)

    const dateSet = new Set(dateRows.map((r) => r.d))
    let streak = 0
    // P0 fix(2026-07-26 第二轮):streak 循环此前用 setDate(本地) + toISOString,
    // 当本地时间处于凌晨(Asia/Shanghai 00:00-08:00)时,toISOString 返回的是
    // "昨天 UTC"日期,与 dateSet(UTC 日期)对不上,导致今天有签到也算 streak=1。
    // 修复:loop 完全用 UTC 日期算术,与 SQL AT TIME ZONE 'UTC' 一致。
    const now = new Date()
    const todayUtc = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
    for (let i = 0; i < 365; i++) {
      const check = new Date(`${todayUtc}T00:00:00Z`)
      check.setUTCDate(check.getUTCDate() - i)
      const ds = check.toISOString().slice(0, 10)
      if (dateSet.has(ds)) {
        streak++
      } else if (i > 0) {
        break
      }
    }

    return reply.send(
      success({
        totalDuration: durationStats?.totalDuration ?? 0,
        totalCourses: signupStats?.totalCourses ?? 0,
        completedCourses: signupStats?.completedCourses ?? 0,
        totalLessons: signupStats?.totalLessons ?? 0,
        completedLessons: signupStats?.completedCourses ?? 0,
        continuousDays: streak,
      }),
    )
  })
}

export default studyRoutes
