/**
 * 智能体管理链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口）:
 *
 * A. 智能体管理 (/api/v1/agents/*):
 *   1. 智能体列表返回 records 数组
 *   2. 智能体详情返回 agent 对象
 *   3. 创建智能体返回 agent 记录
 *   4. 调用智能体返回 hit:true 和 answer
 *   5. 绑定智能体返回 bound:true
 *
 * B. ZHS Agent管理 (/zhsAgent/*):
 *   6. ZHS Agent 列表返回 records 数组
 *   7. 创建 ZHS Agent 返回 id
 *   8. 查询 ZHS Agent 详情验证创建成功后删除
 *
 * C. Bots (/api/v1/bots/*):
 *   9. Bots 列表返回 records 数组
 *   10. 创建 Bot 记录返回 item (Query 参数)
 *
 * 后端实现:
 * - server/app/api/v1_agents.py (进程内 _STORE_AGENTS)
 * - server/app/api/v1_zhs_agents.py (真实数据库 CRUD, Agent 表)
 * - server/app/api/v1_bots.py (内存存储 bots, Query 参数)
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

test.describe('智能体管理链路端到端联调（增强版）', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 智能体管理 ==========

  test('A1. 智能体列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/agents/list?page=1&size=10', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    expect(typeof body.data.total, 'total 应为数字').toBe('number')
    console.log(`[A1] 智能体列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('A2. 智能体详情返回 agent 对象 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/agents/info?agent_id=1', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.found, 'found 应为 true').toBe(true)
    expect(body.data.agent, 'agent 应存在').toBeTruthy()
    expect(body.data.agent.id, 'agent.id 应为 1').toBe(1)
    console.log(`[A2] 智能体详情: id=${body.data.agent.id}, name=${body.data.agent.name}`)
  })

  test('A3. 创建智能体返回 agent 记录 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const newName = `E2E智能体_${Date.now()}`
    const resp = await safePost(request, '/api/v1/agents/create', {
      name: newName,
      category: 'general',
      description: 'E2E 测试智能体',
      price: 0.0,
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.created, 'created 应为 true').toBe(true)
    expect(body.data.agent, 'agent 应存在').toBeTruthy()
    expect(body.data.agent.name, `agent.name 应为 ${newName}`).toBe(newName)
    console.log(`[A3] 创建智能体: id=${body.data.agent.id}, name=${body.data.agent.name}`)
  })

  test('A4. 调用智能体返回 hit:true 和 answer - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/agents/hit', {
      agent_id: 1,
      user_id: 'e2e_tester',
      query: 'E2E 测试调用智能体',
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.hit, 'hit 应为 true').toBe(true)
    expect(body.data.hit_id, 'hit_id 应存在').toBeTruthy()
    expect(body.data.answer, 'answer 应存在').toBeTruthy()
    console.log(`[A4] 调用智能体: hit=${body.data.hit}, hit_id=${body.data.hit_id}, answer=${body.data.answer.slice(0, 50)}`)
  })

  test('A5. 绑定智能体返回 bound:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/agents/bind', {
      user_id: 'e2e_binder',
      agent_id: 2,
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.bound, 'bound 应为 true').toBe(true)
    expect(body.data.binding, 'binding 应存在').toBeTruthy()
    expect(body.data.binding.agent_id, 'binding.agent_id 应为 2').toBe(2)
    console.log(`[A5] 绑定智能体: bound=${body.data.bound}, agent_id=${body.data.binding.agent_id}`)
  })

  // ========== B. ZHS Agent管理 ==========

  test('B1. ZHS Agent 列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/zhsAgent/list?page_num=1&page_size=10', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data, 'data 应存在').toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    expect(typeof body.data.total, 'total 应为数字').toBe('number')
    console.log(`[B1] ZHS Agent 列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('B2. 创建 ZHS Agent 返回 id - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const agentName = `E2EAgent_${Date.now()}`
    const resp = await safePost(request, '/zhsAgent', {
      name: agentName,
      info: 'E2E 测试 Agent',
      type: 0,
      status: 1,
      consume: 100,
      seqencing: 0,
    }, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.id, 'id 应存在').toBeTruthy()
    expect(typeof body.data.id, 'id 应为字符串').toBe('string')
    console.log(`[B2] 创建 ZHS Agent: id=${body.data.id}, name=${agentName}`)
  })

  test('B3. 查询 ZHS Agent 详情验证创建成功后删除 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先创建
    const agentName = `E2EDetail_${Date.now()}`
    const createResp = await safePost(request, '/zhsAgent', {
      name: agentName,
      info: 'E2E 详情验证',
      type: 0,
      status: 1,
    }, test)
    const createBody = await createResp.json()
    const agentId = createBody.data.id
    console.log(`[B3] 创建 Agent id=${agentId}`)

    // 查询详情
    const detailResp = await safeGet(request, `/zhsAgent/${agentId}`, test)
    expect(detailResp.ok(), `详情状态应为 2xx, 实际 ${detailResp.status()}`).toBeTruthy()
    const detailBody = await detailResp.json()
    expect(isCodeOk(detailBody.code), `详情 code 应为成功, 实际 ${detailBody.code}`).toBeTruthy()
    expect(detailBody.data, '详情 data 应存在').toBeTruthy()
    expect(detailBody.data.id, `详情 id 应为 ${agentId}`).toBe(agentId)
    expect(detailBody.data.name, `详情 name 应为 ${agentName}`).toBe(agentName)
    console.log(`[B3] 查询详情: id=${detailBody.data.id}, name=${detailBody.data.name}`)

    // 更新
    const updateResp = await safePut(request, '/zhsAgent', {
      id: agentId,
      name: `${agentName}_更新`,
    }, test)
    expect(updateResp.ok(), `更新状态应为 2xx, 实际 ${updateResp.status()}`).toBeTruthy()
    const updateBody = await updateResp.json()
    expect(isCodeOk(updateBody.code), `更新 code 应为成功, 实际 ${updateBody.code}`).toBeTruthy()
    console.log(`[B3] 更新 Agent: id=${updateBody.data.id}`)

    // 删除
    const delResp = await safeDelete(request, `/zhsAgent/${agentId}`, test)
    expect(delResp.ok(), `删除状态应为 2xx, 实际 ${delResp.status()}`).toBeTruthy()
    const delBody = await delResp.json()
    expect(isCodeOk(delBody.code), `删除 code 应为成功, 实际 ${delBody.code}`).toBeTruthy()
    expect(delBody.data.deleted, 'deleted 应为 1').toBe(1)
    console.log(`[B3] 删除 Agent: deleted=${delBody.data.deleted}`)
  })

  // ========== C. Bots ==========

  test('C1. Bots 列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/bots/list?page=1&size=20', test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(Array.isArray(body.data.records), 'records 应为数组').toBeTruthy()
    expect(typeof body.data.total, 'total 应为数字').toBe('number')
    console.log(`[C1] Bots 列表: total=${body.data.total}, records=${body.data.records.length}`)
  })

  test('C2. 创建 Bot 记录返回 item (Query 参数) - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const newName = `E2EBot_${Date.now()}`
    const resp = await safePost(request, `/api/v1/bots/create?name=${encodeURIComponent(newName)}&description=E2E`, {}, test)
    expect(resp.ok(), `状态应为 2xx, 实际 ${resp.status()}`).toBeTruthy()
    const body = await resp.json()
    expect(isCodeOk(body.code), `code 应为成功, 实际 ${body.code}`).toBeTruthy()
    expect(body.data.created, 'created 应为 true').toBe(true)
    expect(body.data.item, 'item 应存在').toBeTruthy()
    expect(body.data.item.name, `item.name 应为 ${newName}`).toBe(newName)
    console.log(`[C2] 创建 Bot: id=${body.data.item.id}, name=${body.data.item.name}`)
  })
})
