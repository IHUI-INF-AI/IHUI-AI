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

function enqueue(...results: unknown[][]) {
  dbQueue.items.push(...results)
}

describe('study plans — GET /api/study/plans (mobile-rn StudyPlanScreen, lessonSignUps + lessons 聚合)', () => {
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

  it('未登录 GET /study/plans → 401', async () => {
    mockUnauthed()
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
    expect(res.statusCode).toBe(401)
  })

  it('空数据 → 200 + 空列表', async () => {
    mockAuthed()
    enqueue([])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data).toEqual([])
  })

  it('progress=0 → status=pending', async () => {
    mockAuthed()
    enqueue([
      {
        id: 'plan-1',
        progress: 0,
        createdAt: new Date('2026-01-01'),
        lessonTitle: '入门课',
        lessonCount: 10,
      },
    ])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data[0].status).toBe('pending')
    expect(body.data[0].completedMinutes).toBe(0)
    expect(body.data[0].targetMinutes).toBe(300) // 10 * 30
  })

  it('progress=50 → status=inProgress', async () => {
    mockAuthed()
    enqueue([
      {
        id: 'plan-2',
        progress: 50,
        createdAt: new Date('2026-01-01'),
        lessonTitle: '进阶课',
        lessonCount: 8,
      },
    ])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
    const body = res.json()
    expect(body.data[0].status).toBe('inProgress')
    expect(body.data[0].completedMinutes).toBe(120) // 240 * 0.5
    expect(body.data[0].targetMinutes).toBe(240)
  })

  it('progress=100 → status=completed', async () => {
    mockAuthed()
    enqueue([
      {
        id: 'plan-3',
        progress: 100,
        createdAt: new Date('2026-01-01'),
        lessonTitle: '完结课',
        lessonCount: 5,
      },
    ])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
    const body = res.json()
    expect(body.data[0].status).toBe('completed')
    expect(body.data[0].completedMinutes).toBe(150)
  })

  it('dueDate 是 createdAt + 30 天的日期字符串', async () => {
    mockAuthed()
    enqueue([
      {
        id: 'plan-4',
        progress: 0,
        createdAt: new Date('2026-07-01T00:00:00Z'),
        lessonTitle: '测试课',
        lessonCount: 1,
      },
    ])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
    const body = res.json()
    expect(body.data[0].dueDate).toBe('2026-07-31')
  })
})
