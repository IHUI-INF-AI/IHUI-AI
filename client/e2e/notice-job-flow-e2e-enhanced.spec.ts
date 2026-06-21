/**
 * 通知公告/定时任务链路端到端真实联调测试（增强版）
 *
 * 测试链路（基于后端真实接口）:
 *
 * A. 通知公告 (/system/notice/*):
 *   1. 通知公告列表返回 rows 数组
 *   2. 导出通知公告返回 exported:0
 *   3. 查询不存在的通知公告返回 data:null
 *   4. 通知公告 CRUD (新增/查询/修改/删除)
 *
 * B. 定时任务 (/system/job/*):
 *   5. 定时任务列表返回 rows 数组
 *   6. 导出定时任务返回 exported:0
 *   7. 查询不存在的定时任务返回 data:null
 *   8. 定时任务 CRUD (新增/查询/修改状态/立即执行/删除)
 *
 * 后端实现:
 * - server/app/api/v1_sys_notice.py (真实数据库 CRUD, SysNotice 表)
 * - server/app/api/v1_sys_job.py (真实数据库 CRUD, SysJob 表)
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

test.describe('通知公告/定时任务链路端到端联调（增强版）', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(30000)

  // ========== A. 通知公告 ==========

  test('A1. 通知公告列表返回 rows 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/notice/list?pageNum=1&pageSize=10', test)
    expect(resp.status(), '通知公告列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `通知公告列表 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.rows, '应返回 rows 数组').toBeDefined()
    expect(Array.isArray(body.rows), 'rows 应为数组').toBe(true)
    expect(body.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[A1] 通知公告列表: total=${body.total}, rows.length=${body.rows.length}`)
  })

  test('A2. 导出通知公告返回 exported:0 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/system/notice/export', {}, test)
    expect(resp.status(), '导出通知公告应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `导出通知公告 code 应为成功, 实际: ${body.code}`).toBe(true)
    const data = body.data
    expect(data.exported, '导出通知公告应返回 exported:0').toBe(0)
    expect(data.message, '应返回 message').toBeTruthy()
    console.log(`[A2] 导出通知公告: exported=${data.exported}, message=${data.message}`)
  })

  test('A3. 查询不存在的通知公告返回 data:null - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/notice/99999', test)
    expect(resp.status(), '查询通知公告应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `查询通知公告 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data, '查询不存在的通知公告应返回 data:null').toBeNull()
    console.log(`[A3] 查询不存在通知公告: data=${body.data}`)
  })

  test('A4. 通知公告 CRUD - 新增/查询/修改/删除 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 1. 新增通知公告
    const ts = Date.now()
    const title = `E2E测试公告_${ts}`
    const createResp = await safePost(request, '/system/notice', {
      notice_title: title,
      notice_type: '1',
      notice_content: 'E2E测试内容',
      status: '0',
      remark: 'E2E测试自动创建',
    }, test)
    expect(createResp.status(), '新增通知公告应返回 200').toBe(200)
    const createBody = await createResp.json()
    expect(isCodeOk(createBody.code), `新增通知公告 code 应为成功, 实际: ${createBody.code}`).toBe(true)
    expect(createBody.msg, '新增通知公告 msg 应为新增成功').toContain('新增成功')
    console.log(`[A4-1] 新增通知公告: title=${title}`)

    // 2. 查询通知公告列表, 找到刚新增的
    const listResp = await safeGet(request, `/system/notice/list?noticeTitle=${encodeURIComponent(title)}&pageNum=1&pageSize=10`, test)
    expect(listResp.status(), '查询通知公告列表应返回 200').toBe(200)
    const listBody = await listResp.json()
    expect(listBody.rows.length, '应能查到刚新增的通知公告').toBeGreaterThanOrEqual(1)
    const created = listBody.rows.find((r: { noticeTitle: string }) => r.noticeTitle === title)
    expect(created, '新增的通知公告应在列表中').toBeDefined()
    const noticeId = created.noticeId
    console.log(`[A4-2] 查询通知公告: noticeId=${noticeId}`)

    // 3. 修改通知公告
    const newTitle = `E2E修改_${ts}`
    const editResp = await safePut(request, '/system/notice', {
      notice_id: noticeId,
      notice_title: newTitle,
      notice_content: '修改后内容',
    }, test)
    expect(editResp.status(), '修改通知公告应返回 200').toBe(200)
    const editBody = await editResp.json()
    expect(isCodeOk(editBody.code), `修改通知公告 code 应为成功, 实际: ${editBody.code}`).toBe(true)
    expect(editBody.msg, '修改通知公告 msg 应为修改成功').toContain('修改成功')
    console.log(`[A4-3] 修改通知公告: newTitle=${newTitle}`)

    // 4. 查询修改后的通知公告
    const getResp = await safeGet(request, `/system/notice/${noticeId}`, test)
    expect(getResp.status(), '查询通知公告应返回 200').toBe(200)
    const getBody = await getResp.json()
    expect(getBody.data.noticeTitle, '修改后的标题应匹配').toBe(newTitle)
    expect(getBody.data.noticeContent, '修改后的内容应匹配').toBe('修改后内容')
    console.log(`[A4-4] 查询修改后通知公告: noticeTitle=${getBody.data.noticeTitle}`)

    // 5. 删除通知公告
    const delResp = await safeDelete(request, `/system/notice/${noticeId}`, test)
    expect(delResp.status(), '删除通知公告应返回 200').toBe(200)
    const delBody = await delResp.json()
    expect(isCodeOk(delBody.code), `删除通知公告 code 应为成功, 实际: ${delBody.code}`).toBe(true)
    expect(delBody.msg, '删除通知公告 msg 应包含删除成功').toContain('删除成功')
    console.log(`[A4-5] 删除通知公告: msg=${delBody.msg}`)

    // 6. 验证已删除
    const verifyResp = await safeGet(request, `/system/notice/${noticeId}`, test)
    expect(verifyResp.status(), '验证删除应返回 200').toBe(200)
    const verifyBody = await verifyResp.json()
    expect(verifyBody.data, '删除后查询应返回 data:null').toBeNull()
    console.log(`[A4-6] 验证已删除: data=${verifyBody.data}`)
  })

  // ========== B. 定时任务 ==========

  test('B1. 定时任务列表返回 rows 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/job/list?pageNum=1&pageSize=10', test)
    expect(resp.status(), '定时任务列表应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `定时任务列表 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.rows, '应返回 rows 数组').toBeDefined()
    expect(Array.isArray(body.rows), 'rows 应为数组').toBe(true)
    expect(body.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[B1] 定时任务列表: total=${body.total}, rows.length=${body.rows.length}`)
  })

  test('B2. 导出定时任务返回 exported:0 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safePost(request, '/system/job/export', {}, test)
    expect(resp.status(), '导出定时任务应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `导出定时任务 code 应为成功, 实际: ${body.code}`).toBe(true)
    const data = body.data
    expect(data.exported, '导出定时任务应返回 exported:0').toBe(0)
    expect(data.message, '应返回 message').toBeTruthy()
    console.log(`[B2] 导出定时任务: exported=${data.exported}, message=${data.message}`)
  })

  test('B3. 查询不存在的定时任务返回 data:null - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await safeGet(request, '/system/job/99999', test)
    expect(resp.status(), '查询定时任务应返回 200').toBe(200)
    const body = await resp.json()
    expect(isCodeOk(body.code), `查询定时任务 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data, '查询不存在的定时任务应返回 data:null').toBeNull()
    console.log(`[B3] 查询不存在定时任务: data=${body.data}`)
  })

  test('B4. 定时任务 CRUD - 新增/查询/修改状态/立即执行/删除 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // 1. 新增定时任务
    const ts = Date.now()
    const jobName = `E2E测试任务_${ts}`
    const createResp = await safePost(request, '/system/job', {
      job_name: jobName,
      job_group: 'DEFAULT',
      invoke_target: 'e2e.test.target',
      cron_expression: '0 0 0 * * ?',
      misfire_policy: '3',
      concurrent: '1',
      status: '0',
      remark: 'E2E测试自动创建',
    }, test)
    expect(createResp.status(), '新增定时任务应返回 200').toBe(200)
    const createBody = await createResp.json()
    expect(isCodeOk(createBody.code), `新增定时任务 code 应为成功, 实际: ${createBody.code}`).toBe(true)
    expect(createBody.msg, '新增定时任务 msg 应为新增成功').toContain('新增成功')
    console.log(`[B4-1] 新增定时任务: jobName=${jobName}`)

    // 2. 查询定时任务列表, 找到刚新增的
    const listResp = await safeGet(request, `/system/job/list?jobName=${encodeURIComponent(jobName)}&pageNum=1&pageSize=10`, test)
    expect(listResp.status(), '查询定时任务列表应返回 200').toBe(200)
    const listBody = await listResp.json()
    expect(listBody.rows.length, '应能查到刚新增的定时任务').toBeGreaterThanOrEqual(1)
    const created = listBody.rows.find((r: { jobName: string }) => r.jobName === jobName)
    expect(created, '新增的定时任务应在列表中').toBeDefined()
    const jobId = created.jobId
    console.log(`[B4-2] 查询定时任务: jobId=${jobId}`)

    // 3. 修改任务状态 (暂停)
    const statusResp = await safePut(request, '/system/job/changeStatus', {
      job_id: jobId,
      status: '1',
    }, test)
    expect(statusResp.status(), '修改任务状态应返回 200').toBe(200)
    const statusBody = await statusResp.json()
    expect(isCodeOk(statusBody.code), `修改任务状态 code 应为成功, 实际: ${statusBody.code}`).toBe(true)
    expect(statusBody.msg, '修改任务状态 msg 应为修改成功').toContain('修改成功')
    console.log(`[B4-3] 修改任务状态: status=1(暂停)`)

    // 4. 查询修改后的任务
    const getResp = await safeGet(request, `/system/job/${jobId}`, test)
    expect(getResp.status(), '查询定时任务应返回 200').toBe(200)
    const getBody = await getResp.json()
    expect(getBody.data.status, '修改后的任务状态应为 1(暂停)').toBe('1')
    console.log(`[B4-4] 查询修改后任务: status=${getBody.data.status}`)

    // 5. 立即执行任务 (写入日志, 不实际调度)
    const runResp = await safePut(request, '/system/job/run', {
      job_id: jobId,
    }, test)
    expect(runResp.status(), '立即执行任务应返回 200').toBe(200)
    const runBody = await runResp.json()
    expect(isCodeOk(runBody.code), `立即执行任务 code 应为成功, 实际: ${runBody.code}`).toBe(true)
    expect(runBody.msg, '立即执行任务 msg 应为执行成功').toContain('执行成功')
    console.log(`[B4-5] 立即执行任务: msg=${runBody.msg}`)

    // 6. 删除定时任务
    const delResp = await safeDelete(request, `/system/job/${jobId}`, test)
    expect(delResp.status(), '删除定时任务应返回 200').toBe(200)
    const delBody = await delResp.json()
    expect(isCodeOk(delBody.code), `删除定时任务 code 应为成功, 实际: ${delBody.code}`).toBe(true)
    expect(delBody.msg, '删除定时任务 msg 应包含删除成功').toContain('删除成功')
    console.log(`[B4-6] 删除定时任务: msg=${delBody.msg}`)

    // 7. 验证已删除
    const verifyResp = await safeGet(request, `/system/job/${jobId}`, test)
    expect(verifyResp.status(), '验证删除应返回 200').toBe(200)
    const verifyBody = await verifyResp.json()
    expect(verifyBody.data, '删除后查询应返回 data:null').toBeNull()
    console.log(`[B4-7] 验证已删除: data=${verifyBody.data}`)
  })
})
