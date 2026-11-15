// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-594 回归锁(2026-11-13)。
 *
 * 病灶:POST /api/statistics/agent-heat/refresh 位于只做 checkAuth 的公共插件,
 * dateStr 由客户端任意指定且仅校验非空 ⇒ 任意登录用户可反复删除并回填任意一天的全站热度。
 *
 * 本文件锁:
 *  ① 普通登录用户 → 403,且处理器内的删除/写入一次都不发生;
 *  ② 管理员 → 200,按当天日键重建;
 *  ③ 非法格式 / 非法日历日 / 超出回溯窗口的历史日期 → 400,且不删不写;
 *  ④ 管理员前缀 /api/admin 上的同名入口仍可用(兼容既有调用)。
 *
 * 只 mock auth / db / 查询层,不触达真实 PG。
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

const { authState, dbSelectMock, dbDeleteMock, dbInsertMock, deleteWhereMock, insertValuesMock } =
  vi.hoisted(() => {
    const deleteWhereMock = vi.fn().mockResolvedValue([])
    const insertValuesMock = vi.fn().mockResolvedValue([])
    return {
      authState: {
        authenticated: true,
        userId: '00000000-0000-4000-8000-000000000001',
        roleId: 0,
      },
      dbSelectMock: vi.fn(),
      dbDeleteMock: vi.fn(() => ({ where: deleteWhereMock })),
      dbInsertMock: vi.fn(() => ({ values: insertValuesMock })),
      deleteWhereMock,
      insertValuesMock,
    }
  })

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
    insert: dbInsertMock,
    delete: dbDeleteMock,
  },
  dbRead: { select: vi.fn() },
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
  findVisitLogList: vi.fn(),
}))

import { statisticsRoutes, adminStatisticsRoutes } from '../src/routes/statistics'
import { bizDayKey, shiftBizDayKey } from '../src/utils/biz-day.js'

const AGENT_ID = 'aaaaaaaa-0000-4000-8000-000000000001'

const PUBLIC_URL = '/api/statistics/agent-heat/refresh'
const ADMIN_URL = '/api/admin/statistics/agent-heat/refresh'

function selectChain(result: unknown): unknown {
  const promise = Promise.resolve(result)
  const builder: Record<string, unknown> = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      promise.then(resolve, reject),
  }
  return builder
}

describe('F-594 agent-heat/refresh 仅管理员可调用且拒绝任意历史日期', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(statisticsRoutes, { prefix: '/api' })
    await server.register(adminStatisticsRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    authState.authenticated = true
    authState.roleId = 0
    dbSelectMock.mockReset()
    dbSelectMock.mockReturnValue(selectChain([{ agentId: AGENT_ID, usageCount: 7 }]))
    dbDeleteMock.mockClear()
    dbInsertMock.mockClear()
    deleteWhereMock.mockClear()
    insertValuesMock.mockClear()
  })

  it('① 普通登录用户 → 403,且不删除、不写入', async () => {
    const res = await server.inject({ method: 'POST', url: PUBLIC_URL, payload: {} })
    expect(res.statusCode).toBe(403)
    expect(dbDeleteMock).not.toHaveBeenCalled()
    expect(dbInsertMock).not.toHaveBeenCalled()
  })

  it('② 管理员 → 200,按当天日键重建并返回 agentCount', async () => {
    authState.roleId = 1
    const res = await server.inject({ method: 'POST', url: PUBLIC_URL, payload: {} })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      data: { refreshed: boolean; dateStr: string; agentCount: number }
    }
    expect(body.data).toEqual({ refreshed: true, dateStr: bizDayKey(), agentCount: 1 })
    expect(deleteWhereMock).toHaveBeenCalledTimes(1)
    expect(insertValuesMock).toHaveBeenCalledTimes(1)
  })

  it('③ 管理员 + 窗口内历史日期(昨天)→ 200', async () => {
    authState.roleId = 1
    const yesterday = shiftBizDayKey(bizDayKey(), -1)
    const res = await server.inject({
      method: 'POST',
      url: PUBLIC_URL,
      payload: { dateStr: yesterday },
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: { dateStr: string } }).data.dateStr).toBe(yesterday)
  })

  it('④ 管理员 + 非法格式 → 400,且不删不写', async () => {
    authState.roleId = 1
    const res = await server.inject({
      method: 'POST',
      url: PUBLIC_URL,
      payload: { dateStr: '2025/01/01' },
    })
    expect(res.statusCode).toBe(400)
    expect(dbDeleteMock).not.toHaveBeenCalled()
    expect(dbInsertMock).not.toHaveBeenCalled()
  })

  it('⑤ 管理员 + 非法日历日 → 400,且不删不写', async () => {
    authState.roleId = 1
    const res = await server.inject({
      method: 'POST',
      url: PUBLIC_URL,
      payload: { dateStr: '2026-02-30' },
    })
    expect(res.statusCode).toBe(400)
    expect(dbDeleteMock).not.toHaveBeenCalled()
    expect(dbInsertMock).not.toHaveBeenCalled()
  })

  it('⑥ 管理员 + 任意历史日期 → 400,不得静默删改历史快照', async () => {
    authState.roleId = 1
    const res = await server.inject({
      method: 'POST',
      url: PUBLIC_URL,
      payload: { dateStr: '2020-01-01' },
    })
    expect(res.statusCode).toBe(400)
    expect(dbDeleteMock).not.toHaveBeenCalled()
    expect(dbInsertMock).not.toHaveBeenCalled()
  })

  it('⑦ 未登录 → 401,且不删不写', async () => {
    authState.authenticated = false
    const res = await server.inject({ method: 'POST', url: PUBLIC_URL, payload: {} })
    expect(res.statusCode).toBe(401)
    expect(dbDeleteMock).not.toHaveBeenCalled()
    expect(dbInsertMock).not.toHaveBeenCalled()
  })

  it('⑧ 管理员前缀 /api/admin 上的同名入口仍可用', async () => {
    authState.roleId = 1
    const res = await server.inject({ method: 'POST', url: ADMIN_URL, payload: {} })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: { refreshed: boolean } }).data.refreshed).toBe(true)
  })
})
