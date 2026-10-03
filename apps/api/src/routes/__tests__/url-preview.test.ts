// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * D166 链接预览探测测试(2026-09-30 立)。
 *
 * 覆盖(票面验收 ①②):
 * 1. probeUrl 三态封闭:正常链接出标题/摘要;404/5xx ⇒ unavailable;
 *    401/超时/SSRF 内网 ⇒ undetermined(区别化,"把没判写成判过"禁令)。
 * 2. 超时显式 3s 生效,且**请求数 == 1**(不重试、绝不两次抓正文)。
 * 3. 重定向手动跟随(落点 SSRF 复检);非 HTML 2xx ⇒ ok 无标题(不误报读不到)。
 * 4. 路由面:鉴权 401 / 参数 400 / 注册即装车(prefix 漂移即红,D29 口径)。
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type * as DnsModule from 'node:dns'

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'

const HERE = dirname(fileURLToPath(import.meta.url))
const API_ROOT = resolve(HERE, '..', '..', '..')

// DNS 解析级复检在单测里mock成公网地址(不依赖真实网络)。
vi.mock('node:dns', async (importOriginal) => {
  const actual = await importOriginal<typeof DnsModule>()
  return {
    ...actual,
    promises: {
      ...actual.promises,
      lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
    },
  }
})

// 鉴权 mock(形态对齐 team-memory 路由测试)。
const authState = vi.hoisted(() => ({ fail: false, userId: 'user-1' }))
vi.mock('../../plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    if (authState.fail) throw new Error('unauthorized')
    request.userId = authState.userId
    return undefined
  }),
}))

import { probeUrl, urlPreviewRoutes, URL_PREVIEW_TIMEOUT_MS } from '../url-preview.js'

/** 公网放行的解析注入(纯函数测试统一用)。 */
const resolveAllowed = async () => false

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

const OK_HTML =
  '<html><head><title>Example Domain</title>' +
  '<meta name="description" content="This domain is for use in examples."></head><body></body></html>'

describe('probeUrl 三态封闭', () => {
  it('① 正常链接:出标题 + 摘要(status=ok)', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse(OK_HTML))
    const result = await probeUrl('https://example.com/', { fetchImpl, resolveForbidden: resolveAllowed })
    expect(result.status).toBe('ok')
    expect(result).toMatchObject({ title: 'Example Domain', description: 'This domain is for use in examples.' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('404 ⇒ unavailable(判定读不到,不是未判定)', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 404, headers: { 'content-type': 'text/plain' } }))
    const result = await probeUrl('https://example.com/gone', { fetchImpl, resolveForbidden: resolveAllowed })
    expect(result.status).toBe('unavailable')
    expect(result).toMatchObject({ reason: 'http_404' })
  })

  it('401 ⇒ undetermined(需登录是"未判定",与 404 区别化)', async () => {
    const fetchImpl = vi.fn(async () => new Response('auth', { status: 401, headers: { 'content-type': 'text/plain' } }))
    const result = await probeUrl('https://example.com/private', { fetchImpl, resolveForbidden: resolveAllowed })
    expect(result.status).toBe('undetermined')
    expect(result).toMatchObject({ reason: 'http_401' })
  })

  it('500 ⇒ unavailable(服务端明确读不到)', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 500, headers: { 'content-type': 'text/plain' } }))
    const result = await probeUrl('https://example.com/boom', { fetchImpl, resolveForbidden: resolveAllowed })
    expect(result.status).toBe('unavailable')
  })

  it('内网地址 ⇒ undetermined ssrf_blocked,且一次 fetch 都不发', async () => {
    const fetchImpl = vi.fn()
    const result = await probeUrl('http://127.0.0.1:8080/admin', { fetchImpl, resolveForbidden: resolveAllowed })
    expect(result.status).toBe('undetermined')
    expect(result).toMatchObject({ reason: 'ssrf_blocked' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('DNS 解析到私网 ⇒ undetermined ssrf_blocked(解析级复检)', async () => {
    const fetchImpl = vi.fn()
    const result = await probeUrl('https://rebind.example.com/', {
      fetchImpl,
      resolveForbidden: async () => true,
    })
    expect(result.status).toBe('undetermined')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('非 HTML 2xx ⇒ ok 无标题(可读,不误报读不到)', async () => {
    const fetchImpl = vi.fn(async () => new Response('binary', { status: 200, headers: { 'content-type': 'application/pdf' } }))
    const result = await probeUrl('https://example.com/doc.pdf', { fetchImpl, resolveForbidden: resolveAllowed })
    expect(result.status).toBe('ok')
    expect(result).not.toHaveProperty('title')
  })

  it('重定向手动跟随:301 → 落点取标题(逐跳探测)', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      String(input).startsWith('https://final.example.com')
        ? htmlResponse(OK_HTML)
        : new Response(null, { status: 301, headers: { location: 'https://final.example.com/' } }),
    )
    const result = await probeUrl('http://example.com/', { fetchImpl, resolveForbidden: resolveAllowed })
    expect(result.status).toBe('ok')
    expect(result).toMatchObject({ title: 'Example Domain' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})

describe('probeUrl 超时与一次探测(票面验收 ②)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })
  afterAll(() => {
    vi.restoreAllMocks()
  })

  it('超时显式生效(3s)且请求数 == 1:挂起的 fetch 被 abort,不重试不二抓', async () => {
    const fetchImpl = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('The operation was aborted')))
        }),
    )
    const pending = probeUrl('https://slow.example.com/', { fetchImpl, resolveForbidden: resolveAllowed })
    const result = await vi.advanceTimersByTimeAsync(URL_PREVIEW_TIMEOUT_MS).then(() => pending)
    expect(result.status).toBe('undetermined')
    expect(result).toMatchObject({ reason: 'timeout' })
    // 防双抓断言:整个探测周期对同一 URL 只发一次请求。
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

// ─────────────────────────────────────────────────────────────
// 路由面:鉴权 / 参数 / 装车
// ─────────────────────────────────────────────────────────────

describe('GET /api/url-preview/preview 路由面', () => {
  async function build() {
    const app = Fastify()
    await app.register(urlPreviewRoutes, { prefix: '/api/url-preview' })
    return app
  }

  it('未登录 401', async () => {
    const app = await build()
    authState.fail = true
    try {
      const res = await app.inject({ method: 'GET', url: '/api/url-preview/preview?url=https://example.com/' })
      expect(res.statusCode).toBe(401)
    } finally {
      authState.fail = false
      await app.close()
    }
  })

  it('缺 url 参数 400;正常探测回三态 envelope', async () => {
    const fetchStub = vi.fn(async () => htmlResponse(OK_HTML))
    vi.stubGlobal('fetch', fetchStub)
    const app = await build()
    try {
      const bad = await app.inject({ method: 'GET', url: '/api/url-preview/preview' })
      expect(bad.statusCode).toBe(400)

      const good = await app.inject({ method: 'GET', url: '/api/url-preview/preview?url=https%3A%2F%2Fexample.com%2F' })
      expect(good.statusCode).toBe(200)
      const body = good.json()
      expect(body.code).toBe(0)
      expect(body.data).toMatchObject({ status: 'ok', title: 'Example Domain' })
      expect(fetchStub).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
      await app.close()
    }
  })

  it('注册即装车:routes/index.ts import + prefix 漂移即红(D29 口径)', () => {
    const indexSrc = readFileSync(join(API_ROOT, 'src', 'routes', 'index.ts'), 'utf8')
    expect(indexSrc).toMatch(/import\s*\{\s*urlPreviewRoutes\s*\}\s*from\s*'\.\/url-preview\.js'/u)
    expect(indexSrc).toMatch(/server\.register\(\s*urlPreviewRoutes\s*,\s*\{\s*prefix:\s*'\/api\/url-preview'/u)
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠