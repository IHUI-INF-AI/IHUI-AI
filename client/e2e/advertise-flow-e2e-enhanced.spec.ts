/**
 * 广告/横幅链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口 /api/v1/ad/*）:
 *
 * A. 广告查询:
 *   1. 广告列表返回 records 数组
 *   2. 广告详情返回 records 数组
 *   3. 广告位列表返回 records 数组
 *   4. 活动广告返回 records 数组
 *   5. 广告报表返回 records 数组
 *
 * B. 广告操作:
 *   6. 广告点击返回 action:true
 *   7. 广告上线返回 action:true
 *
 * C. 广告 CRUD:
 *   8. 创建广告返回 created:true + item
 *   9. 更新广告返回 updated:true + payload
 *  10. 删除不存在的广告返回 deleted:false
 *
 * 后端实现: server/app/api/v1_advertise.py
 * 真实链路验证:
 * - GET 接口返回种子数据 (records + total)
 * - POST 业务操作返回 action:true + at 时间戳
 * - CRUD 接口: create 返回 created:true + item, update 返回 updated:true + payload,
 *   delete 返回 deleted 状态 (DELETE 方法)
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

/** 统一 DELETE 请求, 遇到 WAF 限流自动 skip 测试 */
async function safeDelete(
  request: APIRequestContext,
  path: string,
  testObj: { skip: (condition: boolean, message: string) => void }
): Promise<APIResponse> {
  const resp = await request.delete(`${BACKEND}${path}`, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  })
  if (await isWafBlocked(resp)) {
    testObj.skip(true, '被 WAF 限流, 跳过')
    throw new Error('WAF blocked')
  }
  return resp
}

test.describe('广告/横幅链路端到端联调（增强版）', () => {
  // 串行执行, 减少并发请求触发 WAF 限流
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 广告查询 ==========

  test('A1. 广告列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ad/list?page=1&size=20', test)
    expect(resp.status(), '广告列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `广告列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ad/list')
    expect(data.store_key, '应返回 store_key').toBe('advertise')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A1] 广告列表: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A2. 广告详情返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ad/detail', test)
    expect(resp.status(), '广告详情应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `广告详情 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ad/detail')
    expect(data.store_key, '应返回 store_key').toBe('advertise')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A2] 广告详情: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A3. 广告位列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ad/position/list?page=1&size=20', test)
    expect(resp.status(), '广告位列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `广告位列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ad/position/list')
    expect(data.store_key, '应返回 store_key').toBe('advertise')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A3] 广告位列表: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A4. 活动广告返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ad/active', test)
    expect(resp.status(), '活动广告应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `活动广告 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ad/active')
    expect(data.store_key, '应返回 store_key').toBe('advertise')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A4] 活动广告: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A5. 广告报表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ad/report', test)
    expect(resp.status(), '广告报表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `广告报表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ad/report')
    expect(data.store_key, '应返回 store_key').toBe('advertise')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A5] 广告报表: total=${data.total}, records.length=${data.records.length}`)
  })

  // ========== B. 广告操作 ==========

  test('B1. 广告点击返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/ad/click',
      { ad_id: 1, user_id: 1, position: 'home_banner' },
      test
    )
    expect(resp.status(), '广告点击应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `广告点击 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ad/click')
    expect(data.store_key, '应返回 store_key').toBe('advertise')
    expect(data.action, '广告点击应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B1] 广告点击: action=${data.action}, at=${data.at}`)
  })

  test('B2. 广告上线返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/ad/online',
      { ad_id: 1, status: 1 },
      test
    )
    expect(resp.status(), '广告上线应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `广告上线 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ad/online')
    expect(data.store_key, '应返回 store_key').toBe('advertise')
    expect(data.action, '广告上线应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B2] 广告上线: action=${data.action}, at=${data.at}`)
  })

  // ========== C. 广告 CRUD ==========

  test('C1. 创建广告返回 created:true + item - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // CreateBase 要求 name 字段 (必填), description/status 可选
    const resp = await safePost(
      request,
      '/api/v1/ad/create',
      { name: '测试广告', description: '这是测试广告', status: 'active' },
      test
    )
    expect(resp.status(), '创建广告应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `创建广告 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ad/create')
    expect(data.created, '创建广告应返回 created:true').toBe(true)
    expect(data.item, '应返回 item 对象').toBeDefined()
    expect(data.item.id, 'item 应有 id 字段').toBeDefined()
    expect(data.item.name, 'item.name 应为测试广告').toBe('测试广告')
    console.log(`[C1] 创建广告: created=${data.created}, item.id=${data.item.id}, item.name=${data.item.name}`)
  })

  test('C2. 更新广告返回 updated:true + payload - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // UpdateBase 用 name 字段 (可选)
    const resp = await safePost(
      request,
      '/api/v1/ad/update',
      { id: 1, name: '更新后广告', status: 'inactive' },
      test
    )
    expect(resp.status(), '更新广告应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `更新广告 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ad/update')
    expect(data.updated, '更新广告应返回 updated:true').toBe(true)
    expect(data.payload, '应返回 payload 对象').toBeDefined()
    expect(data.payload.name, 'payload.name 应为更新后广告').toBe('更新后广告')
    console.log(`[C2] 更新广告: updated=${data.updated}, payload.name=${data.payload.name}`)
  })

  test('C3. 删除不存在的广告返回 deleted:false - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 删除 id=99999 (不存在的记录, 应返回 deleted:false)
    const resp = await safeDelete(request, '/api/v1/ad/delete?item_id=99999', test)
    expect(resp.status(), '删除广告应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `删除广告 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ad/delete')
    expect(data.deleted, '删除不存在的记录应返回 deleted:false').toBe(false)
    console.log(`[C3] 删除不存在广告: deleted=${data.deleted}`)
  })
})
