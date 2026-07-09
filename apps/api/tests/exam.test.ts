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

// Mock exam-queries 以隔离数据库依赖（公开端点鉴权失败不会触发查询，但 import 时会创建 db 连接）
vi.mock('../src/db/exam-queries.js', () => ({
  findPublishedPapers: vi.fn(),
  findAllPapers: vi.fn(),
  findPaperById: vi.fn(),
  findQuestionsByPaperId: vi.fn(),
  findQuestionById: vi.fn(),
  findMyExamRecords: vi.fn(),
  findExamRecordById: vi.fn(),
  createExamRecord: vi.fn(),
  submitExamRecord: vi.fn(),
  createPaper: vi.fn(),
  updatePaper: vi.fn(),
  deletePaper: vi.fn(),
  createQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
}));

import { examRoutes } from '../src/routes/exam';

const SAMPLE_UUID = '00000000-0000-0000-0000-000000000001';

describe('exam routes', () => {
  const server = Fastify({ logger: false });

  beforeAll(async () => {
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
    await server.register(examRoutes, { prefix: '/api' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // ----- 公共端点（需登录，未登录返回 401） -----

  it('GET /api/exam/papers 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/exam/papers' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/exam/papers/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/exam/papers/${SAMPLE_UUID}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/exam/records 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/exam/records' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/exam/papers/:id/start 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/exam/papers/${SAMPLE_UUID}/start`,
    });
    expect(res.statusCode).toBe(401);
  });

  // ----- Admin 端点（需管理员权限，未登录返回 401） -----

  it('GET /api/admin/exam/papers 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/exam/papers' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/exam/papers 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/exam/papers',
      body: { title: '测试试卷' },
    });
    expect(res.statusCode).toBe(401);
  });
});
