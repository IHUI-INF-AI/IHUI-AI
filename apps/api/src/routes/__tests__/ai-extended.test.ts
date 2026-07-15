import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../../db/index.js', () => {
  interface DbChain {
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
    from: () => DbChain
    where: () => DbChain
    orderBy: () => DbChain
    limit: () => DbChain
    offset: () => DbChain
    values: () => DbChain
    set: () => DbChain
    returning: () => DbChain
  }
  function createChain(result: unknown[] = []): DbChain {
    const chain: DbChain = {
      then: (resolve) => Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      values: () => chain,
      set: () => chain,
      returning: () => chain,
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() => createChain()),
      insert: vi.fn(() => createChain()),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
    },
  }
})

import aiExtendedRoutes from '../ai-extended.js'

const originalFetch = global.fetch

describe('AI Extended — POST /developer/model-test/run', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(aiExtendedRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    global.fetch = originalFetch
    delete process.env.AI_SERVICE_URL
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    delete process.env.AI_SERVICE_URL
  })

  it('缺少 modelId 返回 400 参数错误', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/developer/model-test/run',
      payload: { prompt: 'hello' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
  })

  it('未配置 AI_SERVICE_URL 时返回 mock 响应', async () => {
    delete process.env.AI_SERVICE_URL
    const res = await app.inject({
      method: 'POST',
      url: '/api/developer/model-test/run',
      payload: { modelId: 'gpt-4', prompt: '你好' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.result).toBe('success')
    expect(body.data.modelId).toBe('gpt-4')
    expect(body.data.mock).toBe(true)
    expect(body.data.response).toContain('你好')
  })

  it('配置 AI_SERVICE_URL 且 fetch 成功时返回 200 与响应内容', async () => {
    process.env.AI_SERVICE_URL = 'http://mock-ai-service:8000'
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ content: 'LLM 回答内容' }),
    } as unknown as Response)

    const res = await app.inject({
      method: 'POST',
      url: '/api/developer/model-test/run',
      payload: { modelId: 'gpt-4', prompt: '测试', temperature: 0.5 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.result).toBe('success')
    expect(body.data.modelId).toBe('gpt-4')
    expect(body.data.response).toBe('LLM 回答内容')
    expect(body.data.latency).toBeGreaterThanOrEqual(0)
    expect(global.fetch).toHaveBeenCalledWith(
      'http://mock-ai-service:8000/llm/complete',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })

  it('配置 AI_SERVICE_URL 但 fetch 返回非 ok 时返回 502', async () => {
    process.env.AI_SERVICE_URL = 'http://mock-ai-service:8000'
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'model unavailable' }),
    } as unknown as Response)

    const res = await app.inject({
      method: 'POST',
      url: '/api/developer/model-test/run',
      payload: { modelId: 'gpt-4', prompt: '测试' },
    })
    expect(res.statusCode).toBe(502)
    expect(res.json().message).toContain('500')
  })

  it('配置 AI_SERVICE_URL 但 fetch 抛出异常时返回 502', async () => {
    process.env.AI_SERVICE_URL = 'http://mock-ai-service:8000'
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch

    const res = await app.inject({
      method: 'POST',
      url: '/api/developer/model-test/run',
      payload: { modelId: 'gpt-4', prompt: '测试' },
    })
    expect(res.statusCode).toBe(502)
    expect(res.json().message).toContain('ECONNREFUSED')
  })

  it('temperature 超出 0-2 范围返回 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/developer/model-test/run',
      payload: { modelId: 'gpt-4', prompt: '测试', temperature: 5 },
    })
    expect(res.statusCode).toBe(400)
  })
})
