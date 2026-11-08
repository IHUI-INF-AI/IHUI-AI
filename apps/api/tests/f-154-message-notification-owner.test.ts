// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-154 回归锁(2026-11-08,apps/api P1 越权组)。
 *
 * 病灶:GET /user/notifications/:id 与 GET /user/messages/:id 只按主键取行,
 *       不与 request.userId 比对 —— 任意登录用户拿到他人 uuid 即可读私信正文、
 *       通知正文及其 data(订单/退款载荷)。
 * 判据:非属主与不存在同档 404;本人 200。消息归属沿 conversationId → 会话 userId
 *       (与 chat.ts 的 DELETE /messages/:id 同一判据)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const state = vi.hoisted(() => ({
  notification: undefined as Record<string, unknown> | undefined,
  message: undefined as Record<string, unknown> | undefined,
  conversation: undefined as Record<string, unknown> | undefined,
}))

vi.mock('../src/db/notification-queries.js', () => ({
  findNotificationById: vi.fn(async () => state.notification),
}))

vi.mock('../src/db/chat-queries.js', () => ({
  // 真实实现是 JOIN 会话后按 userId 过滤的单查;夹具按同一判据模拟,避免 mock 忽略第二参。
  findMessageById: vi.fn(async (_id: string, userId: string) => {
    if (!state.message) return undefined
    return state.conversation && state.conversation.userId === userId ? state.message : undefined
  }),
}))

vi.mock('../src/db/site-categories-queries.js', () => ({ findSiteCategories: vi.fn() }))
vi.mock('../src/db/vip-queries.js', () => ({ listVipLevels: vi.fn() }))
vi.mock('../src/plugins/auth.js', () => ({ authenticate: vi.fn(async () => {}) }))
vi.mock('../src/services/coupon-service.js', () => ({
  claimCouponById: vi.fn(),
  claimFailureReasonOf: vi.fn(),
  listAvailableCoupons: vi.fn(),
  listUserCoupons: vi.fn(),
}))

import miscRoutes from '../src/routes/user/misc-routes.js'

type Handler = (request: unknown, reply: unknown) => unknown

function makeServer() {
  const handlers = new Map<string, Handler>()
  const server = {
    get: vi.fn((path: string, handler: Handler) => handlers.set(path, handler)),
    post: vi.fn((path: string, handler: Handler) => handlers.set(path, handler)),
    put: vi.fn((path: string, handler: Handler) => handlers.set(path, handler)),
    delete: vi.fn((path: string, handler: Handler) => handlers.set(path, handler)),
    addHook: vi.fn(),
    decorate: vi.fn(),
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  }
  return { server, handlers }
}

function makeReply() {
  return {
    code: 200,
    body: undefined as unknown,
    status(c: number) {
      this.code = c
      return this
    },
    send(b: unknown) {
      this.body = b
      return this
    },
  }
}

const USER = '00000000-0000-4000-8000-0000000000a1'
const OTHER = '00000000-0000-4000-8000-0000000000a2'
const NID = '00000000-0000-4000-8000-0000000000b1'
const MID = '00000000-0000-4000-8000-0000000000b2'
const CID = '00000000-0000-4000-8000-0000000000b3'

async function getHandler(path: string) {
  const { server, handlers } = makeServer()
  await miscRoutes(server as never, {} as never)
  return handlers.get(path)!
}

describe('F-154 通知/私信详情按属主收敛', () => {
  beforeEach(() => {
    state.notification = undefined
    state.message = undefined
    state.conversation = undefined
  })

  it('他人通知 → 404(与不存在同档)', async () => {
    state.notification = { id: NID, userId: OTHER, title: '订单退款', data: { orderId: 'o-1' } }
    const handler = await getHandler('/notifications/:id')
    const reply = makeReply()
    await handler({ userId: USER, params: { id: NID } }, reply)
    expect(reply.code).toBe(404)
  })

  it('本人通知 → 200', async () => {
    state.notification = { id: NID, userId: USER, title: '订单退款', data: { orderId: 'o-1' } }
    const handler = await getHandler('/notifications/:id')
    const reply = makeReply()
    await handler({ userId: USER, params: { id: NID } }, reply)
    expect(reply.code).toBe(200)
  })

  it('通知不存在 → 404', async () => {
    const handler = await getHandler('/notifications/:id')
    const reply = makeReply()
    await handler({ userId: USER, params: { id: NID } }, reply)
    expect(reply.code).toBe(404)
  })

  it('他人会话里的消息 → 404(归属沿 conversationId)', async () => {
    state.message = { id: MID, conversationId: CID, content: '私密内容' }
    state.conversation = { id: CID, userId: OTHER }
    const handler = await getHandler('/messages/:id')
    const reply = makeReply()
    await handler({ userId: USER, params: { id: MID } }, reply)
    expect(reply.code).toBe(404)
  })

  it('本人会话里的消息 → 200', async () => {
    state.message = { id: MID, conversationId: CID, content: '我的内容' }
    state.conversation = { id: CID, userId: USER }
    const handler = await getHandler('/messages/:id')
    const reply = makeReply()
    await handler({ userId: USER, params: { id: MID } }, reply)
    expect(reply.code).toBe(200)
  })

  it('消息不存在或会话已消失 → 404', async () => {
    state.message = { id: MID, conversationId: CID, content: '孤儿行' }
    const handler = await getHandler('/messages/:id')
    const reply = makeReply()
    await handler({ userId: USER, params: { id: MID } }, reply)
    expect(reply.code).toBe(404)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
