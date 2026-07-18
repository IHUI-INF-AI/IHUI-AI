import { describe, it, expect, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

// Mock config 避免导入时 env 校验触发 process.exit(1)
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8080,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8000',
  },
}))

// Mock content-queries 以隔离数据库依赖
vi.mock('../src/db/content-queries.js', () => ({
  findAnnouncements: vi.fn().mockResolvedValue([]),
  findAnnouncementById: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
}))

import { announcementsRoutes } from '../src/routes/announcements'
import { findAnnouncements, findAnnouncementById } from '../src/db/content-queries.js'

describe('announcements routes (CLI)', () => {
  const server = Fastify({ logger: false })

  afterAll(async () => {
    await server.close()
  })

  server.setErrorHandler((error, _request, reply) => {
    const statusCode =
      error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500
    reply.status(statusCode).send({
      code: statusCode,
      message: statusCode >= 500 ? '服务器错误' : error.message,
    })
  })
  server.register(announcementsRoutes, { prefix: '/api' })
  server.ready()

  it('GET /api/cli/announcements/latest 空列表返回 200', async () => {
    vi.mocked(findAnnouncements).mockResolvedValueOnce([])
    const res = await server.inject({ method: 'GET', url: '/api/cli/announcements/latest' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toEqual([])
    expect(body.data.total).toBe(0)
  })

  it('GET /api/cli/announcements/latest?limit=2 截断列表', async () => {
    vi.mocked(findAnnouncements).mockResolvedValueOnce([
      {
        id: 'a-1',
        title: '公告1',
        content: '内容1',
        type: 'info',
        isPinned: true,
        isPublished: true,
        publishedAt: new Date('2026-07-01T00:00:00Z'),
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
      },
      {
        id: 'a-2',
        title: '公告2',
        content: '内容2',
        type: 'warning',
        isPinned: false,
        isPublished: true,
        publishedAt: new Date('2026-07-02T00:00:00Z'),
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
      },
    ] as never)
    const res = await server.inject({ method: 'GET', url: '/api/cli/announcements/latest?limit=1' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list.length).toBe(1)
    expect(body.data.list[0].id).toBe('a-1')
    expect(body.data.list[0].content).toBeUndefined() // 精简字段不含 content
    expect(body.data.list[0].summary).toBe('内容1') // summary 由 content 截取
    expect(body.data.total).toBe(2) // total 是后端实际总数(未截断)
  })

  it('GET /api/cli/announcements/latest limit 非法时返回 400', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/cli/announcements/latest?limit=abc',
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/cli/announcements/latest 后端抛错时返回空列表(不 500)', async () => {
    vi.mocked(findAnnouncements).mockRejectedValueOnce(new Error('db down'))
    const res = await server.inject({ method: 'GET', url: '/api/cli/announcements/latest' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toEqual([])
    expect(body.data.total).toBe(0)
  })

  it('GET /api/cli/announcements/version 空列表返回 latestAt null', async () => {
    vi.mocked(findAnnouncements).mockResolvedValueOnce([])
    const res = await server.inject({ method: 'GET', url: '/api/cli/announcements/version' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.latestAt).toBeNull()
    expect(body.data.count).toBe(0)
  })

  it('GET /api/cli/announcements/version 有数据时返回最新时间戳', async () => {
    vi.mocked(findAnnouncements).mockResolvedValueOnce([
      {
        id: 'a-1',
        title: '公告1',
        content: '内容1',
        type: 'info',
        isPinned: true,
        isPublished: true,
        publishedAt: new Date('2026-07-15T00:00:00Z'),
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
      },
    ] as never)
    const res = await server.inject({ method: 'GET', url: '/api/cli/announcements/version' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.latestAt).toContain('2026-07-15')
    expect(body.data.count).toBe(1)
  })

  it('GET /api/cli/announcements/:id 找不到时返回 404', async () => {
    vi.mocked(findAnnouncementById).mockResolvedValueOnce(undefined)
    const res = await server.inject({
      method: 'GET',
      url: '/api/cli/announcements/non-existent-id',
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/cli/announcements/:id 未发布的公告返回 404', async () => {
    vi.mocked(findAnnouncementById).mockResolvedValueOnce({
      id: 'a-1',
      title: '草稿',
      content: '内容',
      type: 'info',
      isPinned: false,
      isPublished: false,
      publishedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
    } as never)
    const res = await server.inject({ method: 'GET', url: '/api/cli/announcements/a-1' })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/cli/announcements/:id 已发布的公告返回完整内容', async () => {
    vi.mocked(findAnnouncementById).mockResolvedValueOnce({
      id: 'a-1',
      title: '公告1',
      content: '正文内容',
      type: 'info',
      isPinned: true,
      isPublished: true,
      publishedAt: new Date('2026-07-01T00:00:00Z'),
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
    } as never)
    const res = await server.inject({ method: 'GET', url: '/api/cli/announcements/a-1' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.announcement.id).toBe('a-1')
    expect(body.data.announcement.title).toBe('公告1')
    expect(body.data.announcement.content).toBe('正文内容')
    expect(body.data.announcement.summary).toBe('正文内容') // content 前 100 字符
    expect(body.data.announcement.isPinned).toBe(true)
  })
})
