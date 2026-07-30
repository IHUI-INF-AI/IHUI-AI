/**
 * BYOK API Key 验证端点单元测试。
 * mock 上游 fetch,不真实发请求。覆盖:有效/无效/限流/超时/缺字段/未认证/Anthropic 格式/providers 清单。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8080,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    DATABASE_READ_REPLICA_URL: '',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

const mockAuthenticate = vi.fn()
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  checkAuth: async (
    request: unknown,
    reply: { status: (code: number) => { send: (body: unknown) => void } },
  ) => {
    try {
      await mockAuthenticate(request)
      return true
    } catch {
      reply.status(401).send({ code: 401, message: 'Authentication required' })
      return false
    }
  },
}))

const { llmVerifyKeyRoutes } = await import('../src/routes/llm-verify-key.js')

// mock fetch 响应(测试豁免 any)
function mockFetchResponse(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

describe('llmVerifyKeyRoutes', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(llmVerifyKeyRoutes, { prefix: '/api/llm' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    mockAuthenticate.mockResolvedValue({ userId: 'test-user' })
  })

  it('未认证返回 401', async () => {
    mockAuthenticate.mockRejectedValue(new Error('Authentication required'))
    const res = await server.inject({
      method: 'POST',
      url: '/api/llm/verify-key',
      body: { providerCode: 'openai', apiKey: 'sk-test' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('缺 apiKey 字段返回 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/llm/verify-key',
      body: { providerCode: 'openai' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('缺 providerCode 字段返回 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/llm/verify-key',
      body: { apiKey: 'sk-test' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('Key 有效(上游 200)返回 valid=true + latencyMs', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchResponse(200))
    const res = await server.inject({
      method: 'POST',
      url: '/api/llm/verify-key',
      body: { providerCode: 'openai', apiKey: 'sk-valid' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(0)
    expect(body.data.valid).toBe(true)
    expect(typeof body.data.latencyMs).toBe('number')
    expect(fetchSpy).toHaveBeenCalledOnce()
    // 不回显 apiKey
    expect(res.body).not.toContain('sk-valid')
  })

  it('Key 无效(上游 401)返回 valid=false + 错误提示', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchResponse(401))
    const res = await server.inject({
      method: 'POST',
      url: '/api/llm/verify-key',
      body: { providerCode: 'openai', apiKey: 'sk-bad' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.valid).toBe(false)
    expect(body.data.message).toContain('API Key 无效')
    // 不回显 apiKey
    expect(res.body).not.toContain('sk-bad')
  })

  it('上游 429 限流返回 valid=false + 限流提示', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchResponse(429))
    const res = await server.inject({
      method: 'POST',
      url: '/api/llm/verify-key',
      body: { providerCode: 'groq', apiKey: 'sk-limit' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.valid).toBe(false)
    expect(body.data.message).toContain('频繁')
  })

  it('超时(AbortError)返回 valid=false + 超时提示', async () => {
    const err = new Error('The operation was aborted')
    err.name = 'AbortError'
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(err)
    const res = await server.inject({
      method: 'POST',
      url: '/api/llm/verify-key',
      body: { providerCode: 'openai', apiKey: 'sk-slow' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.valid).toBe(false)
    expect(body.data.message).toContain('超时')
  })

  it('Anthropic 厂商用 x-api-key header + /v1/messages 端点', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchResponse(200))
    await server.inject({
      method: 'POST',
      url: '/api/llm/verify-key',
      body: { providerCode: 'anthropic', apiKey: 'sk-ant-key' },
    })
    const callUrl = fetchSpy.mock.calls[0]?.[0] as string
    const callOpts = fetchSpy.mock.calls[0]?.[1] as { headers: Record<string, string> }
    expect(callUrl).toContain('/v1/messages')
    expect(callOpts.headers['x-api-key']).toBe('sk-ant-key')
    expect(callOpts.headers['anthropic-version']).toBe('2023-06-01')
  })

  it('OpenAI 兼容厂商用 Authorization Bearer + /chat/completions 端点', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchResponse(200))
    await server.inject({
      method: 'POST',
      url: '/api/llm/verify-key',
      body: { providerCode: 'deepseek', apiKey: 'sk-ds' },
    })
    const callUrl = fetchSpy.mock.calls[0]?.[0] as string
    const callOpts = fetchSpy.mock.calls[0]?.[1] as { headers: Record<string, string> }
    expect(callUrl).toContain('/chat/completions')
    expect(callOpts.headers.authorization).toBe('Bearer sk-ds')
  })

  it('自定义 apiBase 覆盖默认 baseUrl', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchResponse(200))
    await server.inject({
      method: 'POST',
      url: '/api/llm/verify-key',
      body: { providerCode: 'openai', apiKey: 'sk-x', apiBase: 'https://my-proxy.example.com/v1' },
    })
    const callUrl = fetchSpy.mock.calls[0]?.[0] as string
    expect(callUrl).toBe('https://my-proxy.example.com/v1/chat/completions')
  })

  it('不支持的厂商返回 valid=false + 提示', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/llm/verify-key',
      body: { providerCode: 'unknown-vendor', apiKey: 'sk-x' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.valid).toBe(false)
    expect(body.data.message).toContain('不支持')
  })

  it('GET /verify-key/providers 返回厂商清单', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/llm/verify-key/providers' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(Array.isArray(body.data.providers)).toBe(true)
    expect(body.data.providers.length).toBeGreaterThan(0)
    const openai = body.data.providers.find(
      (p: { code: string; defaultModel: string }) => p.code === 'openai',
    )
    expect(openai).toBeDefined()
    expect(openai.defaultModel).toBe('gpt-4o-mini')
  })
})
