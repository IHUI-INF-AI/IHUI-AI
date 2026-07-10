import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import { success, error } from '../utils/response.js';
import {
  findNotesList,
  findNoteById,
  createNote,
  updateNote,
  deleteNote,
  findOfflineRecordsList,
  findOfflineRecordById,
  createOfflineRecord,
  updateOfflineRecord,
  deleteOfflineRecord,
  findUploadedCertsList,
  findUploadedCertById,
  createUploadedCert,
  deleteUploadedCert,
  findUploadedPapersList,
  findUploadedPaperById,
  createUploadedPaper,
  deleteUploadedPaper,
} from '../db/edu-extended-queries.js';
import { findCertificates } from '../db/certificate-queries.js';
import { findMyExamRecords } from '../db/exam-queries.js';
import { findMyLessons } from '../db/learn-queries.js';

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

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') });

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const searchSchema = paginationSchema.extend({
  search: z.string().max(200).optional(),
  lessonId: z.string().uuid().optional(),
});

const createNoteSchema = z.object({
  lessonId: z.string().uuid().nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  content: z.string().min(1).max(10000),
  isPublic: z.boolean().optional(),
});

const updateNoteSchema = z.object({
  lessonId: z.string().uuid().nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  content: z.string().min(1).max(10000).optional(),
  isPublic: z.boolean().optional(),
});

const createOfflineRecordSchema = z.object({
  type: z.string().max(50),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  hours: z.number().min(0).optional(),
  occurredAt: z.coerce.date().optional(),
});

const updateOfflineRecordSchema = z.object({
  type: z.string().max(50).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  hours: z.number().min(0).optional(),
  occurredAt: z.coerce.date().optional(),
});

const createCertSchema = z.object({
  certName: z.string().min(1).max(200),
  certUrl: z.string().max(512).nullable().optional(),
  issuer: z.string().max(200).nullable().optional(),
  issuedAt: z.coerce.date().nullable().optional(),
});

const createPaperSchema = z.object({
  paperTitle: z.string().min(1).max(200),
  paperUrl: z.string().max(512).nullable().optional(),
  courseId: z.string().uuid().nullable().optional(),
});

// =============================================================================
// 学员中心路由（前缀 /api/edu，全部需登录）
// =============================================================================

export const eduPublicRoutes: FastifyPluginAsync = async (server) => {
  // 统一登录校验
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return;
  });

  // ----- 我的课程 -----
  server.get('/edu/my-lessons', async (request, reply) => {
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findMyLessons(request.userId!, parsed.data);
    return reply.send(success(result));
  });

  // ----- 笔记 -----
  server.get('/edu/my-notes', async (request, reply) => {
    const parsed = searchSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findNotesList({ ...parsed.data, userId: request.userId! });
    return reply.send(success(result));
  });

  server.post('/edu/notes', async (request, reply) => {
    const parsed = createNoteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const note = await createNote({ ...parsed.data, userId: request.userId! });
    return reply.send(success({ note }));
  });

  server.put('/edu/notes/:id', async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send(error(400, paramsParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findNoteById(paramsParsed.data.id);
    if (!existing) return reply.status(404).send(error(404, '笔记不存在'));
    if (existing.userId !== request.userId!) return reply.status(403).send(error(403, '无权操作'));
    const bodyParsed = updateNoteSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const note = await updateNote(paramsParsed.data.id, bodyParsed.data);
    return reply.send(success({ note }));
  });

  server.delete('/edu/notes/:id', async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send(error(400, paramsParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findNoteById(paramsParsed.data.id);
    if (!existing) return reply.status(404).send(error(404, '笔记不存在'));
    if (existing.userId !== request.userId!) return reply.status(403).send(error(403, '无权操作'));
    await deleteNote(paramsParsed.data.id);
    return reply.send(success({ deleted: true }));
  });

  // ----- 我的证书 -----
  server.get('/edu/my-certificates', async (request, reply) => {
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findCertificates({ ...parsed.data, userId: request.userId!, status: 1 });
    return reply.send(success(result));
  });

  // ----- 证书上传（学员自助提交证书材料）-----
  server.get('/edu/my-uploaded-certs', async (request, reply) => {
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findUploadedCertsList({ ...parsed.data, userId: request.userId! });
    return reply.send(success(result));
  });

  server.post('/edu/uploaded-certs', async (request, reply) => {
    const parsed = createCertSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const cert = await createUploadedCert({ ...parsed.data, userId: request.userId! });
    return reply.send(success({ cert }));
  });

  server.delete('/edu/uploaded-certs/:id', async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send(error(400, paramsParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findUploadedCertById(paramsParsed.data.id);
    if (!existing) return reply.status(404).send(error(404, '记录不存在'));
    if (existing.userId !== request.userId!) return reply.status(403).send(error(403, '无权操作'));
    await deleteUploadedCert(paramsParsed.data.id);
    return reply.send(success({ deleted: true }));
  });

  // ----- 线下学习记录 -----
  server.get('/edu/my-offline-records', async (request, reply) => {
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findOfflineRecordsList({ ...parsed.data, userId: request.userId! });
    return reply.send(success(result));
  });

  server.post('/edu/offline-records', async (request, reply) => {
    const parsed = createOfflineRecordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const record = await createOfflineRecord({ ...parsed.data, userId: request.userId! });
    return reply.send(success({ record }));
  });

  server.put('/edu/offline-records/:id', async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send(error(400, paramsParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findOfflineRecordById(paramsParsed.data.id);
    if (!existing) return reply.status(404).send(error(404, '记录不存在'));
    if (existing.userId !== request.userId!) return reply.status(403).send(error(403, '无权操作'));
    const bodyParsed = updateOfflineRecordSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const record = await updateOfflineRecord(paramsParsed.data.id, bodyParsed.data);
    return reply.send(success({ record }));
  });

  server.delete('/edu/offline-records/:id', async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send(error(400, paramsParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findOfflineRecordById(paramsParsed.data.id);
    if (!existing) return reply.status(404).send(error(404, '记录不存在'));
    if (existing.userId !== request.userId!) return reply.status(403).send(error(403, '无权操作'));
    await deleteOfflineRecord(paramsParsed.data.id);
    return reply.send(success({ deleted: true }));
  });

  // ----- 论文/作业上传 -----
  server.get('/edu/my-papers', async (request, reply) => {
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findUploadedPapersList({ ...parsed.data, userId: request.userId! });
    return reply.send(success(result));
  });

  server.post('/edu/papers', async (request, reply) => {
    const parsed = createPaperSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const paper = await createUploadedPaper({ ...parsed.data, userId: request.userId! });
    return reply.send(success({ paper }));
  });

  server.delete('/edu/papers/:id', async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send(error(400, paramsParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findUploadedPaperById(paramsParsed.data.id);
    if (!existing) return reply.status(404).send(error(404, '记录不存在'));
    if (existing.userId !== request.userId!) return reply.status(403).send(error(403, '无权操作'));
    await deleteUploadedPaper(paramsParsed.data.id);
    return reply.send(success({ deleted: true }));
  });

  // ----- 错题本（聚合我的所有考试错题）-----
  server.get('/edu/wrong-book', async (request, reply) => {
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const recordsResult = await findMyExamRecords(request.userId!, { page: 1, pageSize: 100 });
    const wrongItems: Array<{
      recordId: string;
      questionId: string;
      answer: unknown;
      isCorrect: boolean;
    }> = [];
    for (const record of recordsResult.list) {
      const answers = (record.answers ?? []) as Array<{
        questionId: string;
        answer: unknown;
        isCorrect?: boolean;
      }>;
      for (const a of answers) {
        if (a.isCorrect === false) {
          wrongItems.push({
            recordId: record.id,
            questionId: a.questionId,
            answer: a.answer,
            isCorrect: false,
          });
        }
      }
    }
    const start = (parsed.data.page - 1) * parsed.data.pageSize;
    const paged = wrongItems.slice(start, start + parsed.data.pageSize);
    return reply.send(success({
      list: paged,
      total: wrongItems.length,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    }));
  });

  // ----- 学习报告（聚合统计）-----
  server.get('/edu/my-report', async (request, reply) => {
    const userId = request.userId!;
    // 我的课程
    const lessonsResult = await findMyLessons(userId, { page: 1, pageSize: 100 });
    const totalLessons = lessonsResult.total;
    const completedLessons = lessonsResult.list.filter((s) => s.status === 2).length;
    const inProgressLessons = lessonsResult.list.filter((s) => s.status === 1).length;
    const avgProgress = lessonsResult.list.length > 0
      ? Math.round(lessonsResult.list.reduce((sum, s) => sum + (s.progress ?? 0), 0) / lessonsResult.list.length)
      : 0;
    // 我的考试
    const examResult = await findMyExamRecords(userId, { page: 1, pageSize: 100 });
    const totalExams = examResult.total;
    const passedExams = examResult.list.filter((r) => r.isPassed).length;
    const avgScore = examResult.list.length > 0
      ? Math.round(examResult.list.reduce((sum, r) => sum + Number(r.score ?? 0), 0) / examResult.list.length)
      : 0;
    // 我的证书
    const certResult = await findCertificates({ page: 1, pageSize: 100, userId, status: 1 });
    const totalCertificates = certResult.total;
    return reply.send(success({
      lessons: { total: totalLessons, completed: completedLessons, inProgress: inProgressLessons, avgProgress },
      exams: { total: totalExams, passed: passedExams, avgScore },
      certificates: { total: totalCertificates },
    }));
  });
};
