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

import { commentRoutes } from '../src/routes/comments';

// comments 路由通过 preHandler 钩子统一鉴权，未登录时所有端点返回 401。
const SAMPLE_UUID = '00000000-0000-0000-0000-000000000001';

describe('comment routes', () => {
  const server = Fastify({ logger: false });

  afterAll(async () => {
    await server.close();
  });

  it('GET /api/comments 未登录返回 401', async () => {
    await server.register(commentRoutes, { prefix: '/api' });
    await server.ready();

    const res = await server.inject({ method: 'GET', url: '/api/comments' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/comments 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/comments',
      body: { resourceType: 'project', resourceId: 'r1', content: 'hi' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('PATCH /api/comments/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/comments/${SAMPLE_UUID}`,
      body: { content: 'updated' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/comments/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/comments/${SAMPLE_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/comments/:id/like 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/comments/${SAMPLE_UUID}/like`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/feedbacks 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/feedbacks',
      body: { type: 'bug', title: 't', content: 'c' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/feedbacks 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/feedbacks' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/feedbacks 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/feedbacks' });
    expect(res.statusCode).toBe(401);
  });
});
