/**
 * 智能体分类/扩展链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口）:
 *
 * A. 智能体分类 (/category/*):
 *   1. 智能体分类列表返回 records 数组
 *   2. 创建智能体分类返回 id
 *   3. 查询智能体分类详情验证创建成功
 *   4. 更新智能体分类后删除验证
 *
 * B. 智能体扩展 (/api/v1/agent_upload, /api/v1/agent_usedetail):
 *   5. 智能体上传列表返回 records 数组
 *   6. 智能体上传业务操作返回 action:true
 *   7. 智能体使用详情统计返回 records 数组
 *
 * C. 远端智能体 (/api/v1/remote-agent/*):
 *   8. 远端智能体列表返回 records 数组
 *   9. 创建远端智能体记录返回 item
 *   10. 删除远端智能体记录返回 deleted:true
 *
 * 后端实现:
 * - server/app/api/v1_agent_category.py (真实数据库 CRUD, AgentCategory 表)
 * - server/app/api/v1_agent_ext.py (内存存储 agent_ext)
 * - server/app/api/v1_remote_agent.py (内存存储 remote_agent)
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

test.describe('智能体分类/扩展链路端到端联调（增强版）', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 智能体分类 ==========

  test('A1. 智能体分类列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/category/list?page_num=1&page_size=10', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data, 'data 应存在').toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    expect(typeof body.data.total, 'total 应为数字').toBe('number')
    console.log(`[A1] 智能体分类列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('A2. 创建智能体分类返回 id - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const catName = `E2E分类_${Date.now()}`
    const resp = await safePost(request, '/category', {
      name: catName,
      field1: '测试',
      field2: '0',
      agent_id: 'test-agent',
      parent_id: '',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.id, 'id 应存在').toBeTruthy()
    console.log(`[A2] 创建智能体分类: id=${body.data.id}, name=${catName}`)
  })

  test('A3. 查询智能体分类详情验证创建成功 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先创建
    const catName = `E2E详情_${Date.now()}`
    const createResp = await safePost(request, '/category', {
      name: catName,
      field1: '详情测试',
      field2: '1',
      agent_id: 'detail-agent',
      parent_id: '',
    }, test)
    const createBody = await createResp.json()
    const catId = createBody.data.id
    console.log(`[A3] 创建分类 id=${catId}`)

    // 查询详情
    const detailResp = await safeGet(request, `/category/${catId}`, test)
    expect(detailResp.ok(), `详情状态应为 2xx, 实际 ${detailResp.status()}`).toBeTruthy()
    const detailBody = await detailResp.json()
    expect(isCodeOk(detailBody.code), `详情 code 应为成功, 实际 ${detailBody.code}`).toBeTruthy()
    expect(detailBody.data, '详情 data 应存在').toBeTruthy()
    expect(detailBody.data.id, `详情 id 应为 ${catId}`).toBe(catId)
    expect(detailBody.data.name, `详情 name 应为 ${catName}`).toBe(catName)
    console.log(`[A3] 查询详情: id=${detailBody.data.id}, name=${detailBody.data.name}`)
  })

  test('A4. 更新智能体分类后删除验证 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先创建
    const catName = `E2E更新_${Date.now()}`
    const createResp = await safePost(request, '/category', {
      name: catName,
      field1: '更新前',
      field2: '0',
    }, test)
    const createBody = await createResp.json()
    const catId = createBody.data.id
    console.log(`[A4] 创建分类 id=${catId}`)

    // 更新
    const updatedName = `E2E更新后_${Date.now()}`
    const updateResp = await safePut(request, '/category', {
      id: catId,
      name: updatedName,
      field1: '更新后',
    }, test)
    expect(updateResp.ok(), `更新状态应为 2xx, 实际 ${updateResp.status()}`).toBeTruthy()
    const updateBody = await updateResp.json()
    expect(isCodeOk(updateBody.code), `更新 code 应为成功, 实际 ${updateBody.code}`).toBeTruthy()
    console.log(`[A4] 更新分类: id=${updateBody.data.id}`)

    // 删除
    const delResp = await safeDelete(request, `/category/${catId}`, test)
    expect(delResp.ok(), `删除状态应为 2xx, 实际 ${delResp.status()}`).toBeTruthy()
    const delBody = await delResp.json()
    expect(isCodeOk(delBody.code), `删除 code 应为成功, 实际 ${delBody.code}`).toBeTruthy()
    expect(delBody.data.deleted, 'deleted 应为 1').toBe(1)
    console.log(`[A4] 删除分类: deleted=${delBody.data.deleted}`)
  })

  // ========== B. 智能体扩展 ==========

  test('B1. 智能体上传列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/agent_upload/list?page=1&size=20', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    expect(typeof body.data.total, 'total 应为数字').toBe('number')
    console.log(`[B1] 智能体上传列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('B2. 智能体上传业务操作返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/agent_upload', {
      agent_id: 'test-agent',
      file_url: 'https://e2e.test/file.pdf',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.action, 'action 应为 true').toBe(true)
    expect(body.data.at, 'at 应存在').toBeTruthy()
    console.log(`[B2] 智能体上传: action=${body.data.action}, at=${body.data.at}`)
  })

  test('B3. 智能体使用详情统计返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/agent_usedetail/stats', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    console.log(`[B3] 智能体使用详情统计: total=${body.data.total}, records=${body.data.records.length}`)
  })

  // ========== C. 远端智能体 ==========

  test('C1. 远端智能体列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/remote-agent/list?page=1&size=20', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    expect(typeof body.data.total, 'total 应为数字').toBe('number')
    console.log(`[C1] 远端智能体列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('C2. 创建远端智能体记录返回 item - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const newName = `E2E远端_${Date.now()}`
    const resp = await safePost(request, '/api/v1/remote-agent/create', {
      name: newName,
      description: 'E2E 远端智能体',
      status: 'active',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.created, 'created 应为 true').toBe(true)
    expect(body.data.item, 'item 应存在').toBeTruthy()
    expect(body.data.item.name, `item.name 应为 ${newName}`).toBe(newName)
    console.log(`[C2] 创建远端智能体: id=${body.data.item.id}, name=${body.data.item.name}`)
  })

  test('C3. 删除远端智能体记录返回 deleted:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先创建
    const createResp = await safePost(request, '/api/v1/remote-agent/create', {
      name: `E2E删除远端_${Date.now()}`,
      description: 'E2E 删除',
      status: 'active',
    }, test)
    const createBody = await createResp.json()
    const createdId = createBody.data.item.id
    console.log(`[C3] 创建待删除 id=${createdId}`)

    // 删除
    const delResp = await safePost(request, `/api/v1/remote-agent/delete?item_id=${createdId}`, {}, test)
    expect(delResp.ok(), `删除状态应为 2xx, 实际 ${delResp.status()}`).toBeTruthy()
    const delBody = await delResp.json()
    expect(isCodeOk(delBody.code), `删除 code 应为成功, 实际 ${delBody.code}`).toBeTruthy()
    expect(delBody.data.deleted, 'deleted 应为 true').toBe(true)
    console.log(`[C3] 删除远端智能体: deleted=${delBody.data.deleted}`)
  })
})
