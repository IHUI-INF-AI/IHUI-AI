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

describe('notes routes — PUT /api/notes/:id', () => {
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

  it('未登录 PUT /notes/:id 返回 401', async () => {
    mockUnauthed()
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/notes/${NOTE_ID}`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'x' }),
    })
    expect(res.statusCode).toBe(401)
  })

  it('body 缺 content → 400', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/notes/${NOTE_ID}`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.code).toBe(400)
  })

  it('笔记不存在 → 404', async () => {
    mockAuthed()
    enqueue([])
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/notes/${NOTE_ID}`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '新内容' }),
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.code).toBe(404)
  })

  it('非所有者 → 403', async () => {
    mockAuthed(USER_ID)
    enqueue([{ id: NOTE_ID, userId: 'user-B' }])
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/notes/${NOTE_ID}`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'x' }),
    })
    expect(res.statusCode).toBe(403)
    const body = res.json()
    expect(body.code).toBe(403)
  })

  it('所有者更新 → 200 + updated:true', async () => {
    mockAuthed(USER_ID)
    enqueue([{ id: NOTE_ID, userId: USER_ID }])
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/notes/${NOTE_ID}`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: '更新内容',
        title: '标题',
        isPublic: true,
      }),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.updated).toBe(true)
  })
})
