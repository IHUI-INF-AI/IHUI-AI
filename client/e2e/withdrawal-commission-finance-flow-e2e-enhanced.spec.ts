/**
 * 第67轮真测试：提现/佣金/流水流程
 *
 * 覆盖三个后端接口文件：
 * A. v1_withdrawal_flow.py: 提现记录 CRUD + 审核（真实数据库 zhs_withdrawal_flow）
 * B. v1_commission_flow.py: 佣金流水 CRUD + 结算（真实数据库 zhs_commission_flow）
 * C. v1_finance.py: 财务 CRUD（内存存储 finance，通过 v1_business_store）
 *
 * 真测试原则：验证数据真的写了/改了/删了，不只看状态码
 */

import { test, expect, type APIRequestContext } from '@playwright/test'

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'

// ============================ 工具函数 ============================

function isCodeOk(code: unknown): boolean {
  return code === '0' || code === 0 || code === 200 || code === '200'
}

function isWafBlocked(body: any): boolean {
  return body?.blocked_by === 'rate_limit' || body?.error === 'rate_limited'
}

function isDbUnavailable(body: any): boolean {
  const msg = String(body?.detail || body?.msg || body?.message || '')
  return /no such table|database is locked|OperationalError|relation .* does not exist/i.test(msg)
}

async function safeGet(request: APIRequestContext, path: string) {
  const resp = await request.get(`${BACKEND}${path}`, { timeout: 15000, headers: { 'Content-Type': 'application/json' } })
  const status = resp.status()
  let body: any = null
  try { body = await resp.json() } catch { /* 非 JSON */ }
  return { status, body }
}

async function safePost(request: APIRequestContext, path: string, data: any = {}) {
  const resp = await request.post(`${BACKEND}${path}`, { timeout: 15000, headers: { 'Content-Type': 'application/json' }, data })
  const status = resp.status()
  let body: any = null
  try { body = await resp.json() } catch { /* 非 JSON */ }
  return { status, body }
}

async function safePut(request: APIRequestContext, path: string, data: any = {}) {
  const resp = await request.put(`${BACKEND}${path}`, { timeout: 15000, headers: { 'Content-Type': 'application/json' }, data })
  const status = resp.status()
  let body: any = null
  try { body = await resp.json() } catch { /* 非 JSON */ }
  return { status, body }
}

async function safeDelete(request: APIRequestContext, path: string) {
  const resp = await request.delete(`${BACKEND}${path}`, { timeout: 15000, headers: { 'Content-Type': 'application/json' } })
  const status = resp.status()
  let body: any = null
  try { body = await resp.json() } catch { /* 非 JSON */ }
  return { status, body }
}

function genUserId(): string {
  return `e2e_u_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}

// ============================ 测试分组 ============================

test.describe('第67轮：提现/佣金/流水流程真测试', () => {
  test.describe.configure({ mode: 'serial' })

  // =========================================================================
  // A. v1_withdrawal_flow.py: 提现记录 CRUD + 审核（真实数据库）
  // =========================================================================
  test.describe('A. v1_withdrawal_flow 提现记录', () => {
    test('A1: 列表查询（分页）', async ({ request }) => {
      const { status, body } = await safeGet(request, '/withdrawal_flow/list?page_num=1&page_size=10')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      if (isDbUnavailable(body)) { test.skip(true, '数据库不可用'); return }
      expect(status).toBe(200)
      expect(body?.code).toBe(200)
      expect(body?.data?.records).toBeTruthy()
      expect(typeof body?.data?.total).toBe('number')
      expect(body?.data?.page_num).toBe(1)
    })

    test('A2: 新增→查询详情→修改→审核→删除完整流程（真写入验证）', async ({ request }) => {
      const userId = genUserId()
      // 1. 新增
      const { status: s1, body: b1 } = await safePost(request, '/withdrawal_flow', {
        user_id: userId, amount: 5000, status: 0,
      })
      if (isWafBlocked(b1)) { test.skip(true, 'WAF 限流'); return }
      if (isDbUnavailable(b1)) { test.skip(true, '数据库不可用'); return }
      expect(s1).toBe(200)
      expect(isCodeOk(b1?.code)).toBe(true)
      expect(b1?.data?.id).toBeTruthy()
      const newId = b1?.data?.id

      // 2. 查询详情
      const { body: b2 } = await safeGet(request, `/withdrawal_flow/${newId}`)
      expect(isCodeOk(b2?.code)).toBe(true)
      expect(b2?.data?.id).toBe(newId)
      expect(b2?.data?.userId).toBe(userId)
      expect(b2?.data?.amount).toBe(5000)

      // 3. 修改
      const { body: b3 } = await safePut(request, '/withdrawal_flow', {
        id: newId, amount: 8000, status: 0,
      })
      expect(isCodeOk(b3?.code)).toBe(true)
      expect(b3?.data?.id).toBe(newId)

      // 4. 验证修改真的生效
      const { body: b4 } = await safeGet(request, `/withdrawal_flow/${newId}`)
      expect(b4?.data?.amount).toBe(8000)

      // 5. 审核（status=1 通过）
      const { body: b5 } = await safePut(request, `/withdrawal_flow/${newId}/approve?status=1`)
      expect(isCodeOk(b5?.code)).toBe(true)
      expect(b5?.data?.id).toBe(newId)
      expect(b5?.data?.status).toBe(1)

      // 6. 验证审核真的生效
      const { body: b6 } = await safeGet(request, `/withdrawal_flow/${newId}`)
      expect(b6?.data?.status).toBe(1)

      // 7. 删除
      const { body: b7 } = await safeDelete(request, `/withdrawal_flow/${newId}`)
      expect(isCodeOk(b7?.code)).toBe(true)
      expect(b7?.data?.deleted).toBe(1)

      // 8. 验证删除真的生效（查询应返回 data=null）
      const { body: b8 } = await safeGet(request, `/withdrawal_flow/${newId}`)
      expect(b8?.data).toBeNull()
    })

    test('A3: 导出接口（返回跳过消息）', async ({ request }) => {
      const { status, body } = await safePost(request, '/withdrawal_flow/export', {})
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.exported).toBe(0)
    })

    test('A4: 按用户ID过滤查询', async ({ request }) => {
      const userId = genUserId()
      // 先创建一条
      await safePost(request, '/withdrawal_flow', { user_id: userId, amount: 100, status: 0 })
      const { status, body } = await safeGet(request, `/withdrawal_flow/list?user_id=${userId}&page_num=1&page_size=10`)
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      if (isDbUnavailable(body)) { test.skip(true, '数据库不可用'); return }
      expect(status).toBe(200)
      expect(body?.code).toBe(200)
      expect(body?.data?.total).toBeGreaterThanOrEqual(1)
      // 所有记录的 userId 都应该是我们查询的 userId
      for (const r of body?.data?.records || []) {
        expect(r.userId).toBe(userId)
      }
    })

    test('A5: 批量删除（逗号分隔ID）', async ({ request }) => {
      const u1 = genUserId()
      const u2 = genUserId()
      const { body: b1 } = await safePost(request, '/withdrawal_flow', { user_id: u1, amount: 50, status: 0 })
      if (isWafBlocked(b1)) { test.skip(true, 'WAF 限流'); return }
      if (isDbUnavailable(b1)) { test.skip(true, '数据库不可用'); return }
      const id1 = b1?.data?.id
      const { body: b2 } = await safePost(request, '/withdrawal_flow', { user_id: u2, amount: 60, status: 0 })
      const id2 = b2?.data?.id

      const { body: b3 } = await safeDelete(request, `/withdrawal_flow/${id1},${id2}`)
      expect(isCodeOk(b3?.code)).toBe(true)
      expect(b3?.data?.deleted).toBe(2)
    })

    test('A6: 审核不存在的记录（返回 500）', async ({ request }) => {
      const { body } = await safePut(request, '/withdrawal_flow/999999/approve?status=1')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(body?.code).toBe(500)
    })
  })

  // =========================================================================
  // B. v1_commission_flow.py: 佣金流水 CRUD + 结算（真实数据库）
  // =========================================================================
  test.describe('B. v1_commission_flow 佣金流水', () => {
    test('B1: 列表查询（分页）', async ({ request }) => {
      const { status, body } = await safeGet(request, '/flow/list?page_num=1&page_size=10')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      if (isDbUnavailable(body)) { test.skip(true, '数据库不可用'); return }
      expect(status).toBe(200)
      expect(body?.code).toBe(200)
      expect(body?.data?.records).toBeTruthy()
      expect(typeof body?.data?.total).toBe('number')
    })

    test('B2: 新增→查询详情→修改→结算→删除完整流程（真写入验证）', async ({ request }) => {
      const userId = genUserId()
      // 1. 新增
      const { status: s1, body: b1 } = await safePost(request, '/flow', {
        user_id: userId, order_id: 1001, amount: 200, type: 0, status: 0, token: 50, remark: 'e2e 测试',
      })
      if (isWafBlocked(b1)) { test.skip(true, 'WAF 限流'); return }
      if (isDbUnavailable(b1)) { test.skip(true, '数据库不可用'); return }
      expect(s1).toBe(200)
      expect(isCodeOk(b1?.code)).toBe(true)
      expect(b1?.data?.id).toBeTruthy()
      const newId = b1?.data?.id

      // 2. 查询详情
      const { body: b2 } = await safeGet(request, `/flow/${newId}`)
      expect(isCodeOk(b2?.code)).toBe(true)
      expect(b2?.data?.id).toBe(newId)
      expect(b2?.data?.userId).toBe(userId)
      expect(b2?.data?.amount).toBe(200)

      // 3. 修改
      const { body: b3 } = await safePut(request, '/flow', {
        id: newId, amount: 300, remark: 'e2e 修改后',
      })
      expect(isCodeOk(b3?.code)).toBe(true)

      // 4. 验证修改真的生效
      const { body: b4 } = await safeGet(request, `/flow/${newId}`)
      expect(b4?.data?.amount).toBe(300)
      expect(b4?.data?.remark).toBe('e2e 修改后')

      // 5. 结算（status 变为 1）
      const { body: b5 } = await safePut(request, `/flow/${newId}/settle`)
      expect(isCodeOk(b5?.code)).toBe(true)
      expect(b5?.data?.id).toBe(newId)
      expect(b5?.data?.status).toBe(1)

      // 6. 验证结算真的生效
      const { body: b6 } = await safeGet(request, `/flow/${newId}`)
      expect(b6?.data?.status).toBe(1)

      // 7. 删除
      const { body: b7 } = await safeDelete(request, `/flow/${newId}`)
      expect(isCodeOk(b7?.code)).toBe(true)
      expect(b7?.data?.deleted).toBe(1)

      // 8. 验证删除真的生效
      const { body: b8 } = await safeGet(request, `/flow/${newId}`)
      expect(b8?.data).toBeNull()
    })

    test('B3: 导出接口（返回跳过消息）', async ({ request }) => {
      const { status, body } = await safePost(request, '/flow/export', {})
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.exported).toBe(0)
    })

    test('B4: 按类型过滤查询', async ({ request }) => {
      const { status, body } = await safeGet(request, '/flow/list?type=1&page_num=1&page_size=10')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      if (isDbUnavailable(body)) { test.skip(true, '数据库不可用'); return }
      expect(status).toBe(200)
      expect(body?.code).toBe(200)
      // 所有记录的 type 都应该是 1
      for (const r of body?.data?.records || []) {
        expect(r.type).toBe(1)
      }
    })

    test('B5: 结算不存在的记录（返回 500）', async ({ request }) => {
      const { body } = await safePut(request, '/flow/999999/settle')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(body?.code).toBe(500)
    })
  })

  // =========================================================================
  // C. v1_finance.py: 财务 CRUD（内存存储 finance）
  // =========================================================================
  test.describe('C. v1_finance 财务管理', () => {
    test('C1: 列表接口返回种子数据', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/finance/list?page=1&size=20')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.store_key).toBe('finance')
      expect(Array.isArray(body?.data?.records)).toBe(true)
      expect(typeof body?.data?.total).toBe('number')
      expect(body?.data?.total).toBeGreaterThanOrEqual(1)
    })

    test('C2: 详情接口返回 records 数组', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/finance/info')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(Array.isArray(body?.data?.records)).toBe(true)
      expect(typeof body?.data?.total).toBe('number')
    })

    test('C3: 创建→查询→删除完整流程（真写入验证）', async ({ request }) => {
      const name = `e2e_fin_${Date.now()}`
      // 1. 创建
      const { status: s1, body: b1 } = await safePost(request, '/api/v1/finance/create', { name, description: 'e2e 测试', status: 'active' })
      if (isWafBlocked(b1)) { test.skip(true, 'WAF 限流'); return }
      expect(s1).toBe(200)
      expect(isCodeOk(b1?.code)).toBe(true)
      expect(b1?.data?.created).toBe(true)
      const created = b1?.data?.item
      expect(created).toBeTruthy()
      expect(created.name).toBe(name)
      const newId = created.id

      // 2. 查询列表，验证新记录真的写入了
      const { body: b2 } = await safeGet(request, '/api/v1/finance/list?page=1&size=100')
      const found = (b2?.data?.records || []).find((r: any) => r.id === newId)
      expect(found).toBeTruthy()
      expect(found.name).toBe(name)

      // 3. 删除
      const { status: s3, body: b3 } = await safePost(request, `/api/v1/finance/delete?item_id=${newId}`)
      expect(s3).toBe(200)
      expect(isCodeOk(b3?.code)).toBe(true)
      expect(b3?.data?.deleted).toBe(true)

      // 4. 再次查询列表，验证记录真的被删除了
      const { body: b4 } = await safeGet(request, '/api/v1/finance/list?page=1&size=100')
      const stillFound = (b4?.data?.records || []).find((r: any) => r.id === newId)
      expect(stillFound).toBeUndefined()
    })

    test('C4: 更新接口接受 payload', async ({ request }) => {
      const { status, body } = await safePost(request, '/api/v1/finance/update', { name: 'e2e_fin_update', description: '更新测试' })
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.updated).toBe(true)
    })
  })
})
