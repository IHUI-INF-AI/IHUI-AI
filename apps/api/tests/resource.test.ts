import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest';
import Fastify from 'fastify';

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
}));

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
}));

import { resourceRoutes, adminResourceRoutes } from '../src/routes/resource';

const DUMMY_UUID = '00000000-0000-0000-0000-000000000001';

describe('resource routes', () => {
  const server = Fastify({ logger: false });

  beforeAll(async () => {
    server.setErrorHandler((error, _request, reply) => {
      const statusCode =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500;
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : error.message,
      });
    });
    await server.register(resourceRoutes, { prefix: '/api' });
    await server.register(adminResourceRoutes, { prefix: '/api/admin' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // ----- 公共端点（公开访问，无需登录） -----

  it('GET /api/resources 公开访问返回 200', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/resources' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/resources/categories 公开访问返回 200', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/resources/categories' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/resources/:id 公开访问，资源不存在返回 404', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/resources/${DUMMY_UUID}` });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/resources/by-ids 公开访问返回 200', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/resources/by-ids?ids=${DUMMY_UUID}` });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/resources/products/:id 公开访问，产品不存在返回 404', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/resources/products/${DUMMY_UUID}` });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/resources/tags/:id 公开访问，标签不存在返回 404', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/resources/tags/${DUMMY_UUID}` });
    expect(res.statusCode).toBe(404);
  });

  // ----- admin 端点（需管理员，未登录返回 401） -----

  it('GET /api/admin/resources 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/resources' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/resources 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/resources',
      body: { title: '测试资源' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/resources/categories 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/resources/categories',
      body: { name: '测试分类' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/resources/tags 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/resources/tags',
      body: { name: '测试标签' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/resources/products 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/resources/products',
      body: { resourceId: DUMMY_UUID, name: '测试产品' },
    });
    expect(res.statusCode).toBe(401);
  });
});
