import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
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
import { db } from '../db/index.js';
import { lessonRecords, eduNotes, eduOfflineRecords, eduUploadedCerts } from '@ihui/database';
import { exportToExcel } from '../services/excel-export-service.js';
import { generateReportPDF } from '../services/pdf-service.js';

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
  attachments: z.array(z.object({
    url: z.string().min(1).max(2048),
    name: z.string().min(1).max(255),
    type: z.string().min(1).max(100),
    size: z.number().int().min(0).max(100 * 1024 * 1024),
  })).max(20).default([]),
});

const updateNoteSchema = z.object({
  lessonId: z.string().uuid().nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  content: z.string().min(1).max(10000).optional(),
  isPublic: z.boolean().optional(),
  attachments: z.array(z.object({
    url: z.string().min(1).max(2048),
    name: z.string().min(1).max(255),
    type: z.string().min(1).max(100),
    size: z.number().int().min(0).max(100 * 1024 * 1024),
  })).max(20).optional(),
});

const createOfflineRecordSchema = z.object({
  type: z.string().max(50),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  hours: z.number().min(0).optional(),
  occurredAt: z.coerce.date().optional(),
  attachments: z.array(z.object({
    url: z.string().min(1).max(2048),
    name: z.string().min(1).max(255),
    type: z.string().min(1).max(100),
    size: z.number().int().min(0).max(100 * 1024 * 1024),
  })).max(20).default([]),
});

const updateOfflineRecordSchema = z.object({
  type: z.string().max(50).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  hours: z.number().min(0).optional(),
  occurredAt: z.coerce.date().optional(),
  attachments: z.array(z.object({
    url: z.string().min(1).max(2048),
    name: z.string().min(1).max(255),
    type: z.string().min(1).max(100),
    size: z.number().int().min(0).max(100 * 1024 * 1024),
  })).max(20).optional(),
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
// 学习报告导出 - 8 维聚合 schema
// =============================================================================

const exportReportSchema = z.object({
  format: z.enum(['pdf', 'excel', 'json']).default('json'),
  dateRange: z
    .object({
      start: z.string().min(1),
      end: z.string().min(1),
    })
    .optional(),
});

interface StudentReportData {
  lessons: { total: number; completed: number; inProgress: number; avgProgress: number };
  exams: { total: number; passed: number; avgScore: number };
  certificates: { total: number };
  lessonRecords: { totalDuration: number; completedSections: number };
  notes: { total: number };
  offlineRecords: { total: number; totalHours: number };
  uploadedCerts: { total: number; approved: number };
}

/**
 * 聚合学员 8 维学习数据(支持 dateRange 过滤笔记/线下记录时间范围)。
 * 用于 `/edu/my-report/export` 和 admin 端 `/admin/edu/students/:userId/report/export`。
 */
export async function getStudentReportData(
  userId: string,
  dateRange?: { start: string; end: string },
): Promise<StudentReportData> {
  // 课程
  const lessonsResult = await findMyLessons(userId, { page: 1, pageSize: 100 });
  const totalLessons = lessonsResult.total;
  const completedLessons = lessonsResult.list.filter((s) => s.status === 2).length;
  const inProgressLessons = lessonsResult.list.filter((s) => s.status === 1).length;
  const avgProgress =
    lessonsResult.list.length > 0
      ? Math.round(lessonsResult.list.reduce((sum, s) => sum + (s.progress ?? 0), 0) / lessonsResult.list.length)
      : 0;

  // 考试
  const examResult = await findMyExamRecords(userId, { page: 1, pageSize: 100 });
  const totalExams = examResult.total;
  const passedExams = examResult.list.filter((r) => r.isPassed).length;
  const avgScore =
    examResult.list.length > 0
      ? Math.round(examResult.list.reduce((sum, r) => sum + Number(r.score ?? 0), 0) / examResult.list.length)
      : 0;

  // 证书
  const certResult = await findCertificates({ page: 1, pageSize: 100, userId, status: 1 });
  const totalCertificates = certResult.total;

  // 视频学习记录
  const [lrAgg] = await db
    .select({
      totalDuration: sql<number>`coalesce(sum(${lessonRecords.watchDuration}), 0)::int`,
      completedSections: sql<number>`count(*) filter (where ${lessonRecords.status} = 2)::int`,
    })
    .from(lessonRecords)
    .where(eq(lessonRecords.userId, userId));

  // 笔记(dateRange 可选过滤)
  const notesConds = [eq(eduNotes.userId, userId)];
  if (dateRange) {
    notesConds.push(
      gte(eduNotes.createdAt, new Date(dateRange.start)),
      lte(eduNotes.createdAt, new Date(`${dateRange.end}T23:59:59.999Z`)),
    );
  }
  const [notesAgg] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(eduNotes)
    .where(and(...notesConds));

  // 线下记录
  const [offlineAgg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      totalHours: sql<number>`coalesce(sum(${eduOfflineRecords.hours}), 0)::float`,
    })
    .from(eduOfflineRecords)
    .where(eq(eduOfflineRecords.userId, userId));

  // 自传证书
  const [certUploadAgg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      approved: sql<number>`count(*) filter (where ${eduUploadedCerts.status} = 'approved')::int`,
    })
    .from(eduUploadedCerts)
    .where(eq(eduUploadedCerts.userId, userId));

  return {
    lessons: { total: totalLessons, completed: completedLessons, inProgress: inProgressLessons, avgProgress },
    exams: { total: totalExams, passed: passedExams, avgScore },
    certificates: { total: totalCertificates },
    lessonRecords: {
      totalDuration: lrAgg?.totalDuration ?? 0,
      completedSections: lrAgg?.completedSections ?? 0,
    },
    notes: { total: notesAgg?.total ?? 0 },
    offlineRecords: {
      total: offlineAgg?.total ?? 0,
      totalHours: offlineAgg?.totalHours ?? 0,
    },
    uploadedCerts: {
      total: certUploadAgg?.total ?? 0,
      approved: certUploadAgg?.approved ?? 0,
    },
  };
}

/**
 * 将 8 维聚合数据扁平化为 Excel 行(3 列:维度 / 指标 / 数值)。
 */
function flattenReportToRows(data: StudentReportData): Array<Record<string, unknown>> {
  return [
    { category: '课程', metric: '总课程', value: data.lessons.total },
    { category: '课程', metric: '已完成', value: data.lessons.completed },
    { category: '课程', metric: '进行中', value: data.lessons.inProgress },
    { category: '课程', metric: '平均进度', value: `${data.lessons.avgProgress}%` },
    { category: '考试', metric: '总考试', value: data.exams.total },
    { category: '考试', metric: '已通过', value: data.exams.passed },
    { category: '考试', metric: '平均分', value: data.exams.avgScore },
    { category: '证书', metric: '总证书', value: data.certificates.total },
    { category: '视频学习', metric: '总时长(秒)', value: data.lessonRecords.totalDuration },
    { category: '视频学习', metric: '完成小节数', value: data.lessonRecords.completedSections },
    { category: '笔记', metric: '总笔记', value: data.notes.total },
    { category: '线下记录', metric: '总记录', value: data.offlineRecords.total },
    { category: '线下记录', metric: '总学时', value: data.offlineRecords.totalHours.toFixed(1) },
    { category: '自传证书', metric: '总数', value: data.uploadedCerts.total },
    { category: '自传证书', metric: '已审核', value: data.uploadedCerts.approved },
  ];
}

/**
 * 将 8 维聚合数据扁平化为 PDF sections。
 */
function flattenReportToSections(data: StudentReportData): Array<{ heading: string; content: string }> {
  return [
    {
      heading: '课程',
      content: `总课程 ${data.lessons.total}, 已完成 ${data.lessons.completed}, 进行中 ${data.lessons.inProgress}, 平均进度 ${data.lessons.avgProgress}%`,
    },
    {
      heading: '考试',
      content: `总考试 ${data.exams.total}, 已通过 ${data.exams.passed}, 平均分 ${data.exams.avgScore}`,
    },
    { heading: '证书', content: `总证书 ${data.certificates.total}` },
    {
      heading: '视频学习',
      content: `总时长 ${Math.floor((data.lessonRecords.totalDuration ?? 0) / 60)} 分钟, 完成小节 ${data.lessonRecords.completedSections}`,
    },
    { heading: '笔记', content: `总笔记 ${data.notes.total}` },
    {
      heading: '线下记录',
      content: `总记录 ${data.offlineRecords.total}, 总学时 ${data.offlineRecords.totalHours.toFixed(1)} 小时`,
    },
    {
      heading: '自传证书',
      content: `总数 ${data.uploadedCerts.total}, 已审核 ${data.uploadedCerts.approved}`,
    },
  ];
}

/**
 * 通用学习报告导出处理函数 - 学员端 / admin 端共用。
 * @param userId 学员 ID
 * @param format 导出格式 pdf/excel/json
 * @param dateRange 可选时间范围
 * @param reply FastifyReply
 * @returns reply.send(...)
 */
export async function sendStudentReport(
  reply: FastifyReply,
  userId: string,
  format: 'pdf' | 'excel' | 'json',
  dateRange?: { start: string; end: string },
): Promise<FastifyReply> {
  const data = await getStudentReportData(userId, dateRange);

  if (format === 'json') {
    return reply.send(success(data));
  }

  if (format === 'excel') {
    const buffer = await exportToExcel(flattenReportToRows(data), {
      sheetName: '学习报告',
      columns: [
        { header: '维度', field: 'category', width: 16, type: 'str' },
        { header: '指标', field: 'metric', width: 20, type: 'str' },
        { header: '数值', field: 'value', width: 16, type: 'str' },
      ],
      filename: `student-report-${userId.slice(0, 8)}.xlsx`,
    });
    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="student-report-${userId.slice(0, 8)}.xlsx"`)
      .send(buffer);
  }

  // PDF
  const pdfResult = await generateReportPDF({
    title: '学习报告',
    subtitle: `生成时间: ${new Date().toISOString()}`,
    sections: flattenReportToSections(data),
    generatedAt: new Date(),
  });
  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `attachment; filename="student-report-${userId.slice(0, 8)}.pdf"`)
    .send(pdfResult.buffer);
}

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

  // ----- 导出学习报告(PDF / Excel / JSON)-----
  server.post('/edu/my-report/export', async (request, reply) => {
    const parsed = exportReportSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { format, dateRange } = parsed.data;
    return sendStudentReport(reply, request.userId!, format, dateRange);
  });
};
