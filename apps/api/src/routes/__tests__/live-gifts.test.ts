import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../../config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/test',
    REDIS_URL: 'redis://localhost:8811',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

const { mockVerifyAccessToken, mockSelectResult, mockInsertValues, mockExecute } = vi.hoisted(
  () => ({
    mockVerifyAccessToken: vi.fn(),
    mockSelectResult: vi.fn().mockResolvedValue([]),
    mockInsertValues: vi.fn().mockResolvedValue([]),
    mockExecute: vi.fn().mockResolvedValue([]),
  }),
)

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

vi.mock('../../db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
}))

vi.mock('../../db/index.js', () => {
  const make = () => {
    const thenFn = (resolve: (v: unknown) => void) => mockSelectResult().then(resolve)
    const proxy = new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') return thenFn
        return vi.fn().mockReturnValue(make())
      },
    })
    return proxy
  }

  const dbMock = {
    select: vi.fn(() => make()),
    insert: vi.fn(() => ({
      values: vi.fn((vals: Record<string, unknown>) => ({
        returning: () => mockInsertValues(vals),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    execute: mockExecute,
    transaction: vi.fn(async (cb: (tx: { select: unknown; insert: unknown }) => Promise<unknown>) =>
      cb({ select: dbMock.select, insert: dbMock.insert }),
    ),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

import { liveGiftsRoutes } from '../live-gifts.js'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const AUTH_HEADERS = { authorization: 'Bearer mock-admin-token' }

function mockLogin(roleId = 1) {
  mockVerifyAccessToken.mockResolvedValue({
    userId: USER_ID,
    roleId,
    type: 'access',
  })
}

function makeGift(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: '玫瑰',
    icon: null,
    price: '10',
    status: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeUser() {
  return { id: USER_ID, nickname: '测试用户' }
}

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    channelId: 0,
    userId: USER_ID,
    userName: '测试用户',
    giftId: 1,
    giftName: '玫瑰',
    giftCount: 2,
    totalPrice: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/** 把 drizzle sql 模板对象还原为 SQL 文本(便于断言). */
function sqlText(sqlObj: unknown): string {
  const obj = sqlObj as { queryChunks?: unknown[] }
  if (!obj?.queryChunks) return String(sqlObj)
  return obj.queryChunks
    .map((chunk) => {
      if (typeof chunk === 'string') return chunk
      const withValue = chunk as { value?: unknown[] }
      if (Array.isArray(withValue.value)) {
        return withValue.value.map((v) => (typeof v === 'string' ? v : '?')).join('')
      }
      return '?'
    })
    .join('')
}

describe('Live Gifts API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.setErrorHandler((err, _req, reply) => {
      const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500
      reply.status(statusCode).send({ code: statusCode, message: (err as Error).message })
    })
    await app.register(liveGiftsRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockLogin()
    mockSelectResult.mockReset()
    mockInsertValues.mockReset()
    mockExecute.mockReset()
    mockSelectResult.mockResolvedValue([])
    mockInsertValues.mockResolvedValue([])
    mockExecute.mockResolvedValue([])
  })

  describe('GET /api/live-gifts', () => {
    it('返回上架礼物列表(分页)', async () => {
      mockSelectResult.mockResolvedValueOnce([makeGift()]).mockResolvedValueOnce([{ count: 1 }])

      const res = await app.inject({
        method: 'GET',
        url: '/api/live-gifts?page=1&pageSize=20',
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data.items).toHaveLength(1)
      expect(body.data.total).toBe(1)
      expect(body.data.items[0].name).toBe('玫瑰')
      expect(body.data.items[0].price).toBe('10')
    })
  })

  describe('POST /api/live-gifts', () => {
    it('管理端新增礼物成功', async () => {
      mockInsertValues.mockResolvedValueOnce([makeGift({ id: 2, name: '火箭' })])

      const res = await app.inject({
        method: 'POST',
        url: '/api/live-gifts',
        headers: AUTH_HEADERS,
        payload: { name: '火箭', icon: 'rocket', price: 100, status: 1 },
      })

      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data.gift.name).toBe('火箭')
      expect(body.data.gift.price).toBe('10')
    })

    it('非管理员返回 403', async () => {
      mockLogin(0)
      const res = await app.inject({
        method: 'POST',
        url: '/api/live-gifts',
        headers: AUTH_HEADERS,
        payload: { name: '火箭', price: 100 },
      })
      expect(res.statusCode).toBe(403)
    })

    it('未登录返回 401', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('Authentication required'))
      const res = await app.inject({
        method: 'POST',
        url: '/api/live-gifts',
        payload: { name: '火箭', price: 100 },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('POST /api/live-gifts/:id/send', () => {
    it('打赏成功 — 扣减余额并写入记录', async () => {
      mockSelectResult
        .mockResolvedValueOnce([makeGift()]) // 礼物查询
        .mockResolvedValueOnce([makeUser()]) // 赠送人昵称
      mockExecute
        .mockResolvedValueOnce([{ balance: '100' }]) // 余额查询
        .mockResolvedValueOnce({ count: 1 }) // 扣减
      mockInsertValues.mockResolvedValueOnce([makeRecord()])

      const res = await app.inject({
        method: 'POST',
        url: '/api/live-gifts/1/send',
        headers: AUTH_HEADERS,
        payload: { quantity: 2 },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data.record.giftName).toBe('玫瑰')
      expect(body.data.record.giftCount).toBe(2)
      expect(body.data.record.totalPrice).toBe(20)
      expect(body.data.balanceAfter).toBe(80)

      // 验证执行了余额扣减 SQL
      const sqlCalls = mockExecute.mock.calls.map((c) => sqlText(c[0]))
      expect(sqlCalls.some((s) => s.includes('SELECT balance FROM user_token_balance'))).toBe(true)
      expect(
        sqlCalls.some((s) => s.includes('UPDATE user_token_balance') && s.includes('balance -')),
      ).toBe(true)
      // 验证写入了打赏记录
      expect(mockInsertValues).toHaveBeenCalledTimes(1)
      const inserted = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>
      expect(inserted.giftName).toBe('玫瑰')
      expect(inserted.totalPrice).toBe(20)
    })

    it('余额不足返回 400 且不扣款不写记录', async () => {
      mockSelectResult
        .mockResolvedValueOnce([makeGift()]) // 礼物查询
        .mockResolvedValueOnce([makeUser()]) // 赠送人昵称
      mockExecute.mockResolvedValueOnce([{ balance: '5' }]) // 余额 5 < 20

      const res = await app.inject({
        method: 'POST',
        url: '/api/live-gifts/1/send',
        headers: AUTH_HEADERS,
        payload: { quantity: 2 },
      })

      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(400)
      expect(body.message).toBe('余额不足')
      // 只执行了余额查询,未执行扣减,也未写记录
      expect(mockExecute).toHaveBeenCalledTimes(1)
      expect(mockInsertValues).not.toHaveBeenCalled()
    })

    it('礼物不存在或已下架返回 404', async () => {
      mockSelectResult.mockResolvedValueOnce([])

      const res = await app.inject({
        method: 'POST',
        url: '/api/live-gifts/999/send',
        headers: AUTH_HEADERS,
        payload: { quantity: 1 },
      })

      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.message).toBe('礼物不存在或已下架')
    })
  })

  describe('GET /api/live-gifts/records', () => {
    it('返回打赏记录列表(含赠送人昵称)', async () => {
      mockSelectResult
        .mockResolvedValueOnce([{ record: makeRecord(), senderName: '测试用户' }])
        .mockResolvedValueOnce([{ count: 1 }])

      const res = await app.inject({
        method: 'GET',
        url: '/api/live-gifts/records?page=1&pageSize=20',
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data.items).toHaveLength(1)
      expect(body.data.items[0].senderName).toBe('测试用户')
      expect(body.data.items[0].giftName).toBe('玫瑰')
    })
  })
})
