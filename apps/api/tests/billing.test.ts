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

// Mock DB queries 避免 DB 依赖
vi.mock('../src/db/billing-queries.js', () => ({
  findPlans: vi.fn().mockResolvedValue([]),
  findPlanById: vi.fn().mockResolvedValue(null),
  createOrder: vi.fn(),
  findOrdersByUser: vi.fn(),
  findOrderById: vi.fn(),
  updateOrderStatus: vi.fn(),
  createPayment: vi.fn(),
  findAllOrdersForAdmin: vi.fn(),
}));

import { billingRoutes } from '../src/routes/billing';

describe('billing routes', () => {
  const server = Fastify({ logger: false });

  afterAll(async () => {
    await server.close();
  });

  it('GET /api/plans 返回 200 与方案列表', async () => {
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
    await server.register(billingRoutes, { prefix: '/api' });
    await server.ready();

    const res = await server.inject({ method: 'GET', url: '/api/plans' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.code).toBe(0);
    expect(body.data).toHaveProperty('plans');
    expect(Array.isArray(body.data.plans)).toBe(true);
  });

  it('GET /api/plans/:id 不存在返回 404', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/plans/00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.code).toBe(404);
  });

  it('GET /api/plans/:id 非法 UUID 返回 400', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/plans/not-a-uuid' });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe(400);
  });
});
