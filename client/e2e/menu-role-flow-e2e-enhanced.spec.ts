/**
 * 菜单/角色链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口）:
 *
 * A. 菜单管理 (/system/menu/*):
 *   1. 菜单列表返回 data 数组 (不分页)
 *   2. treeselect 返回菜单树 data 数组
 *   3. roleMenuTreeselect 返回 menus + checkedKeys
 *   4. getRouters 返回空数组
 *   5. 查询不存在的菜单返回 data:null
 *
 * B. 角色管理 (/system/role/*):
 *   6. 角色列表返回 rows 数组 (分页)
 *   7. optionselect 返回全部角色数组
 *   8. 查询不存在的角色返回 data:null
 *   9. 导出角色返回 exported:0
 *  10. 角色 CRUD (新增/查询/修改状态/删除)
 *
 * 后端实现:
 * - server/app/api/v1_sys_menu.py (真实数据库 CRUD, SysMenu 表)
 * - server/app/api/v1_sys_role.py (真实数据库 CRUD, SysRole 表)
 *
 * 注意: 后端有 WAF 限流 (100次/60秒), 遇到限流自动 skip
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

test.describe('菜单/角色链路端到端联调（增强版）', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 菜单管理 ==========

  test('A1. 菜单列表返回 data 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/menu/list', test)
    expect(resp.status(), '菜单列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `菜单列表 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data, '应返回 data 数组').toBeDefined()
    expect(Array.isArray(body.data), 'data 应为数组').toBe(true)
    console.log(`[A1] 菜单列表: data.length=${body.data.length}`)
  })

  test('A2. treeselect 返回菜单树 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/menu/treeselect', test)
    expect(resp.status(), 'treeselect 应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `treeselect code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data, '应返回 data 数组').toBeDefined()
    expect(Array.isArray(body.data), 'data 应为数组').toBe(true)
    console.log(`[A2] treeselect: data.length=${body.data.length}`)
  })

  test('A3. roleMenuTreeselect 返回 menus + checkedKeys - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/menu/roleMenuTreeselect/99999', test)
    expect(resp.status(), 'roleMenuTreeselect 应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `roleMenuTreeselect code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data, '应返回 data 对象').toBeDefined()
    expect(body.data.menus, '应返回 menus 数组').toBeDefined()
    expect(Array.isArray(body.data.menus), 'menus 应为数组').toBe(true)
    expect(body.data.checkedKeys, '应返回 checkedKeys 数组').toBeDefined()
    expect(Array.isArray(body.data.checkedKeys), 'checkedKeys 应为数组').toBe(true)
    console.log(`[A3] roleMenuTreeselect: menus.length=${body.data.menus.length}, checkedKeys.length=${body.data.checkedKeys.length}`)
  })

  test('A4. getRouters 返回空数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/menu/getRouters', test)
    expect(resp.status(), 'getRouters 应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `getRouters code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data, '应返回 data 数组').toBeDefined()
    expect(Array.isArray(body.data), 'data 应为数组').toBe(true)
    console.log(`[A4] getRouters: data.length=${body.data.length}`)
  })

  test('A5. 查询不存在的菜单返回 data:null - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/menu/99999', test)
    expect(resp.status(), '查询菜单应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `查询菜单 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data, '查询不存在的菜单应返回 data:null').toBeNull()
    console.log(`[A5] 查询不存在菜单: data=${body.data}`)
  })

  // ========== B. 角色管理 ==========

  test('B1. 角色列表返回 rows 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/role/list?pageNum=1&pageSize=10', test)
    expect(resp.status(), '角色列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `角色列表 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.rows, '应返回 rows 数组').toBeDefined()
    expect(Array.isArray(body.rows), 'rows 应为数组').toBe(true)
    expect(body.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B1] 角色列表: total=${body.total}, rows.length=${body.rows.length}`)
  })

  test('B2. optionselect 返回全部角色数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/role/optionselect', test)
    expect(resp.status(), 'optionselect 应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `optionselect code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data, '应返回 data 数组').toBeDefined()
    expect(Array.isArray(body.data), 'data 应为数组').toBe(true)
    console.log(`[B2] optionselect: data.length=${body.data.length}`)
  })

  test('B3. 查询不存在的角色返回 data:null - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/role/99999', test)
    expect(resp.status(), '查询角色应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `查询角色 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data, '查询不存在的角色应返回 data:null').toBeNull()
    console.log(`[B3] 查询不存在角色: data=${body.data}`)
  })

  test('B4. 导出角色返回 exported:0 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/system/role/export', {}, test)
    expect(resp.status(), '导出角色应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `导出角色 code 应为成功, 实际: ${body.code}`).toBe(true)
    const data = body.data
    expect(data.exported, '导出角色应返回 exported:0').toBe(0)
    expect(data.message, '应返回 message').toBeTruthy()
    console.log(`[B4] 导出角色: exported=${data.exported}, message=${data.message}`)
  })

  test('B5. 角色 CRUD - 新增/查询/修改状态/删除 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 1. 新增角色 (用时间戳保证唯一)
    const ts = Date.now()
    const roleName = `E2E测试角色_${ts}`
    const roleKey = `e2e_test_${ts}`
    const createResp = await safePost(request, '/system/role', {
      role_name: roleName,
      role_key: roleKey,
      role_sort: 999,
      status: '0',
      remark: 'E2E测试自动创建',
    }, test)
    expect(createResp.status(), '新增角色应返回 200').toBe(200)
    const createBody = await createResp.json()
    expect(isCodeOk(createBody.code), `新增角色 code 应为成功, 实际: ${createBody.code}`).toBe(true)
    expect(createBody.msg, '新增角色 msg 应为新增成功').toContain('新增成功')
    console.log(`[B5-1] 新增角色: name=${roleName}, key=${roleKey}`)

    // 2. 查询角色列表, 找到刚新增的角色
    const listResp = await safeGet(request, `/system/role/list?roleName=${encodeURIComponent(roleName)}&pageNum=1&pageSize=10`, test)
    expect(listResp.status(), '查询角色列表应返回 200').toBe(200)
    const listBody = await listResp.json()
    expect(listBody.rows.length, '应能查到刚新增的角色').toBeGreaterThanOrEqual(1)
    const created = listBody.rows.find((r: { roleName: string }) => r.roleName === roleName)
    expect(created, '新增的角色应在列表中').toBeDefined()
    const roleId = created.roleId
    console.log(`[B5-2] 查询角色: roleId=${roleId}`)

    // 3. 修改角色状态 (停用)
    const statusResp = await safePut(request, '/system/role/changeStatus', {
      role_id: roleId,
      status: '1',
    }, test)
    expect(statusResp.status(), '修改角色状态应返回 200').toBe(200)
    const statusBody = await statusResp.json()
    expect(isCodeOk(statusBody.code), `修改角色状态 code 应为成功, 实际: ${statusBody.code}`).toBe(true)
    expect(statusBody.msg, '修改角色状态 msg 应为修改成功').toContain('修改成功')
    console.log(`[B5-3] 修改角色状态: status=1(停用)`)

    // 4. 查询修改后的角色
    const getResp = await safeGet(request, `/system/role/${roleId}`, test)
    expect(getResp.status(), '查询角色应返回 200').toBe(200)
    const getBody = await getResp.json()
    expect(getBody.data.status, '修改后的角色状态应为 1(停用)').toBe('1')
    console.log(`[B5-4] 查询修改后角色: status=${getBody.data.status}`)

    // 5. 删除角色
    const delResp = await safeDelete(request, `/system/role/${roleId}`, test)
    expect(delResp.status(), '删除角色应返回 200').toBe(200)
    const delBody = await delResp.json()
    expect(isCodeOk(delBody.code), `删除角色 code 应为成功, 实际: ${delBody.code}`).toBe(true)
    expect(delBody.msg, '删除角色 msg 应包含删除成功').toContain('删除成功')
    console.log(`[B5-5] 删除角色: msg=${delBody.msg}`)

    // 6. 验证已删除 (软删除, 查询返回 data:null)
    const verifyResp = await safeGet(request, `/system/role/${roleId}`, test)
    expect(verifyResp.status(), '验证删除应返回 200').toBe(200)
    const verifyBody = await verifyResp.json()
    expect(verifyBody.data, '删除后查询应返回 data:null').toBeNull()
    console.log(`[B5-6] 验证已删除: data=${verifyBody.data}`)
  })
})
