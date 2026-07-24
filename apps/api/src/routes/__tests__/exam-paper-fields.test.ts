import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
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

const PAPER_ID = '11111111-1111-1111-1111-111111111111'
const CATEGORY_ID = '22222222-2222-2222-2222-222222222222'

vi.mock('../../db/exam-queries.js', () => {
  const paperId = '11111111-1111-1111-1111-111111111111'
  const categoryId = '22222222-2222-2222-2222-222222222222'
  return {
    findCategories: vi.fn().mockResolvedValue([]),
    findCategoryById: vi.fn().mockResolvedValue({ id: categoryId, name: 'Cat' }),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    findPapers: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    findPaperById: vi.fn().mockImplementation((id: string) =>
      Promise.resolve(
        id === paperId
          ? {
              id: paperId,
              title: 'Paper',
              description: null,
              categoryId,
              paperType: 'random',
              totalScore: '100.00',
              passScore: '60.00',
              duration: 90,
              isPublished: true,
              isRandom: true,
              questionDisordered: true,
              optionDisordered: true,
              difficulty: 4,
              questionCount: 10,
              status: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : undefined,
      ),
    ),
    createPaper: vi.fn().mockResolvedValue({ id: paperId }),
    updatePaper: vi.fn().mockResolvedValue({ id: paperId }),
    deletePaper: vi.fn().mockResolvedValue(undefined),
    findQuestions: vi.fn().mockResolvedValue([]),
    findQuestionById: vi.fn(),
    createQuestion: vi.fn(),
    updateQuestion: vi.fn(),
    deleteQuestion: vi.fn(),
    findExamRecords: vi.fn().mockResolvedValue([]),
    findExamRecordById: vi.fn(),
    createExamRecord: vi.fn(),
    updateExamRecord: vi.fn(),
    findWrongQuestions: vi.fn().mockResolvedValue([]),
    findWrongQuestionById: vi.fn(),
    createWrongQuestion: vi.fn(),
    deleteWrongQuestion: vi.fn(),
  }
})

vi.mock('../../db/exam-extended-queries.js', () => ({
  findPaperQuestions: vi.fn().mockResolvedValue([]),
  findExamRecordsWithDetail: vi.fn().mockResolvedValue({ list: [], total: 0 }),
  submitExamPaper: vi.fn(),
  gradeSubjectiveQuestions: vi.fn(),
  autoScoreObjectiveQuestions: vi.fn(),
  getExamRankings: vi.fn().mockResolvedValue([]),
  getWrongQuestionAnalysis: vi.fn().mockResolvedValue([]),
  generateRandomPaper: vi.fn(),
}))

import { examRoutes } from '../exam.js'
import { verifyAccessToken } from '@ihui/auth'

const AUTH_HEADERS = { authorization: 'Bearer mock-token' }

function mockAuth(roleId = 1): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: '00000000-0000-0000-0000-000000000000',
    phone: '13800000000',
    familyId: '00000000-0000-0000-0000-000000000000',
    roleId,
  })
}

describe('P0 Audit Gaps — Exam paper fields binding', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(examRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /api/admin/exam/papers accepts all paper fields', async () => {
    mockAuth(1)
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/exam/papers',
      payload: {
        title: 'Random Paper',
        categoryId: CATEGORY_ID,
        paperType: 'random',
        totalScore: '100',
        passScore: '60',
        duration: 90,
        isPublished: true,
        isRandom: true,
        cidList: [CATEGORY_ID],
        questionIdList: [],
        questionDisordered: true,
        optionDisordered: true,
        difficulty: 4,
        status: 1,
      },
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().code).toBe(0)
  })

  it('GET /api/admin/exam/papers/:id returns all paper fields', async () => {
    mockAuth(1)
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/exam/papers/${PAPER_ID}`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.code).toBe(0)
    expect(json.data.paper.paperType).toBe('random')
    expect(json.data.paper.questionDisordered).toBe(true)
    expect(json.data.paper.optionDisordered).toBe(true)
    expect(json.data.paper.difficulty).toBe(4)
    expect(json.data.paper.passScore).toBe('60.00')
  })

  it('PUT /api/admin/exam/papers/:id updates paper fields', async () => {
    mockAuth(1)
    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/exam/papers/${PAPER_ID}`,
      payload: {
        paperType: 'mock',
        questionDisordered: false,
        optionDisordered: false,
        difficulty: 2,
      },
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().code).toBe(0)
  })
})
