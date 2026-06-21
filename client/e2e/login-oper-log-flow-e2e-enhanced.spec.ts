/**
 * 登录日志/操作日志链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口）:
 *
 * A. 登录日志 (/system/logininfor/*):
 *   1. 登录日志列表返回 rows 数组
 *   2. 导出登录日志返回 exported:0
 *   3. 账户解锁返回成功消息
 *   4. 登录日志 CRUD (新增/查询/删除)
 *
 * B. 操作日志 (/system/operlog/*):
 *   5. 操作日志列表返回 rows 数组
 *   6. 导出操作日志返回 exported:0
 *   7. 操作日志 CRUD (新增/查询/删除)
 *   8. 清空操作日志返回成功
 *
 * 后端实现:
 * - server/app/api/v1_sys_logininfor.py (真实数据库 CRUD, SysLogininfor 表)
 * - server/app/api/v1_sys_operlog.py (真实数据库 CRUD, SysOperLog 表)
 */

import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test'

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'

function isCodeOk(code: unknown): boolean {
  return code === '0' || code === 0 || code === 200 || code === '200'
}

async function isWafBlocked(resp: APIResponse): Promise<boolean> {
  if (resp.status() !== 403) return false
  try {
    const body = await resp.json()
    return body?.blocked_by === 'rate_limit' || body?.message?.includes('速率限制')
  } catch {
    return false
  }
}

async function isDbUnavailable(resp: APIResponse): Promise<boolean> {
  if (resp.status() !== 500) return false
  try {
    const body = await resp.json()
    return body?.detail === '数据库不可用' || body?.message?.includes('数据库不可用')
  } catch {
    return false
  }
}

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

test.describe('登录日志/操作日志链路端到端联调（增强版）', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 登录日志 ==========

  test('A1. 登录日志列表返回 rows 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/logininfor/list?pageNum=1&pageSize=10', test)
    expect(resp.status(), '登录日志列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `登录日志列表 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.rows, '应返回 rows 数组').toBeDefined()
    expect(Array.isArray(body.rows), 'rows 应为数组').toBe(true)
    expect(body.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A1] 登录日志列表: total=${body.total}, rows.length=${body.rows.length}`)
  })

  test('A2. 导出登录日志返回 exported:0 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/system/logininfor/export', {}, test)
    expect(resp.status(), '导出登录日志应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `导出登录日志 code 应为成功, 实际: ${body.code}`).toBe(true)
    const data = body.data
    expect(data.exported, '导出登录日志应返回 exported:0').toBe(0)
    expect(data.message, '应返回 message').toBeTruthy()
    console.log(`[A2] 导出登录日志: exported=${data.exported}, message=${data.message}`)
  })

  test('A3. 账户解锁返回成功消息 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/logininfor/unlock/test_user_99999', test)
    expect(resp.status(), '账户解锁应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `账户解锁 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.msg, '应返回 msg').toBeTruthy()
    expect(body.msg, 'msg 应包含解锁成功').toContain('解锁成功')
    console.log(`[A3] 账户解锁: msg=${body.msg}`)
  })

  test('A4. 登录日志 CRUD - 新增/查询/删除 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 1. 新增登录日志
    const ts = Date.now()
    const userName = `e2e_login_${ts}`
    const createResp = await safePost(request, '/system/logininfor', {
      userName: userName,
      ipaddr: '127.0.0.1',
      status: '0',
      msg: 'E2E测试登录',
    }, test)
    expect(createResp.status(), '新增登录日志应返回 200').toBe(200)
    const createBody = await createResp.json()
    expect(isCodeOk(createBody.code), `新增登录日志 code 应为成功, 实际: ${createBody.code}`).toBe(true)
    expect(createBody.msg, '新增登录日志 msg 应为新增成功').toContain('新增成功')
    console.log(`[A4-1] 新增登录日志: userName=${userName}`)

    // 2. 查询登录日志列表, 找到刚新增的
    const listResp = await safeGet(request, `/system/logininfor/list?userName=${userName}&pageNum=1&pageSize=10`, test)
    expect(listResp.status(), '查询登录日志列表应返回 200').toBe(200)
    const listBody = await listResp.json()
    expect(listBody.rows.length, '应能查到刚新增的登录日志').toBeGreaterThanOrEqual(1)
    const created = listBody.rows.find((r: { userName: string }) => r.userName === userName)
    expect(created, '新增的登录日志应在列表中').toBeDefined()
    const infoId = created.infoId
    console.log(`[A4-2] 查询登录日志: infoId=${infoId}`)

    // 3. 删除登录日志
    const delResp = await safeDelete(request, `/system/logininfor/${infoId}`, test)
    expect(delResp.status(), '删除登录日志应返回 200').toBe(200)
    const delBody = await delResp.json()
    expect(isCodeOk(delBody.code), `删除登录日志 code 应为成功, 实际: ${delBody.code}`).toBe(true)
    expect(delBody.msg, '删除登录日志 msg 应包含删除成功').toContain('删除成功')
    console.log(`[A4-3] 删除登录日志: msg=${delBody.msg}`)
  })

  // ========== B. 操作日志 ==========

  test('B1. 操作日志列表返回 rows 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/operlog/list?pageNum=1&pageSize=10', test)
    expect(resp.status(), '操作日志列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `操作日志列表 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.rows, '应返回 rows 数组').toBeDefined()
    expect(Array.isArray(body.rows), 'rows 应为数组').toBe(true)
    expect(body.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B1] 操作日志列表: total=${body.total}, rows.length=${body.rows.length}`)
  })

  test('B2. 导出操作日志返回 exported:0 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/system/operlog/export', {}, test)
    expect(resp.status(), '导出操作日志应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `导出操作日志 code 应为成功, 实际: ${body.code}`).toBe(true)
    const data = body.data
    expect(data.exported, '导出操作日志应返回 exported:0').toBe(0)
    expect(data.message, '应返回 message').toBeTruthy()
    console.log(`[B2] 导出操作日志: exported=${data.exported}, message=${data.message}`)
  })

  test('B3. 操作日志 CRUD - 新增/查询/删除 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 1. 新增操作日志
    const ts = Date.now()
    const title = `E2E操作_${ts}`
    const createResp = await safePost(request, '/system/operlog', {
      title: title,
      businessType: 1,
      method: 'E2E.test.method',
      requestMethod: 1,
      operatorType: 1,
      operName: 'e2e_test',
      deptName: '测试部门',
      operUrl: '/e2e/test',
      operIp: '127.0.0.1',
      operParam: '{}',
      jsonResult: '{}',
      status: 0,
      errorMsg: '',
      costTime: 100,
    }, test)
    expect(createResp.status(), '新增操作日志应返回 200').toBe(200)
    const createBody = await createResp.json()
    expect(isCodeOk(createBody.code), `新增操作日志 code 应为成功, 实际: ${createBody.code}`).toBe(true)
    expect(createBody.msg, '新增操作日志 msg 应为新增成功').toContain('新增成功')
    console.log(`[B3-1] 新增操作日志: title=${title}`)

    // 2. 查询操作日志列表, 找到刚新增的
    const listResp = await safeGet(request, `/system/operlog/list?title=${encodeURIComponent(title)}&pageNum=1&pageSize=10`, test)
    expect(listResp.status(), '查询操作日志列表应返回 200').toBe(200)
    const listBody = await listResp.json()
    expect(listBody.rows.length, '应能查到刚新增的操作日志').toBeGreaterThanOrEqual(1)
    const created = listBody.rows.find((r: { title: string }) => r.title === title)
    expect(created, '新增的操作日志应在列表中').toBeDefined()
    const operId = created.operId
    console.log(`[B3-2] 查询操作日志: operId=${operId}`)

    // 3. 删除操作日志
    const delResp = await safeDelete(request, `/system/operlog/${operId}`, test)
    expect(delResp.status(), '删除操作日志应返回 200').toBe(200)
    const delBody = await delResp.json()
    expect(isCodeOk(delBody.code), `删除操作日志 code 应为成功, 实际: ${delBody.code}`).toBe(true)
    expect(delBody.msg, '删除操作日志 msg 应包含删除成功').toContain('删除成功')
    console.log(`[B3-3] 删除操作日志: msg=${delBody.msg}`)
  })

  test('B4. 清空操作日志返回成功 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先新增一条操作日志, 然后清空
    const ts = Date.now()
    await safePost(request, '/system/operlog', {
      title: `E2E清空测试_${ts}`,
      businessType: 0,
      method: 'clean.test',
      status: 0,
    }, test)

    // 清空操作日志
    const resp = await safeDelete(request, '/system/operlog/clean', test)
    expect(resp.status(), '清空操作日志应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `清空操作日志 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.msg, '清空操作日志 msg 应为清空成功').toContain('清空成功')
    console.log(`[B4] 清空操作日志: msg=${body.msg}`)

    // 验证已清空
    const listResp = await safeGet(request, '/system/operlog/list?pageNum=1&pageSize=10', test)
    const listBody = await listResp.json()
    expect(listBody.total, '清空后 total 应为 0').toBe(0)
    console.log(`[B4] 验证已清空: total=${listBody.total}`)
  })
})
