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

// Mock setting-queries 以隔离数据库依赖
vi.mock('../src/db/setting-queries.js', () => ({
  findPublicEduSettings: vi.fn().mockResolvedValue([]),
  findEduSettings: vi.fn().mockResolvedValue({ list: [], total: 0 }),
  findEduSettingById: vi.fn(),
  findEduSettingByGroupKey: vi.fn(),
  findEduSettingsByGroup: vi.fn().mockResolvedValue([]),
  createEduSetting: vi.fn(),
  updateEduSetting: vi.fn(),
  deleteEduSetting: vi.fn(),
}));

import { settingRoutes, adminSettingRoutes } from '../src/routes/setting';

const DUMMY_UUID = '00000000-0000-0000-0000-000000000001';

describe('setting routes', () => {
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
    await server.register(settingRoutes, { prefix: '/api' });
    await server.register(adminSettingRoutes, { prefix: '/api/admin' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // 公开端点(公开配置 + 按 group 查询)无需鉴权

  it('GET /api/settings 公开端点返回 200 与空列表', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/settings' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.code).toBe(0);
    expect(body.data.list).toEqual([]);
  });

  it('GET /api/settings/site 按 group 查询返回 200', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/settings/site' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.code).toBe(0);
    expect(body.data.list).toEqual([]);
  });

  // admin 端点需管理员,未登录返回 401

  it('GET /api/admin/edu-settings 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/edu-settings' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/edu-settings/:id 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/admin/edu-settings/${DUMMY_UUID}` });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/edu-settings 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/edu-settings',
      body: { group: 'site', key: 'site_name' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('PATCH /api/admin/edu-settings/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/admin/edu-settings/${DUMMY_UUID}`,
      body: { value: 'IHUI' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/admin/edu-settings/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/admin/edu-settings/${DUMMY_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });
});
