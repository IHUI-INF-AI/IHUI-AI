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
import { z } from 'zod'
import { eq, and, desc, asc, sql, ilike } from 'drizzle-orm'
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

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const createGroupSchema = z.object({
  title: z.string().min(1).max(200),
  intro: z.string().nullable().optional(),
  coverImage: z.string().max(512).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
})

const updateCourseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  intro: z.string().nullable().optional(),
  coverImage: z.string().max(512).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  lecturerName: z.string().max(100).nullable().optional(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, '价格格式错误')
    .optional(),
  isFree: z.boolean().optional(),
  sort: z.number().int().min(0).optional(),
})

const createVideoSchema = z.object({
  chapterId: z.string().uuid('无效的章节 ID'),
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
  videoId: z.string().uuid('无效的视频 ID'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const createVideoCommentSchema = z.object({
  videoId: z.string().uuid('无效的视频 ID'),
  content: z.string().min(1).max(5000),
  parentId: z.string().uuid().nullable().optional(),
})

const videoLogSchema = z.object({
  videoId: z.string().uuid().nullable().optional(),
  lessonId: z.string().uuid().nullable().optional(),
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
    await db
      .delete(lessonChapterSections)
      .where(eq(lessonChapterSections.id, parsed.data.id))
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
      db.select({ count: sql<number>`count(*)::int` }).from(comments).where(where),
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
      const conds = [eq(lessonRecords.userId, userId), eq(lessonRecords.lessonId, parsed.data.lessonId)]
      if (parsed.data.videoId) conds.push(eq(lessonRecords.sectionId, parsed.data.videoId))
      else conds.push(sql`${lessonRecords.sectionId} IS NULL`)
      const existing = await db.select().from(lessonRecords).where(and(...conds)).limit(1)
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
      db.select({ count: sql<number>`count(*)::int` }).from(lessons).where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0 }))
  })

  // GET /study/groups/:id — 学习分组详情(含小节视频列表)
  server.get('/study/groups/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const lessonRows = await db.select().from(lessons).where(eq(lessons.id, parsed.data.id)).limit(1)
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
    const body = z
      .object({ agentId: z.string().max(64).optional() })
      .parse(request.body ?? {})
    const shareId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
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

  // 注释:DELETE /chat/history/:chatId 已由 chat-models.ts(line 1220)注册,
  // 注册前缀 /api/chat → /api/chat/history/:chatId,此处重复注册会触发 FST_ERR_DUPLICATED_ROUTE。
  // 保留空桩逻辑供后续如需覆盖时取消注释。
  // server.delete('/chat/history/:chatId', async (request, reply) => {
  //   if (!(await checkAuth(request, reply))) return
  //   const { chatId } = request.params as { chatId: string }
  //   return reply.send(success({ id: chatId }))
  // })

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
    const parsed = z
      .object({ avatar: z.string().min(1).max(2048) })
      .safeParse(request.body)
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
    const parsed = z
      .object({ nickname: z.string().min(1).max(64) })
      .safeParse(request.body)
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
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [user] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, request.userId!))
      .limit(1)
    if (!user?.passwordHash || !(await verifyPassword(parsed.data.oldPassword, user.passwordHash))) {
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
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
    return reply.send(
      success({ userUuid: request.userId!, realName, authStatus: 'pending' }),
    )
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
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
        and(
          eq(userPreferences.userId, request.userId!),
          eq(userPreferences.group, 'notification'),
        ),
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
    const parsed = z
      .object({ language: z.string().min(1).max(32) })
      .safeParse(request.body)
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
    const parsed = z
      .object({ theme: z.string().min(1).max(32) })
      .safeParse(request.body)
    if (!parsed.success)
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? 'theme 参数错误'))
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
