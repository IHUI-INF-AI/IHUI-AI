/**
 * 字典/配置链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口）:
 *
 * A. 字典管理 (/dictionary/*):
 *   1. 字典列表返回 records 数组
 *   2. 资讯类型字典返回数组
 *   3. 查询不存在的字典返回 data:null
 *   4. 导出字典返回 exported:0
 *
 * B. 系统配置 (/system/config/*):
 *   5. 配置列表返回 records 数组
 *   6. 按键名查询配置返回字符串值
 *   7. 查询不存在的配置返回 data:null
 *   8. 导出配置返回 exported:0
 *   9. 刷新缓存返回成功消息
 *  10. 查询不存在的配置键返回空字符串
 *
 * 后端实现:
 * - server/app/api/v1_dictionary.py (真实数据库 CRUD, ZhsDictionary 表)
 * - server/app/api/v1_sys_config.py (真实数据库 CRUD, SysConfig 表)
 *
 * 真实链路验证:
 * - 列表接口返回 records 数组 + total
 * - 详情查询返回 data:null (不存在) 或 data 对象 (存在)
 * - 导出接口返回 exported:0 (功能跳过)
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

test.describe('字典/配置链路端到端联调（增强版）', () => {
  // 串行执行, 减少并发请求触发 WAF 限流
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 字典管理 ==========

  test('A1. 字典列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/dictionary/list?pageNum=1&pageSize=10', test)
    expect(resp.status(), '字典列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `字典列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A1] 字典列表: total=${data.total}, records.length=${data.records.length}`)
  })

  test('A2. 资讯类型字典返回数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/dictionary/getInformationType', test)
    expect(resp.status(), '资讯类型字典应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `资讯类型字典 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data, '应返回 data').toBeDefined()
    expect(Array.isArray(data), 'data 应为数组').toBe(true)
    console.log(`[A2] 资讯类型字典: data.length=${data.length}`)
  })

  test('A3. 查询不存在的字典返回 data:null - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 查询一个不存在的字典 id
    const resp = await safeGet(request, '/dictionary/nonexistent_dict_id_99999', test)
    expect(resp.status(), '查询字典应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `查询字典 code 应为成功, 实际: ${body.code}`).toBe(true)

    expect(body.data, '查询不存在的字典应返回 data:null').toBeNull()
    console.log(`[A3] 查询不存在字典: data=${body.data}`)
  })

  test('A4. 导出字典返回 exported:0 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/dictionary/export', {}, test)
    expect(resp.status(), '导出字典应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `导出字典 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.exported, '导出字典应返回 exported:0').toBe(0)
    expect(data.message, '应返回 message').toBeTruthy()
    console.log(`[A4] 导出字典: exported=${data.exported}, message=${data.message}`)
  })

  // ========== B. 系统配置 ==========

  test('B1. 配置列表返回 rows 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/config/list?pageNum=1&pageSize=10', test)
    expect(resp.status(), '配置列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `配置列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    // RuoYi TableDataInfo 格式: {code, msg, rows, total}
    expect(body.rows, '应返回 rows 数组').toBeDefined()
    expect(Array.isArray(body.rows), 'rows 应为数组').toBe(true)
    expect(body.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B1] 配置列表: total=${body.total}, rows.length=${body.rows.length}`)
  })

  test('B2. 按键名查询配置返回字符串值 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 查询一个不存在的键名, 应返回空字符串
    const resp = await safeGet(request, '/system/config/configKey/nonexistent_key_99999', test)
    expect(resp.status(), '按键名查询配置应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `按键名查询配置 code 应为成功, 实际: ${body.code}`).toBe(true)

    expect(body.data, '查询不存在的键名应返回空字符串').toBe('')
    console.log(`[B2] 按键名查询配置: data="${body.data}"`)
  })

  test('B3. 查询不存在的配置返回 data:null - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 查询一个不存在的配置 id
    const resp = await safeGet(request, '/system/config/99999', test)
    expect(resp.status(), '查询配置应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `查询配置 code 应为成功, 实际: ${body.code}`).toBe(true)

    expect(body.data, '查询不存在的配置应返回 data:null').toBeNull()
    console.log(`[B3] 查询不存在配置: data=${body.data}`)
  })

  test('B4. 导出配置返回 exported:0 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/system/config/export', {}, test)
    expect(resp.status(), '导出配置应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `导出配置 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.exported, '导出配置应返回 exported:0').toBe(0)
    expect(data.message, '应返回 message').toBeTruthy()
    console.log(`[B4] 导出配置: exported=${data.exported}, message=${data.message}`)
  })

  test('B5. 刷新缓存返回成功消息 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeDelete(request, '/system/config/refreshCache', test)
    expect(resp.status(), '刷新缓存应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `刷新缓存 code 应为成功, 实际: ${body.code}`).toBe(true)

    expect(body.msg, '应返回 msg').toBeTruthy()
    expect(body.msg, 'msg 应包含刷新缓存成功').toContain('刷新缓存成功')
    console.log(`[B5] 刷新缓存: msg=${body.msg}`)
  })

  test('B6. 删除不存在的配置返回成功消息 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 删除一个不存在的配置 id, 应返回删除成功 0 条
    const resp = await safeDelete(request, '/system/config/99999', test)
    expect(resp.status(), '删除配置应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `删除配置 code 应为成功, 实际: ${body.code}`).toBe(true)

    expect(body.msg, '应返回 msg').toBeTruthy()
    expect(body.msg, 'msg 应包含删除成功').toContain('删除成功')
    console.log(`[B6] 删除不存在配置: msg=${body.msg}`)
  })
})
