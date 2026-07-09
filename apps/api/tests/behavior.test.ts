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

// Mock behavior-queries 以隔离数据库依赖
vi.mock('../src/db/behavior-queries.js', () => ({
  recordWatch: vi.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000001', updated: false }),
  getWatchCount: vi.fn().mockResolvedValue(0),
  findWatchList: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  deleteWatch: vi.fn().mockResolvedValue(false),
  clearAllWatch: vi.fn().mockResolvedValue(0),
  getBehaviorStatistics: vi.fn().mockResolvedValue({ watchTotal: 0, userTotal: 0 }),
  findAllWatchList: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
}));

import { behaviorRoutes, adminBehaviorRoutes } from '../src/routes/behavior';

const DUMMY_UUID = '00000000-0000-0000-0000-000000000001';

describe('behavior routes', () => {
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
    await server.register(behaviorRoutes, { prefix: '/api' });
    await server.register(adminBehaviorRoutes, { prefix: '/api/admin' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // 公共行为端点需登录，未登录返回 401

  it('POST /api/behavior/watch 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/behavior/watch',
      body: { topicId: '1', topicType: 'lesson' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/behavior/watch/count 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/behavior/watch/count?topicId=1&topicType=lesson',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/behavior/watch/list 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/behavior/watch/list' });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/behavior/watch 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/behavior/watch?id=${DUMMY_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/behavior/watch/all 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/behavior/watch/all?userId=${DUMMY_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  // admin 行为端点需管理员，未登录返回 401

  it('GET /api/admin/behavior/statistics 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/behavior/statistics' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/behavior/watch/list 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/behavior/watch/list' });
    expect(res.statusCode).toBe(401);
  });
});
