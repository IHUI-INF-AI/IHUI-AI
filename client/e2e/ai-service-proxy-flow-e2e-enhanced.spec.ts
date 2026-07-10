/**
 * AI服务/代理链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口）:
 *
 * A. AI代理 (/api/v1/ai-proxy/*):
 *   1. AI代理列表返回 records 数组
 *   2. 创建AI代理记录返回 item
 *   3. 删除AI代理记录返回 deleted:true
 *
 * B. AI服务扩展 (/api/v1/ai-service-ext/*):
 *   4. AI服务扩展列表返回 records 数组
 *   5. 创建AI服务扩展记录返回 item
 *
 * C. AI特殊能力 (/api/v1/ai-special/*):
 *   6. AI特殊能力列表返回 records 数组
 *   7. 创建AI特殊能力记录返回 item
 *
 * D. AI音频 (/api/v1/ai/audio/*):
 *   8. AI音频列表返回 records 数组
 *   9. 创建AI音频记录返回 item (Query 参数)
 *   10. 更新AI音频记录验证真实写入后删除
 *
 * 后端实现:
 * - server/app/api/v1_ai_proxy.py (内存存储 ai_proxy)
 * - server/app/api/v1_ai_service_ext.py (内存存储 ai_service_ext)
 * - server/app/api/v1_ai_special.py (内存存储 ai_special)
 * - server/app/api/v1_ai_audio.py (内存存储 ai_audio, Query 参数, 真实更新)
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

test.describe('AI服务/代理链路端到端联调（增强版）', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. AI代理 ==========

  test('A1. AI代理列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ai-proxy/list?page=1&size=20', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    expect(typeof body.data.total, 'total 应为数字').toBe('number')
    console.log(`[A1] AI代理列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('A2. 创建AI代理记录返回 item - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const newName = `E2E代理_${Date.now()}`
    const resp = await safePost(request, '/api/v1/ai-proxy/create', {
      name: newName,
      description: 'E2E 测试代理',
      status: 'active',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.created, 'created 应为 true').toBe(true)
    expect(body.data.item, 'item 应存在').toBeTruthy()
    expect(body.data.item.name, `item.name 应为 ${newName}`).toBe(newName)
    console.log(`[A2] 创建AI代理: id=${body.data.item.id}, name=${body.data.item.name}`)
  })

  test('A3. 删除AI代理记录返回 deleted:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先创建
    const createResp = await safePost(request, '/api/v1/ai-proxy/create', {
      name: `E2E删除代理_${Date.now()}`,
      description: 'E2E 删除',
      status: 'active',
    }, test)
    const createBody = await createResp.json()
    const createdId = createBody.data.item.id
    console.log(`[A3] 创建待删除代理 id=${createdId}`)

    // 删除
    const delResp = await safePost(request, `/api/v1/ai-proxy/delete?item_id=${createdId}`, {}, test)
    expect(delResp.ok(), `删除状态应为 2xx, 实际 ${delResp.status()}`).toBeTruthy()
    const delBody = await delResp.json()
    expect(isCodeOk(delBody.code), `删除 code 应为成功, 实际 ${delBody.code}`).toBeTruthy()
    expect(delBody.data.deleted, 'deleted 应为 true').toBe(true)
    console.log(`[A3] 删除代理: deleted=${delBody.data.deleted}`)
  })

  // ========== B. AI服务扩展 ==========

  test('B1. AI服务扩展列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ai-service-ext/list?page=1&size=20', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    console.log(`[B1] AI服务扩展列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('B2. 创建AI服务扩展记录返回 item - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const newName = `E2E扩展_${Date.now()}`
    const resp = await safePost(request, '/api/v1/ai-service-ext/create', {
      name: newName,
      description: 'E2E 扩展服务',
      status: 'active',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.created, 'created 应为 true').toBe(true)
    expect(body.data.item.name, `item.name 应为 ${newName}`).toBe(newName)
    console.log(`[B2] 创建AI服务扩展: id=${body.data.item.id}, name=${body.data.item.name}`)
  })

  // ========== C. AI特殊能力 ==========

  test('C1. AI特殊能力列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ai-special/list?page=1&size=20', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    console.log(`[C1] AI特殊能力列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('C2. 创建AI特殊能力记录返回 item - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const newName = `E2E特殊_${Date.now()}`
    const resp = await safePost(request, '/api/v1/ai-special/create', {
      name: newName,
      description: 'E2E 特殊能力',
      status: 'active',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.created, 'created 应为 true').toBe(true)
    expect(body.data.item.name, `item.name 应为 ${newName}`).toBe(newName)
    console.log(`[C2] 创建AI特殊能力: id=${body.data.item.id}, name=${body.data.item.name}`)
  })

  // ========== D. AI音频 ==========

  test('D1. AI音频列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ai/audio/list?page=1&size=20', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    console.log(`[D1] AI音频列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('D2. 创建AI音频记录返回 item (Query 参数) - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const newName = `E2E音频_${Date.now()}`
    // ai_audio 的 create 用 Query 参数, 不是 JSON body
    const resp = await safePost(request, `/api/v1/ai/audio/create?name=${encodeURIComponent(newName)}&description=E2E`, {}, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.created, 'created 应为 true').toBe(true)
    expect(body.data.item, 'item 应存在').toBeTruthy()
    expect(body.data.item.name, `item.name 应为 ${newName}`).toBe(newName)
    console.log(`[D2] 创建AI音频: id=${body.data.item.id}, name=${body.data.item.name}`)
  })

  test('D3. 更新AI音频记录验证真实写入后删除 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先创建
    const initName = `E2E更新前_${Date.now()}`
    const createResp = await safePost(request, `/api/v1/ai/audio/create?name=${encodeURIComponent(initName)}&description=初始`, {}, test)
    const createBody = await createResp.json()
    const createdId = createBody.data.item.id
    console.log(`[D3] 创建音频 id=${createdId}, name=${initName}`)

    // 更新（真实写入）
    const updatedName = `E2E更新后_${Date.now()}`
    const updateResp = await safePost(request, `/api/v1/ai/audio/update?item_id=${createdId}&name=${encodeURIComponent(updatedName)}&description=已更新`, {}, test)
    expect(updateResp.ok(), `更新状态应为 2xx, 实际 ${updateResp.status()}`).toBeTruthy()
    const updateBody = await updateResp.json()
    expect(isCodeOk(updateBody.code), `更新 code 应为成功, 实际 ${updateBody.code}`).toBeTruthy()
    expect(updateBody.data.updated, 'updated 应为 true').toBe(true)
    expect(updateBody.data.item.name, `更新后 name 应为 ${updatedName}`).toBe(updatedName)
    console.log(`[D3] 更新音频: name=${updateBody.data.item.name}`)

    // 查询列表验证更新生效
    const listResp = await safeGet(request, '/api/v1/ai/audio/list?page=1&size=100', test)
    const listBody = await listResp.json()
    const found = listBody.data.records.find((r: { id: number; name: string }) => r.id === createdId)
    expect(found, `更新后的 id=${createdId} 应在列表中`).toBeTruthy()
    expect(found.name, `列表中 name 应为更新后的 ${updatedName}`).toBe(updatedName)
    console.log(`[D3] 列表验证: id=${createdId}, name=${found.name}`)

    // 删除
    const delResp = await safePost(request, `/api/v1/ai/audio/delete?item_id=${createdId}`, {}, test)
    expect(delResp.ok(), `删除状态应为 2xx, 实际 ${delResp.status()}`).toBeTruthy()
    const delBody = await delResp.json()
    expect(delBody.data.deleted, 'deleted 应为 true').toBe(true)
    console.log(`[D3] 删除音频: deleted=${delBody.data.deleted}`)
  })
})
