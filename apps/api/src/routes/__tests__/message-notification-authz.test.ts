// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const USER_A = 'user-a'
const USER_B = 'user-b'

const notificationRow = {
  id: 'notification-1',
  userId: USER_B,
  title: 'User B 的通知',
  content: 'secret-notification',
  read: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
}
const messageRow = {
  id: 'message-1',
  conversationId: 'conversation-b',
  role: 'user' as const,
  content: 'secret-message',
  createdAt: new Date('2026-01-01T00:00:00Z'),
}

const queries = vi.hoisted(() => ({
  findNotificationById: vi.fn(),
  findMessageById: vi.fn(),
}))
vi.mock('../../db/notification-queries.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  findNotificationById: queries.findNotificationById,
}))
vi.mock('../../db/chat-queries.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  findMessageById: queries.findMessageById,
}))
vi.mock('../../plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = USER_A
    return { userId: USER_A }
  }),
}))

import miscRoutes from '../user/misc-routes.js'

describe('F-154 私信/通知详情越权', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.addHook('onRequest', async (request) => {
      request.userId = USER_A
    })
    await app.register(miscRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    // 模拟数据库:未带 userId 的旧查询会返回记录;带 userId 时按归属过滤。
    queries.findNotificationById.mockReset()
    queries.findNotificationById.mockImplementation(async (id: string, userId?: string) => {
      if (id !== notificationRow.id) return undefined
      if (userId === undefined) return notificationRow
      return notificationRow.userId === userId ? notificationRow : undefined
    })
    queries.findMessageById.mockReset()
    queries.findMessageById.mockImplementation(async (id: string, userId?: string) => {
      if (id !== messageRow.id) return undefined
      if (userId === undefined) return messageRow
      return userId === USER_A ? undefined : messageRow
    })
  })

  it('用户 A 读取用户 B 的通知返回 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/notifications/notification-1' })
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain('secret-notification')
  })

  it('用户 A 读取用户 B 会话内的消息返回 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/messages/message-1' })
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain('secret-message')
  })

  it('查询层按当前用户返回时,本人可见', async () => {
    queries.findNotificationById.mockResolvedValue({ ...notificationRow, userId: USER_A })
    const notification = await app.inject({
      method: 'GET',
      url: '/api/notifications/notification-1',
    })
    expect(notification.statusCode).toBe(200)

    queries.findMessageById.mockResolvedValue(messageRow)
    const message = await app.inject({ method: 'GET', url: '/api/messages/message-1' })
    expect(message.statusCode).toBe(200)
  })
})
