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

import { gamificationRoutes } from '../src/routes/gamification';

describe('gamification routes', () => {
  const server = Fastify({ logger: false });

  afterAll(async () => {
    await server.close();
  });

  it('GET /api/points 未登录返回 401', async () => {
    await server.register(gamificationRoutes, { prefix: '/api' });
    await server.ready();

    const res = await server.inject({ method: 'GET', url: '/api/points' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/points/transactions 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/points/transactions' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/points/admin/adjust 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/points/admin/adjust',
      body: { userId: '00000000-0000-0000-0000-000000000001', amount: 10 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/leaderboard 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/leaderboard' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/sign-in 未登录返回 401', async () => {
    const res = await server.inject({ method: 'POST', url: '/api/sign-in' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/sign-in/today 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/sign-in/today' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/sign-in/history 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/sign-in/history' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/levels 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/levels' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/levels/current 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/levels/current' });
    expect(res.statusCode).toBe(401);
  });
});
