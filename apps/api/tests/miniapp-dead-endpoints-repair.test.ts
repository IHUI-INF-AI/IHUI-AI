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
  sanitizeUgcInput: vi.fn(),
  queue: { items: [] as unknown[][] },
  writes: [] as unknown[],
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
    for (const m of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'select',
      'insert',
      'update',
      'returning',
      'delete',
      'leftJoin',
      'innerJoin',
      'rightJoin',
    ])
      c[m] = () => c
    // 写侧参数必须落到夹具里,断言才拿得到"到底往库里写了谁"(§5 身份只认令牌主体)
    c.values = (payload: unknown) => {
      mocks.writes.push(payload)
      return c
    }
    c.set = (payload: unknown) => {
      mocks.writes.push(payload)
      return c
    }
    return c
  }
  const dbMock = {
    execute: vi.fn().mockResolvedValue([]),
    select: () => chain(),
    insert: () => chain(),
    update: () => chain(),
    delete: () => chain(),
  }
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

vi.mock('../src/db/sensitive-words-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    sanitizeUgcInput: mocks.sanitizeUgcInput,
  }
})

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
import asksRoutes from '../src/routes/community/asks.js'

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

describe('动态评论补齐腿(POST /circles/dynamic/comment、GET /circles/dynamic/comments)', () => {
  const DYN_ID = '33333333-3333-4333-8333-333333333333'
  let server: FastifyInstance

  beforeAll(async () => {
    server = Fastify({ logger: false })
    await server.register(asksRoutes, { prefix: '/api' })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })
  beforeEach(() => {
    mocks.queue.items = []
    mocks.writes.length = 0
    mocks.sanitizeUgcInput.mockReset().mockResolvedValue({
      ok: true,
      fields: { content: { ok: true, text: '写得真好', hits: [] } },
      hits: [],
    })
  })

  it('POST 与既有的 DELETE /circles/dynamic/comment 共用前缀不撞路由,两条都命中', async () => {
    mocks.queue.items = [[], []]
    const del = await server.inject({
      method: 'DELETE',
      url: `/api/circles/dynamic/comment?commentId=${DEV_ID}`,
    })
    expect((del.json() as { message?: string }).message ?? '').not.toMatch(/not found$/i)
    const post = await server.inject({
      method: 'POST',
      url: '/api/circles/dynamic/comment',
      payload: { dynamicId: DYN_ID, content: '写得真好' },
    })
    expect((post.json() as { message?: string }).message ?? '').not.toMatch(/not found$/i)
  })

  it('非 UUID 的 dynamicId ⇒ 400,且不发起任何查询', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/circles/dynamic/comment',
      payload: { dynamicId: 'not-a-uuid', content: '写得真好' },
    })
    expect(res.statusCode).toBe(400)
    expect(mocks.queue.items).toHaveLength(0)
    expect(mocks.sanitizeUgcInput).not.toHaveBeenCalled()
  })

  it('动态不存在 ⇒ 404,不做敏感词检查也不落库', async () => {
    mocks.queue.items = [[]]
    const res = await server.inject({
      method: 'POST',
      url: '/api/circles/dynamic/comment',
      payload: { dynamicId: DYN_ID, content: '写得真好' },
    })
    expect(res.statusCode).toBe(404)
    expect(mocks.sanitizeUgcInput).not.toHaveBeenCalled()
  })

  it('命中违规词 ⇒ 400 且不写入评论', async () => {
    mocks.queue.items = [[{ id: DYN_ID }]]
    mocks.sanitizeUgcInput.mockResolvedValue({
      ok: false,
      fields: { content: { ok: false, text: '', hits: [] } },
      hits: [{ word: '违规', level: 2, field: 'content' }],
    })
    const res = await server.inject({
      method: 'POST',
      url: '/api/circles/dynamic/comment',
      payload: { dynamicId: DYN_ID, content: '含违规词的内容' },
    })
    expect(res.statusCode, res.body).toBe(400)
    // 队列里"动态存在"那一条被消费后,不该再有第二次消费(即没走到 insert)
    expect(mocks.queue.items).toHaveLength(0)
    const res2 = await server.inject({
      method: 'GET',
      url: `/api/circles/dynamic/comments?dynamicId=${DYN_ID}`,
      payload: undefined,
    })
    expect(res2.statusCode).toBe(200)
  })

  it('发表成功 ⇒ 201,作者昵称头像由库侧 join 派生,时间是 ISO 串', async () => {
    const createdAt = new Date('2026-10-30T08:00:00.000Z')
    mocks.queue.items = [
      [{ id: DYN_ID }],
      [{ id: DEV_ID, userId: USER_ID, content: '写得真好', likeCount: 0, createdAt }],
      [],
      [{ nickname: '张三', avatar: 'a.png' }],
    ]
    const res = await server.inject({
      method: 'POST',
      url: '/api/circles/dynamic/comment',
      payload: { dynamicId: DYN_ID, content: '写得真好', userId: 'evil-self-reported' },
    })
    expect(res.statusCode, res.body).toBe(201)
    expect(res.json().data.comment).toEqual({
      id: DEV_ID,
      userId: USER_ID,
      nickname: '张三',
      avatar: 'a.png',
      content: '写得真好',
      createdAt: '2026-10-30T08:00:00.000Z',
      likes: 0,
    })
    // 敏感词检查用的就是消毒前的原文,落库用消毒后的 text
    expect(mocks.sanitizeUgcInput).toHaveBeenCalled()
    // 写侧真相:主体必须是令牌 userId(客户端自报的 'evil-self-reported' 不参与),内容必须是消毒后的文本
    const insert = mocks.writes.find(
      (w) => (w as { content?: string }).content !== undefined,
    ) as Record<string, unknown>
    expect(insert.userId).toBe(USER_ID)
    expect(insert.postId).toBe(DYN_ID)
    expect(insert.content).toBe('写得真好')
  })

  it('评论列表:昵称头像来自 join,空集回空数组而不是缺键', async () => {
    const createdAt = new Date('2026-10-30T09:00:00.000Z')
    mocks.queue.items = [
      [
        {
          id: DEV_ID,
          userId: USER_ID,
          nickname: '张三',
          avatar: null,
          content: '写得真好',
          createdAt,
          likes: 2,
        },
      ],
      [{ count: 1 }],
    ]
    const res = await server.inject({
      method: 'GET',
      url: `/api/circles/dynamic/comments?dynamicId=${DYN_ID}&page=1&pageSize=10`,
    })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.json().data).toEqual({
      list: [
        {
          id: DEV_ID,
          userId: USER_ID,
          nickname: '张三',
          avatar: undefined,
          content: '写得真好',
          createdAt: '2026-10-30T09:00:00.000Z',
          likes: 2,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    })
  })

  it('列表参数缺失 ⇒ 400,不退化成"全库评论"', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/circles/dynamic/comments' })
    expect(res.statusCode).toBe(400)
    expect(mocks.queue.items).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
