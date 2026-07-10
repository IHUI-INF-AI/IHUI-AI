/**
 * 直播/视频链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口）:
 *
 * A. 直播 CRUD (/api/v1/live/*):
 *   1. 直播列表返回 records 数组
 *   2. 直播详情返回 records 数组
 *   3. 创建直播返回 created:true + item
 *   4. 更新直播返回 updated:true + item
 *   5. 删除直播返回 deleted 状态
 *
 * B. 视频预加载 (/api/v1/video_preload/*):
 *   6. 视频预加载列表返回 records 数组
 *   7. 视频预加载操作返回 action:true
 *   8. 查询不存在的视频返回 found:false
 *
 * 后端实现:
 * - server/app/api/v1_live.py (真实 CRUD, create/update/delete 真改数据)
 * - server/app/api/v1_video_preload.py (列表 + 预加载操作 + 详情查询)
 *
 * 真实链路验证:
 * - 直播 CRUD: 创建→验证 item 有 id→更新→验证 updated:true→删除→验证 deleted:true
 * - 视频预加载: GET 返回种子数据, POST 返回 action:true, 详情查询返回 found 状态
 *
 * 注意: 后端有 WAF 限流 (100次/60秒), 遇到限流自动 skip
 *       直播 create/update 用 Query 参数 (不是 JSON body)
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

test.describe('直播/视频链路端到端联调（增强版）', () => {
  // 串行执行, 减少并发请求触发 WAF 限流
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 直播 CRUD ==========

  test('A1. 直播列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/live/list?page=1&size=20', test)
    expect(resp.status(), '直播列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `直播列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/live/list')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A1] 直播列表: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A2. 直播详情返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/live/info', test)
    expect(resp.status(), '直播详情应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `直播详情 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/live/info')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A2] 直播详情: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A3. 创建直播返回 created:true + item - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 直播 create 用 Query 参数 (不是 JSON body)
    const resp = await safePost(
      request,
      '/api/v1/live/create?name=测试直播&description=这是测试直播',
      {},
      test
    )
    expect(resp.status(), '创建直播应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `创建直播 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/live/create')
    expect(data.created, '创建直播应返回 created:true').toBe(true)
    expect(data.item, '应返回 item 对象').toBeDefined()
    expect(data.item.id, 'item 应有 id 字段').toBeDefined()
    expect(data.item.name, 'item.name 应为测试直播').toBe('测试直播')
    expect(data.item.description, 'item.description 应为这是测试直播').toBe('这是测试直播')
    console.log(`[A3] 创建直播: created=${data.created}, item.id=${data.item.id}, item.name=${data.item.name}`)
  })

  test('A4. 更新直播返回 updated:true + item - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先创建一个直播, 拿到 id
    const createResp = await safePost(
      request,
      '/api/v1/live/create?name=更新前直播&description=更新前',
      {},
      test
    )
    const createBody = await createResp.json()
    const itemId = createBody.data.item.id

    // 更新这个直播
    const resp = await safePost(
      request,
      `/api/v1/live/update?item_id=${itemId}&name=更新后直播&description=更新后`,
      {},
      test
    )
    expect(resp.status(), '更新直播应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `更新直播 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/live/update')
    expect(data.updated, '更新直播应返回 updated:true').toBe(true)
    expect(data.item, '应返回 item 对象').toBeDefined()
    expect(data.item.name, 'item.name 应为更新后直播').toBe('更新后直播')
    expect(data.item.description, 'item.description 应为更新后').toBe('更新后')
    console.log(`[A4] 更新直播: updated=${data.updated}, item.id=${data.item.id}, item.name=${data.item.name}`)
  })

  test('A5. 删除直播返回 deleted 状态 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先创建一个直播, 拿到 id
    const createResp = await safePost(
      request,
      '/api/v1/live/create?name=待删除直播&description=待删除',
      {},
      test
    )
    const createBody = await createResp.json()
    const itemId = createBody.data.item.id

    // 删除这个直播
    const resp = await safePost(
      request,
      `/api/v1/live/delete?item_id=${itemId}`,
      {},
      test
    )
    expect(resp.status(), '删除直播应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `删除直播 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/live/delete')
    expect(data.deleted, '删除存在的记录应返回 deleted:true').toBe(true)
    console.log(`[A5] 删除直播: deleted=${data.deleted}, item_id=${itemId}`)
  })

  // ========== B. 视频预加载 ==========

  test('B1. 视频预加载列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/api/v1/video_preload/list?page=1&size=20', test)
    expect(resp.status(), '视频预加载列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `视频预加载列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/video_preload/list')
    expect(data.store_key, '应返回 store_key').toBe('video_preload')
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B1] 视频预加载列表: total=${data.total}, records.length=${data.records.length}`)
  })

  test('B2. 视频预加载操作返回 action:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(
      request,
      '/api/v1/video_preload',
      { vid: 'test_video_001', url: 'https://example.com/video.mp4' },
      test
    )
    expect(resp.status(), '视频预加载操作应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `视频预加载操作 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/video_preload')
    expect(data.store_key, '应返回 store_key').toBe('video_preload')
    expect(data.action, '视频预加载应返回 action:true').toBe(true)
    expect(data.at, '应返回 at 时间戳').toBeTruthy()
    expect(typeof data.at, 'at 应为字符串').toBe('string')
    console.log(`[B2] 视频预加载操作: action=${data.action}, at=${data.at}`)
  })

  test('B3. 查询不存在的视频返回 found:false - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 查询一个不存在的 vid
    const resp = await safeGet(request, '/api/v1/video_preload/nonexistent_vid_99999', test)
    expect(resp.status(), '查询视频应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `查询视频 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.migrated, '应返回 migrated:true').toBe(true)
    expect(data.v1_path, '应返回 v1_path').toBe('/api/v1/video_preload/{vid}')
    expect(data.found, '查询不存在的视频应返回 found:false').toBe(false)
    expect(data.vid, '应返回查询的 vid').toBe('nonexistent_vid_99999')
    console.log(`[B3] 查询不存在视频: found=${data.found}, vid=${data.vid}`)
  })
})
