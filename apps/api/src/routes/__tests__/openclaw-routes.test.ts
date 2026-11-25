// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

// 鉴权插件 mock:保留其余导出,仅替换 authenticate,便于注入 userId 或模拟 401。
vi.mock('../../plugins/auth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../plugins/auth.js')>()
  return { ...actual, authenticate: vi.fn() }
})

import { missingUserRoutes } from '../missing-user-routes.js'
import { openclawRoutes } from '../openclaw-routes.js'
import { authenticate } from '../../plugins/auth.js'

const AUTH_HEADERS = { authorization: 'Bearer mock-token' }

/** 默认拒绝鉴权 → 401(保持原有 "无 auth 返回 401" 用例有效) */
function mockAuthReject(): void {
  vi.mocked(authenticate).mockRejectedValue(
    Object.assign(new Error('Authentication required'), { statusCode: 401 }),
  )
}

/** 鉴权通过并注入 userId(与真实 authenticate 行为一致) */
function mockAuth(userId = 'test-user-id'): void {
  vi.mocked(authenticate).mockImplementation(async (request: { userId?: string }) => {
    request.userId = userId
    return { userId } as never
  })
}

describe('OpenClaw Routes API (OpenClaw 条目真实化端点)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(missingUserRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.mocked(authenticate).mockReset()
    mockAuthReject()
  })

  describe('Route registration', () => {
    it('should register the route plugin without throwing', () => {
      expect(app).toBeDefined()
    })
  })

  describe('OpenClaw 端点 (401 without auth)', () => {
    const endpoints: Array<{
      method: 'GET' | 'POST'
      url: string
      payload?: Record<string, unknown>
    }> = [
      { method: 'GET', url: '/api/openclaw' },
      { method: 'GET', url: '/api/openclaw/00000000-0000-4000-8000-000000000000' },
    ]

    for (const { method, url, payload } of endpoints) {
      it(`${method} ${url} 无 auth 返回 401`, async () => {
        const res = await app.inject({ method, url, payload })
        expect(res.statusCode).toBe(401)
      })
    }
  })
})

describe('OpenClaw 渠道 connect/disconnect (未登记候选渠道)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(openclawRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.mocked(authenticate).mockReset()
    mockAuth('channel-test-user')
  })

  async function listChannels(): Promise<Array<{ id: string; connected: boolean }>> {
    const res = await app.inject({
      method: 'GET',
      url: '/api/openclaw/channels',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    return res.json().data.channels
  }

  it('未登记候选渠道 sup-wechat-mp connect 成功(非 404),且 connected=true、id 唯一', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/openclaw/channels/sup-wechat-mp/connect',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ connected: true })

    const matches = (await listChannels()).filter((c) => c.id === 'sup-wechat-mp')
    expect(matches).toHaveLength(1)
    expect(matches[0]!.connected).toBe(true)
  })

  it('已登记 seed 渠道 ch-wechat connect 后,listChannels 不出现两条同 id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/openclaw/channels/ch-wechat/connect',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect((await listChannels()).filter((c) => c.id === 'ch-wechat')).toHaveLength(1)
  })

  it('未登记候选渠道 disconnect 成功,且 connected=false、id 唯一', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/openclaw/channels/sup-wechat-mp/disconnect',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ disconnected: true })

    const matches = (await listChannels()).filter((c) => c.id === 'sup-wechat-mp')
    expect(matches).toHaveLength(1)
    expect(matches[0]!.connected).toBe(false)
  })

  it('完全不存在的 id connect/disconnect 仍返回 404(守门未放宽)', async () => {
    for (const action of ['connect', 'disconnect']) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/openclaw/channels/definitely-not-exist/${action}`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().message).toBe('渠道不存在')
    }
  })

  it('候选渠道连接结果按 userId 隔离', async () => {
    // 用户 A 连接候选渠道
    mockAuth('user-isolation-a')
    const resA = await app.inject({
      method: 'POST',
      url: '/api/openclaw/channels/sup-wechat-mp/connect',
      headers: AUTH_HEADERS,
    })
    expect(resA.statusCode).toBe(200)

    // 用户 B 看不到 A 的连接结果
    mockAuth('user-isolation-b')
    expect((await listChannels()).find((c) => c.id === 'sup-wechat-mp')).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
