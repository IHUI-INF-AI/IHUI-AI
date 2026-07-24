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
const Q1_ID = '22222222-2222-2222-2222-222222222221'
const Q2_ID = '22222222-2222-2222-2222-222222222222'
const Q3_ID = '22222222-2222-2222-2222-222222222223'
const USER_ID = 'mock-user-id'

function mockAuth(): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: USER_ID,
    phone: '13800000000',
    familyId: '11111111-1111-1111-1111-111111111111',
    roleId: 0,
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

function makeQuestion(id: string, type: string, answer: unknown) {
  return {
    id,
    paperId: PAPER_ID,
    type,
    title: `Question ${id}`,
    options: null,
    answer,
    analysis: null,
    score: '5.00',
    difficulty: 3,
    knowledgePointIds: null,
    sortOrder: 0,
    createdAt: new Date(),
  }
}

function makeWrongRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'w-001',
    userId: USER_ID,
    questionId: Q1_ID,
    paperId: PAPER_ID,
    paperTitle: 'Test Paper',
    userAnswer: '"B"',
    rightAnswer: '"A"',
    wrongCount: 1,
    lastWrongTime: new Date(),
    isMastered: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('POST /api/exam/submit-answers — 提交答案 + 自动错题判定', () => {
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
      url: '/api/exam/submit-answers',
      payload: { examId: PAPER_ID, answers: [{ questionId: Q1_ID, userAnswer: 'B' }] },
    })
    expect(res.statusCode).toBe(401)
  })

  it('缺少 examId 返回 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/submit-answers',
      headers: AUTH_HEADERS,
      payload: { answers: [{ questionId: Q1_ID, userAnswer: 'B' }] },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
  })

  it('答错后 wrong_questions 表有记录', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select)
      .mockReturnValueOnce(mockChain([PAPER])) // findPaperById
      .mockReturnValueOnce(mockChain([makeQuestion(Q1_ID, 'single_choice', 'A')])) // findQuestionsByPaperId
    // createOrUpdateWrongQuestion: insert + onConflictDoUpdate(新建分支,返回 wrongCount=1)
    vi.mocked(db.insert).mockReturnValueOnce(mockChain([makeWrongRecord({ wrongCount: 1 })]))

    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/submit-answers',
      headers: AUTH_HEADERS,
      payload: { examId: PAPER_ID, answers: [{ questionId: Q1_ID, userAnswer: 'B' }] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.wrongCount).toBe(1)
    expect(body.data.correctCount).toBe(0)
    expect(body.data.wrongQuestions).toHaveLength(1)
    expect(body.data.wrongQuestions[0].questionId).toBe(Q1_ID)
    expect(body.data.wrongQuestions[0].wrongCount).toBe(1)
    expect(db.insert).toHaveBeenCalledTimes(1)
  })

  it('答对无记录(不调用 insert)', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select)
      .mockReturnValueOnce(mockChain([PAPER])) // findPaperById
      .mockReturnValueOnce(mockChain([makeQuestion(Q1_ID, 'single_choice', 'A')])) // findQuestionsByPaperId

    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/submit-answers',
      headers: AUTH_HEADERS,
      payload: { examId: PAPER_ID, answers: [{ questionId: Q1_ID, userAnswer: 'A' }] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.wrongCount).toBe(0)
    expect(body.data.correctCount).toBe(1)
    expect(body.data.wrongQuestions).toHaveLength(0)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('重复答错更新 wrongCount 而非新增(幂等)', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select)
      .mockReturnValueOnce(mockChain([PAPER])) // findPaperById
      .mockReturnValueOnce(mockChain([makeQuestion(Q1_ID, 'single_choice', 'A')])) // findQuestionsByPaperId
    // createOrUpdateWrongQuestion: insert + onConflictDoUpdate(冲突更新分支,返回 wrongCount=2)
    vi.mocked(db.insert).mockReturnValueOnce(mockChain([makeWrongRecord({ wrongCount: 2 })]))

    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/submit-answers',
      headers: AUTH_HEADERS,
      payload: { examId: PAPER_ID, answers: [{ questionId: Q1_ID, userAnswer: 'B' }] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.wrongCount).toBe(1)
    expect(body.data.wrongQuestions[0].wrongCount).toBe(2)
    // onConflictDoUpdate 走 insert 路径,不应调用 update
    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('批量提交答案(3 题对 2 题错,2 条错题记录)', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select)
      .mockReturnValueOnce(mockChain([PAPER])) // findPaperById
      .mockReturnValueOnce(
        mockChain([
          makeQuestion(Q1_ID, 'single_choice', 'A'),
          makeQuestion(Q2_ID, 'single_choice', 'B'),
          makeQuestion(Q3_ID, 'single_choice', 'C'),
        ]),
      ) // findQuestionsByPaperId
    // createOrUpdateWrongQuestion: 2 次错题各 1 次 insert + onConflictDoUpdate
    vi.mocked(db.insert)
      .mockReturnValueOnce(mockChain([makeWrongRecord({ questionId: Q1_ID })]))
      .mockReturnValueOnce(mockChain([makeWrongRecord({ id: 'w-002', questionId: Q3_ID })]))

    const res = await app.inject({
      method: 'POST',
      url: '/api/exam/submit-answers',
      headers: AUTH_HEADERS,
      payload: {
        examId: PAPER_ID,
        answers: [
          { questionId: Q1_ID, userAnswer: 'X' }, // 错
          { questionId: Q2_ID, userAnswer: 'B' }, // 对
          { questionId: Q3_ID, userAnswer: 'X' }, // 错
        ],
      },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.totalQuestions).toBe(3)
    expect(body.data.correctCount).toBe(1)
    expect(body.data.wrongCount).toBe(2)
    expect(body.data.wrongQuestions).toHaveLength(2)
    expect(body.data.score).toBe(5) // 仅 Q2_ID 得分
    expect(db.insert).toHaveBeenCalledTimes(2)
  })
})

describe('PUT /api/exam/wrong-questions/:questionId/resolve — 标记错题已掌握', () => {
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

  it('标记错题已掌握(isMastered=true)', async () => {
    const { db } = await import('../../db/index.js')
    const resolved = makeWrongRecord({ isMastered: true })
    vi.mocked(db.update).mockReturnValueOnce(mockChain([resolved]))

    const res = await app.inject({
      method: 'PUT',
      url: `/api/exam/wrong-questions/${Q1_ID}/resolve`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.wrong.isMastered).toBe(true)
    expect(body.data.wrong.questionId).toBe(Q1_ID)
  })

  it('错题不存在返回 404', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.update).mockReturnValueOnce(mockChain([]))

    const res = await app.inject({
      method: 'PUT',
      url: '/api/exam/wrong-questions/99999999-9999-9999-9999-999999999999/resolve',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe(404)
  })
})

describe('GET /api/exam/wrong-questions/stats — 错题统计', () => {
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

  it('错题统计正确(总数/已掌握/未掌握/按题型)', async () => {
    const { db } = await import('../../db/index.js')
    vi.mocked(db.select)
      .mockReturnValueOnce(mockChain([{ count: 5 }])) // totalRows
      .mockReturnValueOnce(mockChain([{ count: 2 }])) // resolvedRows
      .mockReturnValueOnce(
        mockChain([
          { type: 'single_choice', count: 3 },
          { type: 'multi_choice', count: 2 },
        ]),
      ) // typeRows

    const res = await app.inject({
      method: 'GET',
      url: '/api/exam/wrong-questions/stats',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.stats.total).toBe(5)
    expect(body.data.stats.resolved).toBe(2)
    expect(body.data.stats.unresolved).toBe(3)
    expect(body.data.stats.byType).toHaveLength(2)
    expect(body.data.stats.byType[0]).toEqual({ type: 'single_choice', count: 3 })
    expect(body.data.stats.byType[1]).toEqual({ type: 'multi_choice', count: 2 })
  })
})

describe('GET /api/exam/wrong-questions — 错题列表', () => {
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

  it('分页返回错题列表(含题目内容)', async () => {
    const { db } = await import('../../db/index.js')
    const wrongRecord = makeWrongRecord()
    vi.mocked(db.select)
      .mockReturnValueOnce(
        mockChain([
          {
            wrong: wrongRecord,
            questionTitle: 'Question ' + Q1_ID,
            questionType: 'single_choice',
            questionOptions: null,
            questionAnalysis: '解析',
            questionScore: '5.00',
          },
        ]),
      ) // list query
      .mockReturnValueOnce(mockChain([{ count: 1 }])) // total query

    const res = await app.inject({
      method: 'GET',
      url: '/api/exam/wrong-questions?page=1&pageSize=10',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].questionId).toBe(Q1_ID)
    expect(body.data.list[0].questionTitle).toBe('Question ' + Q1_ID)
    expect(body.data.list[0].questionType).toBe('single_choice')
    expect(body.data.total).toBe(1)
    expect(body.data.page).toBe(1)
  })
})
