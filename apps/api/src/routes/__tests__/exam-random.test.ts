import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(),
}))

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
    leftJoin: () => DbChain
    innerJoin: () => DbChain
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
      leftJoin: () => chain,
      innerJoin: () => chain,
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

import { examRoutes } from '../exam.js'
import { pickWithSeed, InsufficientQuestionsError } from '../../db/exam-queries.js'
import { verifyAccessToken } from '@ihui/auth'

const AUTH_HEADERS = { authorization: 'Bearer mock-token' }

function mockAuth(): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: 'mock-user-id',
    phone: '13800000000',
    familyId: '11111111-1111-1111-1111-111111111111',
    roleId: 0,
  })
}

function makeQuestions(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `q-${i.toString().padStart(3, '0')}`,
    paperId: 'paper-1',
    type: 'single_choice',
    title: `Question ${i}`,
    options: null,
    answer: 'A',
    analysis: null,
    score: '5.00',
    difficulty: 3,
    knowledgePointIds: null,
    sortOrder: i,
    createdAt: new Date(),
  }))
}

describe('pickWithSeed — 纯随机抽题算法', () => {
  it('同 seed 两次抽题结果一致(可重现)', () => {
    const pool = makeQuestions(50)
    const a = pickWithSeed(pool, 10, 'exam-seed-2026')
    const b = pickWithSeed(pool, 10, 'exam-seed-2026')
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id))
  })

  it('不同 seed 结果不同', () => {
    const pool = makeQuestions(50)
    const a = pickWithSeed(pool, 10, 'seed-A')
    const b = pickWithSeed(pool, 10, 'seed-B')
    expect(a.map((q) => q.id)).not.toEqual(b.map((q) => q.id))
  })

  it('数量精确(要求 10 题返回 10 题)', () => {
    const pool = makeQuestions(50)
    const result = pickWithSeed(pool, 10, 'count-test')
    expect(result).toHaveLength(10)
  })

  it('刚好够时全部返回(不报错)', () => {
    const pool = makeQuestions(8)
    const result = pickWithSeed(pool, 8, 'exact-fit')
    expect(result).toHaveLength(8)
    expect(result.map((q) => q.id).sort()).toEqual(pool.map((q) => q.id).sort())
  })

  it('不重复(返回列表无重复 ID)', () => {
    const pool = makeQuestions(50)
    const result = pickWithSeed(pool, 15, 'no-dup-test')
    const ids = result.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('池为空时返回空数组', () => {
    expect(pickWithSeed([], 5, 'empty')).toEqual([])
  })

  it('需求数量大于池时返回全部(不丢弃)', () => {
    const pool = makeQuestions(5)
    const result = pickWithSeed(pool, 20, 'over-demand')
    expect(result).toHaveLength(5)
  })
})

describe('POST /api/exam/random-questions — 路由', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(examRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
  })

  it('无 auth 返回 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/random-questions',
      payload: { questionTypes: ['single_choice'], count: 5 },
    })
    expect(res.statusCode).toBe(401)
  })

  it('缺少 questionTypes 返回 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/random-questions',
      headers: AUTH_HEADERS,
      payload: { count: 5 },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
  })

  it('缺少 count 返回 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/random-questions',
      headers: AUTH_HEADERS,
      payload: { questionTypes: ['single_choice'] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('题库不足返回 400 + 差额提示', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve(makeQuestions(3)) }),
    } as never)

    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/random-questions',
      headers: AUTH_HEADERS,
      payload: { questionTypes: ['single_choice'], count: 10, seed: 'insufficient' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.code).toBe(400)
    expect(body.message).toContain('题库数量不足')
    expect(body.message).toContain('10')
    expect(body.message).toContain('3')
  })

  it('题库刚好够时返回 200(不报错)', async () => {
    const { db } = await import('../../db/index.js')
    const pool = makeQuestions(8)
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve(pool) }),
    } as never)

    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/random-questions',
      headers: AUTH_HEADERS,
      payload: { questionTypes: ['single_choice'], count: 8, seed: 'exact' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toHaveLength(8)
    expect(body.data.count).toBe(8)
    expect(body.data.total).toBe(8)
  })

  it('成功返回 200 + 精确数量 + 不重复', async () => {
    const { db } = await import('../../db/index.js')
    const pool = makeQuestions(30)
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve(pool) }),
    } as never)

    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/random-questions',
      headers: AUTH_HEADERS,
      payload: { questionTypes: ['single_choice'], count: 10, seed: 'success-seed' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toHaveLength(10)
    const ids = body.data.list.map((q: { id: string }) => q.id)
    expect(new Set(ids).size).toBe(10)
    expect(body.data.total).toBe(30)
  })

  it('同 seed 两次请求结果一致(端到端可重现)', async () => {
    const { db } = await import('../../db/index.js')
    const pool = makeQuestions(40)

    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve(pool) }),
    } as never)
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/exam/random-questions',
      headers: AUTH_HEADERS,
      payload: { questionTypes: ['single_choice'], count: 12, seed: 'replay-seed' },
    })

    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve(pool) }),
    } as never)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/exam/random-questions',
      headers: AUTH_HEADERS,
      payload: { questionTypes: ['single_choice'], count: 12, seed: 'replay-seed' },
    })

    const ids1 = res1.json().data.list.map((q: { id: string }) => q.id)
    const ids2 = res2.json().data.list.map((q: { id: string }) => q.id)
    expect(ids1).toEqual(ids2)
  })
})

describe('InsufficientQuestionsError', () => {
  it('携带可用数量与需求数量', () => {
    const err = new InsufficientQuestionsError(3, 10)
    expect(err.available).toBe(3)
    expect(err.required).toBe(10)
    expect(err.message).toContain('10')
    expect(err.message).toContain('3')
    expect(err.name).toBe('InsufficientQuestionsError')
  })
})
