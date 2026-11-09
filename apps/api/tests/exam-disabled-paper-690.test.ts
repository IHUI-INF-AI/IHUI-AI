// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, vi } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'
import { PgDialect } from 'drizzle-orm/pg-core'
import type * as ExamQueries from '../src/db/exam-queries.js'

// 2026-11-08 F-690:禁用(status!=1)试卷仍被公开列表/详情/题目/开考放行。
// 本夹具同时钉两处根因:
//  1) findPublishedPapers / findPublishedPapersByIds 只判 is_published,不判 status;
//  2) /exam/papers/:id、/questions、/start 只判 isPublished,不判 status。
const hoisted = vi.hoisted(() => ({ captured: [] as unknown[] }))

// Mock config 避免导入时 env 校验触发 process.exit(1)
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

// 鉴权桩:直接注入 userId,不校验 token;鉴权本身另有夹具覆盖。
vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = '00000000-0000-4000-8000-000000000001'
    return true
  }),
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = '00000000-0000-4000-8000-000000000001'
  }),
  requireAdmin: vi.fn(),
}))

// 路由级:mock exam-queries,聚焦「禁用卷不可达」。
vi.mock('../src/db/exam-queries.js', () => ({
  findPublishedPapers: vi.fn(),
  findAllPapers: vi.fn(),
  findPaperById: vi.fn(),
  findQuestionsByPaperId: vi.fn(),
  findQuestionById: vi.fn(),
  findMyExamRecords: vi.fn(),
  findExamRecordById: vi.fn(),
  createExamRecord: vi.fn(),
  submitExamRecord: vi.fn(),
  createPaper: vi.fn(),
  updatePaper: vi.fn(),
  deletePaper: vi.fn(),
  createQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
}))

// 查询级:真实 exam-queries 走这条 capture 链,断言 where 里有 status 谓词。
vi.mock('../src/db/index.js', () => {
  const thenable = (rows: unknown[]) => {
    const p = Promise.resolve(rows)
    return {
      then: p.then.bind(p),
      orderBy: () => ({ limit: () => ({ offset: () => Promise.resolve([]) }) }),
    }
  }
  const db = {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: (w: unknown) => {
            hoisted.captured.push(w)
            return thenable([])
          },
        }),
        where: (w: unknown) => {
          hoisted.captured.push(w)
          return thenable([{ count: 0 }])
        },
      }),
    }),
  }
  return { db }
})

import { examRoutes } from '../src/routes/exam'
import * as mockedQueries from '../src/db/exam-queries.js'

const PAPER_ID = '00000000-0000-4000-8000-000000000010'

const disabledPaper = {
  id: PAPER_ID,
  title: '已禁用试卷',
  description: '',
  categoryId: null,
  cidList: [],
  paperType: 'exam',
  duration: 60,
  totalScore: '100',
  passScore: '60',
  questionCount: 10,
  isPublished: true, // 已发布但对学员禁用(status=0)
  status: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const activePaper = { ...disabledPaper, status: 1, title: '正常试卷' }

describe('F-690 禁用试卷不可公开访问', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err: FastifyError, _req, reply) => {
      const code =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(code).send({ code, message: code >= 500 ? '服务器错误' : err.message })
    })
    server.decorate('recordExamStarted', () => {})
    server.decorate('recordExamQuestionUsed', () => {})
    await server.register(examRoutes, { prefix: '/api' })
    await server.ready()
  })

  it('a) GET /exam/papers/:id 对 status=0 的已发布试卷返回 404', async () => {
    vi.mocked(mockedQueries.findPaperById).mockResolvedValue(disabledPaper as never)
    const res = await server.inject({ method: 'GET', url: `/api/exam/papers/${PAPER_ID}` })
    expect(res.statusCode).toBe(404)
  })

  it('b) GET /exam/papers/:id/questions 对 status=0 返回 404', async () => {
    vi.mocked(mockedQueries.findPaperById).mockResolvedValue(disabledPaper as never)
    const res = await server.inject({
      method: 'GET',
      url: `/api/exam/papers/${PAPER_ID}/questions`,
    })
    expect(res.statusCode).toBe(404)
  })

  it('c) POST /exam/papers/:id/start 对 status=0 返回 404 且不建答题记录', async () => {
    vi.mocked(mockedQueries.findPaperById).mockResolvedValue(disabledPaper as never)
    const res = await server.inject({ method: 'POST', url: `/api/exam/papers/${PAPER_ID}/start` })
    expect(res.statusCode).toBe(404)
    expect(mockedQueries.createExamRecord).not.toHaveBeenCalled()
  })

  it('d) 对照:status=1 的试卷详情仍 200(闸不误伤)', async () => {
    vi.mocked(mockedQueries.findPaperById).mockResolvedValue(activePaper as never)
    const res = await server.inject({ method: 'GET', url: `/api/exam/papers/${PAPER_ID}` })
    expect(res.statusCode).toBe(200)
  })
})

describe('F-690 公开列表查询按 status 过滤(查询级)', () => {
  it('e) findPublishedPapers 的 where 含 status 谓词', async () => {
    hoisted.captured.length = 0
    const actual = await vi.importActual<typeof ExamQueries>('../src/db/exam-queries.js')
    await actual.findPublishedPapers({ page: 1, pageSize: 10 })
    expect(hoisted.captured.length).toBeGreaterThan(0)
    const sql = new PgDialect().sqlToQuery(hoisted.captured[0] as never).sql
    expect(sql).toContain('"status"')
  })

  it('f) findPublishedPapersByIds 的 where 含 status 谓词', async () => {
    hoisted.captured.length = 0
    const actual = await vi.importActual<typeof ExamQueries>('../src/db/exam-queries.js')
    await actual.findPublishedPapersByIds([PAPER_ID])
    expect(hoisted.captured.length).toBeGreaterThan(0)
    const sql = new PgDialect().sqlToQuery(hoisted.captured[0] as never).sql
    expect(sql).toContain('"status"')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
