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

import { searchRoutes } from '../src/routes/search';

describe('search routes', () => {
  const server = Fastify({ logger: false });

  afterAll(async () => {
    await server.close();
  });

  it('GET /api/search 未登录返回 401', async () => {
    await server.register(searchRoutes, { prefix: '/api' });
    await server.ready();

    const res = await server.inject({ method: 'GET', url: '/api/search?q=test' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/search/history 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/search/history' });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/search/history 未登录返回 401', async () => {
    const res = await server.inject({ method: 'DELETE', url: '/api/search/history' });
    expect(res.statusCode).toBe(401);
  });
});
