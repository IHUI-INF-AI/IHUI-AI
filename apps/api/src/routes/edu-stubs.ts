import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql, and } from 'drizzle-orm'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { db } from '../db/index.js'
import { lessonTask, lessonSignUps, learnRecord, type LessonTask } from '@ihui/database'
import { findCertificates } from '../db/certificate-queries.js'

const idParamSchema = z.object({ id: z.string().min(1) })

const learnRecordSchema = z.object({
  courseId: z.string().min(1),
  chapterId: z.string().min(1),
  currentTime: z.number().min(0).optional(),
  duration: z.number().min(0).optional(),
})

const uuidSchema = z.string().uuid()

function isUuid(s: string): boolean {
  return uuidSchema.safeParse(s).success
}

export const eduStubRoutes: FastifyPluginAsync = async (server) => {
  server.get('/edu/courses/:id/assignments', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '参数错误'))
    }
    const courseId = parsed.data.id
    if (!isUuid(courseId)) {
      return reply.send(success({ list: [] }))
    }
    try {
      const rows = await db
        .select()
        .from(lessonTask)
        .where(eq(lessonTask.lessonId, courseId))
        .orderBy(desc(lessonTask.createdAt))
        .limit(100)
      const list = rows.map((r: LessonTask) => ({
        id: r.id,
        title: r.title,
        chapterId: r.lessonChapterId,
        sectionId: r.lessonChapterSectionId,
        contentType: r.contentType,
        conditions: r.conditions,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      }))
      return reply.send(success({ list }))
    } catch (e) {
      request.log.error(e)
      return reply.send(success({ list: [] }))
    }
  })

  server.get('/edu/courses/:id/grade', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '参数错误'))
    }
    const courseId = parsed.data.id
    const userId = request.userId
    const defaultGrade = {
      courseId,
      score: 0,
      totalScore: 100,
      passed: false,
      rank: 0,
    }
    if (!userId || !isUuid(courseId)) {
      return reply.send(success(defaultGrade))
    }
    try {
      const rows = await db
        .select({ signup: lessonSignUps })
        .from(lessonSignUps)
        .where(and(eq(lessonSignUps.lessonId, courseId), eq(lessonSignUps.userId, userId)))
        .limit(1)
      const signup = rows[0]?.signup
      if (!signup) {
        return reply.send(success(defaultGrade))
      }
      const score = Number(signup.progress) || 0
      const totalScore = 100
      const passed = signup.status === 2 || score >= 60
      const rankRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(lessonSignUps)
        .where(and(eq(lessonSignUps.lessonId, courseId), sql`${lessonSignUps.progress} > ${score}`))
      const rank = (rankRows[0]?.count ?? 0) + 1
      return reply.send(
        success({
          courseId,
          score,
          totalScore,
          passed,
          rank,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.send(success(defaultGrade))
    }
  })

  server.get('/edu/courses/:id/certificate', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '参数错误'))
    }
    const courseId = parsed.data.id
    const userId = request.userId
    if (!userId) {
      return reply.send(
        success({ courseId, certificateNo: null, issuedAt: null, status: 'not_issued' }),
      )
    }
    try {
      const result = await findCertificates({ page: 1, pageSize: 100, userId })
      const matched = result.list.find((c) => {
        if (c.sourceId && c.sourceId === courseId) return true
        return c.source === 'learn' && c.title.includes(courseId)
      })
      if (!matched) {
        return reply.send(
          success({ courseId, certificateNo: null, issuedAt: null, status: 'not_issued' }),
        )
      }
      return reply.send(
        success({
          courseId,
          certificateId: matched.id,
          certificateNo: matched.certificateNo,
          title: matched.title,
          issuedAt: matched.issuedAt ? matched.issuedAt.toISOString() : null,
          status: matched.status === 1 ? 'issued' : 'revoked',
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.send(
        success({ courseId, certificateNo: null, issuedAt: null, status: 'not_issued' }),
      )
    }
  })

  server.post('/edu/learn-record', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = learnRecordSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { courseId, chapterId, currentTime, duration } = parsed.data
    const userId = request.userId
    let persisted = false
    if (userId && isUuid(courseId) && isUuid(chapterId)) {
      try {
        await db.insert(learnRecord).values({
          memberId: userId,
          lessonId: courseId,
          lessonChapterSectionId: chapterId,
          signUpId: userId,
          learnTime: duration ?? 0,
          maxProgressTime: currentTime ?? 0,
          status: 'progressing',
        })
        persisted = true
      } catch (e) {
        request.log.error(e)
      }
    }
    return reply.send(success({ received: true, persisted, ...parsed.data }))
  })
}
