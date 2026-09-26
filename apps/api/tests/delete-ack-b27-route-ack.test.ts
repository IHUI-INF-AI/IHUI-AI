// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 第二十六批·续(本泳道 B27):删除端点的 ack 必须由**库确认的命中集合**派生(一跳委托的路由那半)。
//
// 这一把尺子钉的是:委托函数回报空集合(删 0 行)时,端点**不得**再说 `deleted: true`。
// 旧实现到这里一律回 true —— "改了 0 行"与"删成功"在响应上完全同形。
//
// 两处刻意保持不变,免得测试替改动背书:
//  - 响应键名与状态码逐字不变(逐条断言 `Object.keys(body.data)`);本票不新增任何键。
//  - 鉴权/归属前置只把"身份"喂进去(authenticate/checkAuth 注 userId + jwtPayload.roleId),
//    `requireAdmin` / roleId 闸门走的是真实现 —— 本票改的是"删完之后凭什么说删成了",不是闸门。
//
// 委托函数被 mock ⇒ 这里判的是"路由有没有真去消费回报集合";
// "回报集合本身是否来自 RETURNING"由 delete-ack-b27-delegate-returning.test.ts 量。

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const TARGET_ID = '33333333-3333-4333-8333-333333333333'
const TEAM_ID = '22222222-2222-4222-8222-222222222222'
const ROW_ID = '11111111-1111-4111-8111-111111111111'

// 每个被覆写的出口都必须点名在场;其余出口用 importOriginal 原样带过 ——
// 手抄整张清单必然腐烂(路由后续新增一个 import 就会抛 "No X export is defined on the mock")。
const { ov, mockAuthenticate, mockCheckAuth } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockCheckAuth: vi.fn(),
  ov: {
    stats: { findStatisticsSnapshotById: vi.fn(), deleteStatisticsSnapshot: vi.fn() },
    teams: {
      findTeamById: vi.fn(),
      findTeamMember: vi.fn(),
      deleteTeam: vi.fn(),
      removeTeamMember: vi.fn(),
    },
    comments: { findFeedbackById: vi.fn(), deleteFeedback: vi.fn() },
    community: {
      findAskById: vi.fn(),
      deleteAsk: vi.fn(),
      findCircleById: vi.fn(),
      deleteCircle: vi.fn(),
    },
    cs: { findTicketById: vi.fn(), deleteTicket: vi.fn() },
  },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

// 鉴权出口:把身份注进 request,后续 requireAdmin / roleId 闸门仍走真实现。
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  checkAuth: (...args: unknown[]) => mockCheckAuth(...args),
  requireActiveUser: vi.fn(),
}))

// 五个被改动的查询层各覆写两个出口,其余原样保留。
vi.mock('../src/db/statistics-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, ...ov.stats }
})
vi.mock('../src/db/team-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, ...ov.teams }
})
vi.mock('../src/db/comment-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, ...ov.comments }
})
vi.mock('../src/db/community-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, ...ov.community }
})
vi.mock('../src/db/customer-service-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, ...ov.cs }
})

import { adminStatisticsRoutes } from '../src/routes/statistics.js'
import { teamRoutes } from '../src/routes/teams.js'
import { commentRoutes } from '../src/routes/comments.js'
import asksRoutes from '../src/routes/community/asks.js'
import { customerServiceRoutes } from '../src/routes/customer-service.js'

interface Site {
  name: string
  url: string
  /** 删除前的归属/存在性预查询该喂什么(这些分支本票逐字保留,必须让它们放行到删除那一步)。 */
  pre: () => void
  /** 委托函数的回报集合:命中 vs 删 0 行。 */
  delegate: (rows: string[]) => void
  /** 既有响应键集(逐字不变的凭据)。 */
  dataKeys: string[]
}

const SITES: Site[] = [
  {
    name: 'DELETE /api/admin/statistics/snapshots/:id → deleteStatisticsSnapshot',
    url: `/api/admin/statistics/snapshots/${ROW_ID}`,
    pre: () => ov.stats.findStatisticsSnapshotById.mockResolvedValue({ id: ROW_ID }),
    delegate: (rows) => ov.stats.deleteStatisticsSnapshot.mockResolvedValue(rows),
    dataKeys: ['id', 'deleted'],
  },
  {
    name: 'DELETE /api/teams/:id → deleteTeam',
    url: `/api/teams/${TEAM_ID}`,
    pre: () =>
      ov.teams.findTeamById.mockResolvedValue({ id: TEAM_ID, ownerId: USER_ID, slug: 't-1' }),
    delegate: (rows) => ov.teams.deleteTeam.mockResolvedValue(rows),
    dataKeys: ['deleted'],
  },
  {
    name: 'DELETE /api/teams/:id/members/:userId → removeTeamMember',
    url: `/api/teams/${TEAM_ID}/members/${TARGET_ID}`,
    pre: () => {
      ov.teams.findTeamById.mockResolvedValue({ id: TEAM_ID, ownerId: USER_ID, slug: 't-1' })
      // 调用方必须是 owner/admin,目标必须存在且非 owner —— 两个分支共用同一个出口,按参数分流。
      ov.teams.findTeamMember.mockImplementation(async (_teamId: string, userId: string) =>
        userId === USER_ID
          ? { teamId: TEAM_ID, userId, role: 'owner' }
          : { teamId: TEAM_ID, userId, role: 'member' },
      )
    },
    delegate: (rows) => ov.teams.removeTeamMember.mockResolvedValue(rows),
    dataKeys: ['deleted'],
  },
  {
    name: 'DELETE /api/admin/feedbacks/:id → deleteFeedback',
    url: `/api/admin/feedbacks/${ROW_ID}`,
    pre: () => ov.comments.findFeedbackById.mockResolvedValue({ id: ROW_ID }),
    delegate: (rows) => ov.comments.deleteFeedback.mockResolvedValue(rows),
    dataKeys: ['id', 'deleted'],
  },
  {
    name: 'DELETE /api/admin/circles/:id → deleteCircle',
    url: `/api/admin/circles/${ROW_ID}`,
    pre: () => ov.community.findCircleById.mockResolvedValue({ id: ROW_ID }),
    delegate: (rows) => ov.community.deleteCircle.mockResolvedValue(rows),
    dataKeys: ['id', 'deleted'],
  },
  {
    name: 'DELETE /api/customer-service/tickets/:id → deleteTicket',
    url: `/api/customer-service/tickets/${ROW_ID}`,
    pre: () =>
      ov.cs.findTicketById.mockResolvedValue({ id: ROW_ID, userId: USER_ID, status: 'pending' }),
    delegate: (rows) => ov.cs.deleteTicket.mockResolvedValue(rows),
    dataKeys: ['id', 'deleted'],
  },
]

/**
 * 对照组:asks 的 `DELETE /api/asks/:id` 走的是**已经诚实**那一型
 * (deleteAsk 的布尔来自 `.delete().where(and(id, userId)).returning({id})` 的 `rows.length > 0`)。
 * 本票不改它,但把它钉在用例上 —— 否则"已诚实"只是一句散文,下一次顺手改动就退回去了。
 */
const HONEST_CONTROL = {
  url: `/api/asks/${ROW_ID}`,
  pre: () => ov.community.findAskById.mockResolvedValue({ id: ROW_ID, userId: USER_ID }),
  delegate: (confirmed: boolean) => ov.community.deleteAsk.mockResolvedValue(confirmed),
}

describe('一跳委托的删除端点:ack 必须由委托回报的命中集合派生', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = Fastify({ logger: false })
    server.setErrorHandler((error, _request, reply) => {
      const statusCode =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : error.message,
      })
    })
    // 前缀与 src/routes/index.ts 的实际挂载一致,避免"测试里的 URL 生产不存在"。
    await server.register(adminStatisticsRoutes, { prefix: '/api/admin' })
    await server.register(teamRoutes, { prefix: '/api/teams' })
    await server.register(commentRoutes, { prefix: '/api' })
    await server.register(asksRoutes, { prefix: '/api' })
    await server.register(customerServiceRoutes, { prefix: '/api/customer-service' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    for (const group of Object.values(ov)) for (const m of Object.values(group)) m.mockReset()
    mockAuthenticate.mockReset()
    mockCheckAuth.mockReset()
    const inject = async (request: { userId?: string; jwtPayload?: Record<string, unknown> }) => {
      request.userId = USER_ID
      request.jwtPayload = { userId: USER_ID, roleId: 1 }
    }
    mockAuthenticate.mockImplementation(inject)
    mockCheckAuth.mockImplementation(async (request: Parameters<typeof inject>[0]) => {
      await inject(request)
      return true
    })
  })

  for (const site of SITES) {
    describe(site.name, () => {
      it('委托回报命中集合非空 → 200 + deleted:true,键集逐字不变', async () => {
        site.pre()
        site.delegate([ROW_ID])
        const res = await server.inject({ method: 'DELETE', url: site.url })
        expect(res.statusCode).toBe(200)
        expect(res.json().data.deleted).toBe(true)
        expect(Object.keys(res.json().data)).toEqual(site.dataKeys)
      })

      it('委托回报空集合(删 0 行)→ 200 + deleted:false —— 旧实现到这里仍回 true', async () => {
        site.pre()
        site.delegate([])
        const res = await server.inject({ method: 'DELETE', url: site.url })
        expect(res.statusCode).toBe(200)
        expect(res.json().data.deleted).toBe(false)
        expect(Object.keys(res.json().data)).toEqual(site.dataKeys)
      })
    })
  }

  describe('对照:DELETE /api/asks/:id → deleteAsk(布尔本就来自 RETURNING,未改动)', () => {
    it('委托回报 true → deleted:true', async () => {
      HONEST_CONTROL.pre()
      HONEST_CONTROL.delegate(true)
      const res = await server.inject({ method: 'DELETE', url: HONEST_CONTROL.url })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.deleted).toBe(true)
    })

    it('委托回报 false(删 0 行)→ deleted:false', async () => {
      HONEST_CONTROL.pre()
      HONEST_CONTROL.delegate(false)
      const res = await server.inject({ method: 'DELETE', url: HONEST_CONTROL.url })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.deleted).toBe(false)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
