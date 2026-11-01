// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * /v1/mcp/* 网关的上游调用契约(2026-11-01 安全强化)。
 *
 * 这条链此前在生产**整条不通**,而且是四处叠加着不通:
 * ① 路径漏 `/api` 前缀(全仓其他调用方都写 `${AI_SERVICE_URL}/api/...`);
 * ② 不带 Authorization —— ai-service 的 JWTAuthMiddleware 在路由之前就要求 Bearer;
 * ③ 只带 `X-Internal-Auth`,而该头在 ai-service 零消费(纯摆设);
 * ④ 只带自报的 `X-User-Id`,ai-service 侧已明令不得当身份用。
 *
 * 这组用例逐条钉住:路径、凭据、以及"那两个头不许回来"。最后一条是反向牙口 ——
 * 少了它,任何一次"把 X-User-Id 加回去图省事"都会静默通过。
 */
import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  apiKey: {
    id: 'key-1',
    userId: 'user-1',
    key: 'sk-test-key',
    permissions: [] as string[],
    rateLimit: 100,
    allowedModels: null as string[] | null,
  } as Record<string, unknown> | null,
  signFails: false,
  captured: [] as Array<{ url: string; headers: Record<string, string> }>,
}))

vi.mock('@ihui/auth', () => ({
  signAccessToken: async () => {
    if (state.signFails) throw new Error('JWT_SECRET missing')
    return 'test-internal-jwt'
  },
}))

vi.mock('../src/plugins/api-key-auth.js', () => ({
  requireApiKeyAuth: async (request: Record<string, unknown>) => {
    if (state.apiKey) request.apiKey = state.apiKey
  },
  modelInList: () => true,
}))

vi.mock('../src/utils/capability-guard.js', () => ({
  requireCapabilityRules: () => async () => {},
}))

vi.mock('../src/services/relay-billing-service.js', () => ({
  recordCall: async () => {},
}))

const { config } = await import('../src/config/index.js')
const { default: v1McpGatewayRoutes } = await import('../src/routes/v1-mcp-gateway.js')

let app: FastifyInstance
const originalFetch = globalThis.fetch

beforeEach(async () => {
  state.apiKey = {
    id: 'key-1',
    userId: 'user-1',
    key: 'sk-test-key',
    permissions: [],
    rateLimit: 100,
    allowedModels: null,
  }
  state.signFails = false
  state.captured = []
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    state.captured.push({
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
    })
    return new Response(JSON.stringify({ tools: [], count: 0 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  app = Fastify()
  await app.register(v1McpGatewayRoutes)
  await app.ready()
})

afterEach(async () => {
  globalThis.fetch = originalFetch
  await app.close()
})

describe('/v1/mcp/tools 的上游调用', () => {
  it('打到 /api/mcp/tools(不是漏了前缀的 /mcp/tools)', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/mcp/tools' })
    expect(res.statusCode).toBe(200)
    expect(state.captured).toHaveLength(1)
    expect(state.captured[0]?.url).toBe(`${config.AI_SERVICE_URL}/api/mcp/tools`)
  })

  it('带 Authorization: Bearer <内部 JWT>(ai-service 只认这一种)', async () => {
    await app.inject({ method: 'GET', url: '/v1/mcp/tools' })
    expect(state.captured[0]?.headers.Authorization).toBe('Bearer test-internal-jwt')
  })

  it('不再带自报身份头 X-User-Id 与对端零消费的 X-Internal-Auth', async () => {
    await app.inject({ method: 'GET', url: '/v1/mcp/tools' })
    const headers = state.captured[0]?.headers ?? {}
    expect(headers['X-User-Id']).toBeUndefined()
    expect(headers['X-Internal-Auth']).toBeUndefined()
  })

  it('取不到主体时 401 且一个请求都不发(不发出无主请求)', async () => {
    state.apiKey = null
    const res = await app.inject({ method: 'GET', url: '/v1/mcp/tools' })
    expect(res.statusCode).toBe(401)
    expect(state.captured).toHaveLength(0)
  })

  it('内部 JWT 签发失败 → 503 + 5016,绝不退化成"不带凭据继续发"', async () => {
    state.signFails = true
    const res = await app.inject({ method: 'GET', url: '/v1/mcp/tools' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toMatchObject({ code: 5016 })
    expect(state.captured).toHaveLength(0)
  })
})

describe('另外两个转发端点同样带前缀与凭据', () => {
  it('POST /v1/mcp/tools/call → /api/mcp/tools/call', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/mcp/tools/call',
      payload: { name: 'echo', arguments: {} },
    })
    expect(res.statusCode).toBe(200)
    expect(state.captured[0]?.url).toBe(`${config.AI_SERVICE_URL}/api/mcp/tools/call`)
    expect(state.captured[0]?.headers.Authorization).toBe('Bearer test-internal-jwt')
  })

  it('POST /v1/mcp/resources/read → /api/mcp/resources/<uri>', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/mcp/resources/read',
      payload: { uri: 'ihui://docs/a' },
    })
    expect(res.statusCode).toBe(200)
    expect(state.captured[0]?.url).toBe(
      `${config.AI_SERVICE_URL}/api/mcp/resources/${encodeURIComponent('ihui://docs/a')}`,
    )
    expect(state.captured[0]?.headers.Authorization).toBe('Bearer test-internal-jwt')
  })
})

describe('反向牙口:源码里不许再把自报头加回来', () => {
  it('v1-mcp-gateway.ts 不含 X-User-Id / X-Internal-Auth 的写入', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const src = readFileSync(
      fileURLToPath(new URL('../src/routes/v1-mcp-gateway.ts', import.meta.url)),
      'utf8',
    )
    expect(src).not.toContain("headers['X-User-Id']")
    expect(src).not.toContain("headers['X-Internal-Auth']")
    expect(src).toContain('mintInternalJwt')
  })
})
