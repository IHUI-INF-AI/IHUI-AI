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

// Mock live-queries 以隔离数据库依赖
vi.mock('../src/db/live-queries.js', () => ({
  findPublishedLiveCategories: vi.fn().mockResolvedValue([]),
  findAllLiveCategories: vi.fn().mockResolvedValue([]),
  findLiveCategoryById: vi.fn(),
  createLiveCategory: vi.fn(),
  updateLiveCategory: vi.fn(),
  deleteLiveCategory: vi.fn(),
  findLiveChannels: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findLiveChannelById: vi.fn(),
  findLiveChannelsByIds: vi.fn().mockResolvedValue([]),
  createLiveChannel: vi.fn(),
  updateLiveChannel: vi.fn(),
  deleteLiveChannel: vi.fn(),
  incrementLiveViewCount: vi.fn().mockResolvedValue(undefined),
  findLecturers: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findLecturerById: vi.fn(),
  createLecturer: vi.fn(),
  updateLecturer: vi.fn(),
  deleteLecturer: vi.fn(),
  getLiveStatistics: vi.fn().mockResolvedValue({ total: 0, living: 0, published: 0, viewSum: 0 }),
}));

import { liveRoutes, adminLiveRoutes } from '../src/routes/live';

const DUMMY_UUID = '00000000-0000-0000-0000-000000000001';

describe('live routes', () => {
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
    await server.register(liveRoutes, { prefix: '/api' });
    await server.register(adminLiveRoutes, { prefix: '/api/admin' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // ----- 公共端点（公开访问，无需登录） -----

  it('GET /api/live/categories 公开访问返回 200', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/live/categories' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/live/channels 公开访问返回 200', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/live/channels' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/live/channels/:id 公开访问，频道不存在返回 404', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/live/channels/${DUMMY_UUID}` });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/live/lecturers 公开访问返回 200', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/live/lecturers' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/live/statistics 公开访问返回 200', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/live/statistics' });
    expect(res.statusCode).toBe(200);
  });

  // ----- admin 端点（需管理员，未登录返回 401） -----

  it('GET /api/admin/live/categories 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/live/categories' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/live/channels 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/live/channels',
      body: { title: '测试直播' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/live/lecturers 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/live/lecturers',
      body: { name: '测试讲师' },
    });
    expect(res.statusCode).toBe(401);
  });
});
