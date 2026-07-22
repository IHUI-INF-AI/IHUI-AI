import { describe, it, expect, afterAll, beforeAll, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

vi.mock('../../config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8080,
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

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-token'),
  verifyAccessToken: vi.fn(),
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000002'),
}))

const { mockSelectResult, mockInsertValues, mockUpdateSet, mockUpdateWhere } = vi.hoisted(() => {
  const mockUpdateWhere = vi.fn().mockResolvedValue(undefined)
  const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
  return {
    mockSelectResult: vi.fn().mockResolvedValue([]),
    mockInsertValues: vi.fn().mockResolvedValue([]),
    mockUpdateSet,
    mockUpdateWhere,
  }
})

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
  const insertFn = vi.fn(() => ({ values: mockInsertValues }))
  const updateFn = vi.fn(() => ({ set: mockUpdateSet }))
  const dbMock = {
    select: selectFn,
    insert: insertFn,
    update: updateFn,
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(
      async (cb: (tx: { select: typeof selectFn; insert: typeof insertFn }) => Promise<unknown>) =>
        cb({ select: selectFn, insert: insertFn }),
    ),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

const { mockIncreasePoints } = vi.hoisted(() => ({
  mockIncreasePoints: vi.fn().mockResolvedValue({
    record: { id: 'rec-1' },
    beforeBalance: 0,
    afterBalance: 5,
  }),
}))
vi.mock('../../db/point-queries.js', () => ({
  increasePoints: mockIncreasePoints,
  decreasePoints: vi.fn(),
  fallbackPoints: vi.fn(),
  MAX_POINT_OPERATION: 10000,
}))

const { mockRecordWatch } = vi.hoisted(() => ({
  mockRecordWatch: vi.fn().mockResolvedValue({ id: 'watch-1', updated: false }),
}))
vi.mock('../../db/behavior-queries.js', () => ({
  recordWatch: mockRecordWatch,
}))

const { mockRedisSet } = vi.hoisted(() => ({
  mockRedisSet: vi.fn().mockResolvedValue('OK'),
}))

import searchAspectPlugin from '../../plugins/search-aspect.js'
import watchAspectPlugin from '../../plugins/watch-aspect.js'
import pointAspectPlugin from '../../plugins/point-aspect.js'

const mockRedisPlugin = fp(async (server: FastifyInstance) => {
  server.decorate('redis', {
    set: mockRedisSet,
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    quit: vi.fn(),
    on: vi.fn(),
  } as never)
  server.decorate('redisForQueue', {} as never)
}, { name: 'mock-redis', fastify: '5.x' })

const USER_ID = '00000000-0000-0000-0000-000000000001'
const RESOURCE_ID = '00000000-0000-0000-0000-000000000010'
const TARGET_USER_ID = '00000000-0000-0000-0000-000000000099'
const CHANNEL_ID = '00000000-0000-0000-0000-000000000020'
const POINT_ID = '00000000-0000-0000-0000-000000000030'

const testRoutes: FastifyPluginAsync = async (server) => {
  server.get('/api/search', async (_request, reply) => {
    return reply.send({ code: 0, message: 'success', data: { total: 0 } })
  })
  server.get('/api/resources/:id', async (request, reply) => {
    return reply.send({
      code: 0,
      message: 'success',
      data: { id: (request.params as { id: string }).id },
    })
  })
  server.get('/api/news/articles/:id', async (request, reply) => {
    return reply.send({
      code: 0,
      message: 'success',
      data: { id: (request.params as { id: string }).id },
    })
  })
  server.post('/api/follows/:userId', async (request, reply) => {
    request.userId = USER_ID
    return reply.code(201).send({ code: 0, message: 'success', data: { followed: true } })
  })
  server.post('/api/checkin', async (request, reply) => {
    request.userId = USER_ID
    return reply.send({ code: 0, message: 'success', data: { checkedIn: true } })
  })
  server.post('/api/fail', async (request, reply) => {
    request.userId = USER_ID
    return reply.status(400).send({ code: 400, message: 'bad request' })
  })
}

function flushMicrotasks(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('AOP aspects (search / watch / point)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(mockRedisPlugin)
    await server.register(searchAspectPlugin)
    await server.register(watchAspectPlugin)
    await server.register(pointAspectPlugin)
    await server.register(testRoutes)
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    mockSelectResult.mockClear()
    mockInsertValues.mockClear()
    mockUpdateSet.mockClear()
    mockUpdateWhere.mockClear()
    mockIncreasePoints.mockClear()
    mockRecordWatch.mockClear()
    mockRedisSet.mockClear()
    mockSelectResult.mockResolvedValue([])
    mockInsertValues.mockResolvedValue([])
    mockUpdateWhere.mockResolvedValue(undefined)
    mockRedisSet.mockResolvedValue('OK')
    mockIncreasePoints.mockResolvedValue({
      record: { id: 'rec-1' },
      beforeBalance: 0,
      afterBalance: 5,
    })
    mockRecordWatch.mockResolvedValue({ id: 'watch-1', updated: false })
  })

  // ===== search-aspect =====

  // 1. 搜索后 hot_words 表有记录
  it('搜索后 hot_words 表有记录(insert 被调用)', async () => {
    mockSelectResult.mockResolvedValue([]) // 关键词不存在
    const res = await server.inject({ method: 'GET', url: '/api/search?q=AI' })
    expect(res.statusCode).toBe(200)
    await vi.waitFor(() => expect(mockInsertValues).toHaveBeenCalledTimes(1))
    const inserted = mockInsertValues.mock.calls[0]![0] as Record<string, unknown>
    expect(inserted.word).toBe('AI')
    expect(inserted.sort).toBe(1)
  })

  // 2. 搜索同一关键词累加次数
  it('搜索同一关键词累加次数(update sort+1)', async () => {
    mockSelectResult.mockResolvedValue([{ id: 'hw-1', sort: 3 }]) // 已存在 sort=3
    const res = await server.inject({ method: 'GET', url: '/api/search?q=AI' })
    expect(res.statusCode).toBe(200)
    await vi.waitFor(() => expect(mockUpdateSet).toHaveBeenCalledTimes(1))
    expect(mockInsertValues).not.toHaveBeenCalled()
    const setArg = mockUpdateSet.mock.calls[0]![0] as Record<string, unknown>
    expect(setArg.sort).toBe(4) // 3 + 1
  })

  // ===== watch-aspect =====

  // 3. 浏览资源 viewCount 自增
  it('浏览资源 viewCount 自增(update.set 被调用)', async () => {
    mockRedisSet.mockResolvedValue('OK') // 首次浏览,去重通过
    const res = await server.inject({
      method: 'GET',
      url: `/api/resources/${RESOURCE_ID}`,
    })
    expect(res.statusCode).toBe(200)
    expect(mockUpdateSet).toHaveBeenCalledTimes(1)
  })

  // 4. 同一 IP 5 分钟内重复浏览 Redis 去重
  it('同一 IP 5 分钟内重复浏览 Redis 去重(viewCount 不重复自增)', async () => {
    mockRedisSet
      .mockResolvedValueOnce('OK') // 第 1 次:去重通过
      .mockResolvedValueOnce(null) // 第 2 次:去重失败(已存在)

    const res1 = await server.inject({
      method: 'GET',
      url: `/api/resources/${RESOURCE_ID}`,
    })
    const res2 = await server.inject({
      method: 'GET',
      url: `/api/resources/${RESOURCE_ID}`,
    })
    expect(res1.statusCode).toBe(200)
    expect(res2.statusCode).toBe(200)
    expect(mockUpdateSet).toHaveBeenCalledTimes(1) // 只计 1 次
  })

  // 5. Redis 不可用时降级(每次都计数)
  it('Redis 不可用时降级(每次都计数)', async () => {
    mockRedisSet
      .mockRejectedValueOnce(new Error('redis down'))
      .mockRejectedValueOnce(new Error('redis down'))

    const res1 = await server.inject({
      method: 'GET',
      url: `/api/resources/${RESOURCE_ID}`,
    })
    const res2 = await server.inject({
      method: 'GET',
      url: `/api/resources/${RESOURCE_ID}`,
    })
    expect(res1.statusCode).toBe(200)
    expect(res2.statusCode).toBe(200)
    expect(mockUpdateSet).toHaveBeenCalledTimes(2) // 降级:每次都计
  })

  // ===== point-aspect =====

  // 6. 关注成功后积分增加 +5
  it('关注成功后积分增加 +5', async () => {
    mockSelectResult
      .mockResolvedValueOnce([{ id: CHANNEL_ID }]) // resolveRule: channel
      .mockResolvedValueOnce([{ id: POINT_ID }]) // resolveRule: point

    const res = await server.inject({
      method: 'POST',
      url: `/api/follows/${TARGET_USER_ID}`,
    })
    expect(res.statusCode).toBe(201)

    await vi.waitFor(() => expect(mockIncreasePoints).toHaveBeenCalledTimes(1))
    const callArg = mockIncreasePoints.mock.calls[0]![0] as Record<string, unknown>
    expect(callArg.memberId).toBe(USER_ID)
    expect(callArg.channelId).toBe(CHANNEL_ID)
    expect(callArg.pointId).toBe(POINT_ID)
    expect(callArg.amount).toBe(5)
    expect(callArg.remark).toBe('关注奖励')
  })

  // 7. 钩子失败不阻塞主请求(返回 200)
  it('钩子失败不阻塞主请求(watch-aspect update 报错时返回 200)', async () => {
    mockRedisSet.mockResolvedValue('OK')
    mockUpdateSet.mockImplementationOnce(() => {
      throw new Error('db update failed')
    })
    const res = await server.inject({
      method: 'GET',
      url: `/api/resources/${RESOURCE_ID}`,
    })
    expect(res.statusCode).toBe(200)
  })

  // 8. 响应非 200/201 时不触发积分
  it('响应非 200/201 时不触发积分奖励', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/fail',
    })
    expect(res.statusCode).toBe(400)
    await flushMicrotasks()
    expect(mockIncreasePoints).not.toHaveBeenCalled()
  })
})
