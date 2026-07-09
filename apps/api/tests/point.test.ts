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

// Mock point-queries 以隔离数据库依赖
vi.mock('../src/db/point-queries.js', () => ({
  findChannels: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findAllActiveChannels: vi.fn().mockResolvedValue([]),
  findChannelById: vi.fn(),
  createChannel: vi.fn(),
  updateChannel: vi.fn(),
  findPointById: vi.fn(),
  createPoint: vi.fn(),
  updatePoint: vi.fn(),
  deletePoint: vi.fn(),
  findRelations: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  updatePointRelations: vi.fn(),
  findRecords: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
}));

import { pointRoutes, adminPointRoutes } from '../src/routes/point';

const DUMMY_UUID = '00000000-0000-0000-0000-000000000001';

describe('point routes', () => {
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
    await server.register(pointRoutes, { prefix: '/api' });
    await server.register(adminPointRoutes, { prefix: '/api/admin' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // ----- 公共端点（需登录，未登录返回 401） -----

  it('GET /api/edu-points/channels 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/edu-points/channels' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/edu-points/channels/:id 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/edu-points/channels/${DUMMY_UUID}` });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/edu-points/rules/:id 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/edu-points/rules/${DUMMY_UUID}` });
    expect(res.statusCode).toBe(401);
  });

  // ----- admin 端点（需管理员，未登录返回 401） -----

  it('GET /api/admin/edu-points/channels 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/edu-points/channels' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/edu-points/channels 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/edu-points/channels',
      body: { name: '测试渠道' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/edu-points/rules 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/edu-points/rules',
      body: { name: '测试规则' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/edu-points/relations 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/edu-points/relations' });
    expect(res.statusCode).toBe(401);
  });

  it('PUT /api/admin/edu-points/relations 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'PUT',
      url: '/api/admin/edu-points/relations',
      body: { pointId: DUMMY_UUID, channelIds: [] },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/edu-points/records 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/edu-points/records' });
    expect(res.statusCode).toBe(401);
  });
});
