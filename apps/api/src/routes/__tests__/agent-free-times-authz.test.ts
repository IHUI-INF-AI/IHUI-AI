// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/agent-free-times 匿名挂载收口的回归锁。
 *
 * 立因(现读于 HEAD 之前的形态):同一插件被挂两处,admin 那侧有 requireAdmin + 内网+mTLS,
 * 而 /api/agent-free-times 是裸挂载 ⇒ 五个端点匿名可达;POST /reset 在空 body 时 where 退化成
 * sql`TRUE`(整表清零并把全表记录返回给调用方),POST /consume 与 GET /remaining 直接采信
 * 客户端自报的 userUuid。
 *
 * 断言口径按 §5:越权档必须证明**副作用没发生**,并成对留正向对照;判归属不看状态码,
 * 而是拦下 drizzle eq() 的实参 —— "过滤条件里没出现别人"才是这条链路的真相。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8810/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { TOKENS, eqCalls, dbTouched } = vi.hoisted(() => ({
  TOKENS: new Map<string, { userId: string; roleId: number }>([
    ['tok-a', { userId: 'user-a', roleId: 0 }],
    ['tok-admin', { userId: 'user-admin', roleId: 1 }],
  ]),
  eqCalls: [] as Array<{ col: string; value: unknown }>,
  dbTouched: { count: 0 },
}))

// 把 eq 的第一参(列)按 symbol/name 归一成可比字符串,记录 (列, 值) 实参对
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: (col: any, value: unknown) => {
      eqCalls.push({ col: String(col?.name ?? col), value })
      dbTouched.count++
      return actual.eq(col, value)
    },
  }
})

// db 只到"构造出语句"这一层:then 返回空集,不碰任何真实连接(§测试隔离:禁连生产库)
vi.mock('../../db/index.js', () => {
  const chain = () => {
    const q: any = {}
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'set', 'values', 'returning'])
      q[m] = () => q
    q.then = (res: any) => Promise.resolve([]).then(res)
    return q
  }
  return { db: { select: chain, insert: chain, update: chain, delete: chain } }
})

vi.mock('../../plugins/require-permission.js', () => ({
  requireAuth: vi.fn(async (request: any, reply: any) => {
    const header = request.headers?.authorization ?? ''
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : ''
    const principal = TOKENS.get(token)
    if (!principal) return reply.status(401).send({ code: 401, message: 'Authentication required' })
    request.userId = principal.userId
    request.jwtPayload = principal
  }),
  requireAdmin: vi.fn(async (request: any, reply: any) => {
    const header = request.headers?.authorization ?? ''
    const principal = TOKENS.get(typeof header === 'string' ? header.slice(7) : '')
    if (!principal || principal.roleId < 1)
      return reply.status(403).send({ code: 403, message: 'Admin required' })
    request.userId = principal.userId
    request.jwtPayload = principal
  }),
  isSystemAdmin: (request: any) => (request.jwtPayload?.roleId ?? 0) >= 1,
}))

import { userAgentFreeTimesRoutes } from '../user-agent-free-times.js'

const auth = (t: string) => ({ authorization: `Bearer ${t}` })
const reset = () => {
  eqCalls.length = 0
}

describe('agent-free-times:匿名一律拒,归属只认令牌', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(userAgentFreeTimesRoutes, { prefix: '/api/agent-free-times' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('五个端点匿名全部 401,且不产生任何 db 动作(副作用没发生)', async () => {
    const reqs = [
      { method: 'GET' as const, url: '/api/agent-free-times/' },
      { method: 'GET' as const, url: '/api/agent-free-times/remaining?agentId=a1' },
      { method: 'POST' as const, url: '/api/agent-free-times/', payload: { userUuid: 'v', agentId: 'a1', freeTimes: 9 } },
      { method: 'POST' as const, url: '/api/agent-free-times/consume', payload: { userUuid: 'v', agentId: 'a1' } },
      { method: 'POST' as const, url: '/api/agent-free-times/reset', payload: {} },
    ]
    for (const r of reqs) {
      reset()
      const res = await app.inject({ ...r, payload: r.payload as any })
      expect(res.statusCode, r.url).toBe(401)
      expect(eqCalls, `匿名 ${r.url} 不应构造任何归属查询`).toHaveLength(0)
    }
  })

  it('POST /reset 空 body 时,普通主体的过滤条件恒等于自己的身份(不再退化成整表)', async () => {
    reset()
    await app.inject({ method: 'POST', url: '/api/agent-free-times/reset', headers: auth('tok-a'), payload: {} })
    const uuidFilter = eqCalls.filter((e) => e.col === 'user_uuid')
    expect(uuidFilter.length, 'reset 必须带主体过滤').toBeGreaterThan(0)
    expect(uuidFilter.every((e) => e.value === 'user-a')).toBe(true)
  })

  it('POST /reset 自报他人 userUuid 时,条件里出现的仍是令牌主体', async () => {
    reset()
    await app.inject({
      method: 'POST',
      url: '/api/agent-free-times/reset',
      headers: auth('tok-a'),
      payload: { userUuid: 'victim' },
    })
    expect(eqCalls.some((e) => e.value === 'victim')).toBe(false)
    expect(eqCalls.filter((e) => e.col === 'user_uuid').every((e) => e.value === 'user-a')).toBe(true)
  })

  it('正向对照:管理员不填 userUuid 仍可整表重置(既有 admin 语义逐字保留)', async () => {
    reset()
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent-free-times/reset',
      headers: auth('tok-admin'),
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    expect(eqCalls.filter((e) => e.col === 'user_uuid')).toHaveLength(0)
  })

  it('发放额度(POST /)与按 id 删除(DELETE /:id)对普通主体关闭,且不写库', async () => {
    reset()
    const grant = await app.inject({
      method: 'POST',
      url: '/api/agent-free-times/',
      headers: auth('tok-a'),
      payload: { userUuid: 'user-a', agentId: 'a1', freeTimes: 999 },
    })
    expect(grant.statusCode).toBe(403)
    reset()
    const del = await app.inject({ method: 'DELETE', url: '/api/agent-free-times/7', headers: auth('tok-a') })
    expect(del.statusCode).toBe(403)
    expect(eqCalls, '闸门在 preHandler 就拒,不该构造语句').toHaveLength(0)
  })

  it('GET /remaining 与 /consume 的归属取令牌,不接受 body/query 自报的别人', async () => {
    reset()
    await app.inject({ method: 'GET', url: '/api/agent-free-times/remaining?userUuid=victim&agentId=a1', headers: auth('tok-a') })
    expect(eqCalls.some((e) => e.value === 'victim')).toBe(false)
    expect(eqCalls.filter((e) => e.col === 'user_uuid').map((e) => e.value)).toContain('user-a')

    reset()
    await app.inject({
      method: 'POST',
      url: '/api/agent-free-times/consume',
      headers: auth('tok-a'),
      payload: { userUuid: 'victim', agentId: 'a1' },
    })
    expect(eqCalls.some((e) => e.value === 'victim')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
