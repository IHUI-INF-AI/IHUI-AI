import { randomUUID } from 'node:crypto'
import { eq, and, desc, sql, ilike } from 'drizzle-orm'
import { db } from './index.js'
import {
  eduOrders,
  eduPayments,
  eduRefunds,
  eduInvoiceTitles,
  eduInvoiceApplications,
  type EduOrder,
  type EduPayment,
  type EduRefund,
  type EduInvoiceTitle,
  type EduInvoiceApplication,
} from '@ihui/database'

// =============================================================================
// 辅助：生成订单号 / 支付号
// =============================================================================

/** 生成订单号: EDU + yyyyMMddHHmmss + uuid 前 6 位(大写)。 */
export function genOrderNo(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts =
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  return 'EDU' + ts + randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()
}

/** 生成支付号: PAY + yyyyMMddHHmmss + uuid 前 6 位(大写)。 */
export function genPaymentNo(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts =
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  return 'PAY' + ts + randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()
}

// =============================================================================
// Orders 订单
// =============================================================================

export interface CreateOrderInput {
  userId: string
  orderType: string
  targetId?: string | null
  targetTitle?: string | null
  quantity?: number
  originalPrice?: string
  discountAmount?: string
  payAmount?: string
  payType?: string | null
  remark?: string | null
}

export async function createOrder(data: CreateOrderInput): Promise<EduOrder> {
  const rows = await db
    .insert(eduOrders)
    .values({
      orderNo: genOrderNo(),
      userId: data.userId,
      orderType: data.orderType,
      targetId: data.targetId,
      targetTitle: data.targetTitle,
      quantity: data.quantity,
      originalPrice: data.originalPrice,
      discountAmount: data.discountAmount,
      payAmount: data.payAmount,
      payType: data.payType,
      status: 'pending',
      remark: data.remark,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建订单失败')
  return row
}

export async function findOrderById(id: string): Promise<EduOrder | undefined> {
  const rows = await db.select().from(eduOrders).where(eq(eduOrders.id, id)).limit(1)
  return rows[0]
}

export async function findOrderByOrderNo(orderNo: string): Promise<EduOrder | undefined> {
  const rows = await db.select().from(eduOrders).where(eq(eduOrders.orderNo, orderNo)).limit(1)
  return rows[0]
}

export async function findPaymentByOrderId(orderId: string): Promise<EduPayment | undefined> {
  const rows = await db.select().from(eduPayments).where(eq(eduPayments.orderId, orderId)).limit(1)
  return rows[0]
}

/** 取消订单（仅 pending 可取消）。返回更新后的订单或 undefined。 */
export async function cancelOrder(id: string): Promise<EduOrder | undefined> {
  const rows = await db
    .update(eduOrders)
    .set({ status: 'cancelled', cancelTime: new Date(), updatedAt: new Date() })
    .where(and(eq(eduOrders.id, id), eq(eduOrders.status, 'pending')))
    .returning()
  return rows[0]
}

export interface ListOrdersOpts {
  page: number
  pageSize: number
  status?: string
  orderType?: string
  userId?: string
  orderNo?: string
}

export async function findOrders(
  opts: ListOrdersOpts,
): Promise<{ list: EduOrder[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, status, orderType, userId, orderNo } = opts
  const conds = []
  if (status) conds.push(eq(eduOrders.status, status))
  if (orderType) conds.push(eq(eduOrders.orderType, orderType))
  if (userId) conds.push(eq(eduOrders.userId, userId))
  if (orderNo) conds.push(ilike(eduOrders.orderNo, `%${orderNo}%`))

  const list = await db
    .select()
    .from(eduOrders)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(eduOrders.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eduOrders)
    .where(conds.length ? and(...conds) : undefined)
  const total = countRows[0]?.count ?? 0

  return { list, total, page, pageSize }
}

// =============================================================================
// Payments 支付
// =============================================================================

export interface CreatePaymentInput {
  orderId: string
  userId: string
  payType: string
  payAmount?: string
  payUrl?: string | null
}

/** 创建支付：基于订单填充 orderType/payAmount，仅 pending 订单允许支付。事务+行锁防并发重复支付。 */
export async function createPayment(
  data: CreatePaymentInput,
): Promise<{ payment?: EduPayment; reason?: 'order_not_found' | 'order_not_pending' }> {
  return db.transaction(async (tx) => {
    const orderRows = await tx
      .select()
      .from(eduOrders)
      .where(eq(eduOrders.id, data.orderId))
      .for('update')
      .limit(1)
    const order = orderRows[0]
    if (!order) return { reason: 'order_not_found' }
    if (order.status !== 'pending') return { reason: 'order_not_pending' }

    const rows = await tx
      .insert(eduPayments)
      .values({
        paymentNo: genPaymentNo(),
        orderId: data.orderId,
        orderType: order.orderType,
        userId: data.userId,
        payType: data.payType,
        payAmount: data.payAmount ?? order.payAmount,
        payUrl: data.payUrl,
        status: 'created',
      })
      .returning()
    const row = rows[0]
    if (!row) throw new Error('创建支付失败')
    return { payment: row }
  })
}

export async function findPaymentById(id: string): Promise<EduPayment | undefined> {
  const rows = await db.select().from(eduPayments).where(eq(eduPayments.id, id)).limit(1)
  return rows[0]
}

/** 取消支付（paid/cancelled 不可取消）。 */
export async function cancelPayment(id: string): Promise<EduPayment | undefined> {
  const rows = await db
    .update(eduPayments)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(and(eq(eduPayments.id, id)))
    .returning()
  // 调用方需先校验状态，这里仅做更新
  return rows[0]
}

export interface ListPaymentsOpts {
  page: number
  pageSize: number
  status?: string
  userId?: string
  orderId?: string
}

export async function findPayments(
  opts: ListPaymentsOpts,
): Promise<{ list: EduPayment[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, status, userId, orderId } = opts
  const conds = []
  if (status) conds.push(eq(eduPayments.status, status))
  if (userId) conds.push(eq(eduPayments.userId, userId))
  if (orderId) conds.push(eq(eduPayments.orderId, orderId))

  const list = await db
    .select()
    .from(eduPayments)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(eduPayments.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eduPayments)
    .where(conds.length ? and(...conds) : undefined)
  const total = countRows[0]?.count ?? 0

  return { list, total, page, pageSize }
}

// =============================================================================
// Refunds 退款
// =============================================================================

export interface ApplyRefundInput {
  orderId: string
  userId: string
  reason?: string | null
  refundAmount?: string
  refundType?: string
}

/** 申请退款：仅 paid 订单可申请。事务+行锁防并发重复申请。 */
export async function applyRefund(
  data: ApplyRefundInput,
): Promise<{ refund?: EduRefund; reason?: 'order_not_found' | 'order_not_paid' }> {
  return db.transaction(async (tx) => {
    const orderRows = await tx
      .select()
      .from(eduOrders)
      .where(eq(eduOrders.id, data.orderId))
      .for('update')
      .limit(1)
    const order = orderRows[0]
    if (!order) return { reason: 'order_not_found' }
    if (order.status !== 'paid') return { reason: 'order_not_paid' }

    const rows = await tx
      .insert(eduRefunds)
      .values({
        orderId: data.orderId,
        orderType: order.orderType,
        orderNo: order.orderNo,
        userId: data.userId,
        reason: data.reason,
        refundAmount: data.refundAmount ?? order.payAmount,
        refundType: data.refundType ?? 'original',
        status: 'pending',
        applyTime: new Date(),
      })
      .returning()
    const row = rows[0]
    if (!row) throw new Error('申请退款失败')
    return { refund: row }
  })
}

export async function findRefundById(id: string): Promise<EduRefund | undefined> {
  const rows = await db.select().from(eduRefunds).where(eq(eduRefunds.id, id)).limit(1)
  return rows[0]
}

/** 管理员审核退款（approved/rejected）。 */
export async function processRefund(
  id: string,
  status: 'approved' | 'rejected',
  processMessage?: string | null,
): Promise<EduRefund | undefined> {
  const rows = await db
    .update(eduRefunds)
    .set({ status, processMessage, processTime: new Date(), updatedAt: new Date() })
    .where(eq(eduRefunds.id, id))
    .returning()
  return rows[0]
}

/** 管理员处理退款（processing/completed/failed）。completed 时同步订单为 refunded。事务保证退款+订单状态原子更新。 */
export async function handleRefund(
  id: string,
  status: 'processing' | 'completed' | 'failed',
  handleMessage?: string | null,
): Promise<EduRefund | undefined> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(eduRefunds)
      .set({
        status,
        handleMessage,
        ...(status === 'completed' ? { completeTime: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(eduRefunds.id, id))
      .returning()
    const refund = rows[0]
    // 完成退款时同步订单状态(同一事务内)
    if (refund && status === 'completed') {
      await tx
        .update(eduOrders)
        .set({ status: 'refunded', refundTime: new Date(), updatedAt: new Date() })
        .where(eq(eduOrders.id, refund.orderId))
    }
    return refund
  })
}

export interface ListRefundsOpts {
  page: number
  pageSize: number
  status?: string
  userId?: string
  orderId?: string
}

export async function findRefunds(
  opts: ListRefundsOpts,
): Promise<{ list: EduRefund[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, status, userId, orderId } = opts
  const conds = []
  if (status) conds.push(eq(eduRefunds.status, status))
  if (userId) conds.push(eq(eduRefunds.userId, userId))
  if (orderId) conds.push(eq(eduRefunds.orderId, orderId))

  const list = await db
    .select()
    .from(eduRefunds)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(eduRefunds.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eduRefunds)
    .where(conds.length ? and(...conds) : undefined)
  const total = countRows[0]?.count ?? 0

  return { list, total, page, pageSize }
}

// =============================================================================
// Invoice Titles 发票抬头
// =============================================================================

export async function findInvoiceTitles(
  userId: string,
  titleType?: string,
): Promise<EduInvoiceTitle[]> {
  const conds = [eq(eduInvoiceTitles.userId, userId)]
  if (titleType) conds.push(eq(eduInvoiceTitles.titleType, titleType))
  return db
    .select()
    .from(eduInvoiceTitles)
    .where(and(...conds))
    .orderBy(desc(eduInvoiceTitles.id))
}

export interface CreateInvoiceTitleInput {
  userId: string
  title: string
  titleType?: string
  taxNo?: string | null
  bank?: string | null
  bankAccount?: string | null
  address?: string | null
  phone?: string | null
}

export async function createInvoiceTitle(data: CreateInvoiceTitleInput): Promise<EduInvoiceTitle> {
  const rows = await db
    .insert(eduInvoiceTitles)
    .values({
      userId: data.userId,
      title: data.title,
      titleType: data.titleType,
      taxNo: data.taxNo,
      bank: data.bank,
      bankAccount: data.bankAccount,
      address: data.address,
      phone: data.phone,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建发票抬头失败')
  return row
}

export interface UpdateInvoiceTitleInput {
  title?: string
  titleType?: string
  taxNo?: string | null
  bank?: string | null
  bankAccount?: string | null
  address?: string | null
  phone?: string | null
}

export async function updateInvoiceTitle(
  id: string,
  data: UpdateInvoiceTitleInput,
): Promise<EduInvoiceTitle | undefined> {
  const rows = await db
    .update(eduInvoiceTitles)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.titleType !== undefined ? { titleType: data.titleType } : {}),
      ...(data.taxNo !== undefined ? { taxNo: data.taxNo } : {}),
      ...(data.bank !== undefined ? { bank: data.bank } : {}),
      ...(data.bankAccount !== undefined ? { bankAccount: data.bankAccount } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      updatedAt: new Date(),
    })
    .where(eq(eduInvoiceTitles.id, id))
    .returning()
  return rows[0]
}

export async function deleteInvoiceTitle(id: string): Promise<void> {
  await db.delete(eduInvoiceTitles).where(eq(eduInvoiceTitles.id, id))
}

// =============================================================================
// Invoice Applications 发票申请
// =============================================================================

export interface CreateInvoiceApplicationInput {
  userId: string
  orderId?: string | null
  invoiceType?: string
  titleId?: string | null
  amount?: string
  email?: string | null
  remark?: string | null
}

export async function createInvoiceApplication(
  data: CreateInvoiceApplicationInput,
): Promise<EduInvoiceApplication> {
  const rows = await db
    .insert(eduInvoiceApplications)
    .values({
      userId: data.userId,
      orderId: data.orderId,
      invoiceType: data.invoiceType,
      titleId: data.titleId,
      amount: data.amount,
      email: data.email,
      status: 'pending',
      remark: data.remark,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建发票申请失败')
  return row
}

export interface UpdateInvoiceApplicationInput {
  invoiceType?: string
  titleId?: string | null
  amount?: string
  email?: string | null
  remark?: string | null
  status?: string
}

export async function updateInvoiceApplication(
  id: string,
  data: UpdateInvoiceApplicationInput,
): Promise<EduInvoiceApplication | undefined> {
  const rows = await db
    .update(eduInvoiceApplications)
    .set({
      ...(data.invoiceType !== undefined ? { invoiceType: data.invoiceType } : {}),
      ...(data.titleId !== undefined ? { titleId: data.titleId } : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.remark !== undefined ? { remark: data.remark } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(eduInvoiceApplications.id, id))
    .returning()
  return rows[0]
}

export async function findInvoiceApplicationById(
  id: string,
): Promise<EduInvoiceApplication | undefined> {
  const rows = await db
    .select()
    .from(eduInvoiceApplications)
    .where(eq(eduInvoiceApplications.id, id))
    .limit(1)
  return rows[0]
}

export async function deleteInvoiceApplication(id: string): Promise<void> {
  await db.delete(eduInvoiceApplications).where(eq(eduInvoiceApplications.id, id))
}

export interface ListInvoiceApplicationsOpts {
  page: number
  pageSize: number
  userId?: string
  status?: string
}

export async function findInvoiceApplications(
  opts: ListInvoiceApplicationsOpts,
): Promise<{ list: EduInvoiceApplication[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, userId, status } = opts
  const conds = []
  if (userId) conds.push(eq(eduInvoiceApplications.userId, userId))
  if (status) conds.push(eq(eduInvoiceApplications.status, status))

  const list = await db
    .select()
    .from(eduInvoiceApplications)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(eduInvoiceApplications.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eduInvoiceApplications)
    .where(conds.length ? and(...conds) : undefined)
  const total = countRows[0]?.count ?? 0

  return { list, total, page, pageSize }
}
