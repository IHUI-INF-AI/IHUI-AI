// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-191 回归锁(2026-11-08,apps/api P1 越权组)。
 *
 * 缺陷:/v1 的 embeddings、chat/vision、chat/moa、agents/execute 用平台系统 token
 * 直连 ai-service,只受配额限流,完全不归账 ⇒ 平台替调用者付费。
 * 判据:每个端点的上游用量都要落到 recordCall(apiKeyId/userId/model/tokens)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const KEY_ID = 'key-00000000-0000-4000-8000-000000000001'
const USER_ID = '00000000-0000-4000-8000-0000000000aa'

vi.mock('../src/plugins/api-key-auth.js', () => ({
  requireApiKeyAuth: async (request: { apiKey?: unknown }) => {
    request.apiKey = { id: KEY_ID, userId: USER_ID }
  },
  requireApiKeyQuota: () => async () => undefined,
}))
vi.mock('../src/utils/capability-guard.js', () => ({
  requireCapability: () => async () => undefined,
}))
vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {}, dbScoped: {}, dbReadScoped: {} }))

const spies = vi.hoisted(() => ({
  recordCall: vi.fn(async () => ({
    logId: 'log-1',
    costCents: 1,
    newTokenBalance: 0,
    newCostBalanceCents: 0,
  })),
  fetch: vi.fn(),
}))

vi.mock('../src/services/relay-billing-service.js', () => ({
  recordCall: spies.recordCall,
  modelToProviderCode: vi.fn(() => 'openai'),
}))
vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch: spies.fetch,
}))

import v1Routes from '../src/routes/v1-ai-core.js'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('F-191 系统 token AI 端点按 usage 归账', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(v1Routes, { prefix: '/v1' })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })
  beforeEach(() => {
    spies.recordCall.mockClear()
    spies.fetch.mockReset()
  })

  it('embeddings 归账 prompt/total tokens', async () => {
    spies.fetch.mockResolvedValue(
      jsonResponse({
        data: [{ embedding: [0.1, 0.2] }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 7, total_tokens: 7 },
      }),
    )
    const res = await server.inject({
      method: 'POST',
      url: '/v1/embeddings',
      body: { model: 'text-embedding-3-small', input: 'hello' },
    })
    expect(res.statusCode).toBe(200)
    await vi.waitFor(() => expect(spies.recordCall).toHaveBeenCalledTimes(1))
    expect(spies.recordCall).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKeyId: KEY_ID,
        userId: USER_ID,
        model: 'text-embedding-3-small',
        promptTokens: 7,
        totalTokens: 7,
        metadata: expect.objectContaining({ endpoint: 'embeddings' }),
      }),
    )
  })

  it('chat/vision 归账 prompt/completion/total tokens', async () => {
    spies.fetch.mockResolvedValue(
      jsonResponse({
        description: '一张猫的图片',
        model: 'gpt-4o',
        usage: { prompt_tokens: 11, completion_tokens: 5, total_tokens: 16 },
      }),
    )
    const res = await server.inject({
      method: 'POST',
      url: '/v1/chat/vision',
      body: { model: 'gpt-4o', image: 'http://x/y.png', prompt: '描述图片' },
    })
    expect(res.statusCode).toBe(200)
    await vi.waitFor(() => expect(spies.recordCall).toHaveBeenCalledTimes(1))
    expect(spies.recordCall).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKeyId: KEY_ID,
        userId: USER_ID,
        model: 'gpt-4o',
        promptTokens: 11,
        completionTokens: 5,
        totalTokens: 16,
        metadata: expect.objectContaining({ endpoint: 'chat/vision' }),
      }),
    )
  })

  it('chat/moa 归账 total tokens', async () => {
    spies.fetch.mockResolvedValue(
      jsonResponse({
        output: 'moa answer',
        model: 'moa-default',
        usage: { total_tokens: 12 },
      }),
    )
    const res = await server.inject({
      method: 'POST',
      url: '/v1/chat/moa',
      body: { messages: [{ role: 'user', content: 'hi' }] },
    })
    expect(res.statusCode).toBe(200)
    await vi.waitFor(() => expect(spies.recordCall).toHaveBeenCalledTimes(1))
    expect(spies.recordCall).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKeyId: KEY_ID,
        userId: USER_ID,
        totalTokens: 12,
        metadata: expect.objectContaining({ endpoint: 'chat/moa' }),
      }),
    )
  })

  it('agents/execute 归账 total tokens', async () => {
    spies.fetch.mockResolvedValue(
      jsonResponse({
        task_id: 'task-1',
        status: 'completed',
        output: 'done',
        iterations: 1,
        usage: { total_tokens: 33 },
      }),
    )
    const res = await server.inject({
      method: 'POST',
      url: '/v1/agents/execute',
      body: { agentId: 'agent-1', input: 'do it' },
    })
    expect(res.statusCode).toBe(200)
    await vi.waitFor(() => expect(spies.recordCall).toHaveBeenCalledTimes(1))
    expect(spies.recordCall).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKeyId: KEY_ID,
        userId: USER_ID,
        totalTokens: 33,
        metadata: expect.objectContaining({ endpoint: 'agents/execute' }),
      }),
    )
  })
})
