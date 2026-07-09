import { describe, it, expect, afterAll, vi } from 'vitest';
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

// Mock content-queries 以隔离数据库依赖（公开端点会调用 find* 查询）
vi.mock('../src/db/content-queries.js', () => ({
  findAnnouncements: vi.fn().mockResolvedValue([]),
  findAnnouncementById: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
  findHelpCategories: vi.fn().mockResolvedValue([]),
  findHelpArticles: vi.fn().mockResolvedValue([]),
  findHelpArticleBySlug: vi.fn(),
  findHelpArticleById: vi.fn(),
  createHelpArticle: vi.fn(),
  updateHelpArticle: vi.fn(),
  deleteHelpArticle: vi.fn(),
  incrementHelpArticleView: vi.fn(),
  findDocs: vi.fn().mockResolvedValue([]),
  findDocBySlug: vi.fn(),
  findDocById: vi.fn(),
  createDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  incrementDocView: vi.fn(),
}));

import { contentRoutes, adminContentRoutes } from '../src/routes/content';

describe('content routes', () => {
  const server = Fastify({ logger: false });

  afterAll(async () => {
    await server.close();
  });

  // ----- 公开端点（无需鉴权，mock 返回空列表） -----

  it('GET /api/announcements 公开端点返回 200 与空列表', async () => {
    // 与 server.ts 保持一致的错误处理器：将验证错误格式化为 { code, message }
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
    await server.register(contentRoutes, { prefix: '/api' });
    await server.register(adminContentRoutes, { prefix: '/api/admin' });
    await server.ready();

    const res = await server.inject({ method: 'GET', url: '/api/announcements' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.code).toBe(0);
    expect(body.data.list).toEqual([]);
  });

  it('GET /api/help/categories 公开端点返回 200 与空列表', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/help/categories' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.code).toBe(0);
    expect(body.data.list).toEqual([]);
  });

  it('GET /api/help/articles 公开端点返回 200 与空列表', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/help/articles' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.code).toBe(0);
    expect(body.data.list).toEqual([]);
  });

  it('GET /api/docs 公开端点返回 200 与空列表', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/docs' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.code).toBe(0);
    expect(body.data.list).toEqual([]);
  });

  // ----- admin 端点（需鉴权，未登录返回 401） -----

  it('POST /api/admin/announcements 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/announcements',
      body: { title: 't', content: 'c' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/docs 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/docs',
      body: { title: 't', slug: 't', content: 'c' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/help/articles 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/help/articles',
      body: { title: 't', slug: 't', content: 'c' },
    });
    expect(res.statusCode).toBe(401);
  });
});
