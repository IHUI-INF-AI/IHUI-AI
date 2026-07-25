import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'a'.repeat(32)
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
  process.env.NODE_ENV = 'test'
})

const { authenticateMock } = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
}))

// Mock ioredis:阻止 wsChat 插件 register 时创建真实 Redis subscriber 连接
vi.mock('ioredis', () => {
  const RedisStub = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    psubscribe: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn().mockResolvedValue({}),
    hset: vi.fn().mockResolvedValue(1),
    sadd: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    sismember: vi.fn().mockResolvedValue(0),
    lrange: vi.fn().mockResolvedValue([]),
    lpush: vi.fn().mockResolvedValue(1),
    ltrim: vi.fn().mockResolvedValue('OK'),
    lrem: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
  }))
  return { default: RedisStub }
})

vi.mock('../../plugins/auth.js', () => ({
  authenticate: authenticateMock,
}))

vi.mock('../../plugins/ws-helpers.js', () => ({
  wsAuth: vi.fn(async () => 'user-test-id'),
}))

vi.mock('../../plugins/ws-auto-recovery.js', () => ({
  getWsAutoRecoveryManager: vi.fn(() => ({
    setFastify: vi.fn(),
    registerPlugin: vi.fn(),
  })),
}))

vi.mock('../../utils/crypto-random.js', () => ({
  generateCompactId: vi.fn((prefix: string) => `${prefix}-test-1234567890abcdef`),
}))

import fastifyWebsocket from '@fastify/websocket'
import { wsChat } from '../ws-chat.js'

// HTTP 端点用的 mock Redis(装饰到 app.redis,供 wsChat 内 getRedis() 读取)
const mockRedis = {
  hgetall: vi.fn(),
  hset: vi.fn(),
  sadd: vi.fn(),
  smembers: vi.fn(),
  sismember: vi.fn(),
  lrange: vi.fn(),
  lpush: vi.fn(),
  ltrim: vi.fn(),
  lrem: vi.fn(),
  del: vi.fn(),
  srem: vi.fn(),
  publish: vi.fn(),
}

const USER_ID = 'user-test-id'
const TOKEN = 'Bearer fake-token'

describe('ws-chat IDOR 防护 - HTTP 端点鉴权', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(fastifyWebsocket)
    app.decorate('redis', mockRedis as never)
    await app.register(wsChat)
    await app.ready()
  })

  beforeEach(() => {
    authenticateMock.mockReset()
    // 默认 authenticate 行为:无 Authorization header 抛 401;有 Bearer token 注入 user-test-id + roleId=0
    authenticateMock.mockImplementation(async (request: unknown) => {
      const req = request as { headers: { authorization?: string }; userId?: string; jwtPayload?: unknown }
      const header = req.headers.authorization
      if (!header || !header.startsWith('Bearer ')) {
        const err = new Error('Authentication required') as Error & { statusCode: number }
        err.statusCode = 401
        throw err
      }
      req.userId = USER_ID
      req.jwtPayload = { roleId: 0, userId: USER_ID }
      return req.jwtPayload
    })
    mockRedis.hgetall.mockResolvedValue({})
    mockRedis.smembers.mockResolvedValue([])
    mockRedis.sismember.mockResolvedValue(0)
    mockRedis.lrange.mockResolvedValue([])
    mockRedis.hset.mockResolvedValue(1)
    mockRedis.sadd.mockResolvedValue(1)
    mockRedis.lrem.mockResolvedValue(1)
    mockRedis.del.mockResolvedValue(1)
    mockRedis.srem.mockResolvedValue(1)
    mockRedis.lpush.mockResolvedValue(1)
    mockRedis.ltrim.mockResolvedValue('OK')
    mockRedis.publish.mockResolvedValue(1)
  })

  afterAll(async () => {
    await app.close()
  })

  it('插件注册成功,不抛错', () => {
    expect(app).toBeDefined()
  })

  it('GET /chat-room/rooms 无 token 返回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/chat-room/rooms' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /chat-room/rooms 无 token 返回 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/chat-room/rooms',
      payload: { name: 'test' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /chat-room/users/:uuid/rooms 本人 uuid 与 token 一致时返回 200', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/chat-room/users/${USER_ID}/rooms`,
      headers: { authorization: TOKEN },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.items).toEqual([])
  })

  it('GET /chat-room/users/:uuid/rooms 非本人非 admin 返回 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/chat-room/users/other-user/rooms',
      headers: { authorization: TOKEN },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toBe('无权查看他人房间列表')
  })

  it('DELETE /chat-room/rooms/:roomId 非创建者返回 403', async () => {
    mockRedis.hgetall.mockResolvedValue({
      roomId: 'room-1',
      name: 'test',
      createdBy: 'other-user',
    })
    const res = await app.inject({
      method: 'DELETE',
      url: '/chat-room/rooms/room-1',
      headers: { authorization: TOKEN },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toBe('仅创建者可删除房间')
  })

  it('DELETE /chat-room/rooms/:roomId 房主返回 200', async () => {
    mockRedis.hgetall.mockResolvedValue({
      roomId: 'room-1',
      name: 'test',
      createdBy: USER_ID,
    })
    const res = await app.inject({
      method: 'DELETE',
      url: '/chat-room/rooms/room-1',
      headers: { authorization: TOKEN },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.deleted).toBe(true)
  })

  it('DELETE /chat-room/messages/:id 消息不存在返回 404', async () => {
    mockRedis.smembers.mockResolvedValue([])
    const res = await app.inject({
      method: 'DELETE',
      url: '/chat-room/messages/msg-nonexistent',
      headers: { authorization: TOKEN },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().message).toBe('消息不存在')
  })

  it('DELETE /chat-room/messages/:id 非作者非 admin 返回 403', async () => {
    mockRedis.smembers.mockResolvedValue(['room-1'])
    mockRedis.lrange.mockResolvedValue([
      JSON.stringify({ id: 'msg-1', from: 'other-user', text: 'hi' }),
    ])
    const res = await app.inject({
      method: 'DELETE',
      url: '/chat-room/messages/msg-1',
      headers: { authorization: TOKEN },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toBe('无权删除他人消息')
  })

  it('DELETE /chat-room/messages/:id 作者本人返回 200', async () => {
    mockRedis.smembers.mockResolvedValue(['room-1'])
    mockRedis.lrange.mockResolvedValue([
      JSON.stringify({ id: 'msg-1', from: USER_ID, text: 'hi' }),
    ])
    const res = await app.inject({
      method: 'DELETE',
      url: '/chat-room/messages/msg-1',
      headers: { authorization: TOKEN },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.deleted).toBe(true)
  })
})
