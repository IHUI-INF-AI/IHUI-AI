/**
 * 圈子/社区链路端到端真实联调测试（增强版）
 *
 * 与旧版的区别:
 * - 旧版只测一两个端点, 不验证完整链路
 * - 本文件测完整的圈子链路, 验证所有 10 个端点真实响应
 *
 * 测试链路（基于后端真实接口 /api/v1/circle/*）:
 *
 * A. 圈子查询:
 *   1. 圈子列表返回 records 数组
 *   2. 圈子详情返回 records 数组
 *   3. 圈子帖子列表返回 records 数组
 *   4. 热门圈子返回 records 数组
 *   5. 我的圈子返回 records 数组
 *
 * B. 圈子操作:
 *   6. 加入圈子返回 action:true
 *   7. 退出圈子返回 action:true
 *
 * C. 互动操作:
 *   8. 圈子发帖返回 action:true
 *   9. 圈子评论返回 action:true
 *  10. 圈子点赞返回 action:true
 *
 * 后端实现: server/app/api/v1_circle.py
 * 真实链路验证: GET 接口返回种子数据 (records + total),
 *               POST 接口返回 action:true + at 时间戳
 *
 * 注意: 后端有 WAF 限流 (100次/60秒), 遇到限流自动 skip
 *       v1_circle 是占位接口, 所有 GET 返回相同种子数据 (这是后端设计)
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

test.describe('圈子/社区链路端到端联调（增强版）', () => {
  // 串行执行, 减少并发请求触发 WAF 限流
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 圈子查询 ==========

  test('A1. 圈子列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/circle/list?page=1&size=20', test)
    expect(resp.status(), '圈子列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `圈子列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/circle/list')
    expect(data.store_key, '应返回 store_key').toBe('circle')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A1] 圈子列表: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A2. 圈子详情返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/circle/detail', test)
    expect(resp.status(), '圈子详情应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `圈子详情 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/circle/detail')
    expect(data.store_key, '应返回 store_key').toBe('circle')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A2] 圈子详情: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A3. 圈子帖子列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/circle/posts', test)
    expect(resp.status(), '圈子帖子列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `圈子帖子列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/circle/posts')
    expect(data.store_key, '应返回 store_key').toBe('circle')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A3] 圈子帖子列表: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A4. 热门圈子返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/circle/hot', test)
    expect(resp.status(), '热门圈子应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `热门圈子 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/circle/hot')
    expect(data.store_key, '应返回 store_key').toBe('circle')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A4] 热门圈子: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A5. 我的圈子返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/circle/my', test)
    expect(resp.status(), '我的圈子应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `我的圈子 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/circle/my')
    expect(data.store_key, '应返回 store_key').toBe('circle')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A5] 我的圈子: total=${data.total}, records.length=${data.records.length}`)
  })

  // ========== B. 圈子操作 ==========

  test('B1. 加入圈子返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/circle/join', { circle_id: 1 }, test)
    expect(resp.status(), '加入圈子应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `加入圈子 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/circle/join')
    expect(data.store_key, '应返回 store_key').toBe('circle')
    expect(data.action, '加入圈子应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B1] 加入圈子: action=${data.action}, at=${data.at}`)
  })

  test('B2. 退出圈子返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/api/v1/circle/quit', { circle_id: 1 }, test)
    expect(resp.status(), '退出圈子应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `退出圈子 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/circle/quit')
    expect(data.store_key, '应返回 store_key').toBe('circle')
    expect(data.action, '退出圈子应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B2] 退出圈子: action=${data.action}, at=${data.at}`)
  })

  // ========== C. 互动操作 ==========

  test('C1. 圈子发帖返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/circle/post',
      { circle_id: 1, title: '测试帖子', content: '这是测试内容' },
      test
    )
    expect(resp.status(), '圈子发帖应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `圈子发帖 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/circle/post')
    expect(data.store_key, '应返回 store_key').toBe('circle')
    expect(data.action, '圈子发帖应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[C1] 圈子发帖: action=${data.action}, at=${data.at}`)
  })

  test('C2. 圈子评论返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/circle/comment',
      { post_id: 1, content: '测试评论' },
      test
    )
    expect(resp.status(), '圈子评论应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `圈子评论 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/circle/comment')
    expect(data.store_key, '应返回 store_key').toBe('circle')
    expect(data.action, '圈子评论应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[C2] 圈子评论: action=${data.action}, at=${data.at}`)
  })

  test('C3. 圈子点赞返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/circle/like',
      { post_id: 1 },
      test
    )
    expect(resp.status(), '圈子点赞应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `圈子点赞 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/circle/like')
    expect(data.store_key, '应返回 store_key').toBe('circle')
    expect(data.action, '圈子点赞应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[C3] 圈子点赞: action=${data.action}, at=${data.at}`)
  })
})
