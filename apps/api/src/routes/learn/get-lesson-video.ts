// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * 返回 lesson(首个含视频的小节)或 section 的短时播放地址。
 * - 课程(lesson):免费课直接放行;付费课需 isSignedUp,返回该课程首个有视频的小节
 * - 小节(section):需所属课程 isSignedUp,直接返回该小节视频
 *
 * G-31 ①:此前这里把 CDN 直链原样返回、只在其后拼 ?uid&rid&exp&sig,而桶侧并不校验这组
 * 自定义参数 ⇒ 签名形同虚设、直链照样可被转发。现在 url 指向本服务 /play 校验点
 * (与详情页签发同一套 payload,不另造 token 格式),由 /play 逐项验签后才 302 到真源;
 * 客户端不合法(过期/篡改/掉权)拿不到可播地址,响应体里也不再出现 CDN 直链。
 */

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

/** 签发指向 G-31 ① 校验点(/play)的短时地址;resourceId 与路径小节 id 同源。 */
function signPlayUrl(request: FastifyRequest, lessonId: string, sectionId: string, userId: string) {
  const host = request.headers.host ?? 'localhost'
  const origin = `${request.protocol ?? 'http'}://${host}`
  return buildSignedVideoUrl({
    baseUrl: `${origin}/api/learn/lessons/${lessonId}/sections/${sectionId}/play`,
    userId,
    resourceId: sectionId,
  })
}

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
      const resourceId = first.section.id
      const signed = signPlayUrl(request, params.id, resourceId, userId)
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
      const signedUrl = signPlayUrl(request, chapter.lessonId, params.id, userId)
      return reply.send(
        success({
          url: signedUrl.url,
          expiresAt: signedUrl.expiresAt,
          resourceId: params.id,
          mimeType: 'video/mp4',
        }),
      )
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
