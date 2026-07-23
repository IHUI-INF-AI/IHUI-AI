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
      'leftJoin',
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
const OTHER_USER = '00000000-0000-0000-0000-000000000002'
const NOTE_ID = '11111111-1111-1111-1111-111111111111'
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

describe('notes routes — POST /api/notes + GET /api/notes/public + GET /api/notes/:id + DELETE', () => {
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

  // =====================================================================
  // POST /api/notes
  // =====================================================================

  it('未登录 POST /notes 返回 401', async () => {
    mockUnauthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/notes`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 't', content: 'c' }),
    })
    expect(res.statusCode).toBe(401)
  })

  it('body 缺 title → 400', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/notes`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'c' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('body 缺 content → 400', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/notes`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 't' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('合法 body → 201 + 包含新笔记 id', async () => {
    mockAuthed()
    enqueue([{ id: NOTE_ID }])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/notes`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '新笔记', content: '内容' }),
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.id).toBe(NOTE_ID)
  })

  // =====================================================================
  // GET /api/notes/public
  // =====================================================================

  it('未登录 GET /notes/public → 401 (preHandler 拦截)', async () => {
    mockUnauthed()
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/notes/public` })
    expect(res.statusCode).toBe(401)
  })

  it('GET /notes/public 登录后 → 200 + 列表', async () => {
    mockAuthed()
    enqueue([
      {
        id: NOTE_ID,
        title: '公开笔记',
        content: '内容摘要',
        createdAt: new Date('2026-01-01'),
        author: '张三',
      },
    ])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/notes/public` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data[0].title).toBe('公开笔记')
    expect(body.data[0].summary).toBe('内容摘要')
    expect(body.data[0].author).toBe('张三')
  })

  // =====================================================================
  // GET /api/notes/:id
  // =====================================================================

  it('未登录 GET /notes/:id → 401', async () => {
    mockUnauthed()
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/notes/${NOTE_ID}` })
    expect(res.statusCode).toBe(401)
  })

  it('GET /notes/:id 笔记不存在 → 404', async () => {
    mockAuthed()
    enqueue([])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/notes/${NOTE_ID}` })
    expect(res.statusCode).toBe(404)
  })

  it('GET 公开笔记 → 200 + 内容', async () => {
    mockAuthed(USER_ID)
    enqueue([
      {
        id: NOTE_ID,
        title: '公开',
        content: 'c',
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: OTHER_USER,
        author: '李四',
      },
    ])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/notes/${NOTE_ID}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.title).toBe('公开')
    expect(body.data.author).toBe('李四')
  })

  it('GET 私有笔记(非所有者) → 403', async () => {
    mockAuthed(USER_ID)
    enqueue([
      {
        id: NOTE_ID,
        title: '私有',
        content: 'c',
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: OTHER_USER,
        author: '李四',
      },
    ])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/notes/${NOTE_ID}` })
    expect(res.statusCode).toBe(403)
  })

  it('GET 私有笔记(所有者) → 200', async () => {
    mockAuthed(USER_ID)
    enqueue([
      {
        id: NOTE_ID,
        title: '我的私有',
        content: 'c',
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: USER_ID,
        author: '我',
      },
    ])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/notes/${NOTE_ID}` })
    expect(res.statusCode).toBe(200)
  })

  // =====================================================================
  // DELETE /api/notes/:id
  // =====================================================================

  it('未登录 DELETE /notes/:id → 401', async () => {
    mockUnauthed()
    const res = await server.inject({ method: 'DELETE', url: `${PREFIX}/notes/${NOTE_ID}` })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE 笔记不存在 → 404', async () => {
    mockAuthed()
    enqueue([])
    const res = await server.inject({ method: 'DELETE', url: `${PREFIX}/notes/${NOTE_ID}` })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE 非所有者 → 403', async () => {
    mockAuthed(USER_ID)
    enqueue([{ id: NOTE_ID, userId: OTHER_USER }])
    const res = await server.inject({ method: 'DELETE', url: `${PREFIX}/notes/${NOTE_ID}` })
    expect(res.statusCode).toBe(403)
  })

  it('DELETE 所有者 → 200 + deleted:true', async () => {
    mockAuthed(USER_ID)
    enqueue([{ id: NOTE_ID, userId: USER_ID }])
    const res = await server.inject({ method: 'DELETE', url: `${PREFIX}/notes/${NOTE_ID}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.deleted).toBe(true)
  })
})
