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

// Mock topic-queries 以隔离数据库依赖
vi.mock('../src/db/topic-queries.js', () => ({
  findTopics: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findTopicById: vi.fn(),
  findTopicDetail: vi.fn(),
  createTopic: vi.fn(),
  updateTopic: vi.fn(),
  deleteTopic: vi.fn(),
}));

import { topicRoutes, adminTopicRoutes } from '../src/routes/topic';

const DUMMY_UUID = '00000000-0000-0000-0000-000000000001';

describe('topic routes', () => {
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
    await server.register(topicRoutes, { prefix: '/api' });
    await server.register(adminTopicRoutes, { prefix: '/api/admin' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // ----- 公共端点（公开访问，无需登录） -----

  it('GET /api/topics 公开访问返回 200', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/topics' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/topics/:id 公开访问，资源不存在返回 404', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/topics/${DUMMY_UUID}` });
    expect(res.statusCode).toBe(404);
  });

  // ----- admin 端点（需管理员，未登录返回 401） -----

  it('GET /api/admin/topics 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/topics' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/topics 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/topics',
      body: { title: '测试专题' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('PUT /api/admin/topics/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'PUT',
      url: `/api/admin/topics/${DUMMY_UUID}`,
      body: { title: '更新专题' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/admin/topics/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/admin/topics/${DUMMY_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });
});
