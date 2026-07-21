import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import PDFKit from 'pdfkit'
import { checkAuth } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import {
  findTemplates,
  findTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  findCertificates,
  findCertificateById,
  findCertificateByNo,
  createCertificate,
  updateCertificateStatus,
  deleteCertificate,
  generateCertificateNo,
} from '../db/certificate-queries.js'
import { success, error } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const templatesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
})

const certificatesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
})

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  backgroundImage: z.string().max(512).nullable().optional(),
  templateConfig: z.unknown().optional(),
  awardingOrganization: z.string().nullable().optional(),
  awarderName: z.string().nullable().optional(),
  awardConditions: z.string().nullable().optional(),
  validityPolicy: z.string().nullable().optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  backgroundImage: z.string().max(512).nullable().optional(),
  templateConfig: z.unknown().optional(),
  awardingOrganization: z.string().nullable().optional(),
  awarderName: z.string().nullable().optional(),
  awardConditions: z.string().nullable().optional(),
  validityPolicy: z.string().nullable().optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const createCertificateSchema = z.object({
  templateId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid('无效的用户 ID'),
  title: z.string().min(1).max(200),
  recipientName: z.string().max(100).nullable().optional(),
  source: z.string().max(20).optional(),
  sourceId: z.string().uuid().nullable().optional(),
})

const updateCertificateStatusSchema = z.object({
  status: z.number().int().min(0).max(1),
})

const verifyQuerySchema = z.object({
  no: z.string().min(1).max(100),
})

// =============================================================================
// 公共路由（前缀 /api，需登录）
// =============================================================================

export const certificateRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // GET /certificates/verify - 证书验证(按证书编号查询)
  server.get('/certificates/verify', async (request, reply) => {
    const parsed = verifyQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const cert = await findCertificateByNo(parsed.data.no)
    if (!cert || cert.status !== 1) {
      return reply.status(404).send(error(404, '证书不存在或已失效'))
    }
    return reply.send(success({ certificate: cert }))
  })

  // GET /certificates/my - 我的证书列表
  server.get('/certificates/my', async (request, reply) => {
    const userId = request.userId!
    const result = await findCertificates({ page: 1, pageSize: 100, userId })
    return reply.send(success(result))
  })

  // POST /certificates/:id/download - 下载证书 PDF
  server.post('/certificates/:id/download', async (request, reply) => {
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
    doc.moveDown()
    doc.text(`Recipient: ${cert.recipientName ?? '-'}`, { align: 'center' })
    doc.moveDown()
    doc.text(
      `Issued At: ${cert.issuedAt ? new Date(cert.issuedAt).toISOString().split('T')[0] : '-'}`,
      { align: 'center' },
    )
    doc.moveDown(2)
    doc
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
}

// =============================================================================
// 管理员路由（前缀 /api/admin）
// =============================================================================

export const adminCertificateRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ----- Templates Admin -----

  server.get('/certificates/templates', async (request, reply) => {
    const parsed = templatesQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findTemplates(parsed.data)
    return reply.send(success(result))
  })

  server.get('/certificates/templates/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const template = await findTemplateById(parsed.data.id)
    if (!template) return reply.status(404).send(error(404, '模板不存在'))
    return reply.send(success({ template }))
  })

  server.post('/certificates/templates', async (request, reply) => {
    const parsed = createTemplateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const template = await createTemplate(parsed.data)
    return reply.status(201).send(success({ template }))
  })

  server.put('/certificates/templates/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateTemplateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findTemplateById(idParsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '模板不存在'))
    const template = await updateTemplate(idParsed.data.id, parsed.data)
    return reply.send(success({ template }))
  })

  server.delete('/certificates/templates/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findTemplateById(parsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '模板不存在'))
    await deleteTemplate(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // ----- Certificates Admin -----

  server.get('/certificates', async (request, reply) => {
    const parsed = certificatesQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findCertificates(parsed.data)
    return reply.send(success(result))
  })

  server.get('/certificates/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const cert = await findCertificateById(parsed.data.id)
    if (!cert) return reply.status(404).send(error(404, '证书不存在'))
    return reply.send(success({ certificate: cert }))
  })

  server.post('/certificates', async (request, reply) => {
    const parsed = createCertificateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const cert = await createCertificate({
      ...parsed.data,
      certificateNo: generateCertificateNo(),
    })
    return reply.status(201).send(success({ certificate: cert }))
  })

  server.put('/certificates/:id/status', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateCertificateStatusSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findCertificateById(idParsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '证书不存在'))
    const cert = await updateCertificateStatus(idParsed.data.id, parsed.data.status)
    return reply.send(success({ certificate: cert }))
  })

  server.delete('/certificates/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findCertificateById(parsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '证书不存在'))
    await deleteCertificate(parsed.data.id)
    return reply.send(success({ ok: true }))
  })
}
