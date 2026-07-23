/**
 * 学习计划(从 frontend-stub-other-routes.ts 拆分)。
 * GET /study/plans — 学习计划列表(mobile-rn StudyPlanScreen)
 * 基于 lessonSignUps + lessons 聚合,无需新表
 */
import type { FastifyPluginAsync } from 'fastify'
import { eq, and, desc, sql } from 'drizzle-orm'
import { success } from '../../utils/response.js'
import { dbRead } from '../../db/index.js'
import { lessonSignUps, lessons } from '@ihui/database'

export const studyPlanRoutes: FastifyPluginAsync = async (server) => {
  server.get('/study/plans', async (request, reply) => {
    const signups = await dbRead
      .select({
        id: lessonSignUps.id,
        progress: lessonSignUps.progress,
        createdAt: lessonSignUps.createdAt,
        lessonTitle: lessons.title,
        lessonCount: lessons.lessonCount,
      })
      .from(lessonSignUps)
      .innerJoin(lessons, eq(lessons.id, lessonSignUps.lessonId))
      .where(and(eq(lessonSignUps.userId, request.userId!), sql`${lessonSignUps.status} != 3`))
      .orderBy(desc(lessonSignUps.createdAt))
    const plans = signups.map((s) => {
      const targetMinutes = (s.lessonCount ?? 0) * 30
      const completedMinutes = Math.round((targetMinutes * (s.progress ?? 0)) / 100)
      const due = new Date(s.createdAt.getTime() + 30 * 86400_000)
      const progress = s.progress ?? 0
      const status: 'pending' | 'inProgress' | 'completed' =
        progress >= 100 ? 'completed' : progress > 0 ? 'inProgress' : 'pending'
      return {
        id: s.id,
        title: s.lessonTitle,
        courseName: s.lessonTitle,
        targetMinutes,
        completedMinutes,
        dueDate: due.toISOString().slice(0, 10),
        status,
      }
    })
    return reply.send(success(plans))
  })
}
