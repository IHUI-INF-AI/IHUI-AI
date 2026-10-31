// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type * as dns from 'node:dns'
import type * as dnsPromises from 'node:dns/promises'
// 鉴权 mock 辅助(2026-09-09 第九轮安全修复后,/remote/proxy 等路由收权为 admin)。
// 注意:必须内联,勿 import tests/helpers/mock-auth —— 该文件在 tsconfig rootDir(src)外,
// tsc 顺藤摸瓜报 TS6059,级联 typecheck/build/Docker/e2e 全挂(2026-09-10 CI 实证)。
const mockAuthenticate = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const mockCheckAuth = async (...args: unknown[]): Promise<boolean> => {
  try {
    await mockAuthenticate(...args)
    return true
  } catch (e) {
    const err = e as Error & { statusCode?: number }
    const reply = args[1] as { status: (code: number) => { send: (body: unknown) => unknown } }
    const statusCode = err.statusCode ?? 401
    reply
      .status(statusCode)
      .send({ code: statusCode, message: err.message || 'Authentication required' })
    return false
  }
}
// restoreAllMocks 会清掉 mockImplementation,每个用例前需重新注入 admin 身份
const setMockAdmin = (userId: string): void => {
  const payload = { userId, roleId: 1, type: 'access' }
  mockAuthenticate.mockImplementation(async (request: unknown) => {
    ;(request as { userId: string }).userId = userId
    ;(request as { jwtPayload?: unknown }).jwtPayload = payload
    return payload
  })
}

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// misc-extended.ts 经 require-permission.ts 以 './auth.js' 导入 authenticate,
// 与此处 '../../plugins/auth.js' 解析到同一模块。整模块 mock 后工厂必须
// 显式提供全部导出,否则路由拿到 undefined → 500。
vi.mock('../../plugins/auth.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  requireActiveUser: vi.fn(),
  checkAuth: (...args: unknown[]) => mockCheckAuth(...args),
  checkAuthOrInternalService: (...args: unknown[]) => mockCheckAuth(...args),
}))

vi.mock('node:dns', async () => {
  const actual = await vi.importActual<typeof dns>('node:dns')
  return {
    ...actual,
    promises: {
      ...actual.promises,
      lookup: vi.fn().mockImplementation(async () => [{ address: '8.8.8.8', family: 4 }]),
    },
  }
})

// utils/ssrf-guard.ts 用的是子模块说明符 `node:dns/promises`(直接 import { lookup }),
// 上面那条 mock 覆盖不到它 ⇒ 本用例此前会走真 DNS。两侧都必须钉成公网 IP,
// 否则"unreachable.example.com 解析失败"会被守卫判成 unsafe 提前 400,量不到 502 那一档。
vi.mock('node:dns/promises', async () => {
  const actual = await vi.importActual<typeof dnsPromises>('node:dns/promises')
  return {
    ...actual,
    default: {
      ...actual,
      lookup: vi.fn().mockImplementation(async () => [{ address: '8.8.8.8', family: 4 }]),
    },
    lookup: vi.fn().mockImplementation(async () => [{ address: '8.8.8.8', family: 4 }]),
  }
})

vi.mock('../../db/index.js', () => {
  interface DbChain {
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
    from: () => DbChain
    where: () => DbChain
    orderBy: () => DbChain
    limit: () => DbChain
    offset: () => DbChain
    values: () => DbChain
    set: () => DbChain
    returning: () => DbChain
  }
  function createChain(result: unknown[] = []): DbChain {
    const chain: DbChain = {
      then: (resolve) => Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      values: () => chain,
      set: () => chain,
      returning: () => chain,
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() => createChain()),
      insert: vi.fn(() => createChain()),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
    },
  }
})

/**
 * 出站替身必须 mock 'undici':2026-10-31 安全强化第 15 批 M3 起 ssrf-guard.safeFetch
 * 用 `import { fetch as undiciFetch } from 'undici'` + connect-time dispatcher
 * (判定与建连共用同一次解析,收 DNS rebinding TOCTOU),不再吃 global.fetch。
 * 本文件的替身若继续挂在 global.fetch 上 ⇒ 六档全部**真连公网**(实读 150s),
 * 且"摘掉 safeFetch 即翻红"这条变异自证会悄悄失效(桩与生产不同名,永远 0 调用)。
 * global.fetch 仍复位成真实现并留作哨兵:路由若绕回全局 fetch 当场可辨。
 */
const { undiciFetchStub } = vi.hoisted(() => ({ undiciFetchStub: vi.fn() }))
vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<typeof import('undici')>()
  return { ...actual, fetch: undiciFetchStub }
})

import miscExtendedRoutes from '../misc-extended.js'

const originalFetch = global.fetch

describe('Misc Extended API — POST /remote/proxy', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(miscExtendedRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    global.fetch = originalFetch
  })

  let globalFetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // 全局位换成"永不真发"的哨兵 spy:绕回 global.fetch 的写法会被计数,
    // 而本文件任何一档都不可能真出网(挂真实现时 expect(...).not.toHaveBeenCalled()
    // 还会因"不是 spy"直接报错)。
    globalFetchSpy = vi.fn()
    global.fetch = globalFetchSpy as unknown as typeof fetch
    undiciFetchStub.mockReset()
    setMockAdmin('00000000-0000-4000-8000-000000000001')
  })

  it('正常转发返回 200 与响应体', async () => {
    undiciFetchStub.mockResolvedValue(
      new Response(JSON.stringify({ hello: 'world' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/remote/proxy',
      payload: {
        url: 'https://example.com/api',
        method: 'GET',
      },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.status).toBe(200)
    expect(body.data.body).toEqual({ hello: 'world' })
    // undici.fetch 的第二参之外还带 dispatcher(第三参)⇒ 按位置逐条断言:
    // toHaveBeenCalledWith 会连参数个数一起比,dispatcher 一变就假红。
    expect(undiciFetchStub).toHaveBeenCalledTimes(1)
    expect(String(undiciFetchStub.mock.calls[0]?.[0])).toBe('https://example.com/api')
    expect(undiciFetchStub.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' })
    expect(globalFetchSpy, '路由不得绕回全局 fetch').not.toHaveBeenCalled()
  })

  // 本路由自带的一套 isPrivateIPv4 缺下面这些族(收口到 utils/ssrf-guard.ts 之前实测可穿透)。
  // 摘掉路由里对 assertSafeFetchUrl / safeFetch 的调用,这三条即翻红 —— 本票的变异自证。
  // 桩位现挂 undici.fetch(M3 起的真出口):摘掉守卫时这两条计数都会动,不会因"桩与
  // 生产不同名"而永远 0 调用(那是上一形态的静默失效)。
  it.each([
    ['CGNAT 100.64.0.0/10', 'http://100.64.0.1/latest/meta-data'],
    ['组播 224.0.0.0/4', 'http://224.0.0.1/latest/meta-data'],
    ['v4-mapped IPv6 内嵌回环', 'http://[::ffff:127.0.0.1]:8080/'],
  ])('SSRF 判据补齐族:%s 直接 400 且一次都不出站', async (_label, url) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/remote/proxy',
      payload: { url, method: 'GET' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('SSRF')
    expect(undiciFetchStub, '守卫应在建连之前就把这一跳拒掉').not.toHaveBeenCalled()
    expect(globalFetchSpy).not.toHaveBeenCalled()
  })

  it('重定向落点复检:302 指向元数据地址时,内网那跳绝不被请求', async () => {
    undiciFetchStub.mockImplementation(async (u: string) =>
      String(u).startsWith('https://redirects.example.com')
        ? new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } })
        : new Response('SHOULD NOT BE REACHED', { status: 200 }),
    )
    const res = await app.inject({
      method: 'POST',
      url: '/api/remote/proxy',
      payload: { url: 'https://redirects.example.com/api', method: 'GET' },
    })
    const urlsCalled = undiciFetchStub.mock.calls.map((c) => String(c[0]))
    // 关键断言:副作用没发生 —— 元数据地址一次都没被请求(§5 认证不等于授权同一条纪律)
    expect(urlsCalled.some((u) => u.includes('169.254.169.254'))).toBe(false)
    // 正向对照:首跳确实发出去了(不是"整条路由没跑")
    expect(urlsCalled.some((u) => u.includes('redirects.example.com'))).toBe(true)
    expect(res.statusCode).toBe(502)
  })

  it('无 body 参数返回 400 参数错误', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/remote/proxy',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.code).toBe(400)
    expect(body.message).toBe('参数错误')
  })

  it('fetch 抛出异常时返回 502 proxy_failed', async () => {
    undiciFetchStub.mockRejectedValue(new Error('connect ECONNREFUSED'))

    const res = await app.inject({
      method: 'POST',
      url: '/api/remote/proxy',
      payload: {
        url: 'https://unreachable.example.com',
        method: 'GET',
      },
    })
    expect(res.statusCode).toBe(502)
    const body = res.json()
    expect(body.error).toBe('proxy_failed')
    expect(body.message).toContain('connect ECONNREFUSED')
  })

  it('POST 方法转发时携带 body', async () => {
    undiciFetchStub.mockResolvedValue(
      new Response(JSON.stringify({ created: true }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/remote/proxy',
      payload: {
        url: 'https://example.com/api/create',
        method: 'POST',
        body: { name: 'test' },
      },
    })
    expect(res.statusCode).toBe(201)
    const opts = undiciFetchStub.mock.calls[0]?.[1] as RequestInit | undefined
    expect(opts?.method).toBe('POST')
    expect(opts?.body).toBe(JSON.stringify({ name: 'test' }))
  })

  it('代理目标返回非 JSON 时仍返回 200 与文本 body', async () => {
    undiciFetchStub.mockResolvedValue(
      new Response('plain text response', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/remote/proxy',
      payload: {
        url: 'https://example.com/text',
        method: 'GET',
      },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.status).toBe(200)
    expect(body.data.body).toBe('plain text response')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
