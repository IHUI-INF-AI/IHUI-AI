/**
 * 教育/考试链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口 /api/v1/edu/*）:
 *
 * A. 教育查询:
 *   1. 学校列表返回 records 数组
 *   2. 学校详情返回 records 数组
 *   3. 专业列表返回 records 数组
 *   4. 专业详情返回 records 数组
 *   5. 课程列表返回 records 数组
 *
 * B. 师生管理:
 *   6. 教师列表返回 records 数组
 *   7. 学生列表返回 records 数组
 *
 * C. 教务操作:
 *   8. 选课报名返回 action:true
 *   9. 成绩查询返回 records 数组
 *  10. 教务通知返回 records 数组
 *
 * 后端实现: server/app/api/v1_education.py
 * 真实链路验证: GET 接口返回种子数据 (records + total),
 *               POST 接口返回 action:true + at 时间戳
 *
 * 注意: 后端有 WAF 限流 (100次/60秒), 遇到限流自动 skip
 *       v1_education 是占位接口, 所有 GET 返回相同种子数据 (这是后端设计)
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

test.describe('教育/考试链路端到端联调（增强版）', () => {
  // 串行执行, 减少并发请求触发 WAF 限流
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 教育查询 ==========

  test('A1. 学校列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/edu/school/list?page=1&size=20', test)
    expect(resp.status(), '学校列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `学校列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/edu/school/list')
    expect(data.store_key, '应返回 store_key').toBe('education')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A1] 学校列表: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A2. 学校详情返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/edu/school', test)
    expect(resp.status(), '学校详情应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `学校详情 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/edu/school')
    expect(data.store_key, '应返回 store_key').toBe('education')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A2] 学校详情: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A3. 专业列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/edu/major/list?page=1&size=20', test)
    expect(resp.status(), '专业列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `专业列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/edu/major/list')
    expect(data.store_key, '应返回 store_key').toBe('education')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A3] 专业列表: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A4. 专业详情返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/edu/major', test)
    expect(resp.status(), '专业详情应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `专业详情 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/edu/major')
    expect(data.store_key, '应返回 store_key').toBe('education')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A4] 专业详情: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A5. 课程列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/edu/course/list?page=1&size=20', test)
    expect(resp.status(), '课程列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `课程列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/edu/course/list')
    expect(data.store_key, '应返回 store_key').toBe('education')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A5] 课程列表: total=${data.total}, records.length=${data.records.length}`)
  })

  // ========== B. 师生管理 ==========

  test('B1. 教师列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/edu/teacher/list?page=1&size=20', test)
    expect(resp.status(), '教师列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `教师列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/edu/teacher/list')
    expect(data.store_key, '应返回 store_key').toBe('education')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B1] 教师列表: total=${data.total}, records.length=${data.records.length}`)
  })

  test('B2. 学生列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/edu/student/list?page=1&size=20', test)
    expect(resp.status(), '学生列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `学生列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/edu/student/list')
    expect(data.store_key, '应返回 store_key').toBe('education')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B2] 学生列表: total=${data.total}, records.length=${data.records.length}`)
  })

  // ========== C. 教务操作 ==========

  test('C1. 选课报名返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/edu/enroll',
      { student_id: 1, course_id: 1, semester: '2026-spring' },
      test
    )
    expect(resp.status(), '选课报名应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `选课报名 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/edu/enroll')
    expect(data.store_key, '应返回 store_key').toBe('education')
    expect(data.action, '选课报名应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[C1] 选课报名: action=${data.action}, at=${data.at}`)
  })

  test('C2. 成绩查询返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/edu/score', test)
    expect(resp.status(), '成绩查询应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `成绩查询 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/edu/score')
    expect(data.store_key, '应返回 store_key').toBe('education')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[C2] 成绩查询: total=${data.total}, records.length=${data.records.length}`)
  })

  test('C3. 教务通知返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/edu/notice', test)
    expect(resp.status(), '教务通知应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `教务通知 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/edu/notice')
    expect(data.store_key, '应返回 store_key').toBe('education')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[C3] 教务通知: total=${data.total}, records.length=${data.records.length}`)
  })
})
