import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { asc, eq } from 'drizzle-orm'
import { authenticate } from '../../plugins/auth.js'
import {
  findLessonById,
  findSectionById,
  findChapterById,
  isSignedUp,
} from '../../db/learn-queries.js'
import { db } from '../../db/index.js'
import { lessonChapters, lessonChapterSections } from '@ihui/database'
import { buildSignedVideoUrl } from '../../services/video-sign.js'
import { success, error, parseOrThrow } from '../../utils/response.js'

/**
 * GET /api/learn/lesson/:id/video
 * GET /api/learn/section/:id/video
 *
 * 返回 lesson(首个含视频的小节)或 section 视频的签名 URL
 * (默认 1 小时过期,HMAC-SHA256 签名)。
 * - 课程(lesson):免费课直接放行;付费课需 isSignedUp,返回该课程首个有视频的小节
 * - 小节(section):需所属课程 isSignedUp,直接返回该小节视频
 */

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

export const learnVideoRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Params: { id: string } }>(
    '/lesson/:id/video',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = parseOrThrow(idParamSchema, request.params)
      const userId = request.userId
      if (!userId) return reply.status(401).send(error(401, '未登录'))
      const lesson = await findLessonById(params.id)
      if (!lesson) return reply.status(404).send(error(404, '课程不存在'))
      if (!lesson.isFree) {
        const signed = await isSignedUp(params.id, userId)
        if (!signed) return reply.status(403).send(error(403, '请先报名该课程'))
      }
      // 取课程下首个有视频的小节(按 chapter sortOrder、section sortOrder)
      const sections = await db
        .select({ section: lessonChapterSections, chapter: lessonChapters })
        .from(lessonChapterSections)
        .innerJoin(lessonChapters, eq(lessonChapterSections.chapterId, lessonChapters.id))
        .where(eq(lessonChapters.lessonId, params.id))
        .orderBy(asc(lessonChapters.sortOrder), asc(lessonChapterSections.sortOrder))
        .limit(100)
      const first = sections.find((s) => s.section.videoUrl)
      if (!first?.section.videoUrl) {
        return reply.status(404).send(error(404, '该课程暂无可播放视频'))
      }
      const resourceId = `section:${first.section.id}`
      const signed = buildSignedVideoUrl({
        baseUrl: first.section.videoUrl,
        userId,
        resourceId,
      })
      return reply.send(
        success({
          url: signed.url,
          expiresAt: signed.expiresAt,
          resourceId,
          sectionId: first.section.id,
          mimeType: 'video/mp4',
        }),
      )
    },
  )

  server.get<{ Params: { id: string } }>(
    '/section/:id/video',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = parseOrThrow(idParamSchema, request.params)
      const userId = request.userId
      if (!userId) return reply.status(401).send(error(401, '未登录'))
      const section = await findSectionById(params.id)
      if (!section) return reply.status(404).send(error(404, '小节不存在'))
      if (!section.videoUrl) return reply.status(404).send(error(404, '该小节暂无可播放视频'))
      // 小节通过 chapter 关联到 lesson
      const chapter = await findChapterById(section.chapterId)
      if (!chapter) return reply.status(404).send(error(404, '小节所属章节不存在'))
      const signed = await isSignedUp(chapter.lessonId, userId)
      if (!signed) return reply.status(403).send(error(403, '请先报名该课程'))
      const signedUrl = buildSignedVideoUrl({
        baseUrl: section.videoUrl,
        userId,
        resourceId: `section:${params.id}`,
      })
      return reply.send(
        success({
          url: signedUrl.url,
          expiresAt: signedUrl.expiresAt,
          resourceId: `section:${params.id}`,
          mimeType: 'video/mp4',
        }),
      )
    },
  )
}
