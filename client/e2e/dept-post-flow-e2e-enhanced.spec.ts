/**
 * 部门/岗位链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口）:
 *
 * A. 部门管理 (/system/dept/*):
 *   1. 部门列表返回 data 数组 (不分页)
 *   2. 排除指定节点的部门列表返回 data 数组
 *   3. 查询不存在的部门返回 data:null
 *   4. 删除不存在的部门返回成功消息
 *
 * B. 岗位管理 (/system/post/*):
 *   5. 岗位列表返回 rows 数组 (分页)
 *   6. optionselect 返回全部岗位数组
 *   7. 查询不存在的岗位返回 data:null
 *   8. 导出岗位返回 exported:0
 *   9. 删除不存在的岗位返回成功消息
 *  10. 删除岗位 (先新增再删除, 真实 CRUD)
 *
 * 后端实现:
 * - server/app/api/v1_sys_dept.py (真实数据库 CRUD, SysDept 表)
 * - server/app/api/v1_sys_post.py (真实数据库 CRUD, SysPost 表)
 *
 * 真实链路验证:
 * - 部门列表返回 data 数组 (不分页, RuoYi 部门是树形结构)
 * - 岗位列表返回 rows 数组 + total (RuoYi TableDataInfo 格式)
 * - 详情查询返回 data:null (不存在) 或 data 对象 (存在)
 * - 导出接口返回 exported:0 (功能跳过)
 * - optionselect 返回 data 数组 (全部岗位)
 * - 删除接口返回成功消息
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

/** 统一 PUT 请求, 遇到 WAF 限流或数据库不可用自动 skip 测试 */
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

test.describe('部门/岗位链路端到端联调（增强版）', () => {
  // 串行执行, 减少并发请求触发 WAF 限流
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 部门管理 ==========

  test('A1. 部门列表返回 data 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/dept/list', test)
    expect(resp.status(), '部门列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `部门列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    // 部门列表不分页, 返回 data 数组
    expect(body.data, '应返回 data 数组').toBeDefined()
    expect(Array.isArray(body.data), 'data 应为数组').toBe(true)
    console.log(`[A1] 部门列表: data.length=${body.data.length}`)
  })

  test('A2. 排除指定节点的部门列表返回 data 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 排除 dept_id=99999 (不存在的部门), 应返回全部部门
    const resp = await safeGet(request, '/system/dept/list/exclude/99999', test)
    expect(resp.status(), '排除部门列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `排除部门列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    expect(body.data, '应返回 data 数组').toBeDefined()
    expect(Array.isArray(body.data), 'data 应为数组').toBe(true)
    console.log(`[A2] 排除部门列表: data.length=${body.data.length}`)
  })

  test('A3. 查询不存在的部门返回 data:null - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/dept/99999', test)
    expect(resp.status(), '查询部门应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `查询部门 code 应为成功, 实际: ${body.code}`).toBe(true)

    expect(body.data, '查询不存在的部门应返回 data:null').toBeNull()
    console.log(`[A3] 查询不存在部门: data=${body.data}`)
  })

  test('A4. 删除不存在的部门返回成功消息 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 删除一个不存在的部门 id, 应返回删除成功
    const resp = await safeDelete(request, '/system/dept/99999', test)
    expect(resp.status(), '删除部门应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `删除部门 code 应为成功, 实际: ${body.code}`).toBe(true)

    expect(body.msg, '应返回 msg').toBeTruthy()
    console.log(`[A4] 删除不存在部门: msg=${body.msg}`)
  })

  // ========== B. 岗位管理 ==========

  test('B1. 岗位列表返回 rows 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/post/list?pageNum=1&pageSize=10', test)
    expect(resp.status(), '岗位列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `岗位列表 code 应为成功, 实际: ${body.code}`).toBe(true)

    // RuoYi TableDataInfo 格式: {code, msg, rows, total}
    expect(body.rows, '应返回 rows 数组').toBeDefined()
    expect(Array.isArray(body.rows), 'rows 应为数组').toBe(true)
    expect(body.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B1] 岗位列表: total=${body.total}, rows.length=${body.rows.length}`)
  })

  test('B2. optionselect 返回全部岗位数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/post/optionselect', test)
    expect(resp.status(), 'optionselect 应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `optionselect code 应为成功, 实际: ${body.code}`).toBe(true)

    // optionselect 返回 data 数组 (全部岗位, 不分页)
    expect(body.data, '应返回 data 数组').toBeDefined()
    expect(Array.isArray(body.data), 'data 应为数组').toBe(true)
    console.log(`[B2] optionselect: data.length=${body.data.length}`)
  })

  test('B3. 查询不存在的岗位返回 data:null - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/post/99999', test)
    expect(resp.status(), '查询岗位应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `查询岗位 code 应为成功, 实际: ${body.code}`).toBe(true)

    expect(body.data, '查询不存在的岗位应返回 data:null').toBeNull()
    console.log(`[B3] 查询不存在岗位: data=${body.data}`)
  })

  test('B4. 导出岗位返回 exported:0 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/system/post/export', {}, test)
    expect(resp.status(), '导出岗位应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `导出岗位 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.exported, '导出岗位应返回 exported:0').toBe(0)
    expect(data.message, '应返回 message').toBeTruthy()
    console.log(`[B4] 导出岗位: exported=${data.exported}, message=${data.message}`)
  })

  test('B5. 删除不存在的岗位返回成功消息 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 删除一个不存在的岗位 id, 应返回删除成功 0 条
    const resp = await safeDelete(request, '/system/post/99999', test)
    expect(resp.status(), '删除岗位应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `删除岗位 code 应为成功, 实际: ${body.code}`).toBe(true)

    expect(body.msg, '应返回 msg').toBeTruthy()
    expect(body.msg, 'msg 应包含删除成功').toContain('删除成功')
    console.log(`[B5] 删除不存在岗位: msg=${body.msg}`)
  })

  test('B6. 岗位真实 CRUD - 新增/查询/修改/删除 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 1. 新增岗位 (用时间戳保证唯一)
    const ts = Date.now()
    const postCode = `e2e_test_${ts}`
    const postName = `E2E测试岗位_${ts}`
    const createResp = await safePost(request, '/system/post', {
      post_code: postCode,
      post_name: postName,
      post_sort: 999,
      status: '0',
      remark: 'E2E测试自动创建',
    }, test)
    expect(createResp.status(), '新增岗位应返回 200').toBe(200)
    const createBody = await createResp.json()
    expect(isCodeOk(createBody.code), `新增岗位 code 应为成功, 实际: ${createBody.code}`).toBe(true)
    expect(createBody.msg, '新增岗位 msg 应为新增成功').toContain('新增成功')
    console.log(`[B6-1] 新增岗位: code=${postCode}, name=${postName}`)

    // 2. 查询岗位列表, 找到刚新增的岗位
    const listResp = await safeGet(request, `/system/post/list?postCode=${postCode}&pageNum=1&pageSize=10`, test)
    expect(listResp.status(), '查询岗位列表应返回 200').toBe(200)
    const listBody = await listResp.json()
    expect(listBody.rows.length, '应能查到刚新增的岗位').toBeGreaterThanOrEqual(1)
    const created = listBody.rows.find((r: { postCode: string }) => r.postCode === postCode)
    expect(created, '新增的岗位应在列表中').toBeDefined()
    expect(created.postName, '岗位名称应匹配').toBe(postName)
    const postId = created.postId
    console.log(`[B6-2] 查询岗位: postId=${postId}, postName=${created.postName}`)

    // 3. 修改岗位
    const newName = `E2E修改_${ts}`
    const editResp = await safePut(request, '/system/post', {
      post_id: postId,
      post_name: newName,
      post_sort: 888,
    }, test)
    expect(editResp.status(), '修改岗位应返回 200').toBe(200)
    const editBody = await editResp.json()
    expect(isCodeOk(editBody.code), `修改岗位 code 应为成功, 实际: ${editBody.code}`).toBe(true)
    expect(editBody.msg, '修改岗位 msg 应为修改成功').toContain('修改成功')
    console.log(`[B6-3] 修改岗位: newName=${newName}`)

    // 4. 查询修改后的岗位
    const getResp = await safeGet(request, `/system/post/${postId}`, test)
    expect(getResp.status(), '查询岗位应返回 200').toBe(200)
    const getBody = await getResp.json()
    expect(getBody.data.postName, '修改后的岗位名称应匹配').toBe(newName)
    expect(getBody.data.postSort, '修改后的排序应匹配').toBe(888)
    console.log(`[B6-4] 查询修改后岗位: postName=${getBody.data.postName}, postSort=${getBody.data.postSort}`)

    // 5. 删除岗位
    const delResp = await safeDelete(request, `/system/post/${postId}`, test)
    expect(delResp.status(), '删除岗位应返回 200').toBe(200)
    const delBody = await delResp.json()
    expect(isCodeOk(delBody.code), `删除岗位 code 应为成功, 实际: ${delBody.code}`).toBe(true)
    expect(delBody.msg, '删除岗位 msg 应包含删除成功').toContain('删除成功')
    console.log(`[B6-5] 删除岗位: msg=${delBody.msg}`)

    // 6. 验证已删除
    const verifyResp = await safeGet(request, `/system/post/${postId}`, test)
    expect(verifyResp.status(), '验证删除应返回 200').toBe(200)
    const verifyBody = await verifyResp.json()
    expect(verifyBody.data, '删除后查询应返回 data:null').toBeNull()
    console.log(`[B6-6] 验证已删除: data=${verifyBody.data}`)
  })
})
