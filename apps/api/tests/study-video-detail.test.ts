// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GET /api/study/videos/:id — 视频小节详情(离线测试,不连数据库)。
 *
 * 立因:消费方 apps/miniapp-taro/src/pages/study/video-detail/index.tsx:202 读的是
 * `info.playUrl`,而本路由只出 `url` 一个名字(取自 lessonChapterSections.video_url)。
 * 两面各自都不报错,合起来是「播放器 src 恒 undefined ⇒ 视频页必然黑屏」。
 * 本测试钉住修复后的契约:
 *  1. `url` 与 `playUrl` 同值且都等于库里的 video_url(旧 Java 契约名不许消失);
 *  2. 非 UUID ⇒ 400,查无此行 ⇒ 404,都不出 data;
 *  3. 信封统一 { code, message, data }。
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
const CHAPTER_ID = '22222222-2222-4222-8222-222222222222'
const VIDEO_URL = 'https://cdn.example/legacy-assets/videos/ai-agent/ai_agent_01.mp4'

/** 一行小节记录;路由只取这些列,不碰别的表 */
function sectionRow() {
  return {
    id: SECTION_ID,
    title: '第 01 讲',
    url: VIDEO_URL,
    duration: 620,
    content: '文稿',
    isFree: true,
    chapterId: CHAPTER_ID,
  }
}

const mockRows = vi.hoisted(() => ({ current: [] as unknown[] }))

// db.select(...).from(...).where(...).limit(1) 的链式桩;取数落在内存行上,不发 SQL
vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(mockRows.current),
        }),
      }),
    }),
  },
  dbRead: { select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }) },
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

describe('GET /api/study/videos/:id — 视频小节详情出网名', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = Fastify({ logger: false })
    server.register(miniappCompatRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('命中小节 ⇒ url 与 playUrl 同值(小程序播放器读 playUrl,旧契约读 url)', async () => {
    mockRows.current = [sectionRow()]
    const res = await server.inject({ method: 'GET', url: `/api/study/videos/${SECTION_ID}` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { code: number; message: string; data: Record<string, unknown> }
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    expect(body.data.playUrl).toBe(VIDEO_URL)
    expect(body.data.url).toBe(VIDEO_URL)
    expect(body.data.playUrl).toBe(body.data.url)
  })

  it('库里没有视频 ⇒ 两个名字都为空,不伪造可播地址', async () => {
    mockRows.current = [{ ...sectionRow(), url: null }]
    const res = await server.inject({ method: 'GET', url: `/api/study/videos/${SECTION_ID}` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: Record<string, unknown> }
    expect(body.data.url).toBeNull()
    expect(body.data.playUrl).toBeNull()
  })

  it('非 UUID 入参 ⇒ 400 且不带 data(不得 500)', async () => {
    mockRows.current = []
    const res = await server.inject({ method: 'GET', url: '/api/study/videos/1' })
    expect(res.statusCode).toBe(400)
    expect((res.json() as { data?: unknown }).data).toBeUndefined()
  })

  it('查无此行 ⇒ 404「视频不存在」', async () => {
    mockRows.current = []
    const res = await server.inject({ method: 'GET', url: `/api/study/videos/${CHAPTER_ID}` })
    expect(res.statusCode).toBe(404)
    expect((res.json() as { message: string }).message).toBe('视频不存在')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
