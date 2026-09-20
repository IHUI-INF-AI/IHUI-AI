// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O6 开放能力闸端到端契约(Fastify inject,零真实 DB / Redis)。
 *
 * 复刻 `routes/index.ts` + `routes/other/index.ts` 的真实钩子拓扑:
 *   根级 preHandler(openCapabilityGateway)
 *     → /api 前缀作用域
 *       → 父级 preHandler:authenticate(人 JWT,失败即 401 短路 —— 实测会挡在子钩子之前)
 *         → 各 v1 桩插件自带的 requireOpenCapability(机器通道强制 scope)
 *
 * 断言面:
 * 1. 13 个遗留桩端点无凭据一律 401(收口前也是 401,行为不回退);
 * 2. 登记表内端点携带已授予 scope 的 API Key 可达,并正确绑定归属人 + 注入 capability;
 * 3. 登记表外端点携带 API Key 仍 401(默认拒绝,不因带 key 而放行);
 * 4. key 未授予该 scope → 403 SCOPE_REQUIRED / platform 语义由登记表挡在启动期;
 * 5. 人 JWT 通道逐请求不变:不调用 API Key 鉴权、不注入 capability。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { AuthenticatedApiKey } from '@ihui/types'

const { requireApiKeyAuth, getUserStatus, verifyAccessToken, decodeJwt } = vi.hoisted(() => ({
  requireApiKeyAuth: vi.fn(),
  getUserStatus: vi.fn<(id: string) => Promise<number | undefined>>(),
  verifyAccessToken: vi.fn<(t: string) => Promise<unknown>>(),
  decodeJwt: vi.fn<(t: string) => Record<string, unknown>>(),
}))

/** 可链式调用、可直接 await 的 drizzle 查询桩(返回给定结果,永不碰数据库)。 */
function queryStub(result: unknown): unknown {
  const proxy: unknown = new Proxy(
    function stub() {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => void) => resolve(result)
        }
        return () => proxy
      },
    },
  )
  return proxy
}

vi.mock('../src/db/index.js', () => ({
  db: queryStub([]),
  dbRead: queryStub([]),
  // O4b:路由/服务改从受控出口取数(dbScoped / dbReadScoped),替身必须覆盖同一导出面,
  // 否则被接线文件的 handler 在"越过鉴权进入业务分支"的断言里会拿到 undefined。
  dbScoped: queryStub([]),
  dbReadScoped: queryStub([]),
}))
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus }))
vi.mock('../src/db/content-generation-queries.js', () => ({
  findGenerationTemplates: vi.fn(async () => []),
  findGenerationHistory: vi.fn(async () => ({ list: [], total: 0 })),
}))
vi.mock('../src/db/customer-service-queries.js', () => ({
  findTickets: vi.fn(async () => ({ list: [], total: 0 })),
  findTicketById: vi.fn(async () => null),
  findCommentsByTicket: vi.fn(async () => []),
  findRatingByTicket: vi.fn(async () => null),
  transitionTicket: vi.fn(async () => ({ reason: 'not_found' as const })),
}))
// 表结构对象与 SQL 构造器只为让 handler 跑通,不参与鉴权断言
vi.mock('@ihui/database', () => ({
  tools: { status: 'status', sortOrder: 'sortOrder', rating: 'rating', category: 'category' },
  messages: { senderId: 'sender_id', receiverId: 'receiver_id', isRead: 'is_read', createdAt: 'created_at' },
  zhsFaq: { published: 'published', pinned: 'pinned', sortOrder: 'sort_order' },
}))
vi.mock('drizzle-orm', () => {
  const node = () => ({ __stub: true })
  return { eq: node, and: node, or: node, asc: node, desc: node, sql: node }
})
vi.mock('../src/plugins/api-key-auth.js', () => ({ requireApiKeyAuth }))
vi.mock('@ihui/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, verifyAccessToken }
})
vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, decodeJwt }
})

const { default: Fastify } = await import('fastify')
const { authenticate } = await import('../src/plugins/auth.js')
const { openCapabilityGateway } = await import('../src/utils/open-capability-gate.js')
const { v1ToolsRoutes } = await import('../src/routes/other/v1-tools-routes.js')
const { v1ContentRoutes } = await import('../src/routes/other/v1-content-routes.js')
const { v1CustomerServiceRoutes } = await import('../src/routes/other/v1-customer-service-routes.js')

/** 13 个遗留桩端点(收口前后都必须是"无凭据即拒")。 */
const LEGACY_STUB_ROUTES: ReadonlyArray<readonly [string, string]> = [
  ['GET', '/api/v1/tools/list'],
  ['GET', '/api/v1/tools/categories'],
  ['GET', '/api/v1/tools/upload'],
  ['GET', '/api/v1/content/create'],
  ['GET', '/api/v1/content/list'],
  ['GET', '/api/v1/customer_service/messages'],
  ['GET', '/api/v1/customer_service/messages/read'],
  ['GET', '/api/v1/customer_service/ticket'],
  ['GET', '/api/v1/customer_service/ticket/7'],
  ['GET', '/api/v1/customer_service/ticket/7/replies'],
  ['GET', '/api/v1/customer_service/ticket/7/rate'],
  ['GET', '/api/v1/customer_service/ticket/7/close'],
  ['GET', '/api/v1/customer_service/faqs'],
]

interface Probe {
  userId: string | null
  apiKeyId: string | null
  scope: string | null
  dataClass: string | null
  grant: { key: string; scope: string; dataClass: string } | null
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify()
  app.addHook('preHandler', openCapabilityGateway)
  await app.register(
    async (scope) => {
      // 复刻 routes/other/index.ts 的父级鉴权钩子:人 JWT 失败即 401 短路。
      scope.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          await authenticate(request)
        } catch (e) {
          const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
          return reply.status(statusCode).send({ code: statusCode, message: '操作失败,请稍后重试' })
        }
      })
      await scope.register(v1ToolsRoutes)
      await scope.register(v1ContentRoutes)
      await scope.register(v1CustomerServiceRoutes)
      await scope.register(
        async (inner) => {
          const probe = async (request: FastifyRequest) => {
            const body: Probe = {
              userId: request.userId ?? null,
              apiKeyId: request.apiKey?.id ?? null,
              scope: request.capability?.scope ?? null,
              dataClass: request.capability?.dataClass ?? null,
              grant: request.openCapability ?? null,
            }
            return body
          }
          // /api/skills 在登记表内(skills-list);另两条刻意不登记 —— 一条在族外,
          // 一条落在已登记族的同前缀下(用于验证"族内新增端点不会被顺手开放")
          inner.get('/skills', probe)
          inner.get('/probe/secret', probe)
          inner.get('/v1/tools/newly-added', probe)
        },
      )
    },
    { prefix: '/api' },
  )
  await app.ready()
  return app
}

function grantedKey(permissions: string[]): AuthenticatedApiKey {
  return {
    id: 'key-1',
    userId: 'owner-1',
    key: 'Bearer ihui_test',
    permissions,
    rateLimit: 60,
    expiresAt: null,
    allowedIps: null,
    allowedModels: null,
    maxTokensPerReq: null,
    blockedIps: null,
    rateLimit5h: null,
    rateLimit1d: null,
    rateLimit7d: null,
  } as unknown as AuthenticatedApiKey
}

/** API Key 鉴权桩:Authorization 以 `Bearer ihui_` 开头即视为有效 key,X-Test-Scopes 模拟授予面。 */
function wireApiKeyAuth(): void {
  requireApiKeyAuth.mockImplementation(async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers.authorization
    if (typeof header !== 'string' || !header.startsWith('Bearer ihui_')) {
      await reply.status(401).send({ code: 401, message: '请提供 API Key 鉴权', errorCode: 'SECRET_REQUIRED' })
      return
    }
    const scopes = String(request.headers['x-test-scopes'] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    request.apiKey = grantedKey(scopes)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  wireApiKeyAuth()
  verifyAccessToken.mockImplementation(async (token: string) => {
    // 真实 jose 对非 JWT 串(如 `ihui_` 形态的 API Key)必然验签失败 —— 桩必须复刻这点,
    // 否则"表外路由带 key 仍被拒"的断言会被假绿掩盖。
    if (token === 'bad' || token.startsWith('ihui_')) throw new Error('Invalid or expired token')
    return { userId: 'human-1', phone: '', familyId: 'f1', roleId: 0 }
  })
  decodeJwt.mockReturnValue({ type: 'access' })
  getUserStatus.mockResolvedValue(1)
})

describe('13 个遗留桩:无凭据一律 401', () => {
  it.each(LEGACY_STUB_ROUTES)('%s %s', async (_method, url) => {
    const app = await buildApp()
    const res = await app.inject({ method: _method, url })
    expect([res.statusCode, res.json().message], url).toEqual([401, '操作失败,请稍后重试'])
    expect(requireApiKeyAuth).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('登记表内端点:API Key 可达', () => {
  it('机器凭据命中 tools:read → 放行并绑定归属人 + 注入 capability', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/skills',
      headers: { authorization: 'Bearer ihui_test', 'x-test-scopes': 'skills:read' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      userId: 'owner-1',
      apiKeyId: 'key-1',
      scope: 'skills:read',
      dataClass: 'scoped-read',
      grant: { key: 'skills-list', scope: 'skills:read', dataClass: 'scoped-read' },
    })
    await app.close()
  })

  it('key 未授予该 scope → 403 SCOPE_REQUIRED,且不进 handler', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/skills',
      headers: { authorization: 'Bearer ihui_test', 'x-test-scopes': 'models:read' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({ errorCode: 'SCOPE_REQUIRED', requiredScope: 'skills:read' })
    await app.close()
  })

  it("'*' 通配在已登记且可机器开放的范围内生效", async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/skills',
      headers: { authorization: 'Bearer ihui_test', 'x-test-scopes': '*' },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it.each([
    ['/api/v1/tools/list', 'tools:read', 200],
    ['/api/v1/content/list', 'user:read', 200],
    ['/api/v1/customer_service/ticket/7/close', 'messages:write', 404],
    ['/api/v1/customer_service/faqs', 'messages:read', 200],
  ] as const)('%s 用 %s 可越过鉴权(状态码 %i 即已进入业务分支)', async (url, scope, code) => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: 'Bearer ihui_test', 'x-test-scopes': scope },
    })
    expect([res.statusCode, requireApiKeyAuth.mock.calls.length], url).toEqual([code, 1])
    await app.close()
  })

  it('close 端点只带 messages:read 时被拒(读写 scope 不互换)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/customer_service/ticket/7/close',
      headers: { authorization: 'Bearer ihui_test', 'x-test-scopes': 'messages:read' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({ requiredScope: 'messages:write' })
    await app.close()
  })
})

describe('登记表外端点:携带 API Key 也不放行(默认拒绝)', () => {
  it('表外 /api 路径 → 与今天一致 401,且不调用 API Key 鉴权、不改错误码', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/probe/secret',
      headers: { authorization: 'Bearer ihui_test', 'x-test-scopes': '*' },
    })
    expect([res.statusCode, res.json().message]).toEqual([401, '操作失败,请稍后重试'])
    expect(requireApiKeyAuth).not.toHaveBeenCalled()
    await app.close()
  })

  it('已登记族的同前缀下新增端点不会被顺手开放', async () => {
    const app = await buildApp()
    const withKey = await app.inject({
      method: 'GET',
      url: '/api/v1/tools/newly-added',
      headers: { authorization: 'Bearer ihui_test', 'x-test-scopes': '*' },
    })
    expect([withKey.statusCode, withKey.json().message]).toEqual([401, '操作失败,请稍后重试'])
    expect(requireApiKeyAuth).not.toHaveBeenCalled()
    // 同一路径对人 JWT 不受影响(只是机器面未开放)
    const withJwt = await app.inject({
      method: 'GET',
      url: '/api/v1/tools/newly-added',
      headers: { authorization: 'Bearer jwt' },
    })
    expect(withJwt.statusCode).toBe(200)
    await app.close()
  })
})

describe('人 JWT 通道行为不变', () => {
  it('JWT 请求不触发 API Key 鉴权,且 /api/skills 上不会被注入 capability', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/skills', headers: { authorization: 'Bearer jwt' } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      userId: 'human-1',
      apiKeyId: null,
      scope: null,
      dataClass: null,
      grant: null,
    })
    expect(requireApiKeyAuth).not.toHaveBeenCalled()
    await app.close()
  })

  it('同时携带人 JWT 与 API Key 时按人处理(不改存量登录态语义)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/skills',
      headers: { authorization: 'Bearer jwt', 'x-api-key': 'ihui_test' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().userId).toBe('human-1')
    expect(requireApiKeyAuth).not.toHaveBeenCalled()
    await app.close()
  })

  it('13 个桩端点带人 JWT 全部可达(收口未打断前端)', async () => {
    const app = await buildApp()
    for (const [method, url] of LEGACY_STUB_ROUTES) {
      const res = await app.inject({ method, url, headers: { authorization: 'Bearer jwt' } })
      // 200 = 列表/配置类;404 = 工单不存在(findTicketById 桩返回 null)—— 两者都已越过鉴权
      expect([200, 404], `${method} ${url} → ${res.statusCode}`).toContain(res.statusCode)
    }
    expect(requireApiKeyAuth).not.toHaveBeenCalled()
    await app.close()
  })

  it('无效 JWT 仍是 401(不因新分支放宽)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/skills', headers: { authorization: 'Bearer bad' } })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('API Key 鉴权失败时按 api-key-auth 的原始错误码回给客户端', () => {
  it('缺 X-Api-Secret → 401 SECRET_REQUIRED(而非被降级成通用 401)', async () => {
    requireApiKeyAuth.mockImplementation(async (_request: FastifyRequest, reply: FastifyReply) => {
      await reply.status(401).send({ code: 401, message: 'X-Api-Secret header is required', errorCode: 'SECRET_REQUIRED' })
    })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/skills', headers: { authorization: 'Bearer ihui_x' } })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ errorCode: 'SECRET_REQUIRED' })
    await app.close()
  })

  it('限流 429 + Retry-After 原样透传', async () => {
    requireApiKeyAuth.mockImplementation(async (_request: FastifyRequest, reply: FastifyReply) => {
      await reply.status(429).header('Retry-After', '7').send({ code: 1007, message: 'rate limited' })
    })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/skills', headers: { authorization: 'Bearer ihui_x' } })
    expect([res.statusCode, res.headers['retry-after']]).toEqual([429, '7'])
    await app.close()
  })
})
