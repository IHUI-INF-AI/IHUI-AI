// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-211 回归:小程序消息房间端点必须按 roomId(对端用户)过滤。
 * 旧实现丢弃 roomId:history 返回本人全部会话、read 清空本人全部未读。
 * 行为断言:roomId=B 时不得出现与 C 的消息;read 只更新 B 会话的 1 条未读。
 */
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

vi.mock('../../config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://127.0.0.1:5399/test',
    REDIS_URL: 'redis://127.0.0.1:6399',
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
vi.mock('jose', () => ({ decodeJwt: vi.fn(() => ({ type: 'access' })) }))
vi.mock('../../db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

const { mockFindMessagesBetween, mockMarkMessagesReadWithPeer } = vi.hoisted(() => ({
  mockFindMessagesBetween: vi.fn(),
  mockMarkMessagesReadWithPeer: vi.fn(),
}))
vi.mock('../../db/notification-queries.js', () => ({
  findMessagesBetween: mockFindMessagesBetween,
  markMessagesReadWithPeer: mockMarkMessagesReadWithPeer,
}))

vi.mock('../../db/index.js', () => ({
  db: { insert: vi.fn(), delete: vi.fn(), select: vi.fn(), update: vi.fn(), execute: vi.fn() },
  dbRead: { select: vi.fn(), execute: vi.fn() },
}))

import { db, dbRead } from '../../db/index.js'
import { miniappCompatRoutes } from '../miniapp-compat-routes.js'

const MEMBER_ID = '00000000-0000-4000-8000-000000000010'
const PEER_B = '00000000-0000-4000-8000-0000000000bb'
const PEER_C = '00000000-0000-4000-8000-0000000000cc'
const AUTH_HEADERS = { authorization: 'Bearer mock-token' }

const MSG_A_B = {
  id: 'm-ab',
  senderId: MEMBER_ID,
  receiverId: PEER_B,
  content: 'A→B',
  isRead: true,
  createdAt: '2026-08-01T00:00:00Z',
}
const MSG_B_A = {
  id: 'm-ba',
  senderId: PEER_B,
  receiverId: MEMBER_ID,
  content: 'B→A',
  isRead: false,
  createdAt: '2026-08-01T00:01:00Z',
}
const MSG_A_C = {
  id: 'm-ac',
  senderId: MEMBER_ID,
  receiverId: PEER_C,
  content: 'A→C 其他会话',
  isRead: true,
  createdAt: '2026-08-01T00:02:00Z',
}
const ALL_MESSAGES = [MSG_A_B, MSG_A_C, MSG_B_A]

function mockReadChain(rows: Record<string, unknown>[]): void {
  const chain: Record<string, unknown> = {}
  chain.from = vi.fn(() => chain)
  chain.where = vi.fn(() => chain)
  chain.orderBy = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.offset = vi.fn(() => Promise.resolve(rows))
  vi.mocked(dbRead.select).mockReturnValue(chain as never)
}

function mockUpdateChain(rows: Record<string, unknown>[]): void {
  const chain: Record<string, unknown> = {}
  chain.set = vi.fn(() => chain)
  chain.where = vi.fn(() => chain)
  chain.returning = vi.fn(() => Promise.resolve(rows))
  vi.mocked(db.update).mockReturnValue(chain as never)
}

describe('F-211 /messages/rooms/:roomId 按对端过滤', () => {
  const server = Fastify({ logger: false })
  server.register(miniappCompatRoutes, { prefix: '/api' })

  beforeAll(async () => {
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyAccessToken.mockResolvedValue({ userId: MEMBER_ID, roleId: 0, type: 'access' })
  })

  it('history:roomId=B 只含 A↔B 消息,不得出现 A↔C 会话', async () => {
    mockReadChain(ALL_MESSAGES)
    mockFindMessagesBetween.mockResolvedValue({ list: [MSG_A_B, MSG_B_A], total: 2 })

    const res = await server.inject({
      method: 'GET',
      url: `/api/messages/rooms/${PEER_B}/history?page=1&pageSize=20`,
      headers: AUTH_HEADERS,
    })

    expect(res.statusCode).toBe(200)
    const data = res.json().data as { list: Array<{ id: string }> }
    expect(data.list.map((m) => m.id)).toEqual(['m-ab', 'm-ba'])
    expect(data.list.some((m) => m.id === 'm-ac')).toBe(false)
    expect(mockFindMessagesBetween).toHaveBeenCalledWith(MEMBER_ID, PEER_B, 1, 20)
  })

  it('read:roomId=B 只更新 B 会话未读,不再全量清空', async () => {
    mockUpdateChain(ALL_MESSAGES.filter((m) => m.isRead === false))
    mockMarkMessagesReadWithPeer.mockResolvedValue(1)

    const res = await server.inject({
      method: 'POST',
      url: `/api/messages/rooms/${PEER_B}/read`,
      headers: AUTH_HEADERS,
    })

    expect(res.statusCode).toBe(200)
    const data = res.json().data as { updated: number }
    expect(data.updated).toBe(1)
    expect(mockMarkMessagesReadWithPeer).toHaveBeenCalledWith(MEMBER_ID, PEER_B)
  })

  it('非法 roomId(非 UUID)直接 400,不退回全量查询', async () => {
    mockReadChain(ALL_MESSAGES)
    const res = await server.inject({
      method: 'GET',
      url: '/api/messages/rooms/not-a-uuid/history',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(400)
    expect(mockFindMessagesBetween).not.toHaveBeenCalled()
  })
})
