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

// Mock promotion-queries 以隔离数据库依赖（公开端点 GET /activities 会调用 findActivities）
vi.mock('../src/db/promotion-queries.js', () => ({
  createInvitationCode: vi.fn(),
  findInvitationCodesByUser: vi.fn(),
  findInvitationByCode: vi.fn(),
  findInviteesByUser: vi.fn(),
  findActivities: vi.fn().mockResolvedValue([]),
  findActivityBySlug: vi.fn(),
  findActivityById: vi.fn(),
  joinActivity: vi.fn(),
  leaveActivity: vi.fn(),
  findActivityParticipants: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
  deleteActivity: vi.fn(),
  createCoupon: vi.fn(),
  findCoupons: vi.fn(),
  verifyCoupon: vi.fn(),
}));

import { promotionRoutes, adminPromotionRoutes } from '../src/routes/promotions';

const SAMPLE_UUID = '00000000-0000-0000-0000-000000000001';

describe('promotion routes', () => {
  const server = Fastify({ logger: false });

  afterAll(async () => {
    await server.close();
  });

  it('GET /api/invitations 未登录返回 401', async () => {
    await server.register(promotionRoutes, { prefix: '/api' });
    await server.register(adminPromotionRoutes, { prefix: '/api/admin' });
    await server.ready();

    const res = await server.inject({ method: 'GET', url: '/api/invitations' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/invitations 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/invitations',
      body: {},
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/invitations/invitees 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/invitations/invitees' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/coupons/verify 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/coupons/verify',
      body: { code: 'TEST', amount: 100 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/activities 公开端点返回 200 与空列表', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/activities' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.code).toBe(0);
    expect(body.data.list).toEqual([]);
  });

  it('POST /api/activities/:id/join 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/activities/${SAMPLE_UUID}/join`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/coupons 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/coupons' });
    expect(res.statusCode).toBe(401);
  });
});
