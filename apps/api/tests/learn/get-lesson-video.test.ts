/**
 * learn/get-lesson-video 端点单元测试。
 *
 * 覆盖：
 *  - 401 无 auth
 *  - 400 无效 UUID
 *  - 404 课程不存在
 *  - 403 未报名且非免费
 *  - 200 免费课直接返回签名 URL
 *  - 200 报名后返回签名 URL
 *  - 200 section 视频(已报名)
 *  - 403 section 未报名
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const mockFindLessonById = vi.fn()
const mockFindSectionById = vi.fn()
const mockFindChapterById = vi.fn()
const mockIsSignedUp = vi.fn()

vi.mock('../../src/db/learn-queries.js', () => ({
  findLessonById: (...args: unknown[]) => mockFindLessonById(...args),
  findSectionById: (...args: unknown[]) => mockFindSectionById(...args),
  findChapterById: (...args: unknown[]) => mockFindChapterById(...args),
  isSignedUp: (...args: unknown[]) => mockIsSignedUp(...args),
}))

// 模拟 authenticate:从 Authorization Bearer 提取 userId,失败抛 401
vi.mock('../../src/plugins/auth.js', () => ({
  authenticate: async (request: { headers: { authorization?: string }; userId?: string }) => {
    const header = request.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      const err = new Error('Authentication required') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    // 简化：token = "valid:<userId>"
    const token = header.slice(7).trim()
    if (!token.startsWith('valid:')) {
      const err = new Error('Invalid or expired token') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    request.userId = token.slice(6)
  },
}))

// 模拟 db 的 join 查询(lesson → chapters → sections)
const chainJoin: Record<string, (...a: unknown[]) => typeof chainJoin> & {
  then: (r: (v: unknown) => unknown) => Promise<unknown>
} = {
  then: undefined as never,
  from: () => chainJoin,
  innerJoin: () => chainJoin,
  where: () => chainJoin,
  orderBy: () => chainJoin,
  limit: () => chainJoin,
  offset: () => chainJoin,
}

let joinResult: unknown[] = []
chainJoin.then = (resolve) => Promise.resolve(joinResult).then(resolve)

vi.mock('../../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => chainJoin),
  },
}))

import { learnVideoRoutes } from '../../src/routes/learn/get-lesson-video.js'

const VALID_LESSON_UUID = '11111111-1111-1111-1111-111111111111'
const VALID_SECTION_UUID = '22222222-2222-2222-2222-222222222222'
const VALID_CHAPTER_UUID = '33333333-3333-3333-3333-333333333333'
const USER_ID = '00000000-0000-0000-0000-000000000001'

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(learnVideoRoutes, { prefix: '/api/learn' })
  await app.ready()
  return app
}

const authHeader = (uid: string) => ({ authorization: `Bearer valid:${uid}` })

describe('GET /api/learn/lesson/:id/video', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockFindLessonById.mockReset()
    mockFindSectionById.mockReset()
    mockFindChapterById.mockReset()
    mockIsSignedUp.mockReset()
    joinResult = []
  })

  it('401 when no authorization header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/learn/lesson/${VALID_LESSON_UUID}/video`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('401 when invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/learn/lesson/${VALID_LESSON_UUID}/video`,
      headers: { authorization: 'Bearer invalid' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('400 on invalid uuid', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/learn/lesson/not-a-uuid/video',
      headers: authHeader(USER_ID),
    })
    expect(res.statusCode).toBe(400)
  })

  it('404 when lesson not found', async () => {
    mockFindLessonById.mockResolvedValueOnce(undefined)
    const res = await app.inject({
      method: 'GET',
      url: `/api/learn/lesson/${VALID_LESSON_UUID}/video`,
      headers: authHeader(USER_ID),
    })
    expect(res.statusCode).toBe(404)
    const body = JSON.parse(res.body)
    expect(body.message).toBe('课程不存在')
  })

  it('403 when not signed up and not free', async () => {
    mockFindLessonById.mockResolvedValueOnce({
      id: VALID_LESSON_UUID,
      isFree: false,
    })
    mockIsSignedUp.mockResolvedValueOnce(false)
    const res = await app.inject({
      method: 'GET',
      url: `/api/learn/lesson/${VALID_LESSON_UUID}/video`,
      headers: authHeader(USER_ID),
    })
    expect(res.statusCode).toBe(403)
  })

  it('404 when lesson has no video (no sections with video)', async () => {
    mockFindLessonById.mockResolvedValueOnce({
      id: VALID_LESSON_UUID,
      isFree: true,
    })
    joinResult = []
    const res = await app.inject({
      method: 'GET',
      url: `/api/learn/lesson/${VALID_LESSON_UUID}/video`,
      headers: authHeader(USER_ID),
    })
    expect(res.statusCode).toBe(404)
  })

  it('200 free lesson returns signed url', async () => {
    mockFindLessonById.mockResolvedValueOnce({
      id: VALID_LESSON_UUID,
      isFree: true,
    })
    joinResult = [
      { section: { id: 99, videoUrl: 'https://cdn.example.com/v.mp4' }, chapter: { id: 1 } },
    ]
    const res = await app.inject({
      method: 'GET',
      url: `/api/learn/lesson/${VALID_LESSON_UUID}/video`,
      headers: authHeader(USER_ID),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(0)
    expect(body.data.url).toContain('https://cdn.example.com/v.mp4')
    expect(body.data.url).toContain('uid=')
    expect(body.data.url).toContain('rid=section%3A99')
    expect(body.data.url).toMatch(/sig=[0-9a-f]{64}/)
    expect(body.data.mimeType).toBe('video/mp4')
    expect(typeof body.data.expiresAt).toBe('number')
    // 免费课不应触发 isSignedUp
    expect(mockIsSignedUp).not.toHaveBeenCalled()
  })

  it('200 paid lesson after sign-up returns signed url', async () => {
    mockFindLessonById.mockResolvedValueOnce({
      id: VALID_LESSON_UUID,
      isFree: false,
    })
    mockIsSignedUp.mockResolvedValueOnce(true)
    joinResult = [
      { section: { id: 88, videoUrl: 'https://cdn.example.com/v2.mp4' }, chapter: { id: 1 } },
    ]
    const res = await app.inject({
      method: 'GET',
      url: `/api/learn/lesson/${VALID_LESSON_UUID}/video`,
      headers: authHeader(USER_ID),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.url).toMatch(/sig=[0-9a-f]{64}/)
    expect(body.data.resourceId).toBe('section:88')
  })
})

describe('GET /api/learn/section/:id/video', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockFindSectionById.mockReset()
    mockFindChapterById.mockReset()
    mockIsSignedUp.mockReset()
  })

  it('403 when not signed up', async () => {
    mockFindSectionById.mockResolvedValueOnce({
      id: VALID_SECTION_UUID,
      chapterId: VALID_CHAPTER_UUID,
      videoUrl: 'https://cdn.example.com/s.mp4',
    })
    mockFindChapterById.mockResolvedValueOnce({ id: VALID_CHAPTER_UUID, lessonId: VALID_LESSON_UUID })
    mockIsSignedUp.mockResolvedValueOnce(false)
    const res = await app.inject({
      method: 'GET',
      url: `/api/learn/section/${VALID_SECTION_UUID}/video`,
      headers: authHeader(USER_ID),
    })
    expect(res.statusCode).toBe(403)
  })

  it('200 when signed up returns signed url', async () => {
    mockFindSectionById.mockResolvedValueOnce({
      id: VALID_SECTION_UUID,
      chapterId: VALID_CHAPTER_UUID,
      videoUrl: 'https://cdn.example.com/s.mp4',
    })
    mockFindChapterById.mockResolvedValueOnce({ id: VALID_CHAPTER_UUID, lessonId: VALID_LESSON_UUID })
    mockIsSignedUp.mockResolvedValueOnce(true)
    const res = await app.inject({
      method: 'GET',
      url: `/api/learn/section/${VALID_SECTION_UUID}/video`,
      headers: authHeader(USER_ID),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.url).toContain(`rid=section%3A${VALID_SECTION_UUID}`)
    expect(body.data.url).toMatch(/sig=[0-9a-f]{64}/)
  })

  it('404 when section not found', async () => {
    mockFindSectionById.mockResolvedValueOnce(undefined)
    const res = await app.inject({
      method: 'GET',
      url: `/api/learn/section/${VALID_SECTION_UUID}/video`,
      headers: authHeader(USER_ID),
    })
    expect(res.statusCode).toBe(404)
  })

  it('404 when section has no video', async () => {
    mockFindSectionById.mockResolvedValueOnce({
      id: VALID_SECTION_UUID,
      chapterId: VALID_CHAPTER_UUID,
      videoUrl: null,
    })
    const res = await app.inject({
      method: 'GET',
      url: `/api/learn/section/${VALID_SECTION_UUID}/video`,
      headers: authHeader(USER_ID),
    })
    expect(res.statusCode).toBe(404)
  })
})
