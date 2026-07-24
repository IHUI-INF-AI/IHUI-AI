import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(),
}))

// 修复(2026-07-24):authenticate 内部调用 jose.decodeJwt(token) 检查 challenge token,
// 'mock-admin-token' 非有效 JWT 会抛异常 → 401。mock decodeJwt 返回非 challenge payload 绕过。
vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
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
    groupBy: () => DbChain
    onConflictDoUpdate: () => DbChain
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
      groupBy: () => chain,
      onConflictDoUpdate: () => chain,
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
import { verifyAccessToken } from '@ihui/auth'

const AUTH_HEADERS = { authorization: 'Bearer mock-token' }

const PAPER_ID = '11111111-1111-1111-1111-111111111111'
const RECORD_ID = '33333333-3333-3333-3333-333333333333'
const USER_ID = 'mock-user-id'

function mockAuth(roleId = 0): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: USER_ID,
    phone: '13800000000',
    familyId: '11111111-1111-1111-1111-111111111111',
    roleId,
  })
}

function mockChain(result: unknown): never {
  const chain: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
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
    'leftJoin',
    'innerJoin',
    'groupBy',
    'onConflictDoUpdate',
  ]) {
    chain[m] = () => chain
  }
  return chain as never
}

const PAPER = {
  id: PAPER_ID,
  title: 'Test Paper',
  description: null,
  categoryId: null,
  paperType: 'normal',
  totalScore: '100.00',
  passScore: '60.00',
  duration: 60,
  isPublished: true,
  isRandom: false,
  questionDisordered: false,
  optionDisordered: false,
  difficulty: 3,
  questionCount: 3,
  status: 1,
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makeRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: RECORD_ID,
    paperId: PAPER_ID,
    userId: USER_ID,
    answers: null,
    score: '0',
    isPassed: false,
    status: 'enrolled',
    startedAt: new Date(),
    submittedAt: null,
    duration: 0,
    createdAt: new Date(),
    ...overrides,
  }
}

describe('POST /api/exam/:id/enroll — 报名(draft→enrolled,幂等)', () => {
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

  it('首次报名创建 enrolled 记录', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select).mockReturnValueOnce(mockChain([PAPER])) // findPaperById
    vi.mocked(db.select).mockReturnValueOnce(mockChain([])) // enrollExam: 无现有记录
    vi.mocked(db.insert).mockReturnValueOnce(mockChain([makeRecord({ status: 'enrolled' })]))

    const res = await app.inject({
      method: 'POST',
      url: `/api/exam/${PAPER_ID}/enroll`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.record.status).toBe('enrolled')
    expect(body.data.record.paperId).toBe(PAPER_ID)
  })

  it('重复报名返回现有记录(幂等)', async () => {
    const { db } = await import('../../db/index.js')
    const existing = makeRecord({ status: 'enrolled' })
    vi.mocked(db.select).mockReturnValueOnce(mockChain([PAPER])) // findPaperById
    vi.mocked(db.select).mockReturnValueOnce(mockChain([existing])) // enrollExam: 有现有记录

    const res = await app.inject({
      method: 'POST',
      url: `/api/exam/${PAPER_ID}/enroll`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.record.id).toBe(RECORD_ID)
    expect(body.data.record.status).toBe('enrolled')
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('试卷不存在返回 404', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select).mockReturnValueOnce(mockChain([])) // findPaperById: 无试卷

    const res = await app.inject({
      method: 'POST',
      url: `/api/exam/${PAPER_ID}/enroll`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe(404)
  })
})

describe('POST /api/exam/records/:recordId/start — 开始答题(enrolled→answering)', () => {
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

  it('enrolled→answering 成功', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select).mockReturnValueOnce(mockChain([makeRecord({ status: 'enrolled' })]))
    vi.mocked(db.update).mockReturnValueOnce(mockChain([makeRecord({ status: 'answering' })]))

    const res = await app.inject({
      method: 'POST',
      url: `/api/exam/records/${RECORD_ID}/start`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.record.status).toBe('answering')
  })

  it('draft→answering 非法跳转返回 409', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select).mockReturnValueOnce(mockChain([makeRecord({ status: 'draft' })]))

    const res = await app.inject({
      method: 'POST',
      url: `/api/exam/records/${RECORD_ID}/start`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe(409)
    expect(res.json().message).toContain('状态流转非法')
  })

  it('submitted→answering 回退返回 409', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select).mockReturnValueOnce(mockChain([makeRecord({ status: 'submitted' })]))

    const res = await app.inject({
      method: 'POST',
      url: `/api/exam/records/${RECORD_ID}/start`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe(409)
  })
})

describe('POST /api/exam/records/:recordId/submit-exam — 提交试卷(answering→submitted)', () => {
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

  it('answering→submitted 成功', async () => {
    const { db } = await import('../../db/index.js')
    // submitExam 流程:select record → select paper duration → update(仅 1 次)
    vi.mocked(db.select).mockReturnValueOnce(mockChain([makeRecord({ status: 'answering' })])) // findExamRecordByIdExtended
    vi.mocked(db.select).mockReturnValueOnce(mockChain([{ duration: 60 }])) // 查 paper duration(60 分钟,未超时)
    vi.mocked(db.update).mockReturnValueOnce(
      mockChain([makeRecord({ status: 'submitted', submittedAt: new Date() })]),
    )

    const res = await app.inject({
      method: 'POST',
      url: `/api/exam/records/${RECORD_ID}/submit-exam`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.record.status).toBe('submitted')
  })

  it('enrolled→submitted 非法跳转返回 409', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select).mockReturnValueOnce(mockChain([makeRecord({ status: 'enrolled' })]))

    const res = await app.inject({
      method: 'POST',
      url: `/api/exam/records/${RECORD_ID}/submit-exam`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe(409)
  })
})

describe('POST /api/exam/records/:recordId/grade — 评分(submitted→graded,admin)', () => {
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
    mockAuth(1) // admin
  })

  it('submitted→graded 成功', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select).mockReturnValueOnce(mockChain([makeRecord({ status: 'submitted' })]))
    vi.mocked(db.update).mockReturnValueOnce(mockChain([makeRecord({ status: 'graded' })]))
    vi.mocked(db.update).mockReturnValueOnce(
      mockChain([makeRecord({ status: 'graded', score: '85', isPassed: true })]),
    )

    const res = await app.inject({
      method: 'POST',
      url: `/api/exam/records/${RECORD_ID}/grade`,
      headers: AUTH_HEADERS,
      payload: { score: 85 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.record.status).toBe('graded')
    expect(body.data.record.score).toBe('85')
    expect(body.data.record.isPassed).toBe(true)
  })

  it('answering→graded 非法跳转返回 409', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select).mockReturnValueOnce(mockChain([makeRecord({ status: 'answering' })]))

    const res = await app.inject({
      method: 'POST',
      url: `/api/exam/records/${RECORD_ID}/grade`,
      headers: AUTH_HEADERS,
      payload: { score: 80 },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe(409)
  })

  it('非 admin 用户返回 403', async () => {
    mockAuth(0) // 普通用户
    const res = await app.inject({
      method: 'POST',
      url: `/api/exam/records/${RECORD_ID}/grade`,
      headers: AUTH_HEADERS,
      payload: { score: 80 },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('POST /api/exam/records/:recordId/complete — 完成(graded→completed,admin)', () => {
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
    mockAuth(1) // admin
  })

  it('graded→completed 成功', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select).mockReturnValueOnce(mockChain([makeRecord({ status: 'graded' })]))
    vi.mocked(db.update).mockReturnValueOnce(mockChain([makeRecord({ status: 'completed' })]))

    const res = await app.inject({
      method: 'POST',
      url: `/api/exam/records/${RECORD_ID}/complete`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.record.status).toBe('completed')
  })

  it('submitted→completed 非法跳转返回 409', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select).mockReturnValueOnce(mockChain([makeRecord({ status: 'submitted' })]))

    const res = await app.inject({
      method: 'POST',
      url: `/api/exam/records/${RECORD_ID}/complete`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe(409)
  })
})

describe('GET /api/exam/records/:recordId/status — 查状态', () => {
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

  it('返回当前状态', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select).mockReturnValueOnce(mockChain([makeRecord({ status: 'answering' })]))

    const res = await app.inject({
      method: 'GET',
      url: `/api/exam/records/${RECORD_ID}/status`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.status).toBe('answering')
    expect(body.data.record.id).toBe(RECORD_ID)
  })

  it('记录不存在返回 404', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select).mockReturnValueOnce(mockChain([]))

    const res = await app.inject({
      method: 'GET',
      url: `/api/exam/records/${RECORD_ID}/status`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe(404)
  })

  it('无 auth 返回 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/exam/records/${RECORD_ID}/status`,
    })
    expect(res.statusCode).toBe(401)
  })
})
