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

// Mock visit-tracking-queries 以隔离数据库依赖
vi.mock('../src/db/visit-tracking-queries.js', () => ({
  saveVisitLog: vi.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000001', visitDate: '2026-07-08' }),
  getVisitSummary: vi.fn().mockResolvedValue({ pv: 0, uv: 0, ipCount: 0, memberCount: 0 }),
  getDayPvList: vi.fn().mockResolvedValue([]),
  getDayUvList: vi.fn().mockResolvedValue([]),
  findIpCityList: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
}));

import { visitTrackingRoutes, adminVisitTrackingRoutes } from '../src/routes/visit-tracking';

describe('visit-tracking routes', () => {
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
    await server.register(visitTrackingRoutes, { prefix: '/api' });
    await server.register(adminVisitTrackingRoutes, { prefix: '/api/admin' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // 公共保存端点无需登录，可正常写入

  it('POST /api/visit-tracking/visit-log 无需登录返回 200', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/visit-tracking/visit-log',
      body: { ip: '127.0.0.1', url: '/' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.code).toBe(0);
  });

  // admin 统计端点需管理员，未登录返回 401

  it('GET /api/admin/visit-tracking/summary 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/visit-tracking/summary' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/visit-tracking/day/pv/list 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/visit-tracking/day/pv/list' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/visit-tracking/day/uv/list 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/visit-tracking/day/uv/list' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/visit-tracking/ip-city/summary/list 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/visit-tracking/ip-city/summary/list',
    });
    expect(res.statusCode).toBe(401);
  });
});
