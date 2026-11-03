// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GET /api/study/groups/:id 视频直链泄漏收口回归(路由层,离线,不连库)。
 *
 * 立因:该兼容端点此前**无鉴权**,且把 lessonChapterSections.videoUrl 桶直链原样塞进
 * `videos[].url` ⇒ 任何人按课程 id 即可批量抓走全部云存储直链,绕过
 * /api/learn/lessons/:id/sections/:sectionId/play 的签名校验。本测试钉住:
 *  1. 未登录 ⇒ 401,响应体无 videos、无任何直链;
 *  2. 已登录但未报名付费课 ⇒ 视频址为 null,不泄露桶直链,也不夹带其它用户标识;
 *  3. 已报名 ⇒ 只发指向 /play 的短时签名地址,响应体不含桶域名;
 *  4. 签发→校验闭环:上一步拿到的地址原样走 /play ⇒ 302 到真源;
 *  5. 免费课/免费小节 ⇒ 同样只发签名地址(signedUp 不查),且 /play 无需报名即可放行;
 *  6. 草稿/未发布课 ⇒ 404,不发任何视频字段。
 * 签名一律经 buildSignedVideoUrl / verifyVideoToken 同一出口(不复制判据)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 鉴权桩:与真实现同形 —— checkAuth 成功时把身份写进 request.userId;无身份即 401。
vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: vi.fn(
    async (request: { headers: Record<string, unknown>; userId?: string }, reply: any) => {
      const uid = request.headers['x-test-user']
      if (typeof uid !== 'string' || !uid) {
        reply.status(401).send({ code: 401, message: '未登录', data: null })
        return false
      }
      request.userId = uid
      return true
    },
  ),
  authenticate: vi.fn(),
  requireActiveUser: vi.fn(),
}))

vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: vi.fn() }))

vi.mock('../src/db/learn-queries.js', () => ({
  findLessonById: vi.fn(),
  findLessonChapters: vi.fn(),
  findLessonSections: vi.fn(),
  findSignUp: vi.fn(),
  findSectionById: vi.fn(),
  findChapterById: vi.fn(),
}))

vi.mock('../src/db/learn-extended-queries.js', () => ({
  findLessonAverageRating: vi.fn().mockResolvedValue(0),
}))

// db 链式桩:本端点两次终结形态 —— .limit(1)(课程行)与 .orderBy()(章节/小节行)。
// 按调用顺序从队列取结果,避免为每张表各写一套。
const mockState = vi.hoisted(() => ({ queue: [] as unknown[][] }))

function makeChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {}
  const next = () => Promise.resolve(mockState.queue.shift() ?? [])
  for (const m of ['from', 'where', 'innerJoin', 'leftJoin']) chain[m] = () => chain
  chain.orderBy = next
  chain.limit = next
  return chain
}

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => makeChain(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
    transaction: vi.fn(),
  },
  dbRead: { select: () => makeChain(), execute: vi.fn() },
  dbClient: {},
}))

import { miniappCompatRoutes } from '../src/routes/miniapp-compat-routes.js'
import { learnRoutes } from '../src/routes/learn.js'
import {
  findLessonById,
  findSignUp,
  findSectionById,
  findChapterById,
} from '../src/db/learn-queries.js'

const LESSON_ID = '11111111-1111-4111-8111-111111111111'
const CHAPTER_ID = '22222222-2222-4222-8222-222222222222'
const SECTION_ID = '33333333-3333-4333-8333-333333333333'
const USER_ID = '55555555-5555-4555-8555-555555555555'
const OTHER_USER_ID = '66666666-6666-4666-8666-666666666666'
const VIDEO_URL =
  'https://test-for-dp.oss-cn-guangzhou.aliyuncs.com/legacy-assets/videos/3b1b/3b1b_linear_01.mp4'

const NOW = new Date('2026-10-23T00:00:00.000Z')

/** 课程行(full 形状:兼容端点用 select() 全列,learn 的 /play 也吃同一形状)。 */
function lessonRow(overrides: Record<string, unknown> = {}) {
  return {
    id: LESSON_ID,
    title: '付费课程',
    coverImage: null,
    intro: '课程简介',
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

const chapterRow = {
  id: CHAPTER_ID,
  lessonId: LESSON_ID,
  title: '第一章',
  sortOrder: 0,
  createdAt: NOW,
}

function sectionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SECTION_ID,
    chapterId: CHAPTER_ID,
    title: '第 1 集',
    content: null,
    url: VIDEO_URL,
    duration: 90,
    sortOrder: 0,
    isFree: false,
    createdAt: NOW,
    ...overrides,
  }
}

/** learn 侧 findSectionById 的实体形状(列名是 videoUrl,不是兼容层出网的 url)。 */
function sectionEntity(overrides: Record<string, unknown> = {}) {
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

/** 一次详情请求的 DB 队列:[课程行, 章节行, 小节行]。 */
function queueFor(lesson: Record<string, unknown>, sections: Record<string, unknown>[]) {
  mockState.queue = [[lesson], [chapterRow], sections]
}

describe('GET /api/study/groups/:id — 视频直链泄漏收口', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(miniappCompatRoutes, { prefix: '/api' })
    await app.register(learnRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockState.queue = []
    vi.mocked(findSignUp).mockReset()
    vi.mocked(findLessonById).mockReset()
    vi.mocked(findSectionById).mockReset()
    vi.mocked(findChapterById).mockReset()
  })

  it('未登录 ⇒ 401,且响应体没有任何视频字段或直链', async () => {
    queueFor(lessonRow(), [sectionRow()])

    const res = await app.inject({ method: 'GET', url: `/api/study/groups/${LESSON_ID}` })

    expect([401, 403]).toContain(res.statusCode)
    expect(res.json().data?.videos).toBeUndefined()
    expect(res.body).not.toContain(VIDEO_URL)
    expect(res.body).not.toContain('oss-cn')
    expect(res.body).not.toContain('sig=')
  })

  it('已登录但未报名付费课 ⇒ 视频址为 null,不泄露桶直链与其它用户标识', async () => {
    queueFor(lessonRow(), [sectionRow()])
    vi.mocked(findSignUp).mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'GET',
      url: `/api/study/groups/${LESSON_ID}`,
      headers: { 'x-test-user': USER_ID },
    })

    expect(res.statusCode).toBe(200)
    const videos = res.json().data.videos as Array<Record<string, unknown>>
    expect(videos).toHaveLength(1)
    expect(videos[0]!.url).toBeNull()
    // 元信息照给(标题/时长/章节),只是播址不发
    expect(videos[0]!.title).toBe('第 1 集')
    expect(videos[0]!.duration).toBe(90)
    expect(videos[0]!.chapterId).toBe(CHAPTER_ID)
    // 副作用为零:不含直链、不含签名三元组、不含其它用户 id
    expect(res.body).not.toContain(VIDEO_URL)
    expect(res.body).not.toContain('oss-cn')
    expect(res.body).not.toContain('sig=')
    expect(res.body).not.toContain(OTHER_USER_ID)
  })

  it('已报名 ⇒ 只发指向 /play 的短时签名地址,响应体不含桶域名', async () => {
    queueFor(lessonRow(), [sectionRow()])
    vi.mocked(findSignUp).mockResolvedValue(makeSignUp(USER_ID))

    const res = await app.inject({
      method: 'GET',
      url: `/api/study/groups/${LESSON_ID}`,
      headers: { 'x-test-user': USER_ID },
    })

    expect(res.statusCode).toBe(200)
    const url = res.json().data.videos[0].url as string
    expect(url).toContain(`/api/learn/lessons/${LESSON_ID}/sections/${SECTION_ID}/play`)
    expect(url).toContain(`uid=${USER_ID}`)
    expect(url).toContain(`rid=${SECTION_ID}`)
    expect(url).toMatch(/exp=\d+&sig=[0-9a-f]{64}/)
    expect(url).not.toContain('oss-cn')
    expect(res.body).not.toContain(VIDEO_URL)
  })

  it('签发→校验闭环:详情下发的签名地址原样走 /play ⇒ 302 到真源', async () => {
    queueFor(lessonRow(), [sectionRow()])
    vi.mocked(findSignUp).mockResolvedValue(makeSignUp(USER_ID))

    const detail = await app.inject({
      method: 'GET',
      url: `/api/study/groups/${LESSON_ID}`,
      headers: { 'x-test-user': USER_ID },
    })
    expect(detail.statusCode).toBe(200)
    const issued = detail.json().data.videos[0].url as string
    expect(issued).toContain('/play')

    // /play 侧:同一 lesson→chapter→section 归属链与报名记录
    vi.mocked(findSectionById).mockResolvedValue(sectionEntity() as never)
    vi.mocked(findChapterById).mockResolvedValue(chapterRow as never)
    vi.mocked(findLessonById).mockResolvedValue(lessonRow() as never)
    vi.mocked(findSignUp).mockResolvedValue(makeSignUp(USER_ID))

    const { pathname, search } = new URL(issued)
    const play = await app.inject({ method: 'GET', url: `${pathname}${search}` })
    expect(play.statusCode).toBe(302)
    expect(play.headers.location).toBe(VIDEO_URL)
  })

  it('免费课(未报名)⇒ 同样只发签名地址,且 /play 不收报名门槛', async () => {
    queueFor(lessonRow({ isFree: true, price: '0.00' }), [sectionRow({ isFree: true })])
    vi.mocked(findSignUp).mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'GET',
      url: `/api/study/groups/${LESSON_ID}`,
      headers: { 'x-test-user': USER_ID },
    })

    expect(res.statusCode).toBe(200)
    const url = res.json().data.videos[0].url as string
    expect(url).toContain('/play')
    expect(url).toContain(`rid=${SECTION_ID}`)
    // 免费课不查报名记录(没有"购买判定"可判)
    expect(findSignUp).not.toHaveBeenCalled()

    vi.mocked(findSectionById).mockResolvedValue(sectionEntity({ isFree: true }) as never)
    vi.mocked(findChapterById).mockResolvedValue(chapterRow as never)
    vi.mocked(findLessonById).mockResolvedValue(lessonRow({ isFree: true }) as never)

    const { pathname, search } = new URL(url)
    const play = await app.inject({ method: 'GET', url: `${pathname}${search}` })
    expect(play.statusCode).toBe(302)
    expect(play.headers.location).toBe(VIDEO_URL)
  })

  it('草稿/未发布课 ⇒ 404,且不返回任何视频字段', async () => {
    queueFor(lessonRow({ isPublished: false }), [sectionRow()])

    const res = await app.inject({
      method: 'GET',
      url: `/api/study/groups/${LESSON_ID}`,
      headers: { 'x-test-user': USER_ID },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().data).toBeUndefined()
    expect(res.body).not.toContain(VIDEO_URL)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
