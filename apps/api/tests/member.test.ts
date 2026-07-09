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

// Mock member-queries 以隔离数据库依赖（含 MemberConflictError 类）
vi.mock('../src/db/member-queries.js', () => {
  class MemberConflictError extends Error {
    statusCode = 409;
    constructor(message: string) {
      super(message);
      this.name = 'MemberConflictError';
    }
  }
  return {
    findMembers: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    findUnauditedMembers: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    findMemberById: vi.fn(),
    findMembersByIds: vi.fn().mockResolvedValue([]),
    findAuthMembers: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    createMember: vi.fn(),
    updateMember: vi.fn(),
    setMemberStatus: vi.fn(),
    resetMemberPassword: vi.fn(),
    deleteMember: vi.fn(),
    registerMember: vi.fn(),
    registerMemberByMobile: vi.fn(),
    findMemberCompanies: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    findMemberLevels: vi.fn().mockResolvedValue([]),
    findMemberLevelById: vi.fn(),
    createMemberLevel: vi.fn(),
    updateMemberLevel: vi.fn(),
    deleteMemberLevel: vi.fn(),
    getMemberStatistics: vi.fn().mockResolvedValue({ total: 0, active: 0, pending: 0, sealed: 0 }),
    hashPassword: vi.fn((p: string) => `hashed-${p}`),
    MemberConflictError,
  };
});

import { memberRoutes, adminMemberRoutes } from '../src/routes/member';

const DUMMY_UUID = '00000000-0000-0000-0000-000000000001';

describe('member routes', () => {
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
    await server.register(memberRoutes, { prefix: '/api' });
    await server.register(adminMemberRoutes, { prefix: '/api/admin' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // ----- 公开注册端点（无需登录） -----

  it('POST /api/members/register 缺少字段返回 400', async () => {
    const res = await server.inject({ method: 'POST', url: '/api/members/register', body: {} });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/members/register 合法参数可调用（不返回 401）', async () => {
    const { registerMember } = await import('../src/db/member-queries.js');
    (registerMember as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: DUMMY_UUID,
      username: 'tester',
    });
    const res = await server.inject({
      method: 'POST',
      url: '/api/members/register',
      body: { username: 'tester', password: '123456' },
    });
    expect(res.statusCode).not.toBe(401);
    expect(res.statusCode).toBe(201);
  });

  // ----- 需登录端点（未登录返回 401） -----

  it('GET /api/members/by-id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/members/by-id?id=${DUMMY_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/members/by-ids 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/members/by-ids?ids=1' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/members/auth-list 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/members/auth-list' });
    expect(res.statusCode).toBe(401);
  });

  // ----- admin 端点（需管理员，未登录返回 401） -----

  it('GET /api/admin/members 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/members' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/members 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/members',
      body: { username: 'admin_test', password: '123456' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/members/levels 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/members/levels' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/members/statistics 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/members/statistics' });
    expect(res.statusCode).toBe(401);
  });
});
