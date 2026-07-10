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
};
