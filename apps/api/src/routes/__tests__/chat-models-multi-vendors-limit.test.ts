// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.ZHIPU_API_KEY = 'test-zhipu'
  process.env.OPENROUTER_API_KEY = 'test-openrouter'
  process.env.DASHSCOPE_API_KEY = 'test-dashscope'
  process.env.N8N_BASE_URL = 'https://n8n.test'
  process.env.N8N_WEBHOOK_PATH = '/webhook/chat'
  process.env.COZE_API_KEY = 'test-coze'
  process.env.COZE_API_BASE = 'https://coze.test'
  process.env.LANGCHAIN_BASE_URL = 'https://langchain.test'
  process.env.LANGCHAIN_API_KEY = 'test-langchain'
  process.env.NODE_ENV = 'test'
})

const fetchMock = vi.hoisted(() =>
  vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
  })),
)

vi.mock('../../plugins/auth.js', () => ({
  checkAuth: vi.fn(async () => true),
  authenticate: vi.fn(async () => undefined),
}))

import { chatModelRoutes } from '../chat-models.js'

describe('F-192 /multi/multi vendors 数量上限', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(chatModelRoutes, { prefix: '/api/chat' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('超过上限的 vendors 在发起上游调用前返回 400', async () => {
    const vendors = [
      'zhipu',
      'openrouter',
      'bailian',
      'n8n',
      'coze_workflow',
      'langchain',
      'vendor7',
      'vendor8',
      'vendor9',
      'vendor10',
      'vendor11',
    ].join(',')
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/multi/multi',
      payload: { vendors, message: 'hello' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('正常 2 个 vendors 仍可用', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/multi/multi',
      payload: { vendors: 'zhipu,openrouter', message: 'hello' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { results: Array<{ vendor: string; ok: boolean }> } }
    expect(body.data.results).toHaveLength(2)
    expect(body.data.results.every((r) => r.ok)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
