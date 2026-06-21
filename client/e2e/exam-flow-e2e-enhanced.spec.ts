/**
 * 考试链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口 /api/v1/exam/*）:
 *
 * A. 考试查询:
 *   1. 试卷列表返回 records 数组
 *   2. 试卷详情返回 records 数组
 *   3. 考试结果返回 records 数组
 *   4. 考试记录返回 records 数组
 *   5. 考试排行榜返回 records 数组
 *   6. 考试分类返回 records 数组
 *
 * B. 考试操作:
 *   7. 开始考试返回 action:true
 *   8. 提交答案返回 action:true
 *   9. 提交试卷返回 action:true
 *
 * C. 试卷管理:
 *  10. 创建试卷返回 created:true + item
 *
 * 后端实现: server/app/api/v1_exam.py
 * 真实链路验证:
 * - GET 接口返回种子数据 (records + total)
 * - POST 业务操作返回 action:true + at 时间戳
 * - 创建试卷返回 created:true + item (真实写入)
 *
 * 注意: 后端有 WAF 限流 (100次/60秒), 遇到限流自动 skip
 *       ExamCreateIn 继承 CreateBase, 要求 name 字段 (必填)
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

test.describe('考试链路端到端联调（增强版）', () => {
  // 串行执行, 减少并发请求触发 WAF 限流
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 考试查询 ==========

  test('A1. 试卷列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/exam/paper/list?page=1&size=20', test)
    expect(resp.status(), '试卷列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `试卷列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/exam/paper/list')
    expect(data.store_key, '应返回 store_key').toBe('exam')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A1] 试卷列表: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A2. 试卷详情返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/exam/paper', test)
    expect(resp.status(), '试卷详情应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `试卷详情 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/exam/paper')
    expect(data.store_key, '应返回 store_key').toBe('exam')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A2] 试卷详情: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A3. 考试结果返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/exam/result', test)
    expect(resp.status(), '考试结果应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `考试结果 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/exam/result')
    expect(data.store_key, '应返回 store_key').toBe('exam')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A3] 考试结果: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A4. 考试记录返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/exam/record', test)
    expect(resp.status(), '考试记录应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `考试记录 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/exam/record')
    expect(data.store_key, '应返回 store_key').toBe('exam')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A4] 考试记录: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A5. 考试排行榜返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/exam/rank', test)
    expect(resp.status(), '考试排行榜应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `考试排行榜 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/exam/rank')
    expect(data.store_key, '应返回 store_key').toBe('exam')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A5] 考试排行榜: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A6. 考试分类返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/exam/category', test)
    expect(resp.status(), '考试分类应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `考试分类 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/exam/category')
    expect(data.store_key, '应返回 store_key').toBe('exam')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A6] 考试分类: total=${data.total}, records.length=${data.records.length}`)
  })

  // ========== B. 考试操作 ==========

  test('B1. 开始考试返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/exam/start',
      { paper_id: 1, user_id: 1 },
      test
    )
    expect(resp.status(), '开始考试应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `开始考试 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/exam/start')
    expect(data.store_key, '应返回 store_key').toBe('exam')
    expect(data.action, '开始考试应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B1] 开始考试: action=${data.action}, at=${data.at}`)
  })

  test('B2. 提交答案返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/exam/answer',
      { paper_id: 1, question_id: 1, answer: 'A', user_id: 1 },
      test
    )
    expect(resp.status(), '提交答案应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `提交答案 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/exam/answer')
    expect(data.store_key, '应返回 store_key').toBe('exam')
    expect(data.action, '提交答案应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B2] 提交答案: action=${data.action}, at=${data.at}`)
  })

  test('B3. 提交试卷返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/exam/submit',
      { paper_id: 1, user_id: 1, answers: [{ question_id: 1, answer: 'A' }] },
      test
    )
    expect(resp.status(), '提交试卷应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `提交试卷 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/exam/submit')
    expect(data.store_key, '应返回 store_key').toBe('exam')
    expect(data.action, '提交试卷应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B3] 提交试卷: action=${data.action}, at=${data.at}`)
  })

  // ========== C. 试卷管理 ==========

  test('C1. 创建试卷返回 created:true + item - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // ExamCreateIn 继承 CreateBase, 要求 name 字段 (必填)
    const resp = await safePost(
      request,
      '/api/v1/exam/paper/create',
      { name: '测试试卷', description: '这是测试试卷', status: 'active' },
      test
    )
    expect(resp.status(), '创建试卷应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `创建试卷 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/exam/paper/create')
    expect(data.created, '创建试卷应返回 created:true').toBe(true)
    expect(data.item, '应返回 item 对象').toBeDefined()
    expect(data.item.id, 'item 应有 id 字段').toBeDefined()
    expect(data.item.name, 'item.name 应为测试试卷').toBe('测试试卷')
    console.log(`[C1] 创建试卷: created=${data.created}, item.id=${data.item.id}, item.name=${data.item.name}`)
  })
})
