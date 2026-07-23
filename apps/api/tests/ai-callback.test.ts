import { describe, it, expect, afterAll, vi } from 'vitest';
import Fastify from 'fastify';

// Mock chat-queries(避免真实 DB)
vi.mock('../src/db/chat-queries.js', () => ({
  createMessage: vi.fn().mockResolvedValue({ id: 'msg-1', content: 'test' }),
  updateMessage: vi.fn().mockResolvedValue(undefined),
}));

// Mock config
vi.mock('../src/config/index.js', () => ({
  config: {
    AI_SERVICE_URL: 'http://localhost:8000',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
  },
}));

import aiCallbackRoutes from '../src/routes/ai-callback';

describe('AI callback route', () => {
  const server = Fastify({ logger: false });

  afterAll(async () => {
    await server.close();
  });

  it('POST /api/ai/callback schema 校验失败返回 400', async () => {
    await server.register(aiCallbackRoutes);
    await server.ready();

    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      payload: { /* 缺 content */ },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe(400);
  });

  it('POST /api/ai/callback 缺 conversationId/userId 返回 202 + warning', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      payload: {
        content: 'AI 回复内容',
        model: 'stepfun/step-3.7-flash',
        usage: { total_tokens: 100 },
        metadata: { /* 缺 conversationId/userId */ },
      },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.code).toBe(0);
    expect(body.data.accepted).toBe(true);
    expect(body.data.warning).toContain('missing');
  });

  it('POST /api/ai/callback 队列可用时入队返回 202 + queued:true', async () => {
    const serverWithQueue = Fastify({ logger: false });
    const mockAdd = vi.fn().mockResolvedValue({ id: 'job-1' });
    serverWithQueue.decorate('aiCallbackQueue', { add: mockAdd });
    await serverWithQueue.register(aiCallbackRoutes);
    await serverWithQueue.ready();

    const res = await serverWithQueue.inject({
      method: 'POST',
      url: '/api/ai/callback',
      payload: {
        content: 'AI 回复',
        model: 'stepfun/step-3.7-flash',
        usage: { total_tokens: 50 },
        stub: false,
        metadata: {
          conversationId: 'conv-1',
          userId: 'user-1',
          messageId: 'msg-1',
        },
      },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.code).toBe(0);
    expect(body.data.accepted).toBe(true);
    expect(body.data.queued).toBe(true);
    // 验证入队参数(源码可能扩展字段,用 objectContaining 容忍新字段)
    expect(mockAdd).toHaveBeenCalledWith('complete', expect.objectContaining({
      conversationId: 'conv-1',
      userId: 'user-1',
      messageId: 'msg-1',
      content: 'AI 回复',
      tokens: 50,
      metadata: { model: 'stepfun/step-3.7-flash', usage: { total_tokens: 50 }, stub: false },
    }));

    await serverWithQueue.close();
  });

  it('POST /api/ai/callback 队列不可用时降级返回 202 + queued:false', async () => {
    const serverNoQueue = Fastify({ logger: false });
    // 不 decorate aiCallbackQueue
    await serverNoQueue.register(aiCallbackRoutes);
    await serverNoQueue.ready();

    const res = await serverNoQueue.inject({
      method: 'POST',
      url: '/api/ai/callback',
      payload: {
        content: 'AI 回复',
        metadata: {
          conversationId: 'conv-1',
          userId: 'user-1',
        },
      },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.code).toBe(0);
    expect(body.data.accepted).toBe(true);
    expect(body.data.queued).toBe(false);
    expect(body.data.warning).toContain('queue unavailable');

    await serverNoQueue.close();
  });

  it('POST /api/ai/callback 入队异常返回 502', async () => {
    const serverQueueErr = Fastify({ logger: false });
    serverQueueErr.decorate('aiCallbackQueue', {
      add: vi.fn().mockRejectedValue(new Error('Redis connection refused')),
    });
    await serverQueueErr.register(aiCallbackRoutes);
    await serverQueueErr.ready();

    const res = await serverQueueErr.inject({
      method: 'POST',
      url: '/api/ai/callback',
      payload: {
        content: 'AI 回复',
        metadata: {
          conversationId: 'conv-1',
          userId: 'user-1',
        },
      },
    });
    expect(res.statusCode).toBe(502);
    const body = res.json();
    expect(body.code).toBe(502);

    await serverQueueErr.close();
  });

  it('POST /api/ai/callback messageId 缺失时传空字符串', async () => {
    const serverWithQueue2 = Fastify({ logger: false });
    const mockAdd2 = vi.fn().mockResolvedValue({ id: 'job-2' });
    serverWithQueue2.decorate('aiCallbackQueue', { add: mockAdd2 });
    await serverWithQueue2.register(aiCallbackRoutes);
    await serverWithQueue2.ready();

    const res = await serverWithQueue2.inject({
      method: 'POST',
      url: '/api/ai/callback',
      payload: {
        content: 'AI 回复',
        metadata: {
          conversationId: 'conv-1',
          userId: 'user-1',
          // 无 messageId
        },
      },
    });
    expect(res.statusCode).toBe(202);
    expect(mockAdd2).toHaveBeenCalledWith('complete', expect.objectContaining({
      messageId: '',
    }));

    await serverWithQueue2.close();
  });
});
