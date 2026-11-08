// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-160(P3):工单评级无属主校验,任意登录用户可按 id 读他人工单评分。
 *
 * `GET /v1/customer_service/ticket/:id/rate` 此前直接 `findRatingByTicket(id)` 就返回,
 * 而同文件相邻的 `replies`(:111-117)与 `close`(:131-137)都先 `findTicketById(id)` 判
 * 404/`ticket.userId !== request.userId` 判 403。rate 漏了这一步,等于把他人评分数值与
 * 评价文本按工单 id 对外开放(仅需登录)。
 *
 * 本夹具钉住与相邻端点**完全一致**的闸:
 *  ① 未登录 → 401,且不查 rating;
 *  ② 他人读评分 → 403,且响应体不含评分数值与评价文本,且不查 rating;
 *  ③ 属主读 → 200 且 rating 字段完整;
 *  ④ 不存在的工单 → 404,且不查 rating;
 *  ⑤ 管理员读他人工单 → 403(相邻端点无管理员豁免,口径一致);
 *  ⑥ 回归:replies / close 对他人仍是 403,且未触达评论查询/状态流转。
 *
 * 旧代码下 ② 必红:200 + `data.rating` 带 `"rating":5` 与评价原文;④ 旧代码也是 200。
 *
 * 隔离:能力闸 / 数据闸 / db 出口全部桩掉;只有路由 handler 与参数解析跑真实代码,
 * 不连 PG/Redis、零网络。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'
import type { FastifyReply, FastifyRequest } from 'fastify'

const mocks = vi.hoisted(() => ({
  findTicketById: vi.fn(),
  findRatingByTicket: vi.fn(),
  findCommentsByTicket: vi.fn(),
  transitionTicket: vi.fn(),
  findTickets: vi.fn(),
}))

vi.mock('../src/db/customer-service-queries.js', () => ({
  findTicketById: mocks.findTicketById,
  findRatingByTicket: mocks.findRatingByTicket,
  findCommentsByTicket: mocks.findCommentsByTicket,
  transitionTicket: mocks.transitionTicket,
  findTickets: mocks.findTickets,
}))

// 路由模块加载期只用到这两个出口;不建立真实连接。
vi.mock('../src/db/index.js', () => ({
  db: {},
  dbRead: {},
  dbReadScoped: {},
}))

vi.mock('../src/utils/scoped-guard.js', () => ({
  configureDataScopeGuard: vi.fn(),
}))

// O6 能力闸:本夹具只验证 handler 归属闸,不重复测 gate 本身。
vi.mock('../src/utils/capability-guard.js', () => ({
  requireCapabilityRules: vi.fn(() => async () => {}),
}))

vi.mock('../src/config/open-capability-registry.js', () => ({
  openCapabilityRules: vi.fn(() => []),
}))

// 与真实 requireOpenCapability 的人通道分支同形:无 request.userId → 401。
vi.mock('../src/utils/open-capability-gate.js', () => ({
  requireOpenCapability: () => async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.userId) return
    await reply.status(401).send({ code: 401, message: 'Authentication required' })
  },
}))

import { v1CustomerServiceRoutes } from '../src/routes/other/v1-customer-service-routes.js'

const USER_OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_STRANGER = 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb'
const USER_ADMIN = 'cccccccc-cccc-4ccc-accc-cccccccccccc'
const TICKET_OWNER = 'ticket-owner-1'
const TICKET_MISSING = 'ticket-does-not-exist'
const RATING_COMMENT = 'owner-only-rating-comment-请勿外泄'

const ownerTicket = { id: TICKET_OWNER, userId: USER_OWNER, status: 'open' }
const ownerRating = {
  id: 'rating-1',
  ticketId: TICKET_OWNER,
  sessionId: null,
  userId: USER_OWNER,
  agentId: null,
  rating: 5,
  comment: RATING_COMMENT,
}

let currentUser: { userId: string; roleId: number } | null = null

function asUser(userId: string, roleId = 0): void {
  currentUser = { userId, roleId }
}

describe('客服工单评级归属闸(F-160)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.addHook('onRequest', async (request) => {
      if (!currentUser) return
      const bag = request as unknown as { userId?: string; jwtPayload?: unknown }
      bag.userId = currentUser.userId
      bag.jwtPayload = { userId: currentUser.userId, roleId: currentUser.roleId }
    })
    await server.register(v1CustomerServiceRoutes)
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    currentUser = null

    mocks.findTicketById.mockImplementation(async (id: string) =>
      id === TICKET_OWNER ? { ...ownerTicket } : undefined,
    )
    mocks.findRatingByTicket.mockImplementation(async (id: string) =>
      id === TICKET_OWNER ? { ...ownerRating } : undefined,
    )
    mocks.findCommentsByTicket.mockResolvedValue([
      { id: 'comment-1', ticketId: TICKET_OWNER, userId: USER_OWNER, content: 'reply-text' },
    ])
    mocks.transitionTicket.mockResolvedValue({
      ticket: { ...ownerTicket, status: 'closed' },
    })
    mocks.findTickets.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 })
  })

  it('① 未登录读评级 → 401,且不查 rating', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/v1/customer_service/ticket/${TICKET_OWNER}/rate`,
    })
    expect(res.statusCode).toBe(401)
    expect(mocks.findRatingByTicket).not.toHaveBeenCalled()
  })

  it('② 他人读他人工单评级 → 403,响应体不含评分/评价文本,且不查 rating', async () => {
    asUser(USER_STRANGER)
    const res = await server.inject({
      method: 'GET',
      url: `/v1/customer_service/ticket/${TICKET_OWNER}/rate`,
    })
    // 旧代码此处为 200,body 里带 "rating":5 + 评价原文
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ code: 403, message: '无权查看此工单' })
    expect(res.body).not.toContain(RATING_COMMENT)
    expect(res.body).not.toContain('"rating"')
    // 归属校验必须先于评级查询:finder 一次都不该被调用
    expect(mocks.findRatingByTicket).not.toHaveBeenCalled()
    expect(mocks.findTicketById).toHaveBeenCalledTimes(1)
  })

  it('③ 属主读自己的工单评级 → 200 且字段完整', async () => {
    asUser(USER_OWNER)
    const res = await server.inject({
      method: 'GET',
      url: `/v1/customer_service/ticket/${TICKET_OWNER}/rate`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { rating: unknown } }
    expect(body.data.rating).toMatchObject({
      id: 'rating-1',
      ticketId: TICKET_OWNER,
      userId: USER_OWNER,
      rating: 5,
      comment: RATING_COMMENT,
    })
    expect(mocks.findRatingByTicket).toHaveBeenCalledTimes(1)
  })

  it('④ 不存在的工单 → 404,且不查 rating', async () => {
    asUser(USER_OWNER)
    const res = await server.inject({
      method: 'GET',
      url: `/v1/customer_service/ticket/${TICKET_MISSING}/rate`,
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ code: 404, message: '工单不存在' })
    expect(mocks.findRatingByTicket).not.toHaveBeenCalled()
  })

  it('⑤ 管理员读他人工单评级 → 403(与相邻端点一致,无管理员豁免)', async () => {
    asUser(USER_ADMIN, 1)
    const res = await server.inject({
      method: 'GET',
      url: `/v1/customer_service/ticket/${TICKET_OWNER}/rate`,
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ code: 403, message: '无权查看此工单' })
    expect(res.body).not.toContain(RATING_COMMENT)
    expect(mocks.findRatingByTicket).not.toHaveBeenCalled()
  })

  it('⑥ 回归:replies / close 对他人仍 403 且不改行为', async () => {
    asUser(USER_STRANGER)

    const repliesRes = await server.inject({
      method: 'GET',
      url: `/v1/customer_service/ticket/${TICKET_OWNER}/replies`,
    })
    expect(repliesRes.statusCode).toBe(403)
    expect(repliesRes.json()).toEqual({ code: 403, message: '无权查看此工单' })
    expect(mocks.findCommentsByTicket).not.toHaveBeenCalled()

    const closeRes = await server.inject({
      method: 'GET',
      url: `/v1/customer_service/ticket/${TICKET_OWNER}/close`,
    })
    expect(closeRes.statusCode).toBe(403)
    expect(closeRes.json()).toEqual({ code: 403, message: '无权操作此工单' })
    expect(mocks.transitionTicket).not.toHaveBeenCalled()
  })
})
