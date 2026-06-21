/**
 * 通知/消息推送链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口 /api/v1/notification/*）:
 *
 * A. 通知查询:
 *   1. 通知列表返回 records 数组
 *   2. 未读通知返回 records 数组
 *   3. 通知设置返回 records 数组
 *   4. 通知类型返回 records 数组
 *
 * B. 通知操作:
 *   5. 发送通知返回 action:true
 *   6. 标记已读返回 action:true
 *   7. 全部已读返回 action:true
 *   8. 广播通知返回 action:true
 *
 * C. 通知管理:
 *   9. 删除不存在的通知返回 deleted:false
 *  10. 更新通知设置返回 action:true
 *
 * 后端实现: server/app/api/v1_notification.py
 * 真实链路验证: GET 接口返回种子数据 (records + total),
 *               POST 接口返回 action:true + at 时间戳,
 *               DELETE 接口返回 deleted 状态
 *
 * 注意: 后端有 WAF 限流 (100次/60秒), 遇到限流自动 skip
 *       v1_notification 是占位接口, 所有 GET 返回相同种子数据 (这是后端设计)
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

test.describe('通知/消息推送链路端到端联调（增强版）', () => {
  // 串行执行, 减少并发请求触发 WAF 限流
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 通知查询 ==========

  test('A1. 通知列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/notification/list?page=1&size=20', test)
    expect(resp.status(), '通知列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `通知列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/notification/list')
    expect(data.store_key, '应返回 store_key').toBe('notification')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A1] 通知列表: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A2. 未读通知返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/notification/unread', test)
    expect(resp.status(), '未读通知应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `未读通知 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/notification/unread')
    expect(data.store_key, '应返回 store_key').toBe('notification')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A2] 未读通知: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A3. 通知设置返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/notification/settings', test)
    expect(resp.status(), '通知设置应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `通知设置 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/notification/settings')
    expect(data.store_key, '应返回 store_key').toBe('notification')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A3] 通知设置: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A4. 通知类型返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/notification/types', test)
    expect(resp.status(), '通知类型应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `通知类型 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/notification/types')
    expect(data.store_key, '应返回 store_key').toBe('notification')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A4] 通知类型: total=${data.total}, records.length=${data.records.length}`)
  })

  // ========== B. 通知操作 ==========

  test('B1. 发送通知返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/notification/send',
      { user_id: 1, title: '测试通知', content: '这是测试通知内容', type: 'system' },
      test
    )
    expect(resp.status(), '发送通知应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `发送通知 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/notification/send')
    expect(data.store_key, '应返回 store_key').toBe('notification')
    expect(data.action, '发送通知应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B1] 发送通知: action=${data.action}, at=${data.at}`)
  })

  test('B2. 标记已读返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/notification/read',
      { notification_id: 1 },
      test
    )
    expect(resp.status(), '标记已读应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `标记已读 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/notification/read')
    expect(data.store_key, '应返回 store_key').toBe('notification')
    expect(data.action, '标记已读应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B2] 标记已读: action=${data.action}, at=${data.at}`)
  })

  test('B3. 全部已读返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/notification/read-all',
      {},
      test
    )
    expect(resp.status(), '全部已读应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `全部已读 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/notification/read-all')
    expect(data.store_key, '应返回 store_key').toBe('notification')
    expect(data.action, '全部已读应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B3] 全部已读: action=${data.action}, at=${data.at}`)
  })

  test('B4. 广播通知返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/notification/broadcast',
      { title: '广播通知', content: '这是广播内容', type: 'system' },
      test
    )
    expect(resp.status(), '广播通知应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `广播通知 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/notification/broadcast')
    expect(data.store_key, '应返回 store_key').toBe('notification')
    expect(data.action, '广播通知应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B4] 广播通知: action=${data.action}, at=${data.at}`)
  })

  // ========== C. 通知管理 ==========

  test('C1. 删除不存在的通知返回 deleted:false - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 删除 id=99999 (不存在的记录, 应返回 deleted:false)
    const resp = await safePost(
      request,
      '/api/v1/notification/delete?item_id=99999',
      {},
      test
    )
    expect(resp.status(), '删除应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `删除 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/notification/delete')
    expect(data.deleted, '删除不存在的记录应返回 deleted:false').toBe(false)
    console.log(`[C1] 删除不存在通知: deleted=${data.deleted}`)
  })

  test('C2. 更新通知设置返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/notification/settings',
      { push_enabled: true, email_enabled: false, sms_enabled: true },
      test
    )
    expect(resp.status(), '更新通知设置应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `更新通知设置 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/notification/settings')
    expect(data.store_key, '应返回 store_key').toBe('notification')
    expect(data.action, '更新通知设置应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[C2] 更新通知设置: action=${data.action}, at=${data.at}`)
  })
})
