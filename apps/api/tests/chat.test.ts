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

import { chatRoutes } from '../src/routes/chat';

describe('chat routes', () => {
  const server = Fastify({ logger: false });

  afterAll(async () => {
    await server.close();
  });

  it('GET /api/chat/conversations 未登录返回 401', async () => {
    await server.register(chatRoutes, { prefix: '/api/chat' });
    await server.ready();

    const res = await server.inject({ method: 'GET', url: '/api/chat/conversations' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/chat/conversations 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/chat/conversations',
      body: {},
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/chat/favorites 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/chat/favorites' });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/chat/messages/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/chat/messages/00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(401);
  });
});
