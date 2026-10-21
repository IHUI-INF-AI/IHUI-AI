// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GET /api/study/videos/:id — 视频小节详情出网契约(离线测试,不连数据库)。
 *
 * 立因(两型,都是"各端自说自话"的合成品):
 *  ① 生产者只出 `url`,而消费方 apps/miniapp-taro/src/pages/study/video-detail/index.tsx 读
 *     `info.playUrl` ⇒ 播放器 src 恒 undefined,视频页必然黑屏;
 *  ② 同页还读 coverUrl / description / teacher / tags / chapters(选集目录),而旧路由只回小节 7 列
 *     ⇒ 目录空、选集切不动、无讲师无封面。
 * 本测试钉住修复后的契约:
 *  1. 免费小节 ⇒ `url` 与 `playUrl` 同值且等于库里 video_url(旧 Java 契约名不许消失);
 *  2. 付费小节(小节与整课都不免费)⇒ 两个名字都是 null,而**元信息与目录照给**(断言的是"播址没发出去");
 *  3. 目录取同课程全部小节,时长按 @ihui/shared 的 formatMediaTime 折(>1h 走 h:mm:ss);
 *  4. 分类名为空时 tags 给空数组,不拿课程名/讲师名冒充标签;
 *  5. 非 UUID ⇒ 400、查无此行 ⇒ 404,都不带 data。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
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

const SECTION_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_SECTION_ID = '22222222-2222-4222-8222-222222222222'
const LESSON_ID = '33333333-3333-4333-8333-333333333333'
const CHAPTER_ID = '44444444-4444-4444-8444-444444444444'
const VIDEO_URL = 'https://cdn.example/legacy-assets/videos/ai-agent/ai_agent_01.mp4'

/** 详情那一问的 join 结果(小节 → 章节 → 课程 → 分类),按用例改付费标志 */
function detailRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: SECTION_ID,
    title: '第 01 集',
    url: VIDEO_URL,
    duration: 3730,
    content: '原文件名:ai-agent/ai_agent_01.mp4',
    isFree: true,
    chapterId: CHAPTER_ID,
    lessonId: LESSON_ID,
    lessonTitle: 'AI Agent 开发实战',
    coverImage: 'https://cdn.example/cover.png',
    intro: '从零搭智能体',
    lecturerName: '智汇社区-官方',
    lessonIsFree: true,
    price: '0.00',
    categoryName: 'AI 认证',
    ...over,
  }
}

const catalogRows = [
  { id: SECTION_ID, title: '第 01 集', duration: 3730 },
  { id: OTHER_SECTION_ID, title: '第 02 集', duration: 95 },
]

// 链式桩:select().from().innerJoin()*.leftJoin()*.where().(limit|orderBy)()
// 本路由只有两次终结调用:第 1 次 = 详情行,第 2 次 = 同课目录行
const mockState = vi.hoisted(() => ({ detail: [] as unknown[], catalog: [] as unknown[], calls: 0 }))

function makeChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {}
  for (const m of ['from', 'innerJoin', 'leftJoin', 'where']) chain[m] = () => chain
  const terminal = () => {
    mockState.calls++
    return Promise.resolve(mockState.calls === 1 ? mockState.detail : mockState.catalog)
  }
  chain.limit = terminal
  chain.orderBy = terminal
  return chain
}

vi.mock('../src/db/index.js', () => ({
  db: { select: () => makeChain() },
  dbRead: {
    select: () => {
      throw new Error('本路由不得走 dbRead')
    },
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

describe('GET /api/study/videos/:id — 视频小节详情出网契约', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = Fastify({ logger: false })
    server.register(miniappCompatRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('免费小节 ⇒ url 与 playUrl 同值,且元信息/目录一次给齐', async () => {
    mockState.calls = 0
    mockState.detail = [detailRow()]
    mockState.catalog = catalogRows
    const res = await server.inject({ method: 'GET', url: `/api/study/videos/${SECTION_ID}` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { code: number; message: string; data: Record<string, unknown> }
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    const d = body.data
    expect(d.playUrl).toBe(VIDEO_URL)
    expect(d.url).toBe(VIDEO_URL)
    expect(d.coverUrl).toBe('https://cdn.example/cover.png')
    expect(d.description).toBe('从零搭智能体')
    expect(d.teacher).toBe('智汇社区-官方')
    expect(d.tags).toEqual(['AI 认证'])
    expect(d.courseId).toBe(LESSON_ID)
  })

  it('目录 = 同课程全部小节,时长按 formatMediaTime 折(跨小时走 h:mm:ss)', async () => {
    mockState.calls = 0
    mockState.detail = [detailRow()]
    mockState.catalog = catalogRows
    const res = await server.inject({ method: 'GET', url: `/api/study/videos/${SECTION_ID}` })
    const d = res.json().data as { chapters: Array<{ id: string; title: string; duration: string }> }
    expect(d.chapters.map((c) => c.id)).toEqual([SECTION_ID, OTHER_SECTION_ID])
    expect(d.chapters[0].duration).toBe('1:02:10')
    expect(d.chapters[1].duration).toBe('1:35')
  })

  it('付费小节(小节与整课都不免费)⇒ 播址两个名字都不给,但元信息与目录照给', async () => {
    mockState.calls = 0
    mockState.detail = [detailRow({ isFree: false, lessonIsFree: false, price: '199.00' })]
    mockState.catalog = catalogRows
    const res = await server.inject({ method: 'GET', url: `/api/study/videos/${SECTION_ID}` })
    expect(res.statusCode).toBe(200)
    const d = res.json().data as Record<string, unknown>
    // 断言的是"副作用没发生":未鉴权出口不得把对象直链发出去
    expect(d.playUrl).toBeNull()
    expect(d.url).toBeNull()
    expect(JSON.stringify(d)).not.toContain(VIDEO_URL)
    expect(d.title).toBe('第 01 集')
    expect(d.payType).toBe(1)
    expect(d.amount).toBe(199)
    expect((d.chapters as unknown[]).length).toBe(2)
  })

  it('分类名为空 ⇒ tags 给空数组,不拿课程名或讲师名冒充标签', async () => {
    mockState.calls = 0
    mockState.detail = [detailRow({ categoryName: null })]
    mockState.catalog = catalogRows
    const res = await server.inject({ method: 'GET', url: `/api/study/videos/${SECTION_ID}` })
    expect((res.json().data as { tags: unknown[] }).tags).toEqual([])
  })

  it('库里没有视频地址 ⇒ 两个名字都为空,不伪造可播址', async () => {
    mockState.calls = 0
    mockState.detail = [detailRow({ url: null })]
    mockState.catalog = catalogRows
    const res = await server.inject({ method: 'GET', url: `/api/study/videos/${SECTION_ID}` })
    const d = res.json().data as Record<string, unknown>
    expect(d.url).toBeNull()
    expect(d.playUrl).toBeNull()
  })

  it('非 UUID 入参 ⇒ 400 且不带 data(不得 500)', async () => {
    mockState.calls = 0
    mockState.detail = []
    mockState.catalog = []
    const res = await server.inject({ method: 'GET', url: '/api/study/videos/1' })
    expect(res.statusCode).toBe(400)
    expect(res.json().data).toBeUndefined()
  })

  it('查无此行 ⇒ 404「视频不存在」', async () => {
    mockState.calls = 0
    mockState.detail = []
    mockState.catalog = []
    const res = await server.inject({ method: 'GET', url: `/api/study/videos/${CHAPTER_ID}` })
    expect(res.statusCode).toBe(404)
    expect(res.json().message).toBe('视频不存在')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
