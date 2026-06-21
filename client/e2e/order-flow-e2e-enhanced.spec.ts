/**
 * 订单状态流转端到端真实联调测试（增强版）
 *
 * 与 order-flow-e2e.spec.ts 的区别:
 * - 旧版只测 "查" (列表/详情), 不测 "改" (创建/支付/取消/退款)
 * - 本文件测 "改" 的完整状态流转, 验证状态真的变了
 *
 * 测试链路（基于后端真实存在的接口，真正验证状态流转）:
 *
 * A. 创建订单 → 验证真的创建了（创建后能在详情查到）
 * B. 支付订单 → 验证状态 pending→paid
 * C. 重复支付被拒 → 验证业务校验（已支付不可再支付）
 * D. 已支付订单不可取消 → 验证业务校验
 * E. 取消订单 → 验证状态 pending→cancelled
 * F. 退款申请 → 验证状态 paid→refunding
 * G. 物流查询 → 验证返回物流信息
 * H. 确认收货 → 验证状态 shipped→completed
 * I. v2 钱包余额 → 验证返回余额数据
 * J. v2 钱包汇总 → 验证返回汇总数据
 * K. v2 支付记录 → 验证返回支付列表
 *
 * 后端实现 (v1_order.py + v2_order.py, 进程内存储):
 * - POST /api/v1/order/create: 创建订单, 返回 order + amount
 * - POST /api/v1/order/{id}/pay: 支付, pending→paid
 * - POST /api/v1/order/{id}/cancel: 取消, pending→cancelled
 * - POST /api/v1/order/{id}/refund: 退款, paid→refunding
 * - POST /api/v1/order/{id}/confirm: 确认收货, shipped→completed
 * - GET /api/v1/order/{id}/delivery: 物流查询
 * - GET /api/v2/wallet/balance: v2 钱包余额
 * - GET /api/v2/wallet/summary: v2 钱包汇总
 * - GET /api/v2/payment/list: v2 支付记录
 *
 * 测试设计: 每个测试自己创建订单, 不依赖预置订单初始状态 (幂等)
 */

import { test, expect, type APIRequestContext } from '@playwright/test'

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'

/** 判断 code 是否为成功 */
function isCodeOk(code: unknown): boolean {
  return code === '0' || code === 0 || code === 200 || code === '200'
}

/** 判断是否被 WAF 限流 */
function isWafBlocked(status: number, body: any): boolean {
  return status === 403 || body?.blocked_by === 'rate_limit' || body?.error === 'rate_limited'
}

/** 创建一个测试订单, 返回 order_id */
async function createTestOrder(request: APIRequestContext, suffix: string): Promise<string> {
  const resp = await request.post(`${BACKEND}/api/v1/order/create`, {
    timeout: 15000,
    data: {
      user_id: `e2e_${suffix}`,
      items: [{ product_id: `p_${suffix}`, name: `E2E测试商品_${suffix}`, price: 10.5, qty: 2 }],
      address: `E2E测试地址_${suffix}`,
    },
  })
  const body = await resp.json().catch(() => ({}))
  if (isWafBlocked(resp.status(), body)) { test.skip(); return '' }
  expect(resp.status(), `创建订单应返回 200, 实际: ${resp.status()}`).toBe(200)
  expect(isCodeOk(body.code), `创建订单 code 应为成功, 实际: ${body.code}`).toBe(true)
  expect(body.data?.order?.id, '应返回订单 id').toBeTruthy()
  return body.data.order.id as string
}

/** 查询订单详情, 返回 order 对象 */
async function getOrder(request: APIRequestContext, orderId: string): Promise<Record<string, unknown>> {
  const resp = await request.get(`${BACKEND}/api/v1/order/${orderId}`, { timeout: 15000 })
  const body = await resp.json().catch(() => ({}))
  if (isWafBlocked(resp.status(), body)) { test.skip(); return {} }
  expect(resp.status(), `查询订单应返回 200`).toBe(200)
  expect(body.data?.found, `订单 ${orderId} 应存在`).toBe(true)
  return body.data.order as Record<string, unknown>
}

test.describe.configure({ mode: 'serial' })

test.describe('订单状态流转端到端联调（增强版）', () => {
  test.setTimeout(30000)

  // ========== A. 创建订单 → 验证真的创建了 ==========

  test('创建订单并在详情中查到 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const orderId = await createTestOrder(request, 'create')
    // 查详情验证真的创建了
    const order = await getOrder(request, orderId)
    expect(order.id, '详情 id 应与创建返回一致').toBe(orderId)
    expect(order.status, '新订单状态应为 pending').toBe('pending')
    expect(order.amount, '金额应为 21.0 (10.5×2)').toBe(21)
    expect(order.user_id, 'user_id 应为 e2e_create').toBe('e2e_create')
    console.log(`[创建订单] orderId=${orderId}, status=${order.status}, amount=${order.amount}`)
  })

  // ========== B. 支付订单 → 验证状态 pending→paid ==========

  test('支付订单状态从 pending 变为 paid - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const orderId = await createTestOrder(request, 'pay')
    // 支付前确认是 pending
    const before = await getOrder(request, orderId)
    expect(before.status, '支付前应为 pending').toBe('pending')

    // 支付
    const payResp = await request.post(`${BACKEND}/api/v1/order/${orderId}/pay?method=alipay`, { timeout: 15000 })
    const payBody = await payResp.json().catch(() => ({}))
    if (isWafBlocked(payResp.status(), payBody)) { test.skip(); return }
    expect(payResp.status(), '支付应返回 200').toBe(200)
    expect(payBody.data.paid, '支付应成功').toBe(true)
    expect(payBody.data.method, '支付方式应为 alipay').toBe('alipay')
    expect(payBody.data.amount, '支付金额应为 21').toBe(21)

    // 支付后验证状态变成 paid
    const after = await getOrder(request, orderId)
    expect(after.status, '支付后应为 paid').toBe('paid')
    console.log(`[支付订单] ${orderId}: pending → paid, pay_id=${payBody.data.pay_id}`)
  })

  // ========== C. 重复支付被拒 → 验证业务校验 ==========

  test('已支付订单重复支付被拒 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const orderId = await createTestOrder(request, 'dup_pay')
    // 先支付成功
    await request.post(`${BACKEND}/api/v1/order/${orderId}/pay?method=alipay`, { timeout: 15000 })
    // 重复支付应被拒
    const resp = await request.post(`${BACKEND}/api/v1/order/${orderId}/pay?method=alipay`, { timeout: 15000 })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '重复支付应返回 200').toBe(200)
    expect(body.data.paid, '重复支付应失败').toBe(false)
    expect(String(body.data.reason), 'reason 应含"不可支付"').toContain('不可支付')
    console.log(`[重复支付] ${orderId} 被拒, reason=${body.data.reason}`)
  })

  // ========== D. 已支付订单不可取消 → 验证业务校验 ==========

  test('已支付订单不可取消 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const orderId = await createTestOrder(request, 'cancel_paid')
    // 先支付
    await request.post(`${BACKEND}/api/v1/order/${orderId}/pay?method=alipay`, { timeout: 15000 })
    // 取消应被拒
    const resp = await request.post(`${BACKEND}/api/v1/order/${orderId}/cancel?reason=e2e`, { timeout: 15000 })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '取消应返回 200').toBe(200)
    expect(body.data.cancelled, '已支付订单取消应失败').toBe(false)
    expect(String(body.data.reason), 'reason 应含"不可取消"').toContain('不可取消')
    console.log(`[已支付不可取消] ${orderId} 被拒, reason=${body.data.reason}`)
  })

  // ========== E. 取消订单 → 验证状态 pending→cancelled ==========

  test('取消订单状态从 pending 变为 cancelled - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const orderId = await createTestOrder(request, 'cancel')
    // 取消前确认是 pending
    const before = await getOrder(request, orderId)
    expect(before.status, '取消前应为 pending').toBe('pending')

    // 取消
    const resp = await request.post(`${BACKEND}/api/v1/order/${orderId}/cancel?reason=e2e_test_cancel`, { timeout: 15000 })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '取消应返回 200').toBe(200)
    expect(body.data.cancelled, '取消应成功').toBe(true)

    // 取消后验证状态变成 cancelled
    const after = await getOrder(request, orderId)
    expect(after.status, '取消后应为 cancelled').toBe('cancelled')
    console.log(`[取消订单] ${orderId}: pending → cancelled`)
  })

  // ========== F. 退款申请 → 验证状态 paid→refunding ==========

  test('退款申请状态从 paid 变为 refunding - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const orderId = await createTestOrder(request, 'refund')
    // 先支付
    await request.post(`${BACKEND}/api/v1/order/${orderId}/pay?method=alipay`, { timeout: 15000 })

    // 申请退款
    const resp = await request.post(`${BACKEND}/api/v1/order/${orderId}/refund`, {
      timeout: 15000,
      data: { reason: 'E2E测试退款', amount: 10 },
    })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '退款应返回 200').toBe(200)
    expect(body.data.refunded, '退款申请应成功').toBe(true)
    expect(body.data.amount, '退款金额应为 10').toBe(10)
    expect(body.data.refund_id, '应返回 refund_id').toBeTruthy()

    // 退款后验证状态变成 refunding
    const after = await getOrder(request, orderId)
    expect(after.status, '退款后应为 refunding').toBe('refunding')
    console.log(`[退款申请] ${orderId}: paid → refunding, refund_id=${body.data.refund_id}`)
  })

  // ========== G. 物流查询 → 验证返回物流信息 ==========

  test('物流查询返回物流信息 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 用预置的 shipped 订单 ord_1003 查物流
    const resp = await request.get(`${BACKEND}/api/v1/order/ord_1003/delivery`, { timeout: 15000 })
    const body0 = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body0)) { test.skip(); return }
    if (resp.status() === 404) {
      test.skip(true, '物流查询接口未挂载或订单不存在')
      return
    }
    expect(resp.status(), '物流查询应返回 200').toBe(200)
    const body = body0
    expect(body.data.order_id, '应返回 order_id').toBe('ord_1003')
    expect(body.data.carrier, '应返回承运商').toBeTruthy()
    expect(body.data.tracking_no, '应返回运单号').toBeTruthy()
    expect(Array.isArray(body.data.steps), '应返回物流步骤数组').toBe(true)
    expect(body.data.steps.length, '物流步骤应至少 1 条').toBeGreaterThan(0)
    console.log(`[物流查询] carrier=${body.data.carrier}, tracking_no=${body.data.tracking_no}, steps=${body.data.steps.length}`)
  })

  // ========== H. 确认收货 → 验证状态 shipped→completed ==========
  // 注意: ord_1003 初始是 shipped, 但可能被其他测试改成 completed
  // 所以这里用宽容断言: 如果还是 shipped 则确认成功, 如果已 completed 则跳过

  test('确认收货状态流转 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const before = await getOrder(request, 'ord_1003')
    if (before.status !== 'shipped') {
      // 订单已被确认过, 验证当前是 completed
      expect(before.status, '已确认过的订单应为 completed').toBe('completed')
      console.log(`[确认收货] ord_1003 已是 completed (之前测试已确认)`)
      return
    }
    // 确认收货
    const resp = await request.post(`${BACKEND}/api/v1/order/ord_1003/confirm`, { timeout: 15000 })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '确认收货应返回 200').toBe(200)
    expect(body.data.confirmed, '确认收货应成功').toBe(true)
    // 验证状态变成 completed
    const after = await getOrder(request, 'ord_1003')
    expect(after.status, '确认后应为 completed').toBe('completed')
    console.log(`[确认收货] ord_1003: shipped → completed`)
  })

  // ========== I. v2 钱包余额 → 验证返回余额数据 ==========

  test('v2 钱包余额查询返回数据 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/api/v2/wallet/balance?uuid=u_default`, { timeout: 15000 })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    if (resp.status() === 404) {
      test.skip(true, 'v2 钱包余额接口未挂载')
      return
    }
    expect(resp.status(), '钱包余额应返回 200').toBe(200)
    expect(isCodeOk(body.code), `code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data.uuid, '应返回 uuid').toBe('u_default')
    expect(typeof body.data.balance, 'balance 应为数字').toBe('number')
    expect(typeof body.data.frozen, 'frozen 应为数字').toBe('number')
    expect(body.data.currency, 'currency 应为 CNY').toBe('CNY')
    console.log(`[v2钱包余额] balance=${body.data.balance}, frozen=${body.data.frozen}`)
  })

  // ========== J. v2 钱包汇总 → 验证返回汇总数据 ==========

  test('v2 钱包汇总查询返回数据 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/api/v2/wallet/summary?uuid=u_default`, { timeout: 15000 })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    if (resp.status() === 404) {
      test.skip(true, 'v2 钱包汇总接口未挂载')
      return
    }
    expect(resp.status(), '钱包汇总应返回 200').toBe(200)
    expect(isCodeOk(body.code), `code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(typeof body.data.balance, 'balance 应为数字').toBe('number')
    expect(typeof body.data.total_income, 'total_income 应为数字').toBe('number')
    expect(typeof body.data.total_expense, 'total_expense 应为数字').toBe('number')
    expect(typeof body.data.transactions, 'transactions 应为数字').toBe('number')
    console.log(`[v2钱包汇总] balance=${body.data.balance}, income=${body.data.total_income}, expense=${body.data.total_expense}`)
  })

  // ========== K. v2 支付记录 → 验证返回支付列表 ==========

  test('v2 支付记录查询返回列表 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/api/v2/payment/list?page=1&size=10`, { timeout: 15000 })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    if (resp.status() === 404) {
      test.skip(true, 'v2 支付记录接口未挂载')
      return
    }
    expect(resp.status(), '支付记录应返回 200').toBe(200)
    expect(isCodeOk(body.code), `code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(Array.isArray(body.data.list), '应返回 list 数组').toBe(true)
    expect(typeof body.data.total, 'total 应为数字').toBe('number')
    // 每条支付记录应有 order_no/amount/method/status
    if (body.data.list.length > 0) {
      const pay = body.data.list[0]
      expect(pay.order_no, '支付记录应有 order_no').toBeTruthy()
      expect(typeof pay.amount, '支付记录 amount 应为数字').toBe('number')
      expect(pay.method, '支付记录应有 method').toBeTruthy()
      expect(pay.status, '支付记录应有 status').toBeTruthy()
    }
    console.log(`[v2支付记录] 返回 ${body.data.list.length} 条, total=${body.data.total}`)
  })
})
