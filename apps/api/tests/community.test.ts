import { describe, it, expect, afterAll, vi } from 'vitest';
import Fastify from 'fastify';

// Mock config 避免导入时 env 校验触发 process.exit(1)
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8080,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8000',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}));

import { communityRoutes } from '../src/routes/community';

// community 路由通过 preHandler 钩子统一鉴权，未登录时所有端点返回 401。
const SAMPLE_UUID = '00000000-0000-0000-0000-000000000001';

describe('community routes', () => {
  const server = Fastify({ logger: false });

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

  afterAll(async () => {
    await server.close();
  });

  it('GET /api/circles 未登录返回 401', async () => {
    await server.register(communityRoutes, { prefix: '/api' });
    await server.ready();

    const res = await server.inject({ method: 'GET', url: '/api/circles' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/circles/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/circles/${SAMPLE_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/circles/:id/posts 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/circles/${SAMPLE_UUID}/posts`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/circles/:id/posts 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/circles/${SAMPLE_UUID}/posts`,
      body: { title: 't', content: 'c' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/circles/posts/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/circles/posts/${SAMPLE_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/asks 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/asks' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/asks/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/asks/${SAMPLE_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/asks 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/asks',
      body: { title: 't', content: 'c' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/asks/:id/answers 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/asks/${SAMPLE_UUID}/answers`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/asks/:id/answers 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/asks/${SAMPLE_UUID}/answers`,
      body: { content: 'c' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/asks/answers/:id/accept 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/asks/answers/${SAMPLE_UUID}/accept`,
    });
    expect(res.statusCode).toBe(401);
  });
});
