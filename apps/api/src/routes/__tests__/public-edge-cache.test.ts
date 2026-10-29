// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 公开 GET 接口的边缘缓存头对账(2026-10-21 立,承 PUBLIC-ACCESS-PERF-AUDIT §P1.3)。
 *
 * 它钉的是三件事,缺一都算没锁住:
 *  ① 入选的公开接口**到端**带 `public, s-maxage=60, stale-while-revalidate=60`
 *     (取值 import 自 utils/public-edge-cache.ts,本文件不抄第二份 —— §22c);
 *     并且用 `app.listen(0)` 起真实 socket 再 fetch 一遍,证明头不是 inject 的伪像;
 *  ② 带身份语义的接口**不得**带 public:`/api/agents` 的游客视图与登录视图逐字节不同
 *     (未发布行 + 未脱敏字段),共享边缘一旦缓存它就是把登录视图喂给游客 ——
 *     这条断言既是排除清单的凭据,也是"判据有牙"的阳性对照;
 *  ③ 非 2xx 与"降级"响应不得进共享缓存:404 协议缺失、以及 status/incidents 的
 *     `degraded:true` 分支都必须没有 Cache-Control(下一次请求要立刻回源重试)。
 *
 * 隔离:全程 mock db(不连生产 PG 8810 / Redis 8811,AGENTS §5),鉴权出口 mock,
 * ai-service 健康探测 mock(不发真实网络请求)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Redis } from 'ioredis'
import type * as LlmProviderHealthModuleForMock from '../../lib/llm-provider-health.js'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

/** db 夹具:默认返回空行集(响应头与内容多少无关);rejectSelect 用来驱动降级分支。 */
const dbState = vi.hoisted(() => ({ rows: [] as unknown[], rejectSelect: false }))

const CHAIN_METHODS = [
  'from',
  'where',
  'orderBy',
  'limit',
  'offset',
  'groupBy',
  'having',
  'innerJoin',
  'leftJoin',
  'values',
  'set',
  'returning',
  'onConflictDoNothing',
  'onConflictDoUpdate',
] as const

vi.mock('../../db/index.js', () => {
  function run(): Promise<unknown[]> {
    if (dbState.rejectSelect) return Promise.reject(new Error('fixture: query failed'))
    return Promise.resolve(dbState.rows)
  }
  function makeChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {}
    for (const method of CHAIN_METHODS) chain[method] = () => chain
    chain.then = (
      onFulfilled?: (value: unknown[]) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => run().then(onFulfilled, onRejected)
    return chain
  }
  const client = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
    execute: () => run(),
  }
  return { db: client, dbRead: client, dbClient: {} }
})

vi.mock('../../config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '127.0.0.1',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-for-vitest-at-least-32-chars',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

const { mockAuthenticate, mockCheckAuth, mockListAgents } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockCheckAuth: vi.fn(),
  mockListAgents: vi.fn(),
}))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: mockCheckAuth,
  requireActiveUser: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(),
  isSystemAdmin: vi.fn().mockReturnValue(false),
}))

vi.mock('../../db/rbac-queries.js', () => ({
  checkPermission: vi.fn().mockResolvedValue(false),
}))

vi.mock('../../services/agent-service.js', () => ({
  listAgents: mockListAgents,
  getAgentDetail: vi.fn().mockResolvedValue(null),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
}))

// ai-service 健康探测不发真实网络请求(市场列表会按健康度剔除不可用模型,与缓存头无关)
vi.mock('../../lib/llm-provider-health.js', async (importOriginal) => {
  const actual = await importOriginal<typeof LlmProviderHealthModuleForMock>()
  return {
    ...actual,
    fetchProviderHealth: vi.fn().mockResolvedValue({ known: false, providers: {} }),
  }
})

import { PUBLIC_EDGE_CACHE_CONTROL, withPublicEdgeCache } from '../../utils/public-edge-cache.js'
import { systemRoutes } from '../system.js'
import { carouselPublicRoutes } from '../carousel.js'
import { articleRoutes } from '../articles.js'
import { agreementPublicRoutes } from '../admin-agreements.js'
import leaderboardRoutes from '../leaderboard.js'
import { miniappPublicFallbackRoutes } from '../miniapp-public-fallback-routes.js'
import { newsRoutes } from '../news.js'
import publicStatusRoutes from '../public-status.js'
import { agentsRoutes } from '../agents.js'

const MEMBER_USER_ID = '00000000-0000-4000-8000-000000000002'

/** 游客:authenticate 抛 401(与生产同一失效路径 —— 游客分支由 handler 自己兜)。 */
function asGuest(): void {
  mockAuthenticate.mockReset()
  mockCheckAuth.mockReset()
  const err = Object.assign(new Error('Authentication required'), { statusCode: 401 })
  mockAuthenticate.mockRejectedValue(err)
  mockCheckAuth.mockResolvedValue(false)
}

/** 登录态:authenticate 注入 request.userId(承载层显式入参,不信客户端自报)。 */
function asMember(): void {
  mockAuthenticate.mockReset()
  mockCheckAuth.mockReset()
  mockAuthenticate.mockImplementation(async (request: { userId?: string }) => {
    request.userId = MEMBER_USER_ID
  })
  mockCheckAuth.mockResolvedValue(true)
}

/** 公开面:游客可读 + 身份无关 + 已加头。 */
const PUBLIC_CACHED_GETS = [
  '/api/configs',
  '/api/carousels',
  '/api/articles',
  '/api/model-leaderboard',
  '/api/models/market',
  '/api/news/articles/pinned',
  '/api/news/articles/recommended',
  '/api/news/feed',
  '/api/content/home',
  '/api/content/banner/list',
  '/api/content/course/list',
  '/api/public/status/models',
  '/api/public/status/incidents',
] as const

/** 带身份语义 / 未自证公开 的面:一条都不许带 public。 */
const MUST_NOT_BE_PUBLICLY_CACHED = [
  '/api/agents',
  '/api/agents/list',
  '/api/agents/my',
  '/api/public/status/overview',
] as const

function cacheControlOf(res: { headers: { 'cache-control'?: unknown } }): string {
  const value = res.headers['cache-control']
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return String(value[0] ?? '')
  return ''
}

describe('公开 GET 接口的边缘缓存头', () => {
  let app: FastifyInstance

  /**
   * 每次调用造一个新实例:真实 TCP 那一档必须用**独立实例** listen + close,
   * 否则共享 app 被关掉之后所有 inject 都报 "Fastify has already been closed"。
   */
  async function createApp(): Promise<FastifyInstance> {
    const instance = Fastify({ logger: false })
    const redisStub = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      ping: vi.fn().mockResolvedValue('PONG'),
    }
    instance.decorate('redis', redisStub as unknown as Redis)
    await instance.register(systemRoutes, { prefix: '/api' })
    await instance.register(carouselPublicRoutes, { prefix: '/api' })
    await instance.register(articleRoutes, { prefix: '/api' })
    await instance.register(agreementPublicRoutes, { prefix: '/api' })
    await instance.register(leaderboardRoutes, { prefix: '/api' })
    await instance.register(miniappPublicFallbackRoutes, { prefix: '/api' })
    await instance.register(newsRoutes, { prefix: '/api' })
    await instance.register(publicStatusRoutes, { prefix: '/api/public' })
    await instance.register(agentsRoutes, { prefix: '/api' })
    await instance.ready()
    return instance
  }

  beforeAll(async () => {
    app = await createApp()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    dbState.rows = []
    dbState.rejectSelect = false
    asGuest()
    mockListAgents.mockReset().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 12 })
  })

  it('公开面无一例外带 s-maxage=60 的 public 档(inject 面)', async () => {
    const seen: string[] = []
    for (const url of PUBLIC_CACHED_GETS) {
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode, `${url} 游客必须读得到(非 401/403/500)`).toBe(200)
      expect(cacheControlOf(res), `${url} 应带公开边缘缓存档`).toBe(PUBLIC_EDGE_CACHE_CONTROL)
      seen.push(url)
    }
    expect(seen.length).toBeGreaterThanOrEqual(10)
  })

  it('同一档在真实 TCP 响应上同样成立(listen + fetch,不是 inject 伪像)', async () => {
    const live = await createApp()
    const address = await live.listen({ port: 0, host: '127.0.0.1' })
    try {
      for (const url of ['/api/configs', '/api/models/market', '/api/public/status/models']) {
        const res = await fetch(`${address}${url}`)
        // 留原文读数:这条断言跑在真实 socket 上,打印出来的就是边缘/网关将看到的头
        console.info(
          `[wire-evidence] ${address}${url} → cache-control: ${res.headers.get('cache-control')}`,
        )
        expect(res.status, url).toBe(200)
        expect(res.headers.get('cache-control'), url).toBe(PUBLIC_EDGE_CACHE_CONTROL)
      }
    } finally {
      await live.close()
    }
  })

  it('带身份语义与未自证公开的面一律不带 public', async () => {
    for (const url of MUST_NOT_BE_PUBLICLY_CACHED) {
      const res = await app.inject({ method: 'GET', url })
      // /api/agents/my 对游客是 401,其余是 200 —— 无论哪种都不许出现 public 档
      expect(res.statusCode, url).toBeLessThan(500)
      expect(cacheControlOf(res), `${url} 不得进共享边缘缓存`).not.toContain('public')
    }
  })

  it('阳性对照:/api/agents 的游客视图与登录视图逐字节不同(所以它必须被排除)', async () => {
    const draftRow = {
      agentId: '11111111-1111-4111-8111-111111111111',
      name: '待审核智能体',
      status: 'pending',
      userId: MEMBER_USER_ID,
      agentPrompt: 'SECRET-PROMPT',
      workspaceId: 'ws-internal-1',
    }
    const publishedRow = {
      agentId: '22222222-2222-4222-8222-222222222222',
      name: '已上架智能体',
      status: 'published',
      userId: MEMBER_USER_ID,
      agentPrompt: 'SECRET-PROMPT',
      workspaceId: 'ws-internal-1',
    }
    mockListAgents.mockResolvedValue({
      list: [publishedRow, draftRow],
      total: 2,
      page: 1,
      pageSize: 12,
    })

    asGuest()
    const guest = await app.inject({ method: 'GET', url: '/api/agents' })
    asMember()
    const member = await app.inject({ method: 'GET', url: '/api/agents' })

    expect(guest.statusCode).toBe(200)
    expect(member.statusCode).toBe(200)
    // 登录视图里有未发布行与提示词原文 ⇒ 两份内容不可能相同 ⇒ 该接口带身份语义
    expect(member.body).not.toBe(guest.body)
    expect(member.body).toContain('待审核智能体')
    expect(member.body).toContain('SECRET-PROMPT')
    expect(guest.body).not.toContain('待审核智能体')
    expect(guest.body).not.toContain('SECRET-PROMPT')
    // 而它两个面都没有 public(缓存它 = 把登录视图喂给游客)
    expect(cacheControlOf(guest)).not.toContain('public')
    expect(cacheControlOf(member)).not.toContain('public')
  })

  it('入选面不随身份变:同一接口游客与登录态响应逐字节相同且都带头', async () => {
    const urls = ['/api/configs', '/api/agents/stats', '/api/carousels', '/api/models/market']
    for (const url of urls) {
      asGuest()
      const guest = await app.inject({ method: 'GET', url })
      asMember()
      const member = await app.inject({ method: 'GET', url })
      expect(guest.statusCode, url).toBe(200)
      expect(member.statusCode, url).toBe(200)
      expect(member.body, `${url} 登录态与游客内容必须一致`).toBe(guest.body)
      expect(cacheControlOf(guest), url).toBe(PUBLIC_EDGE_CACHE_CONTROL)
      expect(cacheControlOf(member), url).toBe(PUBLIC_EDGE_CACHE_CONTROL)
      // 响应里不得出现身份字段(入选面都是聚合/公开投影)
      expect(guest.body).not.toContain(MEMBER_USER_ID)
    }
  })

  it('伪造凭据(Cookie/Authorization)不改变内容,也不额外产生变体头', async () => {
    for (const url of ['/api/configs', '/api/public/status/models']) {
      const bare = await app.inject({ method: 'GET', url })
      const forged = await app.inject({
        method: 'GET',
        url,
        headers: {
          authorization: 'Bearer attacker-self-reported',
          cookie: `auth_token=${MEMBER_USER_ID}; user_id=${MEMBER_USER_ID}`,
          'x-user-id': MEMBER_USER_ID,
        },
      })
      expect(forged.statusCode, url).toBe(200)
      expect(forged.body, `${url} 不得信客户端自报身份`).toBe(bare.body)
      expect(cacheControlOf(forged), url).toBe(PUBLIC_EDGE_CACHE_CONTROL)
    }
  })

  it('404 与查询降级分支都不打缓存头(下一次请求要立刻回源)', async () => {
    const missing = await app.inject({
      method: 'GET',
      url: '/api/agreements/current?type=user-agreement',
    })
    expect(missing.statusCode).toBe(404)
    expect(cacheControlOf(missing)).toBe('')

    dbState.rows = [{ type: 'user-agreement', title: '用户协议', status: 1 }]
    const found = await app.inject({
      method: 'GET',
      url: '/api/agreements/current?type=user-agreement',
    })
    expect(found.statusCode).toBe(200)
    expect(cacheControlOf(found)).toBe(PUBLIC_EDGE_CACHE_CONTROL)

    // status/incidents 的 degraded:true 是"查不到所以列表为空",不得进共享缓存
    dbState.rejectSelect = true
    const degraded = await app.inject({ method: 'GET', url: '/api/public/status/incidents' })
    expect(degraded.statusCode).toBe(200)
    expect(degraded.json() as unknown).toBeInstanceOf(Object)
    expect(JSON.stringify(degraded.json())).toContain('"degraded":true')
    expect(cacheControlOf(degraded), '降级响应不得被边缘缓存').toBe('')
  })

  it('判据本身有牙:withPublicEdgeCache 在 4xx 上不写头、在 2xx 上写且只写一次', () => {
    const headers: Record<string, string> = {}
    const reply = {
      statusCode: 200,
      header(key: string, value: string) {
        headers[key] = value
        return reply
      },
    }
    const ok = withPublicEdgeCache(reply)
    expect(headers['Cache-Control']).toBe(PUBLIC_EDGE_CACHE_CONTROL)
    expect(ok).toBe(reply)

    const errHeaders: Record<string, string> = {}
    const notFound = {
      statusCode: 404,
      header(key: string, value: string) {
        errHeaders[key] = value
        return notFound
      },
    }
    withPublicEdgeCache(notFound)
    expect(errHeaders['Cache-Control']).toBeUndefined()
  })

  it('公开档的取值口径:s-maxage 必须有、且不得写成 private/no-store(反向锁死退化)', () => {
    expect(PUBLIC_EDGE_CACHE_CONTROL).toMatch(/^public, s-maxage=\d+, stale-while-revalidate=\d+$/)
    expect(PUBLIC_EDGE_CACHE_CONTROL).not.toMatch(/private|no-store|no-cache/)
  })

  it('跨源不进共享缓存:Origin≠Host ⇒ 不打 public;Origin==Host 或无 Origin ⇒ 照旧打(2026-10-28 实测承因)', () => {
    const mk = (requestHeaders: Record<string, string | undefined>) => {
      const headers: Record<string, string> = {}
      const reply = {
        statusCode: 200,
        header(key: string, value: string) {
          headers[key] = value
          return reply
        },
        request: { headers: requestHeaders },
      }
      return { reply, headers }
    }
    // 桌面端 WebView 的固定 Origin 与本站 Host 不同 ⇒ 正是实测被串味的那一档
    const cross = mk({ origin: 'http://tauri.localhost', host: 'www.aizhs.top' })
    withPublicEdgeCache(cross.reply)
    expect(
      cross.headers['Cache-Control'],
      '跨源响应不得进共享缓存(否则边缘会把上一位访客的 ACAO 喂给本站)',
    ).toBeUndefined()

    const same = mk({ origin: 'https://www.aizhs.top', host: 'www.aizhs.top' })
    withPublicEdgeCache(same.reply)
    expect(same.headers['Cache-Control']).toBe(PUBLIC_EDGE_CACHE_CONTROL)

    // 端口不同也是跨源;Host 带端口时不得误判同源
    const ported = mk({ origin: 'https://www.aizhs.top:444', host: 'www.aizhs.top' })
    withPublicEdgeCache(ported.reply)
    expect(ported.headers['Cache-Control']).toBeUndefined()

    const none = mk({ host: 'www.aizhs.top' })
    withPublicEdgeCache(none.reply)
    expect(none.headers['Cache-Control']).toBe(PUBLIC_EDGE_CACHE_CONTROL)

    // 退化方向:解析不出的一律算跨源(宁可少缓存一次,不可把别人的凭据域喂给本站)
    const junk = mk({ origin: 'not-a-url', host: 'www.aizhs.top' })
    withPublicEdgeCache(junk.reply)
    expect(junk.headers['Cache-Control']).toBeUndefined()
    const noHost = mk({ origin: 'http://tauri.localhost' })
    withPublicEdgeCache(noHost.reply)
    expect(noHost.headers['Cache-Control']).toBeUndefined()
  })

  it('真实 socket 上同样成立:带跨源 Origin 拿不到 public,无 Origin 照旧拿得到', async () => {
    const live = await createApp()
    const address = await live.listen({ port: 0, host: '127.0.0.1' })
    try {
      const cross = await fetch(`${address}/api/configs`, {
        headers: { Origin: 'http://tauri.localhost' },
      })
      const plain = await fetch(`${address}/api/configs`)
      console.info(
        `[wire-evidence] 跨源臂 cache-control=${cross.headers.get('cache-control')} / 无 Origin 臂 cache-control=${plain.headers.get('cache-control')}`,
      )
      expect(cross.status).toBe(200)
      expect(cross.headers.get('cache-control'), '跨源臂不得带 public 档').toBeNull()
      expect(plain.headers.get('cache-control')).toBe(PUBLIC_EDGE_CACHE_CONTROL)
    } finally {
      await live.close()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
