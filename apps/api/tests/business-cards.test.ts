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
const CARD_ID = '11111111-1111-1111-1111-111111111111'
const PREFIX = '/api'

function mockAuthed(userId: string = USER_ID) {
  mockAuthenticate.mockImplementation(async (request: { userId?: string; jwtPayload?: unknown }) => {
    request.userId = userId
    request.jwtPayload = { userId, roleId: 0 }
  })
}

function mockUnauthed() {
  const err = new Error('Authentication required')
  ;(err as Error & { statusCode: number }).statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

function enqueue(...results: unknown[][]) {
  dbQueue.items.push(...results)
}

describe('business-card routes — /api/business-card/*', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600
          ? err.statusCode
          : 500
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

  it('未登录 GET /business-card/:id 返回 401', async () => {
    mockUnauthed()
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/business-card/${CARD_ID}`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /business-card/:id 存在 → 200 + viewCount +1', async () => {
    mockAuthed()
    enqueue(
      [{ id: CARD_ID, userId: USER_ID, name: '张三', viewCount: 5, isPublic: true }],
    )
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/business-card/${CARD_ID}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.viewCount).toBe(6)
    expect(body.data.name).toBe('张三')
  })

  it('GET /business-card/:id 不存在 → 404', async () => {
    mockAuthed()
    enqueue([])
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/business-card/${CARD_ID}`,
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.code).toBe(404)
  })

  it('POST /business-card/:id 创建名片 → 201 + created:true', async () => {
    mockAuthed()
    enqueue(
      [],
      [{ id: CARD_ID, userId: USER_ID, name: '李四', viewCount: 0, isPublic: true }],
    )
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/business-card/${USER_ID}`,
      body: { name: '李四', title: '工程师', company: 'ACME' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.created).toBe(true)
    expect(body.data.card.name).toBe('李四')
  })

  it('POST /business-card/:id 更新已有名片 → 201 + created:false', async () => {
    mockAuthed()
    enqueue(
      [{ id: CARD_ID, userId: USER_ID, name: '旧名', viewCount: 3, isPublic: true }],
      [{ id: CARD_ID, userId: USER_ID, name: '新名', viewCount: 3, isPublic: true }],
    )
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/business-card/${USER_ID}`,
      body: { name: '新名' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data.created).toBe(false)
    expect(body.data.card.name).toBe('新名')
  })

  it('POST /business-card/:id/favorite 新收藏 → 201 + existed:false', async () => {
    mockAuthed()
    enqueue(
      [{ id: CARD_ID, userId: USER_ID, name: '张三', isPublic: true }],
      [],
      [{ id: 'fav-1', userId: USER_ID, cardId: CARD_ID }],
    )
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/business-card/${CARD_ID}/favorite`,
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data.favorited).toBe(true)
    expect(body.data.existed).toBe(false)
  })

  it('POST /business-card/:id/favorite 幂等:已收藏 → 201 + existed:true', async () => {
    mockAuthed()
    enqueue(
      [{ id: CARD_ID, userId: USER_ID, name: '张三', isPublic: true }],
      [{ id: 'fav-1', userId: USER_ID, cardId: CARD_ID }],
    )
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/business-card/${CARD_ID}/favorite`,
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data.favorited).toBe(true)
    expect(body.data.existed).toBe(true)
  })

  it('POST /business-card/:id/favorite 名片不存在 → 404', async () => {
    mockAuthed()
    enqueue([])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/business-card/${CARD_ID}/favorite`,
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /business-card/:id 非所有者 → 403', async () => {
    mockAuthed()
    enqueue([
      { id: CARD_ID, userId: '22222222-2222-2222-2222-222222222222', name: '他人的', isPublic: true },
    ])
    const res = await server.inject({
      method: 'DELETE',
      url: `${PREFIX}/business-card/${CARD_ID}`,
    })
    expect(res.statusCode).toBe(403)
  })

  it('GET /business-card/favorites 返回收藏列表(分页)', async () => {
    mockAuthed()
    const card = { id: CARD_ID, userId: USER_ID, name: '张三', isPublic: true, viewCount: 0 }
    enqueue(
      [{ ...card, favoritedAt: new Date() }],
      [{ count: 1 }],
    )
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/business-card/favorites?page=1&pageSize=10`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toHaveLength(1)
    expect(body.data.total).toBe(1)
    expect(body.data.page).toBe(1)
    expect(body.data.pageSize).toBe(10)
  })
})
