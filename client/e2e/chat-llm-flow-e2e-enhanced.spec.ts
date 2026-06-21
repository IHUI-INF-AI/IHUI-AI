/**
 * 聊天/LLM统一链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口）:
 *
 * A. 聊天 (/api/v1/chat/*):
 *   1. 聊天消息列表返回 records 数组
 *   2. 发送消息业务操作返回 action:true
 *   3. 聊天历史返回 records 数组
 *
 * B. 完整聊天 (/api/v1/chat-full/*):
 *   4. 完整聊天列表返回 records 数组
 *   5. 创建完整聊天记录返回 item
 *   6. 删除完整聊天记录返回 deleted:true
 *
 * C. LLM (/api/v1/llm/*):
 *   7. LLM 模型列表返回 records 数组
 *   8. LLM 聊天业务操作返回 action:true
 *
 * D. LLM统一 (/api/v1/llm-unify/*):
 *   9. LLM统一列表返回 records 数组
 *   10. 创建LLM统一记录返回 item
 *
 * 后端实现:
 * - server/app/api/v1_chat.py (内存存储 chat)
 * - server/app/api/v1_chat_full.py (内存存储 chat_full)
 * - server/app/api/v1_llm.py (内存存储 llm)
 * - server/app/api/v1_llm_unify.py (内存存储 llm_unify)
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

test.describe('聊天/LLM统一链路端到端联调（增强版）', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 聊天 ==========

  test('A1. 聊天消息列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/chat/messages', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    expect(typeof body.data.total, 'total 应为数字').toBe('number')
    console.log(`[A1] 聊天消息列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('A2. 发送消息业务操作返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/chat/send', {
      message: 'E2E 测试消息',
      session_id: 'test-session',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.action, 'action 应为 true').toBe(true)
    expect(body.data.at, 'at 应存在').toBeTruthy()
    console.log(`[A2] 发送消息: action=${body.data.action}, at=${body.data.at}`)
  })

  test('A3. 聊天历史返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/chat/history', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    console.log(`[A3] 聊天历史: total=${body.data.total}, records=${body.data.records.length}`)
  })

  // ========== B. 完整聊天 ==========

  test('B1. 完整聊天列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/chat-full/list?page=1&size=20', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    console.log(`[B1] 完整聊天列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('B2. 创建完整聊天记录返回 item - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const newName = `E2E聊天_${Date.now()}`
    const resp = await safePost(request, '/api/v1/chat-full/create', {
      name: newName,
      description: 'E2E 完整聊天',
      status: 'active',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.created, 'created 应为 true').toBe(true)
    expect(body.data.item.name, `item.name 应为 ${newName}`).toBe(newName)
    console.log(`[B2] 创建完整聊天: id=${body.data.item.id}, name=${body.data.item.name}`)
  })

  test('B3. 删除完整聊天记录返回 deleted:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先创建
    const createResp = await safePost(request, '/api/v1/chat-full/create', {
      name: `E2E删除聊天_${Date.now()}`,
      description: 'E2E 删除',
      status: 'active',
    }, test)
    const createBody = await createResp.json()
    const createdId = createBody.data.item.id
    console.log(`[B3] 创建待删除 id=${createdId}`)

    // 删除
    const delResp = await safePost(request, `/api/v1/chat-full/delete?item_id=${createdId}`, {}, test)
    expect(delResp.ok(), `删除状态应为 2xx, 实际 ${delResp.status()}`).toBeTruthy()
    const delBody = await delResp.json()
    expect(isCodeOk(delBody.code), `删除 code 应为成功, 实际 ${delBody.code}`).toBeTruthy()
    expect(delBody.data.deleted, 'deleted 应为 true').toBe(true)
    console.log(`[B3] 删除完整聊天: deleted=${delBody.data.deleted}`)
  })

  // ========== C. LLM ==========

  test('C1. LLM 模型列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/llm/models', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    console.log(`[C1] LLM 模型列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('C2. LLM 聊天业务操作返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/llm/chat', {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'E2E 测试' }],
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.action, 'action 应为 true').toBe(true)
    console.log(`[C2] LLM 聊天: action=${body.data.action}`)
  })

  // ========== D. LLM统一 ==========

  test('D1. LLM统一列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/llm-unify/list?page=1&size=20', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    console.log(`[D1] LLM统一列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('D2. 创建LLM统一记录返回 item - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const newName = `E2E统一_${Date.now()}`
    const resp = await safePost(request, '/api/v1/llm-unify/create', {
      name: newName,
      description: 'E2E LLM 统一',
      status: 'active',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.created, 'created 应为 true').toBe(true)
    expect(body.data.item.name, `item.name 应为 ${newName}`).toBe(newName)
    console.log(`[D2] 创建LLM统一: id=${body.data.item.id}, name=${body.data.item.name}`)
  })
})
