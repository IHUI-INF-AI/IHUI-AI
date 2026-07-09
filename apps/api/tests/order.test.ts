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

// Mock order-queries 以隔离数据库依赖
vi.mock('../src/db/order-queries.js', () => ({
  genOrderNo: vi.fn().mockReturnValue('EDU20260708000000AAAAAA'),
  genPaymentNo: vi.fn().mockReturnValue('PAY20260708000000AAAAAA'),
  createOrder: vi.fn(),
  findOrderById: vi.fn(),
  cancelOrder: vi.fn(),
  findOrders: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  createPayment: vi.fn(),
  findPaymentById: vi.fn(),
  cancelPayment: vi.fn(),
  findPayments: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  applyRefund: vi.fn(),
  findRefundById: vi.fn(),
  processRefund: vi.fn(),
  handleRefund: vi.fn(),
  findRefunds: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findInvoiceTitles: vi.fn().mockResolvedValue([]),
  createInvoiceTitle: vi.fn(),
  updateInvoiceTitle: vi.fn(),
  deleteInvoiceTitle: vi.fn().mockResolvedValue(undefined),
  createInvoiceApplication: vi.fn(),
  updateInvoiceApplication: vi.fn(),
  findInvoiceApplicationById: vi.fn(),
  deleteInvoiceApplication: vi.fn().mockResolvedValue(undefined),
  findInvoiceApplications: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
}));

import { orderRoutes, adminOrderRoutes } from '../src/routes/order';

const DUMMY_UUID = '00000000-0000-0000-0000-000000000001';

describe('order routes', () => {
  const server = Fastify({ logger: false });

  beforeAll(async () => {
    // 与 server.ts 保持一致的错误处理器：将验证错误格式化为 { code, message }
    server.setErrorHandler((err, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600
          ? err.statusCode
          : 500;
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : err.message,
      });
    });
    await server.register(orderRoutes, { prefix: '/api' });
    await server.register(adminOrderRoutes, { prefix: '/api/admin' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  // ----- 用户端点（需登录，未登录返回 401） -----

  it('GET /api/orders/me 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/orders/me' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/orders/:id 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/orders/${DUMMY_UUID}` });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/orders 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/orders',
      body: { orderType: 'course' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/orders/:id/cancel 未登录返回 401', async () => {
    const res = await server.inject({ method: 'POST', url: `/api/orders/${DUMMY_UUID}/cancel` });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/orders/:id/refund 未登录返回 401', async () => {
    const res = await server.inject({ method: 'POST', url: `/api/orders/${DUMMY_UUID}/refund`, body: {} });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/payments/me 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/payments/me' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/refunds/me 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/refunds/me' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/invoices/titles 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/invoices/titles' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/invoices/applications 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/invoices/applications' });
    expect(res.statusCode).toBe(401);
  });

  // ----- admin 端点（需管理员，未登录返回 401） -----

  it('GET /api/admin/orders 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/orders' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/refunds 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/refunds' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/invoices/applications 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/invoices/applications' });
    expect(res.statusCode).toBe(401);
  });
});
