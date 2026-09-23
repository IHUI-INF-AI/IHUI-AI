// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

// Mock chat-queries(避免真实 DB)
vi.mock('../src/db/chat-queries.js', () => ({
  createMessage: vi.fn().mockResolvedValue({ id: 'msg-1', content: 'test' }),
  updateMessage: vi.fn().mockResolvedValue(undefined),
}))

// Mock config
vi.mock('../src/config/index.js', () => ({
  config: {
    AI_SERVICE_URL: 'http://localhost:8803',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
    AI_CALLBACK_SECRET: 'test-secret',
  },
}))

import aiCallbackRoutes from '../src/routes/ai-callback'

describe('AI callback route', () => {
  const server = Fastify({ logger: false })

  afterAll(async () => {
    await server.close()
  })

  it('POST /api/ai/callback schema 校验失败返回 400', async () => {
    await server.register(aiCallbackRoutes)
    await server.ready()

    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {/* 缺 content */},
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.code).toBe(400)
  })

  it('POST /api/ai/callback 缺 conversationId/userId 返回 202 + warning', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {
        content: 'AI 回复内容',
        model: 'stepfun/step-3.7-flash',
        usage: { total_tokens: 100 },
        metadata: {/* 缺 conversationId/userId */},
      },
    })
    expect(res.statusCode).toBe(202)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.accepted).toBe(true)
    expect(body.data.warning).toContain('missing')
  })

  it('POST /api/ai/callback 队列可用时入队返回 202 + queued:true', async () => {
    const serverWithQueue = Fastify({ logger: false })
    const mockAdd = vi.fn().mockResolvedValue({ id: 'job-1' })
    serverWithQueue.decorate('aiCallbackQueue', { add: mockAdd })
    await serverWithQueue.register(aiCallbackRoutes)
    await serverWithQueue.ready()

    const res = await serverWithQueue.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
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
    })
    expect(res.statusCode).toBe(202)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.accepted).toBe(true)
    expect(body.data.queued).toBe(true)
    // 验证入队参数(源码可能扩展字段,用 objectContaining 容忍新字段)
    expect(mockAdd).toHaveBeenCalledWith(
      'complete',
      expect.objectContaining({
        conversationId: 'conv-1',
        userId: 'user-1',
        messageId: 'msg-1',
        content: 'AI 回复',
        tokens: 50,
        metadata: { model: 'stepfun/step-3.7-flash', usage: { total_tokens: 50 }, stub: false },
      }),
    )

    await serverWithQueue.close()
  })

  it('POST /api/ai/callback 队列不可用时降级返回 202 + queued:false', async () => {
    const serverNoQueue = Fastify({ logger: false })
    // 不 decorate aiCallbackQueue
    await serverNoQueue.register(aiCallbackRoutes)
    await serverNoQueue.ready()

    const res = await serverNoQueue.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {
        content: 'AI 回复',
        metadata: {
          conversationId: 'conv-1',
          userId: 'user-1',
        },
      },
    })
    expect(res.statusCode).toBe(202)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.accepted).toBe(true)
    expect(body.data.queued).toBe(false)
    expect(body.data.warning).toContain('queue unavailable')

    await serverNoQueue.close()
  })

  it('POST /api/ai/callback 入队异常返回 502', async () => {
    const serverQueueErr = Fastify({ logger: false })
    serverQueueErr.decorate('aiCallbackQueue', {
      add: vi.fn().mockRejectedValue(new Error('Redis connection refused')),
    })
    await serverQueueErr.register(aiCallbackRoutes)
    await serverQueueErr.ready()

    const res = await serverQueueErr.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {
        content: 'AI 回复',
        metadata: {
          conversationId: 'conv-1',
          userId: 'user-1',
        },
      },
    })
    expect(res.statusCode).toBe(502)
    const body = res.json()
    expect(body.code).toBe(502)

    await serverQueueErr.close()
  })

  it('POST /api/ai/callback messageId 缺失时传空字符串', async () => {
    const serverWithQueue2 = Fastify({ logger: false })
    const mockAdd2 = vi.fn().mockResolvedValue({ id: 'job-2' })
    serverWithQueue2.decorate('aiCallbackQueue', { add: mockAdd2 })
    await serverWithQueue2.register(aiCallbackRoutes)
    await serverWithQueue2.ready()

    const res = await serverWithQueue2.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {
        content: 'AI 回复',
        metadata: {
          conversationId: 'conv-1',
          userId: 'user-1',
          // 无 messageId
        },
      },
    })
    expect(res.statusCode).toBe(202)
    expect(mockAdd2).toHaveBeenCalledWith(
      'complete',
      expect.objectContaining({
        messageId: '',
      }),
    )

    await serverWithQueue2.close()
  })

  // ---------------------------------------------------------------------------
  // D24(2026-09-19 立):工具调用与终端输出独立持久化 —— toolCalls/terminalTasks
  // 经 looseObject 校验后并入入队 metadata,worker 浅合并落库到 chat_messages.metadata
  // ---------------------------------------------------------------------------

  it('POST /api/ai/callback 带 toolCalls/terminalTasks 时并入入队 metadata', async () => {
    const serverD24 = Fastify({ logger: false })
    const mockAddD24 = vi.fn().mockResolvedValue({ id: 'job-d24' })
    serverD24.decorate('aiCallbackQueue', { add: mockAddD24 })
    await serverD24.register(aiCallbackRoutes)
    await serverD24.ready()

    const toolCalls = [
      {
        id: 'tc-1',
        toolName: 'run_command',
        status: 'success',
        args: { command: 'ls' },
        result: 'a.txt',
        iteration: 1,
        durationMs: 123,
      },
    ]
    const terminalTasks = [
      { id: 't-1', command: 'ls', status: 'completed', output: 'a.txt', exitCode: 0 },
    ]
    const res = await serverD24.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {
        content: 'AI 回复',
        model: 'stepfun/step-3.7-flash',
        usage: { total_tokens: 50 },
        stub: false,
        toolCalls,
        terminalTasks,
        metadata: { conversationId: 'conv-1', userId: 'user-1', messageId: 'msg-1' },
      },
    })
    expect(res.statusCode).toBe(202)
    expect(mockAddD24).toHaveBeenCalledWith(
      'complete',
      expect.objectContaining({
        metadata: {
          model: 'stepfun/step-3.7-flash',
          usage: { total_tokens: 50 },
          stub: false,
          toolCalls,
          terminalTasks,
        },
      }),
    )

    await serverD24.close()
  })

  it('POST /api/ai/callback toolCalls/terminalTasks 为空数组时不写入 metadata', async () => {
    const serverD24Empty = Fastify({ logger: false })
    const mockAddEmpty = vi.fn().mockResolvedValue({ id: 'job-d24-empty' })
    serverD24Empty.decorate('aiCallbackQueue', { add: mockAddEmpty })
    await serverD24Empty.register(aiCallbackRoutes)
    await serverD24Empty.ready()

    const res = await serverD24Empty.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {
        content: 'AI 回复',
        toolCalls: [],
        terminalTasks: [],
        metadata: { conversationId: 'conv-1', userId: 'user-1' },
      },
    })
    expect(res.statusCode).toBe(202)
    const jobData = mockAddEmpty.mock.calls[0][1] as { metadata: Record<string, unknown> }
    expect(jobData.metadata).not.toHaveProperty('toolCalls')
    expect(jobData.metadata).not.toHaveProperty('terminalTasks')

    await serverD24Empty.close()
  })

  it('POST /api/ai/callback toolCalls 元素缺必填 id 时返回 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {
        content: 'AI 回复',
        toolCalls: [{ toolName: 'run_command' /* 缺 id */ }],
        metadata: { conversationId: 'conv-1', userId: 'user-1' },
      },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.code).toBe(400)
  })

  // ---------------------------------------------------------------------------
  // D33(2026-09-23 立,2026-09-24 接线):usageDetail / fallback / memoryUpdates
  // 三通道此前仅校验不落库(断链:llm.py 发送端与 web 读回端均在,中间被丢弃);
  // steerApplied 为 D33 剩余类新通道(中途引导注入记录)。四通道并入入队 metadata,
  // worker 浅合并落库,web 读回侧(readUsageDetailFromMetadata 等)消费。
  // ---------------------------------------------------------------------------

  it('POST /api/ai/callback 带 D33 四通道时并入入队 metadata', async () => {
    const serverD33 = Fastify({ logger: false })
    const mockAddD33 = vi.fn().mockResolvedValue({ id: 'job-d33' })
    serverD33.decorate('aiCallbackQueue', { add: mockAddD33 })
    await serverD33.register(aiCallbackRoutes)
    await serverD33.ready()

    const usageDetail = {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      reasoningTokens: null,
      firstTokenMs: 320,
      durationMs: 1800,
      model: 'stepfun/step-3.7-flash',
      costUsd: null,
    }
    const fallback = { primary_model: 'm-a', backup_model: 'm-b', reason: 'rate_limit' }
    const memoryUpdates = ['用户偏好深色主题', '项目用 pnpm workspace']
    const steerApplied = [
      { text: '先跑测试再改', timestamp: '2026-09-24T10:00:00Z' },
      { text: '聚焦 o21 文件' },
    ]
    const res = await serverD33.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {
        content: 'AI 回复',
        usageDetail,
        fallback,
        memoryUpdates,
        steerApplied,
        metadata: { conversationId: 'conv-1', userId: 'user-1', messageId: 'msg-1' },
      },
    })
    expect(res.statusCode).toBe(202)
    const jobData = mockAddD33.mock.calls[0][1] as { metadata: Record<string, unknown> }
    expect(jobData.metadata).toMatchObject({
      usageDetail,
      fallback,
      memoryUpdates,
      steerApplied,
    })

    await serverD33.close()
  })

  it('POST /api/ai/callback D33 四通道缺省/空数组时不写入 metadata', async () => {
    const serverD33Empty = Fastify({ logger: false })
    const mockAddD33Empty = vi.fn().mockResolvedValue({ id: 'job-d33-empty' })
    serverD33Empty.decorate('aiCallbackQueue', { add: mockAddD33Empty })
    await serverD33Empty.register(aiCallbackRoutes)
    await serverD33Empty.ready()

    const res = await serverD33Empty.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {
        content: 'AI 回复',
        memoryUpdates: [],
        steerApplied: [],
        metadata: { conversationId: 'conv-1', userId: 'user-1' },
      },
    })
    expect(res.statusCode).toBe(202)
    const jobData = mockAddD33Empty.mock.calls[0][1] as { metadata: Record<string, unknown> }
    expect(jobData.metadata).not.toHaveProperty('usageDetail')
    expect(jobData.metadata).not.toHaveProperty('fallback')
    expect(jobData.metadata).not.toHaveProperty('memoryUpdates')
    expect(jobData.metadata).not.toHaveProperty('steerApplied')

    await serverD33Empty.close()
  })

  it('POST /api/ai/callback steerApplied 元素缺必填 text 时返回 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {
        content: 'AI 回复',
        steerApplied: [{ timestamp: '2026-09-24T10:00:00Z' /* 缺 text */ }],
        metadata: { conversationId: 'conv-1', userId: 'user-1' },
      },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.code).toBe(400)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
