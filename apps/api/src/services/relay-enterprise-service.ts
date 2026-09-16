import { and, desc, eq, ne, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  relayEnterpriseProfiles,
  relayInvoiceRequests,
  relayContracts,
  relayCorporatePayments,
  orders,
  type RelayEnterpriseProfile,
  type RelayInvoiceRequest,
  type RelayContract,
  type RelayCorporatePayment,
} from '@ihui/database'
import { findOrderByNo } from '../db/payment-queries.js'
import { completeOrder, activateOrderSubscription } from './order-service.js'

/**
 * 企业合规闭环服务(2026-09-17 立,补强 61,差异化:竞品为个人订阅分发,此块完全缺)。
 *
 * 四条业务线,全部打通既有订单/订阅体系:
 * 1. 企业认证:upsert(同用户唯一,重复提交覆盖并回到 pending)→ admin 审核;
 * 2. 发票:用户对本人已支付订单开票 → admin 开具/作废;
 * 3. 合同:admin 建档(合同号 HT-YYYYMMDD-XXXX)→ 用户签署 → active / admin 终止;
 * 4. 对公结算:用户登记打款凭证 → admin 确认(确认即复用 completeOrder +
 *    activateOrderSubscription 既有支付闭环,幂等:订单非 pending 直接拒绝)。
 *
 * 校验在 service 层做,路由层只负责转发与 HTTP 语义;业务规则失败返回
 * { success: false, reason }(同 api-subscription-service 先例),不抛异常。
 */

type Result<T> = { success: true; data: T } | { success: false; reason: string }

// ---------------------------------------------------------------------------
// 1. 企业认证
// ---------------------------------------------------------------------------

export interface EnterpriseProfileInput {
  companyName: string
  creditCode: string
  legalPerson?: string
  contactName: string
  contactPhone: string
  licenseUrl?: string
}

export async function getEnterpriseProfile(
  userId: string,
): Promise<RelayEnterpriseProfile | undefined> {
  const rows = await db
    .select()
    .from(relayEnterpriseProfiles)
    .where(eq(relayEnterpriseProfiles.userId, userId))
    .limit(1)
  return rows[0]
}

/** 提交/更新企业认证:同用户唯一,重复提交覆盖并回到 pending 重新审核。 */
export async function upsertEnterpriseProfile(
  userId: string,
  input: EnterpriseProfileInput,
): Promise<RelayEnterpriseProfile> {
  const existing = await getEnterpriseProfile(userId)
  if (existing) {
    const rows = await db
      .update(relayEnterpriseProfiles)
      .set({
        companyName: input.companyName,
        creditCode: input.creditCode,
        legalPerson: input.legalPerson ?? null,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        licenseUrl: input.licenseUrl ?? null,
        status: 'pending',
        rejectReason: null,
        reviewedBy: null,
        reviewedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(relayEnterpriseProfiles.id, existing.id))
      .returning()
    return rows[0]!
  }
  const rows = await db
    .insert(relayEnterpriseProfiles)
    .values({ userId, ...input, legalPerson: input.legalPerson ?? null })
    .returning()
  return rows[0]!
}

export async function reviewEnterpriseProfile(
  id: string,
  reviewerId: string,
  approve: boolean,
  rejectReason?: string,
): Promise<Result<RelayEnterpriseProfile>> {
  const rows = await db
    .select()
    .from(relayEnterpriseProfiles)
    .where(eq(relayEnterpriseProfiles.id, id))
    .limit(1)
  const profile = rows[0]
  if (!profile) return { success: false, reason: '认证档案不存在' }
  if (profile.status !== 'pending') {
    return { success: false, reason: `认证档案状态(${profile.status})不可审核` }
  }
  if (!approve && !rejectReason) return { success: false, reason: '驳回必须填写原因' }
  const updated = await db
    .update(relayEnterpriseProfiles)
    .set({
      status: approve ? 'approved' : 'rejected',
      rejectReason: approve ? null : (rejectReason ?? null),
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(relayEnterpriseProfiles.id, id))
    .returning()
  return { success: true, data: updated[0]! }
}

export async function listEnterpriseProfiles(filters: {
  status?: string
  page: number
  pageSize: number
}): Promise<{ list: RelayEnterpriseProfile[]; total: number }> {
  const where = filters.status ? eq(relayEnterpriseProfiles.status, filters.status) : undefined
  const list = await db
    .select()
    .from(relayEnterpriseProfiles)
    .where(where)
    .orderBy(desc(relayEnterpriseProfiles.createdAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize)
  const total =
    (
      await db
        .select({ c: sql<number>`count(*)::int` })
        .from(relayEnterpriseProfiles)
        .where(where)
    )[0]?.c ?? 0
  return { list, total }
}

// ---------------------------------------------------------------------------
// 2. 发票(绑已支付订单)
// ---------------------------------------------------------------------------

export interface InvoiceRequestInput {
  orderId: string
  invoiceType: 'plain' | 'vat_special'
  title: string
  taxId: string
  email: string
}

export async function createInvoiceRequest(
  userId: string,
  input: InvoiceRequestInput,
): Promise<Result<RelayInvoiceRequest>> {
  const order = await findOrderById(input.orderId)
  if (!order) return { success: false, reason: '订单不存在' }
  if (order.userId !== userId) return { success: false, reason: '只能对本人订单开票' }
  if (order.status !== 'paid') return { success: false, reason: '仅已支付订单可开票' }
  // 同一订单同时仅一条非被拒发票(部分唯一索引兜底,这里前置检查给友好提示)
  const dup = await db
    .select({ id: relayInvoiceRequests.id })
    .from(relayInvoiceRequests)
    .where(
      and(
        eq(relayInvoiceRequests.orderId, input.orderId),
        ne(relayInvoiceRequests.status, 'rejected'),
      ),
    )
    .limit(1)
  if (dup.length > 0) return { success: false, reason: '该订单已有开票申请,请勿重复提交' }
  const rows = await db
    .insert(relayInvoiceRequests)
    .values({
      userId,
      orderId: input.orderId,
      orderNo: order.orderNo,
      invoiceType: input.invoiceType,
      title: input.title,
      taxId: input.taxId,
      email: input.email,
      amountCents: order.amount,
    })
    .returning()
  return { success: true, data: rows[0]! }
}

/** 按 id 查订单(findOrderByNo 按 orderNo 查,这里按主键)。 */
async function findOrderById(orderId: string) {
  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  return rows[0]
}

export async function issueInvoice(
  id: string,
  issuerId: string,
  input: { invoiceNo: string; invoiceUrl?: string },
): Promise<Result<RelayInvoiceRequest>> {
  const rows = await db
    .select()
    .from(relayInvoiceRequests)
    .where(eq(relayInvoiceRequests.id, id))
    .limit(1)
  const invoice = rows[0]
  if (!invoice) return { success: false, reason: '开票申请不存在' }
  if (invoice.status !== 'pending') {
    return { success: false, reason: `开票申请状态(${invoice.status})不可开具` }
  }
  const updated = await db
    .update(relayInvoiceRequests)
    .set({
      status: 'issued',
      invoiceNo: input.invoiceNo,
      invoiceUrl: input.invoiceUrl ?? null,
      issuedBy: issuerId,
      issuedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(relayInvoiceRequests.id, id))
    .returning()
  return { success: true, data: updated[0]! }
}

export async function rejectInvoice(
  id: string,
  reason: string,
): Promise<Result<RelayInvoiceRequest>> {
  const rows = await db
    .select()
    .from(relayInvoiceRequests)
    .where(eq(relayInvoiceRequests.id, id))
    .limit(1)
  const invoice = rows[0]
  if (!invoice) return { success: false, reason: '开票申请不存在' }
  if (invoice.status !== 'pending') {
    return { success: false, reason: `开票申请状态(${invoice.status})不可驳回` }
  }
  const updated = await db
    .update(relayInvoiceRequests)
    .set({ status: 'rejected', rejectReason: reason, updatedAt: new Date() })
    .where(eq(relayInvoiceRequests.id, id))
    .returning()
  return { success: true, data: updated[0]! }
}

export async function listInvoices(filters: {
  userId?: string
  status?: string
  page: number
  pageSize: number
}): Promise<{ list: RelayInvoiceRequest[]; total: number }> {
  const conds = [
    filters.userId ? eq(relayInvoiceRequests.userId, filters.userId) : undefined,
    filters.status ? eq(relayInvoiceRequests.status, filters.status) : undefined,
  ].filter((c) => c !== undefined)
  const where = conds.length ? and(...conds) : undefined
  const list = await db
    .select()
    .from(relayInvoiceRequests)
    .where(where)
    .orderBy(desc(relayInvoiceRequests.createdAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize)
  const total =
    (
      await db
        .select({ c: sql<number>`count(*)::int` })
        .from(relayInvoiceRequests)
        .where(where)
    )[0]?.c ?? 0
  return { list, total }
}

/** 用户可开票的已支付订单(最近 50 条,供前端下拉选择)。 */
export async function listInvoiceEligibleOrders(userId: string) {
  return db
    .select({
      id: orders.id,
      orderNo: orders.orderNo,
      amount: orders.amount,
      paidAt: orders.paidAt,
      orderType: orders.orderType,
      targetTitle: orders.targetTitle,
    })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.status, 'paid')))
    .orderBy(desc(orders.paidAt))
    .limit(50)
}

/** 用户待支付的订单(最近 20 条,供对公结算选择)。 */
export async function listPendingOrders(userId: string) {
  return db
    .select({
      id: orders.id,
      orderNo: orders.orderNo,
      amount: orders.amount,
      orderType: orders.orderType,
      targetTitle: orders.targetTitle,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.status, 'pending')))
    .orderBy(desc(orders.createdAt))
    .limit(20)
}

// ---------------------------------------------------------------------------
// 3. 企业合同
// ---------------------------------------------------------------------------

export interface ContractInput {
  userId: string
  title: string
  contractType: 'api_subscription' | 'custom'
  amountCents: number
  periodStart?: Date
  periodEnd?: Date
  fileUrl?: string
  remark?: string
}

function genContractNo(): string {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `HT-${ymd}-${rand}`
}

export async function createContract(
  createdBy: string,
  input: ContractInput,
): Promise<Result<RelayContract>> {
  const profile = await getEnterpriseProfile(input.userId)
  if (!profile || profile.status !== 'approved') {
    return { success: false, reason: '该用户暂无已通过的企业认证,不能签署企业合同' }
  }
  const rows = await db
    .insert(relayContracts)
    .values({
      userId: input.userId,
      contractNo: genContractNo(),
      title: input.title,
      contractType: input.contractType,
      amountCents: input.amountCents,
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null,
      fileUrl: input.fileUrl ?? null,
      remark: input.remark ?? null,
      createdBy,
    })
    .returning()
  return { success: true, data: rows[0]! }
}

/** 用户确认签署:pending_sign → active。 */
export async function signContract(userId: string, id: string): Promise<Result<RelayContract>> {
  const rows = await db.select().from(relayContracts).where(eq(relayContracts.id, id)).limit(1)
  const contract = rows[0]
  if (!contract) return { success: false, reason: '合同不存在' }
  if (contract.userId !== userId) return { success: false, reason: '无权操作他人合同' }
  if (contract.status !== 'pending_sign') {
    return { success: false, reason: `合同状态(${contract.status})不可签署` }
  }
  const updated = await db
    .update(relayContracts)
    .set({ status: 'active', signedAt: new Date(), updatedAt: new Date() })
    .where(eq(relayContracts.id, id))
    .returning()
  return { success: true, data: updated[0]! }
}

export async function terminateContract(id: string): Promise<Result<RelayContract>> {
  const rows = await db.select().from(relayContracts).where(eq(relayContracts.id, id)).limit(1)
  const contract = rows[0]
  if (!contract) return { success: false, reason: '合同不存在' }
  if (contract.status !== 'active' && contract.status !== 'pending_sign') {
    return { success: false, reason: `合同状态(${contract.status})不可终止` }
  }
  const updated = await db
    .update(relayContracts)
    .set({ status: 'terminated', updatedAt: new Date() })
    .where(eq(relayContracts.id, id))
    .returning()
  return { success: true, data: updated[0]! }
}

export async function listContracts(filters: {
  userId?: string
  status?: string
  page: number
  pageSize: number
}): Promise<{ list: RelayContract[]; total: number }> {
  const conds = [
    filters.userId ? eq(relayContracts.userId, filters.userId) : undefined,
    filters.status ? eq(relayContracts.status, filters.status) : undefined,
  ].filter((c) => c !== undefined)
  const where = conds.length ? and(...conds) : undefined
  const list = await db
    .select()
    .from(relayContracts)
    .where(where)
    .orderBy(desc(relayContracts.createdAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize)
  const total =
    (
      await db
        .select({ c: sql<number>`count(*)::int` })
        .from(relayContracts)
        .where(where)
    )[0]?.c ?? 0
  return { list, total }
}

// ---------------------------------------------------------------------------
// 4. 对公打款凭证(确认即走既有支付闭环)
// ---------------------------------------------------------------------------

export interface CorporatePaymentInput {
  orderNo: string
  amountCents?: number
  payerCompany: string
  voucherUrl?: string
  remark?: string
}

export async function registerCorporatePayment(
  userId: string,
  input: CorporatePaymentInput,
): Promise<Result<RelayCorporatePayment>> {
  const order = await findOrderByNo(input.orderNo)
  if (!order) return { success: false, reason: '订单不存在' }
  if (order.userId !== userId) return { success: false, reason: '只能登记本人订单的打款凭证' }
  if (order.status !== 'pending') {
    return { success: false, reason: `订单状态(${order.status})无需对公结算确认` }
  }
  const dup = await db
    .select({ id: relayCorporatePayments.id })
    .from(relayCorporatePayments)
    .where(
      and(
        eq(relayCorporatePayments.orderNo, input.orderNo),
        eq(relayCorporatePayments.status, 'pending'),
      ),
    )
    .limit(1)
  if (dup.length > 0) return { success: false, reason: '该订单已有待审核的打款凭证' }
  const rows = await db
    .insert(relayCorporatePayments)
    .values({
      userId,
      orderId: order.id,
      orderNo: order.orderNo,
      amountCents: input.amountCents ?? order.amount,
      payerCompany: input.payerCompany,
      voucherUrl: input.voucherUrl ?? null,
      remark: input.remark ?? null,
    })
    .returning()
  return { success: true, data: rows[0]! }
}

/**
 * admin 确认打款凭证:凭证 pending → confirmed,并复用既有支付闭环:
 * completeOrder(标记 paid + token 充值幂等)→ activateOrderSubscription
 * (orderType=2 VIP / 5 开发者套餐 / 6 API 订阅 自动激活,失败不回滚凭证,
 * 订单已 paid,可由副作用重放机制补激活)。
 */
export async function confirmCorporatePayment(
  id: string,
  reviewerId: string,
): Promise<Result<RelayCorporatePayment & { orderPaid: boolean; orderPaidReason?: string }>> {
  const rows = await db
    .select()
    .from(relayCorporatePayments)
    .where(eq(relayCorporatePayments.id, id))
    .limit(1)
  const voucher = rows[0]
  if (!voucher) return { success: false, reason: '打款凭证不存在' }
  if (voucher.status !== 'pending') {
    return { success: false, reason: `打款凭证状态(${voucher.status})不可确认` }
  }
  const order = await findOrderByNo(voucher.orderNo)
  if (!order) return { success: false, reason: '关联订单不存在' }
  if (order.status !== 'pending') {
    return { success: false, reason: `订单状态(${order.status})不可完成对公结算` }
  }
  const paid = await completeOrder(voucher.orderNo, `corporate:${voucher.id}`)
  if (!paid.success || !paid.order) {
    return { success: false, reason: paid.reason ?? '订单完成失败' }
  }
  // 订阅激活失败不阻塞凭证确认(订单已 paid,副作用可重放)
  let activationError: string | undefined
  try {
    await activateOrderSubscription(paid.order)
  } catch (e) {
    activationError = e instanceof Error ? e.message : String(e)
  }
  const updated = await db
    .update(relayCorporatePayments)
    .set({
      status: 'confirmed',
      confirmedBy: reviewerId,
      confirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(relayCorporatePayments.id, id))
    .returning()
  return {
    success: true,
    data: {
      ...updated[0]!,
      orderPaid: true,
      orderPaidReason: activationError
        ? `订单已支付,订阅激活待重放: ${activationError}`
        : undefined,
    },
  }
}

export async function rejectCorporatePayment(
  id: string,
  reason: string,
): Promise<Result<RelayCorporatePayment>> {
  const rows = await db
    .select()
    .from(relayCorporatePayments)
    .where(eq(relayCorporatePayments.id, id))
    .limit(1)
  const voucher = rows[0]
  if (!voucher) return { success: false, reason: '打款凭证不存在' }
  if (voucher.status !== 'pending') {
    return { success: false, reason: `打款凭证状态(${voucher.status})不可驳回` }
  }
  const updated = await db
    .update(relayCorporatePayments)
    .set({ status: 'rejected', rejectReason: reason, updatedAt: new Date() })
    .where(eq(relayCorporatePayments.id, id))
    .returning()
  return { success: true, data: updated[0]! }
}

export async function listCorporatePayments(filters: {
  userId?: string
  status?: string
  page: number
  pageSize: number
}): Promise<{ list: RelayCorporatePayment[]; total: number }> {
  const conds = [
    filters.userId ? eq(relayCorporatePayments.userId, filters.userId) : undefined,
    filters.status ? eq(relayCorporatePayments.status, filters.status) : undefined,
  ].filter((c) => c !== undefined)
  const where = conds.length ? and(...conds) : undefined
  const list = await db
    .select()
    .from(relayCorporatePayments)
    .where(where)
    .orderBy(desc(relayCorporatePayments.createdAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize)
  const total =
    (
      await db
        .select({ c: sql<number>`count(*)::int` })
        .from(relayCorporatePayments)
        .where(where)
    )[0]?.c ?? 0
  return { list, total }
}
