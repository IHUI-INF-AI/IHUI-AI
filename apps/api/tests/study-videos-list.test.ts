// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GET /api/study/videos — 学习视频列表路由(离线测试,不连数据库)。
 *
 * 立因:RN 端 apps/mobile-rn/src/screens/StudyIndexScreen.tsx 一直在调
 * `/api/study/videos`,而后端只有 `/study/videos/:id` 详情路由 —— 真机上视频页
 * 永远打不开。本测试钉住补上的那条列表路由的四件事:
 *  1. 游客(无 Authorization 头)→ 200,不得 401,更不得 500
 *     (AGENTS.md §5:fail-open 崩在鉴权层后面比 401 更难发现);
 *  2. 响应统一 { code, message, data } 信封,data 为 { list, total, page, pageSize };
 *  3. 客户端**无法**通过查询参数关闭发布态过滤(handler 不转发任何发布态字段);
 *  4. 出网字段是两端已在用的历史契约名(name = 课程名),且不含受付费门槛保护的
 *     videoUrl / content。
 *
 * 判据 1/3/4 在这里判的是「路由层做了什么」;「SQL 里到底有没有发布态条件」由
 * tests/learn/published-video-feed.test.ts 在同一套取数出口上单独判。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/test',
    REDIS_URL: 'redis://localhost:8811',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

const { mockFindPublishedVideoFeed } = vi.hoisted(() => ({
  mockFindPublishedVideoFeed: vi.fn(),
}))

vi.mock('../src/db/learn-queries.js', () => ({
  findPublishedVideoFeed: (...args: unknown[]) => mockFindPublishedVideoFeed(...args),
}))

// 路由文件顶层 import db / dbRead;整库 mock 成空对象,本测试路径上一句 SQL 都不该发出去
vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => {
      throw new Error('本测试不应触达 db:取数必须走 learn-queries')
    }),
  },
  dbRead: {
    select: vi.fn(() => {
      throw new Error('本测试不应触达 dbRead')
    }),
  },
  dbClient: {},
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(),
  checkAuth: vi.fn().mockResolvedValue(true),
  requireActiveUser: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(),
}))

import { miniappCompatRoutes } from '../src/routes/miniapp-compat-routes.js'
import type { PublishedVideoFeedItem } from '../src/db/learn-queries.js'

const VIDEO_ID = '11111111-1111-4111-8111-111111111111'
const COURSE_ID = '22222222-2222-4222-8222-222222222222'
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333'

function feedItem(overrides: Partial<PublishedVideoFeedItem> = {}): PublishedVideoFeedItem {
  return {
    id: VIDEO_ID,
    title: '抖音短视频起号',
    courseId: COURSE_ID,
    courseTitle: 'AI 短视频实战课',
    cover: 'https://cdn.example/cover.png',
    teacherName: '智汇社区-官方',
    avatar: 'https://cdn.example/avatar.png',
    duration: 620,
    createdAt: new Date('2026-09-20T08:00:00Z'),
    ...overrides,
  }
}

function emptyPage() {
  return { list: [], total: 0, page: 1, pageSize: 10 }
}

describe('GET /api/study/videos — 学习视频公开列表', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = Fastify({ logger: false })
    server.register(miniappCompatRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    mockFindPublishedVideoFeed.mockReset().mockResolvedValue(emptyPage())
  })

  it('游客请求 → 200(不是 401,也不是 500)且信封为 { code, message, data }', async () => {
    mockFindPublishedVideoFeed.mockResolvedValue({
      list: [feedItem()],
      total: 1,
      page: 1,
      pageSize: 10,
    })
    const res = await server.inject({ method: 'GET', url: '/api/study/videos?page=1&pageSize=10' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      code: number
      message: string
      data: { list: Array<Record<string, unknown>>; total: number }
    }
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    expect(body.data.total).toBe(1)
    expect(body.data.list[0]?.id).toBe(VIDEO_ID)
  })

  it('出网字段对齐两端已在用的历史契约:courseTitle 映射为 name', async () => {
    mockFindPublishedVideoFeed.mockResolvedValue({
      list: [feedItem()],
      total: 1,
      page: 1,
      pageSize: 10,
    })
    const res = await server.inject({ method: 'GET', url: '/api/study/videos' })
    const row = (res.json().data.list as Array<Record<string, unknown>>)[0]
    expect(row?.name).toBe('AI 短视频实战课')
    expect(row?.title).toBe('抖音短视频起号')
    expect(row?.courseId).toBe(COURSE_ID)
    expect(row?.teacherName).toBe('智汇社区-官方')
    expect(row?.cover).toBe('https://cdn.example/cover.png')
    expect(row?.avatar).toBe('https://cdn.example/avatar.png')
    expect(row?.createdAt).toBe('2026-09-20T08:00:00.000Z')
  })

  it('列表不回显 videoUrl / content(播放地址只能走带报名判定的详情端点)', async () => {
    // 即便取数出口将来被改坏、多带了字段,路由层的显式映射也不会把它带出网
    mockFindPublishedVideoFeed.mockResolvedValue({
      list: [feedItem({ videoUrl: 'https://cdn.example/private.m3u8' } as never)],
      total: 1,
      page: 1,
      pageSize: 10,
    })
    const res = await server.inject({ method: 'GET', url: '/api/study/videos' })
    const raw = res.json().data.list as unknown
    expect(JSON.stringify(raw)).not.toContain('private.m3u8')
    expect(JSON.stringify(raw)).not.toContain('videoUrl')
  })

  it('客户端传 isPublished=false / status=0 不会被转发(发布态过滤不可被外部关闭)', async () => {
    await server.inject({
      method: 'GET',
      url: '/api/study/videos?page=1&pageSize=10&isPublished=false&status=0&published=false',
    })
    const arg = mockFindPublishedVideoFeed.mock.calls[0]?.[0] as Record<string, unknown>
    expect(Object.keys(arg).sort()).toEqual(expect.arrayContaining(['page', 'pageSize']))
    for (const forbidden of ['isPublished', 'status', 'published', 'where', 'sql']) {
      expect(arg).not.toHaveProperty(forbidden)
    }
  })

  it('search 透传;空 search 不写入参数对象', async () => {
    await server.inject({ method: 'GET', url: '/api/study/videos?search=短视频' })
    expect(mockFindPublishedVideoFeed).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 10, search: '短视频' }),
    )
    mockFindPublishedVideoFeed.mockClear()
    await server.inject({ method: 'GET', url: '/api/study/videos?search=' })
    expect(mockFindPublishedVideoFeed.mock.calls[0]?.[0]).not.toHaveProperty('search')
  })

  it('category 为 UUID 时按课程分类过滤;非 UUID(RN 的静态赛道胶囊)归一为不过滤而非 400', async () => {
    await server.inject({ method: 'GET', url: `/api/study/videos?category=${CATEGORY_ID}` })
    expect(mockFindPublishedVideoFeed).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: CATEGORY_ID }),
    )

    mockFindPublishedVideoFeed.mockClear()
    const res = await server.inject({ method: 'GET', url: '/api/study/videos?category=douyin' })
    expect(res.statusCode).toBe(200)
    expect(mockFindPublishedVideoFeed.mock.calls[0]?.[0]).not.toHaveProperty('categoryId')
  })

  it('分页越界 / 非数字 → 400(不是 500)', async () => {
    const badPage = await server.inject({ method: 'GET', url: '/api/study/videos?page=abc' })
    expect(badPage.statusCode).toBe(400)
    const bigPage = await server.inject({ method: 'GET', url: '/api/study/videos?pageSize=999' })
    expect(bigPage.statusCode).toBe(400)
    const zeroPage = await server.inject({ method: 'GET', url: '/api/study/videos?page=0' })
    expect(zeroPage.statusCode).toBe(400)
    expect(mockFindPublishedVideoFeed).not.toHaveBeenCalled()
  })

  it('列表路由存在且不被 /study/videos/:id 详情路由吞掉(详情仍按 id 走原逻辑)', async () => {
    // 详情路由对未知 id 走 404 分支;若静态段被参数路由吃掉,这一发会变成「列表」的 200
    mockFindPublishedVideoFeed.mockClear()
    const res = await server.inject({ method: 'GET', url: `/api/study/videos/${VIDEO_ID}` })
    expect(res.statusCode).not.toBe(200)
    expect(mockFindPublishedVideoFeed).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
