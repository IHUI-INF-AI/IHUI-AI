import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { db } from '../db/index.js'
import { examExam, examPaperQuestionRule, examSignUp, examWrongQuestion } from '@ihui/database'
import { eq, sql, and, desc } from 'drizzle-orm'
import {
  findPublishedExamCategories,
  findAllExamCategories,
  findExamCategoryById,
  createExamCategory,
  updateExamCategory,
  deleteExamCategory,
  findPublishedPapers,
  findPublishedPapersByIds,
  findAllPapers,
  findPaperById,
  findQuestionsByPaperId,
  findQuestionById,
  findMyExamRecords,
  findExamRecordById,
  createExamRecord,
  submitExamRecord,
  createPaper,
  updatePaper,
  deletePaper,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  findAdminExamRecordsRich,
  gradeSubjectiveAnswers,
  deleteExamRecord,
} from '../db/exam-queries.js'
import {
  findChapterList,
  findChapterById,
  createChapter,
  updateChapter,
  deleteChapter,
  findSectionList,
  findSectionById,
  createSection,
  updateSection,
  deleteSection,
  updateChapterSortOrder,
  updateSectionSortOrder,
  findSignupList,
  findMarkRecordList,
} from '../db/exam-extended-queries.js'
import { success, error } from '../utils/response.js'

const QUESTION_TYPES = [
  'single_choice',
  'multi_choice',
  'judgment',
  'fill_blank',
  'subjective',
] as const

const paperTypeSchema = z.enum(['normal', 'random', 'mock', 'exam'])

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
})

const papersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  categoryId: z
    .preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : v),
      z.string().uuid('无效的分类 ID'),
    )
    .optional(),
  paperType: paperTypeSchema.optional(),
})

const createExamCategorySchema = z.object({
  name: z.string().min(1).max(100),
  pid: z.string().uuid().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const updateExamCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  pid: z.string().uuid().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const adminRecordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  paperId: z.string().uuid().optional(),
  status: z.string().max(20).optional(),
})

const gradeSubjectiveSchema = z.object({
  grades: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        score: z.number().min(0),
        isCorrect: z.boolean().optional(),
      }),
    )
    .min(1, '评分项不能为空'),
})

const createPaperSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  paperType: paperTypeSchema.optional(),
  totalScore: z.string().optional(),
  passScore: z.string().optional(),
  duration: z.number().int().min(1).max(600).optional(),
  isPublished: z.boolean().optional(),
  isRandom: z.boolean().optional(),
  questionDisordered: z.boolean().optional(),
  optionDisordered: z.boolean().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  status: z.number().int().optional(),
})

const updatePaperSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  paperType: paperTypeSchema.optional(),
  totalScore: z.string().optional(),
  passScore: z.string().optional(),
  duration: z.number().int().min(1).max(600).optional(),
  isPublished: z.boolean().optional(),
  isRandom: z.boolean().optional(),
  questionDisordered: z.boolean().optional(),
  optionDisordered: z.boolean().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  status: z.number().int().optional(),
})

const createQuestionSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  title: z.string().min(1),
  options: z.unknown().optional(),
  answer: z.unknown().optional(),
  analysis: z.string().optional(),
  score: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

const updateQuestionSchema = z.object({
  type: z.enum(QUESTION_TYPES).optional(),
  title: z.string().min(1).optional(),
  options: z.unknown().nullable().optional(),
  answer: z.unknown().nullable().optional(),
  analysis: z.string().nullable().optional(),
  score: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
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

// ----- 章节/小节/排序/报名/待评分 schemas -----

const chapterIdParamSchema = z.object({
  id: z.string().uuid('无效的 ID'),
  chapterId: z.string().uuid('无效的章节 ID'),
})

const sectionParamSchema = z.object({
  id: z.string().uuid('无效的 ID'),
  chapterId: z.string().uuid('无效的章节 ID'),
  sectionId: z.string().uuid('无效的小节 ID'),
})

const createChapterSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  sort: z.number().int().min(0).optional(),
})

const updateChapterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  sort: z.number().int().min(0).optional(),
})

const createSectionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  questionIds: z.array(z.string().uuid()).optional(),
  sort: z.number().int().min(0).optional(),
})

const updateSectionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  questionIds: z.array(z.string().uuid()).nullable().optional(),
  sort: z.number().int().min(0).optional(),
})

const sortOrderSchema = z.object({
  type: z.enum(['chapter', 'section']),
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        sort: z.number().int().min(0),
      }),
    )
    .min(1, '排序项不能为空'),
})

const signupsQuerySchema = z.object({
  paperId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
})

const pendingMarksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  paperId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
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

// =============================================================================
// 路由：公共端点(需登录) + Admin 端点
// =============================================================================

export const examRoutes: FastifyPluginAsync = async (server) => {
  const eidParam = z.object({ eid: z.string() })
  const sidParam = z.object({ sid: z.string() })
  const widParam = z.object({ wid: z.string() })
  const ridParam = z.object({ rid: z.string() })

  // ===========================================================================
  // 公共端点（需登录）
  // ===========================================================================

  // GET /exam/categories - 启用的试卷分类列表
  server.get('/exam/categories', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const list = await findPublishedExamCategories()
    return reply.send(success({ list }))
  })

  // GET /exam/papers - 已发布试卷列表(分页,支持搜索 + categoryId 筛选)
  server.get('/exam/papers', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = papersQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { list, total } = await findPublishedPapers({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      search: parsed.data.search,
      categoryId: parsed.data.categoryId,
      paperType: parsed.data.paperType,
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

  // GET /exam/papers/:id - 试卷详情(不含答案)
  server.get('/exam/papers/:id', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
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

  // GET /exam/papers/by-ids - 按 id 列表批量查询已发布试卷
  server.get('/exam/papers/by-ids', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const idsParam = (request.query as { ids?: string }).ids ?? ''
    const ids = idsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (ids.length === 0) return reply.send(success({ list: [] }))
    const list = await findPublishedPapersByIds(ids)
    return reply.send(success({ list }))
  })

  // GET /exam/papers/:id/questions - 试卷题目(不含正确答案,用于答题)
  server.get('/exam/papers/:id/questions', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const paper = await findPaperById(parsed.data.id)
    if (!paper || !paper.isPublished) {
      return reply.status(404).send(error(404, '试卷不存在'))
    }
    const questions = await findQuestionsByPaperId(parsed.data.id)
    // 剥离正确答案与解析,仅返回答题所需字段
    const safeQuestions = questions.map((q) => ({
      id: q.id,
      paperId: q.paperId,
      type: q.type,
      title: q.title,
      options: q.options,
      score: q.score,
      sortOrder: q.sortOrder,
    }))
    return reply.send(success({ list: safeQuestions }))
  })

  // POST /exam/papers/:id/start - 开始答题(创建 pending 记录)
  server.post('/exam/papers/:id/start', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const paper = await findPaperById(parsed.data.id)
    if (!paper || !paper.isPublished) {
      return reply.status(404).send(error(404, '试卷不存在'))
    }
    const userId = request.userId!
    const record = await createExamRecord(parsed.data.id, userId)
    return reply.status(201).send(success({ record }))
  })

  // POST /exam/records/:id/submit - 提交试卷(自动判分)
  server.post('/exam/records/:id/submit', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = submitExamSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    try {
      const result = await submitExamRecord(
        parsed.data.id,
        userId,
        bodyParsed.data.answers as Array<{ questionId: string; answer: unknown }>,
      )
      return reply.send(success({ result }))
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

  // GET /exam/records - 我的答题记录(分页)
  server.get('/exam/records', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = paginationQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const { list, total } = await findMyExamRecords(userId, {
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
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

  // GET /exam/records/:id - 答题记录详情(含正确答案)
  server.get('/exam/records/:id', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const record = await findExamRecordById(parsed.data.id)
    if (!record || record.userId !== userId) {
      return reply.status(404).send(error(404, '答题记录不存在'))
    }
    const questions = await findQuestionsByPaperId(record.paperId)
    return reply.send(success({ record, questions }))
  })

  // ===========================================================================
  // Composition 作文考试端点（需登录）
  // ===========================================================================

  // GET /exam/composition/list - 作文考试列表
  server.get('/exam/composition/list', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { page, pageSize, keyword, status } = z
      .object({
        page: z.coerce.number().optional().default(1),
        pageSize: z.coerce.number().optional().default(20),
        keyword: z.string().optional(),
        status: z.string().optional(),
      })
      .parse(request.query)
    const conditions = []
    if (keyword) conditions.push(sql`${examExam.name} ILIKE ${`%${keyword}%`}`)
    if (status) conditions.push(eq(examExam.status, status))
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const list = await db
      .select()
      .from(examExam)
      .where(where)
      .orderBy(desc(examExam.id))
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    const total = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(examExam)
      .where(where)
    return reply.send(
      success({
        list,
        total: total[0]?.count ?? 0,
        page: Number(page),
        pageSize: Number(pageSize),
      }),
    )
  })

  // GET /exam/composition/:eid - 作文考试详情
  server.get('/exam/composition/:eid', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { eid } = eidParam.parse(request.params)
    const result = await db
      .select()
      .from(examExam)
      .where(eq(examExam.id, Number(eid)))
      .limit(1)
    if (!result[0]) return reply.status(404).send(error(404, '考试不存在'))
    return reply.send(success({ exam: result[0] }))
  })

  // GET /exam/composition/rule/list - 抽题规则列表
  server.get('/exam/composition/rule/list', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { paperId } = z.object({ paperId: z.coerce.number().optional() }).parse(request.query)
    const conditions = []
    if (paperId) conditions.push(eq(examPaperQuestionRule.paperId, Number(paperId)))
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const list = await db
      .select()
      .from(examPaperQuestionRule)
      .where(where)
      .orderBy(desc(examPaperQuestionRule.createdAt))
    return reply.send(success({ list }))
  })

  // ----- Composition signup 报名 -----
  // GET /exam/composition/signup/list - 报名列表
  server.get('/exam/composition/signup/list', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { examId, memberId, status, page, pageSize } = z
      .object({
        examId: z.coerce.number().optional(),
        memberId: z.coerce.number().optional(),
        status: z.string().optional(),
        page: z.coerce.number().optional().default(1),
        pageSize: z.coerce.number().optional().default(20),
      })
      .parse(request.query)
    const conditions = []
    if (examId) conditions.push(eq(examSignUp.examId, Number(examId)))
    if (memberId) conditions.push(eq(examSignUp.memberId, Number(memberId)))
    if (status) conditions.push(eq(examSignUp.status, status))
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const list = await db
      .select()
      .from(examSignUp)
      .where(where)
      .orderBy(desc(examSignUp.createdAt))
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    return reply.send(success({ list, page: Number(page), pageSize: Number(pageSize) }))
  })

  // GET /exam/composition/signup/my - 我的报名列表
  server.get('/exam/composition/signup/my', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { memberId } = z.object({ memberId: z.coerce.number().optional() }).parse(request.query)
    const list = await db
      .select()
      .from(examSignUp)
      .where(eq(examSignUp.memberId, Number(memberId)))
      .orderBy(desc(examSignUp.createdAt))
    return reply.send(success({ list }))
  })

  // GET /exam/composition/signup/:sid - 报名详情
  server.get('/exam/composition/signup/:sid', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { sid } = sidParam.parse(request.params)
    const result = await db
      .select()
      .from(examSignUp)
      .where(eq(examSignUp.id, Number(sid)))
      .limit(1)
    if (!result[0]) return reply.status(404).send(error(404, '报名记录不存在'))
    return reply.send(success({ signup: result[0] }))
  })

  // POST /exam/composition/signup - 创建报名
  server.post('/exam/composition/signup', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const body = z
      .object({
        examId: z.number().int(),
        memberId: z.number().int(),
        status: z.string().max(50).default('pending'),
      })
      .parse(request.body)
    const [created] = await db
      .insert(examSignUp)
      .values({
        memberId: body.memberId,
        examId: body.examId,
        status: body.status,
      })
      .returning()
    return reply.status(201).send(success({ signup: created }))
  })

  // PUT /exam/composition/signup/:sid - 修改报名
  server.put('/exam/composition/signup/:sid', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { sid } = sidParam.parse(request.params)
    const body = z
      .object({
        status: z.string().max(50).optional(),
        completedTime: z.string().datetime().optional(),
      })
      .parse(request.body)
    const [updated] = await db
      .update(examSignUp)
      .set({
        ...(body.status !== undefined && { status: body.status }),
        ...(body.completedTime !== undefined && { completedTime: new Date(body.completedTime) }),
        updatedAt: new Date(),
      })
      .where(eq(examSignUp.id, Number(sid)))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '报名记录不存在'))
    return reply.send(success({ signup: updated }))
  })

  // DELETE /exam/composition/signup/:sid - 删除报名
  server.delete('/exam/composition/signup/:sid', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { sid } = sidParam.parse(request.params)
    await db.delete(examSignUp).where(eq(examSignUp.id, Number(sid)))
    return reply.send(success({ ok: true }))
  })

  // POST /exam/composition/signup/:sid/submit - 提交答卷
  server.post('/exam/composition/signup/:sid/submit', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { sid } = sidParam.parse(request.params)
    const [updated] = await db
      .update(examSignUp)
      .set({
        status: 'completed',
        completedTime: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(examSignUp.id, Number(sid)))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '报名记录不存在'))
    return reply.send(success({ signup: updated }))
  })

  // ===========================================================================
  // Wrong book 错题本端点（需登录）
  // ===========================================================================

  // GET /exam/wrong/list - 错题本列表
  server.get('/exam/wrong/list', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const userId = request.userId!
    const { page, pageSize, paperId, isMastered } = z
      .object({
        page: z.coerce.number().optional().default(1),
        pageSize: z.coerce.number().optional().default(20),
        paperId: z.string().optional(),
        isMastered: z.string().optional(),
      })
      .parse(request.query)
    const conditions = [eq(examWrongQuestion.userId, userId)]
    if (paperId) conditions.push(eq(examWrongQuestion.paperId, paperId))
    if (isMastered !== undefined)
      conditions.push(eq(examWrongQuestion.isMastered, isMastered === 'true'))
    const list = await db
      .select()
      .from(examWrongQuestion)
      .where(and(...conditions))
      .orderBy(desc(examWrongQuestion.createdAt))
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    const total = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(examWrongQuestion)
      .where(and(...conditions))
    return reply.send(
      success({
        list,
        total: total[0]?.count ?? 0,
        page: Number(page),
        pageSize: Number(pageSize),
      }),
    )
  })

  // PUT /exam/wrong/:wid/master - 标记错题为已掌握
  server.put('/exam/wrong/:wid/master', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { wid } = widParam.parse(request.params)
    const userId = request.userId!
    const [updated] = await db
      .update(examWrongQuestion)
      .set({
        isMastered: true,
        updatedAt: new Date(),
      })
      .where(and(eq(examWrongQuestion.id, wid), eq(examWrongQuestion.userId, userId)))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '错题记录不存在'))
    return reply.send(success({ wrong: updated }))
  })

  // ===========================================================================
  // Admin 端点（需管理员权限）
  // ===========================================================================

  server.register(async (child) => {
    // 统一 admin 鉴权
    child.addHook('preHandler', requireAdmin)

    // GET /admin/exam/papers - 管理员试卷列表(含未发布,分页,支持 categoryId 筛选)
    child.get('/admin/exam/papers', async (request, reply) => {
      const parsed = papersQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { list, total } = await findAllPapers({
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        search: parsed.data.search,
        categoryId: parsed.data.categoryId,
        paperType: parsed.data.paperType,
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

    // POST /admin/exam/papers - 创建试卷
    child.post('/admin/exam/papers', async (request, reply) => {
      const parsed = createPaperSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const paper = await createPaper({
        ...parsed.data,
        createdBy: request.userId,
      })
      return reply.status(201).send(success({ paper }))
    })

    // PUT /admin/exam/papers/:id - 更新试卷
    child.put('/admin/exam/papers/:id', async (request, reply) => {
      const idParsed = idParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = updatePaperSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findPaperById(idParsed.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '试卷不存在'))
      }
      const paper = await updatePaper(idParsed.data.id, parsed.data)
      return reply.send(success({ paper }))
    })

    // DELETE /admin/exam/papers/:id - 删除试卷
    child.delete('/admin/exam/papers/:id', async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findPaperById(parsed.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '试卷不存在'))
      }
      await deletePaper(parsed.data.id)
      return reply.send(success({ ok: true }))
    })

    // POST /admin/exam/papers/:id/questions - 创建题目
    child.post('/admin/exam/papers/:id/questions', async (request, reply) => {
      const idParsed = idParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = createQuestionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findPaperById(idParsed.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '试卷不存在'))
      }
      const question = await createQuestion(idParsed.data.id, parsed.data)
      return reply.status(201).send(success({ question }))
    })

    // PUT /admin/exam/questions/:id - 更新题目
    child.put('/admin/exam/questions/:id', async (request, reply) => {
      const idParsed = idParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = updateQuestionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findQuestionById(idParsed.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '题目不存在'))
      }
      const question = await updateQuestion(idParsed.data.id, parsed.data)
      return reply.send(success({ question }))
    })

    // DELETE /admin/exam/questions/:id - 删除题目
    child.delete('/admin/exam/questions/:id', async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findQuestionById(parsed.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '题目不存在'))
      }
      await deleteQuestion(parsed.data.id)
      return reply.send(success({ ok: true }))
    })

    // GET /admin/exam/papers/:id/questions - 管理员题目列表(含完整答案)
    child.get('/admin/exam/papers/:id/questions', async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findPaperById(parsed.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '试卷不存在'))
      }
      const questions = await findQuestionsByPaperId(parsed.data.id)
      return reply.send(success({ list: questions }))
    })

    // GET /admin/exam/records - 全站答题记录(分页,支持搜索/paperId/status 筛选,含试卷标题+用户昵称)
    child.get('/admin/exam/records', async (request, reply) => {
      const parsed = adminRecordsQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { list, total } = await findAdminExamRecordsRich({
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        search: parsed.data.search,
        paperId: parsed.data.paperId,
        status: parsed.data.status,
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

    // GET /admin/exam/records/:id - 管理员查看任意答题记录详情
    child.get('/admin/exam/records/:id', async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const record = await findExamRecordById(parsed.data.id)
      if (!record) {
        return reply.status(404).send(error(404, '答题记录不存在'))
      }
      const questions = await findQuestionsByPaperId(record.paperId)
      return reply.send(success({ record, questions }))
    })

    // POST /admin/exam/records/:id/grade - 主观题人工评分
    child.post('/admin/exam/records/:id/grade', async (request, reply) => {
      const idParsed = idParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = gradeSubjectiveSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findExamRecordById(idParsed.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '答题记录不存在'))
      }
      try {
        const result = await gradeSubjectiveAnswers(idParsed.data.id, parsed.data.grades)
        return reply.send(success({ result }))
      } catch (e) {
        const msg = (e as Error).message
        if (msg.includes('尚未提交')) {
          return reply.status(409).send(error(409, msg))
        }
        throw e
      }
    })

    // DELETE /admin/exam/records/:id - 删除答题记录
    child.delete('/admin/exam/records/:id', async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findExamRecordById(parsed.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '答题记录不存在'))
      }
      await deleteExamRecord(parsed.data.id)
      return reply.send(success({ ok: true }))
    })

    // ----- Categories Admin -----

    // GET /admin/exam/categories - 全部分类列表(含禁用)
    child.get('/admin/exam/categories', async (_request, reply) => {
      const list = await findAllExamCategories()
      return reply.send(success({ list }))
    })

    // POST /admin/exam/categories - 创建分类
    child.post('/admin/exam/categories', async (request, reply) => {
      const parsed = createExamCategorySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const category = await createExamCategory(parsed.data)
      return reply.status(201).send(success({ category }))
    })

    // PUT /admin/exam/categories/:id - 更新分类
    child.put('/admin/exam/categories/:id', async (request, reply) => {
      const idParsed = idParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = updateExamCategorySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findExamCategoryById(idParsed.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '分类不存在'))
      }
      const category = await updateExamCategory(idParsed.data.id, parsed.data)
      return reply.send(success({ category }))
    })

    // DELETE /admin/exam/categories/:id - 删除分类
    child.delete('/admin/exam/categories/:id', async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findExamCategoryById(parsed.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '分类不存在'))
      }
      await deleteExamCategory(parsed.data.id)
      return reply.send(success({ ok: true }))
    })

    // ----- Chapters 章节管理 -----

    // GET /exam/papers/:id/chapters - 章节列表
    child.get('/exam/papers/:id/chapters', async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const list = await findChapterList(parsed.data.id)
      return reply.send(success({ list }))
    })

    // POST /exam/papers/:id/chapters - 创建章节
    child.post('/exam/papers/:id/chapters', async (request, reply) => {
      const idParsed = idParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = createChapterSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const chapter = await createChapter({
        paperId: idParsed.data.id,
        title: parsed.data.title,
        description: parsed.data.description,
        sort: parsed.data.sort,
      })
      return reply.status(201).send(success({ chapter }))
    })

    // PUT /exam/papers/:id/chapters/:chapterId - 更新章节
    child.put('/exam/papers/:id/chapters/:chapterId', async (request, reply) => {
      const paramsParsed = chapterIdParamSchema.safeParse(request.params)
      if (!paramsParsed.success) {
        return reply
          .status(400)
          .send(error(400, paramsParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = updateChapterSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findChapterById(paramsParsed.data.chapterId)
      if (!existing) {
        return reply.status(404).send(error(404, '章节不存在'))
      }
      const chapter = await updateChapter(paramsParsed.data.chapterId, parsed.data)
      return reply.send(success({ chapter }))
    })

    // DELETE /exam/papers/:id/chapters/:chapterId - 删除章节
    child.delete('/exam/papers/:id/chapters/:chapterId', async (request, reply) => {
      const paramsParsed = chapterIdParamSchema.safeParse(request.params)
      if (!paramsParsed.success) {
        return reply
          .status(400)
          .send(error(400, paramsParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findChapterById(paramsParsed.data.chapterId)
      if (!existing) {
        return reply.status(404).send(error(404, '章节不存在'))
      }
      await deleteChapter(paramsParsed.data.chapterId)
      return reply.send(success({ ok: true }))
    })

    // ----- Sections 小节管理 -----

    // GET /exam/papers/:id/chapters/:chapterId/sections - 小节列表
    child.get('/exam/papers/:id/chapters/:chapterId/sections', async (request, reply) => {
      const paramsParsed = chapterIdParamSchema.safeParse(request.params)
      if (!paramsParsed.success) {
        return reply
          .status(400)
          .send(error(400, paramsParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const list = await findSectionList(paramsParsed.data.chapterId)
      return reply.send(success({ list }))
    })

    // POST /exam/papers/:id/chapters/:chapterId/sections - 创建小节
    child.post('/exam/papers/:id/chapters/:chapterId/sections', async (request, reply) => {
      const paramsParsed = chapterIdParamSchema.safeParse(request.params)
      if (!paramsParsed.success) {
        return reply
          .status(400)
          .send(error(400, paramsParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = createSectionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existingChapter = await findChapterById(paramsParsed.data.chapterId)
      if (!existingChapter) {
        return reply.status(404).send(error(404, '章节不存在'))
      }
      const section = await createSection({
        chapterId: paramsParsed.data.chapterId,
        title: parsed.data.title,
        description: parsed.data.description,
        questionIds: parsed.data.questionIds,
        sort: parsed.data.sort,
      })
      return reply.status(201).send(success({ section }))
    })

    // PUT /exam/papers/:id/chapters/:chapterId/sections/:sectionId - 更新小节
    child.put(
      '/exam/papers/:id/chapters/:chapterId/sections/:sectionId',
      async (request, reply) => {
        const paramsParsed = sectionParamSchema.safeParse(request.params)
        if (!paramsParsed.success) {
          return reply
            .status(400)
            .send(error(400, paramsParsed.error.issues[0]?.message ?? '参数错误'))
        }
        const parsed = updateSectionSchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const existing = await findSectionById(paramsParsed.data.sectionId)
        if (!existing) {
          return reply.status(404).send(error(404, '小节不存在'))
        }
        const section = await updateSection(paramsParsed.data.sectionId, parsed.data)
        return reply.send(success({ section }))
      },
    )

    // DELETE /exam/papers/:id/chapters/:chapterId/sections/:sectionId - 删除小节
    child.delete(
      '/exam/papers/:id/chapters/:chapterId/sections/:sectionId',
      async (request, reply) => {
        const paramsParsed = sectionParamSchema.safeParse(request.params)
        if (!paramsParsed.success) {
          return reply
            .status(400)
            .send(error(400, paramsParsed.error.issues[0]?.message ?? '参数错误'))
        }
        const existing = await findSectionById(paramsParsed.data.sectionId)
        if (!existing) {
          return reply.status(404).send(error(404, '小节不存在'))
        }
        await deleteSection(paramsParsed.data.sectionId)
        return reply.send(success({ ok: true }))
      },
    )

    // ----- Sort Order 排序 -----

    // PUT /exam/sort-order - 批量更新排序(body: { type, items: [{id, sort}] })
    child.put('/exam/sort-order', async (request, reply) => {
      const parsed = sortOrderSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      if (parsed.data.type === 'chapter') {
        await updateChapterSortOrder(parsed.data.items)
      } else {
        await updateSectionSortOrder(parsed.data.items)
      }
      return reply.send(success({ ok: true }))
    })

    // ----- Signups 报名 -----

    // GET /exam/signups - 报名列表(支持 paperId/userId 筛选)
    child.get('/exam/signups', async (request, reply) => {
      const parsed = signupsQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const list = await findSignupList({
        paperId: parsed.data.paperId,
        userId: parsed.data.userId,
      })
      return reply.send(success({ list }))
    })

    // ----- Mark Records 待评分记录 -----

    // GET /exam/records/pending-marks - 待评分答题记录列表
    child.get('/exam/records/pending-marks', async (request, reply) => {
      const parsed = pendingMarksQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { list, total } = await findMarkRecordList({
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        paperId: parsed.data.paperId,
        search: parsed.data.search,
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

    // ----- Composition admin 作文考试管理 -----

    // POST /admin/exam/composition - 创建考试
    child.post('/admin/exam/composition', async (request, reply) => {
      const body = z
        .object({
          name: z.string().min(1).max(100),
          code: z.string().min(1).max(100),
          startTime: z.string().datetime(),
          endTime: z.string().datetime(),
          image: z.string().min(1).max(1000),
          status: z.string().max(50).default('draft'),
          phrase: z.string().max(255).default(''),
          introduction: z.string().max(3000).default(''),
        })
        .parse(request.body)
      const [created] = await db
        .insert(examExam)
        .values({
          name: body.name,
          code: body.code,
          startTime: new Date(body.startTime),
          endTime: new Date(body.endTime),
          image: body.image,
          status: body.status,
          phrase: body.phrase,
          introduction: body.introduction,
        })
        .returning()
      return reply.status(201).send(success({ exam: created }))
    })

    // PUT /admin/exam/composition/:eid - 修改考试
    child.put('/admin/exam/composition/:eid', async (request, reply) => {
      const { eid } = eidParam.parse(request.params)
      const body = z
        .object({
          name: z.string().min(1).max(100).optional(),
          code: z.string().min(1).max(100).optional(),
          startTime: z.string().datetime().optional(),
          endTime: z.string().datetime().optional(),
          image: z.string().max(1000).optional(),
          status: z.string().max(50).optional(),
          phrase: z.string().max(255).optional(),
          introduction: z.string().max(3000).optional(),
        })
        .parse(request.body)
      const [updated] = await db
        .update(examExam)
        .set({
          ...(body.name !== undefined && { name: body.name }),
          ...(body.code !== undefined && { code: body.code }),
          ...(body.startTime !== undefined && { startTime: new Date(body.startTime) }),
          ...(body.endTime !== undefined && { endTime: new Date(body.endTime) }),
          ...(body.image !== undefined && { image: body.image }),
          ...(body.status !== undefined && { status: body.status }),
          ...(body.phrase !== undefined && { phrase: body.phrase }),
          ...(body.introduction !== undefined && { introduction: body.introduction }),
          updatedAt: new Date(),
        })
        .where(eq(examExam.id, Number(eid)))
        .returning()
      if (!updated) return reply.status(404).send(error(404, '考试不存在'))
      return reply.send(success({ exam: updated }))
    })

    // DELETE /admin/exam/composition/:eid - 删除考试
    child.delete('/admin/exam/composition/:eid', async (request, reply) => {
      const { eid } = eidParam.parse(request.params)
      await db.delete(examExam).where(eq(examExam.id, Number(eid)))
      return reply.send(success({ ok: true }))
    })

    // POST /admin/exam/composition/rule - 新增抽题规则
    child.post('/admin/exam/composition/rule', async (request, reply) => {
      const body = z
        .object({
          paperId: z.number().int(),
          ruleJson: z.unknown(),
        })
        .parse(request.body)
      const [created] = await db
        .insert(examPaperQuestionRule)
        .values({
          paperId: body.paperId,
          ruleJson: body.ruleJson,
        })
        .returning()
      return reply.status(201).send(success({ rule: created }))
    })

    // PUT /admin/exam/composition/rule/:rid - 修改抽题规则
    child.put('/admin/exam/composition/rule/:rid', async (request, reply) => {
      const { rid } = ridParam.parse(request.params)
      const body = z
        .object({
          paperId: z.number().int().optional(),
          ruleJson: z.unknown().optional(),
        })
        .parse(request.body)
      const [updated] = await db
        .update(examPaperQuestionRule)
        .set({
          ...(body.paperId !== undefined && { paperId: body.paperId }),
          ...(body.ruleJson !== undefined && { ruleJson: body.ruleJson }),
          updatedAt: new Date(),
        })
        .where(eq(examPaperQuestionRule.id, Number(rid)))
        .returning()
      if (!updated) return reply.status(404).send(error(404, '抽题规则不存在'))
      return reply.send(success({ rule: updated }))
    })

    // DELETE /admin/exam/composition/rule/:rid - 删除抽题规则
    child.delete('/admin/exam/composition/rule/:rid', async (request, reply) => {
      const { rid } = ridParam.parse(request.params)
      await db.delete(examPaperQuestionRule).where(eq(examPaperQuestionRule.id, Number(rid)))
      return reply.send(success({ ok: true }))
    })
  })
}
