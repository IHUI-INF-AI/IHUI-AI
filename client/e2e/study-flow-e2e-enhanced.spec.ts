/**
 * 学习/签到链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口 /api/v1/study/*）:
 *
 * A. 学习查询:
 *   1. 学习计划返回 records 数组
 *   2. 学习进度返回 records 数组
 *   3. 学习课程返回 records 数组
 *   4. 学习笔记返回 records 数组
 *   5. 学习统计返回 records 数组
 *
 * B. 学习操作:
 *   6. 记录学习行为返回 action:true
 *   7. 创建学习笔记返回 action:true
 *   8. 学习签到返回 action:true
 *
 * C. 学习推荐:
 *   9. 学习排行榜返回 records 数组
 *  10. 学习推荐返回 records 数组
 *
 * 后端实现: server/app/api/v1_study.py
 * 真实链路验证: GET 接口返回种子数据 (records + total),
 *               POST 接口返回 action:true + at 时间戳
 *
 * 注意: 后端有 WAF 限流 (100次/60秒), 遇到限流自动 skip
 *       v1_study 是占位接口, 所有 GET 返回相同种子数据 (这是后端设计)
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

test.describe('学习/签到链路端到端联调（增强版）', () => {
  // 串行执行, 减少并发请求触发 WAF 限流
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 学习查询 ==========

  test('A1. 学习计划返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/study/plan', test)
    expect(resp.status(), '学习计划应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `学习计划 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/study/plan')
    expect(data.store_key, '应返回 store_key').toBe('study')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A1] 学习计划: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A2. 学习进度返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/study/progress', test)
    expect(resp.status(), '学习进度应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `学习进度 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/study/progress')
    expect(data.store_key, '应返回 store_key').toBe('study')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A2] 学习进度: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A3. 学习课程返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/study/courses', test)
    expect(resp.status(), '学习课程应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `学习课程 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/study/courses')
    expect(data.store_key, '应返回 store_key').toBe('study')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A3] 学习课程: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A4. 学习笔记返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/study/notes', test)
    expect(resp.status(), '学习笔记应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `学习笔记 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/study/notes')
    expect(data.store_key, '应返回 store_key').toBe('study')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A4] 学习笔记: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A5. 学习统计返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/study/stats', test)
    expect(resp.status(), '学习统计应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `学习统计 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/study/stats')
    expect(data.store_key, '应返回 store_key').toBe('study')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A5] 学习统计: total=${data.total}, records.length=${data.records.length}`)
  })

  // ========== B. 学习操作 ==========

  test('B1. 记录学习行为返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/study/record',
      { course_id: 1, duration: 30, type: 'video' },
      test
    )
    expect(resp.status(), '记录学习行为应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `记录学习行为 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/study/record')
    expect(data.store_key, '应返回 store_key').toBe('study')
    expect(data.action, '记录学习行为应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B1] 记录学习行为: action=${data.action}, at=${data.at}`)
  })

  test('B2. 创建学习笔记返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/study/note',
      { title: '测试笔记', content: '这是测试笔记内容', course_id: 1 },
      test
    )
    expect(resp.status(), '创建学习笔记应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `创建学习笔记 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/study/note')
    expect(data.store_key, '应返回 store_key').toBe('study')
    expect(data.action, '创建学习笔记应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B2] 创建学习笔记: action=${data.action}, at=${data.at}`)
  })

  test('B3. 学习签到返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/study/checkin',
      { user_id: 1, date: '2026-06-20' },
      test
    )
    expect(resp.status(), '学习签到应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `学习签到 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/study/checkin')
    expect(data.store_key, '应返回 store_key').toBe('study')
    expect(data.action, '学习签到应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B3] 学习签到: action=${data.action}, at=${data.at}`)
  })

  // ========== C. 学习推荐 ==========

  test('C1. 学习排行榜返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/study/leaderboard', test)
    expect(resp.status(), '学习排行榜应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `学习排行榜 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/study/leaderboard')
    expect(data.store_key, '应返回 store_key').toBe('study')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[C1] 学习排行榜: total=${data.total}, records.length=${data.records.length}`)
  })

  test('C2. 学习推荐返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/study/recommend', test)
    expect(resp.status(), '学习推荐应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `学习推荐 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/study/recommend')
    expect(data.store_key, '应返回 store_key').toBe('study')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[C2] 学习推荐: total=${data.total}, records.length=${data.records.length}`)
  })
})
