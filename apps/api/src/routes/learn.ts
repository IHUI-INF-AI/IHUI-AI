import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { desc } from 'drizzle-orm'
import { authenticate, checkAuth } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import {
  findPublishedCategories,
  findAllCategories,
  findLearnCategoryById,
  createLearnCategory,
  updateLearnCategory,
  deleteLearnCategory,
  findPublishedLessons,
  findAllLessons,
  findLessonById,
  findLessonByIdAdmin,
  createLesson,
  updateLesson,
  deleteLesson,
  incrementViewCount,
  findLessonChapters,
  findChapterById,
  createChapter,
  updateChapter,
  deleteChapter,
  findLessonSections,
  findSectionById,
  createSection,
  updateSection,
  deleteSection,
  findMyLessons,
  signUpLesson,
  findSignUp,
  updateProgress,
  findAdminSignups,
  updateSignupStatus,
  batchSignUp,
  getLessonStudyReport,
  getLessonSignReport,
  findLessonStudyReport,
  findUserLearnRecords,
} from '../db/learn-queries.js'
import {
  upsertRecord,
  updateWatchPosition,
  getLessonProgress,
  getRanking,
  findSignUpRecord,
} from '../db/learn-record-queries.js'
import {
  findHomeworkList,
  findHomeworkById,
  createHomework,
  updateHomework,
  deleteHomework,
  findMapById,
  deleteMap,
  publishMap,
  updateMap,
  insertMap,
  findPublishedMaps,
  findMapListPaged,
  findMapTopics,
  setMapTopics,
  findTasksByLesson,
  findTaskById,
  createTask,
  updateTask,
  deleteTask,
  setTaskStatus,
  findRateList,
  findRateById,
  findRateByUserLesson,
  createRate,
  deleteRate,
  findAccessByLesson,
  updateLessonAccess,
  findInvoiceApplicationList,
  updateInvoiceApplicationStatus,
  findInvoiceTitleList,
  findInvoiceTitleById,
  createInvoiceTitle,
  updateInvoiceTitle,
  deleteInvoiceTitle,
  findCompanyStudyReport,
  findAllTopics,
  findTopicRowById,
  createTopicRow,
  updateTopicRow,
  deleteTopicRow,
  getLessonExamPaperId,
  setLessonExamPaperId,
  setLessonCertificateId,
  createHomeworkRecord,
  findMyHomeworkRecords,
  auditHomeworkRecord,
  findAllCommunityPosts,
  createCommunityPost,
  updateCommunityPost,
  deleteCommunityPost,
} from '../db/learn-extended-queries.js'
import { success, error } from '../utils/response.js'
import { db } from '../db/index.js'
import { learnHomework } from '@ihui/database'
import { eduLessonTopicCategories } from '@ihui/database'
import { eq, and, sql as dsql } from 'drizzle-orm'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const chapterParamSchema = z.object({
  id: z.string().uuid('无效的 ID'),
  chapterId: z.string().uuid('无效的章节 ID'),
})

const lessonsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z
    .preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : v),
      z.string().uuid('无效的分类 ID'),
    )
    .optional(),
  search: z.string().max(200).optional(),
})

const myLessonsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const updateProgressSchema = z.object({
  progress: z.number().int().min(0).max(100),
})

const heartbeatSchema = z.object({
  sectionId: z.string().uuid('无效的小节 ID').nullable().optional(),
  chapterId: z.string().uuid('无效的章节 ID').nullable().optional(),
  position: z.number().int().min(0),
  duration: z.number().int().min(0),
})

const rankingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

const createLearnCategorySchema = z.object({
  name: z.string().min(1).max(100),
  pid: z.string().uuid().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const updateLearnCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  pid: z.string().uuid().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

// ----- Topic Categories (学习专题分类) -----
const topicCategoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
})

const createTopicCategorySchema = z.object({
  name: z.string().min(1).max(100),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const updateTopicCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const createLessonSchema = z.object({
  title: z.string().min(1).max(200),
  coverImage: z.string().max(512).nullable().optional(),
  intro: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  lecturerId: z.string().uuid().nullable().optional(),
  lecturerName: z.string().max(100).nullable().optional(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, '价格格式错误')
    .optional(),
  originalPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, '价格格式错误')
    .nullable()
    .optional(),
  isFree: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).optional(),
})

const updateLessonSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  coverImage: z.string().max(512).nullable().optional(),
  intro: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  lecturerId: z.string().uuid().nullable().optional(),
  lecturerName: z.string().max(100).nullable().optional(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, '价格格式错误')
    .optional(),
  originalPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, '价格格式错误')
    .nullable()
    .optional(),
  isFree: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).optional(),
})

const createChapterSchema = z.object({
  title: z.string().min(1).max(200),
  sortOrder: z.number().int().min(0).optional(),
})

const updateChapterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

const sectionParamSchema = z.object({
  id: z.string().uuid('无效的 ID'),
  chapterId: z.string().uuid('无效的章节 ID'),
  sectionId: z.string().uuid('无效的小节 ID'),
})

const createSectionSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().nullable().optional(),
  videoUrl: z.string().max(512).nullable().optional(),
  duration: z.number().int().min(0).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isFree: z.boolean().optional(),
})

const updateSectionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().nullable().optional(),
  videoUrl: z.string().max(512).nullable().optional(),
  duration: z.number().int().min(0).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isFree: z.boolean().optional(),
})

const adminSignupsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  lessonId: z.string().uuid().optional(),
  status: z.coerce.number().int().min(0).max(3).optional(),
  search: z.string().max(200).optional(),
})

const updateSignupStatusSchema = z.object({
  status: z.number().int().min(0).max(3),
})

const batchSignUpSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(500),
})

const reportQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

// 扩展模块 Zod schemas

const homeworkParamSchema = z.object({
  id: z.string().uuid('无效的 ID'),
  hwId: z.string().uuid('无效的作业 ID'),
})

const createHomeworkSchema = z.object({
  chapterId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  content: z.unknown().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.string().max(20).optional(),
})

const updateHomeworkSchema = z.object({
  chapterId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  content: z.unknown().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.string().max(20).optional(),
})

const submitHomeworkRecordSchema = z.object({
  url: z.string().min(1, '作业链接不能为空').max(3000),
})

const auditHomeworkSchema = z.object({
  status: z.enum(['approved', 'rejected']),
})

const homeworkListQuerySchema = z.object({
  status: z.string().max(20).optional(),
})

const homeworkIdParamSchema = z.object({ hid: z.string().uuid('无效的作业记录 ID') })

const examPaperSchema = z.object({
  examPaperId: z.string().uuid().nullable(),
})

const certificateSchema = z.object({
  certificateTemplateId: z.string().uuid().nullable(),
})

const invoiceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().max(20).optional(),
  search: z.string().max(200).optional(),
})

const invoiceTitleParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const createInvoiceTitleSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.string().min(1).max(50),
  taxNo: z.string().min(1).max(50),
  bank: z.string().max(100).nullable().optional(),
  bankAccount: z.string().max(100).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  isDefault: z.boolean().optional(),
})

const updateInvoiceTitleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: z.string().min(1).max(50).optional(),
  taxNo: z.string().min(1).max(50).optional(),
  bank: z.string().max(100).nullable().optional(),
  bankAccount: z.string().max(100).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  isDefault: z.boolean().optional(),
})

const companyStudyReportQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().max(200).optional(),
})

const lessonSortOrderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        sort: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(500),
})

const lessonIdParamSchema = z.object({ lessonId: z.string().uuid('无效的课程 ID') })

const lessonTaskIdParamSchema = z.object({
  lessonId: z.string().uuid('无效的课程 ID'),
  taskId: z.string().uuid('无效的任务 ID'),
})

const createTaskSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  lessonChapterId: z.string().uuid().nullable().optional(),
  lessonChapterSectionId: z.string().uuid().nullable().optional(),
  contentType: z.string().max(50).nullable().optional(),
  conditions: z.string().nullable().optional(),
  status: z.enum(['enable', 'disable']).optional(),
})

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  lessonChapterId: z.string().uuid().nullable().optional(),
  lessonChapterSectionId: z.string().uuid().nullable().optional(),
  contentType: z.string().max(50).nullable().optional(),
  conditions: z.string().nullable().optional(),
  status: z.enum(['enable', 'disable']).optional(),
})

const createRateSchema = z.object({
  content: z.string().max(2000).optional(),
  contentUtilityScore: z.number().int().min(1).max(5).optional(),
  teacherScore: z.number().int().min(1).max(5).optional(),
  serviceScore: z.number().int().min(1).max(5).optional(),
  isAnonymous: z.boolean().optional(),
  signId: z.string().uuid().nullable().optional(),
})

const rateListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const updateAccessSchema = z.object({
  accessType: z.enum(['all', 'tag', 'group', 'member']),
  accessValues: z.array(z.string()).default([]),
})

const createMapSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  description: z.string().nullable().optional(),
  cover: z.string().max(500).nullable().optional(),
  content: z.any().optional(),
  isPublished: z.boolean().optional(),
  topicIds: z.array(z.string().uuid()).default([]),
})

const updateMapSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  cover: z.string().max(500).nullable().optional(),
  content: z.any().optional(),
  sort: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
  topicIds: z.array(z.string().uuid()).optional(),
})

const mapListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  isPublished: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v === 'true'),
    z.boolean().optional(),
  ),
})

const topicListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  status: z.string().max(50).optional(),
})

const createTopicSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(100),
  image: z.string().max(1000),
  description: z.string().optional(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, '价格格式错误')
    .optional(),
  originalPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, '价格格式错误')
    .nullable()
    .optional(),
  status: z.enum(['draft', 'published']).optional(),
  slug: z.string().max(200).optional(),
  sort: z.number().int().min(0).optional().default(0),
  isShowIndex: z.boolean().optional().default(true),
})

const updateTopicSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  image: z.string().max(1000).optional(),
  description: z.string().optional(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, '价格格式错误')
    .optional(),
  originalPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, '价格格式错误')
    .nullable()
    .optional(),
  status: z.enum(['draft', 'published']).optional(),
  slug: z.string().max(200).nullable().optional(),
  sort: z.number().int().min(0).optional(),
  isShowIndex: z.boolean().optional(),
})

// =============================================================================
// 字段适配：后端 schema 字段名 → 前端期望字段名
// =============================================================================

/** 将后端 lessons 行映射为前端期望的字段命名(instructor/description/students/cover)。 */
function adaptLesson<
  T extends {
    lecturerName: string | null
    intro: string | null
    signupCount: number
    coverImage: string | null
  },
>(row: T): T & { instructor: string; description: string; students: number; cover: string | null } {
  return {
    ...row,
    instructor: row.lecturerName ?? '',
    description: row.intro ?? '',
    students: row.signupCount,
    cover: row.coverImage,
  }
}

/** 将后端 section 的 duration(integer 秒)格式化为 "mm:ss" 字符串。 */
function adaptSection<T extends { duration: number | null }>(
  row: T,
): Omit<T, 'duration'> & { duration: string | undefined } {
  const dur = row.duration ?? 0
  const mins = Math.floor(dur / 60)
  const secs = dur % 60
  return {
    ...row,
    duration: dur > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : undefined,
  }
}

// =============================================================================
// 公共路由（前缀 /api，浏览类匿名可访问，操作类需登录）
// =============================================================================

export const learnRoutes: FastifyPluginAsync = async (server) => {
  // GET /learn/categories - 启用的分类列表（公开）
  server.get('/learn/categories', async (_request, reply) => {
    const list = await findPublishedCategories()
    return reply.send(success({ list }))
  })

  // GET /learn/lessons - 已发布课程列表（分页，公开）
  server.get('/learn/lessons', async (request, reply) => {
    const parsed = lessonsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findPublishedLessons(parsed.data)
    const list = result.list.map(adaptLesson)
    return reply.send(success({ ...result, list }))
  })

  // GET /learn/lessons/:id - 课程详情（含章节+小节，公开；已登录时附加 signedUp/progress）
  server.get('/learn/lessons/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const lesson = await findLessonById(parsed.data.id)
    if (!lesson || !lesson.isPublished) {
      return reply.status(404).send(error(404, '课程不存在'))
    }
    // 增加浏览数（不阻塞响应）
    await incrementViewCount(parsed.data.id)

    // 可选认证：已登录则查询报名状态与进度
    let signedUp = false
    let progress = 0
    try {
      await authenticate(request)
      if (request.userId) {
        const signUp = await findSignUp(parsed.data.id, request.userId)
        if (signUp) {
          signedUp = true
          progress = signUp.progress ?? 0
        }
      }
    } catch {
      // 未登录，保持默认值
    }

    // 查询章节及小节
    const chapters = await findLessonChapters(parsed.data.id)
    const chaptersWithSections = await Promise.all(
      chapters.map(async (c) => {
        const sections = await findLessonSections(c.id)
        return { ...c, sections: sections.map(adaptSection) }
      }),
    )
    const adaptedLesson = { ...adaptLesson(lesson), signedUp, progress }
    return reply.send(success({ lesson: adaptedLesson, chapters: chaptersWithSections }))
  })

  // GET /learn/records - 用户学习记录（需登录,前端 user/learn-record 页面调用）
  server.get('/learn/records', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const list = await findUserLearnRecords(userId)
    return reply.send(success({ list }))
  })

  // GET /learn/my-lessons - 我报名的课程（需登录）
  server.get('/learn/my-lessons', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = myLessonsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const result = await findMyLessons(userId, parsed.data)
    return reply.send(success(result))
  })

  // POST /learn/lessons/:id/sign-up - 报名课程（需登录）
  server.post('/learn/lessons/:id/sign-up', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const lesson = await findLessonById(parsed.data.id)
    if (!lesson || !lesson.isPublished) {
      return reply.status(404).send(error(404, '课程不存在'))
    }
    const userId = request.userId!
    await signUpLesson(parsed.data.id, userId)
    return reply.send(success({ ok: true }))
  })

  // GET /learn/lessons/:id/progress - 获取学习进度(需登录,合并章节追踪数据)
  server.get('/learn/lessons/:id/progress', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
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

  // POST /learn/lessons/:id/heartbeat - 心跳上报(需登录,前端定时调用,每 10-15 秒)
  server.post('/learn/lessons/:id/heartbeat', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = heartbeatSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const signup = await findSignUpRecord(userId, parsed.data.id)
    if (!signup) {
      return reply.status(403).send(error(403, '未报名该课程,无法上报学习记录'))
    }
    // upsert 学习记录 + 更新位置 + 追加日志 + 检查自动完成
    const record = await upsertRecord({
      userId,
      lessonId: parsed.data.id,
      sectionId: bodyParsed.data.sectionId ?? null,
      chapterId: bodyParsed.data.chapterId ?? null,
    })
    const result = await updateWatchPosition(
      record.id,
      bodyParsed.data.position,
      bodyParsed.data.duration,
    )
    if (!result) {
      return reply.status(500).send(error(500, '学习记录更新失败'))
    }
    return reply.send(
      success({
        recordId: result.record.id,
        progress: result.record.progress,
        status: result.record.status,
        watchDuration: result.record.watchDuration,
        totalDuration: result.record.totalDuration,
        lastPosition: result.record.lastPosition,
        autoCompleted: result.autoCompleted,
      }),
    )
  })

  // GET /learn/courses/:id/ranking - 课程学习排行榜(公开,SQL 聚合)
  server.get('/learn/courses/:id/ranking', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const queryParsed = rankingQuerySchema.safeParse(request.query)
    if (!queryParsed.success) {
      return reply.status(400).send(error(400, queryParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const list = await getRanking(parsed.data.id, queryParsed.data.limit)
    return reply.send(success({ list }))
  })

  // POST /learn/lessons/:id/progress - 更新学习进度（需登录）
  server.post('/learn/lessons/:id/progress', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = updateProgressSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const signup = await findSignUp(parsed.data.id, userId)
    if (!signup) {
      return reply.status(404).send(error(404, '未报名该课程'))
    }
    const updated = await updateProgress(parsed.data.id, userId, bodyParsed.data.progress)
    return reply.send(
      success({
        progress: updated?.progress ?? bodyParsed.data.progress,
        status: updated?.status ?? signup.status,
      }),
    )
  })

  // ----- Learn Maps (公开) -----

  // GET /learn/maps - 已发布学习地图列表
  server.get('/learn/maps', async (_request, reply) => {
    const list = await findPublishedMaps()
    return reply.send(success({ list }))
  })

  // GET /learn/maps/recommend - 推荐学习地图
  server.get('/learn/maps/recommend', async (_request, reply) => {
    const list = await findPublishedMaps(6)
    return reply.send(success({ list }))
  })

  // GET /learn/maps/hot - 热门学习地图
  server.get('/learn/maps/hot', async (_request, reply) => {
    const list = await findPublishedMaps(10)
    return reply.send(success({ list }))
  })

  // GET /learn/maps/:id - 学习地图详情
  server.get('/learn/maps/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const map = await findMapById(parsed.data.id)
    if (!map || !map.isPublished) {
      return reply.status(404).send(error(404, '学习地图不存在'))
    }
    const topics = await findMapTopics(parsed.data.id)
    return reply.send(success({ map, topics }))
  })

  // GET /learn/maps/favorites - 我收藏的学习地图（需登录）
  server.get('/learn/maps/favorites', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const list = await findPublishedMaps()
    return reply.send(success({ list }))
  })

  // ----- Lesson Rates (公开/需登录) -----

  // GET /learn/lessons/:lessonId/rates - 课程评价列表
  server.get('/learn/lessons/:lessonId/rates', async (request, reply) => {
    const parsed = lessonIdParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const queryParsed = rateListQuerySchema.safeParse(request.query)
    if (!queryParsed.success) {
      return reply.status(400).send(error(400, queryParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findRateList({
      lessonId: parsed.data.lessonId,
      page: queryParsed.data.page,
      pageSize: queryParsed.data.pageSize,
    })
    return reply.send(success(result))
  })

  // POST /learn/lessons/:lessonId/rates - 创建课程评价（需登录）
  server.post('/learn/lessons/:lessonId/rates', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = lessonIdParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = createRateSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const existing = await findRateByUserLesson(userId, parsed.data.lessonId)
    if (existing) {
      return reply.status(409).send(error(409, '已评价过该课程'))
    }
    const rate = await createRate({
      lessonId: parsed.data.lessonId,
      userId,
      signId: bodyParsed.data.signId,
      content: bodyParsed.data.content,
      contentUtilityScore: bodyParsed.data.contentUtilityScore,
      teacherScore: bodyParsed.data.teacherScore,
      serviceScore: bodyParsed.data.serviceScore,
      isAnonymous: bodyParsed.data.isAnonymous,
    })
    return reply.status(201).send(success({ rate }))
  })

  // GET /learn/lessons/:lessonId/rates/my - 我的课程评价（需登录）
  server.get('/learn/lessons/:lessonId/rates/my', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = lessonIdParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const rate = await findRateByUserLesson(userId, parsed.data.lessonId)
    return reply.send(success({ rate }))
  })

  // ----- Homework Record (学生作业提交) -----

  // POST /learn/lessons/:id/homework - 学生提交作业（需登录，需先报名）
  server.post('/learn/lessons/:id/homework', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = submitHomeworkRecordSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const signup = await findSignUp(parsed.data.id, userId)
    if (!signup) {
      return reply.status(403).send(error(403, '未报名该课程，无法提交作业'))
    }
    const record = await createHomeworkRecord({
      memberId: userId,
      lessonId: parsed.data.id,
      url: bodyParsed.data.url,
      signUpId: signup.id,
    })
    return reply.status(201).send(success({ record }))
  })

  // GET /learn/homework - 我的作业提交记录列表（需登录，支持 status 过滤）
  server.get('/learn/homework', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const parsed = homeworkListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const list = await findMyHomeworkRecords(userId, parsed.data.status)
    return reply.send(success({ list }))
  })
}

// =============================================================================
// 管理员路由（前缀 /api/admin）
// =============================================================================

export const adminLearnRoutes: FastifyPluginAsync = async (server) => {
  // 统一 admin 鉴权
  server.addHook('preHandler', requireAdmin)

  // ----- Categories Admin -----

  // GET /learn/categories - 列出所有分类（含禁用）
  server.get('/learn/categories', async (_request, reply) => {
    const list = await findAllCategories()
    return reply.send(success({ list }))
  })

  // POST /learn/categories - 创建分类
  server.post('/learn/categories', async (request, reply) => {
    const parsed = createLearnCategorySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const category = await createLearnCategory(parsed.data)
    return reply.status(201).send(success({ category }))
  })

  // PUT /learn/categories/:id - 更新分类
  server.put('/learn/categories/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateLearnCategorySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findLearnCategoryById(idParsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '分类不存在'))
    }
    const category = await updateLearnCategory(idParsed.data.id, parsed.data)
    return reply.send(success({ category }))
  })

  // DELETE /learn/categories/:id - 删除分类
  server.delete('/learn/categories/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findLearnCategoryById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '分类不存在'))
    }
    await deleteLearnCategory(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // ----- Topic Categories Admin (学习专题分类) -----

  // GET /learn/topics/categories - 学习专题分类分页列表(支持 keyword / status 筛选)
  server.get('/learn/topics/categories', async (request, reply) => {
    const parsed = topicCategoryListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, keyword, status } = parsed.data
    const conditions = []
    if (keyword) {
      conditions.push(dsql`name ILIKE ${'%' + keyword + '%'}`)
    }
    if (status !== undefined) {
      conditions.push(eq(eduLessonTopicCategories.status, status))
    }
    const where =
      conditions.length > 0
        ? conditions.length === 1
          ? conditions[0]
          : and(...conditions)
        : undefined
    const orderClause = [eduLessonTopicCategories.sort, desc(eduLessonTopicCategories.createdAt)]
    const offset = (page - 1) * pageSize
    const baseQuery = where
      ? db.select().from(eduLessonTopicCategories).where(where)
      : db.select().from(eduLessonTopicCategories)
    const [list, totalRows] = await Promise.all([
      baseQuery
        .orderBy(...orderClause)
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: dsql`count(*)::int` })
        .from(eduLessonTopicCategories)
        .where(where ?? dsql`true`),
    ])
    const total = totalRows[0]?.count ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })

  // POST /learn/topics/categories - 创建学习专题分类
  server.post('/learn/topics/categories', async (request, reply) => {
    const parsed = createTopicCategorySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [created] = await db
      .insert(eduLessonTopicCategories)
      .values({
        name: parsed.data.name,
        sort: parsed.data.sort ?? 0,
        status: parsed.data.status ?? 1,
      })
      .returning()
    return reply.status(201).send(success({ category: created }))
  })

  // PUT /learn/topics/categories/:id - 更新学习专题分类
  server.put('/learn/topics/categories/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateTopicCategorySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select()
      .from(eduLessonTopicCategories)
      .where(eq(eduLessonTopicCategories.id, idParsed.data.id))
      .limit(1)
    if (!existing) {
      return reply.status(404).send(error(404, '分类不存在'))
    }
    const [updated] = await db
      .update(eduLessonTopicCategories)
      .set({
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.sort !== undefined ? { sort: parsed.data.sort } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(eduLessonTopicCategories.id, idParsed.data.id))
      .returning()
    return reply.send(success({ category: updated }))
  })

  // DELETE /learn/topics/categories/:id - 删除学习专题分类
  server.delete('/learn/topics/categories/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select()
      .from(eduLessonTopicCategories)
      .where(eq(eduLessonTopicCategories.id, idParsed.data.id))
      .limit(1)
    if (!existing) {
      return reply.status(404).send(error(404, '分类不存在'))
    }
    await db
      .delete(eduLessonTopicCategories)
      .where(eq(eduLessonTopicCategories.id, idParsed.data.id))
    return reply.send(success({ ok: true }))
  })

  // ----- Lessons Admin -----

  // GET /learn/lessons - 管理员课程列表（含未发布，支持 categoryId 筛选与搜索）
  server.get('/learn/lessons', async (request, reply) => {
    const parsed = lessonsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findAllLessons(parsed.data)
    return reply.send(success(result))
  })

  // GET /learn/lessons/:id - 管理员课程详情（含章节，不限发布状态）
  server.get('/learn/lessons/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const lesson = await findLessonByIdAdmin(parsed.data.id)
    if (!lesson) {
      return reply.status(404).send(error(404, '课程不存在'))
    }
    const chapters = await findLessonChapters(parsed.data.id)
    return reply.send(success({ lesson, chapters }))
  })

  // GET /learn/lessons/:id/chapters - 章节列表
  server.get('/learn/lessons/:id/chapters', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const lesson = await findLessonByIdAdmin(parsed.data.id)
    if (!lesson) {
      return reply.status(404).send(error(404, '课程不存在'))
    }
    const list = await findLessonChapters(parsed.data.id)
    return reply.send(success({ list }))
  })

  // POST /learn/lessons - 创建课程
  server.post('/learn/lessons', async (request, reply) => {
    const parsed = createLessonSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const lesson = await createLesson(parsed.data)
    return reply.status(201).send(success({ lesson }))
  })

  // PUT /learn/lessons/:id - 更新课程
  server.put('/learn/lessons/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateLessonSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findLessonByIdAdmin(idParsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '课程不存在'))
    }
    const lesson = await updateLesson(idParsed.data.id, parsed.data)
    return reply.send(success({ lesson }))
  })

  // DELETE /learn/lessons/:id - 删除课程
  server.delete('/learn/lessons/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findLessonByIdAdmin(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '课程不存在'))
    }
    await deleteLesson(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // ----- Chapters Admin -----

  // POST /learn/lessons/:id/chapters - 创建章节
  server.post('/learn/lessons/:id/chapters', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = createChapterSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const lesson = await findLessonByIdAdmin(idParsed.data.id)
    if (!lesson) {
      return reply.status(404).send(error(404, '课程不存在'))
    }
    const chapter = await createChapter(idParsed.data.id, parsed.data)
    return reply.status(201).send(success({ chapter }))
  })

  // PUT /learn/lessons/:id/chapters/:chapterId - 更新章节
  server.put('/learn/lessons/:id/chapters/:chapterId', async (request, reply) => {
    const paramParsed = chapterParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateChapterSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findChapterById(paramParsed.data.chapterId)
    if (!existing || existing.lessonId !== paramParsed.data.id) {
      return reply.status(404).send(error(404, '章节不存在'))
    }
    const chapter = await updateChapter(paramParsed.data.chapterId, parsed.data)
    return reply.send(success({ chapter }))
  })

  // DELETE /learn/lessons/:id/chapters/:chapterId - 删除章节
  server.delete('/learn/lessons/:id/chapters/:chapterId', async (request, reply) => {
    const paramParsed = chapterParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findChapterById(paramParsed.data.chapterId)
    if (!existing || existing.lessonId !== paramParsed.data.id) {
      return reply.status(404).send(error(404, '章节不存在'))
    }
    await deleteChapter(paramParsed.data.chapterId)
    return reply.send(success({ ok: true }))
  })

  // ----- Sections Admin (小节 CRUD) -----

  // GET /learn/lessons/:id/chapters/:chapterId/sections - 小节列表
  server.get('/learn/lessons/:id/chapters/:chapterId/sections', async (request, reply) => {
    const paramParsed = chapterParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const chapter = await findChapterById(paramParsed.data.chapterId)
    if (!chapter || chapter.lessonId !== paramParsed.data.id) {
      return reply.status(404).send(error(404, '章节不存在'))
    }
    const list = await findLessonSections(paramParsed.data.chapterId)
    return reply.send(success({ list }))
  })

  // POST /learn/lessons/:id/chapters/:chapterId/sections - 创建小节
  server.post('/learn/lessons/:id/chapters/:chapterId/sections', async (request, reply) => {
    const paramParsed = chapterParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = createSectionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const chapter = await findChapterById(paramParsed.data.chapterId)
    if (!chapter || chapter.lessonId !== paramParsed.data.id) {
      return reply.status(404).send(error(404, '章节不存在'))
    }
    const section = await createSection(paramParsed.data.chapterId, parsed.data)
    return reply.status(201).send(success({ section }))
  })

  // PUT /learn/lessons/:id/chapters/:chapterId/sections/:sectionId - 更新小节
  server.put(
    '/learn/lessons/:id/chapters/:chapterId/sections/:sectionId',
    async (request, reply) => {
      const paramParsed = sectionParamSchema.safeParse(request.params)
      if (!paramParsed.success) {
        return reply
          .status(400)
          .send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = updateSectionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findSectionById(paramParsed.data.sectionId)
      if (!existing || existing.chapterId !== paramParsed.data.chapterId) {
        return reply.status(404).send(error(404, '小节不存在'))
      }
      const section = await updateSection(paramParsed.data.sectionId, parsed.data)
      return reply.send(success({ section }))
    },
  )

  // DELETE /learn/lessons/:id/chapters/:chapterId/sections/:sectionId - 删除小节
  server.delete(
    '/learn/lessons/:id/chapters/:chapterId/sections/:sectionId',
    async (request, reply) => {
      const paramParsed = sectionParamSchema.safeParse(request.params)
      if (!paramParsed.success) {
        return reply
          .status(400)
          .send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findSectionById(paramParsed.data.sectionId)
      if (!existing || existing.chapterId !== paramParsed.data.chapterId) {
        return reply.status(404).send(error(404, '小节不存在'))
      }
      await deleteSection(paramParsed.data.sectionId)
      return reply.send(success({ ok: true }))
    },
  )

  // ----- Signup Admin (报名管理) -----

  // GET /learn/signups - 报名记录列表(含课程名+用户昵称)
  server.get('/learn/signups', async (request, reply) => {
    const parsed = adminSignupsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findAdminSignups(parsed.data)
    return reply.send(success(result))
  })

  // PUT /learn/signups/:id - 更新报名状态
  server.put('/learn/signups/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateSignupStatusSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const updated = await updateSignupStatus(idParsed.data.id, parsed.data.status)
    if (!updated) {
      return reply.status(404).send(error(404, '报名记录不存在'))
    }
    return reply.send(success({ signup: updated }))
  })

  // POST /learn/lessons/:id/batch-signup - 批量报名
  server.post('/learn/lessons/:id/batch-signup', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = batchSignUpSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const lesson = await findLessonByIdAdmin(idParsed.data.id)
    if (!lesson) {
      return reply.status(404).send(error(404, '课程不存在'))
    }
    const added = await batchSignUp(idParsed.data.id, parsed.data.userIds)
    return reply.send(success({ added }))
  })

  // ----- Reports Admin (报表) -----

  // GET /learn/reports/lesson-study - 课程学习报表
  server.get('/learn/reports/lesson-study', async (request, reply) => {
    const parsed = reportQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findLessonStudyReport({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      categoryId: parsed.data.categoryId,
    })
    return reply.send(success(result))
  })

  // GET /learn/reports/signup - 报名统计报表
  server.get('/learn/reports/signup', async (request, reply) => {
    const parsed = reportQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await getLessonSignReport({
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
    })
    return reply.send(success(result))
  })

  // GET /learn/reports/member-study - 学员学习报表
  server.get('/learn/reports/member-study', async (request, reply) => {
    const parsed = reportQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await getLessonStudyReport({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      search: parsed.data.search,
    })
    return reply.send(success(result))
  })

  // ----- Homework (课程作业) -----

  // GET /learn/lessons/:id/homework - 作业列表
  server.get('/learn/lessons/:id/homework', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const lesson = await findLessonByIdAdmin(idParsed.data.id)
    if (!lesson) {
      return reply.status(404).send(error(404, '课程不存在'))
    }
    const list = await findHomeworkList(idParsed.data.id)
    return reply.send(success({ list }))
  })

  // POST /learn/lessons/:id/homework - 创建作业
  server.post('/learn/lessons/:id/homework', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = createHomeworkSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const lesson = await findLessonByIdAdmin(idParsed.data.id)
    if (!lesson) {
      return reply.status(404).send(error(404, '课程不存在'))
    }
    const homework = await createHomework({
      lessonId: idParsed.data.id,
      chapterId: parsed.data.chapterId,
      title: parsed.data.title,
      description: parsed.data.description,
      content: parsed.data.content,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      sort: parsed.data.sort,
      status: parsed.data.status,
    })
    return reply.status(201).send(success({ homework }))
  })

  // PUT /learn/lessons/:id/homework/:hwId - 更新作业
  server.put('/learn/lessons/:id/homework/:hwId', async (request, reply) => {
    const paramParsed = homeworkParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateHomeworkSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findHomeworkById(paramParsed.data.hwId)
    if (!existing || existing.lessonId !== paramParsed.data.id) {
      return reply.status(404).send(error(404, '作业不存在'))
    }
    const homework = await updateHomework(paramParsed.data.hwId, {
      chapterId: parsed.data.chapterId,
      title: parsed.data.title,
      description: parsed.data.description,
      content: parsed.data.content,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      sort: parsed.data.sort,
      status: parsed.data.status,
    })
    return reply.send(success({ homework }))
  })

  // GET /learn/lessons/:id/exam-paper - 获取课程关联试卷
  server.get('/learn/lessons/:id/exam-paper', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    // lessons 表无 examPaperId 字段,从哨兵作业记录的 content 中读取关联
    const examPaperId = await getLessonExamPaperId(idParsed.data.id)
    return reply.send(success({ examPaperId }))
  })

  // PUT /learn/lessons/:id/exam-paper - 更新课程关联试卷
  server.put('/learn/lessons/:id/exam-paper', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = examPaperSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // lessons 表无 examPaperId 字段,存储到 learn_homework 的 jsonb content 中
    await setLessonExamPaperId(idParsed.data.id, parsed.data.examPaperId)
    return reply.send(success({ updated: true }))
  })

  // PUT /learn/lessons/:id/certificate - 更新课程关联证书
  server.put('/learn/lessons/:id/certificate', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = certificateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // lessons 表无 certificate 字段,存储到 learn_homework 的 jsonb content 中
    await setLessonCertificateId(idParsed.data.id, parsed.data.certificateTemplateId)
    return reply.send(success({ updated: true }))
  })

  // ----- Learn Maps (学习地图) -----

  // DELETE /learn/maps/:id - 删除学习地图
  server.delete('/learn/maps/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findMapById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '学习地图不存在'))
    }
    await deleteMap(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // PUT /learn/maps/:id/publish - 发布学习地图
  server.put('/learn/maps/:id/publish', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findMapById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '学习地图不存在'))
    }
    const map = await publishMap(parsed.data.id, true)
    return reply.send(success({ map }))
  })

  // PUT /learn/maps/:id/unpublish - 取消发布
  server.put('/learn/maps/:id/unpublish', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findMapById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '学习地图不存在'))
    }
    const map = await publishMap(parsed.data.id, false)
    return reply.send(success({ map }))
  })

  // ----- Topics CRUD (话题管理 — learn_topic 表) -----

  // GET /learn/premium-topics - 话题列表(分页,支持 search/status 筛选)
  server.get('/learn/premium-topics', async (request, reply) => {
    const parsed = topicListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findAllTopics(parsed.data)
    return reply.send(success(result))
  })

  // GET /learn/premium-topics/:id - 话题详情
  server.get('/learn/premium-topics/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const topic = await findTopicRowById(idParsed.data.id)
    if (!topic) {
      return reply.status(404).send(error(404, '话题不存在'))
    }
    return reply.send(success({ topic }))
  })

  // POST /learn/premium-topics - 创建话题
  server.post('/learn/premium-topics', async (request, reply) => {
    const parsed = createTopicSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const topic = await createTopicRow(parsed.data)
    return reply.status(201).send(success({ topic }))
  })

  // PUT /learn/premium-topics/:id - 更新话题
  server.put('/learn/premium-topics/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateTopicSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findTopicRowById(idParsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '话题不存在'))
    }
    const topic = await updateTopicRow(idParsed.data.id, parsed.data)
    return reply.send(success({ topic }))
  })

  // DELETE /learn/premium-topics/:id - 删除话题
  server.delete('/learn/premium-topics/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findTopicRowById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '话题不存在'))
    }
    await deleteTopicRow(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // ----- Community Posts (课程讨论帖) -----

  const communityListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().optional(),
    status: z.string().optional(),
  })
  const createCommunitySchema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().nullable().optional(),
    lessonId: z.string().uuid().nullable().optional(),
    status: z.string().max(20).optional(),
    isPinned: z.boolean().optional(),
  })
  const updateCommunitySchema = createCommunitySchema.partial()

  server.get('/learn/community', async (request, reply) => {
    const parsed = communityListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findAllCommunityPosts(parsed.data)
    return reply.send(success(result))
  })

  server.post('/learn/community', async (request, reply) => {
    const parsed = createCommunitySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const row = await createCommunityPost({
      userId: request.userId!,
      title: parsed.data.title,
      content: parsed.data.content ?? null,
      lessonId: parsed.data.lessonId ?? null,
      status: parsed.data.status,
      isPinned: parsed.data.isPinned,
    })
    return reply.send(success(row))
  })

  server.put('/learn/community/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = updateCommunitySchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const row = await updateCommunityPost(parsed.data.id, body.data)
    if (!row) return reply.status(404).send(error(404, '讨论帖不存在'))
    return reply.send(success(row))
  })

  server.delete('/learn/community/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    await deleteCommunityPost(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // PUT /learn/lessons/sort-order - 更新排序
  server.put('/learn/lessons/sort-order', async (request, reply) => {
    const parsed = lessonSortOrderSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    await Promise.all(parsed.data.items.map((item) => updateLesson(item.id, { sort: item.sort })))
    return reply.send(success({ updated: true }))
  })

  // ----- Invoice Applications (发票申请) -----

  // GET /learn/invoices - 发票申请列表
  server.get('/learn/invoices', async (request, reply) => {
    const parsed = invoiceListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findInvoiceApplicationList(parsed.data)
    return reply.send(success(result))
  })

  // PUT /learn/invoices/:id/approved - 审批通过
  server.put('/learn/invoices/:id/approved', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const updated = await updateInvoiceApplicationStatus(parsed.data.id, 'approved')
    if (!updated) {
      return reply.status(404).send(error(404, '发票申请不存在'))
    }
    return reply.send(success({ application: updated }))
  })

  // PUT /learn/invoices/:id/rejected - 审批拒绝
  server.put('/learn/invoices/:id/rejected', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const updated = await updateInvoiceApplicationStatus(parsed.data.id, 'rejected')
    if (!updated) {
      return reply.status(404).send(error(404, '发票申请不存在'))
    }
    return reply.send(success({ application: updated }))
  })

  // PUT /learn/invoices/:id/invoicing - 开票中
  server.put('/learn/invoices/:id/invoicing', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const updated = await updateInvoiceApplicationStatus(parsed.data.id, 'invoicing')
    if (!updated) {
      return reply.status(404).send(error(404, '发票申请不存在'))
    }
    return reply.send(success({ application: updated }))
  })

  // PUT /learn/invoices/:id/invoiced - 已开票
  server.put('/learn/invoices/:id/invoiced', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const updated = await updateInvoiceApplicationStatus(parsed.data.id, 'invoiced')
    if (!updated) {
      return reply.status(404).send(error(404, '发票申请不存在'))
    }
    return reply.send(success({ application: updated }))
  })

  // PUT /learn/invoices/:id/canceled - 已取消
  server.put('/learn/invoices/:id/canceled', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const updated = await updateInvoiceApplicationStatus(parsed.data.id, 'canceled')
    if (!updated) {
      return reply.status(404).send(error(404, '发票申请不存在'))
    }
    return reply.send(success({ application: updated }))
  })

  // ----- Invoice Titles (发票抬头) -----

  // GET /learn/invoice-titles - 发票抬头列表(按 userId 筛选)
  server.get('/learn/invoice-titles', async (request, reply) => {
    const { userId } = z.object({ userId: z.string().optional() }).parse(request.query)
    if (!userId) {
      return reply.status(400).send(error(400, '缺少 userId 参数'))
    }
    const list = await findInvoiceTitleList(userId)
    return reply.send(success({ list }))
  })

  // POST /learn/invoice-titles - 创建抬头
  server.post('/learn/invoice-titles', async (request, reply) => {
    const parsed = createInvoiceTitleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const title = await createInvoiceTitle({
      userId,
      title: parsed.data.title,
      type: parsed.data.type,
      taxNo: parsed.data.taxNo,
      bank: parsed.data.bank,
      bankAccount: parsed.data.bankAccount,
      address: parsed.data.address,
      phone: parsed.data.phone,
      isDefault: parsed.data.isDefault,
    })
    return reply.status(201).send(success({ title }))
  })

  // PUT /learn/invoice-titles/:id - 更新抬头
  server.put('/learn/invoice-titles/:id', async (request, reply) => {
    const idParsed = invoiceTitleParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateInvoiceTitleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findInvoiceTitleById(idParsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '发票抬头不存在'))
    }
    const title = await updateInvoiceTitle(idParsed.data.id, {
      title: parsed.data.title,
      type: parsed.data.type,
      taxNo: parsed.data.taxNo,
      bank: parsed.data.bank,
      bankAccount: parsed.data.bankAccount,
      address: parsed.data.address,
      phone: parsed.data.phone,
      isDefault: parsed.data.isDefault,
    })
    return reply.send(success({ title }))
  })

  // DELETE /learn/invoice-titles/:id - 删除抬头
  server.delete('/learn/invoice-titles/:id', async (request, reply) => {
    const parsed = invoiceTitleParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findInvoiceTitleById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '发票抬头不存在'))
    }
    await deleteInvoiceTitle(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // ----- Reports (扩展报表) -----

  // GET /learn/reports/company-study - 企业学习报表
  server.get('/learn/reports/company-study', async (request, reply) => {
    const parsed = companyStudyReportQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findCompanyStudyReport(parsed.data)
    return reply.send(success(result))
  })

  // ----- Learn Maps Admin (学习地图管理) -----

  // POST /learn/maps - 创建学习地图
  server.post('/learn/maps', async (request, reply) => {
    const parsed = createMapSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const map = await insertMap({
      title: parsed.data.title,
      description: parsed.data.description,
      cover: parsed.data.cover,
      content: parsed.data.content,
      isPublished: parsed.data.isPublished,
    })
    if (parsed.data.topicIds.length > 0) {
      await setMapTopics(map.id, parsed.data.topicIds)
    }
    return reply.status(201).send(success({ map }))
  })

  // PUT /learn/maps/:id - 更新学习地图
  server.put('/learn/maps/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = updateMapSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findMapById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '学习地图不存在'))
    }
    const map = await updateMap(parsed.data.id, {
      title: bodyParsed.data.title,
      description: bodyParsed.data.description,
      cover: bodyParsed.data.cover,
      content: bodyParsed.data.content,
      sort: bodyParsed.data.sort,
      isPublished: bodyParsed.data.isPublished,
    })
    if (bodyParsed.data.topicIds !== undefined) {
      await setMapTopics(parsed.data.id, bodyParsed.data.topicIds)
    }
    return reply.send(success({ map }))
  })

  // GET /learn/maps/list - 学习地图分页列表
  server.get('/learn/maps/list', async (request, reply) => {
    const parsed = mapListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findMapListPaged(parsed.data)
    return reply.send(success(result))
  })

  // GET /learn/maps/:id/detail - 学习地图详情(含专题)
  server.get('/learn/maps/:id/detail', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const map = await findMapById(parsed.data.id)
    if (!map) {
      return reply.status(404).send(error(404, '学习地图不存在'))
    }
    const topics = await findMapTopics(parsed.data.id)
    return reply.send(success({ map, topics }))
  })

  // ----- Lesson Tasks Admin (课程任务管理) -----

  // GET /learn/lessons/:lessonId/tasks - 任务列表
  server.get('/learn/lessons/:lessonId/tasks', async (request, reply) => {
    const parsed = lessonIdParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const list = await findTasksByLesson(parsed.data.lessonId)
    return reply.send(success({ list }))
  })

  // POST /learn/lessons/:lessonId/tasks - 创建任务
  server.post('/learn/lessons/:lessonId/tasks', async (request, reply) => {
    const parsed = lessonIdParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = createTaskSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const task = await createTask({
      lessonId: parsed.data.lessonId,
      ...bodyParsed.data,
    })
    return reply.status(201).send(success({ task }))
  })

  // GET /learn/lessons/:lessonId/tasks/:taskId - 任务详情
  server.get('/learn/lessons/:lessonId/tasks/:taskId', async (request, reply) => {
    const parsed = lessonTaskIdParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const task = await findTaskById(parsed.data.taskId)
    if (!task) {
      return reply.status(404).send(error(404, '任务不存在'))
    }
    return reply.send(success({ task }))
  })

  // PUT /learn/lessons/:lessonId/tasks/:taskId - 更新任务
  server.put('/learn/lessons/:lessonId/tasks/:taskId', async (request, reply) => {
    const parsed = lessonTaskIdParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = updateTaskSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const task = await updateTask(parsed.data.taskId, bodyParsed.data)
    if (!task) {
      return reply.status(404).send(error(404, '任务不存在'))
    }
    return reply.send(success({ task }))
  })

  // DELETE /learn/lessons/:lessonId/tasks/:taskId - 删除任务
  server.delete('/learn/lessons/:lessonId/tasks/:taskId', async (request, reply) => {
    const parsed = lessonTaskIdParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findTaskById(parsed.data.taskId)
    if (!existing) {
      return reply.status(404).send(error(404, '任务不存在'))
    }
    await deleteTask(parsed.data.taskId)
    return reply.send(success({ ok: true }))
  })

  // PUT /learn/lessons/:lessonId/tasks/:taskId/status - 设置任务状态
  server.put('/learn/lessons/:lessonId/tasks/:taskId/status', async (request, reply) => {
    const parsed = lessonTaskIdParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = z.object({ status: z.string().optional() }).parse(request.body)
    if (!body.status || !['enable', 'disable'].includes(body.status)) {
      return reply.status(400).send(error(400, 'status 必须为 enable 或 disable'))
    }
    const task = await setTaskStatus(parsed.data.taskId, body.status)
    if (!task) {
      return reply.status(404).send(error(404, '任务不存在'))
    }
    return reply.send(success({ task }))
  })

  // ----- Lesson Rates Admin (课程评价管理) -----

  // DELETE /learn/rates/:id - 删除评价
  server.delete('/learn/rates/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findRateById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '评价不存在'))
    }
    await deleteRate(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // ----- Lesson Access Admin (课程访问权限管理) -----

  // GET /learn/lessons/:lessonId/access - 获取课程访问权限
  server.get('/learn/lessons/:lessonId/access', async (request, reply) => {
    const parsed = lessonIdParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const list = await findAccessByLesson(parsed.data.lessonId)
    return reply.send(success({ list }))
  })

  // PUT /learn/lessons/:lessonId/access - 更新课程访问权限
  server.put('/learn/lessons/:lessonId/access', async (request, reply) => {
    const parsed = lessonIdParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = updateAccessSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const count = await updateLessonAccess(
      parsed.data.lessonId,
      bodyParsed.data.accessType,
      bodyParsed.data.accessValues,
    )
    return reply.send(success({ count }))
  })

  // ----- Homework Record Audit (作业审核) -----

  // PUT /learn/homework/:hid/audit - 教师审核学生作业
  server.put('/learn/homework/:hid/audit', async (request, reply) => {
    const paramParsed = homeworkIdParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = auditHomeworkSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const updated = await auditHomeworkRecord(paramParsed.data.hid, bodyParsed.data.status)
    if (!updated) {
      return reply.status(404).send(error(404, '作业记录不存在'))
    }
    return reply.send(success({ record: updated }))
  })

  // ----- Homework Admin (兼容前端 /admin/learn/homework 独立路径) -----

  const homeworkListQuerySchema2 = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    lessonId: z.string().uuid().optional(),
    search: z.string().optional(),
  })

  // GET /learn/homework - 作业分页列表
  server.get('/learn/homework', async (request, reply) => {
    const parsed = homeworkListQuerySchema2.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, lessonId, search } = parsed.data
    const listAll = lessonId
      ? await findHomeworkList(lessonId)
      : await db.select().from(learnHomework).orderBy(desc(learnHomework.createdAt))
    const filtered = search
      ? listAll.filter((h) => h.title?.toLowerCase().includes(search.toLowerCase()))
      : listAll
    const total = filtered.length
    const offset = (page - 1) * pageSize
    const list = filtered.slice(offset, offset + pageSize)
    return reply.send(success({ list, total, page, pageSize }))
  })

  // POST /learn/homework - 创建作业(lessonId 在 body 中)
  server.post('/learn/homework', async (request, reply) => {
    const bodySchema = createHomeworkSchema.extend({ lessonId: z.string().uuid() })
    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const lesson = await findLessonByIdAdmin(parsed.data.lessonId)
    if (!lesson) {
      return reply.status(404).send(error(404, '课程不存在'))
    }
    const homework = await createHomework({
      lessonId: parsed.data.lessonId,
      chapterId: parsed.data.chapterId,
      title: parsed.data.title,
      description: parsed.data.description,
      content: parsed.data.content,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      sort: parsed.data.sort,
      status: parsed.data.status,
    })
    return reply.status(201).send(success({ homework }))
  })

  // PUT /learn/homework/:id - 更新作业
  server.put('/learn/homework/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateHomeworkSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findHomeworkById(idParsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '作业不存在'))
    }
    const homework = await updateHomework(idParsed.data.id, {
      chapterId: parsed.data.chapterId,
      title: parsed.data.title,
      description: parsed.data.description,
      content: parsed.data.content,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      sort: parsed.data.sort,
      status: parsed.data.status,
    })
    return reply.send(success({ homework }))
  })

  // DELETE /learn/homework/:id - 删除作业
  server.delete('/learn/homework/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findHomeworkById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '作业不存在'))
    }
    await deleteHomework(parsed.data.id)
    return reply.send(success({ ok: true }))
  })
}
