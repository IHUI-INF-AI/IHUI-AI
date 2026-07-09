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

// Mock statistics-queries 以隔离数据库依赖
vi.mock('../src/db/statistics-queries.js', () => ({
  getLearnStatistics: vi.fn().mockResolvedValue({ lessonTotal: 0, lessonPublished: 0, signupTotal: 0, viewSum: 0 }),
  getExamStatistics: vi.fn().mockResolvedValue({ examTotal: 0, examPublished: 0, recordTotal: 0, passTotal: 0, passRate: 0 }),
  getContentStatistics: vi.fn().mockResolvedValue({ memberTotal: 0, postTotal: 0, announcementTotal: 0, articleTotal: 0 }),
  getOverviewStatistics: vi.fn().mockResolvedValue({
    memberTotal: 0, lessonTotal: 0, examTotal: 0, signupTotal: 0, examRecordTotal: 0, postTotal: 0, announcementTotal: 0, articleTotal: 0,
  }),
  findStatisticsSnapshots: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findStatisticsSnapshotById: vi.fn(),
  createStatisticsSnapshot: vi.fn(),
  deleteStatisticsSnapshot: vi.fn().mockResolvedValue(undefined),
}));

import { statisticsRoutes, adminStatisticsRoutes } from '../src/routes/statistics';

const DUMMY_UUID = '00000000-0000-0000-0000-000000000001';

describe('statistics routes', () => {
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
    await server.register(statisticsRoutes, { prefix: '/api' });
    await server.register(adminStatisticsRoutes, { prefix: '/api/admin' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // 公共统计端点需登录，未登录返回 401

  it('GET /api/statistics/overview 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/statistics/overview' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/statistics/learn 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/statistics/learn' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/statistics/exam 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/statistics/exam' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/statistics/content 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/statistics/content' });
    expect(res.statusCode).toBe(401);
  });

  // admin 快照端点需管理员，未登录返回 401

  it('GET /api/admin/statistics/snapshots 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/statistics/snapshots' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/statistics/snapshots 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/statistics/snapshots',
      body: { type: 'overview' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/admin/statistics/snapshots/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/admin/statistics/snapshots/${DUMMY_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });
});
