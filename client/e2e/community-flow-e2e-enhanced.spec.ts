/**
 * 社区/论坛链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口 /api/v1/community/*）:
 *
 * A. 内容查询:
 *   1. 社区帖子列表返回 records 数组
 *   2. 帖子详情返回 records 数组
 *   3. 评论列表返回 records 数组
 *   4. 社区群组返回 records 数组
 *   5. 粉丝列表返回 records 数组
 *   6. 社区动态流返回 records 数组
 *
 * B. 互动操作:
 *   7. 发帖返回 action:true
 *   8. 点赞返回 action:true
 *   9. 评论返回 action:true
 *  10. 关注用户返回 action:true
 *
 * 后端实现: server/app/api/v1_community.py
 * 真实链路验证: GET 接口返回种子数据 (records + total),
 *               POST 接口返回 action:true + at 时间戳
 *
 * 注意: 后端有 WAF 限流 (100次/60秒), 遇到限流自动 skip
 *       v1_community 是占位接口, 所有 GET 返回相同种子数据 (这是后端设计)
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

test.describe('社区/论坛链路端到端联调（增强版）', () => {
  // 串行执行, 减少并发请求触发 WAF 限流
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 内容查询 ==========

  test('A1. 社区帖子列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/community/posts', test)
    expect(resp.status(), '社区帖子列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `社区帖子列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/community/posts')
    expect(data.store_key, '应返回 store_key').toBe('community')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A1] 社区帖子列表: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A2. 帖子详情返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/community/post', test)
    expect(resp.status(), '帖子详情应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `帖子详情 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/community/post')
    expect(data.store_key, '应返回 store_key').toBe('community')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A2] 帖子详情: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A3. 评论列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/community/comments', test)
    expect(resp.status(), '评论列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `评论列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/community/comments')
    expect(data.store_key, '应返回 store_key').toBe('community')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A3] 评论列表: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A4. 社区群组返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/community/groups', test)
    expect(resp.status(), '社区群组应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `社区群组 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/community/groups')
    expect(data.store_key, '应返回 store_key').toBe('community')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A4] 社区群组: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A5. 粉丝列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/community/followers', test)
    expect(resp.status(), '粉丝列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `粉丝列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/community/followers')
    expect(data.store_key, '应返回 store_key').toBe('community')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A5] 粉丝列表: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A6. 社区动态流返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/community/feed', test)
    expect(resp.status(), '社区动态流应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `社区动态流 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/community/feed')
    expect(data.store_key, '应返回 store_key').toBe('community')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A6] 社区动态流: total=${data.total}, records.length=${data.records.length}`)
  })

  // ========== B. 互动操作 ==========

  test('B1. 发帖返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/community/post',
      { title: '测试帖子', content: '这是测试帖子内容', group_id: 1 },
      test
    )
    expect(resp.status(), '发帖应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `发帖 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/community/post')
    expect(data.store_key, '应返回 store_key').toBe('community')
    expect(data.action, '发帖应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B1] 发帖: action=${data.action}, at=${data.at}`)
  })

  test('B2. 点赞返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/community/like',
      { post_id: 1, user_id: 1 },
      test
    )
    expect(resp.status(), '点赞应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `点赞 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/community/like')
    expect(data.store_key, '应返回 store_key').toBe('community')
    expect(data.action, '点赞应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B2] 点赞: action=${data.action}, at=${data.at}`)
  })

  test('B3. 评论返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/community/comment',
      { post_id: 1, content: '测试评论内容', user_id: 1 },
      test
    )
    expect(resp.status(), '评论应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `评论 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/community/comment')
    expect(data.store_key, '应返回 store_key').toBe('community')
    expect(data.action, '评论应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B3] 评论: action=${data.action}, at=${data.at}`)
  })

  test('B4. 关注用户返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/community/follow',
      { follower_id: 1, followee_id: 2 },
      test
    )
    expect(resp.status(), '关注用户应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `关注用户 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/community/follow')
    expect(data.store_key, '应返回 store_key').toBe('community')
    expect(data.action, '关注用户应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B4] 关注用户: action=${data.action}, at=${data.at}`)
  })
})
