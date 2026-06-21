/**
 * 字典类型/字典数据链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口）:
 *
 * A. 字典类型 (/system/dict/type/*):
 *   1. 字典类型列表返回 rows 数组
 *   2. 查询不存在的字典类型返回 data:null
 *   3. 导出字典类型返回 exported:0
 *   4. optionselect 返回全部字典类型数组
 *   5. 刷新缓存返回成功消息
 *
 * B. 字典数据 (/system/dict/data/*):
 *   6. 字典数据列表返回 rows 数组
 *   7. 按字典类型查询返回 data 数组
 *   8. 查询不存在的字典数据返回 data:null
 *   9. 导出字典数据返回 exported:0
 *  10. 删除不存在的字典数据返回成功消息
 *
 * 后端实现:
 * - server/app/api/v1_sys_dict_type.py (真实数据库 CRUD, SysDictType 表)
 * - server/app/api/v1_sys_dict_data.py (真实数据库 CRUD, SysDictData 表)
 *
 * 真实链路验证:
 * - 列表接口返回 rows 数组 + total (RuoYi TableDataInfo 格式)
 * - 详情查询返回 data:null (不存在) 或 data 对象 (存在)
 * - 导出接口返回 exported:0 (功能跳过)
 * - optionselect 返回 data 数组 (全部字典类型)
 * - 刷新缓存返回成功消息
 *
 * 注意: 后端有 WAF 限流 (100次/60秒), 遇到限流自动 skip
 *       这两个模块是真实数据库操作, 依赖数据库可用
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

/** 判断是否数据库不可用 (500 + 数据库不可用) */
async function isDbUnavailable(resp: APIResponse): Promise<boolean> {
  if (resp.status() !== 500) return false
  try {
    const body = await resp.json()
    return body?.detail === '数据库不可用' || body?.message?.includes('数据库不可用')
  } catch {
    return false
  }
}

/** 统一 GET 请求, 遇到 WAF 限流或数据库不可用自动 skip 测试 */
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

/** 统一 POST 请求, 遇到 WAF 限流或数据库不可用自动 skip 测试 */
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

/** 统一 DELETE 请求, 遇到 WAF 限流或数据库不可用自动 skip 测试 */
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

test.describe('字典类型/字典数据链路端到端联调（增强版）', () => {
  // 串行执行, 减少并发请求触发 WAF 限流
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 字典类型 ==========

  test('A1. 字典类型列表返回 rows 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/dict/type/list?pageNum=1&pageSize=10', test)
    expect(resp.status(), '字典类型列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `字典类型列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    // RuoYi TableDataInfo 格式: {code, msg, rows, total}
    expect(body.rows, '应返回 rows 数组').toBeDefined()
    expect(Array.isArray(body.rows), 'rows 应为数组').toBe(true)
    expect(body.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A1] 字典类型列表: total=${body.total}, rows.length=${body.rows.length}`)
  })

  test('A2. 查询不存在的字典类型返回 data:null - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 查询一个不存在的字典类型 id
    const resp = await safeGet(request, '/system/dict/type/99999', test)
    expect(resp.status(), '查询字典类型应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `查询字典类型 code 应为成功, 实际: ${body.code}`).toBe(true)

    expect(body.data, '查询不存在的字典类型应返回 data:null').toBeNull()
    console.log(`[A2] 查询不存在字典类型: data=${body.data}`)
  })

  test('A3. 导出字典类型返回 exported:0 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/system/dict/type/export', {}, test)
    expect(resp.status(), '导出字典类型应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `导出字典类型 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.exported, '导出字典类型应返回 exported:0').toBe(0)
    expect(data.message, '应返回 message').toBeTruthy()
    console.log(`[A3] 导出字典类型: exported=${data.exported}, message=${data.message}`)
  })

  test('A4. optionselect 返回全部字典类型数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/dict/type/optionselect', test)
    expect(resp.status(), 'optionselect 应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `optionselect code 应为成功, 实际: ${body.code}`).toBe(true)

    // optionselect 返回 data 数组 (全部字典类型, 不分页)
    expect(body.data, '应返回 data 数组').toBeDefined()
    expect(Array.isArray(body.data), 'data 应为数组').toBe(true)
    console.log(`[A4] optionselect: data.length=${body.data.length}`)
  })

  test('A5. 刷新字典类型缓存返回成功消息 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeDelete(request, '/system/dict/type/refreshCache', test)
    expect(resp.status(), '刷新缓存应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `刷新缓存 code 应为成功, 实际: ${body.code}`).toBe(true)

    expect(body.msg, '应返回 msg').toBeTruthy()
    expect(body.msg, 'msg 应包含刷新缓存成功').toContain('刷新缓存成功')
    console.log(`[A5] 刷新字典类型缓存: msg=${body.msg}`)
  })

  // ========== B. 字典数据 ==========

  test('B1. 字典数据列表返回 rows 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/dict/data/list?pageNum=1&pageSize=10', test)
    expect(resp.status(), '字典数据列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `字典数据列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    // RuoYi TableDataInfo 格式: {code, msg, rows, total}
    expect(body.rows, '应返回 rows 数组').toBeDefined()
    expect(Array.isArray(body.rows), 'rows 应为数组').toBe(true)
    expect(body.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B1] 字典数据列表: total=${body.total}, rows.length=${body.rows.length}`)
  })

  test('B2. 按字典类型查询返回 data 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 查询一个不存在的字典类型, 应返回空数组
    const resp = await safeGet(request, '/system/dict/data/type/nonexistent_type_99999', test)
    expect(resp.status(), '按字典类型查询应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `按字典类型查询 code 应为成功, 实际: ${body.code}`).toBe(true)

    // 按字典类型查询返回 data 数组 (不分页)
    expect(body.data, '应返回 data 数组').toBeDefined()
    expect(Array.isArray(body.data), 'data 应为数组').toBe(true)
    console.log(`[B2] 按字典类型查询: data.length=${body.data.length}`)
  })

  test('B3. 查询不存在的字典数据返回 data:null - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 查询一个不存在的字典数据 code
    const resp = await safeGet(request, '/system/dict/data/99999', test)
    expect(resp.status(), '查询字典数据应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `查询字典数据 code 应为成功, 实际: ${body.code}`).toBe(true)

    expect(body.data, '查询不存在的字典数据应返回 data:null').toBeNull()
    console.log(`[B3] 查询不存在字典数据: data=${body.data}`)
  })

  test('B4. 导出字典数据返回 exported:0 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/system/dict/data/export', {}, test)
    expect(resp.status(), '导出字典数据应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `导出字典数据 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.exported, '导出字典数据应返回 exported:0').toBe(0)
    expect(data.message, '应返回 message').toBeTruthy()
    console.log(`[B4] 导出字典数据: exported=${data.exported}, message=${data.message}`)
  })

  test('B5. 删除不存在的字典数据返回成功消息 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 删除一个不存在的字典数据 code, 应返回删除成功 0 条
    const resp = await safeDelete(request, '/system/dict/data/99999', test)
    expect(resp.status(), '删除字典数据应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `删除字典数据 code 应为成功, 实际: ${body.code}`).toBe(true)

    expect(body.msg, '应返回 msg').toBeTruthy()
    expect(body.msg, 'msg 应包含删除成功').toContain('删除成功')
    console.log(`[B5] 删除不存在字典数据: msg=${body.msg}`)
  })
})
