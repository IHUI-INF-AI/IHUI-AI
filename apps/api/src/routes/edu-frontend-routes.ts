/**
 * 前端 edu 模块路由补建。
 * 来源：api-routes-missing.json 中未匹配到后端路由的调用。
 * 策略：接入真实 DB 查询与业务逻辑,鉴权后返回真实数据(含 PDFKit 证书生成)。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import PDFKit from 'pdfkit'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { booleanStringSchemaOptional } from '../utils/parse-boolean.js'
import { db } from '../db/index.js'
import {
  learnTopicLesson,
  lessons,
  lessonRecords,
  eduOrders,
  eduLiveCategory,
  eduLiveChannel,
  examSignups,
  examPapers,
  eduClassesSchedules,
  eduClassesMembers,
} from '@ihui/database'
import { eq, and, desc, asc, sql } from 'drizzle-orm'
import { findCertificates, findCertificateById } from '../db/certificate-queries.js'
import {
  findLessonById,
  findLessonChapters,
  findLessonSections,
  findPublishedLessons,
  findMyLessons,
  findSignUp,
} from '../db/learn-queries.js'
import {
  findAllTopics,
  findTopicRowById,
  findHomeworkList,
  findRateList,
  findRateByUserLesson,
  createRate,
  createHomeworkRecord,
  findPublishedMaps,
  findAllCommunityPosts,
  createCommunityPost,
} from '../db/learn-extended-queries.js'
import {
  findPublishedPapers,
  findPaperById,
  findMyExamRecords,
  submitExamRecord,
  createExamRecord,
} from '../db/exam-queries.js'
import { getLessonProgress, getProgressOverview } from '../db/learn-record-queries.js'
import { createOrder, cancelOrder } from '../db/order-queries.js'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const searchSchema = paginationSchema.extend({
  search: z.string().max(200).optional(),
  categoryId: z.uuid().optional(),
})

const createNoteSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  content: z.string().min(1).max(10000),
  isPublic: z.boolean().optional(),
  sectionId: z.string().optional(),
})

const createQASchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(10000).nullable().optional(),
})

const submitExamSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.uuid(),
        answer: z.unknown(),
      }),
    )
    .min(1, '答案不能为空'),
})

const submitHomeworkSchema = z.object({
  url: z.string().min(1, '作业链接不能为空').max(3000),
})

const createRateSchema = z.object({
  content: z.string().max(2000).optional(),
  contentUtilityScore: z.number().int().min(1).max(5).optional(),
  teacherScore: z.number().int().min(1).max(5).optional(),
  serviceScore: z.number().int().min(1).max(5).optional(),
  isAnonymous: z.boolean().optional(),
})

const lessonCompleteSchema = z.object({
  status: z.number().int().min(0).max(3).optional(),
  progress: z.number().int().min(0).max(100).optional(),
})

// 教育端直播查询 schema(edu_live_channel / edu_live_category,serial id)。
// category: 分类 id(整数);isLive: "true"/"false" 显式解析,避免 z.coerce.boolean 误判。
const liveChannelsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  category: z.coerce.number().int().positive().optional(),
  isLive: booleanStringSchemaOptional,
})

const createEduOrderSchema = z.object({
  orderType: z.enum(['course', 'card']).default('course'),
  targetId: z.string().min(1, '课程 ID 不能为空').max(64),
  targetTitle: z.string().min(1, '课程名称不能为空').max(200),
  quantity: z.number().int().min(1).max(99).default(1),
})

const myEduOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'paid', 'cancelled']).optional(),
})

export const eduFrontendRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // ===========================================================================
  // 证书 (/edu/certificates)
  // ===========================================================================

  // GET /edu/certificates - 我的证书列表
  server.get('/edu/certificates', async (request, reply) => {
    const parsed = paginationSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findCertificates({
      ...parsed.data,
      userId: request.userId!,
      status: 1,
    })
    return reply.send(success(result))
  })

  // GET /edu/certificates/:id - 证书详情
  server.get('/edu/certificates/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const cert = await findCertificateById(parsed.data.id)
    if (!cert) return reply.status(404).send(error(404, '证书不存在'))
    return reply.send(success({ certificate: cert }))
  })

  // POST /edu/certificates/:id/download - 下载证书 PDF
  server.post('/edu/certificates/:id/download', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const cert = await findCertificateById(parsed.data.id)
    if (!cert) return reply.status(404).send(error(404, '证书不存在'))
    if (cert.userId !== request.userId) {
      return reply.status(403).send(error(403, '无权下载此证书'))
    }
    const doc = new PDFKit({ size: 'A4', layout: 'landscape', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
    })
    doc.fontSize(28).font('Helvetica-Bold').text(cert.title, { align: 'center' }).moveDown(2)
    doc
      .fontSize(14)
      .font('Helvetica')
      .text(`Certificate No: ${cert.certificateNo ?? '-'}`, { align: 'center' })
      .moveDown()
      .text(`Recipient: ${cert.recipientName ?? '-'}`, { align: 'center' })
      .moveDown()
      .text(
        `Issued At: ${cert.issuedAt ? new Date(cert.issuedAt).toISOString().split('T')[0] : '-'}`,
        { align: 'center' },
      )
      .moveDown(2)
      .fontSize(10)
      .fillColor('#999')
      .text('This certificate is electronically generated and verifiable.', { align: 'center' })
    doc.end()
    const pdfBuffer = await pdfPromise
    reply
      .header('Content-Type', 'application/pdf')
      .header(
        'Content-Disposition',
        `attachment; filename="certificate-${cert.certificateNo ?? cert.id}.pdf"`,
      )
      .send(pdfBuffer)
  })

  // ===========================================================================
  // 课程 (/edu/courses)
  // ===========================================================================

  // GET /edu/courses - 已发布课程列表
  server.get('/edu/courses', async (request, reply) => {
    const parsed = searchSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findPublishedLessons(parsed.data)
    return reply.send(success(result))
  })

  // GET /edu/courses/:id - 课程详情(含章节+小节)
  server.get('/edu/courses/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const lesson = await findLessonById(parsed.data.id)
    if (!lesson || !lesson.isPublished) {
      return reply.status(404).send(error(404, '课程不存在'))
    }
    const chapters = await findLessonChapters(parsed.data.id)
    const chaptersWithSections = await Promise.all(
      chapters.map(async (c) => ({
        ...c,
        sections: await findLessonSections(c.id),
      })),
    )
    return reply.send(success({ lesson, chapters: chaptersWithSections }))
  })

  // GET /edu/courses/:id/sections - 课程章节+小节(扁平结构)
  server.get('/edu/courses/:id/sections', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const chapters = await findLessonChapters(parsed.data.id)
    const sections = await Promise.all(
      chapters.map(async (c) => ({
        chapter: c,
        sections: await findLessonSections(c.id),
      })),
    )
    return reply.send(success({ list: sections, total: sections.length }))
  })

  // GET /edu/courses/:id/qa - 课程问答帖列表
  server.get('/edu/courses/:id/qa', async (request, reply) => {
    const parsed = paginationSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findAllCommunityPosts({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      search: undefined,
      status: 'published',
    })
    const filtered = result.list.filter((p) => p.lessonId === idParsed.data.id)
    return reply.send(
      success({
        list: filtered,
        total: filtered.length,
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
      }),
    )
  })

  // POST /edu/courses/:id/notes - 课程笔记创建
  server.post('/edu/courses/:id/notes', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = createNoteSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { createNote } = await import('../db/edu-extended-queries.js')
    const note = await createNote({
      lessonId: parsed.data.id,
      userId: request.userId!,
      title: bodyParsed.data.title,
      content: bodyParsed.data.content,
      isPublic: bodyParsed.data.isPublic,
    })
    return reply.status(201).send(success({ note }))
  })

  // POST /edu/courses/:id/qa - 课程问答帖创建
  server.post('/edu/courses/:id/qa', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = createQASchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const post = await createCommunityPost({
      userId: request.userId!,
      title: bodyParsed.data.title,
      content: bodyParsed.data.content ?? null,
      lessonId: parsed.data.id,
      status: 'published',
      isPinned: false,
    })
    return reply.status(201).send(success({ post }))
  })

  // GET /edu/courses/:id/progress - 课程学习进度
  server.get('/edu/courses/:id/progress', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const signup = await findSignUp(parsed.data.id, userId)
    if (!signup) {
      return reply.status(404).send(error(404, '未报名该课程'))
    }
    const recordProgress = await getLessonProgress(userId, parsed.data.id)
    return reply.send(
      success({
        progress: signup.progress,
        status: signup.status,
        watchDuration: recordProgress?.watchDuration ?? 0,
        totalDuration: recordProgress?.totalDuration ?? 0,
        lastPosition: recordProgress?.lastPosition ?? 0,
        sectionProgress: recordProgress?.sectionProgress ?? [],
      }),
    )
  })

  // ===========================================================================
  // 学习仪表盘 (/edu/dashboard, /edu/progress, /edu/nav, /edu/schedule)
  // ===========================================================================

  // GET /edu/dashboard - 学习仪表盘汇总
  server.get('/edu/dashboard', async (request, reply) => {
    const userId = request.userId!
    const lessonsResult = await findMyLessons(userId, { page: 1, pageSize: 100 })
    const completedCourses = lessonsResult.list.filter((s) => s.status === 2).length
    const inProgressLessons = lessonsResult.list.filter((s) => s.status === 1).length
    const avgProgress =
      lessonsResult.list.length > 0
        ? Math.round(
            lessonsResult.list.reduce((sum, s) => sum + (s.progress ?? 0), 0) /
              lessonsResult.list.length,
          )
        : 0
    const examResult = await findMyExamRecords(userId, { page: 1, pageSize: 100 })
    const passedExams = examResult.list.filter((r) => r.isPassed).length
    const avgScore =
      examResult.list.length > 0
        ? Math.round(
            examResult.list.reduce((sum, r) => sum + Number(r.score ?? 0), 0) /
              examResult.list.length,
          )
        : 0
    const certResult = await findCertificates({
      page: 1,
      pageSize: 100,
      userId,
      status: 1,
    })
    // 学习时长(从 lessonRecords 聚合)
    const [durationRow] = await db
      .select({ total: sql<number>`COALESCE(sum(${lessonRecords.watchDuration})::int, 0)` })
      .from(lessonRecords)
      .where(eq(lessonRecords.userId, userId))
    const studyHours = Math.round(((durationRow?.total ?? 0) / 3600) * 10) / 10
    // 最近学习的课程(按 updatedAt 倒序取前 6)
    const recentRecords = await db
      .select({
        id: lessonRecords.lessonId,
        title: lessons.title,
        progress: lessonRecords.progress,
        lastLearnAt: lessonRecords.updatedAt,
      })
      .from(lessonRecords)
      .innerJoin(lessons, eq(lessonRecords.lessonId, lessons.id))
      .where(eq(lessonRecords.userId, userId))
      .orderBy(desc(lessonRecords.updatedAt))
      .limit(6)
    const recentCourses = recentRecords.map((r) => ({
      id: r.id,
      title: r.title,
      progress: r.progress,
      lastLearnAt: r.lastLearnAt.toISOString(),
    }))
    // 2026-08-07 修复:返回结构与前端契约对齐(平铺字段)。
    // 此前返回 list[] 分组结构,前端读 data.totalCourses 等恒为 0 → 仪表盘全 0。
    return reply.send(
      success({
        totalCourses: lessonsResult.total,
        completedCourses,
        inProgressCourses: inProgressLessons,
        avgProgress,
        studyHours,
        totalExams: examResult.total,
        passedExams,
        avgScore,
        totalCerts: certResult.total,
        recentCourses,
      }),
    )
  })

  // GET /edu/progress - 我的学习进度概览(聚合统计)
  server.get('/edu/progress', async (request, reply) => {
    const userId = request.userId!
    const overview = await getProgressOverview(userId)
    return reply.send(success(overview))
  })

  // GET /edu/nav - 学习导航(分类+地图)
  server.get('/edu/nav', async (_request, reply) => {
    const { findPublishedCategories } = await import('../db/learn-queries.js')
    const [categories, maps] = await Promise.all([findPublishedCategories(), findPublishedMaps()])
    return reply.send(
      success({
        list: [
          { type: 'category', items: categories },
          { type: 'map', items: maps },
        ],
        total: 2,
      }),
    )
  })

  // GET /edu/schedule - 我的课程表(考试报名+班级课程)
  server.get('/edu/schedule', async (request, reply) => {
    const userId = request.userId!
    const items: Array<{
      id: string
      title: string
      instructor: string
      weekday: number
      startTime: string
      endTime: string
      location?: string
      type: string
    }> = []

    // 1. 考试报名日程
    const examRows = await db
      .select({
        id: examSignups.id,
        paperTitle: examPapers.title,
        createdAt: examSignups.createdAt,
        status: examSignups.status,
      })
      .from(examSignups)
      .innerJoin(examPapers, eq(examSignups.paperId, examPapers.id))
      .where(eq(examSignups.userId, userId))
      .orderBy(desc(examSignups.createdAt))
      .limit(20)
    for (const row of examRows) {
      const d = new Date(row.createdAt)
      items.push({
        id: `exam_${row.id}`,
        title: row.paperTitle,
        instructor: '',
        weekday: (d.getDay() + 6) % 7, // 0=周一
        startTime: d.toISOString().slice(11, 16),
        endTime: '',
        type: 'exam',
      })
    }

    // 2. 班级课程排期(表可能尚未迁移,优雅降级)
    try {
      const classRows = await db
        .select({
          id: eduClassesSchedules.id,
          lessonName: eduClassesSchedules.lessonName,
          teacherName: eduClassesSchedules.teacherName,
          scheduledAt: eduClassesSchedules.scheduledAt,
          durationMinutes: eduClassesSchedules.durationMinutes,
          location: eduClassesSchedules.location,
          status: eduClassesSchedules.status,
        })
        .from(eduClassesSchedules)
        .innerJoin(
          eduClassesMembers,
          and(
            eq(eduClassesSchedules.classId, eduClassesMembers.classId),
            eq(eduClassesMembers.userId, userId),
            eq(eduClassesMembers.status, 'active'),
          ),
        )
        .where(eq(eduClassesSchedules.status, 'scheduled'))
        .orderBy(desc(eduClassesSchedules.scheduledAt))
        .limit(50)
      for (const row of classRows) {
        const d = new Date(row.scheduledAt)
        const end = new Date(d.getTime() + (row.durationMinutes ?? 60) * 60000)
        items.push({
          id: `class_${row.id}`,
          title: row.lessonName ?? '',
          instructor: row.teacherName ?? '',
          weekday: (d.getDay() + 6) % 7,
          startTime: d.toISOString().slice(11, 16),
          endTime: end.toISOString().slice(11, 16),
          location: row.location ?? undefined,
          type: 'class',
        })
      }
    } catch {
      // edu_classes_schedules / edu_classes_members 表尚未迁移,跳过班级课程排期
    }

    return reply.send(success({ list: items, total: items.length }))
  })

  // ===========================================================================
  // 考试 (/edu/exam)
  // ===========================================================================

  // GET /edu/exam - 已发布试卷列表
  server.get('/edu/exam', async (request, reply) => {
    const parsed = searchSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { list, total } = await findPublishedPapers({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      search: parsed.data.search,
      categoryId: parsed.data.categoryId,
    })
    return reply.send(
      success({
        list,
        total,
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
      }),
    )
  })

  // GET /edu/exam/:id - 试卷详情(不含答案)
  server.get('/edu/exam/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const paper = await findPaperById(parsed.data.id)
    if (!paper || !paper.isPublished) {
      return reply.status(404).send(error(404, '试卷不存在'))
    }
    return reply.send(success({ paper }))
  })

  // POST /edu/exam/:id/submit - 提交试卷并自动判分
  server.post('/edu/exam/:id/submit', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = submitExamSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const record = await createExamRecord(parsed.data.id, userId)
    try {
      const result = await submitExamRecord(
        record.id,
        userId,
        bodyParsed.data.answers as Array<{ questionId: string; answer: unknown }>,
      )
      return reply.send(success({ record, result }))
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('不存在') || msg.includes('无权')) {
        return reply.status(404).send(error(404, msg))
      }
      if (msg.includes('已提交')) {
        return reply.status(409).send(error(409, msg))
      }
      throw e
    }
  })

  // GET /edu/notes - 我的笔记列表
  // 2026-08-07 补:前端 edu/notes 页调用此路由,此前仅 POST/PUT/DELETE,
  // 无 GET 列表 → 前端 404"加载失败"。复用 findNotesList(与 /edu/my-notes 同源)。
  server.get('/edu/notes', async (request, reply) => {
    const parsed = searchSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { findNotesList } = await import('../db/edu-extended-queries.js')
    const result = await findNotesList({ ...parsed.data, userId: request.userId! })
    return reply.send(success(result))
  })

  // GET /edu/qa - 综合问答帖列表(不绑定课程)
  // 2026-08-07 补:前端 edu/qa 页调用此路由,此前仅 POST 无 GET → 前端 404。
  // 复用 findAllCommunityPosts(与 /learn 社区帖子同源,lessonId 为空的问答帖)。
  server.get('/edu/qa', async (request, reply) => {
    const parsed = searchSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const status = parsed.data.search === undefined ? 'published' : undefined
    const result = await findAllCommunityPosts({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      search: parsed.data.search,
      status,
    })
    return reply.send(success(result))
  })

  // POST /edu/qa - 综合问答帖创建(不绑定课程)
  server.post('/edu/qa', async (request, reply) => {
    const bodyParsed = createQASchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const post = await createCommunityPost({
      userId: request.userId!,
      title: bodyParsed.data.title,
      content: bodyParsed.data.content ?? null,
      lessonId: null,
      status: 'published',
      isPinned: false,
    })
    return reply.status(201).send(success({ post }))
  })

  // ===========================================================================
  // 学习地图 (/learn/map, /learn/topics)
  // ===========================================================================

  // GET /learn/map - 学习地图列表(别名 /learn/maps)
  server.get('/learn/map', async (_request, reply) => {
    const list = await findPublishedMaps()
    return reply.send(success({ list, total: list.length }))
  })

  // GET /learn/topics - 已发布专题列表(公开浏览)
  server.get('/learn/topics', async (request, reply) => {
    const parsed = paginationSchema
      .extend({
        search: z.string().max(200).optional(),
        status: z.string().max(50).optional(),
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findAllTopics({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      search: parsed.data.search,
      status: parsed.data.status ?? 'published',
    })
    return reply.send(success(result))
  })

  // GET /learn/topics/:id - 专题详情
  server.get('/learn/topics/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const topic = await findTopicRowById(parsed.data.id)
    if (!topic) return reply.status(404).send(error(404, '专题不存在'))
    return reply.send(success({ topic }))
  })

  // GET /learn/topics/:id/lessons - 专题下的课程列表
  server.get('/learn/topics/:id/lessons', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db
      .select({ lesson: lessons })
      .from(learnTopicLesson)
      .innerJoin(lessons, eq(learnTopicLesson.lessonId, lessons.id))
      .where(and(eq(learnTopicLesson.topicId, parsed.data.id), eq(lessons.isPublished, true)))
      .orderBy(desc(lessons.createdAt))
    return reply.send(success({ list: rows.map((r) => r.lesson), total: rows.length }))
  })

  // ===========================================================================
  // 课程作业与评价 (/learn/:id/homework, /learn/:id/rates)
  // ===========================================================================

  // GET /learn/:id/homework - 课程作业列表
  server.get('/learn/:id/homework', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const list = await findHomeworkList(parsed.data.id)
    return reply.send(success({ list, total: list.length }))
  })

  // POST /learn/:id/homework/:hwId/submit - 学员提交作业
  server.post('/learn/:id/homework/:hwId/submit', async (request, reply) => {
    const paramsSchema = z.object({
      id: z.uuid({ error: '无效的课程 ID' }),
      hwId: z.uuid({ error: '无效的作业 ID' }),
    })
    const parsed = paramsSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = submitHomeworkSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const signup = await findSignUp(parsed.data.id, userId)
    if (!signup) {
      return reply.status(403).send(error(403, '未报名该课程,无法提交作业'))
    }
    const record = await createHomeworkRecord({
      memberId: userId,
      lessonId: parsed.data.id,
      url: bodyParsed.data.url,
      signUpId: signup.id,
    })
    return reply.status(201).send(success({ record }))
  })

  // POST /learn/lessons/:id - 标记课程学习状态(完成/进度更新)
  server.post('/learn/lessons/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = lessonCompleteSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const signup = await findSignUp(parsed.data.id, userId)
    if (!signup) {
      return reply.status(404).send(error(404, '未报名该课程'))
    }
    const { updateProgress } = await import('../db/learn-queries.js')
    const updated = await updateProgress(
      parsed.data.id,
      userId,
      bodyParsed.data.progress ?? signup.progress,
    )
    return reply.status(201).send(
      success({
        progress: updated?.progress ?? bodyParsed.data.progress ?? signup.progress,
        status: updated?.status ?? signup.status,
      }),
    )
  })

  // GET /learn/:id/rates - 课程评价列表
  server.get('/learn/:id/rates', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const queryParsed = paginationSchema.safeParse(request.query)
    if (!queryParsed.success) {
      return reply.status(400).send(error(400, queryParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findRateList({
      lessonId: parsed.data.id,
      page: queryParsed.data.page,
      pageSize: queryParsed.data.pageSize,
    })
    return reply.send(success(result))
  })

  // POST /learn/:id/rates - 创建课程评价
  server.post('/learn/:id/rates', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = createRateSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const existing = await findRateByUserLesson(userId, parsed.data.id)
    if (existing) {
      return reply.status(409).send(error(409, '已评价过该课程'))
    }
    const rate = await createRate({
      lessonId: parsed.data.id,
      userId,
      content: bodyParsed.data.content,
      contentUtilityScore: bodyParsed.data.contentUtilityScore,
      teacherScore: bodyParsed.data.teacherScore,
      serviceScore: bodyParsed.data.serviceScore,
      isAnonymous: bodyParsed.data.isAnonymous,
    })
    return reply.status(201).send(success({ rate }))
  })

  // ===========================================================================
  // 课程商城订单 (/edu/orders)
  // ===========================================================================

  // POST /edu/orders - 创建课程订单(仅 pending,下单后待支付)
  server.post(
    '/edu/orders',
    {
      schema: {
        summary: '创建课程订单',
        tags: ['edu'],
        body: { type: 'object', additionalProperties: true },
      },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = createEduOrderSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { orderType, targetId, targetTitle, quantity } = parsed.data
      // 服务端反查课程真实价格与标题(防客户端篡改金额/标题)
      const [course] = await db
        .select({
          id: lessons.id,
          title: lessons.title,
          price: lessons.price,
          isFree: lessons.isFree,
        })
        .from(lessons)
        .where(and(eq(lessons.id, targetId), eq(lessons.isPublished, true)))
        .limit(1)
      const finalTitle = course?.title ?? targetTitle
      const payAmount = course ? (course.isFree ? '0.00' : Number(course.price).toFixed(2)) : '0.00'
      // Phase 3: 使用 createOrder 双写 eduOrders + orders
      const order = await createOrder({
        userId: request.userId!,
        orderType,
        targetId,
        targetTitle: finalTitle,
        quantity,
        originalPrice: payAmount,
        discountAmount: '0.00',
        payAmount,
      })
      return reply.status(201).send(success({ order }))
    },
  )

  // GET /edu/orders/my - 我的课程订单列表(status 过滤 + 分页)
  server.get('/edu/orders/my', async (request, reply) => {
    const parsed = myEduOrdersQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, status } = parsed.data
    const conds = [eq(eduOrders.userId, request.userId!), eq(eduOrders.orderType, 'course')]
    if (status) conds.push(eq(eduOrders.status, status))
    const whereCond = and(...conds)
    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(eduOrders)
        .where(whereCond)
        .orderBy(desc(eduOrders.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(eduOrders)
        .where(whereCond),
    ])
    return reply.send(success({ list: rows, total: countRows[0]?.count ?? 0, page, pageSize }))
  })

  // POST /edu/orders/:id/cancel - 取消课程订单(仅本人,pending → cancelled)
  server.post(
    '/edu/orders/:id/cancel',
    {
      schema: {
        summary: '取消课程订单',
        tags: ['edu'],
        body: { type: 'object', additionalProperties: true },
      },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const [existing] = await db
        .select()
        .from(eduOrders)
        .where(and(eq(eduOrders.id, parsed.data.id), eq(eduOrders.userId, request.userId!)))
        .limit(1)
      if (!existing) return reply.status(404).send(error(404, '订单不存在'))
      if (existing.status !== 'pending') {
        return reply.status(400).send(error(400, '订单状态不允许取消'))
      }
      // Phase 3: 使用 cancelOrder 双写同步 eduOrders + orders
      const order = await cancelOrder(parsed.data.id)
      if (!order) return reply.status(400).send(error(400, '订单状态不允许取消'))
      return reply.send(success({ order }))
    },
  )

  // ===========================================================================
  // 教育端直播 (/edu/live,数据源 edu_live_channel / edu_live_category)
  // 2026-08-07 立:与 legacy live(基于 liveChannels uuid 表,路径 /live/*)区分,
  // 使用 /edu/live/* 命名空间,避免 FST_ERR_DUPLICATED_ROUTE 冲突。
  // ===========================================================================

  // GET /edu/live/channels - 已发布直播频道列表(分页 + 分类/直播状态过滤)
  server.get('/edu/live/channels', async (request, reply) => {
    const parsed = liveChannelsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, category, isLive } = parsed.data
    const conds = [eq(eduLiveChannel.isPublished, true), eq(eduLiveChannel.status, 1)]
    if (category !== undefined) conds.push(eq(eduLiveChannel.categoryId, category))
    if (isLive !== undefined) conds.push(eq(eduLiveChannel.isLive, isLive))
    const whereCond = and(...conds)
    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(eduLiveChannel)
        .where(whereCond)
        .orderBy(
          desc(eduLiveChannel.isLive),
          asc(eduLiveChannel.sort),
          desc(eduLiveChannel.startTime),
        )
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(eduLiveChannel)
        .where(whereCond),
    ])
    const list = rows.map((r) => ({
      id: r.id,
      title: r.title,
      categoryId: r.categoryId ?? null,
      cover: r.coverImage ?? null,
      streamUrl: r.playUrl ?? null,
      isLive: r.isLive,
      startTime: r.startTime ? r.startTime.toISOString() : null,
      endTime: r.endTime ? r.endTime.toISOString() : null,
      description: r.intro ?? null,
    }))
    return reply.send(success({ list, total: countRows[0]?.count ?? 0, page, pageSize }))
  })

  // GET /edu/live/categories - 直播分类列表(启用状态)
  server.get('/edu/live/categories', async (_request, reply) => {
    const rows = await db
      .select({ id: eduLiveCategory.id, name: eduLiveCategory.name, sort: eduLiveCategory.sort })
      .from(eduLiveCategory)
      .where(eq(eduLiveCategory.status, 1))
      .orderBy(asc(eduLiveCategory.sort), asc(eduLiveCategory.id))
    return reply.send(
      success({
        list: rows.map((r) => ({ id: r.id, name: r.name })),
        total: rows.length,
      }),
    )
  })
}
