/**
 * 小程序兼容路由(2026-07-24 立,2026-07-26 真实化 /learn/* + /study/*)
 *
 * 背景:小程序端调用了大量后端缺失的端点,导致 Taro.request fail 弹"网络异常"toast。
 * 本文件补建 49 个端点,其中 18 个 /learn/* + /study/* 已接入真实表 CRUD,
 * 其余保持空数据桩避免 404。
 *
 * 设计原则:
 *  - 大部分端点无需鉴权(公开空桩),/agents/* /distribution/* /agent/* /chat/* /token/* /messages/* 需 checkAuth
 *  - 写操作(POST/PUT/DELETE)需 checkAuth,读操作公开
 *  - 响应格式统一 { code, message, data }
 *  - 真实化端点接入 packages/database 真实表:
 *    lessons / lessonChapters / lessonChapterSections / comments / lessonRecords / lessonRecordLogs / lessonSignUps
 */
import type { FastifyPluginAsync } from 'fastify'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { eq, and, desc, asc, sql, ilike, gte, lt } from 'drizzle-orm' // 新增 gte/lt(2026-07-26 /study/calendar 范围查询)
import { success, error } from '../utils/response.js'
import { checkAuth } from '../plugins/auth.js'
import { db, dbRead } from '../db/index.js'
import {
  lessons,
  lessonChapters,
  lessonChapterSections,
  lessonRecords,
  lessonRecordLogs,
  lessonSignUps,
  comments,
  users,
  userAuthInfo,
  feedbacks,
  userPreferences,
  agents,
  agentCategories,
  agentThumbs,
  agentCollects,
  agentUseDetails,
  zhsUserAgentContext,
  zhsAgentBuy,
  userMargins,
  tokenFlows,
} from '@ihui/database'
import { hashPassword, verifyPassword } from '../utils/password-crypto.js'

/** 分页查询参数(/agents/* + /agent/* + /agents/charge/* 真实化端点共享) */
const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

// =============================================================================
// Zod schemas(仅 /learn/* + /study/* 真实化端点使用)
// =============================================================================

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

const createGroupSchema = z.object({
  title: z.string().min(1).max(200),
  intro: z.string().nullable().optional(),
  coverImage: z.string().max(512).nullable().optional(),
  categoryId: z.uuid().nullable().optional(),
})

const updateCourseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  intro: z.string().nullable().optional(),
  coverImage: z.string().max(512).nullable().optional(),
  categoryId: z.uuid().nullable().optional(),
  lecturerName: z.string().max(100).nullable().optional(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, '价格格式错误')
    .optional(),
  isFree: z.boolean().optional(),
  sort: z.number().int().min(0).optional(),
})

const createVideoSchema = z.object({
  chapterId: z.uuid({ error: '无效的章节 ID' }),
  title: z.string().min(1).max(200),
  content: z.string().nullable().optional(),
  videoUrl: z.string().max(512).nullable().optional(),
  duration: z.number().int().min(0).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isFree: z.boolean().optional(),
})

const updateVideoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().nullable().optional(),
  videoUrl: z.string().max(512).nullable().optional(),
  duration: z.number().int().min(0).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isFree: z.boolean().optional(),
})

const videoCommentsQuerySchema = z.object({
  videoId: z.uuid({ error: '无效的视频 ID' }),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const createVideoCommentSchema = z.object({
  videoId: z.uuid({ error: '无效的视频 ID' }),
  content: z.string().min(1).max(5000),
  parentId: z.uuid().nullable().optional(),
})

const videoLogSchema = z.object({
  videoId: z.uuid().nullable().optional(),
  lessonId: z.uuid().nullable().optional(),
  position: z.number().int().min(0).optional(),
  duration: z.number().int().min(0).optional(),
  action: z.string().max(20).optional(),
})

const studyGroupsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
})

const rankingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

// /study/* 鉴权版端点(2026-07-26 真实化)
const studySigninSchema = z.object({
  lessonId: z.uuid({ error: '无效的课程 ID' }),
})

const studyClockinSchema = z.object({
  lessonId: z.uuid({ error: '无效的课程 ID' }),
  duration: z.number().int().min(0),
  content: z.string().max(5000).optional(),
})

const studyProgressSchema = z.object({
  lessonId: z.uuid({ error: '无效的课程 ID' }),
  chapterId: z.uuid().optional(),
  sectionId: z.uuid().optional(),
  position: z.number().int().min(0),
  duration: z.number().int().min(0),
})

const studyShareSchema = z.object({
  lessonId: z.uuid({ error: '无效的课程 ID' }),
  platform: z.enum(['wechat', 'moments', 'link']).default('link'),
})

const studyCalendarQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, '月份格式错误(YYYY-MM)')
    .optional(),
})

/**
 * 计算用户截至 refDate(默认今天)的连续签到天数。
 * schema 的 lessonSignUps 不存 continuousDays 字段,基于 createdAt::date 倒序扫描统计。
 * 最多扫 60 天(连续签到上限保护),数据库索引 lesson_sign_ups_user_idx 保证高效。
 */
async function calcContinuousDays(userId: string, refDate: Date = new Date()): Promise<number> {
  const rows = await db
    .selectDistinct({ d: sql<string>`${lessonSignUps.createdAt}::date::text` })
    .from(lessonSignUps)
    .where(eq(lessonSignUps.userId, userId))
    .orderBy(desc(sql<string>`${lessonSignUps.createdAt}::date::text`))
    .limit(60)

  if (!rows.length) return 0

  const cursor = new Date(refDate)
  cursor.setHours(0, 0, 0, 0)
  let days = 0
  for (const row of rows) {
    const rowDate = new Date(`${row.d}T00:00:00`)
    if (Number.isNaN(rowDate.getTime())) continue
    if (rowDate.getTime() === cursor.getTime()) {
      days++
      cursor.setDate(cursor.getDate() - 1)
    } else if (rowDate.getTime() < cursor.getTime()) {
      break
    }
  }
  return days
}

export const miniappCompatRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // /learn/* (12 个,课程管理 — 接入 lessons/lessonChapters/lessonChapterSections/comments 真实表)
  // group=lesson,courses=chapters,video=lessonChapterSections
  // ==========================================================================

  // GET /learn/group/:id — 课程分组详情(group=lesson, courses=chapters)
  server.get('/learn/group/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [lessonRows, chapters] = await Promise.all([
      db.select().from(lessons).where(eq(lessons.id, parsed.data.id)).limit(1),
      db
        .select()
        .from(lessonChapters)
        .where(eq(lessonChapters.lessonId, parsed.data.id))
        .orderBy(asc(lessonChapters.sortOrder), asc(lessonChapters.createdAt)),
    ])
    if (!lessonRows[0]) {
      return reply.status(404).send(error(404, '课程分组不存在'))
    }
    return reply.send(
      success({
        group: {
          id: lessonRows[0].id,
          name: lessonRows[0].title,
          intro: lessonRows[0].intro,
          cover: lessonRows[0].coverImage,
          courses: chapters,
        },
      }),
    )
  })

  // POST /learn/group — 创建课程分组(lessons 表)
  server.post('/learn/group', async (request, reply) => {
    const parsed = createGroupSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db
      .insert(lessons)
      .values({
        title: parsed.data.title,
        intro: parsed.data.intro ?? null,
        coverImage: parsed.data.coverImage ?? null,
        categoryId: parsed.data.categoryId ?? null,
      })
      .returning({ id: lessons.id })
    return reply.status(201).send(success({ id: rows[0]!.id }))
  })

  // PUT /learn/course/:id — 更新课程
  server.put('/learn/course/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = updateCourseSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await db
      .select({ id: lessons.id })
      .from(lessons)
      .where(eq(lessons.id, parsed.data.id))
      .limit(1)
    if (!existing[0]) {
      return reply.status(404).send(error(404, '课程不存在'))
    }
    const updated = await db
      .update(lessons)
      .set({
        ...(body.data.title !== undefined ? { title: body.data.title } : {}),
        ...(body.data.intro !== undefined ? { intro: body.data.intro } : {}),
        ...(body.data.coverImage !== undefined ? { coverImage: body.data.coverImage } : {}),
        ...(body.data.categoryId !== undefined ? { categoryId: body.data.categoryId } : {}),
        ...(body.data.lecturerName !== undefined ? { lecturerName: body.data.lecturerName } : {}),
        ...(body.data.price !== undefined ? { price: body.data.price } : {}),
        ...(body.data.isFree !== undefined ? { isFree: body.data.isFree } : {}),
        ...(body.data.sort !== undefined ? { sort: body.data.sort } : {}),
        updatedAt: new Date(),
      })
      .where(eq(lessons.id, parsed.data.id))
      .returning({ id: lessons.id })
    return reply.send(success({ id: updated[0]!.id }))
  })

  // DELETE /learn/course/:id — 软删除课程(status=0, isPublished=false)
  server.delete('/learn/course/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    await db
      .update(lessons)
      .set({ status: 0, isPublished: false, updatedAt: new Date() })
      .where(eq(lessons.id, parsed.data.id))
    return reply.send(success({ id: parsed.data.id }))
  })

  // POST /learn/course/:id/issue — 发布课程(isPublished=true)
  server.post('/learn/course/:id/issue', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    await db
      .update(lessons)
      .set({ isPublished: true, updatedAt: new Date() })
      .where(eq(lessons.id, parsed.data.id))
    return reply.send(success({ id: parsed.data.id, status: 'published' }))
  })

  // POST /learn/course/:id/delist — 下架课程(isPublished=false)
  server.post('/learn/course/:id/delist', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    await db
      .update(lessons)
      .set({ isPublished: false, updatedAt: new Date() })
      .where(eq(lessons.id, parsed.data.id))
    return reply.send(success({ id: parsed.data.id, status: 'draft' }))
  })

  // POST /learn/video — 创建视频小节(lessonChapterSections 表)
  server.post('/learn/video', async (request, reply) => {
    const parsed = createVideoSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db
      .insert(lessonChapterSections)
      .values({
        chapterId: parsed.data.chapterId,
        title: parsed.data.title,
        content: parsed.data.content ?? null,
        videoUrl: parsed.data.videoUrl ?? null,
        duration: parsed.data.duration ?? 0,
        sortOrder: parsed.data.sortOrder ?? 0,
        isFree: parsed.data.isFree ?? false,
      })
      .returning({ id: lessonChapterSections.id })
    return reply.status(201).send(success({ id: rows[0]!.id }))
  })

  // PUT /learn/video/:id — 更新视频小节
  server.put('/learn/video/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = updateVideoSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const updated = await db
      .update(lessonChapterSections)
      .set({
        ...(body.data.title !== undefined ? { title: body.data.title } : {}),
        ...(body.data.content !== undefined ? { content: body.data.content } : {}),
        ...(body.data.videoUrl !== undefined ? { videoUrl: body.data.videoUrl } : {}),
        ...(body.data.duration !== undefined ? { duration: body.data.duration } : {}),
        ...(body.data.sortOrder !== undefined ? { sortOrder: body.data.sortOrder } : {}),
        ...(body.data.isFree !== undefined ? { isFree: body.data.isFree } : {}),
      })
      .where(eq(lessonChapterSections.id, parsed.data.id))
      .returning({ id: lessonChapterSections.id })
    if (!updated[0]) {
      return reply.status(404).send(error(404, '视频不存在'))
    }
    return reply.send(success({ id: updated[0].id }))
  })

  // DELETE /learn/video/:id — 删除视频小节
  server.delete('/learn/video/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    await db.delete(lessonChapterSections).where(eq(lessonChapterSections.id, parsed.data.id))
    return reply.send(success({ id: parsed.data.id }))
  })

  // GET /learn/video/comments — 视频评论列表(comments 表 resourceType='lesson_video')
  server.get('/learn/video/comments', async (request, reply) => {
    const parsed = videoCommentsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { videoId, page, pageSize } = parsed.data
    const where = and(eq(comments.resourceType, 'lesson_video'), eq(comments.resourceId, videoId))
    const [list, totalRows] = await Promise.all([
      db
        .select()
        .from(comments)
        .where(where)
        .orderBy(desc(comments.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(comments)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0 }))
  })

  // POST /learn/video/comment — 创建视频评论(需登录,comments 表 resourceType='lesson_video')
  server.post('/learn/video/comment', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = createVideoCommentSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const rows = await db
      .insert(comments)
      .values({
        userId,
        resourceType: 'lesson_video',
        resourceId: parsed.data.videoId,
        parentId: parsed.data.parentId ?? null,
        content: parsed.data.content,
      })
      .returning({ id: comments.id })
    return reply.status(201).send(success({ id: rows[0]!.id }))
  })

  // POST /learn/video/log — 视频学习日志(需登录,upsert lessonRecords + 追加 lessonRecordLogs)
  server.post('/learn/video/log', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = videoLogSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    // 若提供 lessonId,upsert lessonRecords 并追加 log
    if (parsed.data.lessonId) {
      const conds = [
        eq(lessonRecords.userId, userId),
        eq(lessonRecords.lessonId, parsed.data.lessonId),
      ]
      if (parsed.data.videoId) conds.push(eq(lessonRecords.sectionId, parsed.data.videoId))
      else conds.push(sql`${lessonRecords.sectionId} IS NULL`)
      const existing = await db
        .select()
        .from(lessonRecords)
        .where(and(...conds))
        .limit(1)
      const recordId = existing[0]?.id
      if (recordId) {
        await db
          .update(lessonRecords)
          .set({
            ...(parsed.data.position !== undefined ? { lastPosition: parsed.data.position } : {}),
            updatedAt: new Date(),
          })
          .where(eq(lessonRecords.id, recordId))
        await db.insert(lessonRecordLogs).values({
          recordId,
          userId,
          action: parsed.data.action ?? 'heartbeat',
          position: parsed.data.position ?? 0,
          duration: parsed.data.duration ?? 0,
        })
      }
    }
    return reply.send(success({}))
  })

  // ==========================================================================
  // /study/* (4 个,学习功能 — 接入 lessons/lessonChapterSections/lessonRecords 真实表)
  // 注:studyGroups/studyPlans 表不存在,用 lessons(已发布课程)/lessonSignUps(我的报名)代理
  // ==========================================================================

  // GET /study/groups — 学习分组列表(=已发布课程)
  server.get('/study/groups', async (request, reply) => {
    const parsed = studyGroupsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, search } = parsed.data
    const conds = [eq(lessons.isPublished, true), eq(lessons.status, 1)]
    if (search) conds.push(ilike(lessons.title, `%${search}%`))
    const where = and(...conds)
    const [list, totalRows] = await Promise.all([
      db
        .select({
          id: lessons.id,
          name: lessons.title,
          intro: lessons.intro,
          cover: lessons.coverImage,
          studentCount: lessons.signupCount,
          lessonCount: lessons.lessonCount,
        })
        .from(lessons)
        .where(where)
        .orderBy(desc(lessons.signupCount), desc(lessons.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(lessons)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0 }))
  })

  // GET /study/groups/:id — 学习分组详情(含小节视频列表)
  server.get('/study/groups/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const lessonRows = await db
      .select()
      .from(lessons)
      .where(eq(lessons.id, parsed.data.id))
      .limit(1)
    if (!lessonRows[0]) {
      return reply.status(404).send(error(404, '分组不存在'))
    }
    const lesson = lessonRows[0]
    // 查所有章节的小节作为 videos 列表
    const chapters = await db
      .select()
      .from(lessonChapters)
      .where(eq(lessonChapters.lessonId, parsed.data.id))
      .orderBy(asc(lessonChapters.sortOrder))
    const videos: Array<{
      id: string
      title: string
      url: string | null
      duration: number
      chapterId: string
    }> = []
    for (const ch of chapters) {
      const secs = await db
        .select({
          id: lessonChapterSections.id,
          title: lessonChapterSections.title,
          url: lessonChapterSections.videoUrl,
          duration: lessonChapterSections.duration,
          chapterId: lessonChapterSections.chapterId,
        })
        .from(lessonChapterSections)
        .where(eq(lessonChapterSections.chapterId, ch.id))
        .orderBy(asc(lessonChapterSections.sortOrder))
      videos.push(...secs)
    }
    return reply.send(
      success({
        id: lesson.id,
        name: lesson.title,
        intro: lesson.intro,
        cover: lesson.coverImage,
        videos,
      }),
    )
  })

  // GET /study/videos/:id — 视频小节详情
  server.get('/study/videos/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db
      .select({
        id: lessonChapterSections.id,
        title: lessonChapterSections.title,
        url: lessonChapterSections.videoUrl,
        duration: lessonChapterSections.duration,
        content: lessonChapterSections.content,
        isFree: lessonChapterSections.isFree,
        chapterId: lessonChapterSections.chapterId,
      })
      .from(lessonChapterSections)
      .where(eq(lessonChapterSections.id, parsed.data.id))
      .limit(1)
    if (!rows[0]) {
      return reply.status(404).send(error(404, '视频不存在'))
    }
    return reply.send(success(rows[0]))
  })

  // GET /study/ranking — 学习排行榜(按 lessonRecords 聚合用户:完成数+观看时长)
  server.get('/study/ranking', async (request, reply) => {
    const parsed = rankingQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db.execute(sql`
      SELECT
        lr.user_id,
        u.nickname,
        u.avatar,
        COALESCE(SUM(lr.watch_duration), 0)::int AS watch_duration,
        COUNT(*) FILTER (WHERE lr.status = 2)::int AS completed_count,
        COALESCE(AVG(lr.progress)::int, 0) AS progress
      FROM lesson_records lr
      JOIN users u ON u.id = lr.user_id
      GROUP BY lr.user_id, u.nickname, u.avatar
      ORDER BY completed_count DESC, watch_duration DESC
      LIMIT ${parsed.data.limit}
    `)
    return reply.send(success({ list: rows as Record<string, unknown>[] }))
  })

  // ==========================================================================
  // /study/* 鉴权版(6 个,2026-07-26 真实化 — 接入 lessonRecords / lessonRecordLogs / lessonSignUps)
  // 注:lessonSignUps 实际表无 signinAt/continuousDays 字段,基于 createdAt 倒序计算连续天数
  //     lessonRecords 无 content/meta,progress 上报基于 watchDuration + lastPosition 计算
  //     lessonRecordLogs 无 chapterId/sectionId/meta,chapter/section 维度通过 recordId 关联 lessonRecords
  // ==========================================================================

  // GET /study/info — 学习概览(已登录)
  // 数据源:lessonRecords 聚合(todayMinutes/totalMinutes/courses/completedLessons)
  //        + lesson_sign_ups 派生连续签到天数
  server.get('/study/info', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const [aggr] = await db
      .select({
        todayMinutes: sql<number>`COALESCE(SUM(CASE WHEN ${lessonRecords.createdAt}::date = current_date THEN ${lessonRecords.watchDuration} ELSE 0 END) / 60, 0)::int`,
        totalMinutes: sql<number>`COALESCE(SUM(${lessonRecords.watchDuration}) / 60, 0)::int`,
        courses: sql<number>`COUNT(DISTINCT ${lessonRecords.lessonId})::int`,
        totalLessons: sql<number>`COUNT(*)::int`,
        completedLessons: sql<number>`COUNT(*) FILTER (WHERE ${lessonRecords.status} = 2)::int`,
      })
      .from(lessonRecords)
      .where(eq(lessonRecords.userId, userId))

    const continuousDays = await calcContinuousDays(userId)

    return reply.send(
      success({
        todayMinutes: aggr?.todayMinutes ?? 0,
        totalMinutes: aggr?.totalMinutes ?? 0,
        continuousDays,
        courses: aggr?.courses ?? 0,
        totalLessons: aggr?.totalLessons ?? 0,
        completedLessons: aggr?.completedLessons ?? 0,
      }),
    )
  })

  // POST /study/signin — 学习签到(已登录)
  // 业务逻辑:今天已签到→409;上次签到为昨天→连续+1;否则→重置为 1
  server.post('/study/signin', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const parsed = studySigninSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    // 用 DB 端 current_date 统一时区,避免 JS toISOString 在 +08 时区下偏移一天
    const [todaySignIn] = await db
      .select({ d: sql<string>`${lessonSignUps.createdAt}::date::text` })
      .from(lessonSignUps)
      .where(
        and(eq(lessonSignUps.userId, userId), sql`${lessonSignUps.createdAt}::date = current_date`),
      )
      .limit(1)

    if (todaySignIn) {
      return reply.status(409).send(error(409, '今日已签到'))
    }

    const [yesterdaySignIn] = await db
      .select({ d: sql<string>`${lessonSignUps.createdAt}::date::text` })
      .from(lessonSignUps)
      .where(
        and(
          eq(lessonSignUps.userId, userId),
          sql`${lessonSignUps.createdAt}::date = current_date - interval '1 day'`,
        ),
      )
      .limit(1)

    let continuousDays = 1
    if (yesterdaySignIn) {
      // 以昨天为锚点计算历史连续天数
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const prevStreak = await calcContinuousDays(userId, yesterday)
      continuousDays = prevStreak + 1
    }

    const [inserted] = await db
      .insert(lessonSignUps)
      .values({
        userId,
        lessonId: parsed.data.lessonId,
        status: 1,
        progress: 0,
      })
      .returning({ id: lessonSignUps.id, createdAt: lessonSignUps.createdAt })

    return reply.status(201).send(
      success({
        id: inserted!.id,
        signinAt: inserted!.createdAt,
        continuousDays,
      }),
    )
  })

  // POST /study/clockin — 打卡(已登录)
  // 数据源:upsert lessonRecords(userId + lessonId + sectionId IS NULL)累加 watchDuration
  //        + 今日 lesson_records 聚合返回 todayDuration
  //        + lessonSignUps 派生 streak
  server.post('/study/clockin', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const parsed = studyClockinSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { lessonId, duration } = parsed.data

    // 查找或创建 lesson_record(sectionId=NULL 视为课程级打卡)
    const [existing] = await db
      .select({ id: lessonRecords.id })
      .from(lessonRecords)
      .where(
        and(
          eq(lessonRecords.userId, userId),
          eq(lessonRecords.lessonId, lessonId),
          sql`${lessonRecords.sectionId} IS NULL`,
        ),
      )
      .limit(1)

    let recordId: string
    if (existing) {
      await db
        .update(lessonRecords)
        .set({
          watchDuration: sql`${lessonRecords.watchDuration} + ${duration}`,
          status: sql`GREATEST(${lessonRecords.status}, 1)`,
          updatedAt: new Date(),
        })
        .where(eq(lessonRecords.id, existing.id))
      recordId = existing.id
    } else {
      const [inserted] = await db
        .insert(lessonRecords)
        .values({
          userId,
          lessonId,
          watchDuration: duration,
          status: 1,
        })
        .returning({ id: lessonRecords.id })
      recordId = inserted!.id
    }

    // 今日累计观看时长(秒)+ 连续签到天数
    const [todayAgg] = await db
      .select({
        todayDuration: sql<number>`COALESCE(SUM(${lessonRecords.watchDuration}), 0)::int`,
      })
      .from(lessonRecords)
      .where(
        and(eq(lessonRecords.userId, userId), sql`${lessonRecords.createdAt}::date = current_date`),
      )

    const streak = await calcContinuousDays(userId)

    return reply.send(
      success({
        id: recordId,
        todayDuration: todayAgg?.todayDuration ?? 0,
        streak,
      }),
    )
  })

  // POST /study/progress — 进度上报(已登录)
  // 数据源:find/create lessonRecord(by userId + lessonId + sectionId),progress = position/totalDuration*100
  //        + append lessonRecordLogs(action='progress'|'complete')
  // 业务逻辑:progress >= 100 → status=2 + completedAt=now + action='complete'
  server.post('/study/progress', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const parsed = studyProgressSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { lessonId, chapterId, sectionId, position, duration } = parsed.data

    // 解析 section 总时长(用于计算 progress)
    let totalDuration = 0
    if (sectionId) {
      const [section] = await db
        .select({ duration: lessonChapterSections.duration })
        .from(lessonChapterSections)
        .where(eq(lessonChapterSections.id, sectionId))
        .limit(1)
      totalDuration = section?.duration ?? 0
    }

    // 定位已有记录
    const conds = [
      eq(lessonRecords.userId, userId),
      eq(lessonRecords.lessonId, lessonId),
      sectionId ? eq(lessonRecords.sectionId, sectionId) : sql`${lessonRecords.sectionId} IS NULL`,
    ]
    if (chapterId) conds.push(eq(lessonRecords.chapterId, chapterId))

    const [existing] = await db
      .select({ id: lessonRecords.id, totalDuration: lessonRecords.totalDuration })
      .from(lessonRecords)
      .where(and(...conds))
      .limit(1)

    const effectiveTotal = existing?.totalDuration ?? totalDuration
    const progress =
      effectiveTotal > 0 ? Math.min(100, Math.round((position / effectiveTotal) * 100)) : 0
    const completed = progress >= 100

    let recordId: string
    if (existing) {
      await db
        .update(lessonRecords)
        .set({
          progress,
          status: completed ? 2 : sql`GREATEST(${lessonRecords.status}, 1)`,
          lastPosition: position,
          watchDuration: sql`${lessonRecords.watchDuration} + ${duration}`,
          ...(totalDuration > 0 && existing.totalDuration === 0 ? { totalDuration } : {}),
          ...(completed ? { completedAt: new Date() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(lessonRecords.id, existing.id))
      recordId = existing.id
    } else {
      const [inserted] = await db
        .insert(lessonRecords)
        .values({
          userId,
          lessonId,
          chapterId: chapterId ?? null,
          sectionId: sectionId ?? null,
          watchDuration: duration,
          totalDuration,
          lastPosition: position,
          progress,
          status: completed ? 2 : 1,
          ...(completed ? { completedAt: new Date() } : {}),
        })
        .returning({ id: lessonRecords.id })
      recordId = inserted!.id
    }

    const [log] = await db
      .insert(lessonRecordLogs)
      .values({
        recordId,
        userId,
        action: completed ? 'complete' : 'progress',
        position,
        duration,
      })
      .returning({ id: lessonRecordLogs.id })

    return reply.send(
      success({
        id: log!.id,
        progress,
        completed,
      }),
    )
  })

  // POST /study/share — 分享(已登录)
  // 数据源:find/create lessonRecord + insert lessonRecordLog(action='share')
  //        + 统计 userId 当日 action='share' 条数作为 shareCount
  // 注:lessonRecordLogs 实际表无 meta/platform 字段,platform 仅在响应中透传
  server.post('/study/share', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const parsed = studyShareSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { lessonId, platform } = parsed.data

    const [existing] = await db
      .select({ id: lessonRecords.id })
      .from(lessonRecords)
      .where(
        and(
          eq(lessonRecords.userId, userId),
          eq(lessonRecords.lessonId, lessonId),
          sql`${lessonRecords.sectionId} IS NULL`,
        ),
      )
      .limit(1)

    let recordId: string
    if (existing) {
      recordId = existing.id
    } else {
      const [inserted] = await db
        .insert(lessonRecords)
        .values({
          userId,
          lessonId,
          status: 1,
        })
        .returning({ id: lessonRecords.id })
      recordId = inserted!.id
    }

    const [log] = await db
      .insert(lessonRecordLogs)
      .values({
        recordId,
        userId,
        action: 'share',
        position: 0,
        duration: 0,
      })
      .returning({ id: lessonRecordLogs.id })

    const [shareAgg] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(lessonRecordLogs)
      .where(
        and(
          eq(lessonRecordLogs.userId, userId),
          eq(lessonRecordLogs.action, 'share'),
          sql`${lessonRecordLogs.createdAt}::date = current_date`,
        ),
      )

    return reply.send(
      success({
        shareId: log!.id,
        shareCount: shareAgg?.count ?? 0,
        platform,
      }),
    )
  })

  // GET /study/calendar — 学习日历(已登录,最近 30 天或指定月份)
  // 数据源:lessonRecords 按 createdAt::date 聚合,无数据的日期填 0
  server.get('/study/calendar', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const parsed = studyCalendarQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    let startDate: Date
    let endDate: Date
    if (parsed.data.month) {
      const [yStr, mStr] = parsed.data.month.split('-')
      const y = Number(yStr)
      const m = Number(mStr)
      startDate = new Date(Date.UTC(y, m - 1, 1))
      endDate = new Date(Date.UTC(y, m, 1))
    } else {
      // 用 UTC 零点与 DB current_date(UTC)对齐,避免 setHours(本地零点)+toISOString 偏移一天
      const today = new Date()
      today.setUTCHours(0, 0, 0, 0)
      endDate = new Date(today)
      endDate.setUTCDate(endDate.getUTCDate() + 1)
      startDate = new Date(today)
      startDate.setUTCDate(startDate.getUTCDate() - 29)
    }

    const rows = await db
      .select({
        date: sql<string>`${lessonRecords.createdAt}::date::text`,
        duration: sql<number>`COALESCE(SUM(${lessonRecords.watchDuration}), 0)::int`,
        lessonCount: sql<number>`COUNT(DISTINCT ${lessonRecords.lessonId})::int`,
      })
      .from(lessonRecords)
      .where(
        and(
          eq(lessonRecords.userId, userId),
          gte(lessonRecords.createdAt, startDate),
          lt(lessonRecords.createdAt, endDate),
        ),
      )
      .groupBy(sql`${lessonRecords.createdAt}::date`)
      .orderBy(sql`${lessonRecords.createdAt}::date`)

    const dataMap = new Map(rows.map((r) => [r.date, r]))
    const days: Array<{ date: string; duration: number; lessonCount: number }> = []
    const cursor = new Date(startDate)
    while (cursor < endDate) {
      const dateStr = cursor.toISOString().slice(0, 10)
      const data = dataMap.get(dateStr)
      days.push({
        date: dateStr,
        duration: data?.duration ?? 0,
        lessonCount: data?.lessonCount ?? 0,
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    return reply.send(success({ days }))
  })

  // ==========================================================================
  // /workflows/* (2 个,n8n 工作流)
  // ==========================================================================
  server.get('/workflows/n8n', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  server.post('/workflows/n8n/create', async (_request, reply) => {
    return reply.send(success({ id: Date.now().toString(), status: 'created' }))
  })

  // ==========================================================================
  // /agents/* (6 个,智能体互动,真实化 2026-07-26)
  // 表:agentCategories / agentThumbs(zhs_agent_thumbs) / agentCollects(zhs_agent_collect)
  //     agentUseDetails(zhs_agent_useDetail) / agents(主表 usage_count)
  // uuid=request.userId(JWT),botId=:id(路径参数)
  // ==========================================================================
  server.get('/agents/categories', async (_request, reply) => {
    const list = await dbRead
      .select({
        categoryId: agentCategories.categoryId,
        name: agentCategories.name,
        description: agentCategories.description,
        icon: agentCategories.icon,
        sort: agentCategories.sort,
        isPaid: agentCategories.isPaid,
      })
      .from(agentCategories)
      .where(eq(agentCategories.status, '1'))
      .orderBy(agentCategories.sort)
    return reply.send(success({ list, total: list.length }))
  })

  // 收藏切换:已存在则取消,不存在则新增(对齐 agents.ts /collect 的 toggle 语义)
  server.post('/agents/:id/collect', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { id } = request.params as { id: string }
    const userId = request.userId!
    const [existing] = await dbRead
      .select({ id: agentCollects.id })
      .from(agentCollects)
      .where(and(eq(agentCollects.uuid, userId), eq(agentCollects.botId, id)))
      .limit(1)
    if (existing) {
      await db
        .delete(agentCollects)
        .where(and(eq(agentCollects.uuid, userId), eq(agentCollects.botId, id)))
      return reply.send(success({ id, collected: false, action: 'remove' }))
    }
    await db.insert(agentCollects).values({ uuid: userId, botId: id })
    return reply.send(success({ id, collected: true, action: 'add' }))
  })

  // 点赞切换:已存在则取消,不存在则新增(对齐 agents.ts /thumbs 的 toggle 语义)
  server.post('/agents/:id/like', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { id } = request.params as { id: string }
    const userId = request.userId!
    const [existing] = await dbRead
      .select({ id: agentThumbs.id })
      .from(agentThumbs)
      .where(and(eq(agentThumbs.uuid, userId), eq(agentThumbs.botId, id)))
      .limit(1)
    if (existing) {
      await db
        .delete(agentThumbs)
        .where(and(eq(agentThumbs.uuid, userId), eq(agentThumbs.botId, id)))
      return reply.send(success({ id, liked: false, action: 'remove' }))
    }
    await db.insert(agentThumbs).values({ uuid: userId, botId: id })
    return reply.send(success({ id, liked: true, action: 'add' }))
  })

  // 使用记录:插入 agentUseDetails + agents.usage_count +1(若 agent 存在)
  server.post('/agents/:id/use', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { id } = request.params as { id: string }
    const userId = request.userId!
    await db.insert(agentUseDetails).values({ uuid: userId, botId: id })
    await db
      .update(agents)
      .set({ usageCount: sql`${agents.usageCount} + 1`, updatedAt: new Date() })
      .where(eq(agents.botId, id))
    return reply.send(success({ id, used: true }))
  })

  server.get('/agents/use-history', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const { page, pageSize } = pageQuerySchema.parse(request.query)
    const offset = (page - 1) * pageSize
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(agentUseDetails)
        .where(eq(agentUseDetails.uuid, userId))
        .orderBy(desc(agentUseDetails.lastTime))
        .limit(pageSize)
        .offset(offset),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(agentUseDetails)
        .where(eq(agentUseDetails.uuid, userId)),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  server.get('/agents/collections', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const { page, pageSize } = pageQuerySchema.parse(request.query)
    const offset = (page - 1) * pageSize
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(agentCollects)
        .where(eq(agentCollects.uuid, userId))
        .orderBy(desc(agentCollects.collectTime))
        .limit(pageSize)
        .offset(offset),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(agentCollects)
        .where(eq(agentCollects.uuid, userId)),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  // ==========================================================================
  // /distribution/* (6 个,分销,后端有部分但路径不同,需鉴权)
  // ==========================================================================
  server.get('/distribution/subordinates', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ list: [], total: 0 }))
  })

  server.get('/distribution/invitee-orders', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ list: [], total: 0 }))
  })

  server.get('/distribution/wx-code', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ code: '', url: '' }))
  })

  server.get('/distribution/flow', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ list: [], total: 0 }))
  })

  server.get('/distribution/flow/orders', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ list: [], total: 0 }))
  })

  server.get('/distribution/withdrawal/:id/status', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { id } = request.params as { id: string }
    return reply.send(success({ id, status: 'pending' }))
  })

  // ==========================================================================
  // /knowledge-planet/* (2 个,知识星球)
  // ==========================================================================
  server.get('/knowledge-planet/info', async (_request, reply) => {
    return reply.send(success({ name: '', memberCount: 0, description: '' }))
  })

  server.get('/knowledge-planet/news', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  // ==========================================================================
  // /course-planet (1 个)
  // ==========================================================================
  server.get('/course-planet', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  // ==========================================================================
  // /agent/* (5 个,注意是 /agent 不是 /agents,真实化 2026-07-26)
  // 表:userMargins(token 余额) / zhsUserAgentContext(用户智能体上下文 KV)
  // 注:/agent/creation/share 无对应 shares 表,生成临时分享 id 占位
  // ==========================================================================
  server.get('/agent/tokens', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const [margin] = await dbRead
      .select({
        balance: userMargins.tokenQuantity,
        frozen: userMargins.frozenQuantity,
        updatedAt: userMargins.updatedAt,
      })
      .from(userMargins)
      .where(eq(userMargins.userId, userId))
      .limit(1)
    return reply.send(
      success({
        balance: margin?.balance ?? 0,
        locked: margin?.frozen ?? 0,
        updatedAt: margin?.updatedAt ?? null,
      }),
    )
  })

  server.post('/agent/context', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const body = z
      .object({
        agentId: z.string().min(1).max(64),
        contextKey: z.string().max(200).optional(),
        contextValue: z.string().optional(),
        content: z.string().optional(),
        contentType: z.string().max(20).optional(),
        sessionId: z.string().max(64).optional(),
        role: z.string().max(20).optional(),
        fieldName: z.string().max(200).optional(),
        tokens: z.number().int().min(0).optional(),
      })
      .parse(request.body ?? {})
    const [created] = await db
      .insert(zhsUserAgentContext)
      .values({
        userUuid: userId,
        userId,
        agentId: body.agentId,
        contextKey: body.contextKey,
        contextValue: body.contextValue,
        content: body.content,
        contentType: body.contentType ?? 'text',
        sessionId: body.sessionId,
        role: body.role,
        fieldName: body.fieldName,
        tokens: body.tokens ?? 0,
      })
      .returning()
    if (!created) return reply.status(500).send(error(500, '上下文创建失败'))
    return reply.send(success({ id: String(created.id) }))
  })

  server.get('/agent/context', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const { agentId, page, pageSize } = z
      .object({
        agentId: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(request.query)
    const conds = [eq(zhsUserAgentContext.userUuid, userId)]
    if (agentId) conds.push(eq(zhsUserAgentContext.agentId, agentId))
    const where = and(...conds)
    const offset = (page - 1) * pageSize
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(zhsUserAgentContext)
        .where(where)
        .orderBy(desc(zhsUserAgentContext.createTime))
        .limit(pageSize)
        .offset(offset),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(zhsUserAgentContext)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  server.get('/agent/context/query', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const { agentId, contextKey } = z
      .object({
        agentId: z.string().optional(),
        contextKey: z.string().optional(),
      })
      .parse(request.query)
    const conds = [eq(zhsUserAgentContext.userUuid, userId)]
    if (agentId) conds.push(eq(zhsUserAgentContext.agentId, agentId))
    if (contextKey) conds.push(eq(zhsUserAgentContext.contextKey, contextKey))
    const [row] = await dbRead
      .select()
      .from(zhsUserAgentContext)
      .where(and(...conds))
      .orderBy(desc(zhsUserAgentContext.createTime))
      .limit(1)
    return reply.send(success(row ?? {}))
  })

  // 注:无 shares 表,生成短期 shareId 占位;后续若引入持久化分享表可替换为 insert+returning
  server.post('/agent/creation/share', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const body = z.object({ agentId: z.string().max(64).optional() }).parse(request.body ?? {})
    // 2026-08-02 安全审计加固:用 CSPRNG 替代 Math.random()。
    // shareId 用于分享 URL,Math.random() 可预测 → 攻击者可枚举他人分享链接。
    const shareId = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
    const url = body.agentId ? `/agents/${body.agentId}?share=${shareId}` : ''
    return reply.send(success({ url, id: shareId }))
  })

  // ==========================================================================
  // /chat/* (2 个,需鉴权)
  // ==========================================================================
  server.post('/chat/history', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ id: Date.now().toString() }))
  })

  // ==========================================================================
  // /model/* (2 个)
  // ==========================================================================
  server.post('/model/chat', async (_request, reply) => {
    return reply.send(success({ id: Date.now().toString() }))
  })

  server.delete('/model/chat/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    return reply.send(success({ id }))
  })

  // ==========================================================================
  // /aigc/* (1 个)
  // ==========================================================================
  server.post('/aigc/publish', async (_request, reply) => {
    return reply.send(success({ id: Date.now().toString(), status: 'published' }))
  })

  // ==========================================================================
  // /models/* (1 个)
  // ==========================================================================
  server.get('/models/plaza', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  // ==========================================================================
  // /ranking (1 个,后端有 /ranking/users 等但无 /ranking 根路径)
  // ==========================================================================
  server.get('/ranking', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  // ==========================================================================
  // /token/* (2 个,后端有 /token/balance/:userUuid 但无无参数版本,需鉴权)
  // ==========================================================================
  server.get('/token/balance', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ balance: 0, locked: 0 }))
  })

  server.get('/token/records', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ list: [], total: 0 }))
  })

  // ==========================================================================
  // /messages/* (2 个,需鉴权)
  // ==========================================================================
  server.get('/messages/rooms/:roomId/history', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ list: [], total: 0 }))
  })

  server.post('/messages/rooms/:roomId/read', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { roomId } = request.params as { roomId: string }
    return reply.send(success({ roomId, read: true }))
  })

  // ==========================================================================
  // /agents/charge/* (6 个,智能体收费配置,真实化 2026-07-26)
  // 表:zhsAgentBuy(智能体购买记录) + tokenFlows(支付流水,opType=1 扣减)
  // 注:无独立 agent_charge / agent_charge_pay_history 表,用 zhsAgentBuy + tokenFlows 替代
  // 注意:静态路径 /list 必须在参数路径 /:agentId 之前注册,否则会被 :agentId 捕获
  // ==========================================================================
  server.get('/agents/charge/list', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const { page, pageSize, status } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        status: z.string().max(32).optional(),
      })
      .parse(request.query)
    const conds = [eq(zhsAgentBuy.userId, userId)]
    if (status) conds.push(eq(zhsAgentBuy.status, status))
    const where = and(...conds)
    const offset = (page - 1) * pageSize
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(zhsAgentBuy)
        .where(where)
        .orderBy(desc(zhsAgentBuy.createdAt))
        .limit(pageSize)
        .offset(offset),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(zhsAgentBuy)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  server.get('/agents/charge/:agentId', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { agentId } = request.params as { agentId: string }
    const userId = request.userId!
    const [record] = await dbRead
      .select()
      .from(zhsAgentBuy)
      .where(and(eq(zhsAgentBuy.userId, userId), eq(zhsAgentBuy.agentId, agentId)))
      .orderBy(desc(zhsAgentBuy.createdAt))
      .limit(1)
    if (!record) {
      return reply.send(success({ agentId, chargeType: 'free', amount: 0 }))
    }
    return reply.send(
      success({
        agentId,
        buyId: record.id,
        chargeType: record.status === 'active' ? 'paid' : record.status,
        amount: record.price,
        duration: record.duration,
        expiresAt: record.expiresAt,
        status: record.status,
      }),
    )
  })

  server.post('/agents/charge', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const body = z
      .object({
        agentId: z.string().min(1).max(64),
        agentName: z.string().max(128).optional(),
        price: z.number().min(0),
        duration: z.number().int().min(1).default(30),
        paymentMethod: z.string().max(32).optional(),
        paymentId: z.string().max(128).optional(),
        categoryId: z.number().int().optional(),
        discount: z.number().min(0).max(1).optional(),
        prologue: z.string().optional(),
      })
      .parse(request.body ?? {})
    const expiresAt = new Date(Date.now() + body.duration * 86400000)
    const [created] = await db
      .insert(zhsAgentBuy)
      .values({
        agentId: body.agentId,
        userId,
        price: body.price.toString(),
        duration: body.duration,
        expiresAt,
        status: 'pending',
        paymentMethod: body.paymentMethod,
        paymentId: body.paymentId,
        agentName: body.agentName,
        categoryId: body.categoryId,
        discount: body.discount?.toString() ?? '1.00',
        prologue: body.prologue,
      })
      .returning()
    if (!created) return reply.status(500).send(error(500, '收费记录创建失败'))
    return reply.send(success({ id: created.id }))
  })

  // 支付历史:无 agent_charge_pay_history 表,用 tokenFlows(opType=1 扣减)记录
  // 同时扣减 userMargins.tokenQuantity,保证余额一致性
  server.post('/agents/charge/pay-history', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const body = z
      .object({
        agentId: z.string().max(64).optional(),
        quantity: z.number().int().min(1),
        remark: z.string().max(255).optional(),
        relatedOrderNo: z.string().max(64).optional(),
      })
      .parse(request.body ?? {})
    const [margin] = await dbRead
      .select()
      .from(userMargins)
      .where(eq(userMargins.userId, userId))
      .limit(1)
    const currentBalance = margin?.tokenQuantity ?? 0
    const balanceAfter = Math.max(0, currentBalance - body.quantity)
    const [flow] = await db
      .insert(tokenFlows)
      .values({
        userId,
        opType: 1,
        quantity: body.quantity,
        balanceAfter,
        remark: body.remark ?? `agent charge: ${body.agentId ?? 'unknown'}`,
        relatedOrderNo: body.relatedOrderNo,
      })
      .returning()
    if (!flow) return reply.status(500).send(error(500, '支付流水创建失败'))
    if (margin) {
      await db
        .update(userMargins)
        .set({ tokenQuantity: balanceAfter, updatedAt: new Date() })
        .where(eq(userMargins.userId, userId))
    }
    return reply.send(success({ id: flow.id, balanceAfter }))
  })

  server.put('/agents/charge', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const body = z
      .object({
        id: z.string().min(1),
        status: z.string().max(32).optional(),
        paymentMethod: z.string().max(32).optional(),
        paymentId: z.string().max(128).optional(),
        price: z.number().min(0).optional(),
        duration: z.number().int().min(1).optional(),
      })
      .parse(request.body ?? {})
    const [existing] = await dbRead
      .select({ id: zhsAgentBuy.id })
      .from(zhsAgentBuy)
      .where(and(eq(zhsAgentBuy.id, body.id), eq(zhsAgentBuy.userId, userId)))
      .limit(1)
    if (!existing) {
      return reply.status(404).send(error(404, '收费记录不存在'))
    }
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (body.status) updates.status = body.status
    if (body.paymentMethod) updates.paymentMethod = body.paymentMethod
    if (body.paymentId) updates.paymentId = body.paymentId
    if (body.price !== undefined) updates.price = body.price.toString()
    if (body.duration !== undefined) {
      updates.duration = body.duration
      updates.expiresAt = new Date(Date.now() + body.duration * 86400000)
    }
    const [updated] = await db
      .update(zhsAgentBuy)
      .set(updates)
      .where(eq(zhsAgentBuy.id, body.id))
      .returning()
    return reply.send(success(updated))
  })

  // 软删:status='cancelled'(对齐 zhsAgentBuy 既有 status 枚举,保留审计历史)
  server.delete('/agents/charge/:id', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { id } = request.params as { id: string }
    const userId = request.userId!
    const [existing] = await dbRead
      .select({ id: zhsAgentBuy.id })
      .from(zhsAgentBuy)
      .where(and(eq(zhsAgentBuy.id, id), eq(zhsAgentBuy.userId, userId)))
      .limit(1)
    if (!existing) {
      return reply.status(404).send(error(404, '收费记录不存在'))
    }
    await db
      .update(zhsAgentBuy)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(zhsAgentBuy.id, id))
    return reply.send(success({ id }))
  })

  // ==========================================================================
  // /user/* (6 个,用户中心,需鉴权)
  // 前端用 /user/avatar 等(单数),后端有 /users/:id/avatar(复数+id)
  // 真实化(2026-07-26):接入 users / userAuthInfo / feedbacks 表 CRUD
  // ==========================================================================
  server.get('/user/profile', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const [user] = await db
      .select({
        id: users.id,
        phone: users.phone,
        email: users.email,
        username: users.username,
        nickname: users.nickname,
        avatar: users.avatar,
        bio: users.bio,
        gender: users.gender,
        birthday: users.birthday,
        isVip: users.isVip,
        level: users.level,
        inviteCode: users.inviteCode,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, request.userId!))
      .limit(1)
    if (!user) return reply.status(404).send(error(404, '用户不存在'))
    return reply.send(success(user))
  })

  server.put('/user/avatar', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = z.object({ avatar: z.string().min(1).max(2048) }).safeParse(request.body)
    if (!parsed.success)
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? 'avatar 参数错误'))
    await db
      .update(users)
      .set({ avatar: parsed.data.avatar, updatedAt: new Date() })
      .where(eq(users.id, request.userId!))
    return reply.send(success({ avatar: parsed.data.avatar }))
  })

  server.put('/user/nickname', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = z.object({ nickname: z.string().min(1).max(64) }).safeParse(request.body)
    if (!parsed.success)
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? 'nickname 参数错误'))
    await db
      .update(users)
      .set({ nickname: parsed.data.nickname, updatedAt: new Date() })
      .where(eq(users.id, request.userId!))
    return reply.send(success({ nickname: parsed.data.nickname }))
  })

  server.post('/user/password', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = z
      .object({
        oldPassword: z.string().min(1).max(128),
        newPassword: z.string().min(6).max(128),
      })
      .safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [user] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, request.userId!))
      .limit(1)
    if (
      !user?.passwordHash ||
      !(await verifyPassword(parsed.data.oldPassword, user.passwordHash))
    ) {
      return reply.status(400).send(error(400, '旧密码错误'))
    }
    const passwordHash = await hashPassword(parsed.data.newPassword)
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, request.userId!))
    return reply.send(success({ success: true, updated: true }))
  })

  server.post('/user/realname', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = z
      .object({
        realName: z.string().min(1).max(50),
        idCard: z.string().min(1).max(20),
        authSource: z.string().max(50).optional(),
      })
      .safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { realName, idCard, authSource } = parsed.data
    await db
      .insert(userAuthInfo)
      .values({
        userUuid: request.userId!,
        realName,
        idCard,
        authStatus: 'pending',
        authSource,
      })
      .onConflictDoUpdate({
        target: userAuthInfo.userUuid,
        set: {
          realName,
          idCard,
          authStatus: 'pending',
          authSource,
          rejectReason: null,
          updatedAt: new Date(),
        },
      })
    return reply.send(success({ userUuid: request.userId!, realName, authStatus: 'pending' }))
  })

  server.post('/user/feedback', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = z
      .object({
        content: z.string().min(1).max(5000),
        contact: z.string().max(255).optional(),
        type: z.enum(['bug', 'feature', 'improvement', 'other']).default('other'),
        title: z.string().max(255).optional(),
      })
      .safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const rows = await db
      .insert(feedbacks)
      .values({
        userId: request.userId!,
        type: parsed.data.type,
        title: parsed.data.title ?? parsed.data.type,
        content: parsed.data.content,
        contact: parsed.data.contact ?? null,
      })
      .returning({ id: feedbacks.id })
    return reply.send(success({ id: rows[0]?.id ?? null }))
  })

  // ==========================================================================
  // 单复数别名(2 组,前端用单数,后端用复数)
  // /study/plan → 后端无 studyPlans 表,用 lessonSignUps(我的报名)代理
  // /study/rank → /study/ranking 别名(同聚合查询)
  // ==========================================================================

  // GET /study/plan — 我的学习计划(=我报名的课程列表)
  server.get('/study/plan', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const rows = await db
      .select({
        id: lessonSignUps.id,
        lessonId: lessons.id,
        title: lessons.title,
        cover: lessons.coverImage,
        progress: lessonSignUps.progress,
        status: lessonSignUps.status,
        createdAt: lessonSignUps.createdAt,
      })
      .from(lessonSignUps)
      .innerJoin(lessons, eq(lessonSignUps.lessonId, lessons.id))
      .where(eq(lessonSignUps.userId, userId))
      .orderBy(desc(lessonSignUps.createdAt))
    return reply.send(success({ list: rows as Record<string, unknown>[] }))
  })

  // GET /study/rank — 学习排行榜别名(同 /study/ranking)
  server.get('/study/rank', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = rankingQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db.execute(sql`
      SELECT
        lr.user_id,
        u.nickname,
        u.avatar,
        COALESCE(SUM(lr.watch_duration), 0)::int AS watch_duration,
        COUNT(*) FILTER (WHERE lr.status = 2)::int AS completed_count,
        COALESCE(AVG(lr.progress)::int, 0) AS progress
      FROM lesson_records lr
      JOIN users u ON u.id = lr.user_id
      GROUP BY lr.user_id, u.nickname, u.avatar
      ORDER BY completed_count DESC, watch_duration DESC
      LIMIT ${parsed.data.limit}
    `)
    return reply.send(success({ list: rows as Record<string, unknown>[] }))
  })

  // ==========================================================================
  // /settings/* (6 个,设置,需鉴权)
  // /settings/notification 单数别名(后端有 /settings/notifications 复数,本端点用 group='notification' 区分)
  // /settings/cache/* /language /theme 后端完全缺失 → 接入 userPreferences 表
  // 真实化(2026-07-26):notification/language/theme 接入 userPreferences 表 CRUD;
  //   cache/clear + cache/size 保留空桩(客户端本地缓存,后端无真实状态可返)
  // ==========================================================================
  server.get('/settings/notification', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const list = await db
      .select({
        key: userPreferences.key,
        value: userPreferences.value,
      })
      .from(userPreferences)
      .where(
        and(eq(userPreferences.userId, request.userId!), eq(userPreferences.group, 'notification')),
      )
    const settings = Object.fromEntries(list.map((r) => [r.key, r.value]))
    return reply.send(success({ settings }))
  })

  server.put('/settings/notification', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const body = (request.body as Record<string, unknown> | null) ?? {}
    const userId = request.userId!
    await Promise.all(
      Object.entries(body).map(([key, value]) => {
        const v = value === null || value === undefined ? null : String(value)
        return db
          .insert(userPreferences)
          .values({ userId, group: 'notification', key, value: v })
          .onConflictDoUpdate({
            target: [userPreferences.userId, userPreferences.group, userPreferences.key],
            set: { value: v, updatedAt: new Date() },
          })
      }),
    )
    return reply.send(success({ success: true }))
  })

  // 客户端本地缓存清理(后端无对应状态,保留空桩避免 404)
  server.post('/settings/cache/clear', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ cleared: true }))
  })

  // 客户端本地缓存大小(后端无对应状态,保留空桩避免 404)
  server.get('/settings/cache/size', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ size: '0 B' }))
  })

  server.post('/settings/language', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = z.object({ language: z.string().min(1).max(32) }).safeParse(request.body)
    if (!parsed.success)
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? 'language 参数错误'))
    await db
      .insert(userPreferences)
      .values({
        userId: request.userId!,
        group: 'preferences',
        key: 'language',
        value: parsed.data.language,
      })
      .onConflictDoUpdate({
        target: [userPreferences.userId, userPreferences.group, userPreferences.key],
        set: { value: parsed.data.language, updatedAt: new Date() },
      })
    return reply.send(success({ language: parsed.data.language }))
  })

  server.post('/settings/theme', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = z.object({ theme: z.string().min(1).max(32) }).safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? 'theme 参数错误'))
    await db
      .insert(userPreferences)
      .values({
        userId: request.userId!,
        group: 'preferences',
        key: 'theme',
        value: parsed.data.theme,
      })
      .onConflictDoUpdate({
        target: [userPreferences.userId, userPreferences.group, userPreferences.key],
        set: { value: parsed.data.theme, updatedAt: new Date() },
      })
    return reply.send(success({ theme: parsed.data.theme }))
  })

  // ==========================================================================
  // /ai/kling/image (1 个,可灵图片生成,后端暂无此路由,需鉴权)
  // ==========================================================================
  server.post('/ai/kling/image', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ id: Date.now().toString(), status: 'pending' }))
  })

  // ==========================================================================
  // /courses/buy (1 个,课程购买,前端已有 try/catch 容错,需鉴权)
  // ==========================================================================
  server.post('/courses/buy', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success({ orderId: '', orderNo: '', amount: 0 }))
  })

  // ==========================================================================
  // /privacy + /contact (2 个,公开内容页,无需鉴权)
  // ==========================================================================
  server.get('/privacy', async (_request, reply) => {
    return reply.send(success({ content: '' }))
  })

  server.get('/contact', async (_request, reply) => {
    return reply.send(success({ phone: '', email: '', address: '' }))
  })
}
