// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-568 回归(2026-11-08):资源公开接口(列表/批量/详情)不得下发 fileUrl,
 * 付费资源的下载地址只能经 GET /resources/:id/download 的权限校验后返回(302)。
 *
 * 改前必红口径:旧响应直接透传 DB 整行,列表/批量/详情三项都带 fileUrl → 断言失败;
 * 下载端点保持 302 重定向,证明收口未误伤已授权下载。
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const fixture = vi.hoisted(() => {
  const FILE_URL = 'https://oss.example.com/files/paid.pdf'
  const makeResource = (overrides: Record<string, unknown> = {}) => ({
    id: '11111111-1111-4111-8111-111111111111',
    title: '付费资源',
    coverImage: null,
    intro: null,
    categoryId: null,
    fileUrl: FILE_URL,
    fileType: 'application/pdf',
    fileSize: 1024,
    isPublished: true,
    viewCount: 0,
    downloadCount: 0,
    sort: 0,
    status: 1,
    type: null,
    price: 999,
    productId: null,
    tagIdList: null,
    image: null,
    introduction: null,
    cidList: null,
    ownerUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })
  return { FILE_URL, makeResource }
})

const { FILE_URL, makeResource } = fixture

vi.mock('../../db/resource-queries.js', () => ({
  findCategoriesByPid: vi.fn().mockResolvedValue([]),
  findCategoryById: vi.fn().mockResolvedValue(undefined),
  createResourceCategory: vi.fn(),
  updateResourceCategory: vi.fn(),
  deleteResourceCategory: vi.fn(),
  findResources: vi
    .fn()
    .mockResolvedValue({ list: [fixture.makeResource()], total: 1, page: 1, pageSize: 20 }),
  findResourceByIdAndIncrementView: vi
    .fn()
    .mockResolvedValue(fixture.makeResource({ categoryName: null })),
  findResourceById: vi.fn().mockResolvedValue(undefined),
  findResourcesByIds: vi.fn().mockResolvedValue([fixture.makeResource()]),
  createResource: vi.fn(),
  updateResource: vi.fn(),
  deleteResource: vi.fn(),
  findMyResources: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  deleteResourceIfOwned: vi.fn(),
  publishResource: vi.fn(),
  findProducts: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findProductById: vi.fn().mockResolvedValue(undefined),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  findTags: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findTagById: vi.fn().mockResolvedValue(undefined),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
  findPublishedResourceById: vi.fn().mockResolvedValue(fixture.makeResource()),
  checkDownloadPermission: vi.fn().mockResolvedValue({ allowed: true, reason: 'free' }),
  createDownloadRecord: vi.fn().mockResolvedValue(undefined),
  incrementResourceDownloadCount: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'test-user-id'
    return { userId: 'test-user-id' }
  }),
}))

import { findPublishedResourceById, checkDownloadPermission } from '../../db/resource-queries.js'
import { resourceRoutes } from '../resource.js'

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  app.setErrorHandler((err: Error & { statusCode?: number }, _request, reply) => {
    const statusCode =
      err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
    reply.status(statusCode).send({ code: statusCode, message: err.message })
  })
  await app.register(resourceRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(findPublishedResourceById).mockResolvedValue(makeResource() as never)
  vi.mocked(checkDownloadPermission).mockResolvedValue({ allowed: true, reason: 'free' } as never)
})

function expectNoFileUrl(payload: Record<string, unknown>): void {
  expect(payload).not.toHaveProperty('fileUrl')
  expect(JSON.stringify(payload)).not.toContain(FILE_URL)
}

describe('F-568 资源公开接口不泄露 fileUrl', () => {
  it('GET /resources 列表项无 fileUrl', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/resources' })
    expect(res.statusCode).toBe(200)
    const item = (res.json().data as { list: Array<Record<string, unknown>> }).list[0]
    expectNoFileUrl(item)
  })

  it('GET /resources/by-ids 批量项无 fileUrl', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/resources/by-ids?ids=11111111-1111-4111-8111-111111111111',
    })
    expect(res.statusCode).toBe(200)
    const item = (res.json().data as { list: Array<Record<string, unknown>> }).list[0]
    expectNoFileUrl(item)
  })

  it('GET /resources/:id 详情无 fileUrl', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/resources/11111111-1111-4111-8111-111111111111',
    })
    expect(res.statusCode).toBe(200)
    expectNoFileUrl(res.json().data.resource)
  })

  it('GET /resources/:id/download 授权后仍返回 302 下载地址', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/resources/11111111-1111-4111-8111-111111111111/download',
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe(FILE_URL)
  })
})
