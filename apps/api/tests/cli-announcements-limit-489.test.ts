// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-489 夹具：CLI 公告接口不得「全表拉取后内存截断」。
 *
 * 改前缺陷：
 *  - latest 先 findAnnouncements() 拉全表（含 content 正文）再 .slice(0, limit)；
 *  - version 也全表拉取，只为取 latestAt / count。
 *
 * 断言新依赖：latest 走 findAnnouncementsLimited(limit)（limit 进到函数入参，
 * summary 由 SQL left(content,100) 产出，路由不再接触正文），version 走
 * findAnnouncementsVersion()；旧的全表版 findAnnouncements 一次都不许被调用。
 */
import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'

vi.mock('../src/db/content-queries.js', () => ({
  findAnnouncements: vi.fn(),
  findAnnouncementsLimited: vi.fn(),
  findAnnouncementsVersion: vi.fn(),
  findAnnouncementById: vi.fn(),
  isAnnouncementVisible: vi.fn(),
}))

import { announcementsRoutes } from '../src/routes/announcements'
import {
  findAnnouncements,
  findAnnouncementsLimited,
  findAnnouncementsVersion,
} from '../src/db/content-queries.js'

describe('F-489 CLI 公告接口限额查询', () => {
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
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('latest?limit=2 只调用 findAnnouncementsLimited(2)，summary 来自限额查询且不调用全表版', async () => {
    // 行里刻意不含 content：summary 必须由查询列直接给出，路由不得依赖正文再截取。
    vi.mocked(findAnnouncementsLimited).mockResolvedValueOnce([
      {
        id: 'a-1',
        title: '公告1',
        type: 'info',
        isPinned: true,
        publishedAt: new Date('2026-07-01T00:00:00Z'),
        summary: '内容1',
      },
      {
        id: 'a-2',
        title: '公告2',
        type: 'warning',
        isPinned: false,
        publishedAt: new Date('2026-07-02T00:00:00Z'),
        summary: '内容2',
      },
    ] as never)
    vi.mocked(findAnnouncementsVersion).mockResolvedValueOnce({
      latestAt: new Date('2026-07-02T00:00:00Z'),
      count: 5,
    })

    const res = await server.inject({ method: 'GET', url: '/api/cli/announcements/latest?limit=2' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(findAnnouncementsLimited).toHaveBeenCalledTimes(1)
    expect(findAnnouncementsLimited).toHaveBeenCalledWith(2)
    expect(findAnnouncements).not.toHaveBeenCalled()
    expect(body.data.list).toHaveLength(2)
    expect(body.data.list[0].summary).toBe('内容1')
    expect(body.data.list[0].content).toBeUndefined()
    expect(body.data.total).toBe(5) // total 来自 count(*) 聚合，而非全表长度
  })

  it('version 只调用 findAnnouncementsVersion()，不调用全表版', async () => {
    vi.mocked(findAnnouncementsVersion).mockResolvedValueOnce({
      latestAt: new Date('2026-07-15T00:00:00Z'),
      count: 3,
    })

    const res = await server.inject({ method: 'GET', url: '/api/cli/announcements/version' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(findAnnouncementsVersion).toHaveBeenCalledTimes(1)
    expect(findAnnouncements).not.toHaveBeenCalled()
    expect(body.data.latestAt).toContain('2026-07-15')
    expect(body.data.count).toBe(3)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
