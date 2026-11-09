// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-592 判据取证:全站访问明细只允许管理员读取,且响应不得交出会话/终端标识。
 *
 * 三条判据:
 *  ① 普通登录用户 → 403,且 `findVisitLogList` **一次都没被调用**(不是查完再过滤);
 *  ② 管理员 → 200,列表投影只含白名单字段;
 *  ③ 管理员响应里也不出现 sessionId / userAgent(防止"管理员可见全部"的旧口径回潮)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    AI_CALLBACK_SECRET: '',
    ADMIN_TOTP_MODE: 'off',
  },
  isProductionGuard: () => false,
}))

const { authState, findVisitLogListMock, dbSelectMock } = vi.hoisted(() => ({
  authState: {
    authenticated: true,
    userId: '00000000-0000-4000-8000-000000000001',
    roleId: 0,
  },
  findVisitLogListMock: vi.fn(),
  dbSelectMock: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: async (
    request: Record<string, unknown>,
    reply: { status: (n: number) => { send: (b: unknown) => void } },
  ) => {
    if (!authState.authenticated) {
      reply.status(401).send({ code: 401, message: '请先登录' })
      return false
    }
    request.userId = authState.userId
    request.jwtPayload = { userId: authState.userId, roleId: authState.roleId }
    return true
  },
  authenticate: async (request: Record<string, unknown>) => {
    if (!authState.authenticated) {
      const err = new Error('unauthenticated') as Error & { statusCode?: number }
      err.statusCode = 401
      throw err
    }
    request.userId = authState.userId
    request.jwtPayload = { userId: authState.userId, roleId: authState.roleId }
    return request.jwtPayload
  },
  requireActiveUser: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: dbSelectMock,
    insert: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn().mockResolvedValue([]),
  },
  dbRead: { execute: vi.fn().mockResolvedValue([]), select: vi.fn() },
}))

vi.mock('../src/db/statistics-queries.js', () => ({
  getLearnStatistics: vi.fn(),
  getExamStatistics: vi.fn(),
  getContentStatistics: vi.fn(),
  getOverviewStatistics: vi.fn(),
  findStatisticsSnapshots: vi.fn(),
  findStatisticsSnapshotById: vi.fn(),
  createStatisticsSnapshot: vi.fn(),
  deleteStatisticsSnapshot: vi.fn(),
  getMessageStatistics: vi.fn(),
  getLiveStatistics: vi.fn(),
  getPointStatistics: vi.fn(),
  getResourceStatistics: vi.fn(),
  getUserCenterStats: vi.fn(),
  findVisitLogList: findVisitLogListMock,
}))

import { statisticsRoutes, adminStatisticsRoutes } from '../src/routes/statistics'
import { visitTrackingRoutes, adminVisitTrackingRoutes } from '../src/routes/visit-tracking'

const ROW = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  userId: 'bbbbbbbb-0000-4000-8000-000000000002',
  ip: '203.0.113.7',
  city: 'Hangzhou',
  url: '/courses/1',
  referer: 'https://example.com/',
  userAgent: 'Mozilla/5.0 (secret-ua)',
  sessionId: 'secret-session-id',
  visitDate: '2026-11-08',
  createdAt: '2026-11-08T10:00:00.000Z',
}

const SAFE_ROW = {
  id: ROW.id,
  userId: ROW.userId,
  ip: ROW.ip,
  city: ROW.city,
  url: ROW.url,
  referer: ROW.referer,
  visitDate: ROW.visitDate,
  createdAt: ROW.createdAt,
}

function chain(result: unknown): unknown {
  const promise = Promise.resolve(result)
  const builder: Record<string, unknown> = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    offset: () => promise,
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      promise.then(resolve, reject),
  }
  return builder
}

const LOG_LIST_URL = '/api/admin/visit-tracking/log/list'
const TRACES_EXPORT_URL = '/api/admin/traces/export'
const ADMIN_VISITS_URL = '/api/admin/visit-tracking/visits'

describe('F-592 全站访问明细管理员闸与响应最小化', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(statisticsRoutes, { prefix: '/api' })
    await server.register(adminStatisticsRoutes, { prefix: '/api/admin' })
    await server.register(visitTrackingRoutes, { prefix: '/api' })
    await server.register(adminVisitTrackingRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    findVisitLogListMock.mockReset()
    findVisitLogListMock.mockResolvedValue({
      list: [ROW],
      total: 1,
      page: 1,
      pageSize: 20,
    })
    dbSelectMock.mockReset()
    dbSelectMock.mockImplementation((cols?: unknown) => chain(cols ? [{ count: 1 }] : [ROW]))
    authState.authenticated = true
    authState.roleId = 0
  })

  it('普通登录用户请求全站明细 → 403,且根本不查访问明细表', async () => {
    const res = await server.inject({ method: 'GET', url: LOG_LIST_URL })
    expect(res.statusCode).toBe(403)
    expect(dbSelectMock).not.toHaveBeenCalled()
  })

  it('管理员请求全站明细 → 200,列表按白名单投影且不含 sessionId/userAgent', async () => {
    authState.roleId = 1
    const res = await server.inject({ method: 'GET', url: LOG_LIST_URL })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { list: Record<string, unknown>[]; total: number } }
    expect(body.data.total).toBe(1)
    expect(body.data.list[0]).toEqual(SAFE_ROW)
    expect(res.body).not.toContain('sessionId')
    expect(res.body).not.toContain('userAgent')
    expect(res.body).not.toContain('secret-session-id')
    expect(res.body).not.toContain('secret-ua')
  })

  it('普通登录用户请求导出端点 → 403,且不查库', async () => {
    const res = await server.inject({ method: 'GET', url: TRACES_EXPORT_URL })
    expect(res.statusCode).toBe(403)
    expect(dbSelectMock).not.toHaveBeenCalled()
  })

  it('管理员请求导出端点 → 200,响应不含 sessionId/userAgent', async () => {
    authState.roleId = 1
    const res = await server.inject({ method: 'GET', url: TRACES_EXPORT_URL })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { list: Record<string, unknown>[]; total: number } }
    expect(body.data.total).toBe(1)
    expect(body.data.list[0]).toEqual(SAFE_ROW)
    expect(res.body).not.toContain('sessionId')
    expect(res.body).not.toContain('userAgent')
  })

  it('普通登录用户请求快照明细端点 → 403,且不查库', async () => {
    const res = await server.inject({ method: 'GET', url: ADMIN_VISITS_URL })
    expect(res.statusCode).toBe(403)
    expect(findVisitLogListMock).not.toHaveBeenCalled()
  })

  it('管理员请求快照明细端点 → 200,列表按白名单投影', async () => {
    authState.roleId = 1
    const res = await server.inject({ method: 'GET', url: ADMIN_VISITS_URL })
    expect(res.statusCode).toBe(200)
    expect(findVisitLogListMock).toHaveBeenCalledTimes(1)
    const body = res.json() as {
      data: { list: Record<string, unknown>[]; total: number }
    }
    expect(body.data.total).toBe(1)
    expect(body.data.list[0]).toEqual(SAFE_ROW)
  })

  it('管理员响应也不出现 sessionId / userAgent(旧"管理员可见全部"口径不得回潮)', async () => {
    authState.roleId = 1
    const res = await server.inject({ method: 'GET', url: ADMIN_VISITS_URL })
    expect(res.statusCode).toBe(200)
    expect(res.body).not.toContain('sessionId')
    expect(res.body).not.toContain('userAgent')
    expect(res.body).not.toContain('secret-session-id')
    expect(res.body).not.toContain('secret-ua')
  })

  it('未登录仍是 401(闸门不改变既有登录语义)', async () => {
    authState.authenticated = false
    const res = await server.inject({ method: 'GET', url: LOG_LIST_URL })
    expect(res.statusCode).toBe(401)
    expect(dbSelectMock).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
