// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D125 另批收口(2026-10-23)发言地板门控 —— chat.ts POST /messages 的接线契约
 * + 判据纯函数(readCollabLock / resolveFloorGate)全覆盖。设计稿 §6"同一时刻单写者"。
 *
 * 路由级最小验证的口径:门控发生在归属门与正文校验**之前**,所以
 *  - blocked ⇒ 409(属主也被挡 —— 这正是锁的意义);
 *  - floor-holder(本人持麦且非属主)⇒ 跳过归属门:请求停在正文 400 而不是归属 403;
 *  - 无锁 ⇒ 原语义逐字保留(外人 403 / 属主过门)。
 * 不把整条消息落库链路拖进 harness(createMessage 之后的路径由既有 chat 测试面守着)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'

// 照 chat.test.ts 先例:钉死 config,避免导入期 env 校验触发 process.exit(1)
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
    COZE_API_KEY: '',
  },
}))

const { authUserId, findConversationById } = vi.hoisted(() => ({
  authUserId: { value: 'owner-1' },
  findConversationById: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: FastifyRequest) => {
    request.userId = authUserId.value
  },
}))

// chat.ts 从 chat-queries 顶层 import 几十个函数:保留真实导出、只钉死归属读面。
vi.mock('../src/db/chat-queries.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, findConversationById }
})

import { chatRoutes } from '../src/routes/chat.js'
import { readCollabLock, resolveFloorGate } from '../src/db/chat-collab-write-queries.js'

const NOW_ISO = '2026-10-23T12:00:00.000Z'

function conversationWithLock(metadata: unknown) {
  findConversationById.mockResolvedValue({ id: 'conv-1', userId: 'owner-1', metadata })
}

beforeEach(async () => {
  vi.clearAllMocks()
  authUserId.value = 'owner-1'
  conversationWithLock({})
})

describe('路由接线:POST /conversations/:id/messages 地板门控', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = Fastify()
    app.register(chatRoutes, { prefix: '/api/chat' })
    await app.ready()
  })

  const post = () =>
    app.inject({
      method: 'POST',
      url: '/api/chat/conversations/conv-1/messages',
      payload: {},
    })

  it('他人持麦 ⇒ 409 点名持麦(属主本人也被挡在麦外)', async () => {
    conversationWithLock({ collabLock: { holderUserId: 'user-2', acquiredAt: NOW_ISO } })
    const res = await post()
    expect(res.statusCode).toBe(409)
    expect(res.json().message).toContain('持麦')
  })

  it('外人(user-3,非属主非持麦人)⇒ 同样 409,轮不到归属门的 403', async () => {
    authUserId.value = 'user-3'
    conversationWithLock({ collabLock: { holderUserId: 'user-2', acquiredAt: NOW_ISO } })
    const res = await post()
    expect(res.statusCode).toBe(409)
  })

  it('本人持麦且非属主 ⇒ 跳过归属门(停在正文 400,不是 403)', async () => {
    authUserId.value = 'user-2'
    conversationWithLock({ collabLock: { holderUserId: 'user-2', acquiredAt: NOW_ISO } })
    const res = await post()
    expect(res.statusCode).toBe(400)
  })

  it('无锁 ⇒ 原语义:属主过门(400 正文),外人 403', async () => {
    const owner = await post()
    expect(owner.statusCode).toBe(400)
    authUserId.value = 'user-9'
    const stranger = await post()
    expect(stranger.statusCode).toBe(403)
  })

  it('会话不存在 ⇒ 404(门控在归属读之后、正文校验之前)', async () => {
    findConversationById.mockResolvedValue(null)
    const res = await post()
    expect(res.statusCode).toBe(404)
  })

  it('属主自己持麦 ⇒ owner-default(走归属门,自己过 ⇒ 400 正文)', async () => {
    conversationWithLock({ collabLock: { holderUserId: 'owner-1', acquiredAt: NOW_ISO } })
    const res = await post()
    expect(res.statusCode).toBe(400)
  })
})

describe('判据纯函数:readCollabLock / resolveFloorGate', () => {
  it('readCollabLock:合法锁读出;脏值一律判"没锁"而不是"半把锁"', () => {
    expect(readCollabLock({ collabLock: { holderUserId: 'u1', acquiredAt: NOW_ISO } })).toEqual({
      holderUserId: 'u1',
      acquiredAt: NOW_ISO,
    })
    // 其它 metadata 键不受影响(只读一格)
    expect(
      readCollabLock({ foo: 1, collabLock: { holderUserId: 'u1', acquiredAt: NOW_ISO } }),
    ).toEqual({ holderUserId: 'u1', acquiredAt: NOW_ISO })
    expect(readCollabLock(null)).toBeNull()
    expect(readCollabLock(undefined)).toBeNull()
    expect(readCollabLock('string')).toBeNull()
    expect(readCollabLock([])).toBeNull()
    expect(readCollabLock({})).toBeNull()
    expect(readCollabLock({ collabLock: null })).toBeNull()
    expect(readCollabLock({ collabLock: 'x' })).toBeNull()
    // holder 空串 ⇒ 没锁(半把锁会把门控卡死在谁也持不了的键上)
    expect(readCollabLock({ collabLock: { holderUserId: '', acquiredAt: NOW_ISO } })).toBeNull()
    // acquiredAt 解析不出 ⇒ 没锁
    expect(
      readCollabLock({ collabLock: { holderUserId: 'u1', acquiredAt: 'not-a-date' } }),
    ).toBeNull()
  })

  it('resolveFloorGate:三态全覆盖(他人 blocked / 本人非属主 floor-holder / 其余 owner-default)', () => {
    const lock = { holderUserId: 'u2', acquiredAt: NOW_ISO }
    expect(resolveFloorGate({ lock, userId: 'u1', ownerId: 'u1' })).toBe('blocked')
    expect(resolveFloorGate({ lock, userId: 'u3', ownerId: 'u1' })).toBe('blocked')
    expect(resolveFloorGate({ lock, userId: 'u2', ownerId: 'u1' })).toBe('floor-holder')
    expect(resolveFloorGate({ lock, userId: 'u2', ownerId: 'u2' })).toBe('owner-default')
    expect(resolveFloorGate({ lock: null, userId: 'u1', ownerId: 'u1' })).toBe('owner-default')
    expect(resolveFloorGate({ lock: null, userId: 'u9', ownerId: 'u1' })).toBe('owner-default')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
