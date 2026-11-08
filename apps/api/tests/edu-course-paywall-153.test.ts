// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-153 付费课程零支付解锁 — 路由级夹具。
 *
 * 判据:付费课(非免费/价格>0)的报名入口必须以「已支付课程订单」为准;
 * 自助报名(lesson_sign_ups)不再是付费凭证。旧实现两处入口都不做任何付费判断,
 * 直接 signUpLesson ⇒ 本文件全部 402 用例在旧代码下都会是 201,必翻红。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const mockFindLessonById = vi.fn()
const mockIsLessonFree = vi.fn()
const mockHasPaidCourseOrder = vi.fn()
const mockSignUpLesson = vi.fn()
const mockIsSignedUp = vi.fn()
const mockFindSignUp = vi.fn()

vi.mock('../src/db/learn-queries.js', () => ({
  findMyLessons: vi.fn(),
  signUpLesson: (...a: unknown[]) => mockSignUpLesson(...a),
  isSignedUp: (...a: unknown[]) => mockIsSignedUp(...a),
  findSignUp: (...a: unknown[]) => mockFindSignUp(...a),
  updateProgress: vi.fn(),
  findSignUpById: vi.fn(),
  updateSignUpById: vi.fn(),
  findLessonById: (...a: unknown[]) => mockFindLessonById(...a),
  isLessonFree: (...a: unknown[]) => mockIsLessonFree(...a),
  hasPaidCourseOrder: (...a: unknown[]) => mockHasPaidCourseOrder(...a),
}))

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))

import courseRoutes from '../src/routes/user/course-routes.js'
import studyRoutes from '../src/routes/user/study-routes.js'

const LESSON_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '00000000-0000-4000-8000-000000000001'
const AUTH_HEADERS = { authorization: `Bearer valid:${USER_ID}` }

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  app.addHook('onRequest', async (request) => {
    const token = request.headers.authorization?.slice(7).trim()
    if (token?.startsWith('valid:')) request.userId = token.slice(6)
  })
  await app.register(courseRoutes, { prefix: '/api' })
  await app.register(studyRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

const paidLesson = { id: LESSON_ID, isFree: false, price: '99.00' }
const freeLesson = { id: LESSON_ID, isFree: true, price: '0.00' }

describe('F-153 付费课报名闸', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsSignedUp.mockResolvedValue(false)
    mockFindSignUp.mockResolvedValue({ id: 'signup-1', progress: 0, status: 1 })
  })

  it('POST /course/:id/enroll 付费课无已支付订单 → 402,且不写报名', async () => {
    mockFindLessonById.mockResolvedValueOnce(paidLesson)
    mockIsLessonFree.mockReturnValueOnce(false)
    mockHasPaidCourseOrder.mockResolvedValueOnce(false)

    const res = await app.inject({
      method: 'POST',
      url: `/api/course/${LESSON_ID}/enroll`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(402)
    expect(res.json().message).toBe('请先购买该课程')
    expect(mockSignUpLesson).not.toHaveBeenCalled()
    expect(mockHasPaidCourseOrder).toHaveBeenCalledWith(USER_ID, LESSON_ID)
  })

  it('POST /course/:id/enroll 付费课已有已支付订单 → 201 并写报名', async () => {
    mockFindLessonById.mockResolvedValueOnce(paidLesson)
    mockIsLessonFree.mockReturnValueOnce(false)
    mockHasPaidCourseOrder.mockResolvedValueOnce(true)

    const res = await app.inject({
      method: 'POST',
      url: `/api/course/${LESSON_ID}/enroll`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(201)
    expect(mockSignUpLesson).toHaveBeenCalledWith(LESSON_ID, USER_ID)
  })

  it('POST /course/:id/enroll 免费课 → 201 且不查付费订单', async () => {
    mockFindLessonById.mockResolvedValueOnce(freeLesson)
    mockIsLessonFree.mockReturnValueOnce(true)

    const res = await app.inject({
      method: 'POST',
      url: `/api/course/${LESSON_ID}/enroll`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(201)
    expect(mockHasPaidCourseOrder).not.toHaveBeenCalled()
    expect(mockSignUpLesson).toHaveBeenCalledWith(LESSON_ID, USER_ID)
  })

  it('POST /course/:id/enroll 课程不存在 → 404', async () => {
    mockFindLessonById.mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'POST',
      url: `/api/course/${LESSON_ID}/enroll`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(404)
    expect(mockSignUpLesson).not.toHaveBeenCalled()
  })

  it('POST /study/records 付费课无已支付订单 → 402,且不写报名', async () => {
    mockFindLessonById.mockResolvedValueOnce(paidLesson)
    mockIsLessonFree.mockReturnValueOnce(false)
    mockHasPaidCourseOrder.mockResolvedValueOnce(false)

    const res = await app.inject({
      method: 'POST',
      url: '/api/study/records',
      headers: AUTH_HEADERS,
      payload: { lessonId: LESSON_ID },
    })
    expect(res.statusCode).toBe(402)
    expect(mockSignUpLesson).not.toHaveBeenCalled()
  })

  it('POST /study/records 付费课已有已支付订单 → 201', async () => {
    mockFindLessonById.mockResolvedValueOnce(paidLesson)
    mockIsLessonFree.mockReturnValueOnce(false)
    mockHasPaidCourseOrder.mockResolvedValueOnce(true)

    const res = await app.inject({
      method: 'POST',
      url: '/api/study/records',
      headers: AUTH_HEADERS,
      payload: { lessonId: LESSON_ID },
    })
    expect(res.statusCode).toBe(201)
    expect(mockSignUpLesson).toHaveBeenCalledWith(LESSON_ID, USER_ID)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
