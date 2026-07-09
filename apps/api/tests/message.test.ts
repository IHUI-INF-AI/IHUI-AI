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

// Mock message-queries 以隔离数据库依赖
vi.mock('../src/db/message-queries.js', () => ({
  findAnnouncements: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findAnnouncementById: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
  findEduMessages: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findEduMessageById: vi.fn(),
  markEduMessageRead: vi.fn(),
  countUnreadEduMessages: vi.fn().mockResolvedValue(0),
}));

import { messageRoutes, adminMessageRoutes } from '../src/routes/message';

const DUMMY_UUID = '00000000-0000-0000-0000-000000000001';

describe('message routes', () => {
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
    await server.register(messageRoutes, { prefix: '/api' });
    await server.register(adminMessageRoutes, { prefix: '/api/admin' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // ----- 公共端点（需登录，未登录返回 401） -----

  it('GET /api/messages/announcements 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/messages/announcements' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/messages/announcements/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/messages/announcements/${DUMMY_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/messages 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/messages' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/messages/unread-count 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/messages/unread-count' });
    expect(res.statusCode).toBe(401);
  });

  it('PUT /api/messages/:id/read 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'PUT',
      url: `/api/messages/${DUMMY_UUID}/read`,
    });
    expect(res.statusCode).toBe(401);
  });

  // ----- admin 端点（需管理员，未登录返回 401） -----

  it('GET /api/admin/messages/announcements 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/messages/announcements',
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/messages/announcements 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/messages/announcements',
      body: { title: '测试公告' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/admin/messages/announcements/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/admin/messages/announcements/${DUMMY_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/messages 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/messages' });
    expect(res.statusCode).toBe(401);
  });
});
