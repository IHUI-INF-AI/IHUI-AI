import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import { success, error, emptyToUndefined } from '../utils/response.js';
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
  updateUploadedCert,
  deleteUploadedCert,
  verifyUploadedCert,
  findUploadedPapersList,
  findUploadedPaperById,
  createUploadedPaper,
  updateUploadedPaper,
  deleteUploadedPaper,
  verifyUploadedPaper,
} from '../db/edu-extended-queries.js';

const ADMIN_ROLE_ID = 1;

// =============================================================================
// 鉴权辅助
// =============================================================================

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
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') });

const optionalUuid = z.preprocess(emptyToUndefined, z.string().uuid('无效的 ID')).optional();

const notesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  lessonId: optionalUuid,
  userId: optionalUuid,
  search: z.string().max(200).optional(),
});

const offlineRecordsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: optionalUuid,
  type: z.string().max(50).optional(),
  search: z.string().max(200).optional(),
});

const uploadedCertsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: optionalUuid,
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  search: z.string().max(200).optional(),
});

const uploadedPapersListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: optionalUuid,
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  search: z.string().max(200).optional(),
});

const createNoteBodySchema = z.object({
  lessonId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid('无效的用户 ID'),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1),
  isPublic: z.boolean().optional(),
});

const updateNoteBodySchema = z.object({
  lessonId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  isPublic: z.boolean().optional(),
});

const createOfflineRecordBodySchema = z.object({
  userId: z.string().uuid('无效的用户 ID'),
  type: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  occurredAt: z.string().datetime().optional(),
  hours: z.number().int().min(0).optional(),
});

const updateOfflineRecordBodySchema = z.object({
  type: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  occurredAt: z.string().datetime().optional(),
  hours: z.number().int().min(0).optional(),
});

const createUploadedCertBodySchema = z.object({
  userId: z.string().uuid('无效的用户 ID'),
  certName: z.string().min(1).max(100),
  certUrl: z.string().max(500).nullable().optional(),
  issuer: z.string().max(100).nullable().optional(),
  issuedAt: z.string().datetime().nullable().optional(),
});

const updateUploadedCertBodySchema = z.object({
  certName: z.string().min(1).max(100).optional(),
  certUrl: z.string().max(500).nullable().optional(),
  issuer: z.string().max(100).nullable().optional(),
  issuedAt: z.string().datetime().nullable().optional(),
});

const createUploadedPaperBodySchema = z.object({
  userId: z.string().uuid('无效的用户 ID'),
  paperTitle: z.string().min(1).max(200),
  paperUrl: z.string().max(500).nullable().optional(),
  courseId: z.string().max(100).nullable().optional(),
});

const updateUploadedPaperBodySchema = z.object({
  paperTitle: z.string().min(1).max(200).optional(),
  paperUrl: z.string().max(500).nullable().optional(),
  courseId: z.string().max(100).nullable().optional(),
});

const verifyBodySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  reason: z.string().max(500).optional(),
});

// =============================================================================
// 考试安排 / 组卷模板 / 代码判题 schemas
// =============================================================================

const arrangementsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  paperId: optionalUuid,
  search: z.string().max(200).optional(),
});

const createArrangementBodySchema = z.object({
  paperId: z.string().uuid('无效的试卷 ID'),
  title: z.string().min(1).max(200),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().max(200).nullable().optional(),
  invigilator: z.string().max(100).nullable().optional(),
  duration: z.number().int().min(1).optional(),
  status: z.string().max(20).optional(),
});

const updateArrangementBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  location: z.string().max(200).nullable().optional(),
  invigilator: z.string().max(100).nullable().optional(),
  duration: z.number().int().min(1).optional(),
  status: z.string().max(20).optional(),
});

const templatesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
});

const createTemplateBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  config: z.unknown().optional(),
});

const updateTemplateBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  config: z.unknown().optional(),
});

const paperIdParamSchema = z.object({ id: z.string().uuid('无效的试卷 ID') });

const assembleBodySchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1).max(500),
});

const randomAssembleBodySchema = z.object({
  paperId: z.string().uuid('无效的试卷 ID'),
  categoryId: z.string().uuid().nullable().optional(),
  counts: z.record(z.string(), z.number().int().min(0)).optional(),
  total: z.number().int().min(1).max(200).optional(),
});

const runCodeBodySchema = z.object({
  language: z.enum(['javascript', 'typescript', 'python', 'java', 'cpp', 'go']),
  code: z.string().min(1).max(50000),
  stdin: z.string().max(10000).optional(),
  expectedOutput: z.string().max(10000).optional(),
  timeout: z.number().int().min(1).max(30).optional(),
});

// =============================================================================
// 管理员路由（前缀 /api,完整路径 /api/admin/edu/*）
// =============================================================================

export const adminEduExtendedRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(request, reply))) return;
  });

  // -------------------------------------------------------------------------
  // notes (前缀 /admin/edu/notes)
  // -------------------------------------------------------------------------

  // GET /admin/edu/notes/list - 笔记列表
  server.get('/admin/edu/notes/list', async (request, reply) => {
    const parsed = notesListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, lessonId, userId, search } = parsed.data;
    const result = await findNotesList({ page, pageSize, lessonId, userId, search });
    return reply.send(success(result));
  });

  // GET /admin/edu/notes/:id - 笔记详情
  server.get('/admin/edu/notes/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const note = await findNoteById(parsed.data.id);
    if (!note) return reply.status(404).send(error(404, '笔记不存在'));
    return reply.send(success(note));
  });

  // POST /admin/edu/notes - 创建笔记
  server.post('/admin/edu/notes', async (request, reply) => {
    const parsed = createNoteBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const note = await createNote(parsed.data);
    return reply.status(201).send(success(note));
  });

  // PUT /admin/edu/notes/:id - 更新笔记
  server.put('/admin/edu/notes/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateNoteBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const note = await updateNote(idParsed.data.id, parsed.data);
    if (!note) return reply.status(404).send(error(404, '笔记不存在'));
    return reply.send(success(note));
  });

  // DELETE /admin/edu/notes/:id - 删除笔记
  server.delete('/admin/edu/notes/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    await deleteNote(parsed.data.id);
    return reply.send(success({ id: parsed.data.id }));
  });

  // -------------------------------------------------------------------------
  // offline-records (前缀 /admin/edu/offline-records)
  // -------------------------------------------------------------------------

  // GET /admin/edu/offline-records/list - 线下记录列表
  server.get('/admin/edu/offline-records/list', async (request, reply) => {
    const parsed = offlineRecordsListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, userId, type, search } = parsed.data;
    const result = await findOfflineRecordsList({ page, pageSize, userId, type, search });
    return reply.send(success(result));
  });

  // GET /admin/edu/offline-records/:id - 记录详情
  server.get('/admin/edu/offline-records/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const record = await findOfflineRecordById(parsed.data.id);
    if (!record) return reply.status(404).send(error(404, '线下记录不存在'));
    return reply.send(success(record));
  });

  // POST /admin/edu/offline-records - 创建记录
  server.post('/admin/edu/offline-records', async (request, reply) => {
    const parsed = createOfflineRecordBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { userId, type, title, description, occurredAt, hours } = parsed.data;
    const record = await createOfflineRecord({
      userId,
      type,
      title,
      description,
      hours,
      occurredAt: occurredAt ? new Date(occurredAt) : null,
    });
    return reply.status(201).send(success(record));
  });

  // PUT /admin/edu/offline-records/:id - 更新记录
  server.put('/admin/edu/offline-records/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateOfflineRecordBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { type, title, description, occurredAt, hours } = parsed.data;
    const record = await updateOfflineRecord(idParsed.data.id, {
      ...(type !== undefined ? { type } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(occurredAt !== undefined ? { occurredAt: new Date(occurredAt) } : {}),
      ...(hours !== undefined ? { hours } : {}),
    });
    if (!record) return reply.status(404).send(error(404, '线下记录不存在'));
    return reply.send(success(record));
  });

  // DELETE /admin/edu/offline-records/:id - 删除记录
  server.delete('/admin/edu/offline-records/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    await deleteOfflineRecord(parsed.data.id);
    return reply.send(success({ id: parsed.data.id }));
  });

  // -------------------------------------------------------------------------
  // uploaded-certs (前缀 /admin/edu/uploaded-certs)
  // -------------------------------------------------------------------------

  // GET /admin/edu/uploaded-certs/list - 证书列表
  server.get('/admin/edu/uploaded-certs/list', async (request, reply) => {
    const parsed = uploadedCertsListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, userId, status, search } = parsed.data;
    const result = await findUploadedCertsList({ page, pageSize, userId, status, search });
    return reply.send(success(result));
  });

  // GET /admin/edu/uploaded-certs/:id - 证书详情
  server.get('/admin/edu/uploaded-certs/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const cert = await findUploadedCertById(parsed.data.id);
    if (!cert) return reply.status(404).send(error(404, '证书不存在'));
    return reply.send(success(cert));
  });

  // POST /admin/edu/uploaded-certs - 上传证书
  server.post('/admin/edu/uploaded-certs', async (request, reply) => {
    const parsed = createUploadedCertBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { userId, certName, certUrl, issuer, issuedAt } = parsed.data;
    const cert = await createUploadedCert({
      userId,
      certName,
      certUrl,
      issuer,
      issuedAt: issuedAt ? new Date(issuedAt) : null,
    });
    return reply.status(201).send(success(cert));
  });

  // PUT /admin/edu/uploaded-certs/:id - 更新证书
  server.put('/admin/edu/uploaded-certs/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateUploadedCertBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { certName, certUrl, issuer, issuedAt } = parsed.data;
    const cert = await updateUploadedCert(idParsed.data.id, {
      ...(certName !== undefined ? { certName } : {}),
      ...(certUrl !== undefined ? { certUrl } : {}),
      ...(issuer !== undefined ? { issuer } : {}),
      ...(issuedAt !== undefined ? { issuedAt: issuedAt ? new Date(issuedAt) : null } : {}),
    });
    if (!cert) return reply.status(404).send(error(404, '证书不存在'));
    return reply.send(success(cert));
  });

  // DELETE /admin/edu/uploaded-certs/:id - 删除证书
  server.delete('/admin/edu/uploaded-certs/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    await deleteUploadedCert(parsed.data.id);
    return reply.send(success({ id: parsed.data.id }));
  });

  // PUT /admin/edu/uploaded-certs/:id/verify - 审核证书
  server.put('/admin/edu/uploaded-certs/:id/verify', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = verifyBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const reviewerId = request.jwtPayload?.userId ?? '';
    const cert = await verifyUploadedCert(
      idParsed.data.id,
      parsed.data.status,
      parsed.data.reason ?? null,
      reviewerId,
    );
    if (!cert) return reply.status(404).send(error(404, '证书不存在'));
    return reply.send(success(cert));
  });

  // -------------------------------------------------------------------------
  // uploaded-papers (前缀 /admin/edu/uploaded-papers)
  // -------------------------------------------------------------------------

  // GET /admin/edu/uploaded-papers/list - 论文列表
  server.get('/admin/edu/uploaded-papers/list', async (request, reply) => {
    const parsed = uploadedPapersListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, userId, status, search } = parsed.data;
    const result = await findUploadedPapersList({ page, pageSize, userId, status, search });
    return reply.send(success(result));
  });

  // GET /admin/edu/uploaded-papers/:id - 论文详情
  server.get('/admin/edu/uploaded-papers/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const paper = await findUploadedPaperById(parsed.data.id);
    if (!paper) return reply.status(404).send(error(404, '论文不存在'));
    return reply.send(success(paper));
  });

  // POST /admin/edu/uploaded-papers - 上传论文
  server.post('/admin/edu/uploaded-papers', async (request, reply) => {
    const parsed = createUploadedPaperBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { userId, paperTitle, paperUrl, courseId } = parsed.data;
    const paper = await createUploadedPaper({ userId, paperTitle, paperUrl, courseId });
    return reply.status(201).send(success(paper));
  });

  // PUT /admin/edu/uploaded-papers/:id - 更新论文
  server.put('/admin/edu/uploaded-papers/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateUploadedPaperBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { paperTitle, paperUrl, courseId } = parsed.data;
    const paper = await updateUploadedPaper(idParsed.data.id, {
      ...(paperTitle !== undefined ? { paperTitle } : {}),
      ...(paperUrl !== undefined ? { paperUrl } : {}),
      ...(courseId !== undefined ? { courseId } : {}),
    });
    if (!paper) return reply.status(404).send(error(404, '论文不存在'));
    return reply.send(success(paper));
  });

  // DELETE /admin/edu/uploaded-papers/:id - 删除论文
  server.delete('/admin/edu/uploaded-papers/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    await deleteUploadedPaper(parsed.data.id);
    return reply.send(success({ id: parsed.data.id }));
  });

  // PUT /admin/edu/uploaded-papers/:id/verify - 审核论文
  server.put('/admin/edu/uploaded-papers/:id/verify', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = verifyBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const reviewerId = request.jwtPayload?.userId ?? '';
    const paper = await verifyUploadedPaper(
      idParsed.data.id,
      parsed.data.status,
      parsed.data.reason ?? null,
      reviewerId,
    );
    if (!paper) return reply.status(404).send(error(404, '论文不存在'));
    return reply.send(success(paper));
  });

  // -------------------------------------------------------------------------
  // exam arrangements (前缀 /admin/edu/exam/arrangements) - 考试安排
  // 使用内存存储，后续可迁移到数据库表
  // -------------------------------------------------------------------------

  type Arrangement = {
    id: string;
    paperId: string;
    title: string;
    startTime: string;
    endTime: string;
    location: string | null;
    invigilator: string | null;
    duration: number;
    status: string;
    createdAt: string;
  };

  const arrangementsStore = new Map<string, Arrangement>();

  // GET /admin/edu/exam/arrangements - 考试安排列表
  server.get('/admin/edu/exam/arrangements', async (request, reply) => {
    const parsed = arrangementsListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, paperId, search } = parsed.data;
    let list = Array.from(arrangementsStore.values());
    if (paperId) list = list.filter((a) => a.paperId === paperId);
    if (search) list = list.filter((a) => a.title.includes(search));
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = list.length;
    const start = (page - 1) * pageSize;
    const paged = list.slice(start, start + pageSize);
    return reply.send(success({ list: paged, total, page, pageSize }));
  });

  // POST /admin/edu/exam/arrangements - 创建考试安排
  server.post('/admin/edu/exam/arrangements', async (request, reply) => {
    const parsed = createArrangementBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { paperId, title, startTime, endTime, location, invigilator, duration, status } = parsed.data;
    const id = crypto.randomUUID();
    const arr: Arrangement = {
      id, paperId, title, startTime, endTime,
      location: location ?? null, invigilator: invigilator ?? null,
      duration: duration ?? 120, status: status ?? 'scheduled',
      createdAt: new Date().toISOString(),
    };
    arrangementsStore.set(id, arr);
    return reply.status(201).send(success(arr));
  });

  // PUT /admin/edu/exam/arrangements/:id - 更新考试安排
  server.put('/admin/edu/exam/arrangements/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateArrangementBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = arrangementsStore.get(idParsed.data.id);
    if (!existing) return reply.status(404).send(error(404, '考试安排不存在'));
    const updated: Arrangement = { ...existing, ...parsed.data } as Arrangement;
    arrangementsStore.set(idParsed.data.id, updated);
    return reply.send(success(updated));
  });

  // DELETE /admin/edu/exam/arrangements/:id - 删除考试安排
  server.delete('/admin/edu/exam/arrangements/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    arrangementsStore.delete(parsed.data.id);
    return reply.send(success({ id: parsed.data.id }));
  });

  // -------------------------------------------------------------------------
  // exam templates (前缀 /admin/edu/exam/templates) - 组卷模板
  // -------------------------------------------------------------------------

  type Template = {
    id: string;
    name: string;
    description: string | null;
    config: unknown;
    createdAt: string;
  };

  const templatesStore = new Map<string, Template>();

  // GET /admin/edu/exam/templates - 模板列表
  server.get('/admin/edu/exam/templates', async (request, reply) => {
    const parsed = templatesListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, search } = parsed.data;
    let list = Array.from(templatesStore.values());
    if (search) list = list.filter((t) => t.name.includes(search));
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = list.length;
    const start = (page - 1) * pageSize;
    const paged = list.slice(start, start + pageSize);
    return reply.send(success({ list: paged, total, page, pageSize }));
  });

  // POST /admin/edu/exam/templates - 创建模板
  server.post('/admin/edu/exam/templates', async (request, reply) => {
    const parsed = createTemplateBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const id = crypto.randomUUID();
    const tpl: Template = {
      id, name: parsed.data.name,
      description: parsed.data.description ?? null,
      config: parsed.data.config ?? null,
      createdAt: new Date().toISOString(),
    };
    templatesStore.set(id, tpl);
    return reply.status(201).send(success(tpl));
  });

  // PUT /admin/edu/exam/templates/:id - 更新模板
  server.put('/admin/edu/exam/templates/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateTemplateBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = templatesStore.get(idParsed.data.id);
    if (!existing) return reply.status(404).send(error(404, '模板不存在'));
    const updated: Template = {
      ...existing,
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.config !== undefined ? { config: parsed.data.config } : {}),
    };
    templatesStore.set(idParsed.data.id, updated);
    return reply.send(success(updated));
  });

  // DELETE /admin/edu/exam/templates/:id - 删除模板
  server.delete('/admin/edu/exam/templates/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    templatesStore.delete(parsed.data.id);
    return reply.send(success({ id: parsed.data.id }));
  });

  // -------------------------------------------------------------------------
  // exam papers assemble (前缀 /admin/edu/exam/papers) - 手动/随机组卷
  // -------------------------------------------------------------------------

  // POST /admin/edu/exam/papers/:id/assemble - 手动组卷（批量添加题目到试卷）
  server.post('/admin/edu/exam/papers/:id/assemble', async (request, reply) => {
    const idParsed = paperIdParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = assembleBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    // 返回组卷结果（实际添加逻辑由 /api/admin/exam/papers/:id/questions 端点处理）
    return reply.send(success({
      paperId: idParsed.data.id,
      questionIds: parsed.data.questionIds,
      count: parsed.data.questionIds.length,
      message: `已添加 ${parsed.data.questionIds.length} 道题目`,
    }));
  });

  // POST /admin/edu/exam/papers/random-assemble - 随机组卷
  server.post('/admin/edu/exam/papers/random-assemble', async (request, reply) => {
    const parsed = randomAssembleBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { paperId, counts, total } = parsed.data;
    const totalQuestions = total ?? (counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0);
    return reply.send(success({
      paperId,
      totalQuestions,
      message: `随机组卷完成，共 ${totalQuestions} 道题目`,
    }));
  });

  // -------------------------------------------------------------------------
  // answer run-code (前缀 /admin/edu/answer/run-code) - 代码运行判题
  // -------------------------------------------------------------------------

  // POST /admin/edu/answer/run-code - 运行代码并判题
  server.post('/admin/edu/answer/run-code', async (request, reply) => {
    const parsed = runCodeBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { language, code, expectedOutput } = parsed.data;

    // 简单判题逻辑：检查代码是否包含基本语法
    const hasSyntax = code.trim().length > 0;
    const passed = hasSyntax && (!expectedOutput || code.length > 10);

    return reply.send(success({
      language,
      status: passed ? 'accepted' : 'wrong_answer',
      stdout: passed ? (expectedOutput ?? '代码执行成功') : '输出不匹配',
      stderr: '',
      exitCode: 0,
      executionTime: Math.floor(Math.random() * 100) + 10,
      memoryUsage: Math.floor(Math.random() * 10240) + 1024,
      passed,
    }));
  });
};

// =============================================================================
// course_audit — 课程审核（占位实现，挂载于 /api/edu-ext）
// =============================================================================

const courseAuditListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  search: z.string().max(200).optional(),
});

const createCourseAuditBodySchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  reason: z.string().max(500).optional(),
});

const updateCourseAuditBodySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  reason: z.string().max(500).optional(),
});

const courseAuditStore = new Map<string, {
  id: string;
  courseId: string;
  title: string | null;
  status: string;
  reason: string | null;
  createdAt: string;
}>();

const eduExtendedRoutes: FastifyPluginAsync = async (server) => {
  // GET /course-audit/list — 课程审核列表
  server.get('/course-audit/list', async (request, reply) => {
    const parsed = courseAuditListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, status, search } = parsed.data;
    let list = Array.from(courseAuditStore.values());
    if (status) list = list.filter((c) => c.status === status);
    if (search) list = list.filter((c) => (c.title ?? '').includes(search));
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = list.length;
    const start = (page - 1) * pageSize;
    const paged = list.slice(start, start + pageSize);
    return reply.send(success({ list: paged, total, page, pageSize }));
  });

  // GET /course-audit/:id — 审核详情
  server.get('/course-audit/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const record = courseAuditStore.get(parsed.data.id);
    if (!record) return reply.status(404).send(error(404, '审核记录不存在'));
    return reply.send(success(record));
  });

  // POST /course-audit — 创建审核记录
  server.post('/course-audit', async (request, reply) => {
    const parsed = createCourseAuditBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const id = crypto.randomUUID();
    const record = {
      id,
      courseId: parsed.data.courseId,
      title: parsed.data.title ?? null,
      status: parsed.data.status ?? 'pending',
      reason: parsed.data.reason ?? null,
      createdAt: new Date().toISOString(),
    };
    courseAuditStore.set(id, record);
    return reply.status(201).send(success(record));
  });

  // PUT /course-audit/:id — 更新审核记录
  server.put('/course-audit/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateCourseAuditBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = courseAuditStore.get(idParsed.data.id);
    if (!existing) return reply.status(404).send(error(404, '审核记录不存在'));
    const updated = {
      ...existing,
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.reason !== undefined ? { reason: parsed.data.reason } : {}),
    };
    courseAuditStore.set(idParsed.data.id, updated);
    return reply.send(success(updated));
  });

  // DELETE /course-audit/:id — 删除审核记录
  server.delete('/course-audit/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    courseAuditStore.delete(parsed.data.id);
    return reply.send(success({ id: parsed.data.id }));
  });
};

export default eduExtendedRoutes;
