// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-693 路由同型点(POST /exam/auth-api/mark/paper,exam.ts:1936-1992):
 * 1) 含主观题重判 ⇒ 落 submitted(待人工阅卷),旧实现写 graded;
 * 2) 已 graded 的记录不得被反向重判回 submitted(补 status='submitted' 守卫)。
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'

const RECORD_ID = '33333333-3333-4333-9333-333333333333'
const PAPER_ID = '11111111-1111-4111-8111-111111111111'
const SUBJECTIVE_ID = '44444444-4444-4444-8444-444444444441'
const USER_ID = '00000000-0000-4000-8000-0000000000aa'

const dbState = vi.hoisted(() => ({
  updateSets: [] as Array<Record<string, unknown>>,
  updateCalls: 0,
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = '00000000-0000-4000-8000-0000000000aa'
    return true
  }),
  authenticate: vi.fn(),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async () => {}),
  isSystemAdmin: vi.fn(() => true),
}))

vi.mock('../src/db/index.js', () => {
  const chain = (rows: unknown[]) => {
    const b: Record<string, unknown> = {}
    for (const m of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'innerJoin',
      'leftJoin',
      'groupBy',
    ]) {
      b[m] = () => b
    }
    b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(res, rej)
    return b
  }
  const updateChain = (rows: unknown[]) => {
    const b: Record<string, unknown> = {
      set: (v: Record<string, unknown>) => {
        dbState.updateSets.push(v)
        return b
      },
      where: () => b,
      returning: () => b,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(res, rej),
    }
    return b
  }
  return {
    db: {
      select: () => chain([]),
      insert: () => chain([]),
      update: () => {
        dbState.updateCalls++
        return updateChain([])
      },
      delete: () => chain([]),
      execute: vi.fn().mockResolvedValue([]),
    },
  }
})

// 只保留本用例消费的三个查询函数;其余命名导出用 vi.fn 兜底,避免模块图缺导出。
const queries = vi.hoisted(() => ({
  findExamRecordById: vi.fn(),
  findQuestionsByPaperId: vi.fn(),
  findPaperById: vi.fn(),
}))

vi.mock('../src/db/exam-queries.js', () => ({
  ...queries,
  findPublishedExamCategories: vi.fn(),
  findAllExamCategories: vi.fn(),
  findExamCategoryById: vi.fn(),
  createExamCategory: vi.fn(),
  updateExamCategory: vi.fn(),
  deleteExamCategory: vi.fn(),
  findPublishedPapers: vi.fn(),
  findPublishedPapersByIds: vi.fn(),
  findAllPapers: vi.fn(),
  findQuestionById: vi.fn(),
  findMyExamRecords: vi.fn(),
  createExamRecord: vi.fn(),
  submitExamRecord: vi.fn(),
  createPaper: vi.fn(),
  updatePaper: vi.fn(),
  deletePaper: vi.fn(),
  createQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
  findAdminExamRecordsRich: vi.fn(),
  gradeSubjectiveAnswers: vi.fn(),
  deleteExamRecord: vi.fn(),
  randomGetQuestionList: vi.fn(),
  InsufficientQuestionsError: class InsufficientQuestionsError extends Error {},
}))

vi.mock('../src/db/exam-extended-queries.js', () => ({
  findChapterList: vi.fn(),
  findChapterById: vi.fn(),
  createChapter: vi.fn(),
  updateChapter: vi.fn(),
  deleteChapter: vi.fn(),
  findSectionList: vi.fn(),
  findSectionById: vi.fn(),
  createSection: vi.fn(),
  updateSection: vi.fn(),
  deleteSection: vi.fn(),
  updateChapterSortOrder: vi.fn(),
  updateSectionSortOrder: vi.fn(),
  findSignupList: vi.fn(),
  findMarkRecordList: vi.fn(),
  batchCreateWrongQuestions: vi.fn(),
  findWrongQuestionsByUser: vi.fn(),
  markWrongQuestionResolved: vi.fn(),
  getWrongQuestionStats: vi.fn(),
  enrollExam: vi.fn(),
  startAnswering: vi.fn(),
  submitExam: vi.fn(),
  gradeExam: vi.fn(),
  completeExam: vi.fn(),
  getExamRecordStatus: vi.fn(),
}))

import { examRoutes } from '../src/routes/exam'

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: RECORD_ID,
    paperId: PAPER_ID,
    userId: USER_ID,
    answers: [{ questionId: SUBJECTIVE_ID, answer: '论述内容' }],
    score: '0',
    isPassed: false,
    status: 'submitted',
    startedAt: new Date(Date.now() - 60_000),
    submittedAt: new Date(),
    duration: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('F-693 自动重判路由状态方向', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err: FastifyError, _req, reply) => {
      const code =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(code).send({ code, message: code >= 500 ? '服务器错误' : err.message })
    })
    server.decorate('recordExamStarted', () => {})
    server.decorate('recordExamQuestionUsed', () => {})
    server.decorate('recordExamSubmitted', () => {})
    server.decorate('recordExamScore', () => {})
    await server.register(examRoutes, { prefix: '/api' })
    await server.ready()
  })

  beforeEach(() => {
    dbState.updateSets.length = 0
    dbState.updateCalls = 0
    queries.findQuestionsByPaperId.mockResolvedValue([
      { id: SUBJECTIVE_ID, type: 'subjective', answer: null, score: '20' },
    ])
    queries.findPaperById.mockResolvedValue({ id: PAPER_ID, passScore: '60' })
  })

  it('含主观题 ⇒ 落库/响应都是 submitted(旧实现写 graded)', async () => {
    queries.findExamRecordById.mockResolvedValue(makeRecord())

    const res = await server.inject({
      method: 'POST',
      url: '/api/exam/auth-api/mark/paper',
      body: { recordId: RECORD_ID, paperId: PAPER_ID },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.status).toBe('submitted')
    expect(dbState.updateSets.at(-1)?.status).toBe('submitted')
  })

  it('已 graded 的记录 ⇒ 409 且不发生重判写(不得回退 submitted)', async () => {
    queries.findExamRecordById.mockResolvedValue(makeRecord({ status: 'graded' }))

    const res = await server.inject({
      method: 'POST',
      url: '/api/exam/auth-api/mark/paper',
      body: { recordId: RECORD_ID, paperId: PAPER_ID },
    })

    expect(res.statusCode).toBe(409)
    expect(dbState.updateCalls).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
