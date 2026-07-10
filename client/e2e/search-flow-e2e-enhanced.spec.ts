/**
 * 搜索推荐链路端到端真实联调测试（增强版）
 *
 * 与 v1-search.spec.ts 的区别:
 * - 旧版只测 "查" (全局搜索), 不测其他 9 个端点
 * - 本文件测完整的搜索链路, 验证所有端点真实响应
 *
 * 测试链路（基于后端真实接口 /api/v1/search/*）:
 *
 * A. 搜索查询:
 *   1. 全局搜索返回 records 数组
 *   2. Agent 搜索返回 records 数组
 *   3. 课程搜索返回 records 数组
 *   4. 用户搜索返回 records 数组
 *
 * B. 搜索辅助:
 *   5. 热门搜索返回 records 数组
 *   6. 搜索建议返回 records 数组
 *   7. 搜索分类返回 records 数组
 *   8. 搜索索引返回 records 数组
 *
 * C. 搜索历史:
 *   9. 搜索历史返回 records 数组
 *  10. 删除搜索历史返回 deleted 状态
 *
 * 后端实现: server/app/api/v1_search.py
 * 真实链路验证: GET 接口返回种子数据, DELETE 接口返回 deleted 状态
 *
 * 注意: 后端有 WAF 限流 (100次/60秒), 遇到限流自动 skip
 *       v1_search 是占位接口, 所有 GET 返回相同种子数据 (这是后端设计)
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

/** 统一 DELETE 请求, 遇到 WAF 限流自动 skip 测试 */
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
  return resp
}

test.describe('搜索推荐链路端到端联调（增强版）', () => {
  // 串行执行, 减少并发请求触发 WAF 限流
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 搜索查询 ==========

  test('A1. 全局搜索返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/search/global', test)
    expect(resp.status(), '全局搜索应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `全局搜索 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/search/global')
    expect(data.store_key, '应返回 store_key').toBe('search')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A1] 全局搜索: total=${data.total}`)
  })

  test('A2. Agent 搜索返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/search/agent', test)
    expect(resp.status(), 'Agent 搜索应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `Agent 搜索 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/search/agent')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A2] Agent 搜索: total=${data.total}`)
  })

  test('A3. 课程搜索返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/search/course', test)
    expect(resp.status(), '课程搜索应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `课程搜索 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/search/course')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A3] 课程搜索: total=${data.total}`)
  })

  test('A4. 用户搜索返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/search/user', test)
    expect(resp.status(), '用户搜索应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `用户搜索 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/search/user')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A4] 用户搜索: total=${data.total}`)
  })

  // ========== B. 搜索辅助 ==========

  test('B1. 热门搜索返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/search/hot', test)
    expect(resp.status(), '热门搜索应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `热门搜索 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/search/hot')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B1] 热门搜索: total=${data.total}`)
  })

  test('B2. 搜索建议返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/search/suggest', test)
    expect(resp.status(), '搜索建议应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `搜索建议 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/search/suggest')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B2] 搜索建议: total=${data.total}`)
  })

  test('B3. 搜索分类返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/search/category', test)
    expect(resp.status(), '搜索分类应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `搜索分类 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/search/category')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B3] 搜索分类: total=${data.total}`)
  })

  test('B4. 搜索索引返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/search/index', test)
    expect(resp.status(), '搜索索引应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `搜索索引 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/search/index')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B4] 搜索索引: total=${data.total}`)
  })

  // ========== C. 搜索历史 ==========

  test('C1. 搜索历史返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/search/history', test)
    expect(resp.status(), '搜索历史应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `搜索历史 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/search/history')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[C1] 搜索历史: total=${data.total}`)
  })

  test('C2. 删除搜索历史返回 deleted 状态 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 删除 id=99999 (不存在的记录, 应返回 deleted:false)
    const resp = await safeDelete(request, '/api/v1/search/history?item_id=99999', test)
    expect(resp.status(), '删除应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `删除 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/search/history')
    expect(data.deleted, '删除不存在的记录应返回 deleted:false').toBe(false)
    console.log(`[C2] 删除不存在记录: deleted=${data.deleted}`)
  })
})
