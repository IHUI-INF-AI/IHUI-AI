// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * clawdbot 面的身份主体回归锁(AGENTS.md §5「认证不等于授权」+「身份不得住客户端可整写字段」)。
 *
 * 缺陷形状(2026-11-01 现读于 `src/routes/clawdbot.ts`):
 *  · `POST /clawdbot/chat` 的 `chatSchema.userId` 是**必填**的客户端自报值,它一路进
 *    `clawdbot-service.chat(userId, …)` 当**对话历史桶键**(`conversations: Map<userId, …>`)
 *    ⇒ 自报他人 userId 即可读他人历史、并把回复写进他人的桶;
 *  · `POST /clawdbot/pairing/confirm` 同型:自报 userId 成为 `PairingSession.userId`(属主),
 *    `pairing/request` 的可选自报值随后被 confirm 继承。
 * 本面整体挂插件级 `server.addHook('preHandler', requireAdminRouteGuard)`(存续由
 * `clawdbot-admin-gate-wiring.test.ts` 钉),所以暴露对象是"管理员席之间/持管理员
 * 令牌者",不是任意登录用户 —— 但**主体仍必须来自令牌**:管理后台代客操作在这套实现里
 * 没有任何"代客"语义(chat/pairing 都只往那个键里写)。
 *
 * 按 §5 的口径,每个越权档都配一条同入口的**正向对照**,并断言"副作用按合法主体发生"
 * (不是只看状态码)。夹具只填生产真会填的字段(`request.userId` / `request.jwtPayload`)。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8810/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { TOKENS, chatCalls, pairingCalls, requestCalls } = vi.hoisted(() => ({
  TOKENS: new Map<string, { userId: string; roleId: number }>([
    ['tok-a', { userId: 'user-a', roleId: 1 }],
    ['tok-b', { userId: 'user-b', roleId: 1 }],
  ]),
  chatCalls: [] as Array<{ userId: string; content: string }>,
  pairingCalls: [] as Array<{
    code: string
    userId: string
    deviceId: string
    channelType: string
  }>,
  requestCalls: [] as Array<{ userId?: string; deviceId?: string; channelType?: string }>,
}))

const principalOf = (request: { headers?: Record<string, unknown> }) => {
  const header = request.headers?.authorization ?? ''
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : ''
  return TOKENS.get(token)
}

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: vi.fn(async (request: any, reply: any) => {
    const header = request.headers?.authorization ?? ''
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : ''
    const principal = TOKENS.get(token)
    if (!principal) {
      reply.status(401).send({ code: 401, message: 'Authentication required' })
      return false
    }
    request.userId = principal.userId
    request.jwtPayload = principal
    return true
  }),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  // 与生产同形:requireAdmin 内部先 authenticate(无凭据 ⇒ 401),再过 roleId(不足 ⇒ 403)。
  requireAdmin: vi.fn(async (request: any, reply: any) => {
    const principal = principalOf(request)
    if (!principal) {
      return reply.status(401).send({ code: 401, message: 'Authentication required' })
    }
    request.userId = principal.userId
    request.jwtPayload = principal
    if (principal.roleId < 1) {
      return reply.status(403).send({ code: 403, message: 'Admin required' })
    }
  }),
  // 2026-11-01 本面档位对齐到 requireAdminRouteGuard(= 上面那枚 + requireActiveUser)。
  // 整片替换式替身**少一枚名字就是 undefined**,Fastify 会拿 undefined 当 hook ⇒ 本文件
  // 全部用例在收集期就崩(与 verifyLoginPassword / requireAuth 两次同型事故一条毛)。
  requireAdminRouteGuard: vi.fn(async (request: any, reply: any) => {
    const principal = principalOf(request)
    if (!principal) {
      return reply.status(401).send({ code: 401, message: 'Authentication required' })
    }
    request.userId = principal.userId
    request.jwtPayload = principal
    if (principal.roleId < 1) {
      return reply.status(403).send({ code: 403, message: 'Admin required' })
    }
  }),
  requireAuth: vi.fn(),
  isSystemAdmin: () => true,
}))

vi.mock('../src/services/clawdbot/index.js', () => {
  const noop = () => undefined
  const svc = {
    chat: async (userId: string, content: string) => {
      chatCalls.push({ userId, content })
      return { userId, content, reply: 'ok' }
    },
    getConversation: () => [],
    initialize: noop,
    shutdown: noop,
    getStatus: () => ({ ready: true }),
  }
  const pairing = {
    createRequest: (params: { userId?: string; deviceId?: string; channelType?: string }) => {
      requestCalls.push(params)
      return { code: 'PAIR-1', ...params }
    },
    confirmPairing: (code: string, userId: string, deviceId: string, channelType: string) => {
      pairingCalls.push({ code, userId, deviceId, channelType })
      return { code, userId, deviceId, channelType, status: 'paired' }
    },
    getSessionByUser: () => null,
    getRequest: () => null,
  }
  const stub = new Proxy(
    {},
    {
      get: (_t, key: string) => {
        if (key === 'chat' || key === 'getConversation') return svc[key]
        if (key === 'createRequest' || key === 'confirmPairing' || key === 'getSessionByUser')
          return pairing[key]
        return typeof key === 'string' && key.startsWith('get') ? () => stub : noop
      },
    },
  )
  const g = () => stub
  return {
    getClawdbotService: () => svc,
    getPairingService: () => pairing,
    getToolExecutor: g,
    getTaskExecutor: g,
    getMemoryService: g,
    getSkillManager: g,
    getModelManager: g,
    getSystemService: g,
    getChannelManager: g,
    getCanvasService: g,
    getMcpClient: g,
    getVoiceService: g,
    getBrowserAutomation: g,
    getIntegrationManager: g,
    getSelfEvolutionEngine: g,
  }
})

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify()
  const { clawdbotRoutes } = await import('../src/routes/clawdbot.js')
  await app.register(clawdbotRoutes, { prefix: '/api/admin' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

const post = (path: string, body: unknown, token = 'tok-a') =>
  app.inject({
    method: 'POST',
    url: `/api/admin${path}`,
    headers: { authorization: `Bearer ${token}` },
    payload: body as Record<string, unknown>,
  })

describe('clawdbot 面的主体只住令牌', () => {
  it('chat:自报他人 userId ⇒ 桶键仍是令牌主体(越权档)', async () => {
    chatCalls.length = 0
    const res = await post('/clawdbot/chat', { userId: 'user-victim', content: 'hi' }, 'tok-a')
    expect(res.statusCode).toBe(200)
    expect(chatCalls).toEqual([{ userId: 'user-a', content: 'hi' }])
    expect(chatCalls.some((c) => c.userId === 'user-victim')).toBe(false)
  })

  it('chat:正向对照 —— 不带 userId 键位也用令牌主体(旧必填校验已放开)', async () => {
    chatCalls.length = 0
    const res = await post('/clawdbot/chat', { content: 'hi2' }, 'tok-b')
    expect(res.statusCode).toBe(200)
    expect(chatCalls).toEqual([{ userId: 'user-b', content: 'hi2' }])
  })

  it('chat:content 仍必填 —— 放开 userId 不等于放开内容校验', async () => {
    chatCalls.length = 0
    const res = await post('/clawdbot/chat', { userId: 'user-a' }, 'tok-a')
    expect(res.statusCode).toBe(400)
    expect(chatCalls).toHaveLength(0)
  })

  it('pairing/confirm:自报 userId 不再成为会话属主', async () => {
    pairingCalls.length = 0
    const res = await post(
      '/clawdbot/pairing/confirm',
      { code: 'PAIR-1', userId: 'user-victim', deviceId: 'd1', channelType: 'web' },
      'tok-a',
    )
    expect(res.statusCode).toBe(200)
    expect(pairingCalls).toEqual([
      { code: 'PAIR-1', userId: 'user-a', deviceId: 'd1', channelType: 'web' },
    ])
  })

  it('pairing/request:待确认请求登记的属主 = 令牌主体(自报值被覆盖)', async () => {
    requestCalls.length = 0
    const res = await post('/clawdbot/pairing/request', { userId: 'user-victim' }, 'tok-b')
    expect(res.statusCode).toBe(200)
    expect(requestCalls).toEqual([{ userId: 'user-b' }])
  })

  it('匿名:三档入口照旧 401,副作用为零(收权没有被放宽)', async () => {
    chatCalls.length = 0
    pairingCalls.length = 0
    requestCalls.length = 0
    for (const [p, b] of [
      ['/clawdbot/chat', { content: 'x' }],
      ['/clawdbot/pairing/confirm', { code: 'c', deviceId: 'd', channelType: 'web' }],
      ['/clawdbot/pairing/request', {}],
    ] as Array<[string, Record<string, unknown>]>) {
      const res = await app.inject({ method: 'POST', url: `/api/admin${p}`, payload: b })
      expect(res.statusCode).toBe(401)
    }
    expect(chatCalls).toHaveLength(0)
    expect(pairingCalls).toHaveLength(0)
    expect(requestCalls).toHaveLength(0)
  })

  it('接线锁:chat / pairing 两个 handler 不得再把 parsed.data.userId 当主体', async () => {
    const src = await import('node:fs/promises').then((m) =>
      m.readFile(new URL('../src/routes/clawdbot.ts', import.meta.url), 'utf8'),
    )
    expect(src).toMatch(/chat\(req\.userId!/m)
    expect(src).toMatch(/confirmPairing\(code, req\.userId!/m)
    expect(src).toMatch(/createRequest\(\{ \.\.\.parsed\.data, userId: req\.userId! \}\)/m)
    expect(src).not.toMatch(/chat\(userId, content\)/)
    expect(src).not.toMatch(/confirmPairing\(code, userId, deviceId, channelType\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
