// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-05 回归锁(inject 版,2026-11-11,缺陷票 docs/tickets/2026-11/findings-api.md:82-94)。
 *
 * 三个分销统计接口按 query `beneficiaryId` 直读佣金/下级关系:
 *   GET /api/finance/distribution/team-stats
 *   GET /api/finance/distribution/subordinate-stats
 *   GET /api/finance/distribution/invitation-summary
 *
 * 判据(与同文件 `/finance/agent-withdrawal/list` 同一口径):
 *  - `beneficiaryId` 存在且 ≠ 认证用户 ⇒ 必须过 requireAdmin,非管理员 403 且**不查库**;
 *  - 未传 / 等于本人 ⇒ 维持原行为(读自己,200);
 *  - 管理员代查他人 ⇒ 放行,并按被查询人聚合。
 *
 * 与 tests/f-04-05-06-idor-authz.test.ts 的分工:那边把 requireAdmin 整体 mock 掉只验
 * 调用次序;本文件不 mock requireAdmin,走真实闸门以钉死实际拒绝码 403。
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const ME = '00000000-0000-4000-8000-0000000000aa'
const VICTIM = '00000000-0000-4000-8000-0000000000bb'

type AuthedRequest = {
  userId?: string
  jwtPayload?: { userId?: string; roleId?: number }
}

const state = vi.hoisted(() => ({
  userId: '00000000-0000-4000-8000-0000000000aa',
  roleId: 0,
  dbSelects: 0,
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: AuthedRequest) => {
    request.userId = state.userId
    request.jwtPayload = { userId: state.userId, roleId: state.roleId }
    return { userId: state.userId, roleId: state.roleId }
  }),
  requireActiveUser: vi.fn(async () => {}),
  checkAuth: vi.fn(async (request: AuthedRequest) => {
    request.userId = state.userId
    return true
  }),
  checkAuthOrInternalService: vi.fn(async () => true),
}))

// requireAdmin 通过后还有 TOTP 闸;固定返回「已绑定」,让管理员分支不因档位差异抖动。
vi.mock('../src/services/totp-service.js', () => ({
  getTotpStatus: vi.fn(async () => ({ enabled: true })),
}))

vi.mock('../src/db/index.js', () => {
  function makeChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {}
    chain.from = () => chain
    chain.where = () => chain
    chain.groupBy = () => chain
    chain.orderBy = () => chain
    chain.limit = () => chain
    chain.offset = () => chain
    chain.then = (resolve: (value: unknown[]) => void) => resolve([])
    return chain
  }
  const db = {
    select: vi.fn(() => {
      state.dbSelects++
      return makeChain()
    }),
    insert: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain()),
    delete: vi.fn(() => makeChain()),
    execute: vi.fn(async () => []),
  }
  return { db, dbRead: db }
})

import { financeExtendedRoutes } from '../src/routes/finance-extended.js'

const TEAM_STATS = '/api/finance/distribution/team-stats'
const ALL_ENDPOINTS = [
  TEAM_STATS,
  '/api/finance/distribution/subordinate-stats',
  '/api/finance/distribution/invitation-summary',
]

describe('F-05 分销统计按 beneficiaryId 越权读', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(financeExtendedRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    state.userId = ME
    state.roleId = 0
    state.dbSelects = 0
  })

  it.each(ALL_ENDPOINTS)('非管理员指定他人 beneficiaryId ⇒ 403 且不查库: %s', async (url) => {
    const res = await app.inject({ method: 'GET', url: `${url}?beneficiaryId=${VICTIM}` })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({ code: 403, message: '需要管理员权限' })
    expect(state.dbSelects).toBe(0)
  })

  it.each(ALL_ENDPOINTS)('本人显式传自己的 beneficiaryId ⇒ 200: %s', async (url) => {
    const res = await app.inject({ method: 'GET', url: `${url}?beneficiaryId=${ME}` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ code: 0, message: 'success' })
    expect(state.dbSelects).toBeGreaterThan(0)
  })

  it.each(ALL_ENDPOINTS)('未传 beneficiaryId 时仍按认证身份读取 ⇒ 200: %s', async (url) => {
    const res = await app.inject({ method: 'GET', url })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ code: 0, message: 'success' })
    expect(state.dbSelects).toBeGreaterThan(0)
  })

  it.each(ALL_ENDPOINTS)('管理员指定他人 beneficiaryId ⇒ 放行 200: %s', async (url) => {
    state.roleId = 1
    const res = await app.inject({ method: 'GET', url: `${url}?beneficiaryId=${VICTIM}` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ code: 0, message: 'success' })
    expect(state.dbSelects).toBeGreaterThan(0)
  })

  it('管理员代查他人时按被查询人聚合(不回落成管理员自己)', async () => {
    state.roleId = 1
    const res = await app.inject({ method: 'GET', url: `${TEAM_STATS}?beneficiaryId=${VICTIM}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.beneficiaryId).toBe(VICTIM)
  })

  it('本人查询时按本人聚合', async () => {
    const res = await app.inject({ method: 'GET', url: `${TEAM_STATS}?beneficiaryId=${ME}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.beneficiaryId).toBe(ME)
  })
})
