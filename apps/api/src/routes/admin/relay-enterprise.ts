// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import {
  listEnterpriseProfiles,
  reviewEnterpriseProfile,
  listInvoices,
  issueInvoice,
  rejectInvoice,
  createContract,
  terminateContract,
  listContracts,
  listCorporatePayments,
  confirmCorporatePayment,
  rejectCorporatePayment,
} from '../../services/relay-enterprise-service.js'

/**
 * /api/admin/relay/enterprise 企业合规闭环(2026-09-17 立,补强 61)。
 *
 * 端点(requireAdmin):
 * 1. GET  /relay/enterprise/profiles?status=&page=&pageSize=     — 认证档案列表
 * 2. POST /relay/enterprise/profiles/:id/review                  — 审核认证(approve/reject)
 * 3. GET  /relay/enterprise/invoices?status=&page=&pageSize=     — 发票申请列表
 * 4. POST /relay/enterprise/invoices/:id/issue                   — 开具(发票号/链接)
 * 5. POST /relay/enterprise/invoices/:id/reject                  — 驳回
 * 6. GET  /relay/enterprise/contracts?status=&page=&pageSize=    — 合同列表
 * 7. POST /relay/enterprise/contracts                            — 建档(须已通过企业认证)
 * 8. POST /relay/enterprise/contracts/:id/terminate              — 终止合同
 * 9. GET  /relay/enterprise/corporate-payments?status=&page=     — 对公凭证列表
 * 10. POST /relay/enterprise/corporate-payments/:id/confirm      — 确认到账(走既有支付闭环)
 * 11. POST /relay/enterprise/corporate-payments/:id/reject       — 驳回凭证
 */

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const pageQuerySchema = z.object({
  status: z
    .enum([
      'pending',
      'approved',
      'rejected',
      'issued',
      'voided',
      'confirmed',
      'active',
      'pending_sign',
      'terminated',
      'expired',
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const reviewBodySchema = z.object({
  approve: z.boolean(),
  rejectReason: z.string().max(500).optional(),
})

const issueBodySchema = z.object({
  invoiceNo: z.string().min(1).max(64),
  invoiceUrl: z.string().max(500).optional(),
})

const rejectBodySchema = z.object({ reason: z.string().min(1).max(500) })

const createContractBodySchema = z.object({
  userId: z.string().uuid('无效的用户 ID'),
  title: z.string().min(1).max(200),
  contractType: z.enum(['api_subscription', 'custom']).default('api_subscription'),
  amountCents: z.number().int().min(0),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
  fileUrl: z.string().max(500).optional(),
  remark: z.string().max(500).optional(),
})

async function handle<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  fn: () => Promise<{ success: true; data: T } | { success: false; reason: string }>,
) {
  try {
    const r = await fn()
    if (!r.success) return reply.status(400).send(error(400, r.reason))
    return reply.send(success({ data: r.data }))
  } catch (e) {
    request.log.error(e)
    return reply.status(500).send(error(500, '企业合规操作失败'))
  }
}

const adminRelayEnterpriseRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // 1. 认证档案列表
  server.get('/relay/enterprise/profiles', async (request, reply) => {
    const q = pageQuerySchema.safeParse(request.query ?? {})
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数不合法'))
    const { list, total } = await listEnterpriseProfiles(q.data)
    return reply.send(success({ list, total, page: q.data.page, pageSize: q.data.pageSize }))
  })

  // 2. 审核认证
  server.post('/relay/enterprise/profiles/:id/review', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    const b = reviewBodySchema.safeParse(request.body ?? {})
    if (!p.success || !b.success) return reply.status(400).send(error(400, '参数不合法'))
    await handle(request, reply, () =>
      reviewEnterpriseProfile(p.data.id, request.userId!, b.data.approve, b.data.rejectReason),
    )
  })

  // 3. 发票申请列表
  server.get('/relay/enterprise/invoices', async (request, reply) => {
    const q = pageQuerySchema.safeParse(request.query ?? {})
    if (!q.success) return reply.status(400).send(error(400, '参数不合法'))
    const { list, total } = await listInvoices(q.data)
    return reply.send(success({ list, total, page: q.data.page, pageSize: q.data.pageSize }))
  })

  // 4. 开具发票
  server.post('/relay/enterprise/invoices/:id/issue', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    const b = issueBodySchema.safeParse(request.body ?? {})
    if (!p.success || !b.success) return reply.status(400).send(error(400, '参数不合法'))
    await handle(request, reply, () => issueInvoice(p.data.id, request.userId!, b.data))
  })

  // 5. 驳回开票
  server.post('/relay/enterprise/invoices/:id/reject', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    const b = rejectBodySchema.safeParse(request.body ?? {})
    if (!p.success || !b.success) return reply.status(400).send(error(400, '参数不合法'))
    await handle(request, reply, () => rejectInvoice(p.data.id, b.data.reason))
  })

  // 6. 合同列表
  server.get('/relay/enterprise/contracts', async (request, reply) => {
    const q = pageQuerySchema.safeParse(request.query ?? {})
    if (!q.success) return reply.status(400).send(error(400, '参数不合法'))
    const { list, total } = await listContracts(q.data)
    return reply.send(success({ list, total, page: q.data.page, pageSize: q.data.pageSize }))
  })

  // 7. 合同建档
  server.post('/relay/enterprise/contracts', async (request, reply) => {
    const b = createContractBodySchema.safeParse(request.body ?? {})
    if (!b.success) {
      return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数不合法'))
    }
    await handle(request, reply, () => createContract(request.userId!, b.data))
  })

  // 8. 终止合同
  server.post('/relay/enterprise/contracts/:id/terminate', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数不合法'))
    await handle(request, reply, () => terminateContract(p.data.id))
  })

  // 9. 对公凭证列表
  server.get('/relay/enterprise/corporate-payments', async (request, reply) => {
    const q = pageQuerySchema.safeParse(request.query ?? {})
    if (!q.success) return reply.status(400).send(error(400, '参数不合法'))
    const { list, total } = await listCorporatePayments(q.data)
    return reply.send(success({ list, total, page: q.data.page, pageSize: q.data.pageSize }))
  })

  // 10. 确认到账(走既有支付闭环:completeOrder + activateOrderSubscription)
  server.post('/relay/enterprise/corporate-payments/:id/confirm', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数不合法'))
    await handle(request, reply, () => confirmCorporatePayment(p.data.id, request.userId!))
  })

  // 11. 驳回凭证
  server.post('/relay/enterprise/corporate-payments/:id/reject', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    const b = rejectBodySchema.safeParse(request.body ?? {})
    if (!p.success || !b.success) return reply.status(400).send(error(400, '参数不合法'))
    await handle(request, reply, () => rejectCorporatePayment(p.data.id, b.data.reason))
  })
}

export default adminRelayEnterpriseRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
