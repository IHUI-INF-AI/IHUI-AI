import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../utils/response.js'
import { requireAuth } from '../plugins/require-permission.js'
import {
  getEnterpriseProfile,
  upsertEnterpriseProfile,
  createInvoiceRequest,
  listInvoices,
  listInvoiceEligibleOrders,
  listContracts,
  signContract,
  registerCorporatePayment,
  listCorporatePayments,
} from '../services/relay-enterprise-service.js'

/**
 * /api/developer/enterprise 企业合规用户端(2026-09-17 立,补强 61)。
 *
 * 端点(requireAuth,仅操作本人数据):
 * 1. GET /developer/enterprise/profile                 — 我的认证档案
 * 2. PUT /developer/enterprise/profile                 — 提交/更新认证(重复提交回到 pending)
 * 3. GET /developer/enterprise/invoice-eligible-orders — 可开票的已支付订单(下拉)
 * 4. GET /developer/enterprise/pending-orders          — 待支付订单(对公结算下拉)
 * 5. GET /developer/enterprise/invoices                — 我的发票申请
 * 6. POST /developer/enterprise/invoices               — 对已支付订单提交开票申请
 * 7. GET /developer/enterprise/contracts               — 我的合同
 * 8. POST /developer/enterprise/contracts/:id/sign     — 确认签署合同
 * 9. GET /developer/enterprise/corporate-payments      — 我的对公打款凭证
 * 10. POST /developer/enterprise/corporate-payments    — 登记对公打款凭证(待 admin 确认)
 */

const profileBodySchema = z.object({
  companyName: z.string().min(1).max(200),
  creditCode: z
    .string()
    .regex(/^[0-9A-HJ-NPQRTUWXY]{18}$/, '统一社会信用代码须为 18 位')
    .or(z.string().min(8).max(64)),
  legalPerson: z.string().max(100).optional(),
  contactName: z.string().min(1).max(100),
  contactPhone: z.string().min(5).max(32),
  licenseUrl: z.string().max(500).optional(),
})

const invoiceBodySchema = z.object({
  orderId: z.string().uuid('无效的订单 ID'),
  invoiceType: z.enum(['plain', 'vat_special']).default('plain'),
  title: z.string().min(1).max(200),
  taxId: z.string().min(1).max(64),
  email: z.string().email('邮箱格式不正确'),
})

const corporatePaymentBodySchema = z.object({
  orderNo: z.string().min(1).max(64),
  amountCents: z.number().int().min(0).optional(),
  payerCompany: z.string().min(1).max(200),
  voucherUrl: z.string().max(500).optional(),
  remark: z.string().max(500).optional(),
})

const pageQuerySchema = z.object({
  status: z.string().max(16).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const relayEnterpriseRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAuth)

  // 1. 我的认证档案
  server.get('/developer/enterprise/profile', async (request, reply) => {
    const profile = await getEnterpriseProfile(request.userId!)
    return reply.send(success({ profile: profile ?? null }))
  })

  // 2. 提交/更新认证
  server.put('/developer/enterprise/profile', async (request, reply) => {
    const b = profileBodySchema.safeParse(request.body ?? {})
    if (!b.success) {
      return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数不合法'))
    }
    try {
      const profile = await upsertEnterpriseProfile(request.userId!, b.data)
      return reply.send(success({ profile }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '提交企业认证失败'))
    }
  })

  // 3. 可开票的已支付订单
  server.get('/developer/enterprise/invoice-eligible-orders', async (request, reply) => {
    const list = await listInvoiceEligibleOrders(request.userId!)
    return reply.send(success({ list }))
  })

  // 4. 我的发票申请
  server.get('/developer/enterprise/invoices', async (request, reply) => {
    const q = pageQuerySchema.safeParse(request.query ?? {})
    if (!q.success) return reply.status(400).send(error(400, '参数不合法'))
    const { list, total } = await listInvoices({ ...q.data, userId: request.userId })
    return reply.send(success({ list, total, page: q.data.page, pageSize: q.data.pageSize }))
  })

  // 5. 提交开票申请
  server.post('/developer/enterprise/invoices', async (request, reply) => {
    const b = invoiceBodySchema.safeParse(request.body ?? {})
    if (!b.success) {
      return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数不合法'))
    }
    try {
      const r = await createInvoiceRequest(request.userId!, b.data)
      if (!r.success) return reply.status(400).send(error(400, r.reason))
      return reply.send(success({ invoice: r.data }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '提交开票申请失败'))
    }
  })

  // 6. 我的合同
  server.get('/developer/enterprise/contracts', async (request, reply) => {
    const q = pageQuerySchema.safeParse(request.query ?? {})
    if (!q.success) return reply.status(400).send(error(400, '参数不合法'))
    const { list, total } = await listContracts({ ...q.data, userId: request.userId })
    return reply.send(success({ list, total, page: q.data.page, pageSize: q.data.pageSize }))
  })

  // 7. 确认签署合同
  server.post('/developer/enterprise/contracts/:id/sign', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数不合法'))
    try {
      const r = await signContract(request.userId!, p.data.id)
      if (!r.success) return reply.status(400).send(error(400, r.reason))
      return reply.send(success({ contract: r.data }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '签署合同失败'))
    }
  })

  // 8. 我的对公打款凭证
  server.get('/developer/enterprise/corporate-payments', async (request, reply) => {
    const q = pageQuerySchema.safeParse(request.query ?? {})
    if (!q.success) return reply.status(400).send(error(400, '参数不合法'))
    const { list, total } = await listCorporatePayments({ ...q.data, userId: request.userId })
    return reply.send(success({ list, total, page: q.data.page, pageSize: q.data.pageSize }))
  })

  // 9. 登记对公打款凭证
  server.post('/developer/enterprise/corporate-payments', async (request, reply) => {
    const b = corporatePaymentBodySchema.safeParse(request.body ?? {})
    if (!b.success) {
      return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数不合法'))
    }
    try {
      const r = await registerCorporatePayment(request.userId!, b.data)
      if (!r.success) return reply.status(400).send(error(400, r.reason))
      return reply.send(success({ voucher: r.data }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '登记打款凭证失败'))
    }
  })
}

export default relayEnterpriseRoutes
