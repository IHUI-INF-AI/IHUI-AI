/**
 * 客服/工单链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口 /api/v1/customer_service/*）:
 *
 * A. 客服消息:
 *   1. 客服消息列表返回 records 数组
 *   2. 发送客服消息返回 action:true
 *   3. 标记消息已读返回 action:true
 *   4. 常见问题列表返回 records 数组
 *
 * B. 工单查询:
 *   5. 工单列表返回 records 数组
 *   6. 工单详情返回 records 数组
 *   7. 查询不存在的工单返回 found:false
 *
 * C. 工单流转:
 *   8. 创建工单返回 action:true
 *   9. 工单回复返回 action:true
 *  10. 关闭工单返回 action:true
 *  11. 重新打开工单返回 action:true
 *  12. 工单审核返回 action:true
 *  13. 工单分配返回 action:true
 *
 * 后端实现: server/app/api/v1_customer_service.py
 * 真实链路验证:
 * - GET 接口返回种子数据 (records + total)
 * - POST 接口返回 action:true + at 时间戳
 * - 工单详情查询返回 found 状态 (存在/不存在)
 *
 * 注意: 后端有 WAF 限流 (100次/60秒), 遇到限流自动 skip
 */

import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test'

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'

/** 判断 code 是否为成功 (兼容 "0"/0/200/"200") */
function isCodeOk(code: unknown): boolean {
  return code === '0' || code === 0 || code === 200 || code === '200'
}

/** 判断是否被 WAF 限流 (403 + rate_limit) */
async function isWafBlocked(resp: APIResponse): Promise<boolean> {
  if (resp.status() !== 403) return false
  try {
    const body = await resp.json()
    return body?.blocked_by === 'rate_limit' || body?.message?.includes('速率限制')
  } catch {
    return false
  }
}

/** 统一 GET 请求, 遇到 WAF 限流自动 skip 测试 */
async function safeGet(
  request: APIRequestContext,
  path: string,
  testObj: { skip: (condition: boolean, message: string) => void }
): Promise<APIResponse> {
  const resp = await request.get(`${BACKEND}${path}`, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  })
  if (await isWafBlocked(resp)) {
    testObj.skip(true, '被 WAF 限流, 跳过')
    throw new Error('WAF blocked')
  }
  return resp
}

/** 统一 POST 请求, 遇到 WAF 限流自动 skip 测试 */
async function safePost(
  request: APIRequestContext,
  path: string,
  data: unknown,
  testObj: { skip: (condition: boolean, message: string) => void }
): Promise<APIResponse> {
  const resp = await request.post(`${BACKEND}${path}`, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
    data,
  })
  if (await isWafBlocked(resp)) {
    testObj.skip(true, '被 WAF 限流, 跳过')
    throw new Error('WAF blocked')
  }
  return resp
}

test.describe('客服/工单链路端到端联调（增强版）', () => {
  // 串行执行, 减少并发请求触发 WAF 限流
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 客服消息 ==========

  test('A1. 客服消息列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/customer_service/messages', test)
    expect(resp.status(), '客服消息列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `客服消息列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/customer_service/messages')
    expect(data.store_key, '应返回 store_key').toBe('customer_service')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A1] 客服消息列表: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A2. 发送客服消息返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/customer_service/messages',
      { content: '测试客服消息', user_id: 1 },
      test
    )
    expect(resp.status(), '发送客服消息应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `发送客服消息 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/customer_service/messages')
    expect(data.store_key, '应返回 store_key').toBe('customer_service')
    expect(data.action, '发送客服消息应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[A2] 发送客服消息: action=${data.action}, at=${data.at}`)
  })

  test('A3. 标记消息已读返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/customer_service/messages/read',
      { message_id: 1 },
      test
    )
    expect(resp.status(), '标记消息已读应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `标记消息已读 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/customer_service/messages/read')
    expect(data.store_key, '应返回 store_key').toBe('customer_service')
    expect(data.action, '标记消息已读应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[A3] 标记消息已读: action=${data.action}, at=${data.at}`)
  })

  test('A4. 常见问题列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/customer_service/faqs', test)
    expect(resp.status(), '常见问题列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `常见问题列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/customer_service/faqs')
    expect(data.store_key, '应返回 store_key').toBe('customer_service')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A4] 常见问题列表: total=${data.total}, records.length=${data.records.length}`)
  })

  // ========== B. 工单查询 ==========

  test('B1. 工单列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/customer_service/ticket/list?page=1&size=20', test)
    expect(resp.status(), '工单列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `工单列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/customer_service/ticket/list')
    expect(data.store_key, '应返回 store_key').toBe('customer_service')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B1] 工单列表: total=${data.total}, records.length=${data.records.length}`)
  })

  test('B2. 工单详情返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/customer_service/ticket', test)
    expect(resp.status(), '工单详情应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `工单详情 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/customer_service/ticket')
    expect(data.store_key, '应返回 store_key').toBe('customer_service')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B2] 工单详情: total=${data.total}, records.length=${data.records.length}`)
  })

  test('B3. 查询不存在的工单返回 found:false - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 查询一个不存在的工单 id
    const resp = await safeGet(request, '/api/v1/customer_service/ticket/nonexistent_ticket_99999', test)
    expect(resp.status(), '查询工单应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `查询工单 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/customer_service/ticket/{id}')
    expect(data.found, '查询不存在的工单应返回 found:false').toBe(false)
    expect(data.id, '应返回查询的 id').toBe('nonexistent_ticket_99999')
    console.log(`[B3] 查询不存在工单: found=${data.found}, id=${data.id}`)
  })

  // ========== C. 工单流转 ==========

  test('C1. 创建工单返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/customer_service/ticket',
      { title: '测试工单', content: '这是测试工单内容', priority: 'normal' },
      test
    )
    expect(resp.status(), '创建工单应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `创建工单 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/customer_service/ticket')
    expect(data.store_key, '应返回 store_key').toBe('customer_service')
    expect(data.action, '创建工单应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[C1] 创建工单: action=${data.action}, at=${data.at}`)
  })

  test('C2. 工单回复返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/customer_service/ticket/ticket_001/replies',
      { content: '测试回复内容' },
      test
    )
    expect(resp.status(), '工单回复应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `工单回复 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/customer_service/ticket/{id}/replies')
    expect(data.store_key, '应返回 store_key').toBe('customer_service')
    expect(data.action, '工单回复应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[C2] 工单回复: action=${data.action}, at=${data.at}`)
  })

  test('C3. 关闭工单返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/customer_service/ticket/ticket_001/close',
      { reason: '问题已解决' },
      test
    )
    expect(resp.status(), '关闭工单应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `关闭工单 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/customer_service/ticket/{id}/close')
    expect(data.store_key, '应返回 store_key').toBe('customer_service')
    expect(data.action, '关闭工单应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[C3] 关闭工单: action=${data.action}, at=${data.at}`)
  })

  test('C4. 重新打开工单返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/customer_service/ticket/ticket_001/reopen',
      { reason: '问题复现' },
      test
    )
    expect(resp.status(), '重新打开工单应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `重新打开工单 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/customer_service/ticket/{id}/reopen')
    expect(data.store_key, '应返回 store_key').toBe('customer_service')
    expect(data.action, '重新打开工单应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[C4] 重新打开工单: action=${data.action}, at=${data.at}`)
  })

  test('C5. 工单审核返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/customer_service/ticket/ticket_001/audit',
      { status: 'approved', comment: '审核通过' },
      test
    )
    expect(resp.status(), '工单审核应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `工单审核 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/customer_service/ticket/{id}/audit')
    expect(data.store_key, '应返回 store_key').toBe('customer_service')
    expect(data.action, '工单审核应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[C5] 工单审核: action=${data.action}, at=${data.at}`)
  })

  test('C6. 工单分配返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/customer_service/ticket/ticket_001/assign',
      { assignee_id: 100, assignee_name: '客服小张' },
      test
    )
    expect(resp.status(), '工单分配应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `工单分配 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/customer_service/ticket/{id}/assign')
    expect(data.store_key, '应返回 store_key').toBe('customer_service')
    expect(data.action, '工单分配应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[C6] 工单分配: action=${data.action}, at=${data.at}`)
  })
})
