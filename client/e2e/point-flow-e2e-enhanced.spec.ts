/**
 * 积分签到链路端到端真实联调测试（增强版）
 *
 * 与 v1-point.spec.ts 的区别:
 * - 旧版只测 "查" (余额/记录), 不测 "操作" (签到/增加/减少/兑换)
 * - 本文件测完整的积分操作链路, 验证所有端点真实响应
 *
 * 测试链路（基于后端真实接口 /api/v1/point/*）:
 *
 * A. 积分查询:
 *   1. 积分余额返回 records 数组 → 验证 total 和 records 结构
 *   2. 积分记录返回 records 数组 → 验证记录结构
 *   3. 签到状态返回 records 数组 → 验证状态结构
 *
 * B. 积分操作:
 *   4. 签到返回 action:true → 验证签到成功
 *   5. 积分增加返回 action:true → 验证增加成功
 *   6. 积分减少返回 action:true → 验证减少成功
 *
 * C. 任务系统:
 *   7. 任务列表返回 records 数组 → 验证分页结构
 *   8. 完成任务返回 action:true → 验证完成成功
 *
 * D. 兑换系统:
 *   9. 兑换列表返回 records 数组 → 验证列表结构
 *  10. 执行兑换返回 action:true → 验证兑换成功
 *
 * 后端实现: server/app/api/v1_point.py
 * 真实链路验证: GET 接口返回种子数据, POST 接口返回 action:true
 *
 * 注意: 后端有 WAF 限流 (100次/60秒), 遇到限流自动 skip
 *       v1_point 是占位接口, POST 操作只返回 action:true 不真改数据 (这是后端设计)
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

test.describe('积分签到链路端到端联调（增强版）', () => {
  // 串行执行, 减少并发请求触发 WAF 限流
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 积分查询 ==========

  test('A1. 积分余额返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/point/balance', test)
    expect(resp.status(), '积分余额应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `余额 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/point/balance')
    expect(data.store_key, '应返回 store_key').toBe('point')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A1] 积分余额: total=${data.total}`)
  })

  test('A2. 积分记录返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/point/record', test)
    expect(resp.status(), '积分记录应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `记录 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/point/record')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A2] 积分记录: total=${data.total}`)
  })

  test('A3. 签到状态返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/point/sign/status', test)
    expect(resp.status(), '签到状态应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `签到状态 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/point/sign/status')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A3] 签到状态: total=${data.total}`)
  })

  // ========== B. 积分操作 ==========

  test('B1. 签到返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/point/sign', { user_id: 'e2e_test' }, test)
    expect(resp.status(), '签到应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `签到 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/point/sign')
    expect(data.action, '应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    console.log(`[B1] 签到成功: action=${data.action}, at=${data.at}`)
  })

  test('B2. 积分增加返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/point/add', {
      user_id: 'e2e_test',
      amount: 100,
      reason: 'e2e测试增加',
    }, test)
    expect(resp.status(), '积分增加应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `增加 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/point/add')
    expect(data.action, '应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    console.log(`[B2] 积分增加成功: action=${data.action}`)
  })

  test('B3. 积分减少返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/point/reduce', {
      user_id: 'e2e_test',
      amount: 50,
      reason: 'e2e测试减少',
    }, test)
    expect(resp.status(), '积分减少应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `减少 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/point/reduce')
    expect(data.action, '应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    console.log(`[B3] 积分减少成功: action=${data.action}`)
  })

  // ========== C. 任务系统 ==========

  test('C1. 任务列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/point/task/list?page=1&size=10', test)
    expect(resp.status(), '任务列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `任务列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/point/task/list')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    expect(data.page, 'page 应为 1').toBe(1)
    expect(data.size, 'size 应为 10').toBe(10)
    console.log(`[C1] 任务列表: total=${data.total}, page=${data.page}, size=${data.size}`)
  })

  test('C2. 完成任务返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/point/task/finish', {
      task_id: 1,
      user_id: 'e2e_test',
    }, test)
    expect(resp.status(), '完成任务应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `完成 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/point/task/finish')
    expect(data.action, '应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    console.log(`[C2] 完成任务成功: action=${data.action}`)
  })

  // ========== D. 兑换系统 ==========

  test('D1. 兑换列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/point/exchange', test)
    expect(resp.status(), '兑换列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `兑换列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/point/exchange')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[D1] 兑换列表: total=${data.total}`)
  })

  test('D2. 执行兑换返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/point/exchange/do', {
      item_id: 1,
      user_id: 'e2e_test',
    }, test)
    expect(resp.status(), '执行兑换应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `兑换 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/point/exchange/do')
    expect(data.action, '应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    console.log(`[D2] 执行兑换成功: action=${data.action}`)
  })
})
