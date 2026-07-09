import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import {
  findPublishedExamCategories,
  findAllExamCategories,
  findExamCategoryById,
  createExamCategory,
  updateExamCategory,
  deleteExamCategory,
  findPublishedPapers,
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
} from '../db/exam-queries.js';
import { success, error } from '../utils/response.js';

const ADMIN_ROLE_ID = 1;

const QUESTION_TYPES = [
  'single_choice',
  'multi_choice',
  'judgment',
  'fill_blank',
  'subjective',
] as const;

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') });

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
});

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
});

const createExamCategorySchema = z.object({
  name: z.string().min(1).max(100),
  pid: z.string().uuid().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
});

const updateExamCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  pid: z.string().uuid().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
});

const adminRecordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  paperId: z.string().uuid().optional(),
  status: z.string().max(20).optional(),
});

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
});

const createPaperSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  totalScore: z.string().optional(),
  passScore: z.string().optional(),
  duration: z.number().int().min(1).max(600).optional(),
  isPublished: z.boolean().optional(),
  isRandom: z.boolean().optional(),
  status: z.number().int().optional(),
});

const updatePaperSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  totalScore: z.string().optional(),
  passScore: z.string().optional(),
  duration: z.number().int().min(1).max(600).optional(),
  isPublished: z.boolean().optional(),
  isRandom: z.boolean().optional(),
  status: z.number().int().optional(),
});

const createQuestionSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  title: z.string().min(1),
  options: z.unknown().optional(),
  answer: z.unknown().optional(),
  analysis: z.string().optional(),
  score: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateQuestionSchema = z.object({
  type: z.enum(QUESTION_TYPES).optional(),
  title: z.string().min(1).optional(),
  options: z.unknown().nullable().optional(),
  answer: z.unknown().nullable().optional(),
  analysis: z.string().nullable().optional(),
  score: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const submitExamSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        answer: z.unknown(),
      }),
    )
    .min(1, '答案不能为空'),
});

// =============================================================================
// 鉴权辅助
// =============================================================================

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request);
    return true;
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
    const message = (e as Error).message || 'Authentication required';
    reply.status(statusCode).send(error(statusCode, message));
    return false;
  }
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request);
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
    const message = (e as Error).message || 'Authentication required';
    reply.status(statusCode).send(error(statusCode, message));
    return false;
  }
  const roleId = request.jwtPayload?.roleId ?? 0;
  if (roleId < ADMIN_ROLE_ID) {
    reply.status(403).send(error(403, '需要管理员权限'));
    return false;
  }
  return true;
}

// =============================================================================
// 路由：公共端点(需登录) + Admin 端点
// =============================================================================

export const examRoutes: FastifyPluginAsync = async (server) => {
  // ===========================================================================
  // 公共端点（需登录）
  // ===========================================================================

  // GET /exam/categories - 启用的试卷分类列表
  server.get('/exam/categories', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const list = await findPublishedExamCategories();
    return reply.send(success({ list }));
  });

  // GET /exam/papers - 已发布试卷列表(分页,支持搜索 + categoryId 筛选)
  server.get('/exam/papers', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const parsed = papersQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { list, total } = await findPublishedPapers({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      search: parsed.data.search,
      categoryId: parsed.data.categoryId,
    });
    return reply.send(
      success({
        list,
        total,
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
      }),
    );
  });

  // GET /exam/papers/:id - 试卷详情(不含答案)
  server.get('/exam/papers/:id', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const paper = await findPaperById(parsed.data.id);
    if (!paper || !paper.isPublished) {
      return reply.status(404).send(error(404, '试卷不存在'));
    }
    return reply.send(success({ paper }));
  });

  // GET /exam/papers/:id/questions - 试卷题目(不含正确答案,用于答题)
  server.get('/exam/papers/:id/questions', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const paper = await findPaperById(parsed.data.id);
    if (!paper || !paper.isPublished) {
      return reply.status(404).send(error(404, '试卷不存在'));
    }
    const questions = await findQuestionsByPaperId(parsed.data.id);
    // 剥离正确答案与解析,仅返回答题所需字段
    const safeQuestions = questions.map((q) => ({
      id: q.id,
      paperId: q.paperId,
      type: q.type,
      title: q.title,
      options: q.options,
      score: q.score,
      sortOrder: q.sortOrder,
    }));
    return reply.send(success({ list: safeQuestions }));
  });

  // POST /exam/papers/:id/start - 开始答题(创建 pending 记录)
  server.post('/exam/papers/:id/start', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const paper = await findPaperById(parsed.data.id);
    if (!paper || !paper.isPublished) {
      return reply.status(404).send(error(404, '试卷不存在'));
    }
    const userId = request.userId!;
    const record = await createExamRecord(parsed.data.id, userId);
    return reply.status(201).send(success({ record }));
  });

  // POST /exam/records/:id/submit - 提交试卷(自动判分)
  server.post('/exam/records/:id/submit', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const bodyParsed = submitExamSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const userId = request.userId!;
    try {
      const result = await submitExamRecord(
        parsed.data.id,
        userId,
        bodyParsed.data.answers as Array<{ questionId: string; answer: unknown }>,
      );
      return reply.send(success({ result }));
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('不存在') || msg.includes('无权')) {
        return reply.status(404).send(error(404, msg));
      }
      if (msg.includes('已提交')) {
        return reply.status(409).send(error(409, msg));
      }
      throw e;
    }
  });

  // GET /exam/records - 我的答题记录(分页)
  server.get('/exam/records', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const parsed = paginationQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const userId = request.userId!;
    const { list, total } = await findMyExamRecords(userId, {
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
    return reply.send(
      success({
        list,
        total,
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
      }),
    );
  });

  // GET /exam/records/:id - 答题记录详情(含正确答案)
  server.get('/exam/records/:id', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const userId = request.userId!;
    const record = await findExamRecordById(parsed.data.id);
    if (!record || record.userId !== userId) {
      return reply.status(404).send(error(404, '答题记录不存在'));
    }
    const questions = await findQuestionsByPaperId(record.paperId);
    return reply.send(success({ record, questions }));
  });

  // ===========================================================================
  // Admin 端点（需管理员权限）
  // ===========================================================================

  server.register(async (child) => {
    // 统一 admin 鉴权
    child.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      if (!(await requireAdmin(request, reply))) return;
    });

    // GET /admin/exam/papers - 管理员试卷列表(含未发布,分页,支持 categoryId 筛选)
    child.get('/admin/exam/papers', async (request, reply) => {
      const parsed = papersQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { list, total } = await findAllPapers({
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        search: parsed.data.search,
        categoryId: parsed.data.categoryId,
      });
      return reply.send(
        success({
          list,
          total,
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
        }),
      );
    });

    // POST /admin/exam/papers - 创建试卷
    child.post('/admin/exam/papers', async (request, reply) => {
      const parsed = createPaperSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const paper = await createPaper({
        ...parsed.data,
        createdBy: request.userId,
      });
      return reply.status(201).send(success({ paper }));
    });

    // PUT /admin/exam/papers/:id - 更新试卷
    child.put('/admin/exam/papers/:id', async (request, reply) => {
      const idParsed = idParamSchema.safeParse(request.params);
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
      }
      const parsed = updatePaperSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const existing = await findPaperById(idParsed.data.id);
      if (!existing) {
        return reply.status(404).send(error(404, '试卷不存在'));
      }
      const paper = await updatePaper(idParsed.data.id, parsed.data);
      return reply.send(success({ paper }));
    });

    // DELETE /admin/exam/papers/:id - 删除试卷
    child.delete('/admin/exam/papers/:id', async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const existing = await findPaperById(parsed.data.id);
      if (!existing) {
        return reply.status(404).send(error(404, '试卷不存在'));
      }
      await deletePaper(parsed.data.id);
      return reply.send(success({ ok: true }));
    });

    // POST /admin/exam/papers/:id/questions - 创建题目
    child.post('/admin/exam/papers/:id/questions', async (request, reply) => {
      const idParsed = idParamSchema.safeParse(request.params);
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
      }
      const parsed = createQuestionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const existing = await findPaperById(idParsed.data.id);
      if (!existing) {
        return reply.status(404).send(error(404, '试卷不存在'));
      }
      const question = await createQuestion(idParsed.data.id, parsed.data);
      return reply.status(201).send(success({ question }));
    });

    // PUT /admin/exam/questions/:id - 更新题目
    child.put('/admin/exam/questions/:id', async (request, reply) => {
      const idParsed = idParamSchema.safeParse(request.params);
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
      }
      const parsed = updateQuestionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const existing = await findQuestionById(idParsed.data.id);
      if (!existing) {
        return reply.status(404).send(error(404, '题目不存在'));
      }
      const question = await updateQuestion(idParsed.data.id, parsed.data);
      return reply.send(success({ question }));
    });

    // DELETE /admin/exam/questions/:id - 删除题目
    child.delete('/admin/exam/questions/:id', async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const existing = await findQuestionById(parsed.data.id);
      if (!existing) {
        return reply.status(404).send(error(404, '题目不存在'));
      }
      await deleteQuestion(parsed.data.id);
      return reply.send(success({ ok: true }));
    });

    // GET /admin/exam/papers/:id/questions - 管理员题目列表(含完整答案)
    child.get('/admin/exam/papers/:id/questions', async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const existing = await findPaperById(parsed.data.id);
      if (!existing) {
        return reply.status(404).send(error(404, '试卷不存在'));
      }
      const questions = await findQuestionsByPaperId(parsed.data.id);
      return reply.send(success({ list: questions }));
    });

    // GET /admin/exam/records - 全站答题记录(分页,支持搜索/paperId/status 筛选,含试卷标题+用户昵称)
    child.get('/admin/exam/records', async (request, reply) => {
      const parsed = adminRecordsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { list, total } = await findAdminExamRecordsRich({
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        search: parsed.data.search,
        paperId: parsed.data.paperId,
        status: parsed.data.status,
      });
      return reply.send(
        success({
          list,
          total,
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
        }),
      );
    });

    // GET /admin/exam/records/:id - 管理员查看任意答题记录详情
    child.get('/admin/exam/records/:id', async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const record = await findExamRecordById(parsed.data.id);
      if (!record) {
        return reply.status(404).send(error(404, '答题记录不存在'));
      }
      const questions = await findQuestionsByPaperId(record.paperId);
      return reply.send(success({ record, questions }));
    });

    // POST /admin/exam/records/:id/grade - 主观题人工评分
    child.post('/admin/exam/records/:id/grade', async (request, reply) => {
      const idParsed = idParamSchema.safeParse(request.params);
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
      }
      const parsed = gradeSubjectiveSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const existing = await findExamRecordById(idParsed.data.id);
      if (!existing) {
        return reply.status(404).send(error(404, '答题记录不存在'));
      }
      try {
        const result = await gradeSubjectiveAnswers(idParsed.data.id, parsed.data.grades);
        return reply.send(success({ result }));
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.includes('尚未提交')) {
          return reply.status(409).send(error(409, msg));
        }
        throw e;
      }
    });

    // DELETE /admin/exam/records/:id - 删除答题记录
    child.delete('/admin/exam/records/:id', async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const existing = await findExamRecordById(parsed.data.id);
      if (!existing) {
        return reply.status(404).send(error(404, '答题记录不存在'));
      }
      await deleteExamRecord(parsed.data.id);
      return reply.send(success({ ok: true }));
    });

    // ----- Categories Admin -----

    // GET /admin/exam/categories - 全部分类列表(含禁用)
    child.get('/admin/exam/categories', async (_request, reply) => {
      const list = await findAllExamCategories();
      return reply.send(success({ list }));
    });

    // POST /admin/exam/categories - 创建分类
    child.post('/admin/exam/categories', async (request, reply) => {
      const parsed = createExamCategorySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const category = await createExamCategory(parsed.data);
      return reply.status(201).send(success({ category }));
    });

    // PUT /admin/exam/categories/:id - 更新分类
    child.put('/admin/exam/categories/:id', async (request, reply) => {
      const idParsed = idParamSchema.safeParse(request.params);
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
      }
      const parsed = updateExamCategorySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const existing = await findExamCategoryById(idParsed.data.id);
      if (!existing) {
        return reply.status(404).send(error(404, '分类不存在'));
      }
      const category = await updateExamCategory(idParsed.data.id, parsed.data);
      return reply.send(success({ category }));
    });

    // DELETE /admin/exam/categories/:id - 删除分类
    child.delete('/admin/exam/categories/:id', async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const existing = await findExamCategoryById(parsed.data.id);
      if (!existing) {
        return reply.status(404).send(error(404, '分类不存在'));
      }
      await deleteExamCategory(parsed.data.id);
      return reply.send(success({ ok: true }));
    });
  });
};
