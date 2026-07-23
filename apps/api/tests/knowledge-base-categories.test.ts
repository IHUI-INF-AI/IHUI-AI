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
      'innerJoin',
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

import { otherRoutes as frontendStubOtherRoutes } from '../src/routes/other/index.js'

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

function enqueue(...results: unknown[][]) {
  dbQueue.items.push(...results)
}

describe('knowledge-base categories — /api/knowledge-base/categories', () => {
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

  it('未登录 GET /knowledge-base/categories 返回 401', async () => {
    mockUnauthed()
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/knowledge-base/categories`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /knowledge-base/categories 成功 → 200 + code:0 + list 含 id/name/count', async () => {
    mockAuthed()
    enqueue([
      { id: 'cat-1', name: '基础知识', count: 5 },
      { id: 'cat-2', name: '进阶技巧', count: 3 },
    ])
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/knowledge-base/categories`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toHaveLength(2)
    expect(body.data.list[0].id).toBe('cat-1')
    expect(body.data.list[0].name).toBe('基础知识')
    expect(body.data.list[0].count).toBe(5)
    expect(body.data.list[1].id).toBe('cat-2')
    expect(body.data.list[1].name).toBe('进阶技巧')
    expect(body.data.list[1].count).toBe(3)
  })

  it('GET /knowledge-base/categories 空列表 → 200 + code:0 + list:[]', async () => {
    mockAuthed()
    enqueue([])
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/knowledge-base/categories`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toEqual([])
    expect(body.data.list).toHaveLength(0)
  })
})
