/**
 * 第68轮真测试：CMS/横幅/版本流程
 *
 * 覆盖三个后端接口文件：
 * A. v1_cms.py: CMS 文章/横幅/公告/关于/联系/协议/隐私/信息（内存存储 cms）
 * B. v1_banner_carousel.py: 轮播图 CRUD（真实数据库 banner_carousel）
 * C. v1_app_version.py: 应用版本列表/详情/检查更新/最新版本/发布（内存存储 app_version）
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

// ============================ 测试分组 ============================

test.describe('第68轮：CMS/横幅/版本流程真测试', () => {
  test.describe.configure({ mode: 'serial' })

  // =========================================================================
  // A. v1_cms.py: CMS 内容管理（内存存储 cms）
  // =========================================================================
  test.describe('A. v1_cms 内容管理', () => {
    test('A1: 文章列表（分页）', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/cms/article/list?page=1&size=20')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.store_key).toBe('cms')
      expect(Array.isArray(body?.data?.records)).toBe(true)
      expect(typeof body?.data?.total).toBe('number')
      expect(body?.data?.total).toBeGreaterThanOrEqual(1)
    })

    test('A2: 文章详情', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/cms/article')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(Array.isArray(body?.data?.records)).toBe(true)
    })

    test('A3: 横幅列表', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/cms/banner/list?page=1&size=20')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/cms/banner/list')
    })

    test('A4: 公告列表', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/cms/notice/list?page=1&size=20')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/cms/notice/list')
    })

    test('A5: 公告详情', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/cms/notice')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(Array.isArray(body?.data?.records)).toBe(true)
    })

    test('A6: 关于我们', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/cms/about')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/cms/about')
    })

    test('A7: 联系我们', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/cms/contact')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/cms/contact')
    })

    test('A8: 用户协议', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/cms/agreement')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/cms/agreement')
    })

    test('A9: 隐私政策', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/cms/privacy')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/cms/privacy')
    })

    test('A10: 信息列表', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/cms/information')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/cms/information')
    })
  })

  // =========================================================================
  // B. v1_banner_carousel.py: 轮播图 CRUD（真实数据库）
  // =========================================================================
  test.describe('B. v1_banner_carousel 轮播图', () => {
    test('B1: 列表查询（分页）', async ({ request }) => {
      const { status, body } = await safeGet(request, '/carousel/list?page_num=1&page_size=10')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      if (isDbUnavailable(body)) { test.skip(true, '数据库不可用'); return }
      expect(status).toBe(200)
      expect(body?.code).toBe(200)
      expect(body?.data?.records).toBeTruthy()
      expect(typeof body?.data?.total).toBe('number')
    })

    test('B2: 新增→查询详情→修改→删除完整流程（真写入验证）', async ({ request }) => {
      const title = `e2e_banner_${Date.now()}`
      // 1. 新增
      const { status: s1, body: b1 } = await safePost(request, '/carousel', {
        title, img: 'https://example.com/img.jpg', url: 'https://example.com',
        type: 1, sort: 100, position: 1, status: 1,
      })
      if (isWafBlocked(b1)) { test.skip(true, 'WAF 限流'); return }
      if (isDbUnavailable(b1)) { test.skip(true, '数据库不可用'); return }
      expect(s1).toBe(200)
      expect(isCodeOk(b1?.code)).toBe(true)
      expect(b1?.data?.id).toBeTruthy()
      const newId = b1?.data?.id

      // 2. 查询详情
      const { body: b2 } = await safeGet(request, `/carousel/${newId}`)
      expect(isCodeOk(b2?.code)).toBe(true)
      expect(b2?.data?.id).toBe(newId)
      expect(b2?.data?.title).toBe(title)
      expect(b2?.data?.img).toBe('https://example.com/img.jpg')

      // 3. 修改
      const { body: b3 } = await safePut(request, '/carousel', {
        id: newId, title: `${title}_updated`, sort: 200,
      })
      expect(isCodeOk(b3?.code)).toBe(true)

      // 4. 验证修改真的生效
      const { body: b4 } = await safeGet(request, `/carousel/${newId}`)
      expect(b4?.data?.title).toBe(`${title}_updated`)
      expect(b4?.data?.sort).toBe(200)

      // 5. 删除
      const { body: b5 } = await safeDelete(request, `/carousel/${newId}`)
      expect(isCodeOk(b5?.code)).toBe(true)
      expect(b5?.data?.deleted).toBe(1)

      // 6. 验证删除真的生效
      const { body: b6 } = await safeGet(request, `/carousel/${newId}`)
      expect(b6?.data).toBeNull()
    })

    test('B3: 导出接口（返回跳过消息）', async ({ request }) => {
      const { status, body } = await safePost(request, '/carousel/export', {})
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.exported).toBe(0)
    })

    test('B4: 按标题模糊查询', async ({ request }) => {
      const title = `e2e_search_${Date.now()}`
      await safePost(request, '/carousel', { title, img: 'x', url: 'y', type: 0, sort: 0, position: 0, status: 1 })
      const { status, body } = await safeGet(request, `/carousel/list?title=${encodeURIComponent(title)}&page_num=1&page_size=10`)
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      if (isDbUnavailable(body)) { test.skip(true, '数据库不可用'); return }
      expect(status).toBe(200)
      expect(body?.code).toBe(200)
      expect(body?.data?.total).toBeGreaterThanOrEqual(1)
      for (const r of body?.data?.records || []) {
        expect(r.title).toContain(title)
      }
    })

    test('B5: 修改不存在的记录（返回 500）', async ({ request }) => {
      const { body } = await safePut(request, '/carousel', { id: 999999, title: 'nope' })
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(body?.code).toBe(500)
    })
  })

  // =========================================================================
  // C. v1_app_version.py: 应用版本管理（内存存储 app_version）
  // =========================================================================
  test.describe('C. v1_app_version 应用版本', () => {
    test('C1: 版本列表', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/app-version/list?page=1&size=20')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(body?.data?.v1_path).toBe('/api/v1/app-version/list')
      expect(Array.isArray(body?.data?.records)).toBe(true)
      expect(typeof body?.data?.total).toBe('number')
      expect(body?.data?.total).toBeGreaterThanOrEqual(1)
    })

    test('C2: 版本详情', async ({ request }) => {
      const { status, body } = await safeGet(request, '/api/v1/app-version/info')
      if (isWafBlocked(body)) { test.skip(true, 'WAF 限流'); return }
      expect(status).toBe(200)
      expect(isCodeOk(body?.code)).toBe(true)
      expect(Array.isArray(body?.data?.records)).toBe(true)
    })

    test('C3: 发布新版本→检查更新→最新版本完整流程（真写入验证）', async ({ request }) => {
      const version = `9.9.9_${Date.now()}`
      // 1. 发布新版本
      const { status: s1, body: b1 } = await safePost(request, `/api/v1/app-version/publish?version=${version}&platform=web&changelog=e2e_test`)
      if (isWafBlocked(b1)) { test.skip(true, 'WAF 限流'); return }
      expect(s1).toBe(200)
      expect(isCodeOk(b1?.code)).toBe(true)
      expect(b1?.data?.published).toBe(true)
      expect(b1?.data?.item?.version).toBe(version)

      // 2. 检查更新（当前版本 != 新版本，应需要更新）
      const { body: b2 } = await safePost(request, `/api/v1/app-version/check?current_version=1.0.0&platform=web`)
      expect(isCodeOk(b2?.code)).toBe(true)
      expect(b2?.data?.current).toBe('1.0.0')
      expect(b2?.data?.needs_update).toBe(true)

      // 3. 最新版本应该是刚发布的版本
      const { body: b3 } = await safeGet(request, '/api/v1/app-version/latest')
      expect(isCodeOk(b3?.code)).toBe(true)
      expect(b3?.data?.version?.version).toBe(version)
    })

    test('C4: 检查更新（版本相同不需要更新）', async ({ request }) => {
      // 先获取最新版本
      const { body: b1 } = await safeGet(request, '/api/v1/app-version/latest')
      if (isWafBlocked(b1)) { test.skip(true, 'WAF 限流'); return }
      const latestVersion = b1?.data?.version?.version || '1.0.0'

      // 用最新版本检查更新，应该不需要更新
      const { body: b2 } = await safePost(request, `/api/v1/app-version/check?current_version=${latestVersion}&platform=web`)
      expect(isCodeOk(b2?.code)).toBe(true)
      expect(b2?.data?.needs_update).toBe(false)
    })
  })
})
