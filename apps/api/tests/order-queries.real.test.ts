import { describe, it, expect, beforeEach } from 'vitest'
import { sql, eq } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users, eduOrders } from '@ihui/database'
import {
  createOrder,
  findOrderById,
  findOrderByOrderNo,
  cancelOrder,
  findOrders,
  createPayment,
  cancelPayment,
  findPaymentById,
  findPayments,
  applyRefund,
  processRefund,
  handleRefund,
  findRefundById,
  findRefunds,
  createInvoiceTitle,
  findInvoiceTitles,
  updateInvoiceTitle,
  deleteInvoiceTitle,
  createInvoiceApplication,
  findInvoiceApplicationById,
  updateInvoiceApplication,
  findInvoiceApplications,
  deleteInvoiceApplication,
} from '../src/db/order-queries.js'

async function createTestUser(phone: string) {
  const [row] = await db.insert(users).values({ phone }).returning()
  return row
}

async function setOrderStatus(orderId: string, status: string) {
  await db
    .update(eduOrders)
    .set({ status, ...(status === 'paid' ? { payTime: new Date() } : {}) })
    .where(eq(eduOrders.id, orderId))
}

describe('order-queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    // 按外键依赖顺序清空
    await db.execute(sql`DELETE FROM edu_invoice_applications`)
    await db.execute(sql`DELETE FROM edu_invoice_titles`)
    await db.execute(sql`DELETE FROM edu_refunds`)
    await db.execute(sql`DELETE FROM edu_payments`)
    await db.execute(sql`DELETE FROM edu_orders`)
    await db.execute(sql`DELETE FROM users`)
  })

  describe('Orders 订单', () => {
    it('createOrder — 默认 status=pending, quantity=1, 价格默认 0', async () => {
      const user = await createTestUser('13900000001')
      const order = await createOrder({
        userId: user.id,
        orderType: 'course',
        targetTitle: '测试课程',
      })

      expect(order.id).toBeDefined()
      expect(order.orderNo).toMatch(/^EDU\d{14}[A-Z0-9]{6}$/)
      expect(order.status).toBe('pending')
      expect(order.quantity).toBe(1)
      expect(order.originalPrice).toBe('0.00')
      expect(order.payAmount).toBe('0.00')
      expect(order.orderType).toBe('course')
    })

    it('createOrder 带价格参数 — originalPrice/discountAmount/payAmount', async () => {
      const user = await createTestUser('13900000002')
      const order = await createOrder({
        userId: user.id,
        orderType: 'course',
        originalPrice: '100.00',
        discountAmount: '20.00',
        payAmount: '80.00',
      })
      expect(order.originalPrice).toBe('100.00')
      expect(order.discountAmount).toBe('20.00')
      expect(order.payAmount).toBe('80.00')
    })

    it('findOrderById + findOrderByOrderNo', async () => {
      const user = await createTestUser('13900000003')
      const order = await createOrder({ userId: user.id, orderType: 'course' })

      const byId = await findOrderById(order.id)
      expect(byId).toBeDefined()
      expect(byId!.id).toBe(order.id)

      const byNo = await findOrderByOrderNo(order.orderNo)
      expect(byNo).toBeDefined()
      expect(byNo!.orderNo).toBe(order.orderNo)
    })

    it('cancelOrder — 仅 pending 可取消', async () => {
      const user = await createTestUser('13900000004')
      const order = await createOrder({ userId: user.id, orderType: 'course' })

      const cancelled = await cancelOrder(order.id)
      expect(cancelled).toBeDefined()
      expect(cancelled!.status).toBe('cancelled')
      expect(cancelled!.cancelTime).toBeDefined()

      // 再次取消已取消的订单 — 返回 undefined
      const again = await cancelOrder(order.id)
      expect(again).toBeUndefined()
    })

    it('findOrders — 按 status/orderType/userId/orderNo 过滤 + 分页', async () => {
      const user = await createTestUser('13900000005')
      await createOrder({ userId: user.id, orderType: 'course', targetTitle: 'A' })
      await createOrder({ userId: user.id, orderType: 'card', targetTitle: 'B' })
      const order3 = await createOrder({ userId: user.id, orderType: 'course', targetTitle: 'C' })
      await cancelOrder(order3.id)

      const all = await findOrders({ page: 1, pageSize: 10, userId: user.id })
      expect(all.total).toBe(3)

      const pendingOnly = await findOrders({
        page: 1,
        pageSize: 10,
        userId: user.id,
        status: 'pending',
      })
      expect(pendingOnly.total).toBe(2)

      const cancelledOnly = await findOrders({
        page: 1,
        pageSize: 10,
        userId: user.id,
        status: 'cancelled',
      })
      expect(cancelledOnly.total).toBe(1)

      const courseOnly = await findOrders({
        page: 1,
        pageSize: 10,
        userId: user.id,
        orderType: 'course',
      })
      expect(courseOnly.total).toBe(2)

      // orderNo 模糊搜索
      const byNo = await findOrders({ page: 1, pageSize: 10, userId: user.id, orderNo: 'EDU' })
      expect(byNo.total).toBe(3)
    })
  })

  describe('Payments 支付 — 事务 + 行锁', () => {
    it('createPayment — 基于 pending 订单创建支付记录', async () => {
      const user = await createTestUser('13900000006')
      const order = await createOrder({
        userId: user.id,
        orderType: 'course',
        payAmount: '50.00',
      })

      const result = await createPayment({
        orderId: order.id,
        userId: user.id,
        payType: 'wechat',
      })

      expect(result.payment).toBeDefined()
      expect(result.reason).toBeUndefined()
      expect(result.payment!.orderId).toBe(order.id)
      expect(result.payment!.status).toBe('created')
      expect(result.payment!.payAmount).toBe('50.00')
      expect(result.payment!.paymentNo).toMatch(/^PAY\d{14}[A-Z0-9]{6}$/)
    })

    it('createPayment — 订单不存在返回 order_not_found', async () => {
      const user = await createTestUser('13900000007')
      const result = await createPayment({
        orderId: '00000000-0000-0000-0000-000000000000',
        userId: user.id,
        payType: 'wechat',
      })
      expect(result.reason).toBe('order_not_found')
      expect(result.payment).toBeUndefined()
    })

    it('createPayment — 非 pending 订单返回 order_not_pending', async () => {
      const user = await createTestUser('13900000008')
      const order = await createOrder({ userId: user.id, orderType: 'course' })
      await cancelOrder(order.id)

      const result = await createPayment({
        orderId: order.id,
        userId: user.id,
        payType: 'wechat',
      })
      expect(result.reason).toBe('order_not_pending')
    })

    it('cancelPayment + findPaymentById', async () => {
      const user = await createTestUser('13900000009')
      const order = await createOrder({ userId: user.id, orderType: 'course' })
      const { payment } = await createPayment({
        orderId: order.id,
        userId: user.id,
        payType: 'alipay',
      })

      const cancelled = await cancelPayment(payment!.id)
      expect(cancelled).toBeDefined()
      expect(cancelled!.status).toBe('cancelled')

      const found = await findPaymentById(payment!.id)
      expect(found!.status).toBe('cancelled')
    })

    it('findPayments — 按 status/userId/orderId 过滤', async () => {
      const user = await createTestUser('13900000010')
      const order = await createOrder({ userId: user.id, orderType: 'course' })
      await createPayment({ orderId: order.id, userId: user.id, payType: 'wechat' })

      const byUser = await findPayments({ page: 1, pageSize: 10, userId: user.id })
      expect(byUser.total).toBe(1)

      const byOrder = await findPayments({ page: 1, pageSize: 10, orderId: order.id })
      expect(byOrder.total).toBe(1)

      const byStatus = await findPayments({ page: 1, pageSize: 10, status: 'created' })
      expect(byStatus.total).toBe(1)
    })
  })

  describe('Refunds 退款 — 事务 + 行锁 + 状态同步', () => {
    it('applyRefund — 仅 paid 订单可申请', async () => {
      const user = await createTestUser('13900000011')
      const order = await createOrder({ userId: user.id, orderType: 'course', payAmount: '100.00' })

      // pending 订单不能申请退款
      const failResult = await applyRefund({ orderId: order.id, userId: user.id })
      expect(failResult.reason).toBe('order_not_paid')

      // 改为 paid 后可以申请
      await setOrderStatus(order.id, 'paid')
      const result = await applyRefund({
        orderId: order.id,
        userId: user.id,
        reason: '不想要了',
      })
      expect(result.refund).toBeDefined()
      expect(result.refund!.status).toBe('pending')
      expect(result.refund!.reason).toBe('不想要了')
      expect(result.refund!.refundAmount).toBe('100.00')
    })

    it('applyRefund — 订单不存在返回 order_not_found', async () => {
      const user = await createTestUser('13900000012')
      const result = await applyRefund({
        orderId: '00000000-0000-0000-0000-000000000000',
        userId: user.id,
      })
      expect(result.reason).toBe('order_not_found')
    })

    it('processRefund — 管理员审核(approved/rejected)', async () => {
      const user = await createTestUser('13900000013')
      const order = await createOrder({ userId: user.id, orderType: 'course' })
      await setOrderStatus(order.id, 'paid')
      const { refund } = await applyRefund({ orderId: order.id, userId: user.id })

      const approved = await processRefund(refund!.id, 'approved', '同意退款')
      expect(approved!.status).toBe('approved')
      expect(approved!.processMessage).toBe('同意退款')
      expect(approved!.processTime).toBeDefined()
    })

    it('handleRefund — completed 时同步订单状态为 refunded(事务原子性)', async () => {
      const user = await createTestUser('13900000014')
      const order = await createOrder({ userId: user.id, orderType: 'course' })
      await setOrderStatus(order.id, 'paid')
      const { refund } = await applyRefund({ orderId: order.id, userId: user.id })
      await processRefund(refund!.id, 'approved')

      const completed = await handleRefund(refund!.id, 'completed', '退款已到账')
      expect(completed!.status).toBe('completed')
      expect(completed!.completeTime).toBeDefined()

      // 订单状态应同步为 refunded
      const updatedOrder = await findOrderById(order.id)
      expect(updatedOrder!.status).toBe('refunded')
      expect(updatedOrder!.refundTime).toBeDefined()
    })

    it('handleRefund — processing 不改变订单状态', async () => {
      const user = await createTestUser('13900000015')
      const order = await createOrder({ userId: user.id, orderType: 'course' })
      await setOrderStatus(order.id, 'paid')
      const { refund } = await applyRefund({ orderId: order.id, userId: user.id })
      await processRefund(refund!.id, 'approved')

      await handleRefund(refund!.id, 'processing', '处理中')
      const updatedOrder = await findOrderById(order.id)
      expect(updatedOrder!.status).toBe('paid') // 仍为 paid
    })

    it('findRefunds — 按 status/userId/orderId 过滤', async () => {
      const user = await createTestUser('13900000016')
      const order = await createOrder({ userId: user.id, orderType: 'course' })
      await setOrderStatus(order.id, 'paid')
      const { refund } = await applyRefund({ orderId: order.id, userId: user.id })

      const byId = await findRefundById(refund!.id)
      expect(byId).toBeDefined()

      const byUser = await findRefunds({ page: 1, pageSize: 10, userId: user.id })
      expect(byUser.total).toBe(1)

      const byOrder = await findRefunds({ page: 1, pageSize: 10, orderId: order.id })
      expect(byOrder.total).toBe(1)

      const byStatus = await findRefunds({ page: 1, pageSize: 10, status: 'pending' })
      expect(byStatus.total).toBe(1)
    })
  })

  describe('Invoice Titles 发票抬头', () => {
    it('CRUD — 创建/查询/更新/删除', async () => {
      const user = await createTestUser('13900000017')
      const title = await createInvoiceTitle({
        userId: user.id,
        title: '某科技公司',
        titleType: 'company',
        taxNo: '1234567890',
      })
      expect(title.id).toBeDefined()
      expect(title.title).toBe('某科技公司')

      // 按 userId 查询
      const titles = await findInvoiceTitles(user.id)
      expect(titles).toHaveLength(1)

      // 按 titleType 过滤
      const companyOnly = await findInvoiceTitles(user.id, 'company')
      expect(companyOnly).toHaveLength(1)
      const personalOnly = await findInvoiceTitles(user.id, 'personal')
      expect(personalOnly).toHaveLength(0)

      // 更新
      const updated = await updateInvoiceTitle(title.id, { title: '新公司名', taxNo: '9876543210' })
      expect(updated!.title).toBe('新公司名')
      expect(updated!.taxNo).toBe('9876543210')

      // 删除
      await deleteInvoiceTitle(title.id)
      const afterDelete = await findInvoiceTitles(user.id)
      expect(afterDelete).toHaveLength(0)
    })
  })

  describe('Invoice Applications 发票申请', () => {
    it('CRUD — 创建/查询/更新/删除', async () => {
      const user = await createTestUser('13900000018')
      const order = await createOrder({ userId: user.id, orderType: 'course' })
      const title = await createInvoiceTitle({ userId: user.id, title: '公司' })

      const app = await createInvoiceApplication({
        userId: user.id,
        orderId: order.id,
        titleId: title.id,
        invoiceType: 'general',
        amount: '100.00',
        email: 'test@example.com',
      })
      expect(app.id).toBeDefined()
      expect(app.status).toBe('pending')

      // 查询
      const byId = await findInvoiceApplicationById(app.id)
      expect(byId).toBeDefined()

      const byUser = await findInvoiceApplications({ page: 1, pageSize: 10, userId: user.id })
      expect(byUser.total).toBe(1)

      const byStatus = await findInvoiceApplications({ page: 1, pageSize: 10, status: 'pending' })
      expect(byStatus.total).toBe(1)

      // 更新状态
      const updated = await updateInvoiceApplication(app.id, { status: 'approved' })
      expect(updated!.status).toBe('approved')

      // 删除
      await deleteInvoiceApplication(app.id)
      const afterDelete = await findInvoiceApplicationById(app.id)
      expect(afterDelete).toBeUndefined()
    })
  })
})
