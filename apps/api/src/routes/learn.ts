import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
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
  findLessonStudyReport,
  findSignupReport,
  findMemberStudyReport,
} from '../db/learn-queries.js';
import { success, error } from '../utils/response.js';

const ADMIN_ROLE_ID = 1;

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') });

const chapterParamSchema = z.object({
  id: z.string().uuid('无效的 ID'),
  chapterId: z.string().uuid('无效的章节 ID'),
});

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
});

const myLessonsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const updateProgressSchema = z.object({
  progress: z.number().int().min(0).max(100),
});

const createLearnCategorySchema = z.object({
  name: z.string().min(1).max(100),
  pid: z.string().uuid().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
});

const updateLearnCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  pid: z.string().uuid().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
});

const createLessonSchema = z.object({
  title: z.string().min(1).max(200),
  coverImage: z.string().max(512).nullable().optional(),
  intro: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  lecturerId: z.string().uuid().nullable().optional(),
  lecturerName: z.string().max(100).nullable().optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, '价格格式错误').optional(),
  originalPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, '价格格式错误').nullable().optional(),
  isFree: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).optional(),
});

const updateLessonSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  coverImage: z.string().max(512).nullable().optional(),
  intro: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  lecturerId: z.string().uuid().nullable().optional(),
  lecturerName: z.string().max(100).nullable().optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, '价格格式错误').optional(),
  originalPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, '价格格式错误').nullable().optional(),
  isFree: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).optional(),
});

const createChapterSchema = z.object({
  title: z.string().min(1).max(200),
  sortOrder: z.number().int().min(0).optional(),
});

const updateChapterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const sectionParamSchema = z.object({
  id: z.string().uuid('无效的 ID'),
  chapterId: z.string().uuid('无效的章节 ID'),
  sectionId: z.string().uuid('无效的小节 ID'),
});

const createSectionSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().nullable().optional(),
  videoUrl: z.string().max(512).nullable().optional(),
  duration: z.number().int().min(0).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isFree: z.boolean().optional(),
});

const updateSectionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().nullable().optional(),
  videoUrl: z.string().max(512).nullable().optional(),
  duration: z.number().int().min(0).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isFree: z.boolean().optional(),
});

const adminSignupsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  lessonId: z.string().uuid().optional(),
  status: z.coerce.number().int().min(0).max(3).optional(),
  search: z.string().max(200).optional(),
});

const updateSignupStatusSchema = z.object({
  status: z.number().int().min(0).max(3),
});

const batchSignUpSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(500),
});

const reportQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// =============================================================================
// 鉴权辅助
// =============================================================================

async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
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

async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
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
// 公共路由（前缀 /api，需登录）
// =============================================================================

export const learnRoutes: FastifyPluginAsync = async (server) => {
  // 统一登录校验
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return;
  });

  // GET /learn/categories - 启用的分类列表
  server.get('/learn/categories', async (_request, reply) => {
    const list = await findPublishedCategories();
    return reply.send(success({ list }));
  });

  // GET /learn/lessons - 已发布课程列表（分页）
  server.get('/learn/lessons', async (request, reply) => {
    const parsed = lessonsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findPublishedLessons(parsed.data);
    return reply.send(success(result));
  });

  // GET /learn/lessons/:id - 课程详情（含章节+小节）
  server.get('/learn/lessons/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const lesson = await findLessonById(parsed.data.id);
    if (!lesson || !lesson.isPublished) {
      return reply.status(404).send(error(404, '课程不存在'));
    }
    // 增加浏览数（不阻塞响应）
    await incrementViewCount(parsed.data.id);
    // 查询章节及小节
    const chapters = await findLessonChapters(parsed.data.id);
    const chaptersWithSections = await Promise.all(
      chapters.map(async (c) => {
        const sections = await findLessonSections(c.id);
        return { ...c, sections };
      }),
    );
    return reply.send(success({ lesson, chapters: chaptersWithSections }));
  });

  // GET /learn/my-lessons - 我报名的课程
  server.get('/learn/my-lessons', async (request, reply) => {
    const parsed = myLessonsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const userId = request.userId!;
    const result = await findMyLessons(userId, parsed.data);
    return reply.send(success(result));
  });

  // POST /learn/lessons/:id/sign-up - 报名课程
  server.post('/learn/lessons/:id/sign-up', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const lesson = await findLessonById(parsed.data.id);
    if (!lesson || !lesson.isPublished) {
      return reply.status(404).send(error(404, '课程不存在'));
    }
    const userId = request.userId!;
    await signUpLesson(parsed.data.id, userId);
    return reply.send(success({ ok: true }));
  });

  // GET /learn/lessons/:id/progress - 获取学习进度
  server.get('/learn/lessons/:id/progress', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const userId = request.userId!;
    const signup = await findSignUp(parsed.data.id, userId);
    if (!signup) {
      return reply.status(404).send(error(404, '未报名该课程'));
    }
    return reply.send(success({ progress: signup.progress, status: signup.status }));
  });

  // POST /learn/lessons/:id/progress - 更新学习进度
  server.post('/learn/lessons/:id/progress', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const bodyParsed = updateProgressSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const userId = request.userId!;
    const signup = await findSignUp(parsed.data.id, userId);
    if (!signup) {
      return reply.status(404).send(error(404, '未报名该课程'));
    }
    const updated = await updateProgress(parsed.data.id, userId, bodyParsed.data.progress);
    return reply.send(success({ progress: updated?.progress ?? bodyParsed.data.progress, status: updated?.status ?? signup.status }));
  });
};

// =============================================================================
// 管理员路由（前缀 /api/admin）
// =============================================================================

export const adminLearnRoutes: FastifyPluginAsync = async (server) => {
  // 统一 admin 鉴权
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(request, reply))) return;
  });

  // ----- Categories Admin -----

  // GET /learn/categories - 列出所有分类（含禁用）
  server.get('/learn/categories', async (_request, reply) => {
    const list = await findAllCategories();
    return reply.send(success({ list }));
  });

  // POST /learn/categories - 创建分类
  server.post('/learn/categories', async (request, reply) => {
    const parsed = createLearnCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const category = await createLearnCategory(parsed.data);
    return reply.status(201).send(success({ category }));
  });

  // PUT /learn/categories/:id - 更新分类
  server.put('/learn/categories/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateLearnCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findLearnCategoryById(idParsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '分类不存在'));
    }
    const category = await updateLearnCategory(idParsed.data.id, parsed.data);
    return reply.send(success({ category }));
  });

  // DELETE /learn/categories/:id - 删除分类
  server.delete('/learn/categories/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findLearnCategoryById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '分类不存在'));
    }
    await deleteLearnCategory(parsed.data.id);
    return reply.send(success({ ok: true }));
  });

  // ----- Lessons Admin -----

  // GET /learn/lessons - 管理员课程列表（含未发布，支持 categoryId 筛选与搜索）
  server.get('/learn/lessons', async (request, reply) => {
    const parsed = lessonsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findAllLessons(parsed.data);
    return reply.send(success(result));
  });

  // GET /learn/lessons/:id - 管理员课程详情（含章节，不限发布状态）
  server.get('/learn/lessons/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const lesson = await findLessonByIdAdmin(parsed.data.id);
    if (!lesson) {
      return reply.status(404).send(error(404, '课程不存在'));
    }
    const chapters = await findLessonChapters(parsed.data.id);
    return reply.send(success({ lesson, chapters }));
  });

  // GET /learn/lessons/:id/chapters - 章节列表
  server.get('/learn/lessons/:id/chapters', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const lesson = await findLessonByIdAdmin(parsed.data.id);
    if (!lesson) {
      return reply.status(404).send(error(404, '课程不存在'));
    }
    const list = await findLessonChapters(parsed.data.id);
    return reply.send(success({ list }));
  });

  // POST /learn/lessons - 创建课程
  server.post('/learn/lessons', async (request, reply) => {
    const parsed = createLessonSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const lesson = await createLesson(parsed.data);
    return reply.status(201).send(success({ lesson }));
  });

  // PUT /learn/lessons/:id - 更新课程
  server.put('/learn/lessons/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateLessonSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findLessonByIdAdmin(idParsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '课程不存在'));
    }
    const lesson = await updateLesson(idParsed.data.id, parsed.data);
    return reply.send(success({ lesson }));
  });

  // DELETE /learn/lessons/:id - 删除课程
  server.delete('/learn/lessons/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findLessonByIdAdmin(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '课程不存在'));
    }
    await deleteLesson(parsed.data.id);
    return reply.send(success({ ok: true }));
  });

  // ----- Chapters Admin -----

  // POST /learn/lessons/:id/chapters - 创建章节
  server.post('/learn/lessons/:id/chapters', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = createChapterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const lesson = await findLessonByIdAdmin(idParsed.data.id);
    if (!lesson) {
      return reply.status(404).send(error(404, '课程不存在'));
    }
    const chapter = await createChapter(idParsed.data.id, parsed.data);
    return reply.status(201).send(success({ chapter }));
  });

  // PUT /learn/lessons/:id/chapters/:chapterId - 更新章节
  server.put('/learn/lessons/:id/chapters/:chapterId', async (request, reply) => {
    const paramParsed = chapterParamSchema.safeParse(request.params);
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateChapterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findChapterById(paramParsed.data.chapterId);
    if (!existing || existing.lessonId !== paramParsed.data.id) {
      return reply.status(404).send(error(404, '章节不存在'));
    }
    const chapter = await updateChapter(paramParsed.data.chapterId, parsed.data);
    return reply.send(success({ chapter }));
  });

  // DELETE /learn/lessons/:id/chapters/:chapterId - 删除章节
  server.delete('/learn/lessons/:id/chapters/:chapterId', async (request, reply) => {
    const paramParsed = chapterParamSchema.safeParse(request.params);
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findChapterById(paramParsed.data.chapterId);
    if (!existing || existing.lessonId !== paramParsed.data.id) {
      return reply.status(404).send(error(404, '章节不存在'));
    }
    await deleteChapter(paramParsed.data.chapterId);
    return reply.send(success({ ok: true }));
  });

  // ----- Sections Admin (小节 CRUD) -----

  // GET /learn/lessons/:id/chapters/:chapterId/sections - 小节列表
  server.get('/learn/lessons/:id/chapters/:chapterId/sections', async (request, reply) => {
    const paramParsed = chapterParamSchema.safeParse(request.params);
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const chapter = await findChapterById(paramParsed.data.chapterId);
    if (!chapter || chapter.lessonId !== paramParsed.data.id) {
      return reply.status(404).send(error(404, '章节不存在'));
    }
    const list = await findLessonSections(paramParsed.data.chapterId);
    return reply.send(success({ list }));
  });

  // POST /learn/lessons/:id/chapters/:chapterId/sections - 创建小节
  server.post('/learn/lessons/:id/chapters/:chapterId/sections', async (request, reply) => {
    const paramParsed = chapterParamSchema.safeParse(request.params);
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = createSectionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const chapter = await findChapterById(paramParsed.data.chapterId);
    if (!chapter || chapter.lessonId !== paramParsed.data.id) {
      return reply.status(404).send(error(404, '章节不存在'));
    }
    const section = await createSection(paramParsed.data.chapterId, parsed.data);
    return reply.status(201).send(success({ section }));
  });

  // PUT /learn/lessons/:id/chapters/:chapterId/sections/:sectionId - 更新小节
  server.put('/learn/lessons/:id/chapters/:chapterId/sections/:sectionId', async (request, reply) => {
    const paramParsed = sectionParamSchema.safeParse(request.params);
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateSectionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findSectionById(paramParsed.data.sectionId);
    if (!existing || existing.chapterId !== paramParsed.data.chapterId) {
      return reply.status(404).send(error(404, '小节不存在'));
    }
    const section = await updateSection(paramParsed.data.sectionId, parsed.data);
    return reply.send(success({ section }));
  });

  // DELETE /learn/lessons/:id/chapters/:chapterId/sections/:sectionId - 删除小节
  server.delete('/learn/lessons/:id/chapters/:chapterId/sections/:sectionId', async (request, reply) => {
    const paramParsed = sectionParamSchema.safeParse(request.params);
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findSectionById(paramParsed.data.sectionId);
    if (!existing || existing.chapterId !== paramParsed.data.chapterId) {
      return reply.status(404).send(error(404, '小节不存在'));
    }
    await deleteSection(paramParsed.data.sectionId);
    return reply.send(success({ ok: true }));
  });

  // ----- Signup Admin (报名管理) -----

  // GET /learn/signups - 报名记录列表(含课程名+用户昵称)
  server.get('/learn/signups', async (request, reply) => {
    const parsed = adminSignupsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findAdminSignups(parsed.data);
    return reply.send(success(result));
  });

  // PUT /learn/signups/:id - 更新报名状态
  server.put('/learn/signups/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateSignupStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const updated = await updateSignupStatus(idParsed.data.id, parsed.data.status);
    if (!updated) {
      return reply.status(404).send(error(404, '报名记录不存在'));
    }
    return reply.send(success({ signup: updated }));
  });

  // POST /learn/lessons/:id/batch-signup - 批量报名
  server.post('/learn/lessons/:id/batch-signup', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = batchSignUpSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const lesson = await findLessonByIdAdmin(idParsed.data.id);
    if (!lesson) {
      return reply.status(404).send(error(404, '课程不存在'));
    }
    const added = await batchSignUp(idParsed.data.id, parsed.data.userIds);
    return reply.send(success({ added }));
  });

  // ----- Reports Admin (报表) -----

  // GET /learn/reports/lesson-study - 课程学习报表
  server.get('/learn/reports/lesson-study', async (request, reply) => {
    const parsed = reportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findLessonStudyReport({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      categoryId: parsed.data.categoryId,
    });
    return reply.send(success(result));
  });

  // GET /learn/reports/signup - 报名统计报表
  server.get('/learn/reports/signup', async (request, reply) => {
    const parsed = reportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findSignupReport({
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
    });
    return reply.send(success(result));
  });

  // GET /learn/reports/member-study - 学员学习报表
  server.get('/learn/reports/member-study', async (request, reply) => {
    const parsed = reportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findMemberStudyReport({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      search: parsed.data.search,
    });
    return reply.send(success(result));
  });
};
