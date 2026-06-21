/**
 * 排行榜/排名链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口 /api/v1/ranking/*）:
 *
 * A. 排行榜查询:
 *   1. 排行榜列表返回 records 数组
 *   2. 用户排行榜返回 records 数组
 *   3. 智能体排行榜返回 records 数组
 *   4. 课程排行榜返回 records 数组
 *   5. 创作者排行榜返回 records 数组
 *
 * B. 专项排行榜:
 *   6. 收入排行榜返回 records 数组
 *   7. 学习排行榜返回 records 数组
 *   8. 贡献排行榜返回 records 数组
 *   9. 周排行榜返回 records 数组
 *
 * C. 排行榜操作:
 *  10. 提交分数返回 action:true
 *
 * 后端实现: server/app/api/v1_ranking.py
 * 真实链路验证: GET 接口返回种子数据 (records + total),
 *               POST 接口返回 action:true + at 时间戳
 *
 * 注意: 后端有 WAF 限流 (100次/60秒), 遇到限流自动 skip
 *       v1_ranking 是占位接口, 所有 GET 返回相同种子数据 (这是后端设计)
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

test.describe('排行榜/排名链路端到端联调（增强版）', () => {
  // 串行执行, 减少并发请求触发 WAF 限流
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 排行榜查询 ==========

  test('A1. 排行榜列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ranking/list?page=1&size=20', test)
    expect(resp.status(), '排行榜列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `排行榜列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ranking/list')
    expect(data.store_key, '应返回 store_key').toBe('ranking')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A1] 排行榜列表: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A2. 用户排行榜返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ranking/user', test)
    expect(resp.status(), '用户排行榜应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `用户排行榜 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ranking/user')
    expect(data.store_key, '应返回 store_key').toBe('ranking')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A2] 用户排行榜: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A3. 智能体排行榜返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ranking/agent', test)
    expect(resp.status(), '智能体排行榜应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `智能体排行榜 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ranking/agent')
    expect(data.store_key, '应返回 store_key').toBe('ranking')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A3] 智能体排行榜: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A4. 课程排行榜返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ranking/course', test)
    expect(resp.status(), '课程排行榜应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `课程排行榜 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ranking/course')
    expect(data.store_key, '应返回 store_key').toBe('ranking')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A4] 课程排行榜: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A5. 创作者排行榜返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ranking/creator', test)
    expect(resp.status(), '创作者排行榜应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `创作者排行榜 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ranking/creator')
    expect(data.store_key, '应返回 store_key').toBe('ranking')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A5] 创作者排行榜: total=${data.total}, records.length=${data.records.length}`)
  })

  // ========== B. 专项排行榜 ==========

  test('B1. 收入排行榜返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ranking/income', test)
    expect(resp.status(), '收入排行榜应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `收入排行榜 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ranking/income')
    expect(data.store_key, '应返回 store_key').toBe('ranking')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B1] 收入排行榜: total=${data.total}, records.length=${data.records.length}`)
  })

  test('B2. 学习排行榜返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ranking/study', test)
    expect(resp.status(), '学习排行榜应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `学习排行榜 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ranking/study')
    expect(data.store_key, '应返回 store_key').toBe('ranking')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B2] 学习排行榜: total=${data.total}, records.length=${data.records.length}`)
  })

  test('B3. 贡献排行榜返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ranking/contribution', test)
    expect(resp.status(), '贡献排行榜应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `贡献排行榜 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ranking/contribution')
    expect(data.store_key, '应返回 store_key').toBe('ranking')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B3] 贡献排行榜: total=${data.total}, records.length=${data.records.length}`)
  })

  test('B4. 周排行榜返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/ranking/weekly', test)
    expect(resp.status(), '周排行榜应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `周排行榜 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ranking/weekly')
    expect(data.store_key, '应返回 store_key').toBe('ranking')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B4] 周排行榜: total=${data.total}, records.length=${data.records.length}`)
  })

  // ========== C. 排行榜操作 ==========

  test('C1. 提交分数返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/ranking/score',
      { user_id: 1, score: 100, type: 'weekly' },
      test
    )
    expect(resp.status(), '提交分数应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `提交分数 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/ranking/score')
    expect(data.store_key, '应返回 store_key').toBe('ranking')
    expect(data.action, '提交分数应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[C1] 提交分数: action=${data.action}, at=${data.at}`)
  })
})
