import { describe, it, expect, afterAll, vi } from 'vitest';
import Fastify from 'fastify';

// Mock chat-queries(避免真实 DB)
vi.mock('../src/db/chat-queries.js', () => ({
  createMessage: vi.fn().mockResolvedValue({ id: 'msg-1', content: 'test' }),
  updateMessage: vi.fn().mockResolvedValue(undefined),
}));

// Mock config — 配置了 AI_CALLBACK_SECRET(启用共享密钥校验)
vi.mock('../src/config/index.js', () => ({
  config: {
    AI_SERVICE_URL: 'http://localhost:8000',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
    AI_CALLBACK_SECRET: 'shared-secret-xyz',
  },
}));

import aiCallbackRoutes from '../src/routes/ai-callback';

/**
 * AI 回调共享密钥校验测试。
 *
 * 验证配置 AI_CALLBACK_SECRET 后:
 * - 缺少 X-Internal-Secret 头 → 401
 * - X-Internal-Secret 错误 → 401
 * - X-Internal-Secret 正确 → 正常处理(202)
 */
describe('AI callback 共享密钥校验', () => {
  const server = Fastify({ logger: false });
  const mockAdd = vi.fn().mockResolvedValue({ id: 'job-1' });

  afterAll(async () => {
    await server.close();
  });

  it('缺少 X-Internal-Secret 头返回 401', async () => {
    server.decorate('aiCallbackQueue', { add: mockAdd });
    await server.register(aiCallbackRoutes);
    await server.ready();

    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      payload: {
        content: 'AI 回复',
        metadata: { conversationId: 'conv-1', userId: 'user-1' },
      },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe(401);
  });

  it('X-Internal-Secret 错误返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'wrong-secret' },
      payload: {
        content: 'AI 回复',
        metadata: { conversationId: 'conv-1', userId: 'user-1' },
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('X-Internal-Secret 正确时正常入队返回 202', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'shared-secret-xyz' },
      payload: {
        content: 'AI 回复',
        model: 'stepfun/step-3.7-flash',
        usage: { total_tokens: 50 },
        metadata: { conversationId: 'conv-1', userId: 'user-1', messageId: 'msg-1' },
      },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.code).toBe(0);
    expect(body.data.queued).toBe(true);
    expect(mockAdd).toHaveBeenCalled();
  });
});
