/**
 * 用户管理链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口 v1_sys_user.py）:
 *   1. 用户列表返回 rows 数组 (分页)
 *   2. 导出用户返回 exported:0
 *   3. 按用户名查询用户 (info/{username})
 *   4. getInfo (无 user_id) 返回 user:null
 *   5. deptTree 返回 data 数组
 *   6. 查询不存在的用户返回 data:null
 *   7. 获取所有用户列表 (不分页) 返回 data 数组
 *   8. 用户 CRUD - 新增/查询/修改状态/删除
 *   9. 用户授权角色 - authRole 查询返回 roles 数组
 *  10. 重置密码返回成功
 *
 * 后端实现: server/app/api/v1_sys_user.py (真实数据库 CRUD, SysUser 表)
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

async function safePut(
  request: APIRequestContext,
  path: string,
  data: unknown,
  testObj: { skip: (condition: boolean, message: string) => void }
): Promise<APIResponse> {
  const resp = await request.put(`${BACKEND}${path}`, {
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

test.describe('用户管理链路端到端联调（增强版）', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  test('1. 用户列表返回 rows 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/user/list?pageNum=1&pageSize=10', test)
    expect(resp.status(), '用户列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `用户列表 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.rows, '应返回 rows 数组').toBeDefined()
    expect(Array.isArray(body.rows), 'rows 应为数组').toBe(true)
    expect(body.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[1] 用户列表: total=${body.total}, rows.length=${body.rows.length}`)
  })

  test('2. 导出用户返回 exported:0 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/system/user/export', {}, test)
    expect(resp.status(), '导出用户应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `导出用户 code 应为成功, 实际: ${body.code}`).toBe(true)
    const data = body.data
    expect(data.exported, '导出用户应返回 exported:0').toBe(0)
    expect(data.message, '应返回 message').toBeTruthy()
    console.log(`[2] 导出用户: exported=${data.exported}, message=${data.message}`)
  })

  test('3. 按用户名查询用户 (不存在) 返回 data:null - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/user/info/nonexistent_user_99999', test)
    expect(resp.status(), '按用户名查询应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `按用户名查询 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data, '查询不存在的用户应返回 data:null').toBeNull()
    console.log(`[3] 按用户名查询: data=${body.data}`)
  })

  test('4. getInfo (无 user_id) 返回 user:null - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/user/getInfo', test)
    expect(resp.status(), 'getInfo 应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `getInfo code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data.user, '无 user_id 时 user 应为 null').toBeNull()
    expect(body.data.roles, 'roles 应为数组').toEqual([])
    expect(body.data.permissions, 'permissions 应为数组').toEqual([])
    console.log(`[4] getInfo: user=${body.data.user}, roles.length=${body.data.roles.length}`)
  })

  test('5. deptTree 返回 data 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/user/deptTree', test)
    expect(resp.status(), 'deptTree 应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `deptTree code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data, '应返回 data 数组').toBeDefined()
    expect(Array.isArray(body.data), 'data 应为数组').toBe(true)
    console.log(`[5] deptTree: data.length=${body.data.length}`)
  })

  test('6. 查询不存在的用户返回 data:null - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/user/99999', test)
    expect(resp.status(), '查询用户应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `查询用户 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data, '查询不存在的用户应返回 data:null').toBeNull()
    console.log(`[6] 查询不存在用户: data=${body.data}`)
  })

  test('7. 获取所有用户列表 (不分页) 返回 data 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/user', test)
    expect(resp.status(), '获取所有用户应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `获取所有用户 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data, '应返回 data 数组').toBeDefined()
    expect(Array.isArray(body.data), 'data 应为数组').toBe(true)
    console.log(`[7] 所有用户: data.length=${body.data.length}`)
  })

  test('8. 用户 CRUD - 新增/查询/修改状态/删除 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 1. 新增用户 (用时间戳保证唯一)
    const ts = Date.now()
    const userName = `e2e_test_${ts}`
    const createResp = await safePost(request, '/system/user', {
      user_name: userName,
      nick_name: `E2E测试用户_${ts}`,
      email: `e2e_${ts}@test.com`,
      phonenumber: `138${ts.toString().slice(-8)}`,
      sex: '0',
      password: 'test123456',
      status: '0',
      remark: 'E2E测试自动创建',
    }, test)
    expect(createResp.status(), '新增用户应返回 200').toBe(200)
    const createBody = await createResp.json()
    expect(isCodeOk(createBody.code), `新增用户 code 应为成功, 实际: ${createBody.code}`).toBe(true)
    expect(createBody.msg, '新增用户 msg 应为新增成功').toContain('新增成功')
    console.log(`[8-1] 新增用户: userName=${userName}`)

    // 2. 查询用户列表, 找到刚新增的用户
    const listResp = await safeGet(request, `/system/user/list?userName=${userName}&pageNum=1&pageSize=10`, test)
    expect(listResp.status(), '查询用户列表应返回 200').toBe(200)
    const listBody = await listResp.json()
    expect(listBody.rows.length, '应能查到刚新增的用户').toBeGreaterThanOrEqual(1)
    const created = listBody.rows.find((r: { userName: string }) => r.userName === userName)
    expect(created, '新增的用户应在列表中').toBeDefined()
    const userId = created.userId
    console.log(`[8-2] 查询用户: userId=${userId}`)

    // 3. 修改用户状态 (停用)
    const statusResp = await safePut(request, '/system/user/changeStatus', {
      user_id: userId,
      status: '1',
    }, test)
    expect(statusResp.status(), '修改用户状态应返回 200').toBe(200)
    const statusBody = await statusResp.json()
    expect(isCodeOk(statusBody.code), `修改用户状态 code 应为成功, 实际: ${statusBody.code}`).toBe(true)
    expect(statusBody.msg, '修改用户状态 msg 应为操作成功').toContain('操作成功')
    console.log(`[8-3] 修改用户状态: status=1(停用)`)

    // 4. 查询修改后的用户
    const getResp = await safeGet(request, `/system/user/${userId}`, test)
    expect(getResp.status(), '查询用户应返回 200').toBe(200)
    const getBody = await getResp.json()
    expect(getBody.data.status, '修改后的用户状态应为 1(停用)').toBe('1')
    console.log(`[8-4] 查询修改后用户: status=${getBody.data.status}`)

    // 5. 删除用户
    const delResp = await safeDelete(request, `/system/user/${userId}`, test)
    expect(delResp.status(), '删除用户应返回 200').toBe(200)
    const delBody = await delResp.json()
    expect(isCodeOk(delBody.code), `删除用户 code 应为成功, 实际: ${delBody.code}`).toBe(true)
    expect(delBody.msg, '删除用户 msg 应包含删除成功').toContain('删除成功')
    console.log(`[8-5] 删除用户: msg=${delBody.msg}`)

    // 6. 验证已删除 (软删除, 查询返回 data:null)
    const verifyResp = await safeGet(request, `/system/user/${userId}`, test)
    expect(verifyResp.status(), '验证删除应返回 200').toBe(200)
    const verifyBody = await verifyResp.json()
    expect(verifyBody.data, '删除后查询应返回 data:null').toBeNull()
    console.log(`[8-6] 验证已删除: data=${verifyBody.data}`)
  })

  test('9. 用户授权角色查询返回 roles 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 查询一个不存在用户的授权角色, 应返回空 roles 数组
    const resp = await safeGet(request, '/system/user/authRole/99999', test)
    expect(resp.status(), '查询授权角色应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `查询授权角色 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data.roles, '应返回 roles 数组').toBeDefined()
    expect(Array.isArray(body.data.roles), 'roles 应为数组').toBe(true)
    console.log(`[9] 用户授权角色: roles.length=${body.data.roles.length}`)
  })

  test('10. 重置密码返回成功 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 先新增一个用户
    const ts = Date.now()
    const userName = `e2e_pwd_${ts}`
    const createResp = await safePost(request, '/system/user', {
      user_name: userName,
      nick_name: `E2E密码测试_${ts}`,
      password: 'old_pwd',
      status: '0',
    }, test)
    expect(createResp.status(), '新增用户应返回 200').toBe(200)
    const createBody = await createResp.json()
    expect(isCodeOk(createBody.code), `新增用户 code 应为成功, 实际: ${createBody.code}`).toBe(true)

    // 查询用户 id
    const listResp = await safeGet(request, `/system/user/list?userName=${userName}&pageNum=1&pageSize=10`, test)
    const listBody = await listResp.json()
    const userId = listBody.rows[0].userId

    // 重置密码
    const resetResp = await safePut(request, '/system/user/resetPwd', {
      user_id: userId,
      password: 'new_pwd_123',
    }, test)
    expect(resetResp.status(), '重置密码应返回 200').toBe(200)
    const resetBody = await resetResp.json()
    expect(isCodeOk(resetBody.code), `重置密码 code 应为成功, 实际: ${resetBody.code}`).toBe(true)
    expect(resetBody.msg, '重置密码 msg 应为操作成功').toContain('操作成功')
    console.log(`[10] 重置密码: msg=${resetBody.msg}`)

    // 清理: 删除用户
    await safeDelete(request, `/system/user/${userId}`, test)
    console.log(`[10] 清理: 已删除测试用户`)
  })
})
