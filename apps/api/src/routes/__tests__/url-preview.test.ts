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
 * 4. 路由面:未登录放行 / 参数 400 / 注册即装车(prefix 漂移即红,D29 口径)。
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type * as DnsModule from 'node:dns'
import type * as Undici from 'undici'

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

// 生产出站走 **undici 的 fetch**(2026-10-31 安全强化第 15 批 M3:判定与建连共用同一次解析,
// 收口 TTL=0 rebinding 窗口)—— 只 stub globalThis.fetch 拦不住它(那是 10-31 之前的旧出口),
// 于是路由级用例出现"探测成功但 fetch 替身零调用"。这里把 undici 的 fetch 换成替身。
const h = vi.hoisted(() => ({ undiciFetchStub: vi.fn() }))
vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<typeof Undici>()
  return { ...actual, fetch: h.undiciFetchStub }
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

import {
  clearUrlPreviewCache,
  probeUrl,
  urlPreviewRoutes,
  URL_PREVIEW_TIMEOUT_MS,
} from '../url-preview.js'

/** 公网放行的解析注入(纯函数测试统一用)。 */
const resolveAllowed = async () => false

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

function pngResponse(): Response {
  return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), {
    status: 200,
    headers: { 'content-type': 'image/png' },
  })
}

function notFoundResponse(): Response {
  return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } })
}

/** 从第 2 次请求起一律 404:用于把"页面探测 + 图标兜底尝试"的请求数钉死。 */
function firstCallHtml(html: string) {
  let calls = 0
  return vi.fn(async (_input: string | URL | Request) => {
    calls++
    return calls === 1 ? htmlResponse(html) : notFoundResponse()
  })
}

const SVG_BODY =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#123456"/></svg>'

function svgResponse(body = SVG_BODY): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'image/svg+xml' } })
}

const OK_HTML =
  '<html><head><title>Example Domain</title>' +
  '<meta name="description" content="This domain is for use in examples."></head><body></body></html>'

describe('probeUrl 三态封闭', () => {
  it('① 正常链接:出标题 + 摘要(status=ok)', async () => {
    const fetchImpl = firstCallHtml(OK_HTML)
    const result = await probeUrl('https://example.com/', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
    expect(result.status).toBe('ok')
    expect(result).toMatchObject({
      title: 'Example Domain',
      description: 'This domain is for use in examples.',
    })
    // 页面 1 次 + 无声明时 3 个标准路径兜底(均 404)
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(String(vi.mocked(fetchImpl).mock.calls[0]?.[0])).toBe('https://example.com/')
  })

  it('404 ⇒ unavailable(判定读不到,不是未判定)', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('nope', { status: 404, headers: { 'content-type': 'text/plain' } }),
    )
    const result = await probeUrl('https://example.com/gone', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
    expect(result.status).toBe('unavailable')
    expect(result).toMatchObject({ reason: 'http_404' })
  })

  it('401 ⇒ undetermined(需登录是"未判定",与 404 区别化)', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('auth', { status: 401, headers: { 'content-type': 'text/plain' } }),
    )
    const result = await probeUrl('https://example.com/private', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
    expect(result.status).toBe('undetermined')
    expect(result).toMatchObject({ reason: 'http_401' })
  })

  it('500 ⇒ unavailable(服务端明确读不到)', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('boom', { status: 500, headers: { 'content-type': 'text/plain' } }),
    )
    const result = await probeUrl('https://example.com/boom', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
    expect(result.status).toBe('unavailable')
  })

  it('内网地址 ⇒ undetermined ssrf_blocked,且一次 fetch 都不发', async () => {
    const fetchImpl = vi.fn()
    const result = await probeUrl('http://127.0.0.1:8080/admin', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
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

  // 2026-11-26 实报回归:中文正文紧贴链接被吞进 host ⇒ `new URL` 当伪 IDN 主机解析"成功"
  // ⇒ 旧实现拿它去解析 DNS ⇒ 失败 ⇒ 卡片只剩"暂时无法判定"。主机会形校验必须在 DNS 之前。
  it('中文正文被吞进 host ⇒ undetermined invalid_host,不进 DNS 不发请求', async () => {
    const fetchImpl = vi.fn()
    const resolveForbidden = vi.fn(async () => false)
    const result = await probeUrl('https://example.com，绑定“表单提交确认”模板', {
      fetchImpl,
      resolveForbidden,
    })
    expect(result.status).toBe('undetermined')
    expect(result).toMatchObject({ reason: 'invalid_host' })
    expect(resolveForbidden).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('纯中文 IDN 主机不被误伤(punycode 后可正常探测)', async () => {
    const fetchImpl = firstCallHtml(OK_HTML)
    const result = await probeUrl('https://例子.com/', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
    expect(result.status).toBe('ok')
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(String(vi.mocked(fetchImpl).mock.calls[0]?.[0])).toContain('xn--')
  })

  it('非 HTML 2xx ⇒ ok 无标题(可读,不误报读不到)', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('binary', { status: 200, headers: { 'content-type': 'application/pdf' } }),
    )
    const result = await probeUrl('https://example.com/doc.pdf', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
    expect(result.status).toBe('ok')
    expect(result).not.toHaveProperty('title')
    expect(result).not.toHaveProperty('icon')
  })

  it('ok 携带站点图标:相对 href 按落点解析,大尺寸 apple-touch-icon 优先并内联为 data URL', async () => {
    const html =
      '<html><head><title>T</title>' +
      '<link rel="icon" sizes="32x32" href="/fav-32.png">' +
      '<link rel="apple-touch-icon" sizes="180x180" href="/apple.png">' +
      '</head><body></body></html>'
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      String(input).includes('apple.png') ? pngResponse() : htmlResponse(html),
    )
    const result = await probeUrl('https://example.com/page', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
    expect(result.status).toBe('ok')
    expect(result).toMatchObject({ icon: 'data:image/png;base64,' + 'iVBORw0KGgo=' })
    // 页面一次 + 图标一次:只多抓图标本身,不重抓正文。
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(String(vi.mocked(fetchImpl).mock.calls[1]?.[0])).toBe('https://example.com/apple.png')
  })

  it('重定向落点是图标解析基准(相对 href 不按原始 URL)', async () => {
    const html = '<html><head><title>T</title><link rel="icon" href="/i.png"></head></html>'
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const u = String(input)
      if (u === 'https://final.example.com/i.png') return pngResponse()
      if (u.startsWith('https://final.example.com')) return htmlResponse(html)
      return new Response(null, {
        status: 301,
        headers: { location: 'https://final.example.com/x' },
      })
    })
    const result = await probeUrl('http://example.com/', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
    expect(result.status).toBe('ok')
    expect(result).toMatchObject({ icon: 'data:image/png;base64,' + 'iVBORw0KGgo=' })
  })

  it('页面没有 icon 声明 ⇒ 用 /favicon.ico 兜底成功', async () => {
    let calls = 0
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      calls++
      if (calls === 1) return htmlResponse(OK_HTML)
      const u = String(input)
      if (u === 'https://example.com/favicon.ico') return pngResponse()
      return notFoundResponse()
    })
    const result = await probeUrl('https://example.com/', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
    expect(result).toMatchObject({ icon: 'data:image/png;base64,' + 'iVBORw0KGgo=' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(String(vi.mocked(fetchImpl).mock.calls[1]?.[0])).toBe('https://example.com/favicon.ico')
  })

  it('页面没有 icon 声明且标准路径都没有 ⇒ 不返回图标(回落字母块)', async () => {
    const fetchImpl = firstCallHtml(OK_HTML)
    const result = await probeUrl('https://example.com/', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
    expect(result).not.toHaveProperty('icon')
    // 页面 1 次 + favicon.ico/favicon.png/apple-touch-icon.png 三次 404
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it('声明图标 404 ⇒ 继续尝试 /favicon.ico(候选链不因首选失败而放弃)', async () => {
    const html = '<html><head><title>T</title><link rel="icon" href="/missing.png"></head></html>'
    let calls = 0
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      calls++
      if (calls === 1) return htmlResponse(html)
      const u = String(input)
      if (u === 'https://example.com/missing.png') return notFoundResponse()
      if (u === 'https://example.com/favicon.ico') return pngResponse()
      return notFoundResponse()
    })
    const result = await probeUrl('https://example.com/', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
    expect(result).toMatchObject({ icon: 'data:image/png;base64,' + 'iVBORw0KGgo=' })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('图标指向内网 ⇒ 不抓该地址;标准路径兜底也 404 时不返回图标', async () => {
    const html =
      '<html><head><title>T</title><link rel="icon" href="http://127.0.0.1/icon.png"></head></html>'
    let calls = 0
    const fetchImpl = vi.fn(async (_input: string | URL | Request) => {
      calls++
      return calls === 1 ? htmlResponse(html) : notFoundResponse()
    })
    const result = await probeUrl('https://example.com/', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
    expect(result).not.toHaveProperty('icon')
    expect(fetchImpl.mock.calls.some(([u]) => String(u).includes('127.0.0.1'))).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it('声明 SVG 图标 ⇒ 直接内联为 data:image/svg+xml(不再多抓位图)', async () => {
    const html =
      '<html><head><title>T</title><link rel="icon" type="image/svg+xml" href="/logo.svg"></head></html>'
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      String(input).includes('/logo.svg') ? svgResponse() : htmlResponse(html),
    )
    const result = await probeUrl('https://example.com/', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
    expect(result).toMatchObject({
      icon: 'data:image/svg+xml;base64,' + Buffer.from(SVG_BODY).toString('base64'),
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('带 <script> 的 SVG 拒收(不把可执行文档塞进图标位)', async () => {
    const html = '<html><head><title>T</title><link rel="icon" href="/evil.svg"></head></html>'
    const dangerous = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    let calls = 0
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      calls++
      if (calls === 1) return htmlResponse(html)
      const u = String(input)
      if (u === 'https://example.com/evil.svg') return svgResponse(dangerous)
      return notFoundResponse()
    })
    const result = await probeUrl('https://example.com/', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
    expect(result).not.toHaveProperty('icon')
  })

  it('200 + text/html 的软 404 不当作图标(只信字节 magic)', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const u = String(input)
      if (u === 'https://example.com/') return htmlResponse(OK_HTML)
      return new Response('<html><body>not an icon</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    })
    const result = await probeUrl('https://example.com/', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
    expect(result).not.toHaveProperty('icon')
  })

  it('<base href> 改变相对图标的解析基准', async () => {
    const html =
      '<html><head><base href="https://cdn.example.com/assets/"><title>T</title>' +
      '<link rel="icon" href="icon.png"></head></html>'
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      String(input) === 'https://cdn.example.com/assets/icon.png'
        ? pngResponse()
        : htmlResponse(html),
    )
    const result = await probeUrl('https://example.com/page', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
    expect(result).toMatchObject({ icon: 'data:image/png;base64,' + 'iVBORw0KGgo=' })
    expect(String(vi.mocked(fetchImpl).mock.calls[1]?.[0])).toBe(
      'https://cdn.example.com/assets/icon.png',
    )
  })

  it('重定向手动跟随:301 → 落点取标题(逐跳探测)', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) =>
      String(input).startsWith('https://final.example.com')
        ? htmlResponse(OK_HTML)
        : new Response(null, { status: 301, headers: { location: 'https://final.example.com/' } }),
    )
    const result = await probeUrl('http://example.com/', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
    expect(result.status).toBe('ok')
    expect(result).toMatchObject({ title: 'Example Domain' })
    // 原始页 301 + 落点页 1 + 无声明时 3 个标准路径兜底
    expect(fetchImpl).toHaveBeenCalledTimes(5)
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
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('The operation was aborted')),
          )
        }),
    )
    const pending = probeUrl('https://slow.example.com/', {
      fetchImpl,
      resolveForbidden: resolveAllowed,
    })
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
  beforeEach(() => {
    // 模块级缓存跨用例带状态会让"请求数"断言假红,每个用例先清空。
    clearUrlPreviewCache()
  })

  async function build() {
    const app = Fastify()
    await app.register(urlPreviewRoutes, { prefix: '/api/url-preview' })
    return app
  }

  it('未登录/token 过期仍可探测(200),不再因 401 退化成"网络不可达"', async () => {
    const fetchStub = h.undiciFetchStub
    fetchStub.mockReset()
    fetchStub.mockImplementation(async (input: string | URL | Request) =>
      String(input) === 'https://example.com/' ? htmlResponse(OK_HTML) : notFoundResponse(),
    )
    const app = await build()
    authState.fail = true
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/url-preview/preview?url=https%3A%2F%2Fexample.com%2F',
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data).toMatchObject({ status: 'ok', title: 'Example Domain' })
    } finally {
      authState.fail = false
      await app.close()
    }
  })

  it('缺 url 参数 400;正常探测回三态 envelope', async () => {
    const fetchStub = h.undiciFetchStub
    fetchStub.mockReset()
    fetchStub.mockImplementation(async (input: string | URL | Request) =>
      String(input) === 'https://example.com/' ? htmlResponse(OK_HTML) : notFoundResponse(),
    )
    const app = await build()
    try {
      const bad = await app.inject({ method: 'GET', url: '/api/url-preview/preview' })
      expect(bad.statusCode).toBe(400)

      const good = await app.inject({
        method: 'GET',
        url: '/api/url-preview/preview?url=https%3A%2F%2Fexample.com%2F',
      })
      expect(good.statusCode).toBe(200)
      const body = good.json()
      expect(body.code).toBe(0)
      expect(body.data).toMatchObject({ status: 'ok', title: 'Example Domain' })
      expect(fetchStub).toHaveBeenCalledTimes(4)
    } finally {
      vi.unstubAllGlobals()
      await app.close()
    }
  })

  it('同 URL 第二次命中缓存,不再重复出站', async () => {
    const fetchStub = h.undiciFetchStub
    fetchStub.mockReset()
    fetchStub.mockImplementation(async (input: string | URL | Request) =>
      String(input) === 'https://example.com/' ? htmlResponse(OK_HTML) : notFoundResponse(),
    )
    const app = await build()
    try {
      const first = await app.inject({
        method: 'GET',
        url: '/api/url-preview/preview?url=https%3A%2F%2Fexample.com%2F',
      })
      expect(first.statusCode).toBe(200)
      expect(fetchStub).toHaveBeenCalledTimes(4)

      const second = await app.inject({
        method: 'GET',
        url: '/api/url-preview/preview?url=https%3A%2F%2Fexample.com%2F',
      })
      expect(second.statusCode).toBe(200)
      expect(second.json().data).toMatchObject({ status: 'ok', title: 'Example Domain' })
      // 页面 + 3 个 favicon 兜底只在首次发生;第二次必须零出站。
      expect(fetchStub).toHaveBeenCalledTimes(4)
    } finally {
      await app.close()
    }
  })

  it('注册即装车:routes/index.ts import + prefix 漂移即红(D29 口径)', () => {
    const indexSrc = readFileSync(join(API_ROOT, 'src', 'routes', 'index.ts'), 'utf8')
    expect(indexSrc).toMatch(/import\s*\{\s*urlPreviewRoutes\s*\}\s*from\s*'\.\/url-preview\.js'/u)
    expect(indexSrc).toMatch(
      /server\.register\(\s*urlPreviewRoutes\s*,\s*\{\s*prefix:\s*'\/api\/url-preview'/u,
    )
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
