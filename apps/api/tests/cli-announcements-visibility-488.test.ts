// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-488 夹具：公告详情必须校验「已发布 + 已到发布时间 + 未过期」。
 *
 * 改前缺陷：
 *  - CLI 详情 GET /api/cli/announcements/:id 只判 `!a || !a.isPublished`；
 *  - 公开详情 GET /api/announcements/:id 同样只判 isPublished。
 * 因此「未来稿（publishedAt 明天）」与「已过期（expiresAt 昨天）」都会以 200 返回正文。
 *
 * 这里刻意保留真实的 isAnnouncementVisible（只 mock findAnnouncementById），
 * 让夹具钉住源码里的那条唯一判据，而不是测试自己复刻一份谓词。
 */
import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

vi.mock('../src/db/content-queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/db/content-queries.js')>()
  return {
    ...actual,
    findAnnouncementById: vi.fn(),
  }
})

import { announcementsRoutes } from '../src/routes/announcements'
import { contentRoutes } from '../src/routes/content'
import { findAnnouncementById } from '../src/db/content-queries.js'

const ANNOUNCEMENT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const NOW = Date.now()
const DAY = 24 * 60 * 60 * 1000

const row = (overrides: Record<string, unknown> = {}) => ({
  id: ANNOUNCEMENT_ID,
  title: '公告',
  content: '正文内容',
  type: 'info',
  isPinned: false,
  isPublished: true,
  publishedAt: new Date(NOW - DAY),
  expiresAt: null,
  createdAt: new Date(NOW),
  updatedAt: new Date(NOW),
  createdBy: null,
  ...overrides,
})

describe('F-488 公告详情可见性（CLI + 公开）', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((error: FastifyError, _request, reply) => {
      const statusCode =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : error.message,
      })
    })
    await server.register(announcementsRoutes, { prefix: '/api' })
    await server.register(contentRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  const detail = async (rowValue: unknown) => {
    vi.mocked(findAnnouncementById).mockResolvedValueOnce(rowValue as never)
    const cli = await server.inject({
      method: 'GET',
      url: `/api/cli/announcements/${ANNOUNCEMENT_ID}`,
    })
    vi.mocked(findAnnouncementById).mockResolvedValueOnce(rowValue as never)
    const pub = await server.inject({ method: 'GET', url: `/api/announcements/${ANNOUNCEMENT_ID}` })
    return { cli, pub }
  }

  it('未来稿（publishedAt 明天）详情返回 404', async () => {
    const { cli, pub } = await detail(row({ publishedAt: new Date(NOW + DAY) }))
    expect(cli.statusCode).toBe(404)
    expect(cli.json().message).toBe('公告不存在')
    expect(pub.statusCode).toBe(404)
    expect(pub.json().message).toBe('公告不存在')
  })

  it('已过期稿（expiresAt 昨天）详情返回 404', async () => {
    const { cli, pub } = await detail(row({ expiresAt: new Date(NOW - DAY) }))
    expect(cli.statusCode).toBe(404)
    expect(cli.json().message).toBe('公告不存在')
    expect(pub.statusCode).toBe(404)
    expect(pub.json().message).toBe('公告不存在')
  })

  it('正常已发布稿（已到点且未过期）详情返回 200', async () => {
    const { cli, pub } = await detail(row())
    expect(cli.statusCode).toBe(200)
    expect(cli.json().data.announcement.content).toBe('正文内容')
    expect(pub.statusCode).toBe(200)
    expect(pub.json().data.announcement.content).toBe('正文内容')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
