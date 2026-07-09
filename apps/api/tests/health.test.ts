import { describe, it, expect, afterAll, vi } from 'vitest';
import Fastify from 'fastify';

// =============================================================================
// Mock db:避免真实 DB 连接(health/ready 调用 db.execute)
// =============================================================================
vi.mock('../src/db/index.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

// Mock config:避免 env 验证失败(health.ts 导入 config 用于 AI_SERVICE_URL)
vi.mock('../src/config/index.js', () => ({
  config: {
    AI_SERVICE_URL: 'http://localhost:8000',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
  },
}));

// Mock global fetch(AI service health check)
global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;

import { healthRoutes } from '../src/routes/health';

describe('health route', () => {
  const server = Fastify({ logger: false });

  afterAll(async () => {
    await server.close();
  });

  it('GET /api/health 返回 200 与 status ok', async () => {
    await server.register(healthRoutes, { prefix: '/api' });
    await server.ready();

    const res = await server.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('@ihui/api');
  });

  it('GET /api/health/ready 返回 200 与 status ready', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/health/ready' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ready');
    expect(body.checks.database.status).toBe('ok');
    expect(body.checks.redis.status).toBe('skip');
  });

  it('GET /api/health/live 返回 200 与 status alive', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/health/live' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('alive');
  });

  it('健康检查响应体均包含 status 字段', async () => {
    const urls = ['/api/health', '/api/health/ready', '/api/health/live'];
    for (const url of urls) {
      const res = await server.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveProperty('status');
    }
  });

  it('GET /api/health/metrics 在未注册 metrics 插件时返回 not available', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/health/metrics' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('metrics not available');
  });

  it('GET /api/health/ready 注册 Redis 后返回 ok', async () => {
    // 构造独立 server 注册 mock redis 装饰器
    const serverWithRedis = Fastify({ logger: false });
    serverWithRedis.decorate('redis', {
      ping: vi.fn().mockResolvedValue('PONG'),
    });
    await serverWithRedis.register(healthRoutes, { prefix: '/api' });
    await serverWithRedis.ready();

    const res = await serverWithRedis.inject({ method: 'GET', url: '/api/health/ready' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ready');
    expect(body.checks.database.status).toBe('ok');
    expect(body.checks.redis.status).toBe('ok');
    expect(body.checks.redis.latency).toBeGreaterThanOrEqual(0);

    await serverWithRedis.close();
  });

  it('GET /api/health/ready Redis ping 异常时返回 degraded', async () => {
    const serverWithRedisErr = Fastify({ logger: false });
    serverWithRedisErr.decorate('redis', {
      ping: vi.fn().mockRejectedValue(new Error('connection refused')),
    });
    await serverWithRedisErr.register(healthRoutes, { prefix: '/api' });
    await serverWithRedisErr.ready();

    const res = await serverWithRedisErr.inject({ method: 'GET', url: '/api/health/ready' });
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.status).toBe('degraded');
    expect(body.checks.redis.status).toBe('error');

    await serverWithRedisErr.close();
  });
});
