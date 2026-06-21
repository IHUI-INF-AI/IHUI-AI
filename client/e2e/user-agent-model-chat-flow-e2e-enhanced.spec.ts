/**
 * 用户智能体/模型聊天/ZHS用户链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口）:
 *
 * A. 用户智能体 (/api/v1/user_agent_*, /api/v1/agent_need_task):
 *   1. 用户智能体上下文列表返回 records 数组
 *   2. 用户智能体上下文业务操作返回 action:true
 *   3. 用户智能体图片列表返回 records 数组
 *   4. 智能体需求任务列表返回 records 数组
 *
 * B. 用户模型聊天 (/api/v1/user_model_chat):
 *   5. 用户模型聊天列表返回 records 数组
 *   6. 用户模型聊天业务操作返回 action:true
 *   7. 用户模型图片生成业务操作返回 action:true
 *
 * C. ZHS 用户 (/zhs_user/*):
 *   8. ZHS 用户列表返回 records 数组
 *   9. 创建 ZHS 用户返回 id
 *   10. 查询 ZHS 用户详情验证创建成功后删除
 *
 * 后端实现:
 * - server/app/api/v1_user_agent.py (内存存储 user_agent)
 * - server/app/api/v1_user_model_chat.py (内存存储 user_model_chat)
 * - server/app/api/v1_zhs_user.py (真实数据库 CRUD, ZhsUser 表)
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

async function safePut(
  request: APIRequestContext,
  path: string,
  data: unknown,
  testObj: { skip: (condition: boolean, message: string) => void }
): Promise<APIResponse> {
  const resp = await request.put(`${BACKEND}${path}`, {
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

test.describe('用户智能体/模型聊天/ZHS用户链路端到端联调（增强版）', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 用户智能体 ==========

  test('A1. 用户智能体上下文列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/user_agent_context/list?page=1&size=20', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    expect(typeof body.data.total, 'total 应为数字').toBe('number')
    console.log(`[A1] 智能体上下文列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('A2. 用户智能体上下文业务操作返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/user_agent_context', {
      user_uuid: 'test-uuid',
      agent_id: 'agent-1',
      problem: 'E2E 测试问题',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.action, 'action 应为 true').toBe(true)
    expect(body.data.at, 'at 应存在').toBeTruthy()
    console.log(`[A2] 智能体上下文业务操作: action=${body.data.action}, at=${body.data.at}`)
  })

  test('A3. 用户智能体图片列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/user_agent_image/list?page=1&size=20', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    console.log(`[A3] 智能体图片列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('A4. 智能体需求任务列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/agent_need_task/list?page=1&size=20', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    console.log(`[A4] 智能体需求任务列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  // ========== B. 用户模型聊天 ==========

  test('B1. 用户模型聊天列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/user_model_chat/list?page=1&size=20', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    console.log(`[B1] 模型聊天列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('B2. 用户模型聊天业务操作返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/user_model_chat/chat', {
      model: 'gpt-4',
      message: 'E2E 测试聊天',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.action, 'action 应为 true').toBe(true)
    console.log(`[B2] 模型聊天业务操作: action=${body.data.action}`)
  })

  test('B3. 用户模型图片生成业务操作返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/user_model_chat/image', {
      model: 'dall-e',
      prompt: 'E2E 测试图片',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.action, 'action 应为 true').toBe(true)
    console.log(`[B3] 模型图片生成: action=${body.data.action}`)
  })

  // ========== C. ZHS 用户（真实数据库） ==========

  test('C1. ZHS 用户列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/zhs_user/list?page_num=1&page_size=10', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data, 'data 应存在').toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    expect(typeof body.data.total, 'total 应为数字').toBe('number')
    console.log(`[C1] ZHS 用户列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('C2. 创建 ZHS 用户返回 id - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const nick = `E2E用户_${Date.now()}`
    const resp = await safePost(request, '/zhs_user', {
      nickname: nick,
      phone: `138${Date.now().toString().slice(-8)}`,
      status: 1,
      is_vip: 0,
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.id, 'id 应存在且为数字').toBeTruthy()
    expect(typeof body.data.id, 'id 应为数字').toBe('number')
    console.log(`[C2] 创建 ZHS 用户: id=${body.data.id}, nickname=${nick}`)
  })

  test('C3. 查询 ZHS 用户详情验证创建成功后删除 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先创建
    const nick = `E2E详情_${Date.now()}`
    const createResp = await safePost(request, '/zhs_user', {
      nickname: nick,
      phone: `139${Date.now().toString().slice(-8)}`,
      status: 1,
    }, test)
    const createBody = await createResp.json()
    const userId = createBody.data.id
    console.log(`[C3] 创建用户 id=${userId}`)

    // 查询详情
    const detailResp = await safeGet(request, `/zhs_user/${userId}`, test)
    expect(detailResp.ok(), `详情状态应为 2xx, 实际 ${detailResp.status()}`).toBeTruthy()
    const detailBody = await detailResp.json()
    expect(isCodeOk(detailBody.code), `详情 code 应为成功, 实际 ${detailBody.code}`).toBeTruthy()
    expect(detailBody.data, '详情 data 应存在').toBeTruthy()
    expect(detailBody.data.id, `详情 id 应为 ${userId}`).toBe(userId)
    expect(detailBody.data.nickname, `详情 nickname 应为 ${nick}`).toBe(nick)
    console.log(`[C3] 查询详情: id=${detailBody.data.id}, nickname=${detailBody.data.nickname}`)

    // 更新
    const updateResp = await safePut(request, '/zhs_user', {
      id: userId,
      nickname: `${nick}_更新`,
    }, test)
    expect(updateResp.ok(), `更新状态应为 2xx, 实际 ${updateResp.status()}`).toBeTruthy()
    const updateBody = await updateResp.json()
    expect(isCodeOk(updateBody.code), `更新 code 应为成功, 实际 ${updateBody.code}`).toBeTruthy()
    console.log(`[C3] 更新用户: id=${updateBody.data.id}`)

    // 删除
    const delResp = await safeDelete(request, `/zhs_user/${userId}`, test)
    expect(delResp.ok(), `删除状态应为 2xx, 实际 ${delResp.status()}`).toBeTruthy()
    const delBody = await delResp.json()
    expect(isCodeOk(delBody.code), `删除 code 应为成功, 实际 ${delBody.code}`).toBeTruthy()
    expect(delBody.data.deleted, 'deleted 应为 1').toBe(1)
    console.log(`[C3] 删除用户: deleted=${delBody.data.deleted}`)
  })
})
