// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 移动端课程只读端点(/courses/:id/*)。
 * RN 的课程目录/章节/评论三屏此前各打一条两端都没注册的路径 ⇒ 加载必然失败(屏侧 !success 一律 throw→setError)。
 * 这里按移动端已声明的契约补齐最小读面,数据源全部复用既有 learn 查询。
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { findLessonById, findLessonChapters, findLessonSections } from '../db/learn-queries.js'
import { findRateList } from '../db/learn-extended-queries.js'

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

/** 小节时长在库内是秒,移动端三个屏的契约都是分钟。 */
const toMinutes = (seconds: number) => Math.round(seconds / 60)

async function loadPublishedLesson(rawId: string) {
  const parsed = idParamSchema.safeParse({ id: rawId })
  if (!parsed.success) return { invalid: true as const }
  const lesson = await findLessonById(parsed.data.id)
  if (!lesson || !lesson.isPublished) return { missing: true as const }
  return { lesson }
}

async function loadChaptersWithSections(lessonId: string) {
  const chapters = await findLessonChapters(lessonId)
  return Promise.all(
    chapters.map(async (chapter) => ({
      chapter,
      sections: await findLessonSections(chapter.id),
    })),
  )
}

export const courseMobileRoutes: FastifyPluginAsync = async (server) => {
  // 与 /edu/courses/:id 同一档:课程目录/章节/评价都要登录态,不新开公开读面。
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // GET /courses/:id/catalog - 课程目录(章节为顶层,小节挂 children)
  server.get('/courses/:id/catalog', async (request, reply) => {
    const { id } = request.params as { id: string }
    const found = await loadPublishedLesson(id)
    if ('invalid' in found) return reply.status(400).send(error(400, '无效的 ID'))
    if ('missing' in found) return reply.status(404).send(error(404, '课程不存在'))
    const rows = await loadChaptersWithSections(found.lesson.id)
    // G-31 ①:付费内容不再经本端点裸发 CDN 直链 —— 与本仓详情/播放同一判据,只有
    // 免费课或免费小节才透出 videoUrl;付费小节要地址请走 /api/learn/lessons/:id
    // (已报名者拿到指向 /play 校验点的短时签名地址)。空值不打字段,响应形状不变。
    const lessonFree = found.lesson.isFree
    return reply.send(
      success(
        rows.map(({ chapter, sections }) => ({
          id: chapter.id,
          title: chapter.title,
          type: 'chapter',
          duration: toMinutes(sections.reduce((sum, s) => sum + s.duration, 0)),
          children: sections.map((section) => ({
            id: section.id,
            title: section.title,
            type: 'section',
            duration: toMinutes(section.duration),
            ...(section.videoUrl && (lessonFree || section.isFree)
              ? { videoUrl: section.videoUrl }
              : {}),
          })),
        })),
      ),
    )
  })

  // GET /courses/:id/chapters - 章节列表(带小节数与总时长)
  server.get('/courses/:id/chapters', async (request, reply) => {
    const { id } = request.params as { id: string }
    const found = await loadPublishedLesson(id)
    if ('invalid' in found) return reply.status(400).send(error(400, '无效的 ID'))
    if ('missing' in found) return reply.status(404).send(error(404, '课程不存在'))
    const rows = await loadChaptersWithSections(found.lesson.id)
    return reply.send(
      success(
        rows.map(({ chapter, sections }) => ({
          id: chapter.id,
          title: chapter.title,
          duration: toMinutes(sections.reduce((sum, s) => sum + s.duration, 0)),
          lessonCount: sections.length,
        })),
      ),
    )
  })

  // GET /courses/:id/comments - 课程评价(lesson_rate 已发布行)
  server.get('/courses/:id/comments', async (request, reply) => {
    const { id } = request.params as { id: string }
    const found = await loadPublishedLesson(id)
    if ('invalid' in found) return reply.status(400).send(error(400, '无效的 ID'))
    if ('missing' in found) return reply.status(404).send(error(404, '课程不存在'))
    const result = await findRateList({ lessonId: found.lesson.id, page: 1, pageSize: 50 })
    return reply.send(
      success(
        result.list.map((row) => {
          const scores = [row.contentUtilityScore, row.teacherScore, row.serviceScore].filter(
            (score): score is number => typeof score === 'number',
          )
          const rating = scores.length
            ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
            : 0
          return {
            id: row.id,
            user: row.isAnonymous ? '匿名用户' : '学员',
            content: row.content ?? '',
            rating,
            createdAt: row.createdAt.toISOString(),
          }
        }),
      ),
    )
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
