import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

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

const { mockVerifyAccessToken } = vi.hoisted(() => ({ mockVerifyAccessToken: vi.fn() }))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

// auth.ts 安全加固 getUserStatus 查询,status=1(active)避免 401
vi.mock('../../db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

// authenticate 内部 decodeJwt(token) 校验 challenge token,非 challenge 绕过
vi.mock('jose', () => ({ decodeJwt: vi.fn(() => ({ type: 'access' })) }))

// 路由层 mock point-queries,聚焦路由契约/信封/错误处理/幂等 409
const { mockHasClaimed, mockAward, mockBalance, mockChannels, mockPoints } = vi.hoisted(() => ({
  mockHasClaimed: vi.fn().mockResolvedValue(false),
  mockAward: vi.fn().mockResolvedValue({ beforeBalance: 0, afterBalance: 5 }),
  mockBalance: vi.fn().mockResolvedValue(5),
  mockChannels: vi.fn().mockResolvedValue([]),
  mockPoints: vi.fn().mockResolvedValue({ list: [], total: 0 }),
}))

vi.mock('../../db/point-queries.js', () => ({
  hasClaimedFirstShare: mockHasClaimed,
  awardFirstSharePoints: mockAward,
  findUserPointsBalance: mockBalance,
  findAllActiveChannels: mockChannels,
  findPoints: mockPoints,
}))

import { shareFirstRoutes } from '../share-first.js'

const MEMBER_ID = '00000000-0000-4000-8000-000000000010'
const AUTH_HEADERS = { authorization: 'Bearer mock-token' }

function mockAuth(): void {
  mockVerifyAccessToken.mockResolvedValue({
    userId: MEMBER_ID,
    roleId: 0,
    type: 'access',
  })
}

function makeAppError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode })
}

describe('share-first routes(首次分享领智汇值)', () => {
  const server = Fastify({ logger: false })

  // 对齐 point-increase-decrease.test.ts 的错误处理器:AppError statusCode → {code,message}
  server.setErrorHandler((err, _req, reply) => {
    const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500
    const message = statusCode >= 500 ? '服务器错误' : (err as Error).message
    reply
      .status(statusCode >= 400 && statusCode < 600 ? statusCode : 500)
      .send({ code: statusCode, message })
  })
  server.register(shareFirstRoutes)

  beforeAll(async () => {
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockHasClaimed.mockResolvedValue(false)
    mockAward.mockResolvedValue({ beforeBalance: 0, afterBalance: 5 })
    mockBalance.mockResolvedValue(5)
    mockChannels.mockResolvedValue([])
    mockPoints.mockResolvedValue({ list: [], total: 0 })
  })

  it('GET /share/first-status 未领取 → rewarded:false / canClaim:true / 默认奖励 5', async () => {
    mockAuth()
    mockHasClaimed.mockResolvedValue(false)
    mockChannels.mockResolvedValue([])
    const res = await server.inject({
      method: 'GET',
      url: '/share/first-status',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data).toEqual({ rewarded: false, rewardPoints: 5, canClaim: true })
  })

  it('GET /share/first-status 已领取 → rewarded:true / canClaim:false', async () => {
    mockAuth()
    mockHasClaimed.mockResolvedValue(true)
    mockChannels.mockResolvedValue([])
    const res = await server.inject({
      method: 'GET',
      url: '/share/first-status',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toEqual({ rewarded: true, rewardPoints: 5, canClaim: false })
  })

  it('GET /share/first-status 配置 share/first_share 渠道时奖励取渠道规则点值', async () => {
    mockAuth()
    mockHasClaimed.mockResolvedValue(false)
    mockChannels.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000020',
        name: '首次分享渠道',
        code: 'first_share',
        status: 1,
      },
    ])
    mockPoints.mockResolvedValue({ list: [{ point: 10 }], total: 1 })
    const res = await server.inject({
      method: 'GET',
      url: '/share/first-status',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.rewardPoints).toBe(10)
  })

  it('POST /share/first-claim 领取成功 → {points,balance}', async () => {
    mockAuth()
    mockAward.mockResolvedValue({ beforeBalance: 0, afterBalance: 5 })
    mockBalance.mockResolvedValue(5)
    const res = await server.inject({
      method: 'POST',
      url: '/share/first-claim',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data).toEqual({ points: 5, balance: 5 })
  })

  it('POST /share/first-claim 重复领取 → 409 幂等拒绝', async () => {
    mockAuth()
    mockAward.mockRejectedValue(makeAppError('已领取过首次分享奖励', 409))
    const res = await server.inject({
      method: 'POST',
      url: '/share/first-claim',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(409)
    const body = res.json()
    expect(body.code).toBe(409)
    expect(body.message).toBe('已领取过首次分享奖励')
  })

  it('未携带 token → 401 未认证', async () => {
    const res = await server.inject({ method: 'GET', url: '/share/first-status' })
    expect(res.statusCode).toBe(401)
  })
})
