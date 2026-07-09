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

// Mock oss-queries 以隔离数据库依赖
vi.mock('../src/db/oss-queries.js', () => ({
  findOssDrivers: vi.fn().mockResolvedValue([]),
  findOssDriverById: vi.fn(),
  findOssDriverByName: vi.fn(),
  createOssDriver: vi.fn(),
  updateOssDriver: vi.fn(),
  deleteOssDriver: vi.fn(),
  findDefaultOssDriver: vi.fn(),
  clearOtherDefaults: vi.fn().mockResolvedValue(undefined),
}));

import { ossRoutes, adminOssRoutes } from '../src/routes/oss';

const DUMMY_UUID = '00000000-0000-0000-0000-000000000001';

describe('oss routes', () => {
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
    await server.register(ossRoutes, { prefix: '/api' });
    await server.register(adminOssRoutes, { prefix: '/api/admin' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // 公共端点需登录,未登录返回 401

  it('GET /api/oss/drivers 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/oss/drivers' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/oss/upload 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/oss/upload',
      body: { filename: 'a.png', size: 100 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/oss/download/:id 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/oss/download/${DUMMY_UUID}` });
    expect(res.statusCode).toBe(401);
  });

  // admin 端点需管理员,未登录返回 401

  it('GET /api/admin/oss/drivers 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/oss/drivers' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/oss/drivers/:id 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/admin/oss/drivers/${DUMMY_UUID}` });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/oss/drivers 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/oss/drivers',
      body: { name: 'local', driver: 'local' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('PATCH /api/admin/oss/drivers/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/admin/oss/drivers/${DUMMY_UUID}`,
      body: { isEnabled: true },
    });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/admin/oss/drivers/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/admin/oss/drivers/${DUMMY_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });
});
