import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockAuthenticate, dbQueue } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  dbQueue: { items: [] as unknown[][] },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

vi.mock('../src/db/index.js', () => {
  function createChain() {
    const chain: {
      then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => {
        const result = dbQueue.items.length > 0 ? dbQueue.items.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    for (const m of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'values',
      'set',
      'returning',
      'select',
    ]) {
      chain[m] = () => chain
    }
    return chain
  }
  const factory = () => createChain()
  const dbMock = {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(factory),
    insert: vi.fn(factory),
    update: vi.fn(factory),
    delete: vi.fn(factory),
  }
  return { db: dbMock, dbRead: dbMock }
})

import { frontendStubOtherRoutes } from '../src/routes/frontend-stub-other-routes.js'

const USER_ID = '00000000-0000-0000-0000-000000000001'
const PREFIX = '/api'

function mockAuthed(userId: string = USER_ID) {
  mockAuthenticate.mockImplementation(
    async (request: { userId?: string; jwtPayload?: unknown }) => {
      request.userId = userId
      request.jwtPayload = { userId, roleId: 0 }
    },
  )
}

function mockUnauthed() {
  const err = new Error('Authentication required')
  ;(err as Error & { statusCode: number }).statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

describe('shares routes — POST /api/shares (mobile-rn ShareScreen)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : err.message,
      })
    })
    await server.register(frontendStubOtherRoutes, { prefix: PREFIX })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    dbQueue.items.length = 0
    mockAuthenticate.mockReset()
  })

  it('未登录 POST /shares → 401', async () => {
    mockUnauthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/shares`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'note', targetId: 'note-123' }),
    })
    expect(res.statusCode).toBe(401)
  })

  it('body 缺 targetType → 400', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/shares`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetId: 'note-123' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('body 缺 targetId → 400', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/shares`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'note' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('合法 body → 201 + shareUrl + shareCode + 7 天 expireAt', async () => {
    mockAuthed()
    // shares 路由不需要返回值(insert().values() chain.then([])),chain 会返回 []
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/shares`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        targetType: 'note',
        targetId: 'note-123',
        remark: '分享备注',
      }),
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.shareUrl).toMatch(/^https:\/\/aizhs\.top\/s\/[a-f0-9]{16}$/)
    expect(body.data.shareCode).toMatch(/^[a-f0-9]{16}$/)
    // expireAt 应是 7 天后
    const expireAt = new Date(body.data.expireAt)
    const now = Date.now()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    const diff = expireAt.getTime() - now
    expect(diff).toBeGreaterThan(sevenDays - 60_000)
    expect(diff).toBeLessThan(sevenDays + 60_000)
  })
})
