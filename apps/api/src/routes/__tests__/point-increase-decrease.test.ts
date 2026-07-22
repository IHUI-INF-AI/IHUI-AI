import { describe, it, expect, afterAll, beforeAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

vi.mock('../../config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8080,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:3001',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:3003',
  },
}))

const { mockVerifyAccessToken, mockSelectResult, mockInsertValues } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockSelectResult: vi.fn().mockResolvedValue([]),
  mockInsertValues: vi.fn().mockResolvedValue([]),
}))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000002'),
}))

vi.mock('../../db/index.js', () => {
  function createChainableMock() {
    const thenFn = (resolve: (v: unknown) => void) => mockSelectResult().then(resolve)
    const make = (): Record<string, unknown> => {
      const proxy = new Proxy({} as Record<string, unknown>, {
        get(_target, prop: string) {
          if (prop === 'then') return thenFn
          return vi.fn().mockReturnValue(make())
        },
      })
      return proxy
    }
    return make()
  }

  const selectFn = vi.fn(() => createChainableMock())
  const insertFn = vi.fn(() => ({
    values: vi.fn((vals: Record<string, unknown>) => ({
      returning: () => mockInsertValues(vals),
    })),
  }))

  const dbMock = {
    select: selectFn,
    insert: insertFn,
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(
      async (cb: (tx: { select: typeof selectFn; insert: typeof insertFn }) => Promise<unknown>) =>
        cb({ select: selectFn, insert: insertFn }),
    ),
  }

  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

import { adminPointRoutes } from '../point.js'
import { MAX_POINT_OPERATION } from '../../db/point-queries.js'

const MEMBER_ID = '00000000-0000-0000-0000-000000000010'
const CHANNEL_ID = '00000000-0000-0000-0000-000000000020'
const POINT_ID = '00000000-0000-0000-0000-000000000030'
const RECORD_ID = '00000000-0000-0000-0000-000000000040'
const AUTH_HEADERS = { authorization: 'Bearer mock-admin-token' }

function mockAdmin() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: '00000000-0000-0000-0000-000000000001',
    roleId: 1,
    type: 'access',
  })
}

function makeChannel(code = 'sign') {
  return {
    id: CHANNEL_ID,
    name: '签到渠道',
    code,
    description: null,
    sort: 0,
    status: 1,
    createdAt: new Date(),
  }
}

function makePoint(pointValue = 10) {
  return {
    id: POINT_ID,
    name: '签到规则',
    code: 'signin',
    channelId: CHANNEL_ID,
    point: pointValue,
    description: null,
    sort: 0,
    status: 1,
    createdAt: new Date(),
  }
}

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: RECORD_ID,
    memberId: MEMBER_ID,
    point: 100,
    balance: 100,
    type: 'increase',
    description: 'test',
    refId: null,
    createdAt: new Date(),
    ...overrides,
  }
}

describe('point increase/decrease/fallback', () => {
  const server = Fastify({ logger: false })

  server.setErrorHandler((err, _req, reply) => {
    const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500
    const message = statusCode >= 500 ? '服务器错误' : (err as Error).message
    reply
      .status(statusCode >= 400 && statusCode < 600 ? statusCode : 500)
      .send({ code: statusCode, message })
  })

  beforeAll(async () => {
    await server.register(adminPointRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    mockAdmin()
    mockSelectResult.mockReset()
    mockInsertValues.mockReset()
    mockSelectResult.mockResolvedValue([])
    mockInsertValues.mockImplementation(async (vals: Record<string, unknown>) => [
      { id: 'rec-new', ...vals, createdAt: new Date() },
    ])
  })

  // 1. increase 正常流程(余额增加 + record 写入)
  it('POST /edu-points/increase 正常流程 — 余额增加 + record 写入', async () => {
    mockSelectResult
      .mockResolvedValueOnce([makeChannel('sign')]) // findChannelById
      .mockResolvedValueOnce([makePoint(10)]) // findPointById
      .mockResolvedValueOnce([{ balance: 0 }]) // readLatestBalance (in tx)

    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/edu-points/increase',
      headers: AUTH_HEADERS,
      body: {
        memberId: MEMBER_ID,
        channelId: CHANNEL_ID,
        pointId: POINT_ID,
        amount: 100,
        remark: '签到奖励',
      },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(0)
    expect(body.data.beforeBalance).toBe(0)
    expect(body.data.afterBalance).toBe(100)
    expect(body.data.record.point).toBe(100)
    expect(body.data.record.type).toBe('increase')
    expect(body.data.record.balance).toBe(100)
    expect(body.data.record.description).toBe('签到奖励')
  })

  // 2. decrease 正常流程(余额减少 + record 写入)
  it('POST /edu-points/decrease 正常流程 — 余额减少 + record 写入', async () => {
    mockSelectResult
      .mockResolvedValueOnce([makeChannel('order')]) // findChannelById
      .mockResolvedValueOnce([makePoint(50)]) // findPointById
      .mockResolvedValueOnce([{ balance: 200 }]) // readLatestBalance (in tx)

    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/edu-points/decrease',
      headers: AUTH_HEADERS,
      body: {
        memberId: MEMBER_ID,
        channelId: CHANNEL_ID,
        pointId: POINT_ID,
        amount: 50,
        remark: '兑换商品',
      },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(0)
    expect(body.data.beforeBalance).toBe(200)
    expect(body.data.afterBalance).toBe(150)
    expect(body.data.record.point).toBe(-50)
    expect(body.data.record.type).toBe('decrease')
    expect(body.data.record.balance).toBe(150)
  })

  // 3. decrease 余额不足(返回 400)
  it('POST /edu-points/decrease 余额不足 — 返回 400', async () => {
    mockSelectResult
      .mockResolvedValueOnce([makeChannel('sign')]) // findChannelById
      .mockResolvedValueOnce([makePoint(10)]) // findPointById
      .mockResolvedValueOnce([{ balance: 30 }]) // readLatestBalance (in tx)

    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/edu-points/decrease',
      headers: AUTH_HEADERS,
      body: { memberId: MEMBER_ID, channelId: CHANNEL_ID, pointId: POINT_ID, amount: 100 },
    })

    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(400)
    expect(body.message).toBe('积分余额不足')
  })

  // 4. 超阈值拦截(返回 400)
  it('POST /edu-points/increase 超阈值拦截 — 返回 400', async () => {
    mockSelectResult
      .mockResolvedValueOnce([makeChannel('sign')]) // findChannelById
      .mockResolvedValueOnce([makePoint(10)]) // findPointById

    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/edu-points/increase',
      headers: AUTH_HEADERS,
      body: {
        memberId: MEMBER_ID,
        channelId: CHANNEL_ID,
        pointId: POINT_ID,
        amount: MAX_POINT_OPERATION + 1,
      },
    })

    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(400)
    expect(body.message).toContain('单次操作不得超过')
  })

  // 5. fallback 正常流程(反向操作 + 原记录标记 via refId)
  it('POST /edu-points/fallback 正常流程 — 反向操作 + refId 指向原记录', async () => {
    const originalRecord = makeRecord({ point: 100, type: 'increase', balance: 100 })
    mockSelectResult
      .mockResolvedValueOnce([originalRecord]) // findRecordById
      .mockResolvedValueOnce([]) // hasRecordBeenReverted (空=未回退)
      .mockResolvedValueOnce([{ balance: 100 }]) // readLatestBalance (in tx)

    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/edu-points/fallback',
      headers: AUTH_HEADERS,
      body: { recordId: RECORD_ID, remark: '订单退款回退' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(0)
    expect(body.data.beforeBalance).toBe(100)
    expect(body.data.afterBalance).toBe(0)
    expect(body.data.record.point).toBe(-100)
    expect(body.data.record.type).toBe('fallback')
    expect(body.data.record.refId).toBe(RECORD_ID)
    expect(body.data.record.description).toBe('订单退款回退')
  })

  // 6. 幂等性(同一 recordId 重复 fallback 返回 409)
  it('POST /edu-points/fallback 幂等性 — 已回退的记录返回 409', async () => {
    const originalRecord = makeRecord({ point: 50, type: 'decrease', balance: 50 })
    mockSelectResult
      .mockResolvedValueOnce([originalRecord]) // findRecordById
      .mockResolvedValueOnce([{ id: 'existing-fallback-id' }]) // hasRecordBeenReverted (非空=已回退)

    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/edu-points/fallback',
      headers: AUTH_HEADERS,
      body: { recordId: RECORD_ID },
    })

    expect(res.statusCode).toBe(409)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(409)
    expect(body.message).toBe('该记录已被回退')
  })

  // 7. increase 渠道不存在(返回 404)
  it('POST /edu-points/increase 渠道不存在 — 返回 404', async () => {
    mockSelectResult.mockResolvedValueOnce([]) // findChannelById 返回空

    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/edu-points/increase',
      headers: AUTH_HEADERS,
      body: { memberId: MEMBER_ID, channelId: CHANNEL_ID, pointId: POINT_ID, amount: 10 },
    })

    expect(res.statusCode).toBe(404)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(404)
    expect(body.message).toBe('渠道不存在')
  })
})
