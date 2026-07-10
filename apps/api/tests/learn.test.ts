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

// Mock learn-queries 以隔离数据库依赖
vi.mock('../src/db/learn-queries.js', () => ({
  findPublishedCategories: vi.fn().mockResolvedValue([]),
  findAllCategories: vi.fn().mockResolvedValue([]),
  findLearnCategoryById: vi.fn(),
  createLearnCategory: vi.fn(),
  updateLearnCategory: vi.fn(),
  deleteLearnCategory: vi.fn(),
  findPublishedLessons: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findLessonById: vi.fn(),
  findLessonByIdAdmin: vi.fn(),
  createLesson: vi.fn(),
  updateLesson: vi.fn(),
  deleteLesson: vi.fn(),
  incrementViewCount: vi.fn().mockResolvedValue(undefined),
  findLessonChapters: vi.fn().mockResolvedValue([]),
  findChapterById: vi.fn(),
  createChapter: vi.fn(),
  updateChapter: vi.fn(),
  deleteChapter: vi.fn(),
  findLessonSections: vi.fn().mockResolvedValue([]),
  findMyLessons: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  signUpLesson: vi.fn().mockResolvedValue(undefined),
  findSignUp: vi.fn(),
  updateProgress: vi.fn(),
}));

import { learnRoutes, adminLearnRoutes } from '../src/routes/learn';

const DUMMY_UUID = '00000000-0000-0000-0000-000000000001';

describe('learn routes', () => {
  const server = Fastify({ logger: false });

  beforeAll(async () => {
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
    await server.register(learnRoutes, { prefix: '/api' });
    await server.register(adminLearnRoutes, { prefix: '/api/admin' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // ----- 公共浏览端点（匿名可访问，返回 200） -----

  it('GET /api/learn/categories 未登录返回 200（公开）', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/learn/categories' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/learn/lessons 未登录返回 200（公开）', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/learn/lessons' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/learn/lessons/:id 未登录返回 404（公开，课程不存在）', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/learn/lessons/${DUMMY_UUID}` });
    expect(res.statusCode).toBe(404);
  });

  // ----- 需登录端点（未登录返回 401） -----

  it('GET /api/learn/my-lessons 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/learn/my-lessons' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/learn/lessons/:id/sign-up 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/learn/lessons/${DUMMY_UUID}/sign-up`,
    });
    expect(res.statusCode).toBe(401);
  });

  // ----- admin 端点（需管理员，未登录返回 401） -----

  it('GET /api/admin/learn/categories 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/learn/categories' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/learn/lessons 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/learn/lessons',
      body: { title: '测试课程' },
    });
    expect(res.statusCode).toBe(401);
  });
});
