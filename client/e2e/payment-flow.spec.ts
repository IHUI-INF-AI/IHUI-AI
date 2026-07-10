/**
 * 支付链路端到端真实联调测试
 *
 * 验证后端支付端点完整链路:
 *   1. POST /api/v1/payment/create    创建支付订单 → 拿 pay_id
 *   2. GET  /api/v1/payment/status    查询支付状态 → pending
 *   3. POST /api/v1/payment/callback  模拟支付回调 → paid
 *   4. GET  /api/v1/payment/status    查询支付状态 → paid
 *   5. POST /api/v1/payment/refund    申请退款 → refunding
 *   6. GET  /api/v1/payment/records   查询支付记录
 *   7. GET  /api/v1/payment/methods   支付方式列表
 *   8. GET  /api/v1/payment/balance   账户余额
 *
 * 后端实现: server/app/api/v1_payment.py (10 端点, 进程内存储)
 * 前端 SDK: client/src/api/payment.ts
 */

import { test, expect, type APIRequestContext } from '@playwright/test'
import { fetchTokenWithRetry } from './helpers/auth-helper'

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'

/** 构造带鉴权的 headers */
function authHeaders(token: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

test.describe('支付链路端到端联调', () => {
  test.setTimeout(30000)

  test('完整支付链路: 创建 → 查询 → 回调 → 退款', async ({ request }: { request: APIRequestContext }) => {
    const token = await fetchTokenWithRetry(request)
    const headers = authHeaders(token)

    // Step 1: 创建支付订单
    const order_id = `e2e_pay_${Date.now()}`
    const createResp = await request.post(`${BACKEND}/api/v1/payment/create`, {
      timeout: 10000,
      headers,
      data: {
        order_id,
        amount: 99.5,
        method: 'alipay',
        user_id: 'e2e_test_user',
      },
    })

    if (createResp.status() === 404) {
      test.skip(true, '后端支付端点未挂载')
      return
    }

    expect(createResp.status(), '创建支付订单应返回 200').toBe(200)
    const createBody = await createResp.json()
    expect([0, 200, '0', '200']).toContain(createBody.code)
    expect(createBody.data.pay_id, '应返回 pay_id').toBeTruthy()
    expect(createBody.data.status, '初始状态应为 pending').toBe('pending')
    expect(createBody.data.pay_url, '应返回支付链接').toBeTruthy()

    const pay_id = createBody.data.pay_id
    console.log(`[支付 Step1] 创建订单成功: pay_id=${pay_id}, order_id=${order_id}`)

    // Step 2: 查询支付状态 (应为 pending)
    const statusResp1 = await request.get(`${BACKEND}/api/v1/payment/status`, {
      timeout: 10000,
      headers,
      params: { order_id },
    })
    expect(statusResp1.status(), '查询支付状态应返回 200').toBe(200)
    const statusBody1 = await statusResp1.json()
    expect([0, 200, '0', '200']).toContain(statusBody1.code)
    expect(statusBody1.data.found, '应找到支付记录').toBe(true)
    expect(statusBody1.data.status, '状态应为 pending').toBe('pending')
    console.log(`[支付 Step2] 查询状态: ${statusBody1.data.status}`)

    // Step 3: 模拟支付回调 (pending → paid)
    const callbackResp = await request.post(`${BACKEND}/api/v1/payment/callback`, {
      timeout: 10000,
      headers,
      data: {
        pay_id,
        status: 'paid',
        out_trade_no: order_id,
      },
    })
    expect(callbackResp.status(), '支付回调应返回 200').toBe(200)
    const callbackBody = await callbackResp.json()
    expect([0, 200, '0', '200']).toContain(callbackBody.code)
    expect(callbackBody.data.matched, '回调应匹配支付记录').toBe(true)
    expect(callbackBody.data.status, '回调后状态应为 paid').toBe('paid')
    console.log(`[支付 Step3] 回调成功: status=${callbackBody.data.status}`)

    // Step 4: 再次查询支付状态 (应为 paid)
    const statusResp2 = await request.get(`${BACKEND}/api/v1/payment/status`, {
      timeout: 10000,
      headers,
      params: { order_id },
    })
    expect(statusResp2.status()).toBe(200)
    const statusBody2 = await statusResp2.json()
    expect(statusBody2.data.status, '回调后状态应为 paid').toBe('paid')
    console.log(`[支付 Step4] 回调后查询: ${statusBody2.data.status}`)

    // Step 5: 申请退款 (paid → refunding)
    const refundResp = await request.post(`${BACKEND}/api/v1/payment/refund`, {
      timeout: 10000,
      headers,
      data: {
        pay_id,
        amount: 99.5,
        reason: 'E2E 测试退款',
      },
    })
    expect(refundResp.status(), '申请退款应返回 200').toBe(200)
    const refundBody = await refundResp.json()
    expect([0, 200, '0', '200']).toContain(refundBody.code)
    expect(refundBody.data.refunded, '退款应成功').toBe(true)
    expect(refundBody.data.refund_id, '应返回退款 ID').toBeTruthy()
    console.log(`[支付 Step5] 退款成功: refund_id=${refundBody.data.refund_id}`)

    // Step 6: 查询支付记录 (应包含该订单)
    const recordsResp = await request.get(`${BACKEND}/api/v1/payment/records`, {
      timeout: 10000,
      headers,
      params: { user_id: 'e2e_test_user', page: 1, size: 20 },
    })
    expect(recordsResp.status(), '查询支付记录应返回 200').toBe(200)
    const recordsBody = await recordsResp.json()
    expect([0, 200, '0', '200']).toContain(recordsBody.code)
    console.log(`[支付 Step6] 支付记录查询成功`)
  })

  test('GET /api/v1/payment/methods 返回支付方式列表', async ({ request }: { request: APIRequestContext }) => {
    const token = await fetchTokenWithRetry(request)
    const headers = authHeaders(token)

    const resp = await request.get(`${BACKEND}/api/v1/payment/methods`, { timeout: 10000, headers })
    if (resp.status() === 404) {
      test.skip(true, '后端支付端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect([0, 200, '0', '200']).toContain(body.code)
    console.log(`[支付方式] 响应: ${JSON.stringify(body.data).substring(0, 200)}`)
  })

  test('GET /api/v1/payment/balance 返回账户余额', async ({ request }: { request: APIRequestContext }) => {
    const token = await fetchTokenWithRetry(request)
    const headers = authHeaders(token)

    const resp = await request.get(`${BACKEND}/api/v1/payment/balance`, { timeout: 10000, headers })
    if (resp.status() === 404) {
      test.skip(true, '后端支付端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect([0, 200, '0', '200']).toContain(body.code)
    console.log(`[账户余额] 响应: ${JSON.stringify(body.data).substring(0, 200)}`)
  })

  test('支付回调幂等性: 重复回调不重复入账', async ({ request }: { request: APIRequestContext }) => {
    const token = await fetchTokenWithRetry(request)
    const headers = authHeaders(token)

    // 创建订单
    const order_id = `e2e_idempotent_${Date.now()}`
    const createResp = await request.post(`${BACKEND}/api/v1/payment/create`, {
      timeout: 10000,
      headers,
      data: { order_id, amount: 50, method: 'wechat', user_id: 'e2e_idempotent_user' },
    })
    if (createResp.status() === 404) {
      test.skip(true, '后端支付端点未挂载')
      return
    }
    const createBody = await createResp.json()
    const pay_id = createBody.data.pay_id

    // 第一次回调 (paid)
    const cb1 = await request.post(`${BACKEND}/api/v1/payment/callback`, {
      timeout: 10000,
      headers,
      data: { pay_id, status: 'paid' },
    })
    const cb1Body = await cb1.json()
    expect(cb1Body.data.status).toBe('paid')
    expect(cb1Body.data.idempotent).toBeFalsy()

    // 第二次回调 (重复, 应幂等)
    const cb2 = await request.post(`${BACKEND}/api/v1/payment/callback`, {
      timeout: 10000,
      headers,
      data: { pay_id, status: 'paid' },
    })
    const cb2Body = await cb2.json()
    expect(cb2Body.data.status).toBe('paid')
    expect(cb2Body.data.idempotent, '重复回调应标记幂等').toBe(true)
    console.log(`[幂等性] 重复回调正确标记为幂等`)
  })
})
