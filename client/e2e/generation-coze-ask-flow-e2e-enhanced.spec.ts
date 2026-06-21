/**
 * AI生成/Coze/问答链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口）:
 *
 * A. AI生成 (/api/v1/generation/*):
 *   1. 生成任务列表返回 records 数组
 *   2. 图片生成业务操作返回 action:true
 *   3. 视频生成业务操作返回 action:true
 *   4. 生成风格列表返回 records 数组
 *
 * B. Coze (/api/v1/coze/*):
 *   5. Coze 智能体列表返回 records 数组
 *   6. Coze 聊天业务操作返回 action:true
 *   7. Coze 工作流列表返回 records 数组
 *
 * C. 问答 (/api/v1/ask/*):
 *   8. 问答列表返回 records 数组
 *   9. 创建问答记录返回 item
 *   10. 删除问答记录返回 deleted:true
 *
 * 后端实现:
 * - server/app/api/v1_generation.py (内存存储 generation)
 * - server/app/api/v1_coze.py (内存存储 coze)
 * - server/app/api/v1_ask.py (内存存储 ask)
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

test.describe('AI生成/Coze/问答链路端到端联调（增强版）', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. AI生成 ==========

  test('A1. 生成任务列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/generation/tasks', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    expect(typeof body.data.total, 'total 应为数字').toBe('number')
    console.log(`[A1] 生成任务列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('A2. 图片生成业务操作返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/generation/image', {
      prompt: 'E2E 测试图片生成',
      size: '1024x1024',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.action, 'action 应为 true').toBe(true)
    expect(body.data.at, 'at 应存在').toBeTruthy()
    console.log(`[A2] 图片生成: action=${body.data.action}, at=${body.data.at}`)
  })

  test('A3. 视频生成业务操作返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/generation/video', {
      prompt: 'E2E 测试视频生成',
      duration: 5,
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.action, 'action 应为 true').toBe(true)
    console.log(`[A3] 视频生成: action=${body.data.action}`)
  })

  test('A4. 生成风格列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/generation/styles', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    console.log(`[A4] 生成风格列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  // ========== B. Coze ==========

  test('B1. Coze 智能体列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/coze/agents', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    expect(typeof body.data.total, 'total 应为数字').toBe('number')
    console.log(`[B1] Coze 智能体列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('B2. Coze 聊天业务操作返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/coze/chat', {
      bot_id: 'test-bot',
      message: 'E2E 测试 Coze',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.action, 'action 应为 true').toBe(true)
    expect(body.data.at, 'at 应存在').toBeTruthy()
    console.log(`[B2] Coze 聊天: action=${body.data.action}, at=${body.data.at}`)
  })

  test('B3. Coze 工作流列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/coze/workflows', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    console.log(`[B3] Coze 工作流列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  // ========== C. 问答 ==========

  test('C1. 问答列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ask/list?page=1&size=20', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    console.log(`[C1] 问答列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('C2. 创建问答记录返回 item - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const newName = `E2E问答_${Date.now()}`
    const resp = await safePost(request, '/api/v1/ask/create', {
      name: newName,
      description: 'E2E 问答测试',
      status: 'active',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.created, 'created 应为 true').toBe(true)
    expect(body.data.item, 'item 应存在').toBeTruthy()
    expect(body.data.item.name, `item.name 应为 ${newName}`).toBe(newName)
    console.log(`[C2] 创建问答: id=${body.data.item.id}, name=${body.data.item.name}`)
  })

  test('C3. 删除问答记录返回 deleted:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先创建
    const createResp = await safePost(request, '/api/v1/ask/create', {
      name: `E2E删除问答_${Date.now()}`,
      description: 'E2E 删除',
      status: 'active',
    }, test)
    const createBody = await createResp.json()
    const createdId = createBody.data.item.id
    console.log(`[C3] 创建待删除 id=${createdId}`)

    // 删除
    const delResp = await safePost(request, `/api/v1/ask/delete?item_id=${createdId}`, {}, test)
    expect(delResp.ok(), `删除状态应为 2xx, 实际 ${delResp.status()}`).toBeTruthy()
    const delBody = await delResp.json()
    expect(isCodeOk(delBody.code), `删除 code 应为成功, 实际 ${delBody.code}`).toBeTruthy()
    expect(delBody.data.deleted, 'deleted 应为 true').toBe(true)
    console.log(`[C3] 删除问答: deleted=${delBody.data.deleted}`)
  })
})
