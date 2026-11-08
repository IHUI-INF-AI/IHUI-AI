// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-199(P2,审计/统计可被普通用户读取):`GET /api/live-gifts/records` 此前无鉴权,
 * 匿名即可分页拉取全站打赏流水(senderId/receiverId/amount/giftName,财务隐私)。
 *
 * 本文件钉住收口后的边界:
 *  ① 匿名 → 401,响应体不含任何流水;
 *  ② 普通登录用户 → 403(该端点是全站统计/审计面,不是"我的记录");
 *  ③ 管理员 → 200,仍能拿到两个用户的完整流水(合法能力不被误伤)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  return { gifts: [] as Record<string, unknown>[] }
})

vi.mock('../src/db/index.js', async () => {
  const { liveGift } = await import('@ihui/database')
  const isCountSelection = (selection: unknown) =>
    typeof selection === 'object' &&
    selection !== null &&
    'count' in (selection as Record<string, unknown>)
  const rowsFor = (table: unknown) => (table === liveGift ? h.gifts : [])
  const db = {
    execute: async () => [],
    select: (selection?: unknown) => ({
      from: (table: unknown) => {
        const raw = rowsFor(table)
        const resolved = isCountSelection(selection)
          ? [{ count: raw.length }]
          : raw.map((gift) => ({ record: gift, senderName: gift.userName ?? null }))
        const pageable = () => ({
          limit: (n: number) => ({
            offset: async (offset: number) => resolved.slice(offset, offset + n),
          }),
        })
        return {
          leftJoin: () => ({ orderBy: pageable }),
          orderBy: pageable,
          then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
            Promise.resolve(resolved).then(resolve, reject),
        }
      },
    }),
  }
  return { db, dbRead: db, dbClient: {} }
})

/**
 * 只替换鉴权闸本体,身份由请求头注入;JWT 语义(roleId >= 1 为管理员)保持一致。
 */
vi.mock('../src/plugins/require-permission.js', () => {
  interface MockRequest {
    headers: Record<string, string | string[] | undefined>
    userId?: string
    jwtPayload?: { userId?: string; roleId?: number }
  }
  interface MockReply {
    status: (code: number) => { send: (body: unknown) => void }
    sent?: boolean
  }
  const authenticate = (request: MockRequest, reply: MockReply): boolean => {
    const role = request.headers['x-test-role']
    if (!role) {
      reply.status(401).send({ code: 401, message: 'Authentication required' })
      return false
    }
    request.userId = String(request.headers['x-test-user'] ?? '')
    request.jwtPayload = { userId: request.userId, roleId: Number(role) }
    return true
  }
  return {
    requireAuth: async (request: MockRequest, reply: MockReply) => {
      authenticate(request, reply)
    },
    requireAdmin: async (request: MockRequest, reply: MockReply) => {
      if (!authenticate(request, reply)) return
      if ((request.jwtPayload?.roleId ?? 0) < 1) {
        reply.status(403).send({ code: 403, message: '需要管理员权限' })
      }
    },
  }
})

vi.mock('../src/plugins/business-metrics.js', () => ({
  recordLiveGiftIncome: vi.fn(),
}))

import { liveGiftsRoutes } from '../src/routes/live-gifts'

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const AMOUNT_A = 200
const AMOUNT_B = 888

const GIFT_A = {
  id: 1,
  channelId: 0,
  userId: USER_A,
  userName: '用户 A',
  giftId: 1,
  giftName: '玫瑰',
  giftCount: 2,
  totalPrice: AMOUNT_A,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
}

const GIFT_B = {
  ...GIFT_A,
  id: 2,
  userId: USER_B,
  userName: '用户 B',
  giftId: 2,
  giftName: '跑车',
  giftCount: 1,
  totalPrice: AMOUNT_B,
  createdAt: new Date('2026-01-02T00:00:00Z'),
}

function authHeaders(roleId: number, userId: string) {
  return { 'x-test-role': String(roleId), 'x-test-user': userId }
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(liveGiftsRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

beforeEach(() => {
  h.gifts = [GIFT_A, GIFT_B]
})

describe('F-199 全站打赏流水仅管理员可读', () => {
  it('匿名 GET /api/live-gifts/records → 401,响应体不含两个用户的流水/金额', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/live-gifts/records?page=1&pageSize=100',
    })
    expect(res.statusCode).toBe(401)
    expect(res.body).not.toContain(String(AMOUNT_B))
    expect(res.body).not.toContain(GIFT_B.giftName)
    expect(res.body).not.toContain(USER_B)
    await app.close()
  })

  it('普通登录用户 GET /api/live-gifts/records → 403,看不到他人流水', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/live-gifts/records?page=1&pageSize=100',
      headers: authHeaders(0, USER_A),
    })
    expect(res.statusCode).toBe(403)
    expect(res.body).not.toContain(String(AMOUNT_B))
    expect(res.body).not.toContain(GIFT_B.giftName)
    expect(res.body).not.toContain(USER_B)
    await app.close()
  })

  it('管理员 GET /api/live-gifts/records → 200,完整返回两个用户的流水', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/live-gifts/records?page=1&pageSize=100',
      headers: authHeaders(1, USER_A),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      data: { list: (typeof GIFT_A & { senderName: string | null })[]; total: number }
    }
    expect(body.data.list).toHaveLength(2)
    expect(body.data.total).toBe(2)
    expect(body.data.list[0]?.userId).toBe(USER_A)
    expect(body.data.list[0]?.totalPrice).toBe(AMOUNT_A)
    expect(body.data.list[1]?.userId).toBe(USER_B)
    expect(body.data.list[1]?.totalPrice).toBe(AMOUNT_B)
    expect(body.data.list[1]?.giftName).toBe(GIFT_B.giftName)
    await app.close()
  })
})
