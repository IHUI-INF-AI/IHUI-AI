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

// Mock DB queries：公开端点 GET /files/shared/:token 会调用 findShareByToken
vi.mock('../src/db/file-queries.js', () => ({
  searchFiles: vi.fn(),
  canAccessFile: vi.fn(),
  createShare: vi.fn(),
  findShareByToken: vi.fn().mockResolvedValue(null),
  deleteShare: vi.fn(),
  findRecentFiles: vi.fn(),
}));

import { fileRoutes } from '../src/routes/files';
import { socialRoutes } from '../src/routes/social';

describe('file routes', () => {
  const server = Fastify({ logger: false });

  afterAll(async () => {
    await server.close();
  });

  it('GET /api/files/search 未登录返回 401', async () => {
    await server.register(fileRoutes, { prefix: '/api' });
    await server.register(socialRoutes, { prefix: '/api' });
    await server.ready();

    const res = await server.inject({ method: 'GET', url: '/api/files/search' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/files/recent 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/files/recent' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/tags 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/tags',
      body: { name: 'tag' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/files/shared/:token 公开端点返回 404（分享不存在）', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/files/shared/non-existent-token',
    });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.code).toBe(404);
  });
});
