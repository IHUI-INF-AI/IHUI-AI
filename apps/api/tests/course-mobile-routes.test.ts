// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const LESSON_ID = '11111111-1111-4111-8111-111111111111'

const q = vi.hoisted(() => ({
  findLessonById: vi.fn(),
  findLessonChapters: vi.fn(),
  findLessonSections: vi.fn(),
  findRateList: vi.fn(),
  checkAuth: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: q.checkAuth,
}))

vi.mock('../src/db/learn-queries.js', () => ({
  findLessonById: q.findLessonById,
  findLessonChapters: q.findLessonChapters,
  findLessonSections: q.findLessonSections,
}))

vi.mock('../src/db/learn-extended-queries.js', () => ({
  findRateList: q.findRateList,
}))

import { courseMobileRoutes } from '../src/routes/course-mobile-routes.js'

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify()
  await app.register(courseMobileRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
  q.checkAuth.mockResolvedValue(true)
  q.findLessonById.mockResolvedValue({ id: LESSON_ID, isPublished: true, isFree: true })
  q.findLessonChapters.mockResolvedValue([
    { id: 'c1', title: '第一章' },
    { id: 'c2', title: '第二章' },
  ])
  q.findLessonSections.mockImplementation(async (chapterId: string) =>
    chapterId === 'c1'
      ? [
          { id: 's1', title: '1.1', duration: 60 },
          { id: 's2', title: '1.2', duration: 120 },
        ]
      : [],
  )
})

describe('GET /api/courses/:id/catalog', () => {
  it('章节为顶层并在 children 挂小节,时长由秒折成分钟', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/courses/${LESSON_ID}/catalog` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toEqual([
      {
        id: 'c1',
        title: '第一章',
        type: 'chapter',
        duration: 3,
        children: [
          { id: 's1', title: '1.1', type: 'section', duration: 1 },
          { id: 's2', title: '1.2', type: 'section', duration: 2 },
        ],
      },
      { id: 'c2', title: '第二章', type: 'chapter', duration: 0, children: [] },
    ])
    expect(q.findLessonSections).toHaveBeenCalledWith('c1')
    expect(q.findLessonSections).toHaveBeenCalledWith('c2')
  })

  it('小节带视频地址时 children 透出 videoUrl;未上传的不打该字段', async () => {
    q.findLessonSections.mockImplementation(async (chapterId: string) =>
      chapterId === 'c1'
        ? [
            { id: 's1', title: '1.1', duration: 60, videoUrl: 'https://cdn.example/a.mp4' },
            { id: 's2', title: '1.2', duration: 120 },
          ]
        : [],
    )
    const res = await app.inject({ method: 'GET', url: `/api/courses/${LESSON_ID}/catalog` })
    expect(res.statusCode).toBe(200)
    const kids = res.json().data[0].children
    expect(kids[0]).toEqual({
      id: 's1',
      title: '1.1',
      type: 'section',
      duration: 1,
      videoUrl: 'https://cdn.example/a.mp4',
    })
    expect('videoUrl' in kids[1]).toBe(false)
  })

  it('付费课只给试看小节透出 videoUrl,付费小节不裸发直链(G-31 ①)', async () => {
    q.findLessonById.mockResolvedValue({ id: LESSON_ID, isPublished: true, isFree: false })
    q.findLessonSections.mockImplementation(async (chapterId: string) =>
      chapterId === 'c1'
        ? [
            {
              id: 's1',
              title: '1.1',
              duration: 60,
              videoUrl: 'https://cdn.example/a.mp4',
              isFree: true,
            },
            {
              id: 's2',
              title: '1.2',
              duration: 120,
              videoUrl: 'https://cdn.example/b.mp4',
              isFree: false,
            },
          ]
        : [],
    )
    const res = await app.inject({ method: 'GET', url: `/api/courses/${LESSON_ID}/catalog` })
    expect(res.statusCode).toBe(200)
    const kids = res.json().data[0].children
    expect(kids[0]).toEqual({
      id: 's1',
      title: '1.1',
      type: 'section',
      duration: 1,
      videoUrl: 'https://cdn.example/a.mp4',
    })
    expect('videoUrl' in kids[1]).toBe(false)
    expect(res.body).not.toContain('cdn.example/b.mp4')
  })

  it('未发布课程返回 404 且不读章节', async () => {
    q.findLessonById.mockResolvedValue({ id: LESSON_ID, isPublished: false })
    const res = await app.inject({ method: 'GET', url: `/api/courses/${LESSON_ID}/catalog` })
    expect(res.statusCode).toBe(404)
    expect(q.findLessonChapters).not.toHaveBeenCalled()
  })
})

describe('GET /api/courses/:id/chapters', () => {
  it('返回章节 id/标题/总时长/小节数', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/courses/${LESSON_ID}/chapters` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual([
      { id: 'c1', title: '第一章', duration: 3, lessonCount: 2 },
      { id: 'c2', title: '第二章', duration: 0, lessonCount: 0 },
    ])
  })

  it('非法 uuid 返回 400,且不落库查询', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/courses/not-a-uuid/chapters' })
    expect(res.statusCode).toBe(400)
    expect(q.findLessonById).not.toHaveBeenCalled()
  })
})

describe('GET /api/courses/:id/comments', () => {
  it('匿名评价脱敏、分数取已填项均值、时间转 ISO', async () => {
    q.findRateList.mockResolvedValue({
      list: [
        {
          id: 'r1',
          content: '很好',
          isAnonymous: true,
          contentUtilityScore: 5,
          teacherScore: null,
          serviceScore: null,
          createdAt: new Date('2026-10-01T08:00:00.000Z'),
        },
        {
          id: 'r2',
          content: null,
          isAnonymous: false,
          contentUtilityScore: 5,
          teacherScore: 4,
          serviceScore: 3,
          createdAt: new Date('2026-10-02T08:00:00.000Z'),
        },
      ],
      total: 2,
      page: 1,
      pageSize: 50,
    })
    const res = await app.inject({ method: 'GET', url: `/api/courses/${LESSON_ID}/comments` })
    expect(res.statusCode).toBe(200)
    expect(q.findRateList).toHaveBeenCalledWith({ lessonId: LESSON_ID, page: 1, pageSize: 50 })
    expect(res.json().data).toEqual([
      {
        id: 'r1',
        user: '匿名用户',
        content: '很好',
        rating: 5,
        createdAt: '2026-10-01T08:00:00.000Z',
      },
      {
        id: 'r2',
        user: '学员',
        content: '',
        rating: 4,
        createdAt: '2026-10-02T08:00:00.000Z',
      },
    ])
  })

  it('课程不存在返回 404 且不读评价', async () => {
    q.findLessonById.mockResolvedValue(undefined)
    const res = await app.inject({ method: 'GET', url: `/api/courses/${LESSON_ID}/comments` })
    expect(res.statusCode).toBe(404)
    expect(q.findRateList).not.toHaveBeenCalled()
  })
})

describe('注册即装车(造好没接线是本仓最高频失效型)', () => {
  const HERE = dirname(fileURLToPath(import.meta.url))
  const apiRoot = resolve(HERE, '..')
  const indexSrc = readFileSync(join(apiRoot, 'src/routes/index.ts'), 'utf8')
  const routeSrc = readFileSync(join(apiRoot, 'src/routes/course-mobile-routes.ts'), 'utf8')
  /** 三条调用点:RN 屏已换源经 @ihui/api-client 取数(见提交 a48f62d5de),不再持有 /api/courses/* 直调字面量 */
  const clientFiles = ['CourseCatalogScreen', 'CourseChapterScreen', 'CourseCommentScreen'] as const
  /** 每屏当前实际调用的 api-client 出口(course.ts 打已注册的 /api/learn/lessons/:id 与 /api/learn/lessons/:lessonId/rates) */
  const clientCallOf: Record<(typeof clientFiles)[number], string> = {
    CourseCatalogScreen: 'getCourseCatalog',
    CourseChapterScreen: 'getCourseCatalog',
    CourseCommentScreen: 'getCourseComments',
  }

  it('routes/index.ts 必须 import 且以 prefix /api 注册 courseMobileRoutes', () => {
    expect(indexSrc).toMatch(
      /import\s*\{\s*courseMobileRoutes\s*\}\s*from\s*'\.\/course-mobile-routes\.js'/u,
    )
    expect(
      /server\.register\(\s*courseMobileRoutes\s*,\s*\{\s*prefix:\s*'\/api'\s*\}\s*\)/u.test(
        indexSrc,
      ),
    ).toBe(true)
  })

  it('注册面恰为三条 /api/courses/:id/*;三屏经 api-client 接线且旧直调字面量不回潮(漂移即红)', () => {
    const inner = new Set(
      [...routeSrc.matchAll(/server\.get\(\s*'([^']*)'/gu)].map((m) => `/api${m[1]}`),
    )
    expect([...inner].sort(), 'courseMobileRoutes 在册读面应恰为三条').toEqual([
      '/api/courses/:id/catalog',
      '/api/courses/:id/chapters',
      '/api/courses/:id/comments',
    ])
    for (const name of clientFiles) {
      const src = readFileSync(join(apiRoot, '../mobile-rn/src/screens', `${name}.tsx`), 'utf8')
      const stale = [...src.matchAll(/[`'"](\/api\/courses\/[^`'"\n]*)[`'"]/gu)]
        .map((m) => m[1].replace(/\$\{[^}]*\}/gu, ':id'))
        .filter((p) => /\/(catalog|chapters|comments)$/u.test(p))
      expect(
        stale,
        `${name} 不应残留旧 /api/courses/:id/* 直调字面量(已换源 @ihui/api-client)`,
      ).toEqual([])
      expect(src, `${name} 应经 @ihui/api-client 调用 ${clientCallOf[name]}`).toMatch(
        new RegExp(
          `import\\s*\\{[^}]*\\b${clientCallOf[name]}\\b[^}]*\\}\\s*from\\s*'@ihui/api-client'`,
        ),
      )
    }
  })
})

describe('鉴权先于取数', () => {
  it('checkAuth 拒绝时三条端点都不落库', async () => {
    q.checkAuth.mockImplementation(
      async (
        _request: unknown,
        reply: { status: (n: number) => { send: (b: unknown) => unknown } },
      ) => {
        reply.status(401).send({ code: 401, message: '请先登录', data: null })
        return false
      },
    )
    for (const seg of ['catalog', 'chapters', 'comments']) {
      const res = await app.inject({ method: 'GET', url: `/api/courses/${LESSON_ID}/${seg}` })
      expect(res.statusCode).toBe(401)
    }
    expect(q.findLessonById).not.toHaveBeenCalled()
    expect(q.findRateList).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
