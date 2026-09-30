// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, and, sql, inArray } from 'drizzle-orm'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { db, dbRead } from '../db/index.js'
import {
  zhsCourseAudit,
  examPapers,
  examQuestions,
  eduExamArrangements,
  eduAssembleTemplates,
} from '@ihui/database'
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
} from '../db/edu-extended-queries.js'
import { sendStudentReport } from './edu-public.js'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

const optionalUuid = z
  .transform(emptyToUndefined)
  .pipe(z.uuid({ error: '无效的 ID' }))
  .optional()

const notesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  lessonId: optionalUuid,
  userId: optionalUuid,
  search: z.string().max(200).optional(),
})

const offlineRecordsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: optionalUuid,
  type: z.string().max(50).optional(),
  search: z.string().max(200).optional(),
})

const uploadedCertsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: optionalUuid,
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  search: z.string().max(200).optional(),
})

const uploadedPapersListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: optionalUuid,
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  search: z.string().max(200).optional(),
})

const attachmentItemSchema = z.object({
  url: z.string().min(1).max(2048),
  name: z.string().min(1).max(255),
  type: z.string().min(1).max(100),
  size: z
    .number()
    .int()
    .min(0)
    .max(100 * 1024 * 1024),
})

const attachmentsSchema = z.array(attachmentItemSchema).max(20).default([])

const createNoteBodySchema = z.object({
  lessonId: z.uuid().nullable().optional(),
  userId: z.uuid({ error: '无效的用户 ID' }),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1),
  isPublic: z.boolean().optional(),
  attachments: attachmentsSchema.optional(),
})

const updateNoteBodySchema = z.object({
  lessonId: z.uuid().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  isPublic: z.boolean().optional(),
  attachments: attachmentsSchema.optional(),
})

const createOfflineRecordBodySchema = z.object({
  userId: z.uuid({ error: '无效的用户 ID' }),
  type: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  occurredAt: z.iso.datetime().optional(),
  hours: z.number().int().min(0).optional(),
  attachments: attachmentsSchema.optional(),
})

const updateOfflineRecordBodySchema = z.object({
  type: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  occurredAt: z.iso.datetime().optional(),
  hours: z.number().int().min(0).optional(),
  attachments: attachmentsSchema.optional(),
})

const createUploadedCertBodySchema = z.object({
  userId: z.uuid({ error: '无效的用户 ID' }),
  certName: z.string().min(1).max(100),
  certUrl: z.string().max(500).nullable().optional(),
  issuer: z.string().max(100).nullable().optional(),
  issuedAt: z.iso.datetime().nullable().optional(),
})

const updateUploadedCertBodySchema = z.object({
  certName: z.string().min(1).max(100).optional(),
  certUrl: z.string().max(500).nullable().optional(),
  issuer: z.string().max(100).nullable().optional(),
  issuedAt: z.iso.datetime().nullable().optional(),
})

const createUploadedPaperBodySchema = z.object({
  userId: z.uuid({ error: '无效的用户 ID' }),
  paperTitle: z.string().min(1).max(200),
  paperUrl: z.string().max(500).nullable().optional(),
  courseId: z.string().max(100).nullable().optional(),
})

const updateUploadedPaperBodySchema = z.object({
  paperTitle: z.string().min(1).max(200).optional(),
  paperUrl: z.string().max(500).nullable().optional(),
  courseId: z.string().max(100).nullable().optional(),
})

const verifyBodySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  reason: z.string().max(500).optional(),
})

// =============================================================================
// 考试安排 / 组卷模板 / 代码判题 schemas
// =============================================================================

const arrangementsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  paperId: optionalUuid,
  search: z.string().max(200).optional(),
})

const createArrangementBodySchema = z.object({
  paperId: z.uuid({ error: '无效的试卷 ID' }),
  title: z.string().min(1).max(200),
  startTime: z.iso.datetime(),
  endTime: z.iso.datetime(),
  location: z.string().max(200).nullable().optional(),
  invigilator: z.string().max(100).nullable().optional(),
  duration: z.number().int().min(1).optional(),
  status: z.string().max(20).optional(),
})

const updateArrangementBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  startTime: z.iso.datetime().optional(),
  endTime: z.iso.datetime().optional(),
  location: z.string().max(200).nullable().optional(),
  invigilator: z.string().max(100).nullable().optional(),
  duration: z.number().int().min(1).optional(),
  status: z.string().max(20).optional(),
})

const templatesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
})

const createTemplateBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  config: z.unknown().optional(),
})

const updateTemplateBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  config: z.unknown().optional(),
})

const paperIdParamSchema = z.object({ id: z.uuid({ error: '无效的试卷 ID' }) })

const assembleBodySchema = z.object({
  questionIds: z.array(z.uuid()).min(1).max(500),
})

const randomAssembleBodySchema = z.object({
  paperId: z.uuid({ error: '无效的试卷 ID' }),
  categoryId: z.uuid().nullable().optional(),
  counts: z.record(z.string(), z.number().int().min(0)).optional(),
  total: z.number().int().min(1).max(200).optional(),
})

const runCodeBodySchema = z.object({
  language: z.enum(['javascript', 'typescript', 'python', 'java', 'cpp', 'go']),
  code: z.string().min(1).max(50000),
  stdin: z.string().max(10000).optional(),
  expectedOutput: z.string().max(10000).optional(),
  timeout: z.number().int().min(1).max(30).optional(),
})

// 组卷随机抽题允许的题型键(与 exam_questions.type 同域)
const QUESTION_TYPE_SET = new Set([
  'single_choice',
  'multi_choice',
  'judgment',
  'fill_blank',
  'subjective',
])

// =============================================================================
// 管理员路由（前缀 /api,完整路径 /api/admin/edu/*）
// =============================================================================

export const adminEduExtendedRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // -------------------------------------------------------------------------
  // notes (前缀 /admin/edu/notes)
  // -------------------------------------------------------------------------

  // GET /admin/edu/notes/list - 笔记列表
  server.get('/admin/edu/notes/list', async (request, reply) => {
    const parsed = notesListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, lessonId, userId, search } = parsed.data
    const result = await findNotesList({ page, pageSize, lessonId, userId, search })
    return reply.send(success(result))
  })

  // GET /admin/edu/notes/:id - 笔记详情
  server.get('/admin/edu/notes/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const note = await findNoteById(parsed.data.id)
    if (!note) return reply.status(404).send(error(404, '笔记不存在'))
    return reply.send(success(note))
  })

  // POST /admin/edu/notes - 创建笔记
  server.post('/admin/edu/notes', async (request, reply) => {
    const parsed = createNoteBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const note = await createNote(parsed.data)
    return reply.status(201).send(success(note))
  })

  // PUT /admin/edu/notes/:id - 更新笔记
  server.put('/admin/edu/notes/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateNoteBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const note = await updateNote(idParsed.data.id, parsed.data)
    if (!note) return reply.status(404).send(error(404, '笔记不存在'))
    return reply.send(success(note))
  })

  // DELETE /admin/edu/notes/:id - 删除笔记
  server.delete('/admin/edu/notes/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    await deleteNote(parsed.data.id)
    return reply.send(success({ id: parsed.data.id }))
  })

  // -------------------------------------------------------------------------
  // offline-records (前缀 /admin/edu/offline-records)
  // -------------------------------------------------------------------------

  // GET /admin/edu/offline-records/list - 线下记录列表
  server.get('/admin/edu/offline-records/list', async (request, reply) => {
    const parsed = offlineRecordsListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, userId, type, search } = parsed.data
    const result = await findOfflineRecordsList({ page, pageSize, userId, type, search })
    return reply.send(success(result))
  })

  // GET /admin/edu/offline-records/:id - 记录详情
  server.get('/admin/edu/offline-records/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const record = await findOfflineRecordById(parsed.data.id)
    if (!record) return reply.status(404).send(error(404, '线下记录不存在'))
    return reply.send(success(record))
  })

  // POST /admin/edu/offline-records - 创建记录
  server.post('/admin/edu/offline-records', async (request, reply) => {
    const parsed = createOfflineRecordBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { userId, type, title, description, occurredAt, hours, attachments } = parsed.data
    const record = await createOfflineRecord({
      userId,
      type,
      title,
      description,
      hours,
      occurredAt: occurredAt ? new Date(occurredAt) : null,
      attachments,
    })
    return reply.status(201).send(success(record))
  })

  // PUT /admin/edu/offline-records/:id - 更新记录
  server.put('/admin/edu/offline-records/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateOfflineRecordBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { type, title, description, occurredAt, hours, attachments } = parsed.data
    const record = await updateOfflineRecord(idParsed.data.id, {
      ...(type !== undefined ? { type } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(occurredAt !== undefined ? { occurredAt: new Date(occurredAt) } : {}),
      ...(hours !== undefined ? { hours } : {}),
      ...(attachments !== undefined ? { attachments } : {}),
    })
    if (!record) return reply.status(404).send(error(404, '线下记录不存在'))
    return reply.send(success(record))
  })

  // DELETE /admin/edu/offline-records/:id - 删除记录
  server.delete('/admin/edu/offline-records/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    await deleteOfflineRecord(parsed.data.id)
    return reply.send(success({ id: parsed.data.id }))
  })

  // -------------------------------------------------------------------------
  // uploaded-certs (前缀 /admin/edu/uploaded-certs)
  // -------------------------------------------------------------------------

  // GET /admin/edu/uploaded-certs/list - 证书列表
  server.get('/admin/edu/uploaded-certs/list', async (request, reply) => {
    const parsed = uploadedCertsListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, userId, status, search } = parsed.data
    const result = await findUploadedCertsList({ page, pageSize, userId, status, search })
    return reply.send(success(result))
  })

  // GET /admin/edu/uploaded-certs/:id - 证书详情
  server.get('/admin/edu/uploaded-certs/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const cert = await findUploadedCertById(parsed.data.id)
    if (!cert) return reply.status(404).send(error(404, '证书不存在'))
    return reply.send(success(cert))
  })

  // POST /admin/edu/uploaded-certs - 上传证书
  server.post('/admin/edu/uploaded-certs', async (request, reply) => {
    const parsed = createUploadedCertBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { userId, certName, certUrl, issuer, issuedAt } = parsed.data
    const cert = await createUploadedCert({
      userId,
      certName,
      certUrl,
      issuer,
      issuedAt: issuedAt ? new Date(issuedAt) : null,
    })
    return reply.status(201).send(success(cert))
  })

  // PUT /admin/edu/uploaded-certs/:id - 更新证书
  server.put('/admin/edu/uploaded-certs/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateUploadedCertBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { certName, certUrl, issuer, issuedAt } = parsed.data
    const cert = await updateUploadedCert(idParsed.data.id, {
      ...(certName !== undefined ? { certName } : {}),
      ...(certUrl !== undefined ? { certUrl } : {}),
      ...(issuer !== undefined ? { issuer } : {}),
      ...(issuedAt !== undefined ? { issuedAt: issuedAt ? new Date(issuedAt) : null } : {}),
    })
    if (!cert) return reply.status(404).send(error(404, '证书不存在'))
    return reply.send(success(cert))
  })

  // DELETE /admin/edu/uploaded-certs/:id - 删除证书
  server.delete('/admin/edu/uploaded-certs/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    await deleteUploadedCert(parsed.data.id)
    return reply.send(success({ id: parsed.data.id }))
  })

  // PUT /admin/edu/uploaded-certs/:id/verify - 审核证书
  server.put('/admin/edu/uploaded-certs/:id/verify', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = verifyBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const reviewerId = request.jwtPayload?.userId ?? ''
    const cert = await verifyUploadedCert(
      idParsed.data.id,
      parsed.data.status,
      parsed.data.reason ?? null,
      reviewerId,
    )
    if (!cert) return reply.status(404).send(error(404, '证书不存在'))
    return reply.send(success(cert))
  })

  // -------------------------------------------------------------------------
  // uploaded-papers (前缀 /admin/edu/uploaded-papers)
  // -------------------------------------------------------------------------

  // GET /admin/edu/uploaded-papers/list - 论文列表
  server.get('/admin/edu/uploaded-papers/list', async (request, reply) => {
    const parsed = uploadedPapersListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, userId, status, search } = parsed.data
    const result = await findUploadedPapersList({ page, pageSize, userId, status, search })
    return reply.send(success(result))
  })

  // GET /admin/edu/uploaded-papers/:id - 论文详情
  server.get('/admin/edu/uploaded-papers/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const paper = await findUploadedPaperById(parsed.data.id)
    if (!paper) return reply.status(404).send(error(404, '论文不存在'))
    return reply.send(success(paper))
  })

  // POST /admin/edu/uploaded-papers - 上传论文
  server.post('/admin/edu/uploaded-papers', async (request, reply) => {
    const parsed = createUploadedPaperBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { userId, paperTitle, paperUrl, courseId } = parsed.data
    const paper = await createUploadedPaper({ userId, paperTitle, paperUrl, courseId })
    return reply.status(201).send(success(paper))
  })

  // PUT /admin/edu/uploaded-papers/:id - 更新论文
  server.put('/admin/edu/uploaded-papers/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateUploadedPaperBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { paperTitle, paperUrl, courseId } = parsed.data
    const paper = await updateUploadedPaper(idParsed.data.id, {
      ...(paperTitle !== undefined ? { paperTitle } : {}),
      ...(paperUrl !== undefined ? { paperUrl } : {}),
      ...(courseId !== undefined ? { courseId } : {}),
    })
    if (!paper) return reply.status(404).send(error(404, '论文不存在'))
    return reply.send(success(paper))
  })

  // DELETE /admin/edu/uploaded-papers/:id - 删除论文
  server.delete('/admin/edu/uploaded-papers/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    await deleteUploadedPaper(parsed.data.id)
    return reply.send(success({ id: parsed.data.id }))
  })

  // PUT /admin/edu/uploaded-papers/:id/verify - 审核论文
  server.put('/admin/edu/uploaded-papers/:id/verify', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = verifyBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const reviewerId = request.jwtPayload?.userId ?? ''
    const paper = await verifyUploadedPaper(
      idParsed.data.id,
      parsed.data.status,
      parsed.data.reason ?? null,
      reviewerId,
    )
    if (!paper) return reply.status(404).send(error(404, '论文不存在'))
    return reply.send(success(paper))
  })

  // -------------------------------------------------------------------------
  // exam arrangements (前缀 /admin/edu/exam/arrangements) - 考试安排
  // 2026-09-30 起落库 edu_exam_arrangements(原内存 Map 重启即丢,G-978073)。
  // 响应仍投递 ISO 字符串形状,前端契约不变。
  // -------------------------------------------------------------------------

  type ArrangementRow = typeof eduExamArrangements.$inferSelect

  function toArrangementApi(a: ArrangementRow) {
    return {
      id: a.id,
      paperId: a.paperId,
      title: a.title,
      startTime: a.startTime.toISOString(),
      endTime: a.endTime.toISOString(),
      location: a.location,
      invigilator: a.invigilator,
      duration: a.duration,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    }
  }

  // GET /admin/edu/exam/arrangements - 考试安排列表
  server.get('/admin/edu/exam/arrangements', async (request, reply) => {
    const parsed = arrangementsListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, paperId, search } = parsed.data
    const conds = []
    if (paperId) conds.push(eq(eduExamArrangements.paperId, paperId))
    if (search) conds.push(sql`${eduExamArrangements.title} ILIKE ${'%' + search + '%'}`)
    const where = conds.length > 0 ? and(...conds) : undefined
    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(eduExamArrangements)
        .where(where)
        .orderBy(desc(eduExamArrangements.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(eduExamArrangements)
        .where(where),
    ])
    return reply.send(
      success({
        list: rows.map(toArrangementApi),
        total: countRows[0]?.count ?? 0,
        page,
        pageSize,
      }),
    )
  })

  // POST /admin/edu/exam/arrangements - 创建考试安排
  server.post('/admin/edu/exam/arrangements', async (request, reply) => {
    const parsed = createArrangementBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { paperId, title, startTime, endTime, location, invigilator, duration, status } =
      parsed.data
    const start = new Date(startTime)
    const end = new Date(endTime)
    if (!(end > start)) {
      return reply.status(400).send(error(400, '结束时间必须晚于开始时间'))
    }
    const [paper] = await db
      .select({ id: examPapers.id })
      .from(examPapers)
      .where(eq(examPapers.id, paperId))
      .limit(1)
    if (!paper) return reply.status(404).send(error(404, '试卷不存在'))
    const [inserted] = await db
      .insert(eduExamArrangements)
      .values({
        paperId,
        title,
        startTime: start,
        endTime: end,
        location: location ?? null,
        invigilator: invigilator ?? null,
        duration: duration ?? 120,
        status: status ?? 'scheduled',
      })
      .returning()
    if (!inserted) return reply.status(500).send(error(500, '创建考试安排失败'))
    return reply.status(201).send(success(toArrangementApi(inserted)))
  })

  // PUT /admin/edu/exam/arrangements/:id - 更新考试安排
  server.put('/admin/edu/exam/arrangements/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateArrangementBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const patch: Partial<typeof eduExamArrangements.$inferInsert> = { updatedAt: new Date() }
    if (parsed.data.title !== undefined) patch.title = parsed.data.title
    if (parsed.data.startTime !== undefined) patch.startTime = new Date(parsed.data.startTime)
    if (parsed.data.endTime !== undefined) patch.endTime = new Date(parsed.data.endTime)
    if (parsed.data.location !== undefined) patch.location = parsed.data.location
    if (parsed.data.invigilator !== undefined) patch.invigilator = parsed.data.invigilator
    if (parsed.data.duration !== undefined) patch.duration = parsed.data.duration
    if (parsed.data.status !== undefined) patch.status = parsed.data.status
    const [updated] = await db
      .update(eduExamArrangements)
      .set(patch)
      .where(eq(eduExamArrangements.id, idParsed.data.id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '考试安排不存在'))
    return reply.send(success(toArrangementApi(updated)))
  })

  // DELETE /admin/edu/exam/arrangements/:id - 删除考试安排
  server.delete('/admin/edu/exam/arrangements/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [deleted] = await db
      .delete(eduExamArrangements)
      .where(eq(eduExamArrangements.id, parsed.data.id))
      .returning({ id: eduExamArrangements.id })
    if (!deleted) return reply.status(404).send(error(404, '考试安排不存在'))
    return reply.send(success({ id: deleted.id }))
  })

  // -------------------------------------------------------------------------
  // exam templates (前缀 /admin/edu/exam/templates) - 组卷模板
  // 2026-09-30 起落库 edu_assemble_templates(原内存 Map 重启即丢,G-978073)。
  // -------------------------------------------------------------------------

  type TemplateRow = typeof eduAssembleTemplates.$inferSelect

  function toTemplateApi(t: TemplateRow) {
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      config: t.config,
      createdAt: t.createdAt.toISOString(),
    }
  }

  // GET /admin/edu/exam/templates - 模板列表
  server.get('/admin/edu/exam/templates', async (request, reply) => {
    const parsed = templatesListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, search } = parsed.data
    const where = search ? sql`${eduAssembleTemplates.name} ILIKE ${'%' + search + '%'}` : undefined
    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(eduAssembleTemplates)
        .where(where)
        .orderBy(desc(eduAssembleTemplates.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(eduAssembleTemplates)
        .where(where),
    ])
    return reply.send(
      success({ list: rows.map(toTemplateApi), total: countRows[0]?.count ?? 0, page, pageSize }),
    )
  })

  // POST /admin/edu/exam/templates - 创建模板
  server.post('/admin/edu/exam/templates', async (request, reply) => {
    const parsed = createTemplateBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [inserted] = await db
      .insert(eduAssembleTemplates)
      .values({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        config: parsed.data.config ?? null,
      })
      .returning()
    if (!inserted) return reply.status(500).send(error(500, '创建模板失败'))
    return reply.status(201).send(success(toTemplateApi(inserted)))
  })

  // PUT /admin/edu/exam/templates/:id - 更新模板
  server.put('/admin/edu/exam/templates/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateTemplateBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const patch: Partial<typeof eduAssembleTemplates.$inferInsert> = { updatedAt: new Date() }
    if (parsed.data.name !== undefined) patch.name = parsed.data.name
    if (parsed.data.description !== undefined) patch.description = parsed.data.description
    if (parsed.data.config !== undefined) patch.config = parsed.data.config
    const [updated] = await db
      .update(eduAssembleTemplates)
      .set(patch)
      .where(eq(eduAssembleTemplates.id, idParsed.data.id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '模板不存在'))
    return reply.send(success(toTemplateApi(updated)))
  })

  // DELETE /admin/edu/exam/templates/:id - 删除模板
  server.delete('/admin/edu/exam/templates/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [deleted] = await db
      .delete(eduAssembleTemplates)
      .where(eq(eduAssembleTemplates.id, parsed.data.id))
      .returning({ id: eduAssembleTemplates.id })
    if (!deleted) return reply.status(404).send(error(404, '模板不存在'))
    return reply.send(success({ id: deleted.id }))
  })

  // -------------------------------------------------------------------------
  // exam papers assemble (前缀 /admin/edu/exam/papers) - 手动/随机组卷
  // 2026-09-30 起真实现:从来源题(其它试卷的题,或全库随机)克隆进目标试卷
  // (exam_questions.paper_id 指向唯一试卷,"组卷"= 复制题目行到目标卷,G-978073)。
  // -------------------------------------------------------------------------

  // 把一批源题克隆进目标试卷:sortOrder 追加到卷尾,内容逐字段拷贝。
  // 返回 {added, skipped} — skipped = 源题本就属于目标卷(幂等,不重复克隆)。
  async function cloneQuestionsIntoPaper(
    paperId: string,
    sourceIds: string[],
  ): Promise<{ added: number; skipped: number }> {
    if (sourceIds.length === 0) return { added: 0, skipped: 0 }
    const sources = await db
      .select()
      .from(examQuestions)
      .where(inArray(examQuestions.id, sourceIds))
    const [maxRow] = await db
      .select({ maxSort: sql<number>`COALESCE(MAX(${examQuestions.sortOrder}), 0)::int` })
      .from(examQuestions)
      .where(eq(examQuestions.paperId, paperId))
    let sortOrder = maxRow?.maxSort ?? 0
    let added = 0
    let skipped = 0
    const toInsert: (typeof examQuestions.$inferInsert)[] = []
    for (const q of sources) {
      if (q.paperId === paperId) {
        skipped += 1
        continue
      }
      sortOrder += 1
      toInsert.push({
        paperId,
        type: q.type,
        title: q.title,
        options: q.options,
        answer: q.answer,
        analysis: q.analysis,
        score: q.score,
        difficulty: q.difficulty,
        knowledgePointIds: q.knowledgePointIds,
        sortOrder,
      })
    }
    if (toInsert.length > 0) {
      await db.insert(examQuestions).values(toInsert)
      added = toInsert.length
    }
    return { added, skipped }
  }

  // POST /admin/edu/exam/papers/:id/assemble - 手动组卷(把选中的题克隆进目标试卷)
  server.post('/admin/edu/exam/papers/:id/assemble', async (request, reply) => {
    const idParsed = paperIdParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = assembleBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [paper] = await db
      .select({ id: examPapers.id })
      .from(examPapers)
      .where(eq(examPapers.id, idParsed.data.id))
      .limit(1)
    if (!paper) return reply.status(404).send(error(404, '试卷不存在'))
    const { added, skipped } = await cloneQuestionsIntoPaper(
      idParsed.data.id,
      parsed.data.questionIds,
    )
    return reply.send(
      success({
        paperId: idParsed.data.id,
        added,
        skipped,
        message: `已添加 ${added} 道题目${skipped > 0 ? `,${skipped} 道已在卷内跳过` : ''}`,
      }),
    )
  })

  // POST /admin/edu/exam/papers/random-assemble - 随机组卷
  // 按题型计数从全库(排除目标卷)随机抽题克隆进目标卷;库内题量不足时按实有数落卷并在结果里说明。
  server.post('/admin/edu/exam/papers/random-assemble', async (request, reply) => {
    const parsed = randomAssembleBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { paperId, counts } = parsed.data
    const [paper] = await db
      .select({ id: examPapers.id })
      .from(examPapers)
      .where(eq(examPapers.id, paperId))
      .limit(1)
    if (!paper) return reply.status(404).send(error(404, '试卷不存在'))
    const perType: Record<string, number> = {}
    let totalAdded = 0
    for (const [type, count] of Object.entries(counts ?? {})) {
      if (!QUESTION_TYPE_SET.has(type) || count <= 0) continue
      const pool = await db
        .select({ id: examQuestions.id })
        .from(examQuestions)
        .where(and(eq(examQuestions.type, type), sql`${examQuestions.paperId} <> ${paperId}`))
        .orderBy(sql`random()`)
        .limit(count)
      const { added } = await cloneQuestionsIntoPaper(
        paperId,
        pool.map((q) => q.id),
      )
      perType[type] = added
      totalAdded += added
    }
    return reply.send(
      success({
        paperId,
        totalQuestions: totalAdded,
        perType,
        message: `随机组卷完成,共 ${totalAdded} 道题目`,
      }),
    )
  })

  // -------------------------------------------------------------------------
  // answer run-code (前缀 /admin/edu/answer/run-code) - 代码运行判题
  // -------------------------------------------------------------------------

  // POST /admin/edu/answer/run-code - 运行代码并判题
  // 2026-09-30 起接 ai-service OS 沙箱真执行(POST /api/sandbox/run,argv 直传不经 shell):
  // 传 expectedOutput 则按归一化输出比对判题,否则以退出码 0 为通过。
  // 沙箱/运行时不可用 ⇒ 503 明示,绝不回退伪造"通过"(原实现 passed=code.length>10 + 随机耗时,G-978074)。
  server.post('/admin/edu/answer/run-code', async (request, reply) => {
    const parsed = runCodeBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { language, code, stdin, expectedOutput, timeout } = parsed.data
    if (stdin && stdin.length > 0) {
      return reply.status(400).send(error(400, '当前判题通道暂不支持标准输入,请在代码内自带输入'))
    }
    // argv 直传不经 shell,代码字符串不可能注入命令行
    const argvByLanguage: Partial<Record<typeof language, string[]>> = {
      javascript: ['node', '-e', code],
      python: ['python', '-c', code],
    }
    const argv = argvByLanguage[language]
    if (!argv) {
      const msg = `语言 ${language} 的判题执行通道暂未接入(当前支持 javascript/python)`
      return reply.status(400).send(error(400, msg))
    }
    let exec: {
      returncode?: number
      stdout?: string
      stderr?: string
      duration_ms?: number
      timed_out?: boolean
      backend?: string
      ok?: boolean
    }
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 45_000)
      let res: Response
      try {
        res = await aiServiceFetch(request, '/api/sandbox/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cmd: argv,
            policy: { timeout_s: timeout ?? 10 },
          }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        const msg = `判题沙箱不可用(ai-service ${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`
        return reply.status(503).send(error(503, msg))
      }
      const json = (await res.json()) as { data?: typeof exec }
      exec = json.data ?? {}
    } catch (err) {
      request.log.error(err)
      return reply.status(503).send(error(503, `判题沙箱调用失败: ${(err as Error).message}`))
    }
    const normalize = (s: string) => s.replace(/\r\n/g, '\n').trim()
    const stdout = exec.stdout ?? ''
    const passed =
      exec.returncode === 0 &&
      !exec.timed_out &&
      (expectedOutput === undefined || normalize(stdout) === normalize(expectedOutput))
    return reply.send(
      success({
        language,
        status: passed
          ? 'accepted'
          : exec.timed_out
            ? 'time_limit_exceeded'
            : exec.returncode === 0
              ? 'wrong_answer'
              : 'runtime_error',
        stdout,
        stderr: exec.stderr ?? '',
        exitCode: exec.returncode ?? -1,
        executionTime: Math.round(exec.duration_ms ?? 0),
        backend: exec.backend ?? null,
        passed,
      }),
    )
  })

  // GET /admin/edu/students/:userId/report/export — admin 端导出单个学员学习报告
  // 复用学员端的 sendStudentReport 共享逻辑(8 维聚合 + PDF/Excel/JSON 三格式)
  server.get('/admin/edu/students/:userId/report/export', async (request, reply) => {
    const paramsSchema = z.object({ userId: z.uuid({ error: '无效的用户 ID' }) })
    const paramsParsed = paramsSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send(error(400, paramsParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const querySchema = z.object({
      format: z.enum(['pdf', 'excel', 'json']).default('json'),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
    const queryParsed = querySchema.safeParse(request.query)
    if (!queryParsed.success) {
      return reply.status(400).send(error(400, queryParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { format, startDate, endDate } = queryParsed.data
    const dateRange = startDate && endDate ? { start: startDate, end: endDate } : undefined
    return sendStudentReport(reply, paramsParsed.data.userId, format, dateRange)
  })
}

// =============================================================================
// course_audit — 课程审核（挂载于 /api/edu-ext，使用 zhs_course_audit 表）
// =============================================================================

const courseAuditIdSchema = z.object({ id: z.coerce.number().int().positive() })

const courseAuditListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.coerce.number().int().optional(),
  search: z.string().max(200).optional(),
  operate: z.string().max(200).optional(),
  sourceId: z.string().max(200).optional(),
  creator: z.string().max(200).optional(),
})

const createCourseAuditBodySchema = z.object({
  courseId: z.coerce.number().int().positive(),
  title: z.string().min(1).max(200).optional(),
  status: z.coerce.number().int().optional(),
  reason: z.string().max(500).optional(),
})

const updateCourseAuditBodySchema = z.object({
  status: z.coerce.number().int().optional(),
  remark: z.string().max(500).optional(),
  reason: z.string().max(500).optional(),
})

/** 映射 zhsCourseAudit 行到前端 Audit 接口字段 */
function mapAuditRow(r: typeof zhsCourseAudit.$inferSelect) {
  return {
    id: String(r.id),
    type: 0,
    operate: 'update',
    sourceId: String(r.courseId),
    targetId: null,
    status: r.auditStatus,
    creator: r.auditor ?? null,
    createdAt: r.createdAt.toISOString(),
    updator: null,
    remark: r.remark ?? null,
  }
}

/** 注册 course-audit 路由（可复用于用户端和 admin 端） */
function registerCourseAuditRoutes(server: FastifyInstance) {
  // GET /course-audit — 根路径列表（别名 /list，兼容前端 RESTful 模式）
  server.get('/course-audit', async (request, reply) => {
    const parsed = courseAuditListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, status, search, creator } = parsed.data
    const conds = []
    if (status !== undefined) conds.push(eq(zhsCourseAudit.auditStatus, status))
    if (search) conds.push(sql`${zhsCourseAudit.remark} ILIKE ${`%${search}%`}`)
    if (creator) conds.push(sql`${zhsCourseAudit.auditor} ILIKE ${`%${creator}%`}`)
    const where = conds.length ? and(...conds) : undefined
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(zhsCourseAudit)
        .where(where)
        .orderBy(desc(zhsCourseAudit.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(zhsCourseAudit)
        .where(where),
    ])
    const mapped = list.map(mapAuditRow)
    return reply.send(success({ list: mapped, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  // GET /course-audit/list — 课程审核列表
  server.get('/course-audit/list', async (request, reply) => {
    const parsed = courseAuditListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, status, search, creator } = parsed.data
    const conds = []
    if (status !== undefined) conds.push(eq(zhsCourseAudit.auditStatus, status))
    if (search) conds.push(sql`${zhsCourseAudit.remark} ILIKE ${`%${search}%`}`)
    if (creator) conds.push(sql`${zhsCourseAudit.auditor} ILIKE ${`%${creator}%`}`)
    const where = conds.length ? and(...conds) : undefined
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(zhsCourseAudit)
        .where(where)
        .orderBy(desc(zhsCourseAudit.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(zhsCourseAudit)
        .where(where),
    ])
    const mapped = list.map(mapAuditRow)
    return reply.send(success({ list: mapped, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  // GET /course-audit/:id — 审核详情
  server.get('/course-audit/:id', async (request, reply) => {
    const parsed = courseAuditIdSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await dbRead
      .select()
      .from(zhsCourseAudit)
      .where(eq(zhsCourseAudit.id, parsed.data.id))
      .limit(1)
    if (!rows[0]) return reply.status(404).send(error(404, '审核记录不存在'))
    return reply.send(success(mapAuditRow(rows[0])))
  })

  // POST /course-audit — 创建审核记录
  server.post('/course-audit', async (request, reply) => {
    const parsed = createCourseAuditBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [record] = await db
      .insert(zhsCourseAudit)
      .values({
        courseId: parsed.data.courseId,
        auditStatus: parsed.data.status ?? 0,
        remark: parsed.data.reason,
        createTime: new Date(),
      })
      .returning()
    if (!record) return reply.status(500).send(error(500, 'Failed to create audit record'))
    return reply.status(201).send(success(mapAuditRow(record)))
  })

  // PUT /course-audit/:id — 更新审核记录（前端发送 {status: number, remark: string}）
  server.put('/course-audit/:id', async (request, reply) => {
    const idParsed = courseAuditIdSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateCourseAuditBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const sets: Partial<typeof zhsCourseAudit.$inferInsert> = { updatedAt: new Date() }
    if (parsed.data.status !== undefined) {
      sets.auditStatus = parsed.data.status
      sets.auditTime = new Date()
    }
    if (parsed.data.remark !== undefined) sets.remark = parsed.data.remark
    else if (parsed.data.reason !== undefined) sets.remark = parsed.data.reason
    const [updated] = await db
      .update(zhsCourseAudit)
      .set(sets)
      .where(eq(zhsCourseAudit.id, idParsed.data.id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '审核记录不存在'))
    return reply.send(success(mapAuditRow(updated)))
  })

  // DELETE /course-audit/:id — 删除审核记录
  server.delete('/course-audit/:id', async (request, reply) => {
    const parsed = courseAuditIdSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    await db.delete(zhsCourseAudit).where(eq(zhsCourseAudit.id, parsed.data.id))
    return reply.send(success({ id: String(parsed.data.id) }))
  })
}

const eduExtendedRoutes: FastifyPluginAsync = async (server) => {
  registerCourseAuditRoutes(server)
}

export default eduExtendedRoutes

/** 管理员 course-audit 路由（前缀 /api/admin） */
export const adminCourseAuditRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  registerCourseAuditRoutes(server)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
