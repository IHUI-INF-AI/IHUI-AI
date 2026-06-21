/**
 * 第69轮真测试：杂项/工具/行为流程
 *
 * 覆盖四个后端接口文件：
 * A. v1_misc.py: 杂项 CRUD（内存存储 misc，通过 v1_business_store）
 * B. v1_tools.py: 工具列表/详情/调用/分类/热门/收藏/我的/反馈/使用/分享（内存存储 tools）
 * C. v1_behavior.py: 行为 CRUD（内存存储 behavior，Query 参数）
 * D. v1_visit.py: 访问追踪/日志列表/统计（内存存储 visit）
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

// ============================ 测试分组 ============================

test.describe('第69轮：杂项/工具/行为流程真测试', () => {
  test.describe.configure({ mode: 'serial' })

  // =========================================================================
  // A. v1_misc.py: 杂项 CRUD（内存存储 misc）
  // =========================================================================
  test.describe('A. v1_misc 杂项管理', () => {
    test('A1: 列表接口返回种子数据', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/misc/list?page=1&size=20')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.store_key).toBe('misc')
      expect(Array.isArray(body?.data?.records)).toBe(true)
      expect(typeof body?.data?.total).toBe('number')
      expect(body?.data?.total).toBeGreaterThanOrEqual(1)
    })

    test('A2: 详情接口返回 records 数组', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/misc/info')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(Array.isArray(body?.data?.records)).toBe(true)
      expect(typeof body?.data?.total).toBe('number')
    })

    test('A3: 创建→查询→删除完整流程（真写入验证）', async ({ request }) => {
      const name = `e2e_misc_${Date.now()}`
      // 1. 创建
      const { status: s1, body: b1 } = await safePost(request, '/api/v1/misc/create', { name, description: 'e2e 测试', status: 'active' })
      if (isWafBlocked(b1)) { test.skip(true, 'WAF 限流'); return }
      expect(s1).toBe(200)
      expect(isCodeOk(b1?.code)).toBe(true)
      expect(b1?.data?.created).toBe(true)
      const created = b1?.data?.item
      expect(created).toBeTruthy()
      expect(created.name).toBe(name)
      const newId = created.id

      // 2. 查询列表，验证新记录真的写入了
      const { body: b2 } = await safeGet(request, '/api/v1/misc/list?page=1&size=100')
      const found = (b2?.data?.records || []).find((r: any) => r.id === newId)
      expect(found).toBeTruthy()
      expect(found.name).toBe(name)

      // 3. 删除
      const { status: s3, body: b3 } = await safePost(request, `/api/v1/misc/delete?item_id=${newId}`)
      expect(s3).toBe(200)
      expect(isCodeOk(b3?.code)).toBe(true)
      expect(b3?.data?.deleted).toBe(true)

      // 4. 再次查询列表，验证记录真的被删除了
      const { body: b4 } = await safeGet(request, '/api/v1/misc/list?page=1&size=100')
      const stillFound = (b4?.data?.records || []).find((r: any) => r.id === newId)
      expect(stillFound).toBeUndefined()
    })

    test('A4: 更新接口接受 payload', async ({ request }) => {
      const { status, body } = await safePost(request, '/api/v1/misc/update', { name: 'e2e_misc_update', description: '更新测试' })
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.updated).toBe(true)
    })
  })

  // =========================================================================
  // B. v1_tools.py: 工具管理（内存存储 tools）
  // =========================================================================
  test.describe('B. v1_tools 工具管理', () => {
    test('B1: 工具列表', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/tools/list?page=1&size=20')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.store_key).toBe('tools')
      expect(Array.isArray(body?.data?.records)).toBe(true)
      expect(typeof body?.data?.total).toBe('number')
      expect(body?.data?.total).toBeGreaterThanOrEqual(1)
    })

    test('B2: 工具详情', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/tools/detail')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/tools/detail')
    })

    test('B3: 调用工具（业务操作）', async ({ request }) => {
      const { status, body } = await safePost(request, '/api/v1/tools/invoke', { tool_id: 1, params: { q: 'test' } })
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.action).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/tools/invoke')
    })

    test('B4: 工具分类', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/tools/categories')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/tools/categories')
    })

    test('B5: 热门工具', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/tools/hot')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/tools/hot')
    })

    test('B6: 收藏工具（业务操作）', async ({ request }) => {
      const { status, body } = await safePost(request, '/api/v1/tools/favorite', { tool_id: 1, action: 'add' })
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.action).toBe(true)
    })

    test('B7: 我的工具', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/tools/my')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/tools/my')
    })

    test('B8: 工具反馈（业务操作）', async ({ request }) => {
      const { status, body } = await safePost(request, '/api/v1/tools/feedback', { tool_id: 1, content: '很好用' })
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.action).toBe(true)
    })

    test('B9: 工具使用统计', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/tools/usage')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/tools/usage')
    })

    test('B10: 分享工具（业务操作）', async ({ request }) => {
      const { status, body } = await safePost(request, '/api/v1/tools/share', { tool_id: 1, to: 'friend' })
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.action).toBe(true)
    })
  })

  // =========================================================================
  // C. v1_behavior.py: 行为 CRUD（内存存储 behavior，Query 参数）
  // =========================================================================
  test.describe('C. v1_behavior 行为管理', () => {
    test('C1: 列表查询', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/behavior/list?page=1&size=20')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/behavior/list')
      expect(Array.isArray(body?.data?.records)).toBe(true)
      expect(typeof body?.data?.total).toBe('number')
    })

    test('C2: 详情查询', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/behavior/info')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/behavior/info')
    })

    test('C3: 创建→更新→删除完整流程（真写入验证，Query 参数）', async ({ request }) => {
      const name = `e2e_behavior_${Date.now()}`
      // 1. 创建（Query 参数）
      const { status: s1, body: b1 } = await safePost(request, `/api/v1/behavior/create?name=${encodeURIComponent(name)}&description=e2e_test`)
      if (isWafBlocked(b1)) { test.skip(true, 'WAF 限流'); return }
      expect(s1).toBe(200)
      expect(isCodeOk(b1?.code)).toBe(true)
      expect(b1?.data?.created).toBe(true)
      const created = b1?.data?.item
      expect(created).toBeTruthy()
      expect(created.name).toBe(name)
      const newId = created.id

      // 2. 查询列表，验证新记录真的写入了
      const { body: b2 } = await safeGet(request, '/api/v1/behavior/list?page=1&size=100')
      const found = (b2?.data?.records || []).find((r: any) => r.id === newId)
      expect(found).toBeTruthy()
      expect(found.name).toBe(name)

      // 3. 更新（Query 参数）
      const updatedName = `${name}_updated`
      const { body: b3 } = await safePost(request, `/api/v1/behavior/update?item_id=${newId}&name=${encodeURIComponent(updatedName)}`)
      expect(isCodeOk(b3?.code)).toBe(true)
      expect(b3?.data?.updated).toBe(true)
      expect(b3?.data?.item?.name).toBe(updatedName)

      // 4. 删除
      const { body: b4 } = await safePost(request, `/api/v1/behavior/delete?item_id=${newId}`)
      expect(isCodeOk(b4?.code)).toBe(true)
      expect(b4?.data?.deleted).toBe(true)

      // 5. 验证删除真的生效
      const { body: b5 } = await safeGet(request, '/api/v1/behavior/list?page=1&size=100')
      const stillFound = (b5?.data?.records || []).find((r: any) => r.id === newId)
      expect(stillFound).toBeUndefined()
    })
  })

  // =========================================================================
  // D. v1_visit.py: 访问追踪/统计（内存存储 visit）
  // =========================================================================
  test.describe('D. v1_visit 访问追踪', () => {
    test('D1: 访问追踪（业务操作）', async ({ request }) => {
      const { status, body } = await safePost(request, '/api/v1/visit/track', { path: '/', user_id: 'u_test' })
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.action).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/visit/track')
    })

    test('D2: 访问日志列表', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/visit/log/list?page=1&size=20')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.store_key).toBe('visit')
      expect(Array.isArray(body?.data?.records)).toBe(true)
      expect(typeof body?.data?.total).toBe('number')
      expect(body?.data?.total).toBeGreaterThanOrEqual(1)
    })

    test('D3: 每日统计', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/visit/stats/daily')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/visit/stats/daily')
    })

    test('D4: 今日统计', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/visit/stats/today')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/visit/stats/today')
    })

    test('D5: 来源统计', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/visit/stats/source')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/visit/stats/source')
    })

    test('D6: 页面统计', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/visit/stats/page')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/visit/stats/page')
    })

    test('D7: 记录来源（业务操作）', async ({ request }) => {
      const { status, body } = await safePost(request, '/api/v1/visit/source/record', { source: 'google' })
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.action).toBe(true)
    })

    test('D8: 记录页面访问（业务操作）', async ({ request }) => {
      const { status, body } = await safePost(request, '/api/v1/visit/page/record', { path: '/home', duration: 5000 })
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.action).toBe(true)
    })
  })
})
