// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 通知状态翻转的**生产面**广播回归(2026-11-24)。
 * 钉住四格:
 *  A 四条状态路由(单条已读/全部已读/归档/恢复)写库成功后各发一帧 notification:state,
 *    且 ids 是落库真正翻转的 id(不是请求体照抄),changedBy 是令牌主体。
 *  B 404(非本人/不存在)不发帧 —— 没写库成功却广播会让别的设备对账出一个不存在的翻转。
 *  C read-all 只广播真被命中的 ids;0 条不发(构造出口拒空,发了会抛 500)。
 *  D 广播帧能被 @ihui/types 的联合解析出来 —— "发出去了但另一端认不下" 一律算没发。
 * 不连库:db / notification-queries / auth 全 mock,风格与 conversation-meta-broadcast-d153 一致。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseUserBroadcastFrame, type NotificationStateEvent } from '@ihui/types'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111'
const N1 = '11111111-1111-4111-8111-111111111111'
const AUTH_HEADER = { authorization: 'Bearer mock-user-token' }

const {
  mockMarkAsRead,
  mockMarkAllAsRead,
  mockArchive,
  mockRestore,
  mockCountUnread,
  mockFindByUser,
  mockQueryStateIds,
} = vi.hoisted(() => ({
  mockMarkAsRead: vi.fn(),
  mockMarkAllAsRead: vi.fn(),
  mockArchive: vi.fn(),
  mockRestore: vi.fn(),
  mockCountUnread: vi.fn(async () => 0),
  mockFindByUser: vi.fn(async () => ({ list: [], total: 0 })),
  mockQueryStateIds: vi.fn(async () => ({ readIds: [], archivedIds: [] })),
}))

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(async () => ({ userId: USER_A, phone: '13800000000' })),
  createBlacklist: vi.fn(() => ({
    async has() {
      return false
    },
    async add() {},
    async revoke() {},
  })),
}))
vi.mock('jose', () => ({ decodeJwt: vi.fn(() => ({ type: 'access' })) }))
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgres://127.0.0.1:5399/test',
    REDIS_URL: 'redis://127.0.0.1:6399',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
  },
}))
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))
vi.mock('../src/db/index.js', () => {
  const chain = () => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'values', 'returning', 'set', 'orderBy', 'limit', 'offset']) {
      step[m] = vi.fn(() => step)
    }
    step.then = (resolve: (v: unknown) => void) => resolve([])
    return step
  }
  return {
    db: {
      select: vi.fn(() => chain()),
      insert: vi.fn(() => chain()),
      update: vi.fn(() => chain()),
      delete: vi.fn(() => chain()),
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(),
    },
    dbRead: { select: vi.fn(() => chain()) },
  }
})
vi.mock('../src/db/notification-queries.js', () => ({
  findNotificationsByUser: mockFindByUser,
  countUnread: mockCountUnread,
  buildUnreadCount: mockCountUnread,
  markAsRead: mockMarkAsRead,
  markAllAsRead: mockMarkAllAsRead,
  archiveNotification: mockArchive,
  restoreNotification: mockRestore,
  deleteNotification: vi.fn(),
  deleteAllNotifications: vi.fn(),
  findConversations: vi.fn(async () => ({ list: [], total: 0 })),
  findMessagesBetween: vi.fn(async () => []),
  createMessage: vi.fn(),
  createNotification: vi.fn(),
  findAllNotificationsForAdmin: vi.fn(async () => []),
  broadcastNotification: vi.fn(),
  attachTopicToList: vi.fn(async (list: unknown) => list),
  queryNotificationStateIds: mockQueryStateIds,
}))
vi.mock('../src/services/email-service.js', () => ({ sendEmail: vi.fn() }))
vi.mock('../src/services/email-templates.js', () => ({ renderNoticeEmail: vi.fn(() => '') }))
vi.mock('../src/services/sms.js', () => ({ sendSmsMessage: vi.fn() }))
vi.mock('../src/services/audit-service.js', () => ({ logAction: vi.fn() }))

import { notificationRoutes } from '../src/routes/notifications.js'
import type { BroadcastResult } from '../src/plugins/ws-broadcast.js'

let emitted: Array<{ userId: string; event: string; data: unknown }> = []

function notifRow(id: string) {
  return {
    id,
    userId: USER_A,
    type: 'system',
    title: 't',
    content: null,
    data: null,
    isRead: false,
    archivedAt: null,
    createdAt: new Date().toISOString(),
  }
}

async function buildApp(): Promise<FastifyInstance> {
  emitted = []
  const app = Fastify({ logger: false })
  app.decorate(
    'broadcastToUser',
    (userId: string, event: string, data: unknown): BroadcastResult => {
      emitted.push({ userId, event, data })
      return { matched: 1, delivered: 1, gated: 0 }
    },
  )
  app.decorate('distributedRateLimit', {
    addRule: vi.fn(),
    preHandler: vi.fn(() => async () => {}),
  } as never)
  // 鉴权在路由 preHandler 里调 authenticate(request),它读 request.userId;
  // 这里用一个把 userId 注进去的 hook 顶替(在路由 hook 之后设置不到,故 decorate request)。
  app.decorateRequest('userId', null)
  app.addHook('onRequest', async (request) => {
    ;(request as unknown as { userId: string }).userId = USER_A
  })
  await app.register(notificationRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

function parsedStateFrames(): NotificationStateEvent[] {
  const out: NotificationStateEvent[] = []
  for (const e of emitted) {
    const evt = parseUserBroadcastFrame({ event: e.event, data: e.data })
    if (evt && evt.event === 'notification:state') out.push(evt)
  }
  return out
}

describe('notification:state 广播生产面', () => {
  let app: FastifyInstance
  beforeEach(async () => {
    vi.clearAllMocks()
    mockMarkAsRead.mockResolvedValue(notifRow(N1))
    mockMarkAllAsRead.mockResolvedValue([N1])
    mockArchive.mockResolvedValue(notifRow(N1))
    mockRestore.mockResolvedValue(notifRow(N1))
    app = await buildApp()
  })

  it('A 单条已读:成功发一帧,ids/changedBy 来自落库结果', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/notifications/${N1}/read`,
      headers: AUTH_HEADER,
    })
    expect(res.statusCode).toBe(200)
    const frames = parsedStateFrames()
    expect(frames).toHaveLength(1)
    expect(frames[0].data.op).toBe('read')
    expect(frames[0].data.ids).toEqual([N1])
    expect(frames[0].data.changedBy).toBe(USER_A)
    expect(emitted[0].userId).toBe(USER_A)
  })

  it('A 全部已读:op=read-all,ids 是命中的 id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/notifications/read-all',
      headers: AUTH_HEADER,
    })
    expect(res.statusCode).toBe(200)
    const frames = parsedStateFrames()
    expect(frames).toHaveLength(1)
    expect(frames[0].data.op).toBe('read-all')
    expect(frames[0].data.ids).toEqual([N1])
  })

  it('A 归档/恢复:各发 archive/restore 一帧', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/notifications/${N1}/archive`,
      headers: AUTH_HEADER,
    })
    await app.inject({
      method: 'POST',
      url: `/api/notifications/${N1}/restore`,
      headers: AUTH_HEADER,
    })
    const frames = parsedStateFrames()
    expect(frames.map((f) => f.data.op)).toEqual(['archive', 'restore'])
  })

  it('B 404 不发帧(写库没成功却广播=伪造翻转)', async () => {
    mockMarkAsRead.mockResolvedValue(undefined)
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/notifications/${N1}/read`,
      headers: AUTH_HEADER,
    })
    expect(res.statusCode).toBe(404)
    expect(parsedStateFrames()).toHaveLength(0)
  })

  it('C read-all 0 条不发帧(构造出口拒空,发了会 500)', async () => {
    mockMarkAllAsRead.mockResolvedValue([])
    const res = await app.inject({
      method: 'POST',
      url: '/api/notifications/read-all',
      headers: AUTH_HEADER,
    })
    expect(res.statusCode).toBe(200)
    expect(parsedStateFrames()).toHaveLength(0)
  })

  it('D 广播帧能被契约联合解析(不是只发出去)', () => {
    // 变异锁:四路由每个都真调用 broadcastToUser,抹掉任一个即红
    const src = readFileSync(resolve(__dirname, '../src/routes/notifications.ts'), 'utf8')
    const calls = (src.match(/server\.broadcastToUser\(/g) ?? []).length
    expect(calls).toBeGreaterThanOrEqual(4)
    expect(src).toContain("op: 'archive'")
    expect(src).toContain("op: 'restore'")
    expect(src).toContain("op: 'read-all'")
  })
})

describe('POST /notifications/state-query 权威快照边界', () => {
  let app: FastifyInstance
  beforeEach(async () => {
    vi.clearAllMocks()
    mockQueryStateIds.mockResolvedValue({ readIds: [], archivedIds: [] })
    app = await buildApp()
  })

  it('带合法 ids 回服务端真相子集,不泄漏未传入的 id', async () => {
    mockQueryStateIds.mockResolvedValue({ readIds: [N1], archivedIds: [] })
    const res = await app.inject({
      method: 'POST',
      url: '/api/notifications/state-query',
      headers: AUTH_HEADER,
      payload: { ids: [N1] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ readIds: [N1], archivedIds: [] })
    expect(mockQueryStateIds).toHaveBeenCalledWith(USER_A, [N1])
  })

  it('空 ids 合法(本地无通知,无需对账)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/notifications/state-query',
      headers: AUTH_HEADER,
      payload: { ids: [] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ readIds: [], archivedIds: [] })
  })

  it('半 uuid / 非 uuid id 直接 400(不静默 strip)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/notifications/state-query',
      headers: AUTH_HEADER,
      payload: { ids: ['not-a-uuid'] },
    })
    expect(res.statusCode).toBe(400)
    expect(mockQueryStateIds).not.toHaveBeenCalled()
  })

  it('超过 500 条 400(返回体有界,防滥用)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/notifications/state-query',
      headers: AUTH_HEADER,
      payload: {
        ids: Array.from(
          { length: 501 },
          (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        ),
      },
    })
    expect(res.statusCode).toBe(400)
    expect(mockQueryStateIds).not.toHaveBeenCalled()
  })

  it('未登录 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/notifications/state-query',
      payload: { ids: [N1] },
    })
    expect(res.statusCode).toBe(401)
    expect(mockQueryStateIds).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
