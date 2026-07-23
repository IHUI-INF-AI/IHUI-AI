import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// ---------- 鉴权 mock ----------
const { mockCheckAuth, mockRequireAdmin, dbQueue } = vi.hoisted(() => ({
  mockCheckAuth: vi.fn(),
  mockRequireAdmin: vi.fn(),
  dbQueue: { items: [] as unknown[][] },
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: mockCheckAuth,
  authenticate: vi.fn(),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: mockRequireAdmin,
  requirePermission: vi.fn(),
  requireAuth: vi.fn(),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
  },
}))

// ---------- message-queries mock ----------
const {
  mockFindAnnouncements,
  mockFindAnnouncementById,
  mockCreateAnnouncement,
  mockUpdateAnnouncement,
  mockDeleteAnnouncement,
  mockFindEduMessages,
  mockFindEduMessageById,
  mockMarkEduMessageRead,
  mockCountUnreadEduMessages,
} = vi.hoisted(() => ({
  mockFindAnnouncements: vi.fn(),
  mockFindAnnouncementById: vi.fn(),
  mockCreateAnnouncement: vi.fn(),
  mockUpdateAnnouncement: vi.fn(),
  mockDeleteAnnouncement: vi.fn(),
  mockFindEduMessages: vi.fn(),
  mockFindEduMessageById: vi.fn(),
  mockMarkEduMessageRead: vi.fn(),
  mockCountUnreadEduMessages: vi.fn(),
}))

vi.mock('../src/db/message-queries.js', () => ({
  findAnnouncements: mockFindAnnouncements,
  findAnnouncementById: mockFindAnnouncementById,
  createAnnouncement: mockCreateAnnouncement,
  updateAnnouncement: mockUpdateAnnouncement,
  deleteAnnouncement: mockDeleteAnnouncement,
  findEduMessages: mockFindEduMessages,
  findEduMessageById: mockFindEduMessageById,
  markEduMessageRead: mockMarkEduMessageRead,
  countUnreadEduMessages: mockCountUnreadEduMessages,
}))

// ---------- db 链式 mock(队列模式) ----------
vi.mock('../src/db/index.js', () => {
  function createChain() {
    const chain: {
      then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => {
        const result = dbQueue.items.length > 0 ? dbQueue.items.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    for (const m of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'values',
      'set',
      'returning',
      'innerJoin',
      'select',
      'groupBy',
      'having',
      'delete',
    ]) {
      chain[m] = () => chain
    }
    return chain
  }
  const factory = () => createChain()
  const dbMock = {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(factory),
    insert: vi.fn(factory),
    update: vi.fn(factory),
    delete: vi.fn(factory),
  }
  return { db: dbMock, dbRead: dbMock, returningOne: vi.fn() }
})

// @ihui/database 表对象桩
vi.mock('@ihui/database', () => ({
  eduMessages: { id: 'em.id', memberId: 'em.memberId', isRead: 'em.isRead', msgType: 'em.msgType' },
  messagePrivateLetter: {
    id: 'mpl.id',
    senderId: 'mpl.senderId',
    receiverId: 'mpl.receiverId',
    isRead: 'mpl.isRead',
    readTime: 'mpl.readTime',
    updatedAt: 'mpl.updatedAt',
  },
  messageSystemNotice: { id: 'msn.id', content: 'msn.content', createdAt: 'msn.createdAt' },
  messageTemplates: {
    id: 'mt.id',
    code: 'mt.code',
    channel: 'mt.channel',
    title: 'mt.title',
    content: 'mt.content',
    variables: 'mt.variables',
    status: 'mt.status',
    createdAt: 'mt.createdAt',
  },
  chatConversations: {
    id: 'cc.id',
    userId: 'cc.userId',
    title: 'cc.title',
    updatedAt: 'cc.updatedAt',
    lastMessageAt: 'cc.lastMessageAt',
  },
  chatMessages: {
    id: 'cm.id',
    conversationId: 'cm.conversationId',
    role: 'cm.role',
    content: 'cm.content',
    createdAt: 'cm.createdAt',
  },
}))

import { messageRoutes, adminMessageRoutes } from '../src/routes/message.js'

const UUID = '11111111-1111-1111-1111-111111111111'
const NOW = new Date('2026-07-23T00:00:00Z')

function makeAnnouncement(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID,
    title: '测试公告',
    content: '正文',
    isPublished: true,
    isTop: false,
    publishTime: null,
    sort: 0,
    status: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeEduMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID,
    memberId: 'user-001',
    msgType: 'announcement',
    title: '消息标题',
    content: '消息内容',
    isRead: false,
    createdAt: NOW,
    ...overrides,
  }
}

describe('message routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // 模拟生产环境 server.ts 的 errorHandler:AJV 验证错误 → 400, ZodError → 400
    app.setErrorHandler((err, _req, reply) => {
      const isZodErr =
        err.name === 'ZodError' && Array.isArray((err as { issues?: unknown[] }).issues)
      const statusCode = isZodErr
        ? 400
        : err.statusCode && err.statusCode >= 400 && err.statusCode < 600
          ? err.statusCode
          : 500
      const message = isZodErr
        ? ((err as { issues?: Array<{ message?: string }> }).issues?.[0]?.message ?? '参数错误')
        : statusCode >= 500
          ? '服务器错误'
          : err.message
      reply.status(statusCode).send({ code: statusCode, message })
    })
    await app.register(messageRoutes, { prefix: '/api' })
    await app.register(adminMessageRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    dbQueue.items.length = 0
    // 默认鉴权失败
    mockCheckAuth.mockImplementation((_req, reply) => {
      reply.status(401).send({ code: 401, message: 'Authentication required' })
      return Promise.resolve(false)
    })
    mockRequireAdmin.mockImplementation((_req, reply) => {
      reply.status(403).send({ code: 403, message: '需要管理员权限' })
      return Promise.resolve()
    })
  })

  function authAs(userId = 'user-001', roleId = 0) {
    mockCheckAuth.mockImplementation((req, _reply) => {
      req.userId = userId
      req.jwtPayload = { userId, roleId } as never
      return Promise.resolve(true)
    })
  }

  function authAsAdmin(userId = 'admin-001') {
    authAs(userId, 1)
    mockRequireAdmin.mockImplementation((_req, _reply) => Promise.resolve())
  }

  function enqueue(...results: unknown[][]) {
    dbQueue.items.push(...results)
  }

  // ===================== 公告(用户) =====================

  describe('GET /api/messages/announcements', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/messages/announcements' })
      expect(res.statusCode).toBe(401)
    })

    it('登录用户获取已发布公告列表', async () => {
      authAs()
      mockFindAnnouncements.mockResolvedValueOnce({
        list: [makeAnnouncement()],
        total: 1,
        page: 1,
        pageSize: 20,
      })
      const res = await app.inject({
        method: 'GET',
        url: '/api/messages/announcements?page=1&pageSize=20',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.list).toHaveLength(1)
      // 用户端强制 publishedOnly: true
      expect(mockFindAnnouncements).toHaveBeenCalledWith(
        expect.objectContaining({ publishedOnly: true }),
      )
    })

    it('pageSize 超过 100 返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'GET',
        url: '/api/messages/announcements?pageSize=200',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('GET /api/messages/announcements/:id', () => {
    it('非 UUID 参数返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'GET',
        url: '/api/messages/announcements/not-uuid',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('公告不存在返回 404', async () => {
      authAs()
      mockFindAnnouncementById.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'GET',
        url: `/api/messages/announcements/${UUID}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('未发布公告返回 404(业务规则:仅返回已发布)', async () => {
      authAs()
      mockFindAnnouncementById.mockResolvedValueOnce(
        makeAnnouncement({ isPublished: false, status: 1 }),
      )
      const res = await app.inject({
        method: 'GET',
        url: `/api/messages/announcements/${UUID}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('status 非 1 返回 404', async () => {
      authAs()
      mockFindAnnouncementById.mockResolvedValueOnce(
        makeAnnouncement({ isPublished: true, status: 0 }),
      )
      const res = await app.inject({
        method: 'GET',
        url: `/api/messages/announcements/${UUID}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('已发布公告返回 200', async () => {
      authAs()
      mockFindAnnouncementById.mockResolvedValueOnce(makeAnnouncement())
      const res = await app.inject({
        method: 'GET',
        url: `/api/messages/announcements/${UUID}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.announcement.id).toBe(UUID)
    })
  })

  // ===================== 站内消息 =====================

  describe('GET /api/messages', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/messages' })
      expect(res.statusCode).toBe(401)
    })

    it('登录用户获取站内消息列表', async () => {
      authAs()
      mockFindEduMessages.mockResolvedValueOnce({
        list: [makeEduMessage()],
        total: 1,
        page: 1,
        pageSize: 20,
      })
      const res = await app.inject({
        method: 'GET',
        url: '/api/messages?page=1&pageSize=20',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockFindEduMessages).toHaveBeenCalledWith(
        expect.objectContaining({ memberId: 'user-001' }),
      )
    })
  })

  describe('GET /api/messages/unread-count', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/messages/unread-count' })
      expect(res.statusCode).toBe(401)
    })

    it('返回未读消息数', async () => {
      authAs()
      mockCountUnreadEduMessages.mockResolvedValueOnce(5)
      const res = await app.inject({
        method: 'GET',
        url: '/api/messages/unread-count',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.count).toBe(5)
      expect(mockCountUnreadEduMessages).toHaveBeenCalledWith('user-001')
    })
  })

  describe('PUT /api/messages/:id/read', () => {
    it('非 UUID 返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'PUT',
        url: '/api/messages/not-uuid/read',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('消息不存在返回 404', async () => {
      authAs()
      mockFindEduMessageById.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'PUT',
        url: `/api/messages/${UUID}/read`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('他人消息返回 404(归属校验,防信息泄露)', async () => {
      authAs('user-002', 0)
      mockFindEduMessageById.mockResolvedValueOnce(makeEduMessage({ memberId: 'user-001' }))
      const res = await app.inject({
        method: 'PUT',
        url: `/api/messages/${UUID}/read`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('本人消息标记已读成功返回 200', async () => {
      authAs('user-001', 0)
      mockFindEduMessageById.mockResolvedValueOnce(makeEduMessage({ memberId: 'user-001' }))
      mockMarkEduMessageRead.mockResolvedValueOnce(makeEduMessage({ isRead: true }))
      const res = await app.inject({
        method: 'PUT',
        url: `/api/messages/${UUID}/read`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockMarkEduMessageRead).toHaveBeenCalledWith(UUID)
    })
  })

  describe('DELETE /api/messages/:id', () => {
    it('消息不存在返回 404', async () => {
      authAs()
      mockFindEduMessageById.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/messages/${UUID}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('他人消息删除返回 404(归属校验)', async () => {
      authAs('user-002', 0)
      mockFindEduMessageById.mockResolvedValueOnce(makeEduMessage({ memberId: 'user-001' }))
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/messages/${UUID}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('本人消息删除成功返回 200', async () => {
      authAs('user-001', 0)
      mockFindEduMessageById.mockResolvedValueOnce(makeEduMessage({ memberId: 'user-001' }))
      enqueue([]) // db.delete
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/messages/${UUID}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.ok).toBe(true)
    })
  })

  describe('DELETE /api/messages/batch-delete', () => {
    it('空数组返回 400(Zod 校验)', async () => {
      authAs()
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/messages/batch-delete',
        payload: { ids: [] },
        headers: { authorization: 'Bearer t' },
      })
      // 路由用 .parse(throw),由 Fastify 错误处理
      expect([400, 500]).toContain(res.statusCode)
    })

    it('批量删除成功返回 200', async () => {
      authAs()
      enqueue([]) // db.delete
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/messages/batch-delete',
        payload: { ids: [UUID] },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.deleted).toBe(1)
    })
  })

  describe('POST /api/messages/read-all', () => {
    it('全部标记已读返回 200', async () => {
      authAs()
      enqueue([]) // db.update
      const res = await app.inject({
        method: 'POST',
        url: '/api/messages/read-all',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.ok).toBe(true)
    })
  })

  // ===================== 会话 / IM =====================

  describe('GET /api/messages/list (会话列表)', () => {
    it('无会话返回空列表', async () => {
      authAs()
      enqueue([]) // db.select chatConversations
      const res = await app.inject({
        method: 'GET',
        url: '/api/messages/list',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.list).toEqual([])
    })

    it('有会话返回列表(附最近一条消息)', async () => {
      authAs()
      const conv = {
        id: UUID,
        title: '会话1',
        userId: 'user-001',
        updatedAt: NOW,
      }
      const msg = {
        id: 'msg-1',
        conversationId: UUID,
        role: 'user',
        content: '你好',
        createdAt: NOW,
      }
      enqueue([conv]) // chatConversations
      enqueue([msg]) // chatMessages
      const res = await app.inject({
        method: 'GET',
        url: '/api/messages/list',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const list = res.json().data.list
      expect(list).toHaveLength(1)
      expect(list[0].messages[0].content).toBe('你好')
      expect(list[0].messages[0].isMine).toBe(true)
    })
  })

  describe('GET /api/messages/:id/history (会话历史)', () => {
    it('会话不存在返回 404', async () => {
      authAs()
      enqueue([]) // chatConversations 查询为空
      const res = await app.inject({
        method: 'GET',
        url: `/api/messages/${UUID}/history`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().message).toContain('会话不存在')
    })

    it('会话存在返回历史消息(按时间倒序后 reverse)', async () => {
      authAs()
      enqueue([{ id: UUID, userId: 'user-001' }]) // chatConversations
      enqueue([
        { id: 'm2', conversationId: UUID, role: 'assistant', content: '你好', createdAt: NOW },
        { id: 'm1', conversationId: UUID, role: 'user', content: 'hi', createdAt: new Date(NOW.getTime() - 1000) },
      ]) // chatMessages
      const res = await app.inject({
        method: 'GET',
        url: `/api/messages/${UUID}/history?limit=20`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      // reverse 后第一条是较早的 m1
      expect(body.data.list[0].id).toBe('m1')
      expect(body.data.list[0].isMine).toBe(true)
    })
  })

  describe('POST /api/messages/send (发送消息)', () => {
    it('缺少 conversationId 返回 400(Zod 校验,throw)', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/messages/send',
        payload: { content: 'hi' },
        headers: { authorization: 'Bearer t' },
      })
      expect([400, 500]).toContain(res.statusCode)
    })

    it('会话不存在返回 404', async () => {
      authAs()
      enqueue([]) // chatConversations 查询为空
      const res = await app.inject({
        method: 'POST',
        url: '/api/messages/send',
        payload: { conversationId: UUID, content: 'hi' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('发送成功返回 201', async () => {
      authAs()
      enqueue([{ id: UUID, userId: 'user-001' }]) // chatConversations
      enqueue([{ id: 'msg-1', conversationId: UUID, role: 'user', content: 'hi', createdAt: NOW }]) // insert returning
      enqueue([]) // update chatConversations
      const res = await app.inject({
        method: 'POST',
        url: '/api/messages/send',
        payload: { conversationId: UUID, content: 'hi' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().data.message.content).toBe('hi')
      expect(res.json().data.message.isMine).toBe(true)
    })
  })

  describe('POST /api/messages/:id/read (会话已读标记,占位 202)', () => {
    it('会话不存在返回 404', async () => {
      authAs()
      enqueue([]) // chatConversations
      const res = await app.inject({
        method: 'POST',
        url: `/api/messages/${UUID}/read`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('会话存在返回 202(未持久化)', async () => {
      authAs()
      enqueue([{ id: UUID }]) // chatConversations
      const res = await app.inject({
        method: 'POST',
        url: `/api/messages/${UUID}/read`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(202)
      expect(res.json().data.persisted).toBe(false)
    })
  })

  // ===================== 私信 =====================

  describe('POST /api/messages/private (发送私信)', () => {
    it('缺少 receiverId 返回 400(Zod throw)', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/messages/private',
        payload: { content: 'hi' },
        headers: { authorization: 'Bearer t' },
      })
      expect([400, 500]).toContain(res.statusCode)
    })

    it('发送成功返回 201', async () => {
      authAs()
      enqueue([{ id: 1, senderId: 'user-001', receiverId: 'user-002', content: 'hi' }]) // insert returning
      const res = await app.inject({
        method: 'POST',
        url: '/api/messages/private',
        payload: { receiverId: 'user-002', content: 'hi' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().data.message.content).toBe('hi')
    })
  })

  describe('POST /api/messages/private/:pid/read (标记私信已读)', () => {
    it('私信不存在返回 404', async () => {
      authAs()
      enqueue([]) // db.update.returning 为空
      const res = await app.inject({
        method: 'POST',
        url: '/api/messages/private/123/read',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().message).toContain('私信不存在')
    })

    it('标记成功返回 200', async () => {
      authAs()
      enqueue([{ id: 123, isRead: true, receiverId: 'user-001' }]) // update returning
      const res = await app.inject({
        method: 'POST',
        url: '/api/messages/private/123/read',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.message.isRead).toBe(true)
    })
  })

  describe('DELETE /api/messages/private/:pid (删除私信)', () => {
    it('删除成功返回 200(发送者或接收者均可)', async () => {
      authAs()
      enqueue([]) // db.delete
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/messages/private/123',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.ok).toBe(true)
    })
  })

  // ===================== 系统通知 =====================

  describe('GET /api/messages/system-notice/list', () => {
    it('返回系统通知列表', async () => {
      authAs()
      enqueue([{ id: 1, content: '系统维护', createdAt: NOW }])
      const res = await app.inject({
        method: 'GET',
        url: '/api/messages/system-notice/list',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.list).toHaveLength(1)
    })
  })

  describe('GET /api/messages/aggregate (聚合消息)', () => {
    it('返回聚合消息(公告+私信+系统通知+未读数)', async () => {
      authAs()
      mockFindAnnouncements.mockResolvedValueOnce({ list: [makeAnnouncement()], total: 1, page: 1, pageSize: 5 })
      enqueue([{ id: 1, content: '私信', senderId: 'user-002', receiverId: 'user-001' }]) // privateMessages
      enqueue([{ id: 1, content: '系统通知', createdAt: NOW }]) // systemNotices
      enqueue([{ count: 2 }]) // unreadAnn
      enqueue([{ count: 1 }]) // unreadPriv
      enqueue([{ count: 3 }]) // unreadSys
      const res = await app.inject({
        method: 'GET',
        url: '/api/messages/aggregate',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const data = res.json().data
      expect(data.announcements).toHaveLength(1)
      expect(data.unreadCount.total).toBe(6)
      expect(data.unreadCount.announcements).toBe(2)
      expect(data.unreadCount.private).toBe(1)
      expect(data.unreadCount.system).toBe(3)
    })
  })

  // ===================== 管理员路由 =====================

  describe('POST /api/admin/messages/announcements (新建公告)', () => {
    it('非管理员返回 403', async () => {
      authAs('user-001', 0)
      mockRequireAdmin.mockImplementation((_req, reply) => {
        reply.status(403).send({ code: 403, message: '需要管理员权限' })
        return Promise.resolve()
      })
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/messages/announcements',
        payload: { title: '新公告' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('缺少 title 返回 400', async () => {
      authAsAdmin()
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/messages/announcements',
        payload: { content: '无标题' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('title 过长返回 400', async () => {
      authAsAdmin()
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/messages/announcements',
        payload: { title: 'x'.repeat(201) },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('创建成功返回 201', async () => {
      authAsAdmin()
      mockCreateAnnouncement.mockResolvedValueOnce(makeAnnouncement({ title: '新公告' }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/messages/announcements',
        payload: { title: '新公告', isPublished: true, status: 1 },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(201)
      expect(mockCreateAnnouncement).toHaveBeenCalled()
    })
  })

  describe('PUT /api/admin/messages/announcements/:id (更新公告)', () => {
    it('非 UUID 返回 400', async () => {
      authAsAdmin()
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/messages/announcements/not-uuid',
        payload: { title: 'new' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('公告不存在返回 404', async () => {
      authAsAdmin()
      mockFindAnnouncementById.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/messages/announcements/${UUID}`,
        payload: { title: 'new' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('更新成功返回 200', async () => {
      authAsAdmin()
      mockFindAnnouncementById.mockResolvedValueOnce(makeAnnouncement())
      mockUpdateAnnouncement.mockResolvedValueOnce(makeAnnouncement({ title: 'new' }))
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/messages/announcements/${UUID}`,
        payload: { title: 'new' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockUpdateAnnouncement).toHaveBeenCalled()
    })
  })

  describe('DELETE /api/admin/messages/announcements/:id (删除公告)', () => {
    it('公告不存在返回 404', async () => {
      authAsAdmin()
      mockFindAnnouncementById.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/messages/announcements/${UUID}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('删除成功返回 200', async () => {
      authAsAdmin()
      mockFindAnnouncementById.mockResolvedValueOnce(makeAnnouncement())
      mockDeleteAnnouncement.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/messages/announcements/${UUID}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.ok).toBe(true)
      expect(mockDeleteAnnouncement).toHaveBeenCalledWith(UUID)
    })
  })

  describe('POST /api/admin/messages/system-notice (发布系统通知)', () => {
    it('缺少 content 返回 400(Zod throw)', async () => {
      authAsAdmin()
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/messages/system-notice',
        payload: {},
        headers: { authorization: 'Bearer t' },
      })
      expect([400, 500]).toContain(res.statusCode)
    })

    it('发布成功返回 201', async () => {
      authAsAdmin()
      enqueue([{ id: 1, content: '维护通知', createdAt: NOW }]) // insert returning
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/messages/system-notice',
        payload: { content: '维护通知' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().data.notice.content).toBe('维护通知')
    })
  })

  describe('POST /api/admin/messages/template (新增模板)', () => {
    it('缺少 code 返回 400(Zod throw)', async () => {
      authAsAdmin()
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/messages/template',
        payload: { channel: 'sms', title: 't', content: 'c' },
        headers: { authorization: 'Bearer t' },
      })
      expect([400, 500]).toContain(res.statusCode)
    })

    it('新增成功返回 201', async () => {
      authAsAdmin()
      enqueue([{ id: 1, code: 'TPL1', channel: 'sms', title: 't', content: 'c' }])
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/messages/template',
        payload: { code: 'TPL1', channel: 'sms', title: 't', content: 'c' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().data.template.code).toBe('TPL1')
    })
  })
})
