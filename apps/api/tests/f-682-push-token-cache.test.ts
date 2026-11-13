// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-682 回归锁(2026-11-13)。
 *
 * 病灶:个推 getGetuiAuthToken() 每个 target 都重新 /auth;sendPushBatch 用 Promise.all
 * 全并发扇出;POST /api/admin/push/send 的收件人查询无 LIMIT,且超限无任何标注。
 * 本用例锁:token 命中缓存不重复鉴权、并发未命中只请求一次、扇出并发峰值 ≤5、
 * 收件人超 LIMIT 时响应如实标注截断并 warn。
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { env } from 'node:process'

const MEMBER_ID = '00000000-0000-4000-8000-0000000000bb'
const CONFIG_KEYS = [
  'FCM_PROJECT_ID',
  'FCM_SERVICE_ACCOUNT_KEY',
  'GETUI_APP_ID',
  'GETUI_APP_KEY',
  'GETUI_MASTER_SECRET',
] as const

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  execute: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: { select: mocks.select, execute: mocks.execute },
}))
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async () => {}),
  checkAuth: vi.fn(async () => true),
}))
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async () => true),
}))

import { adminPushRoutes } from '../src/routes/push.js'

const savedEnv: Record<string, string | undefined> = {}
for (const k of CONFIG_KEYS) savedEnv[k] = env[k]

function clearChannels(): void {
  for (const k of CONFIG_KEYS) delete env[k]
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

type FetchStats = { auth: number; push: number; inFlight: number; peak: number }

/** 个推双端点 fetch 桩:/auth 计次,/push/single/cid 记录并发峰值。 */
function createGetuiFetch(opts: {
  expireAt?: number
  authDelayMs?: number
  pushDelayMs?: number
}): { fetchMock: ReturnType<typeof vi.fn>; stats: FetchStats } {
  const stats: FetchStats = { auth: 0, push: 0, inFlight: 0, peak: 0 }
  const fetchMock = vi.fn(async (input: unknown) => {
    const url = String(input)
    if (url.endsWith('/auth')) {
      stats.auth += 1
      if (opts.authDelayMs) await sleep(opts.authDelayMs)
      return new Response(
        JSON.stringify({
          code: 0,
          msg: 'success',
          data: { token: 'getui-token', expire_time: opts.expireAt },
        }),
        { status: 200 },
      )
    }
    stats.push += 1
    stats.inFlight += 1
    stats.peak = Math.max(stats.peak, stats.inFlight)
    if (opts.pushDelayMs) await sleep(opts.pushDelayMs)
    stats.inFlight -= 1
    return new Response(JSON.stringify({ code: 10000, msg: 'success' }), { status: 200 })
  })
  return { fetchMock, stats }
}

type ProviderModule = {
  sendPush: (
    target: { token: string },
    message: { title: string; body: string },
  ) => Promise<{ success: boolean }>
  sendPushBatch: (
    targets: Array<{ token: string }>,
    message: { title: string; body: string },
  ) => Promise<Array<{ success: boolean }>>
}

/** 每个用例取一份新模块,保证 token 缓存是冷的。 */
async function loadProvider(): Promise<ProviderModule> {
  vi.resetModules()
  return (await import('../src/services/push-provider.js')) as ProviderModule
}

/** 收件人查询链:select().from().where().limit() → 行集。 */
function tokenQuery(rows: Array<{ token: string }>): unknown {
  const q: Record<string, unknown> = {
    from: () => q,
    where: () => q,
    limit: async () => rows,
  }
  return q
}

describe('F-682 个推 token 缓存与扇出并发上限', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(adminPushRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    clearChannels()
    env.GETUI_APP_ID = 'getui-app'
    env.GETUI_APP_KEY = 'getui-key'
    env.GETUI_MASTER_SECRET = 'getui-secret'
    mocks.select.mockReset()
    mocks.execute.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    for (const k of CONFIG_KEYS) {
      if (savedEnv[k] === undefined) delete env[k]
      else env[k] = savedEnv[k]
    }
  })

  it('token 命中缓存:连续两次发送只请求一次 /auth', async () => {
    const { fetchMock, stats } = createGetuiFetch({ expireAt: Date.now() + 3600_000 })
    vi.stubGlobal('fetch', fetchMock)
    const { sendPush } = await loadProvider()

    const first = await sendPush({ token: 'cid-1' }, { title: 't', body: 'b' })
    const second = await sendPush({ token: 'cid-2' }, { title: 't', body: 'b' })

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(stats.auth).toBe(1)
    expect(stats.push).toBe(2)
  })

  it('并发未命中共享 in-flight:10 路并发只请求一次 /auth', async () => {
    const { fetchMock, stats } = createGetuiFetch({
      expireAt: Date.now() + 3600_000,
      authDelayMs: 5,
    })
    vi.stubGlobal('fetch', fetchMock)
    const { sendPush } = await loadProvider()

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        sendPush({ token: `cid-${i}` }, { title: 't', body: 'b' }),
      ),
    )

    expect(results.every((r) => r.success)).toBe(true)
    expect(stats.auth).toBe(1)
    expect(stats.push).toBe(10)
  })

  it('token 距过期不足 60s 时提前刷新', async () => {
    const { fetchMock, stats } = createGetuiFetch({ expireAt: Date.now() + 30_000 })
    vi.stubGlobal('fetch', fetchMock)
    const { sendPush } = await loadProvider()

    await sendPush({ token: 'cid-1' }, { title: 't', body: 'b' })
    await sendPush({ token: 'cid-2' }, { title: 't', body: 'b' })

    expect(stats.auth).toBe(2)
  })

  it('批量扇出并发峰值不超过 5', async () => {
    const { fetchMock, stats } = createGetuiFetch({
      expireAt: Date.now() + 3600_000,
      pushDelayMs: 5,
    })
    vi.stubGlobal('fetch', fetchMock)
    const { sendPushBatch } = await loadProvider()

    const results = await sendPushBatch(
      Array.from({ length: 20 }, (_, i) => ({ token: `cid-${i}` })),
      { title: 't', body: 'b' },
    )

    expect(results).toHaveLength(20)
    expect(results.every((r) => r.success)).toBe(true)
    expect(stats.peak).toBeGreaterThan(1)
    expect(stats.peak).toBeLessThanOrEqual(5)
  })

  it('收件人超过 LIMIT 时截断,并在响应与日志中如实标注', async () => {
    clearChannels()
    const rows = Array.from({ length: 10001 }, (_, i) => ({ token: `tok-${i}` }))
    mocks.select.mockReturnValue(tokenQuery(rows))
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/push/send',
      headers: { authorization: 'Bearer mock-access-token' },
      body: { title: 't', body: 'b', memberIds: [MEMBER_ID] },
    })

    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.truncated).toBe(true)
    expect(data.total).toBe(10000)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain('10000')
  })

  it('收件人未超 LIMIT 时不标注截断', async () => {
    clearChannels()
    mocks.select.mockReturnValue(tokenQuery([{ token: 'tok-0' }, { token: 'tok-1' }]))
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/push/send',
      headers: { authorization: 'Bearer mock-access-token' },
      body: { title: 't', body: 'b', memberIds: [MEMBER_ID] },
    })

    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.total).toBe(2)
    expect(data.truncated).toBeUndefined()
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
