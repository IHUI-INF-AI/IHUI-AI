/**
 * 用户中心/用户媒体/用户日志链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口）:
 *
 * A. 用户中心 (/api/v1/user-center/*):
 *   1. 用户中心列表返回 records 数组
 *   2. 创建用户中心记录返回 item
 *   3. 查询用户中心列表验证新记录存在
 *   4. 更新用户中心记录返回 payload
 *   5. 删除用户中心记录后查询验证已删除
 *
 * B. 用户媒体 (/api/v1/user-media/*):
 *   6. 用户媒体列表返回 records 数组
 *   7. 创建用户媒体记录返回 item
 *   8. 删除用户媒体记录返回 deleted:true
 *
 * C. 用户日志 (/api/v1/user_comment_log, /api/v1/user_video_log, /api/v1/user_video_comment):
 *   9. 用户日志三类列表都返回 records 数组
 *   10. 用户视频评论业务操作返回 action:true
 *
 * 后端实现:
 * - server/app/api/v1_user_center.py (内存存储 user_center)
 * - server/app/api/v1_user_media.py (内存存储 user_media)
 * - server/app/api/v1_user_log.py (内存存储 user_log)
 * - server/app/services/v1_business_store.py (共享内存 CRUD)
 */

import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test'

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'

function isCodeOk(code: unknown): boolean {
  return code === '0' || code === 0 || code === 200 || code === '200'
}

async function isWafBlocked(resp: APIResponse): Promise<boolean> {
  if (resp.status() !== 403) return false
  try {
    const body = await resp.json()
    return body?.blocked_by === 'rate_limit' || body?.message?.includes('速率限制')
  } catch {
    return false
  }
}

async function isDbUnavailable(resp: APIResponse): Promise<boolean> {
  if (resp.status() !== 500) return false
  try {
    const body = await resp.json()
    return body?.detail === '数据库不可用' || body?.message?.includes('数据库不可用')
  } catch {
    return false
  }
}

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
  if (await isDbUnavailable(resp)) {
    testObj.skip(true, '数据库不可用, 跳过')
    throw new Error('DB unavailable')
  }
  return resp
}

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
  if (await isDbUnavailable(resp)) {
    testObj.skip(true, '数据库不可用, 跳过')
    throw new Error('DB unavailable')
  }
  return resp
}

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
  if (await isDbUnavailable(resp)) {
    testObj.skip(true, '数据库不可用, 跳过')
    throw new Error('DB unavailable')
  }
  return resp
}

test.describe('用户中心/用户媒体/用户日志链路端到端联调（增强版）', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 用户中心 ==========

  test('A1. 用户中心列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/user-center/list?page=1&size=20', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data, 'data 应存在').toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    expect(typeof body.data.total, 'total 应为数字').toBe('number')
    console.log(`[A1] 用户中心列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('A2. 创建用户中心记录返回 item - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const newName = `E2E用户_${Date.now()}`
    const resp = await safePost(request, '/api/v1/user-center/create', {
      name: newName,
      description: 'E2E 测试创建',
      status: 'active',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.created, 'created 应为 true').toBe(true)
    expect(body.data.item, 'item 应存在').toBeTruthy()
    expect(body.data.item.name, `item.name 应为 ${newName}`).toBe(newName)
    expect(typeof body.data.item.id, 'item.id 应为数字').toBe('number')
    console.log(`[A2] 创建用户中心: id=${body.data.item.id}, name=${body.data.item.name}`)
  })

  test('A3. 查询用户中心列表验证新记录存在 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先创建一条
    const newName = `E2E查询_${Date.now()}`
    const createResp = await safePost(request, '/api/v1/user-center/create', {
      name: newName,
      description: 'E2E 查询验证',
      status: 'active',
    }, test)
    const createBody = await createResp.json()
    const createdId = createBody.data.item.id
    console.log(`[A3] 创建 id=${createdId}, name=${newName}`)

    // 查询列表
    const listResp = await safeGet(request, '/api/v1/user-center/list?page=1&size=100', test)
    const listBody = await listResp.json()
    expect(isCodeOk(listBody.code), `列表 code 应为成功, 实际 ${listBody.code}`).toBeTruthy()
    // 验证新记录在列表中
    const found = listBody.data.records.find((r: { id: number; name: string }) => r.id === createdId)
    expect(found, `新记录 id=${createdId} 应在列表中`).toBeTruthy()
    expect(found.name, `新记录 name 应为 ${newName}`).toBe(newName)
    console.log(`[A3] 查询验证: 在列表中找到 id=${createdId}, name=${found.name}`)
  })

  test('A4. 更新用户中心记录返回 payload - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const updateName = `E2E更新_${Date.now()}`
    const resp = await safePost(request, '/api/v1/user-center/update', {
      id: 1,
      name: updateName,
      description: 'E2E 更新测试',
      status: 'inactive',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.updated, 'updated 应为 true').toBe(true)
    expect(body.data.payload, 'payload 应存在').toBeTruthy()
    expect(body.data.payload.name, `payload.name 应为 ${updateName}`).toBe(updateName)
    console.log(`[A4] 更新用户中心: payload.name=${body.data.payload.name}`)
  })

  test('A5. 删除用户中心记录后查询验证已删除 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先创建一条
    const createResp = await safePost(request, '/api/v1/user-center/create', {
      name: `E2E删除_${Date.now()}`,
      description: 'E2E 删除验证',
      status: 'active',
    }, test)
    const createBody = await createResp.json()
    const createdId = createBody.data.item.id
    console.log(`[A5] 创建待删除 id=${createdId}`)

    // 删除
    const delResp = await safePost(request, `/api/v1/user-center/delete?item_id=${createdId}`, {}, test)
    expect(delResp.ok(), `删除状态应为 2xx, 实际 ${delResp.status()}`).toBeTruthy()
    const delBody = await delResp.json()
    expect(isCodeOk(delBody.code), `删除 code 应为成功, 实际 ${delBody.code}`).toBeTruthy()
    expect(delBody.data.deleted, 'deleted 应为 true').toBe(true)
    console.log(`[A5] 删除返回: deleted=${delBody.data.deleted}`)

    // 查询列表验证已删除
    const listResp = await safeGet(request, '/api/v1/user-center/list?page=1&size=100', test)
    const listBody = await listResp.json()
    const stillExists = listBody.data.records.find((r: { id: number }) => r.id === createdId)
    expect(stillExists, `已删除的 id=${createdId} 不应再出现在列表中`).toBeFalsy()
    console.log(`[A5] 删除验证: id=${createdId} 已不在列表中`)
  })

  // ========== B. 用户媒体 ==========

  test('B1. 用户媒体列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/user-media/list?page=1&size=20', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    expect(typeof body.data.total, 'total 应为数字').toBe('number')
    console.log(`[B1] 用户媒体列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('B2. 创建用户媒体记录返回 item - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const newName = `E2E媒体_${Date.now()}`
    const resp = await safePost(request, '/api/v1/user-media/create', {
      name: newName,
      description: 'E2E 媒体创建',
      status: 'active',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.created, 'created 应为 true').toBe(true)
    expect(body.data.item, 'item 应存在').toBeTruthy()
    expect(body.data.item.name, `item.name 应为 ${newName}`).toBe(newName)
    console.log(`[B2] 创建用户媒体: id=${body.data.item.id}, name=${body.data.item.name}`)
  })

  test('B3. 删除用户媒体记录返回 deleted:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先创建一条
    const createResp = await safePost(request, '/api/v1/user-media/create', {
      name: `E2E媒体删除_${Date.now()}`,
      description: 'E2E 媒体删除',
      status: 'active',
    }, test)
    const createBody = await createResp.json()
    const createdId = createBody.data.item.id
    console.log(`[B3] 创建待删除媒体 id=${createdId}`)

    // 删除
    const delResp = await safePost(request, `/api/v1/user-media/delete?item_id=${createdId}`, {}, test)
    expect(delResp.ok(), `删除状态应为 2xx, 实际 ${delResp.status()}`).toBeTruthy()
    const delBody = await delResp.json()
    expect(isCodeOk(delBody.code), `删除 code 应为成功, 实际 ${delBody.code}`).toBeTruthy()
    expect(delBody.data.deleted, 'deleted 应为 true').toBe(true)
    console.log(`[B3] 删除媒体: deleted=${delBody.data.deleted}`)
  })

  // ========== C. 用户日志 ==========

  test('C1. 用户日志三类列表都返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 1. user_comment_log/list
    const resp1 = await safeGet(request, '/api/v1/user_comment_log/list?page=1&size=20', test)
    expect(resp1.ok(), `comment_log 状态应为 2xx, 实际 ${resp1.status()}`).toBeTruthy()
    const body1 = await resp1.json()
    expect(isCodeOk(body1.code), `comment_log code 应为成功, 实际 ${body1.code}`).toBeTruthy()
    expect(Array.isArray(body1.data.records), 'comment_log records 应为数组').toBeTruthy()

    // 2. user_video_log/list
    const resp2 = await safeGet(request, '/api/v1/user_video_log/list?page=1&size=20', test)
    expect(resp2.ok(), `video_log 状态应为 2xx, 实际 ${resp2.status()}`).toBeTruthy()
    const body2 = await resp2.json()
    expect(isCodeOk(body2.code), `video_log code 应为成功, 实际 ${body2.code}`).toBeTruthy()
    expect(Array.isArray(body2.data.records), 'video_log records 应为数组').toBeTruthy()

    // 3. user_video_comment/list
    const resp3 = await safeGet(request, '/api/v1/user_video_comment/list?page=1&size=20', test)
    expect(resp3.ok(), `video_comment 状态应为 2xx, 实际 ${resp3.status()}`).toBeTruthy()
    const body3 = await resp3.json()
    expect(isCodeOk(body3.code), `video_comment code 应为成功, 实际 ${body3.code}`).toBeTruthy()
    expect(Array.isArray(body3.data.records), 'video_comment records 应为数组').toBeTruthy()

    console.log(`[C1] comment_log=${body1.data.records.length}, video_log=${body2.data.records.length}, video_comment=${body3.data.records.length}`)
  })

  test('C2. 用户视频评论业务操作返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/user_video_comment', {
      video_id: 'v_test_1',
      content: 'E2E 测试评论',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.action, 'action 应为 true').toBe(true)
    expect(body.data.at, 'at 应存在（时间戳）').toBeTruthy()
    console.log(`[C2] 视频评论业务操作: action=${body.data.action}, at=${body.data.at}`)
  })

  test('C3. 用户视频日志统计返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/user_video_log/stats', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    expect(typeof body.data.total, 'total 应为数字').toBe('number')
    console.log(`[C3] 视频日志统计: total=${body.data.total}, records=${body.data.records.length}`)
  })
})
