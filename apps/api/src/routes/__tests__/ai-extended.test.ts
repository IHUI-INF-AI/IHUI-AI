// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
// 鉴权 mock 辅助(2026-09-09 第九轮安全修复后,本插件所有路由走 preHandler 鉴权)。
// 注意:必须内联,勿 import tests/helpers/mock-auth —— 该文件在 tsconfig rootDir(src)外,
// tsc 顺藤摸瓜报 TS6059,级联 typecheck/build/Docker/e2e 全挂(2026-09-10 CI 实证)。
const mockAuthenticate = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const mockCheckAuth = async (...args: unknown[]): Promise<boolean> => {
  try {
    await mockAuthenticate(...args)
    return true
  } catch (e) {
    const err = e as Error & { statusCode?: number }
    const reply = args[1] as { status: (code: number) => { send: (body: unknown) => unknown } }
    const statusCode = err.statusCode ?? 401
    reply
      .status(statusCode)
      .send({ code: statusCode, message: err.message || 'Authentication required' })
    return false
  }
}
// restoreAllMocks 会清掉 mockImplementation,每个用例前需重新注入 admin 身份
const setMockAdmin = (userId: string): void => {
  const payload = { userId, roleId: 1, type: 'access' }
  mockAuthenticate.mockImplementation(async (request: unknown) => {
    ;(request as { userId: string }).userId = userId
    ;(request as { jwtPayload?: unknown }).jwtPayload = payload
    return payload
  })
}

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 路由文件以 '../plugins/auth.js' 导入 checkAuthOrInternalService,
// require-permission.ts 以 './auth.js' 导入 authenticate —— 两者解析到同一模块,
// 整模块 mock 后工厂必须显式提供全部导出,否则路由拿到 undefined → 500。
vi.mock('../../plugins/auth.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  requireActiveUser: vi.fn(),
  checkAuth: (...args: unknown[]) => mockCheckAuth(...args),
  checkAuthOrInternalService: (...args: unknown[]) => mockCheckAuth(...args),
}))

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

// Mock aiServiceFetch 使其直接读取 process.env.AI_SERVICE_URL（动态反映测试中的 env 变更），
// 绕过 config 模块（模块加载时固化 AI_SERVICE_URL 默认值）与 traceparent 注入。
vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceFetch: (_request: unknown, path: string, init: RequestInit = {}) => {
    const url = `${process.env.AI_SERVICE_URL}${path}`
    return fetch(url, init)
  },
  aiServiceFetchStream: (_request: unknown, path: string, init: RequestInit = {}) => {
    const url = `${process.env.AI_SERVICE_URL}${path}`
    return fetch(url, init)
  },
}))

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
    // restoreAllMocks 会清掉 mockAuthenticate 的实现,需在之后重新注入 admin 身份
    setMockAdmin('00000000-0000-4000-8000-000000000001')
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
    process.env.AI_SERVICE_URL = 'http://mock-ai-service:8803'
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
      'http://mock-ai-service:8803/llm/complete',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })

  it('配置 AI_SERVICE_URL 但 fetch 返回非 ok 时返回 502', async () => {
    process.env.AI_SERVICE_URL = 'http://mock-ai-service:8803'
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
    process.env.AI_SERVICE_URL = 'http://mock-ai-service:8803'
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
