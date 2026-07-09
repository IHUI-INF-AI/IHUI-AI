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

// Mock schedule-queries 以隔离数据库依赖
vi.mock('../src/db/schedule-queries.js', () => ({
  findScheduleTasks: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findScheduleTaskById: vi.fn(),
  createScheduleTask: vi.fn(),
  updateScheduleTask: vi.fn(),
  deleteScheduleTask: vi.fn().mockResolvedValue(undefined),
  setScheduleTaskEnabled: vi.fn(),
  runScheduleTaskNow: vi.fn(),
  findScheduleLogs: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findScheduleLogById: vi.fn(),
}));

import { scheduleRoutes, adminScheduleRoutes } from '../src/routes/schedule';

const DUMMY_UUID = '00000000-0000-0000-0000-000000000001';

describe('schedule routes', () => {
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
    await server.register(scheduleRoutes, { prefix: '/api' });
    await server.register(adminScheduleRoutes, { prefix: '/api/admin' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // 公共端点需登录，未登录返回 401

  it('GET /api/schedule/tasks 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/schedule/tasks' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/schedule/tasks/:id 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/schedule/tasks/${DUMMY_UUID}` });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/schedule/logs 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/schedule/logs' });
    expect(res.statusCode).toBe(401);
  });

  // admin 端点需管理员，未登录返回 401

  it('POST /api/admin/schedule/tasks 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/schedule/tasks',
      body: { name: '测试任务', cronExpression: '0 * * * *' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/admin/schedule/tasks/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/admin/schedule/tasks/${DUMMY_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('PUT /api/admin/schedule/tasks/:id/run 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'PUT',
      url: `/api/admin/schedule/tasks/${DUMMY_UUID}/run`,
    });
    expect(res.statusCode).toBe(401);
  });
});
