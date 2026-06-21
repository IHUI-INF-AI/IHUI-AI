/**
 * 核心业务流程串联测试: 创建订单 → 支付 → 退款完整链路
 *
 * 基于 DDD 订单试点 (p28_order) 的完整状态机:
 *   PENDING → PAID → REFUNDED
 *   PENDING → PAID → SHIPPED → DELIVERED
 *   PENDING → CANCELLED
 *
 * 每个流程都会验证:
 *   1. 每一步操作返回成功
 *   2. 订单状态正确流转
 *   3. 事件历史记录完整
 */
import { test, expect } from '@playwright/test'
import { fetchTokenWithRetry } from './helpers/auth-helper'

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'

let token: string

test.beforeAll(async ({ request }) => {
  token = await fetchTokenWithRetry(request)
  expect(token).toBeTruthy()
})

/** 带认证头的请求配置 */
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra }
}

/** 创建订单, 返回 order_id */
async function createOrder(request: import('@playwright/test').APIRequestContext, userId: string, items: Array<{product_id: string; product_name?: string; unit_price?: string; quantity?: number}> = []): Promise<string> {
  const resp = await request.post(`${BACKEND}/api/p28/orders`, {
    headers: authHeaders(),
    data: { user_id: userId, items },
  })
  expect(resp.status()).toBe(200)
  const body = await resp.json()
  expect(body.code).toBe('0')
  expect(body.data.order_id).toBeTruthy()
  return body.data.order_id
}

/** 查订单详情, 返回订单对象 */
async function getOrder(request: import('@playwright/test').APIRequestContext, orderId: string): Promise<any> {
  const resp = await request.get(`${BACKEND}/api/p28/orders/${orderId}`, { headers: authHeaders() })
  expect(resp.status()).toBe(200)
  const body = await resp.json()
  expect(body.code).toBe('0')
  return body.data
}

/** 查事件历史, 返回事件列表 */
async function getHistory(request: import('@playwright/test').APIRequestContext, orderId: string): Promise<any[]> {
  const resp = await request.get(`${BACKEND}/api/p28/orders/${orderId}/history`, { headers: authHeaders() })
  expect(resp.status()).toBe(200)
  const body = await resp.json()
  expect(body.code).toBe('0')
  return body.data
}

/** 执行订单状态变更操作 (pay/ship/deliver/cancel/refund) */
async function transitionOrder(request: import('@playwright/test').APIRequestContext, orderId: string, action: string): Promise<void> {
  const resp = await request.post(`${BACKEND}/api/p28/orders/${orderId}/${action}`, { headers: authHeaders() })
  expect(resp.status()).toBe(200)
  const body = await resp.json()
  expect(body.code).toBe('0')
}

// ============================================================
// 流程 1: 创建 → 支付 → 退款 (最核心的退款链路)
// ============================================================
test('流程1: 创建订单 → 支付 → 退款 → 验证状态流转', async ({ request }) => {
  // 1. 创建订单
  const orderId = await createOrder(request, 'flow-test-user-1', [
    { product_id: 'p-001', product_name: '测试商品A', unit_price: '99.00', quantity: 2 },
  ])
  // 2. 验证初始状态
  let order = await getOrder(request, orderId)
  expect(order.status).toBe('PENDING')
  // 3. 支付
  await transitionOrder(request, orderId, 'pay')
  order = await getOrder(request, orderId)
  expect(order.status).toBe('PAID')
  // 4. 退款
  await transitionOrder(request, orderId, 'refund')
  order = await getOrder(request, orderId)
  expect(order.status).toBe('REFUNDED')
  // 5. 验证事件历史
  const history = await getHistory(request, orderId)
  expect(history.length).toBeGreaterThanOrEqual(3)
})

// ============================================================
// 流程 2: 创建 → 支付 → 发货 → 送达 (完整发货链路)
// ============================================================
test('流程2: 创建订单 → 支付 → 发货 → 送达 → 验证状态流转', async ({ request }) => {
  const orderId = await createOrder(request, 'flow-test-user-2', [
    { product_id: 'p-002', product_name: '测试商品B', unit_price: '50.00', quantity: 1 },
  ])
  let order = await getOrder(request, orderId)
  expect(order.status).toBe('PENDING')
  await transitionOrder(request, orderId, 'pay')
  order = await getOrder(request, orderId)
  expect(order.status).toBe('PAID')
  await transitionOrder(request, orderId, 'ship')
  order = await getOrder(request, orderId)
  expect(order.status).toBe('SHIPPED')
  await transitionOrder(request, orderId, 'deliver')
  order = await getOrder(request, orderId)
  expect(order.status).toBe('DELIVERED')
  const history = await getHistory(request, orderId)
  expect(history.length).toBeGreaterThanOrEqual(4)
})

// ============================================================
// 流程 3: 创建 → 取消 (取消链路)
// ============================================================
test('流程3: 创建订单 → 取消 → 验证状态流转', async ({ request }) => {
  const orderId = await createOrder(request, 'flow-test-user-3', [
    { product_id: 'p-003', product_name: '测试商品C', unit_price: '10.00', quantity: 5 },
  ])
  let order = await getOrder(request, orderId)
  expect(order.status).toBe('PENDING')
  await transitionOrder(request, orderId, 'cancel')
  order = await getOrder(request, orderId)
  expect(order.status).toBe('CANCELLED')
  const history = await getHistory(request, orderId)
  expect(history.length).toBeGreaterThanOrEqual(2)
})

// ============================================================
// 流程 4: 创建 → 添加行项 → 移除行项 → 验证行项操作
// ============================================================
test('流程4: 创建订单 → 添加行项 → 移除行项 → 验证行项操作', async ({ request }) => {
  const orderId = await createOrder(request, 'flow-test-user-4', [])
  let order = await getOrder(request, orderId)
  expect(order.status).toBe('PENDING')
  // 添加行项
  const addResp = await request.post(`${BACKEND}/api/p28/orders/${orderId}/items`, {
    headers: authHeaders(),
    data: { product_id: 'p-004', product_name: '测试商品D', unit_price: '20.00', quantity: 3 },
  })
  expect(addResp.status()).toBe(200)
  // 移除行项
  const delResp = await request.delete(`${BACKEND}/api/p28/orders/${orderId}/items/p-004`, { headers: authHeaders() })
  expect(delResp.status()).toBe(200)
  const history = await getHistory(request, orderId)
  expect(history.length).toBeGreaterThanOrEqual(3)
})

// ============================================================
// 流程 5: 列出订单 → 验证能查到前面创建的订单
// ============================================================
test('流程5: 列出订单 → 验证订单列表非空', async ({ request }) => {
  // 先创建一个订单确保列表非空
  await createOrder(request, 'flow-test-user-5', [
    { product_id: 'p-005', product_name: '列表测试商品', unit_price: '1.00', quantity: 1 },
  ])
  const resp = await request.get(`${BACKEND}/api/p28/orders?user_id=flow-test-user-5`, { headers: authHeaders() })
  expect(resp.status()).toBe(200)
  const body = await resp.json()
  expect(body.code).toBe('0')
  expect(Array.isArray(body.data)).toBeTruthy()
  expect(body.data.length).toBeGreaterThan(0)
})

// ============================================================
// 流程 6: 非法状态转换 → 验证业务校验 (PENDING 不能直接退款)
// ============================================================
test('流程6: PENDING 状态直接退款 → 验证返回 400 业务校验', async ({ request }) => {
  const orderId = await createOrder(request, 'flow-test-user-6', [
    { product_id: 'p-006', product_name: '校验测试商品', unit_price: '5.00', quantity: 1 },
  ])
  // PENDING 状态直接退款应该失败
  const resp = await request.post(`${BACKEND}/api/p28/orders/${orderId}/refund`, { headers: authHeaders() })
  expect(resp.status()).toBe(400)
})

// ============================================================
// 流程 7: 重复支付 → 验证业务校验 (PAID 不能再次支付)
// ============================================================
test('流程7: PAID 状态重复支付 → 验证返回 400 业务校验', async ({ request }) => {
  const orderId = await createOrder(request, 'flow-test-user-7', [
    { product_id: 'p-007', product_name: '重复支付测试', unit_price: '15.00', quantity: 1 },
  ])
  await transitionOrder(request, orderId, 'pay')
  // 已支付再支付应该失败
  const resp = await request.post(`${BACKEND}/api/p28/orders/${orderId}/pay`, { headers: authHeaders() })
  expect(resp.status()).toBe(400)
})

// ============================================================
// 流程 8: 不存在的订单 → 验证返回 404
// ============================================================
test('流程8: 查询不存在的订单 → 验证返回 404', async ({ request }) => {
  const resp = await request.get(`${BACKEND}/api/p28/orders/non-existent-order-id-xxx`, { headers: authHeaders() })
  expect(resp.status()).toBe(404)
})
