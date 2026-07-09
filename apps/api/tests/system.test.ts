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

// Mock system-queries 以隔离数据库依赖（公开端点会调用 findPublicConfigs）
vi.mock('../src/db/system-queries.js', () => ({
  findPublicConfigs: vi.fn().mockResolvedValue([]),
  findConfigs: vi.fn(),
  createConfig: vi.fn(),
  updateConfig: vi.fn(),
  deleteConfig: vi.fn(),
  findConfigById: vi.fn(),
  findConfigByKey: vi.fn(),
  findIntegrations: vi.fn(),
  findIntegrationById: vi.fn(),
  findIntegrationByName: vi.fn(),
  createIntegration: vi.fn(),
  updateIntegration: vi.fn(),
  deleteIntegration: vi.fn(),
  findApiLogs: vi.fn(),
  findSystemEvents: vi.fn(),
  createSystemEvent: vi.fn(),
  cleanupOldApiLogs: vi.fn().mockResolvedValue(0),
  getApiLogStats: vi.fn().mockResolvedValue({ total: 0, byStatus: [], avgDuration: 0 }),
}));

import { systemRoutes, adminSystemRoutes } from '../src/routes/system';

describe('system routes', () => {
  const server = Fastify({ logger: false });

  afterAll(async () => {
    await server.close();
  });

  it('GET /api/configs 公开端点返回 200 与空列表', async () => {
    await server.register(systemRoutes, { prefix: '/api' });
    await server.register(adminSystemRoutes, { prefix: '/api/admin' });
    await server.ready();

    const res = await server.inject({ method: 'GET', url: '/api/configs' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.code).toBe(0);
    expect(body.data.list).toEqual([]);
  });

  it('GET /api/admin/configs 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/configs' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/configs 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/configs',
      body: { key: 'site_name', value: 'IHUI' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/integrations 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/integrations' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/integrations 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/integrations',
      body: { name: 'wechat', provider: 'wechat' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/logs 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/logs' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/logs/cleanup 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/logs/cleanup',
      body: { days: 30 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/logs/stats 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/logs/stats' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/events 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/events' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/events 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/events',
      body: { type: 'startup', message: 'test' },
    });
    expect(res.statusCode).toBe(401);
  });
});
