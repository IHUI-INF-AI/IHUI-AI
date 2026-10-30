// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-921 ① verifyVideoToken 真实校验点回归(路由层,离线,不连库)。
 *
 * 立因:video-sign.ts 的签名算法此前全仓零消费点 ⇒ 付费课时裸发 CDN 地址,
 * 门槛形同虚设。本票把两侧钉死:
 *   签发侧(GET /learn/lessons/:id):非免费小节只对"已登录且已报名"下发
 *   指向 /play 校验点的短时签名 URL;匿名/未报名 ⇒ videoUrl 为 null(不伪造);
 *   免费课/免费小节维持裸 URL(learn-lesson-video.test.ts 既有语义不回归)。
 *   校验侧(GET /learn/lessons/:id/sections/:sectionId/play):缺签名/过期/
 *   篡改/rid 不匹配/未报名 ⇒ 403 且不发出 Location(副作用为零);
 *   草稿课 ⇒ 404;全部合法 ⇒ 302 + Location == 真实视频地址(正向对照)。
 * 签名一律经 signVideoToken 源脚本生成(§22c 镜像禁复制判据)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// authenticate 桩:用测试头 x-test-user 模拟"承载层显式注入身份"(与真实现同形 ——
// 真实现从 Authorization/cookie 解出后写 request.userId,路由只读该字段)。
vi.mock('../../plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { headers: Record<string, unknown>; userId?: string }) => {
    const uid = request.headers['x-test-user']
    if (typeof uid === 'string' && uid) request.userId = uid
    return {}
  }),
  checkAuth: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../db/learn-queries.js', () => ({
  findPublishedLessons: vi.fn(),
  findLessonById: vi.fn(),
  incrementViewCount: vi.fn().mockResolvedValue(undefined),
  findLessonChapters: vi.fn(),
  findLessonSections: vi.fn(),
  findSignUp: vi.fn(),
  findSectionById: vi.fn(),
  findChapterById: vi.fn(),
}))

vi.mock('../../db/learn-extended-queries.js', () => ({
  findLessonAverageRating: vi.fn().mockResolvedValue(0),
}))

import { learnRoutes } from '../learn.js'
import {
  findLessonById,
  findLessonChapters,
  findLessonSections,
  findSignUp,
  findSectionById,
  findChapterById,
} from '../../db/learn-queries.js'
import { findLessonAverageRating } from '../../db/learn-extended-queries.js'
import { signVideoToken } from '../../services/video-sign.js'

const LESSON_ID = '11111111-1111-4111-8111-111111111111'
const CHAPTER_ID = '22222222-2222-4222-8222-222222222222'
const SECTION_ID = '33333333-3333-4333-8333-333333333333'
const USER_ID = '55555555-5555-4555-8555-555555555555'
const OTHER_USER_ID = '66666666-6666-4666-8666-666666666666'
const VIDEO_URL =
  'https://test-for-dp.oss-cn-guangzhou.aliyuncs.com/legacy-assets/videos/3b1b/3b1b_linear_01.mp4'

const NOW = new Date('2026-10-23T00:00:00.000Z')

/** 付费课 fixture:isFree=false,小节也非免费 ⇒ 必须过签名校验点。 */
function makePaidLesson(overrides: Record<string, unknown> = {}) {
  return {
    id: LESSON_ID,
    title: '付费课程',
    coverImage: null,
    intro: null,
    categoryId: null,
    lecturerId: null,
    lecturerName: '讲师',
    difficulty: null,
    price: '199.00',
    originalPrice: null,
    isFree: false,
    isPublished: true,
    sort: 0,
    viewCount: 0,
    signupCount: 1,
    lessonCount: 1,
    status: 1,
    createdAt: NOW,
    updatedAt: NOW,
    categoryName: null,
    ...overrides,
  }
}

function makePaidSection(overrides: Record<string, unknown> = {}) {
  return {
    id: SECTION_ID,
    chapterId: CHAPTER_ID,
    title: '第 1 集',
    content: null,
    videoUrl: VIDEO_URL,
    duration: 90,
    sortOrder: 0,
    isFree: false,
    createdAt: NOW,
    ...overrides,
  }
}

function playUrl(query: Record<string, string | number>): string {
  const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString()
  return `/api/learn/lessons/${LESSON_ID}/sections/${SECTION_ID}/play?${qs}`
}

/** 报名记录 fixture(findSignUp 的真实返回形状,mock 不许给残形)。 */
function makeSignUp(userId: string) {
  return {
    id: 'signup-1',
    progress: 0,
    status: 1,
    lessonId: LESSON_ID,
    createdAt: NOW,
    userId,
    studyPlanId: null,
  }
}

/** 合法签名三元组(与签发侧同一算法出口,不复制判据)。 */
function signArgs(userId: string, ttlSeconds = 600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  return {
    uid: userId,
    rid: SECTION_ID,
    exp,
    sig: signVideoToken({ userId, resourceId: SECTION_ID, expiresAt: exp }),
  }
}

describe('G-921 ① 付费课时签名:签发侧与校验侧', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(learnRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.mocked(findLessonById).mockReset()
    vi.mocked(findLessonChapters).mockReset()
    vi.mocked(findLessonSections).mockReset()
    vi.mocked(findSignUp).mockReset()
    vi.mocked(findSectionById).mockReset()
    vi.mocked(findChapterById).mockReset()
    vi.mocked(findLessonAverageRating).mockResolvedValue(0)
    vi.mocked(findLessonChapters).mockResolvedValue([
      { id: CHAPTER_ID, lessonId: LESSON_ID, title: '第一章', sortOrder: 0, createdAt: NOW },
    ])
  })

  // ----- 签发侧:GET /learn/lessons/:id -----

  it('付费小节:已登录且已报名 ⇒ 下发指向 /play 的短时签名 URL,且不裸发 CDN 地址', async () => {
    vi.mocked(findLessonById).mockResolvedValue(makePaidLesson())
    vi.mocked(findLessonSections).mockResolvedValue([makePaidSection()])
    vi.mocked(findSignUp).mockResolvedValue(makeSignUp(USER_ID))

    const res = await app.inject({
      method: 'GET',
      url: `/api/learn/lessons/${LESSON_ID}`,
      headers: { 'x-test-user': USER_ID },
    })

    expect(res.statusCode).toBe(200)
    const section = res.json().data.chapters[0].sections[0]
    expect(section.videoUrl).toContain(
      `/api/learn/lessons/${LESSON_ID}/sections/${SECTION_ID}/play`,
    )
    expect(section.videoUrl).toContain(`uid=${USER_ID}`)
    expect(section.videoUrl).toContain(`rid=${SECTION_ID}`)
    expect(section.videoUrl).toMatch(/exp=\d+&sig=[0-9a-f]{64}/)
    // 真实 CDN 地址不得出现在响应里(否则签名等于白签)
    expect(section.videoUrl).not.toContain('oss-cn-guangzhou')
    expect(res.body).not.toContain(VIDEO_URL)
  })

  it('付费小节:已登录但未报名 ⇒ videoUrl 为 null,整行不含任何 http 地址', async () => {
    vi.mocked(findLessonById).mockResolvedValue(makePaidLesson())
    vi.mocked(findLessonSections).mockResolvedValue([makePaidSection()])
    vi.mocked(findSignUp).mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'GET',
      url: `/api/learn/lessons/${LESSON_ID}`,
      headers: { 'x-test-user': USER_ID },
    })

    expect(res.statusCode).toBe(200)
    const section = res.json().data.chapters[0].sections[0]
    expect(section.videoUrl).toBeNull()
    expect(JSON.stringify(section)).not.toContain('http')
  })

  it('付费小节:匿名 ⇒ videoUrl 为 null(公开详情响应不再裸泄露付费视频)', async () => {
    vi.mocked(findLessonById).mockResolvedValue(makePaidLesson())
    vi.mocked(findLessonSections).mockResolvedValue([makePaidSection()])

    const res = await app.inject({ method: 'GET', url: `/api/learn/lessons/${LESSON_ID}` })

    expect(res.statusCode).toBe(200)
    const section = res.json().data.chapters[0].sections[0]
    expect(section.videoUrl).toBeNull()
    // 匿名路径根本不查报名表(无身份可查),也不得出现签名 URL
    expect(res.body).not.toContain('sig=')
    expect(res.body).not.toContain(VIDEO_URL)
  })

  it('免费小节(付费课下的试看节):维持原样下发,不需要签名', async () => {
    vi.mocked(findLessonById).mockResolvedValue(makePaidLesson())
    vi.mocked(findLessonSections).mockResolvedValue([makePaidSection({ isFree: true })])

    const res = await app.inject({ method: 'GET', url: `/api/learn/lessons/${LESSON_ID}` })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.chapters[0].sections[0].videoUrl).toBe(VIDEO_URL)
  })

  // ----- 校验侧:GET /learn/lessons/:id/sections/:sectionId/play -----

  async function seedPlayChain(lessonOverrides: Record<string, unknown> = {}) {
    vi.mocked(findSectionById).mockResolvedValue(makePaidSection())
    vi.mocked(findChapterById).mockResolvedValue({
      id: CHAPTER_ID,
      lessonId: LESSON_ID,
      title: '第一章',
      sortOrder: 0,
      createdAt: NOW,
    })
    vi.mocked(findLessonById).mockResolvedValue(makePaidLesson(lessonOverrides))
  }

  it('无 token(缺全部签名参数)播放 ⇒ 403,且不发 Location(不放行)', async () => {
    await seedPlayChain()
    const res = await app.inject({
      method: 'GET',
      url: `/api/learn/lessons/${LESSON_ID}/sections/${SECTION_ID}/play`,
    })
    expect(res.statusCode).toBe(403)
    expect(res.headers.location).toBeUndefined()
  })

  it('签名参数齐备但 sig 伪造 ⇒ 403,不发 Location', async () => {
    await seedPlayChain()
    vi.mocked(findSignUp).mockResolvedValue(makeSignUp(USER_ID))
    const args = signArgs(USER_ID)
    const res = await app.inject({
      method: 'GET',
      url: playUrl({ ...args, sig: 'f'.repeat(64) }),
    })
    expect(res.statusCode).toBe(403)
    expect(res.headers.location).toBeUndefined()
  })

  it('过期链接(sig 对该 exp 真实成立,只对钟已死)⇒ 403,不发 Location', async () => {
    await seedPlayChain()
    vi.mocked(findSignUp).mockResolvedValue(makeSignUp(USER_ID))
    const args = signArgs(USER_ID, -60)
    const res = await app.inject({ method: 'GET', url: playUrl(args) })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('过期')
    expect(res.headers.location).toBeUndefined()
  })

  it('拿别人的合法票改 uid 重放 ⇒ 403(HMAC 覆盖身份,客户端改不动)', async () => {
    await seedPlayChain()
    const argsForOther = signArgs(OTHER_USER_ID)
    const res = await app.inject({
      method: 'GET',
      url: playUrl({ ...argsForOther, uid: USER_ID }),
    })
    expect(res.statusCode).toBe(403)
    expect(res.headers.location).toBeUndefined()
  })

  it('rid 与路径课时不匹配(拿 A 票开 B)⇒ 403', async () => {
    await seedPlayChain()
    const args = signArgs(USER_ID)
    const res = await app.inject({
      method: 'GET',
      url: playUrl({
        uid: args.uid,
        rid: OTHER_USER_ID, // 非本课时且签名按本 rid 算不出合法 sig
        exp: args.exp,
        sig: args.sig,
      }),
    })
    expect(res.statusCode).toBe(403)
    expect(res.headers.location).toBeUndefined()
  })

  it('签名合法但未报名(签发后掉权)⇒ 403,不发 Location;正向对照:已报名 ⇒ 302 + Location 为真源', async () => {
    await seedPlayChain()
    const args = signArgs(USER_ID)

    vi.mocked(findSignUp).mockResolvedValue(undefined)
    const denied = await app.inject({ method: 'GET', url: playUrl(args) })
    expect(denied.statusCode).toBe(403)
    expect(denied.headers.location).toBeUndefined()

    vi.mocked(findSignUp).mockResolvedValue(makeSignUp(USER_ID))
    const allowed = await app.inject({ method: 'GET', url: playUrl(args) })
    expect(allowed.statusCode).toBe(302)
    expect(allowed.headers.location).toBe(VIDEO_URL)
  })

  it('草稿课(isPublished=false)⇒ 404,与详情路由同一判据,签名合法也不播', async () => {
    await seedPlayChain({ isPublished: false })
    vi.mocked(findSignUp).mockResolvedValue(makeSignUp(USER_ID))
    const args = signArgs(USER_ID)
    const res = await app.inject({ method: 'GET', url: playUrl(args) })
    expect(res.statusCode).toBe(404)
    expect(res.headers.location).toBeUndefined()
  })

  it('签发→校验闭环:详情端点下发的 videoUrl 原样再走 /play ⇒ 302 到真源', async () => {
    vi.mocked(findLessonById).mockResolvedValue(makePaidLesson())
    vi.mocked(findLessonSections).mockResolvedValue([makePaidSection()])
    vi.mocked(findSignUp).mockResolvedValue(makeSignUp(USER_ID))

    const detail = await app.inject({
      method: 'GET',
      url: `/api/learn/lessons/${LESSON_ID}`,
      headers: { 'x-test-user': USER_ID },
    })
    expect(detail.statusCode).toBe(200)
    const issued = detail.json().data.chapters[0].sections[0].videoUrl as string
    expect(issued).toContain(`/api/learn/lessons/${LESSON_ID}/sections/${SECTION_ID}/play`)

    await seedPlayChain()
    vi.mocked(findSignUp).mockResolvedValue(makeSignUp(USER_ID))
    const { pathname, search } = new URL(issued)
    const play = await app.inject({ method: 'GET', url: `${pathname}${search}` })
    expect(play.statusCode).toBe(302)
    expect(play.headers.location).toBe(VIDEO_URL)
  })

  it('签名密钥不可用(生产未配置)⇒ 500 且不发 Location(fail-closed)', async () => {
    await seedPlayChain()
    vi.mocked(findSignUp).mockResolvedValue(makeSignUp(USER_ID))
    // 先按开发态密钥签出合法票,再切到"密钥缺失"的配置态
    const args = signArgs(USER_ID)

    const prevNodeEnv = process.env.NODE_ENV
    const prevSecret = process.env.VIDEO_SIGN_SECRET
    process.env.NODE_ENV = 'production'
    delete process.env.VIDEO_SIGN_SECRET
    try {
      const res = await app.inject({ method: 'GET', url: playUrl(args) })
      expect(res.statusCode).toBe(500)
      expect(res.headers.location).toBeUndefined()
      expect(res.body).not.toContain(VIDEO_URL)
    } finally {
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = prevNodeEnv
      if (prevSecret === undefined) delete process.env.VIDEO_SIGN_SECRET
      else process.env.VIDEO_SIGN_SECRET = prevSecret
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
