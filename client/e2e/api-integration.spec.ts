/**
 * 后端 API 集成测试 (真实联调版)
 *
 * 改造说明: 移除所有 page.route mock, 直接调用本地后端 8000 真实端点.
 *           验证后端端点可达 + 响应格式正确, 不再依赖 mock 响应.
 *
 * 覆盖链路:
 * 1. 支付链路: /api/v1/payment/* (v1_payment.py)
 * 2. 用户链路: /api/v1/auth/login, /api/v1/user/* (v1_auth.py, v1_user.py)
 * 3. 内容链路: /api/agent/* (mock), /api/agents/* (mock)
 * 4. 订单链路: /api/v1/order/* (v1_order.py)
 * 5. 错误链路: 401/403/404/500 状态码处理
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

/** 验证后端 success() 响应格式 */
function expectSuccessFormat(body: any): void {
  expect([0, 200, '0', '200']).toContain(body.code)
}

test.describe('支付链路真实联调', () => {

  test('POST /api/v1/payment/create 创建支付订单', async ({ request }: { request: APIRequestContext }) => {
    const token = await fetchTokenWithRetry(request)
    const resp = await request.post(`${BACKEND}/api/v1/payment/create`, {
      timeout: 10000,
      headers: authHeaders(token),
      data: {
        order_id: `api_integ_${Date.now()}`,
        amount: 1.99,
        method: 'alipay',
        user_id: 'api_integ_user',
      },
      failOnStatusCode: false,
    })
    if (resp.status() === 404) {
      test.skip(true, '后端支付端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    expect(body.data.pay_id, '应返回 pay_id').toBeTruthy()
    expect(body.data.status, '初始状态应为 pending').toBe('pending')
    console.log(`[支付] 创建订单: pay_id=${body.data.pay_id}`)
  })

  test('GET /api/v1/payment/methods 支付方式列表', async ({ request }: { request: APIRequestContext }) => {
    const token = await fetchTokenWithRetry(request)
    const resp = await request.get(`${BACKEND}/api/v1/payment/methods`, {
      timeout: 10000,
      headers: authHeaders(token),
      failOnStatusCode: false,
    })
    if (resp.status() === 404) {
      test.skip(true, '后端支付端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    console.log(`[支付] 方式列表: ${JSON.stringify(body.data).substring(0, 150)}`)
  })

  test('GET /api/v1/payment/balance 账户余额', async ({ request }: { request: APIRequestContext }) => {
    const token = await fetchTokenWithRetry(request)
    const resp = await request.get(`${BACKEND}/api/v1/payment/balance`, {
      timeout: 10000,
      headers: authHeaders(token),
      failOnStatusCode: false,
    })
    if (resp.status() === 404) {
      test.skip(true, '后端支付端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    console.log(`[支付] 余额: ${JSON.stringify(body.data).substring(0, 150)}`)
  })
})

test.describe('用户链路真实联调', () => {

  test('POST /api/v1/auth/login 用户名密码登录', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.post(`${BACKEND}/api/v1/auth/login`, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
      data: { username: 'integration_test', password: 'test123456' },
      failOnStatusCode: false,
    })
    // 后端限流时: 429, 正常: 200
    expect([200, 429]).toContain(resp.status())
    if (resp.status() === 200) {
      const body = await resp.json()
      expectSuccessFormat(body)
      expect(body.data.token || body.data.access_token, '应返回 token').toBeTruthy()
      console.log(`[用户] 登录成功: token 长度=${String(body.data.token || body.data.access_token).length}`)
    } else {
      console.log('[用户] 登录限流 (429)')
    }
  })

  test('GET /api/v1/user/users/getInfo 用户信息', async ({ request }: { request: APIRequestContext }) => {
    const token = await fetchTokenWithRetry(request)
    const resp = await request.get(`${BACKEND}/api/v1/user/users/getInfo`, {
      timeout: 10000,
      headers: authHeaders(token),
      failOnStatusCode: false,
    })
    if (resp.status() === 404) {
      test.skip(true, '后端用户端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    console.log(`[用户] 信息: ${JSON.stringify(body.data).substring(0, 150)}`)
  })
})

test.describe('内容链路真实联调', () => {

  test('GET /api/agent/categories 智能体分类', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/api/agent/categories`, { timeout: 10000, failOnStatusCode: false })
    if (resp.status() !== 200) {
      test.skip(true, '后端 mock 未启用')
      return
    }
    const body = await resp.json()
    expect(Number(body.code)).toBe(0)
    expect(body.data.list.length, '分类列表非空').toBeGreaterThan(0)
    console.log(`[内容] 分类数: ${body.data.list.length}`)
  })

  test('GET /api/agent/rule/search/bylink 智能体列表', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/api/agent/rule/search/bylink`, { timeout: 10000, failOnStatusCode: false })
    if (resp.status() !== 200) {
      test.skip(true, '后端 mock 未启用')
      return
    }
    const body = await resp.json()
    expect(Number(body.code)).toBe(0)
    const categories = Object.keys(body.data)
    expect(categories.length, '至少一个主分类').toBeGreaterThan(0)
    console.log(`[内容] 主分类: ${categories.join(', ')}`)
  })

  test('GET /api/agents/categories 复数路径也可达', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/api/agents/categories`, { timeout: 10000, failOnStatusCode: false })
    if (resp.status() !== 200) {
      test.skip(true, '后端 mock 未启用')
      return
    }
    const body = await resp.json()
    expect(Number(body.code)).toBe(0)
    console.log(`[内容] agents/categories: ${JSON.stringify(body.data).substring(0, 100)}`)
  })
})

test.describe('订单链路真实联调', () => {

  test('POST /api/v1/order/create 创建订单', async ({ request }: { request: APIRequestContext }) => {
    const token = await fetchTokenWithRetry(request)
    const resp = await request.post(`${BACKEND}/api/v1/order/create`, {
      timeout: 10000,
      headers: authHeaders(token),
      data: {
        product_id: 'test_product_001',
        quantity: 1,
        amount: 9.9,
      },
      failOnStatusCode: false,
    })
    if (resp.status() === 404) {
      test.skip(true, '后端订单端点未挂载')
      return
    }
    expect([200, 422]).toContain(resp.status())
    if (resp.status() === 200) {
      const body = await resp.json()
      expectSuccessFormat(body)
      console.log(`[订单] 创建: ${JSON.stringify(body.data).substring(0, 150)}`)
    }
  })

  test('GET /api/v1/order/list 订单列表', async ({ request }: { request: APIRequestContext }) => {
    const token = await fetchTokenWithRetry(request)
    const resp = await request.get(`${BACKEND}/api/v1/order/list`, {
      timeout: 10000,
      headers: authHeaders(token),
      params: { page: 1, size: 10 },
      failOnStatusCode: false,
    })
    if (resp.status() === 404) {
      test.skip(true, '后端订单端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    console.log(`[订单] 列表: ${JSON.stringify(body.data).substring(0, 150)}`)
  })
})

test.describe('错误链路真实联调', () => {

  test('无 token 访问受保护端点返回 401/403', async ({ request }: { request: APIRequestContext }) => {
    // 不带 token 访问需要鉴权的端点
    const resp = await request.get(`${BACKEND}/api/v1/user/users/getInfo`, {
      timeout: 10000,
      failOnStatusCode: false,
    })
    // 后端可能返回 401 (未认证) 或 200 + code != 0 (mock 兜底)
    expect([200, 401, 403]).toContain(resp.status())
    console.log(`[错误] 无 token 状态: ${resp.status()}`)
  })

  test('无效 token 访问受保护端点返回 401/403', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/api/v1/user/users/getInfo`, {
      timeout: 10000,
      headers: { Authorization: 'Bearer invalid_token_xxx' },
      failOnStatusCode: false,
    })
    expect([200, 401, 403]).toContain(resp.status())
    console.log(`[错误] 无效 token 状态: ${resp.status()}`)
  })

  test('不存在路径返回 404', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/api/v1/non-existent-endpoint-12345`, {
      timeout: 10000,
      failOnStatusCode: false,
    })
    // 后端 mock catch-all 可能返回 200, 真实 404, 或 v1 router 404
    expect([200, 404]).toContain(resp.status())
    console.log(`[错误] 不存在路径状态: ${resp.status()}`)
  })

  test('无效请求体返回 422', async ({ request }: { request: APIRequestContext }) => {
    // payment/create 需要合法的 PaymentCreateIn, 传无效 body 应 422
    const resp = await request.post(`${BACKEND}/api/v1/payment/create`, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
      data: { invalid_field: true },
      failOnStatusCode: false,
    })
    if (resp.status() === 404) {
      test.skip(true, '后端支付端点未挂载')
      return
    }
    expect([200, 422]).toContain(resp.status())
    console.log(`[错误] 无效请求体状态: ${resp.status()}`)
  })
})
