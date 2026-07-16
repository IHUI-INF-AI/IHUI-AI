import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 默认 mock：所有查询函数返回安全空值，download 相关函数用 vi.fn 便于断言
vi.mock('../../db/resource-queries.js', () => ({
  findCategoriesByPid: vi.fn().mockResolvedValue([]),
  findCategoryById: vi.fn().mockResolvedValue(undefined),
  createResourceCategory: vi.fn().mockResolvedValue({ id: 'cat-1' }),
  updateResourceCategory: vi.fn().mockResolvedValue({ id: 'cat-1' }),
  deleteResourceCategory: vi.fn().mockResolvedValue(undefined),
  findResources: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findResourceByIdAndIncrementView: vi.fn().mockResolvedValue(undefined),
  findResourceById: vi.fn().mockResolvedValue(undefined),
  findResourcesByIds: vi.fn().mockResolvedValue([]),
  createResource: vi.fn().mockResolvedValue({ id: 'res-1' }),
  updateResource: vi.fn().mockResolvedValue({ id: 'res-1' }),
  deleteResource: vi.fn().mockResolvedValue(undefined),
  publishResource: vi.fn().mockResolvedValue({ id: 'res-1' }),
  findProducts: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findProductById: vi.fn().mockResolvedValue(undefined),
  createProduct: vi.fn().mockResolvedValue({ id: 'prod-1' }),
  updateProduct: vi.fn().mockResolvedValue({ id: 'prod-1' }),
  deleteProduct: vi.fn().mockResolvedValue(undefined),
  findTags: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findTagById: vi.fn().mockResolvedValue(undefined),
  createTag: vi.fn().mockResolvedValue({ id: 'tag-1' }),
  updateTag: vi.fn().mockResolvedValue({ id: 'tag-1' }),
  deleteTag: vi.fn().mockResolvedValue(undefined),
  findPublishedResourceById: vi.fn().mockResolvedValue(undefined),
  checkDownloadPermission: vi.fn().mockResolvedValue({ allowed: true, reason: 'free' }),
  createDownloadRecord: vi.fn().mockResolvedValue(undefined),
  incrementResourceDownloadCount: vi.fn().mockResolvedValue(undefined),
}))

// authenticate 默认通过；通过 mockAuthenticate.mockImplementation 控制未登录场景
const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'test-user-id'
    return { userId: 'test-user-id' } as never
  }),
}))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

import {
  findPublishedResourceById,
  checkDownloadPermission,
  createDownloadRecord,
  incrementResourceDownloadCount,
} from '../../db/resource-queries.js'
import { resourceRoutes } from '../resource.js'

const UUID_RES = '11111111-1111-1111-1111-111111111111'

function makeResource(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID_RES,
    title: '测试资源',
    coverImage: null,
    intro: null,
    categoryId: null,
    fileUrl: 'https://oss.example.com/files/test.pdf',
    fileType: 'application/pdf',
    fileSize: 1024,
    isPublished: true,
    viewCount: 0,
    downloadCount: 0,
    sort: 0,
    status: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('Resource Download API (GET /resources/:id/download)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.setErrorHandler((err: Error & { statusCode?: number }, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      const message = statusCode >= 500 ? '服务器错误' : err.message
      reply.status(statusCode).send({ code: statusCode, message })
    })
    await app.register(resourceRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // 恢复默认：已登录 + 免费资源放行
    mockAuthenticate.mockImplementation(async (request: { userId?: string }) => {
      request.userId = 'test-user-id'
      return { userId: 'test-user-id' } as never
    })
    vi.mocked(findPublishedResourceById).mockResolvedValue(undefined)
    vi.mocked(checkDownloadPermission).mockResolvedValue({ allowed: true, reason: 'free' })
    vi.mocked(createDownloadRecord).mockResolvedValue(undefined)
    vi.mocked(incrementResourceDownloadCount).mockResolvedValue(undefined)
  })

  it('未登录返回 401', async () => {
    mockAuthenticate.mockImplementation(async () => {
      const err = new Error('Authentication required')
      ;(err as Error & { statusCode: number }).statusCode = 401
      throw err
    })
    const res = await app.inject({
      method: 'GET',
      url: `/api/resources/${UUID_RES}/download`,
    })
    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body).toHaveProperty('code', 401)
    expect(body).toHaveProperty('message')
  })

  it('资源不存在或未发布返回 404', async () => {
    vi.mocked(findPublishedResourceById).mockResolvedValue(undefined)
    const res = await app.inject({
      method: 'GET',
      url: `/api/resources/${UUID_RES}/download`,
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body).toHaveProperty('code', 404)
  })

  it('免费资源下载成功：返回 302 重定向并写入下载记录', async () => {
    vi.mocked(findPublishedResourceById).mockResolvedValue(makeResource())
    vi.mocked(checkDownloadPermission).mockResolvedValue({ allowed: true, reason: 'free' })

    const res = await app.inject({
      method: 'GET',
      url: `/api/resources/${UUID_RES}/download`,
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('https://oss.example.com/files/test.pdf')
    expect(createDownloadRecord).toHaveBeenCalledTimes(1)
    expect(incrementResourceDownloadCount).toHaveBeenCalledTimes(1)
    const recordCall = vi.mocked(createDownloadRecord).mock.calls[0]?.[0]
    expect(recordCall).toHaveProperty('resourceId', UUID_RES)
    expect(recordCall).toHaveProperty('userId', 'test-user-id')
  })

  it('付费资源未购买返回 403', async () => {
    vi.mocked(findPublishedResourceById).mockResolvedValue(makeResource())
    vi.mocked(checkDownloadPermission).mockResolvedValue({
      allowed: false,
      reason: '未购买且非 VIP',
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/resources/${UUID_RES}/download`,
    })
    expect(res.statusCode).toBe(403)
    const body = res.json()
    expect(body).toHaveProperty('code', 403)
    expect(body.message).toBe('未购买且非 VIP')
    // 权限不足时不写记录
    expect(createDownloadRecord).not.toHaveBeenCalled()
  })

  it('付费资源已购买下载成功', async () => {
    vi.mocked(findPublishedResourceById).mockResolvedValue(makeResource())
    vi.mocked(checkDownloadPermission).mockResolvedValue({ allowed: true, reason: 'purchased' })

    const res = await app.inject({
      method: 'GET',
      url: `/api/resources/${UUID_RES}/download`,
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('https://oss.example.com/files/test.pdf')
    expect(createDownloadRecord).toHaveBeenCalledTimes(1)
  })

  it('VIP 用户下载付费资源成功', async () => {
    vi.mocked(findPublishedResourceById).mockResolvedValue(makeResource())
    vi.mocked(checkDownloadPermission).mockResolvedValue({ allowed: true, reason: 'vip' })

    const res = await app.inject({
      method: 'GET',
      url: `/api/resources/${UUID_RES}/download`,
    })
    expect(res.statusCode).toBe(302)
    expect(createDownloadRecord).toHaveBeenCalledTimes(1)
  })

  it('资源无 fileUrl 返回 404', async () => {
    vi.mocked(findPublishedResourceById).mockResolvedValue(makeResource({ fileUrl: null }))
    vi.mocked(checkDownloadPermission).mockResolvedValue({ allowed: true, reason: 'free' })

    const res = await app.inject({
      method: 'GET',
      url: `/api/resources/${UUID_RES}/download`,
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body).toHaveProperty('code', 404)
  })

  it('无效 UUID 返回 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/resources/not-a-uuid/download',
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body).toHaveProperty('code', 400)
  })

  it('authenticate 被调用且 userId 已注入', async () => {
    vi.mocked(findPublishedResourceById).mockResolvedValue(makeResource())
    vi.mocked(checkDownloadPermission).mockResolvedValue({ allowed: true, reason: 'free' })

    await app.inject({
      method: 'GET',
      url: `/api/resources/${UUID_RES}/download`,
    })
    expect(mockAuthenticate).toHaveBeenCalledTimes(1)
    expect(createDownloadRecord).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'test-user-id' }),
    )
  })
})
