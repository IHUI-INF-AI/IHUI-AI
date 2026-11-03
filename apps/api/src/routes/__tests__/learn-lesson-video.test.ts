// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-921 公开课程域的挂载链回归(路由层,离线,不连库)。
 *
 * 立因:870 枚历史视频已进桶,现网 `GET /learn/lessons` 却 total=0、`lesson_chapter_sections.video_url`
 * 读作零行。现读结论是「数据在、映射通,卡在发布态过滤」:findPublishedLessons 的 WHERE 是
 * `isPublished=true AND status=1`。本文件把两件事钉成可证明的格子:
 *   1. 已发布且小节带 video_url ⇒ 详情原样回 URL、列表 total 不为 0;
 *   2. 小节 video_url 为空 ⇒ 详情不凭空造 URL(保持 null),`duration=0` 也不造 "0:00"。
 * 查询层/映射层若被改成"空值兜底成某个默认地址",这两条会立刻红。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../../plugins/auth.js', () => ({
  authenticate: vi.fn().mockResolvedValue({ userId: null }),
  checkAuth: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../db/learn-queries.js', () => ({
  findPublishedLessons: vi.fn(),
  findLessonById: vi.fn(),
  incrementViewCount: vi.fn().mockResolvedValue(undefined),
  findLessonChapters: vi.fn(),
  findLessonSections: vi.fn(),
}))

vi.mock('../../db/learn-extended-queries.js', () => ({
  findLessonAverageRating: vi.fn().mockResolvedValue(0),
}))

import { learnRoutes } from '../learn.js'
import {
  findPublishedLessons,
  findLessonById,
  findLessonChapters,
  findLessonSections,
} from '../../db/learn-queries.js'
import { findLessonAverageRating } from '../../db/learn-extended-queries.js'

const LESSON_ID = '11111111-1111-4111-8111-111111111111'
const CHAPTER_ID = '22222222-2222-4222-8222-222222222222'
const VIDEO_URL =
  'https://test-for-dp.oss-cn-guangzhou.aliyuncs.com/legacy-assets/videos/3b1b/3b1b_linear_01.mp4'

const NOW = new Date('2026-10-22T00:00:00.000Z')

function makeLesson(overrides: Record<string, unknown> = {}) {
  return {
    id: LESSON_ID,
    title: '线性代数的本质',
    coverImage: null,
    intro: '历史存档课程',
    categoryId: null,
    lecturerId: null,
    lecturerName: 'Grant Sanderson',
    difficulty: null,
    price: '0.00',
    originalPrice: null,
    isFree: true,
    isPublished: true,
    sort: 0,
    viewCount: 0,
    signupCount: 3,
    lessonCount: 2,
    status: 1,
    createdAt: NOW,
    updatedAt: NOW,
    categoryName: null,
    ...overrides,
  }
}

function makeSection(overrides: Record<string, unknown> = {}) {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    chapterId: CHAPTER_ID,
    title: '第 1 集',
    content: '原文件名:3b1b/3b1b_linear_01.mp4',
    videoUrl: VIDEO_URL,
    duration: 90,
    sortOrder: 0,
    isFree: true,
    createdAt: NOW,
    ...overrides,
  }
}

describe('G-921 公开课程路由:视频挂载与统计', () => {
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
    vi.mocked(findPublishedLessons).mockReset()
    vi.mocked(findLessonById).mockReset()
    vi.mocked(findLessonChapters).mockReset()
    vi.mocked(findLessonSections).mockReset()
    vi.mocked(findLessonAverageRating).mockResolvedValue(4.5)
  })

  it('GET /learn/lessons:已发布课程有行时 total 不为 0', async () => {
    vi.mocked(findPublishedLessons).mockResolvedValue({
      list: [makeLesson()],
      total: 1,
      page: 1,
      pageSize: 20,
    })

    const res = await app.inject({ method: 'GET', url: '/api/learn/lessons' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.total).toBe(1)
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].id).toBe(LESSON_ID)
    // 字段适配仍然生效(instructor/description/students/cover)
    expect(body.data.list[0].instructor).toBe('Grant Sanderson')
    expect(body.data.list[0].students).toBe(3)
  })

  it('GET /learn/lessons/:id:小节 video_url 原样返回,duration 同时给展示串与秒', async () => {
    vi.mocked(findLessonById).mockResolvedValue(makeLesson())
    vi.mocked(findLessonChapters).mockResolvedValue([
      { id: CHAPTER_ID, lessonId: LESSON_ID, title: '完整课程', sortOrder: 0, createdAt: NOW },
    ])
    vi.mocked(findLessonSections).mockResolvedValue([makeSection()])

    const res = await app.inject({ method: 'GET', url: `/api/learn/lessons/${LESSON_ID}` })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.lesson.id).toBe(LESSON_ID)
    expect(body.data.lesson.rating).toBe(4.5)
    const section = body.data.chapters[0].sections[0]
    expect(section.videoUrl).toBe(VIDEO_URL)
    expect(section.duration).toBe('1:30')
    expect(section.durationSeconds).toBe(90)
  })

  it('GET /learn/lessons/:id:无视频小节不伪造 URL(保持 null)', async () => {
    vi.mocked(findLessonById).mockResolvedValue(makeLesson({ lessonCount: 2 }))
    vi.mocked(findLessonChapters).mockResolvedValue([
      { id: CHAPTER_ID, lessonId: LESSON_ID, title: '完整课程', sortOrder: 0, createdAt: NOW },
    ])
    vi.mocked(findLessonSections).mockResolvedValue([
      makeSection(),
      makeSection({
        id: '44444444-4444-4444-8444-444444444444',
        title: '第 2 集(待上传)',
        videoUrl: null,
        duration: 0,
        sortOrder: 1,
      }),
    ])

    const res = await app.inject({ method: 'GET', url: `/api/learn/lessons/${LESSON_ID}` })

    expect(res.statusCode).toBe(200)
    const sections = res.json().data.chapters[0].sections
    expect(sections).toHaveLength(2)
    expect(sections[0].videoUrl).toBe(VIDEO_URL)
    // 空值就是空值:不许回落成默认地址,也不许拿别的字段拼接
    expect(sections[1].videoUrl).toBeNull()
    expect(JSON.stringify(sections[1])).not.toContain('http')
    // 时长 0 不编造成 "0:00"
    expect(sections[1].duration).toBeUndefined()
    expect(sections[1].durationSeconds).toBe(0)
  })

  it('GET /learn/lessons/:id:草稿课(isPublished=false)按不存在处理,与列表 total=0 同一判据', async () => {
    vi.mocked(findLessonById).mockResolvedValue(makeLesson({ isPublished: false }))

    const res = await app.inject({ method: 'GET', url: `/api/learn/lessons/${LESSON_ID}` })

    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe(404)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
