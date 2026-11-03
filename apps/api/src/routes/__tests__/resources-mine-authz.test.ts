// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 归属闸用例(2026-10-29,web→RN 台账 student/my-resources 数据面结清):
// GET /api/resources/mine + DELETE /api/resources/:id。
// 全程 vi.mock 资源查询层 ⇒ 不触任何真实数据库连接(§5 测试隔离;PG 8810/Redis 8811 不在射程)。
const UUID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_A = '11111111-1111-4111-8111-111111111111'

const mockResourceQueries = vi.hoisted(() => ({
  findCategoriesByPid: vi.fn(),
  findCategoryById: vi.fn(),
  createResourceCategory: vi.fn(),
  updateResourceCategory: vi.fn(),
  deleteResourceCategory: vi.fn(),
  findResources: vi.fn(),
  findResourceByIdAndIncrementView: vi.fn(),
  findResourceById: vi.fn(),
  findResourcesByIds: vi.fn(),
  createResource: vi.fn(),
  updateResource: vi.fn(),
  deleteResource: vi.fn(),
  publishResource: vi.fn(),
  findProducts: vi.fn(),
  findProductById: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  findTags: vi.fn(),
  findTagById: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
  findPublishedResourceById: vi.fn(),
  checkDownloadPermission: vi.fn(),
  createDownloadRecord: vi.fn(),
  incrementResourceDownloadCount: vi.fn(),
  findMyResources: vi.fn(),
  deleteResourceIfOwned: vi.fn(),
}))

vi.mock('../../db/resource-queries.js', () => mockResourceQueries)

const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = USER_A
    return { userId: USER_A } as never
  }),
}))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

// requireAdmin 在本套件的端点未挂载(均为用户侧),给恒通过占位即可。
vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async () => undefined),
}))

import { resourceRoutes } from '../resource.js'
import {
  findMyResources,
  deleteResourceIfOwned,
  deleteResource,
} from '../../db/resource-queries.js'

function setAuthed(userId: string) {
  mockAuthenticate.mockImplementation(async (request: { userId?: string }) => {
    request.userId = userId
    return { userId } as never
  })
}

function setUnauthed() {
  mockAuthenticate.mockImplementation(async () => {
    const err = new Error('Authentication required')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  })
}

describe('GET /api/resources/mine — 归属鉴权', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(resourceRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    setAuthed(USER_A)
    vi.mocked(findMyResources).mockResolvedValue({
      list: [
        {
          id: UUID_A,
          title: '我的课件',
          description: null,
          fileType: 'pdf',
          fileSize: 1024,
          viewCount: 3,
          downloadCount: 1,
          status: 1,
          createdAt: '2026-10-29T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    })
  })

  it('未登录 401,且不发出任何归属查询(副作用没发生)', async () => {
    setUnauthed()
    const res = await app.inject({ method: 'GET', url: '/api/resources/mine?page=1&pageSize=20' })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toHaveProperty('code', 401)
    expect(findMyResources).not.toHaveBeenCalled()
  })

  it('正向对照:登录主体 200,归属取自令牌并显式入参,分页参数逐字透传', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/resources/mine?page=2&pageSize=15' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('code', 0)
    // 消费方(web page.tsx:60 / RN 壳)读 res.data.list / res.data.total —— 形状锁:
    expect(Array.isArray(body.data.list)).toBe(true)
    expect(body.data).toHaveProperty('total', 1)
    expect(findMyResources).toHaveBeenCalledTimes(1)
    expect(findMyResources).toHaveBeenCalledWith({ ownerUserId: USER_A, page: 2, pageSize: 15 })
  })

  it('客户端自报 ownerUserId 被忽略:归属主体仍只认鉴权结果(§5 认证不等于授权)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/resources/mine?page=1&pageSize=20&ownerUserId=${UUID_A}`,
    })
    expect(res.statusCode).toBe(200)
    expect(findMyResources).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(findMyResources).mock.calls[0]![0]
    expect(arg.ownerUserId).toBe(USER_A)
    expect(arg).not.toHaveProperty('undefined')
    expect(JSON.stringify(arg)).not.toContain(UUID_A)
  })

  it('非法分页(page=0)400,归属查询不发出', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/resources/mine?page=0' })
    expect(res.statusCode).toBe(400)
    expect(findMyResources).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/resources/:id — 归属闸', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(resourceRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    setAuthed(USER_A)
  })

  it('未登录 401,删除函数不发出(副作用没发生)', async () => {
    setUnauthed()
    const res = await app.inject({ method: 'DELETE', url: `/api/resources/${UUID_A}` })
    expect(res.statusCode).toBe(401)
    expect(deleteResourceIfOwned).not.toHaveBeenCalled()
    expect(deleteResource).not.toHaveBeenCalled()
  })

  it('越权删除 404:仅调用 (id, owner) 原子归属闸一次,旧全量删除 deleteResource 未被调用', async () => {
    // 模拟库侧裁决:该行的 owner 不是调用者(not_found ⇒ 原子语句零行命中)。
    vi.mocked(deleteResourceIfOwned).mockResolvedValue('not_found')
    const res = await app.inject({ method: 'DELETE', url: `/api/resources/${UUID_A}` })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toHaveProperty('code', 404)
    expect(deleteResourceIfOwned).toHaveBeenCalledTimes(1)
    expect(deleteResourceIfOwned).toHaveBeenCalledWith(UUID_A, USER_A)
    expect(deleteResource).not.toHaveBeenCalled()
  })

  it('正向对照:本人资源删除 200 ok:true', async () => {
    vi.mocked(deleteResourceIfOwned).mockResolvedValue('deleted')
    const res = await app.inject({ method: 'DELETE', url: `/api/resources/${UUID_A}` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('data', { ok: true })
    expect(deleteResourceIfOwned).toHaveBeenCalledWith(UUID_A, USER_A)
    expect(deleteResource).not.toHaveBeenCalled()
  })

  it('非法 id 400,删除函数不发出', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/resources/not-a-uuid' })
    expect(res.statusCode).toBe(400)
    expect(deleteResourceIfOwned).not.toHaveBeenCalled()
    expect(deleteResource).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
