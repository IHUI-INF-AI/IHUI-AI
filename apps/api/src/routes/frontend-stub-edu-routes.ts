/**
 * 前端 edu 模块路由补建。
 * 来源：api-routes-missing.json 中未匹配到后端路由的调用。
 * 策略：接入真实 DB 查询与业务逻辑,鉴权后返回真实数据(含 PDFKit 证书生成)。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import PDFKit from 'pdfkit'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { db } from '../db/index.js'
import { learnTopicLesson, lessons, examSignUp, examExam } from '@ihui/database'
import { eq, and, desc, sql } from 'drizzle-orm'
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
import { getLessonProgress } from '../db/learn-record-queries.js'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const searchSchema = paginationSchema.extend({
  search: z.string().max(200).optional(),
  categoryId: z.string().uuid().optional(),
})

const createNoteSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  content: z.string().min(1).max(10000),
  isPublic: z.boolean().optional(),
})

const createQASchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(10000).nullable().optional(),
})

const submitExamSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
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

// =============================================================================
// 鉴权辅助
// =============================================================================

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
}

export const frontendStubEduRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return
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
    const completedLessons = lessonsResult.list.filter((s) => s.status === 2).length
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
    return reply.send(
      success({
        list: [
          {
            type: 'lessons',
            total: lessonsResult.total,
            completed: completedLessons,
            inProgress: inProgressLessons,
            avgProgress,
          },
          {
            type: 'exams',
            total: examResult.total,
            passed: passedExams,
            avgScore,
          },
          { type: 'certificates', total: certResult.total },
        ],
        total: 3,
      }),
    )
  })

  // GET /edu/progress - 我的学习进度概览
  server.get('/edu/progress', async (request, reply) => {
    const parsed = paginationSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findMyLessons(request.userId!, parsed.data)
    const list = result.list.map((s) => ({
      courseId: s.id,
      title: s.title,
      progress: s.progress,
      status: s.status,
      lastStudiedAt: s.updatedAt,
    }))
    return reply.send(success({ list, total: result.total }))
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

  // GET /edu/schedule - 我的考试报名日程
  server.get('/edu/schedule', async (request, reply) => {
    const rows = await db
      .select({
        signup: examSignUp,
        examName: examExam.name,
        examImage: examExam.image,
        startTime: examExam.startTime,
        endTime: examExam.endTime,
      })
      .from(examSignUp)
      .leftJoin(examExam, eq(examSignUp.examId, examExam.id))
      .where(eq(examSignUp.memberId, sql`(${request.userId})::bigint`))
      .orderBy(desc(examSignUp.createdAt))
      .limit(100)
    const list = rows.map((r) => ({
      id: r.signup.id,
      examId: r.signup.examId,
      status: r.signup.status,
      examName: r.examName,
      examImage: r.examImage,
      startTime: r.startTime ? r.startTime.toISOString() : null,
      endTime: r.endTime ? r.endTime.toISOString() : null,
    }))
    return reply.send(success({ list, total: list.length }))
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
      id: z.string().uuid('无效的课程 ID'),
      hwId: z.string().uuid('无效的作业 ID'),
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
}
