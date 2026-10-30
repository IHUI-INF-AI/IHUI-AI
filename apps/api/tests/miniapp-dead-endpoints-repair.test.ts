// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 小程序死端点补齐的行为锁:路由必须注册得出、身份只认令牌主体、读侧不外泄实名字段
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const DEV_ID = '22222222-2222-4222-8222-222222222222'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
  isFollowing: vi.fn(),
  findUserPreferences: vi.fn(),
  upsertUserPreference: vi.fn(),
  queue: { items: [] as unknown[][] },
}))

/** 链式队列夹具:跑真实 handler 与真实查询构造,不把投影 mock 掉自证(§22c) */
vi.mock('../src/db/index.js', () => {
  function chain(): Record<string, unknown> {
    const c: Record<string, unknown> = {
      then: (resolve: (v: unknown[]) => unknown) => {
        const r = mocks.queue.items.length > 0 ? mocks.queue.items.shift()! : []
        return Promise.resolve(r).then(resolve)
      },
    }
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'select']) c[m] = () => c
    return c
  }
  const dbMock = { execute: vi.fn().mockResolvedValue([]), select: () => chain() }
  return { db: dbMock, dbRead: dbMock }
})

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: async (request: { userId?: string }) => {
    request.userId = USER_ID
    return true
  },
  authenticate: async (request: { userId?: string }) => {
    request.userId = USER_ID
  },
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: mocks.requireAuth,
  requireAdmin: mocks.requireAdmin,
}))

vi.mock('../src/services/two-factor-step-up-store.js', () => ({
  requireStepUpForTwoFactorUser: vi.fn().mockResolvedValue(true),
}))

vi.mock('../src/db/social-queries.js', () => ({
  followUser: mocks.followUser,
  unfollowUser: mocks.unfollowUser,
  isFollowing: mocks.isFollowing,
}))

vi.mock('../src/db/user-preferences-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    findUserPreferences: mocks.findUserPreferences,
    upsertUserPreference: mocks.upsertUserPreference,
  }
})

import developerRoutes from '../src/routes/developer.js'
import { plazaRoutes } from '../src/routes/plaza.js'
import { distributionRoutes } from '../src/routes/distribution.js'

/** 建一个装着全部三条新腿的实例:注册表若撞车,Fastify 在 ready() 就抛 */
async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({ logger: false })
  mocks.requireAuth.mockImplementation(async (request: { userId?: string }) => {
    request.userId = USER_ID
  })
  await server.register(developerRoutes, { prefix: '/api/developer' })
  await server.register(plazaRoutes, { prefix: '/api/plaza' })
  await server.register(distributionRoutes, { prefix: '/api' })
  await server.ready()
  return server
}

/** 命中判定:Fastify 自己的路由缺失返回 "Route X not found",业务 404 不得混为一谈 */
async function assertRouted(
  server: FastifyInstance,
  method: 'GET' | 'POST',
  url: string,
  payload?: Record<string, unknown>,
) {
  const res = await server.inject({ method, url, payload })
  const message = (res.json() as { message?: string }).message ?? ''
  expect(message).not.toMatch(/not found$/i)
  return res
}

describe('八条新腿的注册面(同前缀共存不得撞路由表)', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = await buildServer()
  })
  afterAll(async () => {
    await server.close()
  })
  beforeEach(() => {
    mocks.queue.items = []
    mocks.findUserPreferences.mockReset().mockResolvedValue({ list: [], total: 0 })
    mocks.upsertUserPreference.mockReset().mockResolvedValue(undefined)
    mocks.followUser.mockReset().mockResolvedValue(undefined)
    mocks.unfollowUser.mockReset().mockResolvedValue(undefined)
    mocks.isFollowing.mockReset().mockResolvedValue(false)
  })

  const LEGS: Array<['GET' | 'POST', string]> = [
    ['GET', `/api/developer/${DEV_ID}/profile`],
    ['GET', `/api/developer/${DEV_ID}/agents`],
    ['GET', `/api/developer/${DEV_ID}/posts`],
    ['POST', `/api/developer/${DEV_ID}/subscribe`],
    ['POST', `/api/developer/${DEV_ID}/unsubscribe`],
    ['GET', '/api/plaza/need'],
    ['POST', '/api/plaza/need'],
    ['GET', '/api/operator/data-card'],
  ]
  it.each(LEGS)('%s %s 已在路由表里', async (method, url) => {
    await assertRouted(server, method, url, method === 'POST' ? {} : undefined)
  })
})

describe('POST/GET /api/plaza/need —— 需求偏好落 user_preferences', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = await buildServer()
  })
  afterAll(async () => {
    await server.close()
  })
  beforeEach(() => {
    mocks.queue.items = []
    mocks.findUserPreferences.mockReset().mockResolvedValue({ list: [], total: 0 })
    mocks.upsertUserPreference.mockReset().mockResolvedValue(undefined)
  })

  it('没有偏好行时返回空对象,不编造默认值', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/plaza/need' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({})
    expect(mocks.findUserPreferences).toHaveBeenCalledWith(USER_ID, 'plaza_need')
  })

  it('已有偏好按 JSON 还原', async () => {
    mocks.findUserPreferences.mockResolvedValue({
      list: [
        {
          id: 'p1',
          group: 'plaza_need',
          key: 'profile',
          value: JSON.stringify({ categories: ['writing'], level: '中级', budget: '1000+' }),
          updatedAt: new Date(),
        },
      ],
      total: 1,
    })
    const res = await server.inject({ method: 'GET', url: '/api/plaza/need' })
    expect(res.json().data).toEqual({ categories: ['writing'], level: '中级', budget: '1000+' })
  })

  it('坏 JSON 落空对象,不把解析异常抛给用户', async () => {
    mocks.findUserPreferences.mockResolvedValue({
      list: [
        {
          id: 'p1',
          group: 'plaza_need',
          key: 'profile',
          value: '{不是JSON',
          updatedAt: new Date(),
        },
      ],
      total: 1,
    })
    const res = await server.inject({ method: 'GET', url: '/api/plaza/need' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({})
  })

  it('写入走 plaza_need 分组的 profile 键,主体是令牌 userId 而非客户端自报', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/plaza/need',
      payload: { categories: ['coding'], level: '高级', budget: '5000+', userId: 'evil' },
    })
    expect(res.statusCode).toBe(200)
    expect(mocks.upsertUserPreference).toHaveBeenCalledWith(
      USER_ID,
      'plaza_need',
      'profile',
      JSON.stringify({ categories: ['coding'], level: '高级', budget: '5000+' }),
    )
  })

  it('超限条目 400,且不落库', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/plaza/need',
      payload: { categories: Array.from({ length: 21 }, (_, i) => `c${i}`) },
    })
    expect(res.statusCode).toBe(400)
    expect(mocks.upsertUserPreference).not.toHaveBeenCalled()
  })
})

describe('GET /api/operator/data-card —— 分销运营数据卡', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = await buildServer()
  })
  afterAll(async () => {
    await server.close()
  })

  it('verified 只认实名终态,统计三档逐键返回', async () => {
    mocks.queue.items = [
      [{ avatar: 'a.png', nickname: '张三', level: 2 }],
      [{ authStatus: 'approved' }],
      [
        {
          sumEarnings: '120.5',
          sumOrders: 7,
          dayEarnings: '10',
          dayOrders: 1,
          monthEarnings: '50',
          monthOrders: 3,
        },
      ],
      [{ sumInvites: 40, dayInvites: 2, monthInvites: 9 }],
    ]
    const res = await server.inject({ method: 'GET', url: '/api/operator/data-card' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({
      avatar: 'a.png',
      nickname: '张三',
      verified: true,
      stats: {
        dayEarnings: 10,
        dayOrders: 1,
        dayInvites: 2,
        monthEarnings: 50,
        monthOrders: 3,
        monthInvites: 9,
        sumEarnings: 120.5,
        sumOrders: 7,
        sumInvites: 40,
      },
    })
  })

  it('待审核不等于已认证', async () => {
    mocks.queue.items = [
      [{ avatar: null, nickname: null, level: 0 }],
      [{ authStatus: 'pending' }],
      [
        {
          sumEarnings: 0,
          sumOrders: 0,
          dayEarnings: 0,
          dayOrders: 0,
          monthEarnings: 0,
          monthOrders: 0,
        },
      ],
      [{ sumInvites: 0, dayInvites: 0, monthInvites: 0 }],
    ]
    const res = await server.inject({ method: 'GET', url: '/api/operator/data-card' })
    expect(res.json().data.verified).toBe(false)
  })
})

describe('开发者主页端点 —— 关注走 userFollows,读侧不外泄实名字段', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = await buildServer()
  })
  afterAll(async () => {
    await server.close()
  })
  beforeEach(() => {
    mocks.queue.items = []
    mocks.followUser.mockReset().mockResolvedValue(undefined)
    mocks.unfollowUser.mockReset().mockResolvedValue(undefined)
    mocks.isFollowing.mockReset().mockResolvedValue(false)
  })

  it('档案只出昵称/头像/简介与三个计数,响应里不存在 phone/realName/idCard', async () => {
    mocks.queue.items = [
      [{ id: DEV_ID, nickname: '开发者甲', avatar: 'x.png', bio: '做模型的' }],
      [{ count: 3 }],
      [{ count: 2, uses: 88 }],
    ]
    mocks.isFollowing.mockResolvedValue(true)
    const res = await server.inject({ method: 'GET', url: `/api/developer/${DEV_ID}/profile` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({
      id: DEV_ID,
      name: '开发者甲',
      avatar: 'x.png',
      bio: '做模型的',
      subscribed: true,
      subscribers: 3,
      modelCount: 2,
      totalUses: 88,
    })
    for (const leak of ['phone', 'realName', 'idCard']) {
      expect(res.json().data).not.toHaveProperty(leak)
    }
  })

  it('非 UUID 的开发者 ID 400,且不发起任何查询', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/developer/not-a-uuid/profile' })
    expect(res.statusCode).toBe(400)
    expect(mocks.queue.items).toHaveLength(0)
  })

  it('开发者不存在 404,不返回空壳档案', async () => {
    mocks.queue.items = [[]]
    const res = await server.inject({ method: 'GET', url: `/api/developer/${DEV_ID}/profile` })
    expect(res.statusCode).toBe(404)
  })

  it('关注自己的开发者被拒,且没有产生关注副作用', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/developer/${USER_ID}/subscribe`,
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    expect(mocks.followUser).not.toHaveBeenCalled()
  })

  it('关注他人以令牌主体为发起人,客户端自报的 userId 不参与主体选择', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/developer/${DEV_ID}/subscribe`,
      payload: { userId: 'evil-self-reported' },
    })
    expect(res.statusCode).toBe(201)
    expect(mocks.followUser).toHaveBeenCalledWith(USER_ID, DEV_ID)
  })

  it('取消关注同样只认令牌主体', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/developer/${DEV_ID}/unsubscribe`,
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    expect(mocks.unfollowUser).toHaveBeenCalledWith(USER_ID, DEV_ID)
  })

  it('模型列表为空时返回空数组而不是缺键', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/developer/${DEV_ID}/agents` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ list: [] })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
