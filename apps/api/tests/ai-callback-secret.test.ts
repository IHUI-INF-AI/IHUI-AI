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

// Mock config — 显式跑 dual 兼容档:本文件的历史用例以"只带旧密钥"为夹具,
// 默认 ticket 档下的拒绝行为由 tests/internal-secret-auth.test.ts 覆盖。
vi.mock('../src/config/index.js', () => ({
  config: {
    AI_SERVICE_URL: 'http://localhost:8803',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
    AI_CALLBACK_SECRET: 'shared-secret-xyz',
    INTERNAL_SECRET_AUTH_MODE: 'dual',
  },
}))

import aiCallbackRoutes from '../src/routes/ai-callback'
import {
  INTERNAL_TICKET_HEADER,
  mintInternalServiceTicket,
} from '../src/plugins/internal-service-ticket'
import type { Queue } from 'bullmq'
import type { AICallbackJobData } from '../src/plugins/queue.js'

/**
 * AI 回调内网凭据校验测试(2026-11-06 票据化)。
 *
 * - 旧共享密钥:dual 档放行 / 错误拒绝(兼容窗口)
 * - 短期票:正确 scope+主体放行;错主体拒绝;重放拒绝
 */
describe('AI callback 内网凭据校验', () => {
  const server = Fastify({ logger: false })
  const mockAdd = vi.fn().mockResolvedValue({ id: 'job-1' })
  const seenJti = new Set<string>()
  ;(server as unknown as { decorate(name: string, value: unknown): void }).decorate('redis', {
    set: vi.fn(async (key: string) => {
      if (seenJti.has(key)) return null
      seenJti.add(key)
      return 'OK'
    }),
  })

  afterAll(async () => {
    await server.close()
  })

  it('缺少内部凭据返回 401', async () => {
    // 装饰器声明面要求 Queue<AICallbackJobData>;本测试只用 add,故以最小桩顶替真队列
    server.decorate('aiCallbackQueue', { add: mockAdd } as unknown as Queue<AICallbackJobData>)
    await server.register(aiCallbackRoutes)
    await server.ready()

    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      payload: {
        content: 'AI 回复',
        metadata: { conversationId: 'conv-1', userId: 'user-1' },
      },
    })
    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.code).toBe(401)
  })

  it('X-Internal-Secret 错误返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'wrong-secret' },
      payload: {
        content: 'AI 回复',
        metadata: { conversationId: 'conv-1', userId: 'user-1' },
      },
    })
    expect(res.statusCode).toBe(401)
  })

  it('dual 档:旧密钥正确正常入队返回 202', async () => {
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
    })
    expect(res.statusCode).toBe(202)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.queued).toBe(true)
    expect(mockAdd).toHaveBeenCalled()
  })

  it('短期票正确(scope=ai-callback + 主体一致)正常入队返回 202', async () => {
    mockAdd.mockClear()
    const ticket = await mintInternalServiceTicket({ userId: 'user-1', scope: 'ai-callback' })
    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { [INTERNAL_TICKET_HEADER]: ticket },
      payload: {
        content: 'AI 回复',
        model: 'stepfun/step-3.7-flash',
        usage: { total_tokens: 50 },
        metadata: { conversationId: 'conv-1', userId: 'user-1', messageId: 'msg-1' },
      },
    })
    expect(res.statusCode).toBe(202)
    expect(res.json().data.queued).toBe(true)
    expect(mockAdd).toHaveBeenCalled()
  })

  it('票主体与回调 userId 不一致 ⇒ 401(防跨用户投毒)', async () => {
    const ticket = await mintInternalServiceTicket({ userId: 'user-2', scope: 'ai-callback' })
    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { [INTERNAL_TICKET_HEADER]: ticket },
      payload: {
        content: 'AI 回复',
        metadata: { conversationId: 'conv-1', userId: 'user-1' },
      },
    })
    expect(res.statusCode).toBe(401)
  })

  it('同一张票重放 ⇒ 401', async () => {
    const ticket = await mintInternalServiceTicket({ userId: 'user-1', scope: 'ai-callback' })
    const first = await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { [INTERNAL_TICKET_HEADER]: ticket },
      payload: {
        content: 'AI 回复',
        metadata: { conversationId: 'conv-1', userId: 'user-1' },
      },
    })
    expect(first.statusCode).toBe(202)
    const second = await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { [INTERNAL_TICKET_HEADER]: ticket },
      payload: {
        content: 'AI 回复',
        metadata: { conversationId: 'conv-1', userId: 'user-1' },
      },
    })
    expect(second.statusCode).toBe(401)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
