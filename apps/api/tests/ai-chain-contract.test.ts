/**
 * AI 对话链路契约测试 — 防止 API ↔ AI-service 字段名漂移 + /api/llm/models 路由回归
 *
 * 背景:2026-07-17 发现 ai-chat-stream.ts 传 modelId 给 AI-service,
 * 但 AI-service LLMCompleteRequest 期望 model,导致用户切换模型无效。
 * 本测试锁定契约:API 必须传 model 字段(非 modelId),且 /api/llm/models 必须可用。
 */
import { describe, it, expect, afterAll, beforeAll, vi, afterEach } from 'vitest'
import Fastify from 'fastify'

// Mock config 避免 env 校验触发 process.exit(1)
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8080,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://mock-ai-service:8000',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

// Mock @ihui/auth
const { mockVerifyAccessToken } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
}))
vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000002'),
}))

// Mock db
function createChainableMock() {
  const thenFn = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve)
  const make = (): Record<string, unknown> => {
    const proxy = new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') return thenFn
        return vi.fn().mockReturnValue(make())
      },
    })
    return proxy
  }
  return make()
}
vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => createChainableMock()),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]) })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]) })),
      })),
    })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    execute: vi.fn().mockResolvedValue([]),
  },
  dbRead: {},
  dbClient: {},
}))

// Mock @ihui/types message-repair(避免依赖真实实现)
vi.mock('@ihui/types', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    repairMessages: (msgs: unknown[]) => ({ repaired: msgs, removed: 0 }),
  }
})

import { llmModelsRoutes } from '../src/routes/llm-models.js'
import { aiChatStreamRoutes } from '../src/routes/ai-chat-stream.js'

const ADMIN_TOKEN = 'Bearer admin-token'

function mockAdmin() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: '00000000-0000-0000-0000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-0000-0000-000000000002',
    roleId: 1,
  })
}

describe('AI 对话链路契约', () => {
  describe('/api/llm/models 路由', () => {
    const server = Fastify({ logger: false })

    beforeAll(async () => {
      await server.register(llmModelsRoutes, { prefix: '/api/llm' })
      await server.ready()
    })

    afterAll(async () => {
      await server.close()
    })

    it('未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/llm/models' })
      expect(res.statusCode).toBe(401)
    })

    it('admin 登录后返回模型列表(代理 AI-service)', async () => {
      mockAdmin()
      const mockModels = {
        models: [
          {
            id: 'stepfun/step-3.7-flash',
            name: 'Step 3.7 Flash',
            provider: 'meta',
            context_length: 128000,
            input_price: 0,
          },
          {
            id: 'gpt-4o',
            name: 'GPT-4o',
            provider: 'openai',
            context_length: 128000,
            input_price: 2.5,
          },
        ],
        default: 'stepfun/step-3.7-flash',
        stub_mode: false,
      }

      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockModels,
      }) as unknown as typeof globalThis.fetch

      try {
        const res = await server.inject({
          method: 'GET',
          url: '/api/llm/models',
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(200)
        const body = res.json()
        expect(body.code).toBe(0)
        expect(body.data.models).toHaveLength(2)
        expect(body.data.models[0].id).toBe('stepfun/step-3.7-flash')
        expect(body.data.default).toBe('stepfun/step-3.7-flash')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('AI-service 不可用时返回 502', async () => {
      mockAdmin()
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      }) as unknown as typeof globalThis.fetch

      try {
        const res = await server.inject({
          method: 'GET',
          url: '/api/llm/models',
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(502)
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  describe('ai-chat-stream 字段名契约(model 非 modelId)', () => {
    const server = Fastify({ logger: false })

    beforeAll(async () => {
      await server.register(aiChatStreamRoutes, { prefix: '/api/ai' })
      await server.ready()
    })

    afterAll(async () => {
      await server.close()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('接受 model 字段(与 AI-service LLMCompleteRequest 契约对齐)', async () => {
      mockAdmin()
      const fetchCalls: unknown[] = []
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
        const body = JSON.parse((init as RequestInit).body as string)
        fetchCalls.push(body)
        return Promise.resolve({
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.close()
            },
          }),
        })
      }) as unknown as typeof globalThis.fetch

      try {
        const res = await server.inject({
          method: 'POST',
          url: '/api/ai/chat/stream',
          headers: { authorization: ADMIN_TOKEN },
          body: {
            messages: [{ role: 'user', content: 'hi' }],
            model: 'gpt-4o',
          },
        })
        expect(res.statusCode).toBe(200)
        // 验证传给 AI-service 的 body 含 model 字段(非 modelId)
        expect(fetchCalls).toHaveLength(1)
        const sentBody = fetchCalls[0] as Record<string, unknown>
        expect(sentBody.model).toBe('gpt-4o')
        expect(sentBody.modelId).toBeUndefined()
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('向后兼容:接受 modelId 字段并映射为 model', async () => {
      mockAdmin()
      const fetchCalls: unknown[] = []
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
        const body = JSON.parse((init as RequestInit).body as string)
        fetchCalls.push(body)
        return Promise.resolve({
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.close()
            },
          }),
        })
      }) as unknown as typeof globalThis.fetch

      try {
        const res = await server.inject({
          method: 'POST',
          url: '/api/ai/chat/stream',
          headers: { authorization: ADMIN_TOKEN },
          body: {
            messages: [{ role: 'user', content: 'hi' }],
            modelId: 'claude-3-5-sonnet',
          },
        })
        expect(res.statusCode).toBe(200)
        expect(fetchCalls).toHaveLength(1)
        const sentBody = fetchCalls[0] as Record<string, unknown>
        // modelId 应被映射为 model(向后兼容)
        expect(sentBody.model).toBe('claude-3-5-sonnet')
        expect(sentBody.modelId).toBeUndefined()
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('model 优先于 modelId(同时传时 model 胜出)', async () => {
      mockAdmin()
      const fetchCalls: unknown[] = []
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
        const body = JSON.parse((init as RequestInit).body as string)
        fetchCalls.push(body)
        return Promise.resolve({
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.close()
            },
          }),
        })
      }) as unknown as typeof globalThis.fetch

      try {
        await server.inject({
          method: 'POST',
          url: '/api/ai/chat/stream',
          headers: { authorization: ADMIN_TOKEN },
          body: {
            messages: [{ role: 'user', content: 'hi' }],
            model: 'gpt-4o',
            modelId: 'claude-3-5-sonnet',
          },
        })
        const sentBody = fetchCalls[0] as Record<string, unknown>
        expect(sentBody.model).toBe('gpt-4o')
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })
})
