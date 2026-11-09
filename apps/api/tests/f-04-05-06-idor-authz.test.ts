// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-04 / F-05 / F-06 回归锁(2026-11-08,apps/api P1 越权组)。
 *
 * F-04 `legacy-ask` 四个成员接口按 `query.userId` 直读任意用户问答;
 * F-05 `finance-extended` 三个分销统计按 `beneficiaryId` 直读他人佣金/下级;
 * F-06 `/api/agent/creation/my/:type` 采信 body `userId`,可读他人创作。
 *
 * 判据:非属主且非管理员 → 403 且**不查库**;属主本人恒放行;管理员可代查。
 * F-06 额外钉死:归属只取认证身份,body.userId 不再进入查询条件。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type * as DrizzleOrm from 'drizzle-orm'

const ME = '00000000-0000-4000-8000-0000000000aa'
const VICTIM = '00000000-0000-4000-8000-0000000000bb'

const state = vi.hoisted(() => ({
  admin: false,
  dbExecutes: 0,
  dbSelects: 0,
  eqValues: [] as unknown[],
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = '00000000-0000-4000-8000-0000000000aa'
  }),
  requireActiveUser: vi.fn(async () => {}),
  checkAuth: vi.fn(async () => true),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async (_request: unknown, reply: { status: (c: number) => any }) => {
    if (!state.admin) {
      reply.status(403).send({ code: 403, message: '需要管理员权限' })
    }
  }),
  requireAuth: vi.fn(async () => {}),
  requireAdminRouteGuard: vi.fn(async () => {}),
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleOrm>()
  const realEq = actual.eq
  return {
    ...actual,
    eq: (column: unknown, value: unknown) => {
      state.eqValues.push(value)
      return (realEq as unknown as (a: unknown, b: unknown) => unknown)(column, value)
    },
  }
})

vi.mock('../src/db/index.js', () => {
  function makeChain() {
    const chain: Record<string, unknown> = {}
    chain.from = () => chain
    chain.where = () => chain
    chain.orderBy = () => chain
    chain.groupBy = () => chain
    chain.limit = () => chain
    chain.offset = () => chain
    chain.then = (resolve: (v: unknown) => void) => resolve([{ id: 'row-1', count: 3 }])
    return chain
  }
  const db = {
    execute: vi.fn(async () => {
      state.dbExecutes++
      return [{ count: 7 }]
    }),
    select: vi.fn(() => {
      state.dbSelects++
      return makeChain()
    }),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
  return { db, dbRead: db }
})

import { legacyAskRoutes } from '../src/routes/legacy-ask.js'
import { financeExtendedRoutes } from '../src/routes/finance-extended.js'
import agentCreationPlugin from '../src/routes/agent-creation.js'

type Handler = (request: unknown, reply: unknown) => unknown
type Reply = {
  code: number
  body: unknown
  sent: boolean
  status: (c: number) => Reply
  send: (b: unknown) => Reply
}

function makeServer() {
  const handlers = new Map<string, Handler>()
  const server: Record<string, unknown> = {
    addHook: vi.fn(),
    decorate: vi.fn(),
    get: vi.fn((path: string, a: unknown, b?: unknown) => handlers.set(path, (b ?? a) as Handler)),
    post: vi.fn((path: string, a: unknown, b?: unknown) => handlers.set(path, (b ?? a) as Handler)),
    put: vi.fn((path: string, a: unknown, b?: unknown) => handlers.set(path, (b ?? a) as Handler)),
    patch: vi.fn((path: string, a: unknown, b?: unknown) =>
      handlers.set(path, (b ?? a) as Handler),
    ),
    delete: vi.fn((path: string, a: unknown, b?: unknown) =>
      handlers.set(path, (b ?? a) as Handler),
    ),
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  }
  return { server, handlers }
}

function makeReply(): Reply {
  const reply: Reply = {
    code: 200,
    body: undefined,
    sent: false,
    status(c: number) {
      this.code = c
      return this
    },
    send(b: unknown) {
      this.body = b
      this.sent = true
      return this
    },
  }
  return reply
}

const requestLog = { warn: vi.fn(), error: vi.fn(), info: vi.fn() }

beforeEach(() => {
  state.admin = false
  state.dbExecutes = 0
  state.dbSelects = 0
  state.eqValues = []
})

describe('F-04 legacy-ask 成员接口必须校验属主', () => {
  const paths = [
    '/ask/member/question-count',
    '/ask/member/answer-count',
    '/ask/member/questions',
    '/ask/member/answers',
  ]

  async function setup() {
    const { server, handlers } = makeServer()
    await legacyAskRoutes(server as never)
    return handlers
  }

  it('指定他人且非管理员 → 403 且不查库', async () => {
    const handlers = await setup()
    for (const path of paths) {
      const reply = makeReply()
      await handlers.get(path)!(
        { query: { userId: VICTIM }, userId: ME, log: requestLog },
        reply,
      )
      expect(reply.code, `${path} 应拒绝`).toBe(403)
      expect(reply.sent, `${path} 应已回包`).toBe(true)
    }
    expect(state.dbExecutes).toBe(0)
    expect(state.dbSelects).toBe(0)
  })

  it('查询本人 → 放行并返回计数', async () => {
    const handlers = await setup()
    const reply = makeReply()
    const result = await handlers.get('/ask/member/question-count')!(
      { query: { userId: ME }, userId: ME, log: requestLog },
      reply,
    )
    expect(result).toEqual({ count: 7 })
    expect(state.dbExecutes).toBe(1)
  })

  it('管理员代查他人 → 放行', async () => {
    state.admin = true
    const handlers = await setup()
    const reply = makeReply()
    const result = await handlers.get('/ask/member/answer-count')!(
      { query: { userId: VICTIM }, userId: ME, log: requestLog },
      reply,
    )
    expect(result).toEqual({ count: 7 })
    expect(state.dbExecutes).toBe(1)
  })
})

describe('F-05 分销统计按 beneficiaryId 越权读必须过管理员闸', () => {
  const paths = [
    '/finance/distribution/team-stats',
    '/finance/distribution/subordinate-stats',
    '/finance/distribution/invitation-summary',
  ]

  async function setup() {
    const { server, handlers } = makeServer()
    await financeExtendedRoutes(server as never)
    return handlers
  }

  it('指定他人受益人且非管理员 → 403 且不查库', async () => {
    const handlers = await setup()
    for (const path of paths) {
      const reply = makeReply()
      await handlers.get(path)!({ query: { beneficiaryId: VICTIM }, log: requestLog }, reply)
      expect(reply.code, `${path} 应拒绝`).toBe(403)
      expect(reply.sent, `${path} 应已回包`).toBe(true)
    }
    expect(state.dbSelects).toBe(0)
  })

  it('不指定受益人(读自己)→ 放行', async () => {
    const handlers = await setup()
    const reply = makeReply()
    await handlers.get('/finance/distribution/team-stats')!({ query: {}, log: requestLog }, reply)
    expect(reply.code).toBe(200)
    expect(reply.sent).toBe(true)
    expect(state.dbSelects).toBeGreaterThan(0)
  })

  it('管理员指定他人 → 放行', async () => {
    state.admin = true
    const handlers = await setup()
    const reply = makeReply()
    await handlers.get('/finance/distribution/subordinate-stats')!(
      { query: { beneficiaryId: VICTIM }, log: requestLog },
      reply,
    )
    expect(reply.code).toBe(200)
    expect(state.dbSelects).toBeGreaterThan(0)
  })
})

describe('F-06 agent/creation/my 归属恒取认证身份', () => {
  async function setup() {
    const { server, handlers } = makeServer()
    await agentCreationPlugin(server as never)
    return handlers
  }

  it('body 带他人 userId → 查询条件仍是本人', async () => {
    const handlers = await setup()
    const reply = makeReply()
    await handlers.get('/api/agent/creation/my/:type')!(
      {
        params: { type: 'agent' },
        body: { userId: VICTIM },
        userId: ME,
        log: requestLog,
      },
      reply,
    )
    expect(reply.code).toBe(200)
    expect(reply.sent).toBe(true)
    expect(state.eqValues).toContain(ME)
    expect(state.eqValues).not.toContain(VICTIM)
  })

  it('不带 userId → 仍按本人过滤', async () => {
    const handlers = await setup()
    const reply = makeReply()
    await handlers.get('/api/agent/creation/my/:type')!(
      { params: { type: 'workflow' }, body: {}, userId: ME, log: requestLog },
      reply,
    )
    expect(reply.code).toBe(200)
    expect(state.eqValues).toContain(ME)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
