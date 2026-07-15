import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type * as dns from 'node:dns'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

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

  beforeEach(() => {
    global.fetch = originalFetch
  })

  it('正常转发返回 200 与响应体', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ hello: 'world' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch

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
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({ method: 'GET' }),
    )
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
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error('connect ECONNREFUSED')) as unknown as typeof fetch

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
    let capturedOpts: RequestInit | undefined
    global.fetch = vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
      capturedOpts = opts
      return Promise.resolve(
        new Response(JSON.stringify({ created: true }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      )
    }) as unknown as typeof fetch

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
    expect(capturedOpts?.method).toBe('POST')
    expect(capturedOpts?.body).toBe(JSON.stringify({ name: 'test' }))
  })

  it('代理目标返回非 JSON 时仍返回 200 与文本 body', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('plain text response', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    ) as unknown as typeof fetch

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
