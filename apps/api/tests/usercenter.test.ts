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

// Mock usercenter-queries 与 queries 以隔离数据库依赖
vi.mock('../src/db/usercenter-queries.js', () => ({
  findUsers: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  deleteUser: vi.fn().mockResolvedValue(undefined),
  updateUserPassword: vi.fn().mockResolvedValue(undefined),
  updateUserStatus: vi.fn().mockResolvedValue(undefined),
  findDepartments: vi.fn().mockResolvedValue([]),
  findDepartmentById: vi.fn(),
  createDepartment: vi.fn(),
  updateDepartment: vi.fn(),
  deleteDepartment: vi.fn().mockResolvedValue(undefined),
  findUserCertificates: vi.fn().mockResolvedValue([]),
  createUserCertificate: vi.fn(),
  deleteUserCertificate: vi.fn().mockResolvedValue(undefined),
  getUserStatistics: vi.fn().mockResolvedValue({ total: 0, active: 0, disabled: 0, deptTotal: 0 }),
}));

vi.mock('../src/db/queries.js', () => ({
  findUserById: vi.fn(),
  findUserByPhone: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserByAccount: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  saveRefreshToken: vi.fn().mockResolvedValue(undefined),
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
}));

import { usercenterRoutes } from '../src/routes/usercenter';

const DUMMY_UUID = '00000000-0000-0000-0000-000000000001';

describe('usercenter routes', () => {
  const server = Fastify({ logger: false });

  beforeAll(async () => {
    // 与 server.ts 保持一致的错误处理器
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
    await server.register(usercenterRoutes, { prefix: '/api/admin' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // 所有 usercenter 端点需管理员鉴权，未登录返回 401

  it('GET /api/admin/usercenter/users 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/usercenter/users' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/usercenter/statistics 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/usercenter/statistics' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/usercenter/departments 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/usercenter/departments' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/usercenter/users 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/usercenter/users',
      body: { phone: '13800000000', password: '123456' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/admin/usercenter/users/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/admin/usercenter/users/${DUMMY_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/usercenter/users/:id/certificates 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/admin/usercenter/users/${DUMMY_UUID}/certificates`,
    });
    expect(res.statusCode).toBe(401);
  });
});
