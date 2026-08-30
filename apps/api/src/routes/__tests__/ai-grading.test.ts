import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 可控的 ai-service 调用 mock,每个测试通过 mockAiServiceFetch.mockResolvedValue(...) 指定返回
const { mockAiServiceFetch } = vi.hoisted(() => ({
  mockAiServiceFetch: vi.fn(),
}))

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(),
}))

vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
}))

vi.mock('../../db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceFetch: mockAiServiceFetch,
  aiServiceFetchStream: mockAiServiceFetch,
}))

interface DbChain {
  then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
  from: () => DbChain
  where: () => DbChain
  orderBy: () => DbChain
  limit: () => DbChain
  offset: () => DbChain
  values: (value?: unknown) => DbChain
  set: () => DbChain
  returning: () => DbChain
  leftJoin: () => DbChain
}

function createChain(
  result: unknown[] = [],
  onCall?: (method: string, args: unknown[]) => void,
): any {
  const chain: DbChain = {
    then: (resolve) => Promise.resolve(result).then(resolve),
    from: () => {
      onCall?.('from', [])
      return chain
    },
    where: (...args: unknown[]) => {
      onCall?.('where', args)
      return chain
    },
    orderBy: (...args: unknown[]) => {
      onCall?.('orderBy', args)
      return chain
    },
    limit: () => {
      onCall?.('limit', [])
      return chain
    },
    offset: () => {
      onCall?.('offset', [])
      return chain
    },
    values: (...args: unknown[]) => {
      onCall?.('values', args)
      return chain
    },
    set: () => {
      onCall?.('set', [])
      return chain
    },
    returning: () => {
      onCall?.('returning', [])
      return chain
    },
    leftJoin: () => {
      onCall?.('leftJoin', [])
      return chain
    },
  }
  return chain
}

vi.mock('../../db/index.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(() => createChain()),
    insert: vi.fn(() => createChain()),
    update: vi.fn(() => createChain()),
    delete: vi.fn(() => createChain()),
  },
}))

import { aiGradingRoutes } from '../ai-grading.js'
import { verifyAccessToken } from '@ihui/auth'

const AUTH_HEADERS = { authorization: 'Bearer mock-token' }
const USER_ID = '11111111-1111-4111-8111-111111111111'

function mockAuth(): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: USER_ID,
    phone: '13800000000',
    roleId: 0,
  } as never)
}

function llmResponse(content: string, extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ content, ...extra }),
  } as unknown as Response
}

function questionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    subject: 'math',
    chapter: '代数',
    questionType: 'choice',
    difficulty: 'medium',
    questionText: '1 + 1 = ?',
    options: [
      { key: 'A', text: '2' },
      { key: 'B', text: '3' },
    ],
    answer: 'A',
    explanation: '1+1=2',
    knowledgePoints: null,
    prompt: '...',
    model: 'step-3.7-flash',
    quality: 'pending',
    humanReview: null,
    createdBy: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function recordRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    studentId: USER_ID,
    questionId: '22222222-2222-4222-8222-222222222222',
    examId: null,
    studentAnswer: '2',
    aiScore: 90,
    aiFeedback: '回答正确',
    rubric: null,
    model: 'step-3.7-flash',
    status: 'pending',
    teacherReview: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('AI Grading Routes API (AI 智能出题 + 批改)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(aiGradingRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
    mockAiServiceFetch.mockReset()
  })

  describe('401 without auth', () => {
    const endpoints: Array<{ method: 'GET' | 'POST' | 'DELETE'; url: string }> = [
      { method: 'POST', url: '/api/ai-grading/generate' },
      { method: 'GET', url: '/api/ai-grading/questions' },
      { method: 'POST', url: '/api/ai-grading/grade' },
      { method: 'GET', url: '/api/ai-grading/records' },
      {
        method: 'POST',
        url: '/api/ai-grading/records/33333333-3333-4333-8333-333333333333/review',
      },
      { method: 'DELETE', url: '/api/ai-grading/questions/22222222-2222-4222-8222-222222222222' },
    ]

    for (const { method, url } of endpoints) {
      it(`${method} ${url} 无 auth 返回 401`, async () => {
        const res = await app.inject({ method, url })
        expect(res.statusCode).toBe(401)
        expect(res.json().code).toBe(401)
      })
    }
  })

  describe('POST /api/ai-grading/generate', () => {
    it('参数校验失败:缺少 subject / count 超范围返回 400', async () => {
      const missing = await app.inject({
        method: 'POST',
        url: '/api/ai-grading/generate',
        headers: AUTH_HEADERS,
        payload: { chapter: '代数', questionType: 'choice', difficulty: 'medium', count: 3 },
      })
      expect(missing.statusCode).toBe(400)

      const badCount = await app.inject({
        method: 'POST',
        url: '/api/ai-grading/generate',
        headers: AUTH_HEADERS,
        payload: {
          subject: 'math',
          questionType: 'choice',
          difficulty: 'medium',
          count: 11,
        },
      })
      expect(badCount.statusCode).toBe(400)
      expect(badCount.json().message).toContain('1-10')

      const badType = await app.inject({
        method: 'POST',
        url: '/api/ai-grading/generate',
        headers: AUTH_HEADERS,
        payload: { subject: 'math', questionType: 'essay', difficulty: 'medium', count: 1 },
      })
      expect(badType.statusCode).toBe(400)
    })

    it('LLM 失败返回 502 带错误信息', async () => {
      mockAiServiceFetch.mockResolvedValue(
        llmResponse('', { error: true, error_message: '上游限流' }),
      )
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai-grading/generate',
        headers: AUTH_HEADERS,
        payload: { subject: 'math', questionType: 'choice', difficulty: 'easy', count: 2 },
      })
      expect(res.statusCode).toBe(502)
      expect(res.json().code).toBe(502)
      expect(res.json().message).toContain('AI 出题失败')

      mockAiServiceFetch.mockResolvedValue({ ok: false, status: 500 } as unknown as Response)
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/ai-grading/generate',
        headers: AUTH_HEADERS,
        payload: { subject: 'math', questionType: 'choice', difficulty: 'easy', count: 2 },
      })
      expect(res2.statusCode).toBe(502)
    })

    it('LLM 返回非法内容无法解析时返回 502', async () => {
      mockAiServiceFetch.mockResolvedValue(llmResponse('抱歉我无法生成题目'))
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai-grading/generate',
        headers: AUTH_HEADERS,
        payload: { subject: 'math', questionType: 'choice', difficulty: 'easy', count: 2 },
      })
      expect(res.statusCode).toBe(502)
      expect(res.json().message).toContain('无法解析')
    })

    it('成功:调用 LLM 并批量写入题目返回列表', async () => {
      const generated = [
        {
          stem: '以下哪个数是质数?',
          options: [
            { key: 'A', text: '4' },
            { key: 'B', text: '7' },
          ],
          correctAnswer: 'B',
          analysis: '7 只能被 1 和自身整除',
        },
        {
          stem: '圆的面积公式是?',
          options: [
            { key: 'A', text: 'πr²' },
            { key: 'B', text: '2πr' },
          ],
          correctAnswer: 'A',
          analysis: '面积 = πr²',
        },
      ]
      mockAiServiceFetch.mockResolvedValue(
        llmResponse(JSON.stringify(generated), { model: 'step-3.7-flash' }),
      )

      const inserted = generated.map((g, i) => questionRow({ id: `q-${i}`, questionText: g.stem }))
      let capturedValues: unknown = null
      const { db } = await import('../../db/index.js')
      vi.mocked(db.insert).mockReturnValueOnce(
        createChain(inserted, (method, args) => {
          if (method === 'values') capturedValues = args[0]
        }),
      )

      const res = await app.inject({
        method: 'POST',
        url: '/api/ai-grading/generate',
        headers: AUTH_HEADERS,
        payload: {
          subject: 'math',
          chapter: '数论',
          questionType: 'choice',
          difficulty: 'easy',
          count: 2,
        },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.list).toHaveLength(2)
      expect(body.data.count).toBe(2)

      expect(mockAiServiceFetch).toHaveBeenCalledTimes(1)
      expect(db.insert).toHaveBeenCalledTimes(1)
      const values = capturedValues as Array<Record<string, unknown>>
      expect(values).toHaveLength(2)
      expect(values[0]).toMatchObject({
        subject: 'math',
        chapter: '数论',
        questionType: 'choice',
        difficulty: 'easy',
        questionText: '以下哪个数是质数?',
        answer: 'B',
        createdBy: USER_ID,
      })
      expect(values[0]!.options).toHaveLength(2)
    })
  })

  describe('GET /api/ai-grading/questions', () => {
    it('参数校验失败:pageSize 超上限返回 400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/ai-grading/questions?pageSize=999',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(400)
    })

    it('成功:返回筛选后的题目列表', async () => {
      const rows = [questionRow(), questionRow({ id: 'q-2', subject: 'physics' })]
      const { db } = await import('../../db/index.js')
      vi.mocked(db.select)
        .mockReturnValueOnce(createChain(rows))
        .mockReturnValueOnce(createChain([{ count: 2 }]))

      const res = await app.inject({
        method: 'GET',
        url: '/api/ai-grading/questions?subject=math&page=1&pageSize=10',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.list).toHaveLength(2)
      expect(body.data.total).toBe(2)
      expect(body.data.list[0].questionText).toBe('1 + 1 = ?')
    })
  })

  describe('POST /api/ai-grading/grade', () => {
    it('参数校验失败:缺少 questionId / studentAnswer 返回 400', async () => {
      const missing = await app.inject({
        method: 'POST',
        url: '/api/ai-grading/grade',
        headers: AUTH_HEADERS,
        payload: { studentAnswer: '2' },
      })
      expect(missing.statusCode).toBe(400)

      const noAnswer = await app.inject({
        method: 'POST',
        url: '/api/ai-grading/grade',
        headers: AUTH_HEADERS,
        payload: { questionId: '22222222-2222-4222-8222-222222222222' },
      })
      expect(noAnswer.statusCode).toBe(400)
    })

    it('题目不存在返回 404', async () => {
      const { db } = await import('../../db/index.js')
      vi.mocked(db.select).mockReturnValueOnce(createChain([])).mockReturnValueOnce(createChain([]))
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai-grading/grade',
        headers: AUTH_HEADERS,
        payload: {
          questionId: '22222222-2222-4222-8222-222222222222',
          studentAnswer: '2',
        },
      })
      expect(res.statusCode).toBe(404)
    })

    it('LLM 失败返回 502', async () => {
      const { db } = await import('../../db/index.js')
      vi.mocked(db.select).mockReturnValueOnce(createChain([questionRow()]))
      mockAiServiceFetch.mockResolvedValue({ ok: false, status: 503 } as unknown as Response)

      const res = await app.inject({
        method: 'POST',
        url: '/api/ai-grading/grade',
        headers: AUTH_HEADERS,
        payload: {
          questionId: '22222222-2222-4222-8222-222222222222',
          studentAnswer: '2',
        },
      })
      expect(res.statusCode).toBe(502)
      expect(res.json().message).toContain('AI 批改失败')
    })

    it('成功:LLM 评分后写入 pending 记录返回结果', async () => {
      const { db } = await import('../../db/index.js')
      vi.mocked(db.select).mockReturnValueOnce(createChain([questionRow()]))
      mockAiServiceFetch.mockResolvedValue(
        llmResponse(
          JSON.stringify({
            aiScore: 95,
            aiFeedback: '回答完全正确,思路清晰',
            rubric: [{ criterion: '准确性', weight: 0.6 }],
          }),
          { model: 'step-3.7-flash' },
        ),
      )
      let capturedValues: Record<string, unknown> | null = null
      vi.mocked(db.insert).mockReturnValueOnce(
        createChain([recordRow({ aiScore: 95 })], (method, args) => {
          if (method === 'values') {
            const v = args[0]
            capturedValues = (Array.isArray(v) ? v[0] : v) as Record<string, unknown>
          }
        }),
      )

      const res = await app.inject({
        method: 'POST',
        url: '/api/ai-grading/grade',
        headers: AUTH_HEADERS,
        payload: {
          questionId: '22222222-2222-4222-8222-222222222222',
          studentAnswer: '2',
          examId: '44444444-4444-4444-8444-444444444444',
        },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.record.status).toBe('pending')
      expect(body.data.record.aiScore).toBe(95)
      expect(body.data.record.studentAnswer).toBe('2')

      expect(capturedValues).toMatchObject({
        studentId: USER_ID,
        questionId: '22222222-2222-4222-8222-222222222222',
        examId: '44444444-4444-4444-8444-444444444444',
        studentAnswer: '2',
        aiScore: 95,
        aiFeedback: '回答完全正确,思路清晰',
        status: 'pending',
      })
      expect(capturedValues!.rubric).toHaveLength(1)
    })

    it('成功:AI 分数超出范围时被裁剪到 0-100', async () => {
      const { db } = await import('../../db/index.js')
      vi.mocked(db.select).mockReturnValueOnce(createChain([questionRow()]))
      mockAiServiceFetch.mockResolvedValue(
        llmResponse(JSON.stringify({ aiScore: 150, aiFeedback: '超分' })),
      )
      let capturedValues: Record<string, unknown> | null = null
      vi.mocked(db.insert).mockReturnValueOnce(
        createChain([recordRow({ aiScore: 100 })], (method, args) => {
          if (method === 'values') {
            const v = args[0]
            capturedValues = (Array.isArray(v) ? v[0] : v) as Record<string, unknown>
          }
        }),
      )

      const res = await app.inject({
        method: 'POST',
        url: '/api/ai-grading/grade',
        headers: AUTH_HEADERS,
        payload: {
          questionId: '22222222-2222-4222-8222-222222222222',
          studentAnswer: '2',
        },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.record.aiScore).toBe(100)
      expect(capturedValues!.aiScore).toBe(100)
    })
  })

  describe('GET /api/ai-grading/records', () => {
    it('参数校验失败:非法 status 返回 400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/ai-grading/records?status=weird',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(400)
    })

    it('成功:返回 JOIN 题干后的批改记录', async () => {
      const rows = [
        {
          ...recordRow(),
          questionTitle: '1 + 1 = ?',
        },
      ]
      const { db } = await import('../../db/index.js')
      vi.mocked(db.select)
        .mockReturnValueOnce(createChain(rows))
        .mockReturnValueOnce(createChain([{ count: 1 }]))

      const res = await app.inject({
        method: 'GET',
        url: '/api/ai-grading/records?status=pending&page=1&pageSize=10',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.total).toBe(1)
      expect(body.data.list[0].questionTitle).toBe('1 + 1 = ?')
      expect(body.data.list[0].status).toBe('pending')
    })
  })

  describe('POST /api/ai-grading/records/:id/review', () => {
    it('参数校验失败:非法 status / 缺少复核意见返回 400', async () => {
      const badStatus = await app.inject({
        method: 'POST',
        url: `/api/ai-grading/records/${recordRow().id}/review`,
        headers: AUTH_HEADERS,
        payload: { teacherReview: '分数偏高', status: 'draft' },
      })
      expect(badStatus.statusCode).toBe(400)

      const noReview = await app.inject({
        method: 'POST',
        url: `/api/ai-grading/records/${recordRow().id}/review`,
        headers: AUTH_HEADERS,
        payload: { status: 'approved' },
      })
      expect(noReview.statusCode).toBe(400)
    })

    it('记录不存在返回 404', async () => {
      const { db } = await import('../../db/index.js')
      vi.mocked(db.update).mockReturnValueOnce(createChain([]))
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai-grading/records/33333333-3333-4333-8333-333333333333/review',
        headers: AUTH_HEADERS,
        payload: { teacherReview: '分数偏高,建议 85 分', status: 'rejected' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('成功:教师复核通过更新记录', async () => {
      const { db } = await import('../../db/index.js')
      vi.mocked(db.update).mockReturnValueOnce(
        createChain([recordRow({ status: 'approved', teacherReview: '同意' })]),
      )
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai-grading/records/33333333-3333-4333-8333-333333333333/review',
        headers: AUTH_HEADERS,
        payload: { teacherReview: '同意', status: 'approved' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.record.status).toBe('approved')
      expect(body.data.record.teacherReview).toBe('同意')
    })
  })

  describe('DELETE /api/ai-grading/questions/:id', () => {
    it('成功:删除生成题目', async () => {
      const { db } = await import('../../db/index.js')
      vi.mocked(db.delete).mockReturnValueOnce(createChain([questionRow()]))
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/ai-grading/questions/22222222-2222-4222-8222-222222222222',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('题目不存在返回 404', async () => {
      const { db } = await import('../../db/index.js')
      vi.mocked(db.delete).mockReturnValueOnce(createChain([]))
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/ai-grading/questions/22222222-2222-4222-8222-222222222222',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(404)
    })
  })
})
