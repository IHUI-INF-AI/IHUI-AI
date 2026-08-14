import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import Fastify from 'fastify'

// Mock config 避免导入时 env 校验触发 process.exit(1)
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

// Mock resource-queries 以隔离数据库依赖
vi.mock('../src/db/resource-queries.js', () => ({
  findCategoriesByPid: vi.fn().mockResolvedValue([]),
  findCategoryById: vi.fn(),
  createResourceCategory: vi.fn(),
  updateResourceCategory: vi.fn(),
  deleteResourceCategory: vi.fn(),
  findResources: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findResourceByIdAndIncrementView: vi.fn(),
  findResourceById: vi.fn(),
  findResourcesByIds: vi.fn().mockResolvedValue([]),
  createResource: vi.fn(),
  updateResource: vi.fn(),
  deleteResource: vi.fn(),
  publishResource: vi.fn(),
  findProducts: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findProductById: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  findTags: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findTagById: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}))

import { adminResourceRoutes } from '../src/routes/resource'

/**
 * 验证 admin resource 单数路径别名路由已注册(消除 404 风险)。
 *
 * 背景:前端 oss-config/resource-product/resource-tag 页面调用
 *   - /api/v1/admin/resource/products
 *   - /api/v1/admin/resource/tags
 * 后端 adminResourceRoutes(根 resource.ts 第 787-812 行)已注册单数别名
 *   - GET /resource/products
 *   - GET /resource/tags
 * 挂载前缀 /api/admin → 实际路径 /api/admin/resource/products 与 /api/admin/resource/tags。
 *
 * 路由已注册的判定:未登录请求返回 401(requireAdmin 拦截),区别于路由缺失的 404。
 */
describe('admin resource singular-alias routes', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((error, _request, reply) => {
      const statusCode =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : error.message,
      })
    })
    await server.register(adminResourceRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  // ----- 单数路径别名(前端 /api/v1/admin/resource/products 调用目标)-----

  it('GET /api/admin/resource/products 未登录返回 401(路由已注册,非 404)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/resource/products' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/resource/products 带 page/pageSize/name 参数未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/resource/products?page=1&pageSize=20&name=test',
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/resource/tags 未登录返回 401(路由已注册,非 404)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/resource/tags' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/resource/tags 带 page/pageSize/name 参数未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/resource/tags?page=1&pageSize=20&name=test',
    })
    expect(res.statusCode).toBe(401)
  })

  // ----- 复数路径(原 admin CRUD,回归保护)-----

  it('GET /api/admin/resources/products 未登录返回 401(复数路径已注册)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/resources/products' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/resources/tags 未登录返回 401(复数路径已注册)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/resources/tags' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/admin/resources/products 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/resources/products',
      body: { resourceId: '00000000-0000-4000-8000-000000000001', name: '测试产品' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/admin/resources/tags 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/resources/tags',
      body: { name: '测试标签' },
    })
    expect(res.statusCode).toBe(401)
  })
})
