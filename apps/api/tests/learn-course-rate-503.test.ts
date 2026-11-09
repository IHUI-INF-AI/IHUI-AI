// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-503 课程评价(POST /learn/lessons/:lessonId/rates)路由级夹具。
 *
 * 判据:
 *  - 未报名该课程的用户评价 → 403,且不落库;
 *  - signId 只能来自服务端查到的报名记录,客户端传的一律忽略;
 *  - 重复评价不产生第二条(原子判重后返回 409);
 *  - 课程不存在 → 404。
 *
 * 旧实现只 checkAuth 就把 body.signId 原样入库、且先查后插非原子 ⇒
 * 本文件 (a)(b)(c)(d) 在旧代码下必翻红。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type * as LearnQueriesModule from '../src/db/learn-queries.js'
import type * as LearnExtendedQueriesModule from '../src/db/learn-extended-queries.js'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const mockFindLessonById = vi.fn()
const mockFindSignUp = vi.fn()
const mockCreateRateIfAbsent = vi.fn()

// 只覆盖本用例要断言的函数,其余保留原模块(不触发真实 DB:db 已 mock)。
vi.mock('../src/db/learn-queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof LearnQueriesModule>()
  return {
    ...actual,
    findLessonById: (...args: unknown[]) => mockFindLessonById(...args),
    findSignUp: (...args: unknown[]) => mockFindSignUp(...args),
  }
})

vi.mock('../src/db/learn-extended-queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof LearnExtendedQueriesModule>()
  return {
    ...actual,
    createRateIfAbsent: (...args: unknown[]) => mockCreateRateIfAbsent(...args),
  }
})

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), execute: vi.fn() },
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async () => {},
}))

// 模拟 authenticate/checkAuth:token = "valid:<userId>",缺失或非法 → 401。
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { headers: { authorization?: string }; userId?: string }) => {
    const header = request.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      const err = new Error('Authentication required') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    const token = header.slice(7).trim()
    if (!token.startsWith('valid:')) {
      const err = new Error('Invalid or expired token') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    request.userId = token.slice(6)
  },
  checkAuth: async (
    request: { headers: { authorization?: string }; userId?: string },
    reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  ) => {
    try {
      const header = request.headers.authorization
      if (!header || !header.startsWith('Bearer '))
        throw Object.assign(new Error('Authentication required'), { statusCode: 401 })
      const token = header.slice(7).trim()
      if (!token.startsWith('valid:'))
        throw Object.assign(new Error('Invalid or expired token'), { statusCode: 401 })
      request.userId = token.slice(6)
      return true
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      reply.status(statusCode).send({ code: statusCode, message: (e as Error).message })
      return false
    }
  },
}))

import { learnRoutes, LEARN_RATE_MESSAGES } from '../src/routes/learn.js'

const LESSON_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '00000000-0000-4000-8000-000000000001'
const SIGN_UP_ID = '55555555-5555-4555-8555-555555555555'
const FORGED_SIGN_UP_ID = '66666666-6666-4666-8666-666666666666'

const AUTH_HEADERS = { authorization: `Bearer valid:${USER_ID}` }
const RATE_URL = `/api/learn/lessons/${LESSON_ID}/rates`

const validBody = {
  content: '课程内容很实用',
  contentUtilityScore: 5,
  teacherScore: 4,
  serviceScore: 5,
  isAnonymous: false,
}

const existingRate = {
  id: '77777777-7777-4777-8777-777777777777',
  lessonId: LESSON_ID,
  userId: USER_ID,
  signId: SIGN_UP_ID,
  content: '已有评价',
  contentUtilityScore: 5,
  teacherScore: 5,
  serviceScore: 5,
  isAnonymous: false,
  status: 'published',
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(learnRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

describe('F-503 POST /api/learn/lessons/:lessonId/rates', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockFindLessonById.mockReset()
    mockFindSignUp.mockReset()
    mockCreateRateIfAbsent.mockReset()
    mockCreateRateIfAbsent.mockResolvedValue({ rate: existingRate, created: true })
  })

  it('a) 未报名用户评价 → 403,且不写评价', async () => {
    mockFindLessonById.mockResolvedValueOnce({ id: LESSON_ID, title: '课程' })
    mockFindSignUp.mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'POST',
      url: RATE_URL,
      headers: AUTH_HEADERS,
      payload: validBody,
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().message).toBe(LEARN_RATE_MESSAGES.notSignedUp)
    expect(mockCreateRateIfAbsent).not.toHaveBeenCalled()
  })

  it('b) body 里伪造 signId 被忽略,写入用服务端报名记录的 id', async () => {
    mockFindLessonById.mockResolvedValueOnce({ id: LESSON_ID, title: '课程' })
    mockFindSignUp.mockResolvedValueOnce({ id: SIGN_UP_ID, lessonId: LESSON_ID, userId: USER_ID })

    const res = await app.inject({
      method: 'POST',
      url: RATE_URL,
      headers: AUTH_HEADERS,
      payload: { ...validBody, signId: FORGED_SIGN_UP_ID },
    })

    expect(res.statusCode).toBe(201)
    expect(mockCreateRateIfAbsent).toHaveBeenCalledTimes(1)
    const arg = mockCreateRateIfAbsent.mock.calls[0]?.[0] as { signId?: string | null }
    expect(arg.signId).toBe(SIGN_UP_ID)
    expect(arg.signId).not.toBe(FORGED_SIGN_UP_ID)
    expect(mockFindSignUp).toHaveBeenCalledWith(LESSON_ID, USER_ID)
  })

  it('c) 重复评价 → 409,不产生第二条', async () => {
    mockFindLessonById.mockResolvedValueOnce({ id: LESSON_ID, title: '课程' })
    mockFindSignUp.mockResolvedValueOnce({ id: SIGN_UP_ID, lessonId: LESSON_ID, userId: USER_ID })
    // 原子判重:INSERT ... WHERE NOT EXISTS 未落新行,返回存量记录
    mockCreateRateIfAbsent.mockResolvedValueOnce({ rate: existingRate, created: false })

    const res = await app.inject({
      method: 'POST',
      url: RATE_URL,
      headers: AUTH_HEADERS,
      payload: validBody,
    })

    expect(res.statusCode).toBe(409)
    expect(res.json().message).toBe(LEARN_RATE_MESSAGES.alreadyRated)
    expect(mockCreateRateIfAbsent).toHaveBeenCalledTimes(1)
  })

  it('d) 课程不存在 → 404,且不查报名/不写评价', async () => {
    mockFindLessonById.mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'POST',
      url: RATE_URL,
      headers: AUTH_HEADERS,
      payload: validBody,
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().message).toBe(LEARN_RATE_MESSAGES.lessonNotFound)
    expect(mockFindSignUp).not.toHaveBeenCalled()
    expect(mockCreateRateIfAbsent).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
