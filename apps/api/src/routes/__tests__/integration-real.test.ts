import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn().mockResolvedValue({
    userId: '00000000-0000-0000-0000-000000000001',
    phone: '13800000000',
    familyId: '11111111-1111-1111-1111-111111111111',
    roleId: 0,
  }),
}))

vi.mock('../../db/index.js', () => {
  interface DbChain {
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
    from: () => DbChain
    where: () => DbChain
    orderBy: () => DbChain
    limit: () => DbChain
  }
  function createChain(result: unknown[] = []): DbChain {
    const chain: DbChain = {
      then: (resolve) => Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
    }
    return chain
  }
  return {
    db: {
      select: vi.fn(() => createChain()),
    },
  }
})

vi.mock('../../db/commission-queries.js', () => ({
  commissionSummary: vi
    .fn()
    .mockResolvedValue({ totalAmount: 100, totalToken: 10, commissionDay: 30 }),
  withdrawalSummary: vi.fn().mockResolvedValue({ pendingAmount: 0, totalWithdrawn: 50 }),
  availableWithdrawal: vi.fn().mockResolvedValue(50),
  listSubordinates: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  listCommissionFlows: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  teamCenter: vi
    .fn()
    .mockResolvedValue({
      totalInvitees: 5,
      vipInvitees: 2,
      monthNew: 1,
      commissionTotal: 100,
      withdrawalTotal: 50,
    }),
  applyWithdrawal: vi.fn(),
  listWithdrawals: vi.fn(),
  getWithdrawalById: vi.fn(),
  approveWithdrawal: vi.fn(),
  rejectWithdrawal: vi.fn(),
}))

vi.mock('../../db/news-queries.js', () => ({
  findPublishedArticles: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findArticleById: vi.fn().mockResolvedValue(undefined),
  incrementArticleViewCount: vi.fn().mockResolvedValue(undefined),
  createArticle: vi.fn().mockResolvedValue({ id: 'art-1', title: 'test' }),
  findPublishedNewsCategories: vi.fn().mockResolvedValue([]),
  findMyArticles: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
}))

vi.mock('../../db/learn-queries.js', () => ({
  findMyLessons: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  signUpLesson: vi.fn().mockResolvedValue(undefined),
  isSignedUp: vi.fn().mockResolvedValue(false),
  findSignUp: vi.fn().mockResolvedValue(undefined),
  updateProgress: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../db/chat-queries.js', () => ({
  findMessageById: vi.fn().mockResolvedValue({ id: 'msg-1', content: 'hello' }),
}))

vi.mock('../../db/certificate-queries.js', () => ({
  createCertificate: vi.fn().mockResolvedValue({ id: 'cert-1', title: 'test' }),
  updateCertificateStatus: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../db/resource-queries.js', () => ({
  findResourceById: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../db/order-queries.js', () => ({
  findOrderByOrderNo: vi.fn(),
  findPaymentByOrderId: vi.fn(),
  findRefundById: vi.fn(),
  cancelOrder: vi.fn(),
  applyRefund: vi.fn(),
  processRefund: vi.fn(),
  handleRefund: vi.fn(),
}))

import { missingUserRoutes } from '../missing-user-routes.js'
import { findArticleById } from '../../db/news-queries.js'
import { isSignedUp, findSignUp, updateProgress } from '../../db/learn-queries.js'
import { updateCertificateStatus } from '../../db/certificate-queries.js'
import { findResourceById } from '../../db/resource-queries.js'

const AUTH = { authorization: 'Bearer mock-token' }

describe('Integration Tests (mocked DB)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(missingUserRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('commission', () => {
    it('GET /commission/overview → 200 + 佣金汇总结构', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/commission/overview',
        headers: AUTH,
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('totalCommission', 100)
      expect(body.data).toHaveProperty('availableCommission', 50)
      expect(body.data).toHaveProperty('pendingCommission', 0)
      expect(body.data).toHaveProperty('withdrawnCommission', 50)
    })

    it('GET /commission/invite-info → 200 + 邀请信息', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/commission/invite-info',
        headers: AUTH,
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('inviteCount', 5)
      expect(body.data).toHaveProperty('vipInvitees', 2)
      expect(body.data).toHaveProperty('monthNew', 1)
    })

    it('GET /commission/invited-users → 200 + 分页结构', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/commission/invited-users',
        headers: AUTH,
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('list')
      expect(body.data).toHaveProperty('total')
      expect(body.data).toHaveProperty('page', 1)
      expect(body.data).toHaveProperty('pageSize', 20)
    })

    it('GET /commission/list → 200 + 佣金流水分页结构', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/commission/list', headers: AUTH })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('list')
      expect(body.data).toHaveProperty('total')
      expect(body.data).toHaveProperty('page', 1)
      expect(body.data).toHaveProperty('pageSize', 20)
    })
  })

  describe('article', () => {
    it('GET /article/list → 200 + 分页结构', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/article/list', headers: AUTH })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('list')
      expect(body.data).toHaveProperty('total')
      expect(body.data).toHaveProperty('page', 1)
      expect(body.data).toHaveProperty('pageSize', 20)
    })

    it('GET /article/detail/:id → 200 + article 对象(文章存在)', async () => {
      vi.mocked(findArticleById).mockResolvedValueOnce({ id: 'art-1', title: 'Test' } as never)
      const res = await app.inject({
        method: 'GET',
        url: '/api/article/detail/art-1',
        headers: AUTH,
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data.article).toHaveProperty('id', 'art-1')
    })

    it('GET /article/detail/:id → 200 + article=undefined(文章不存在)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/article/detail/nonexistent',
        headers: AUTH,
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data.article).toBeUndefined()
    })

    it('GET /article/categories → 200', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/article/categories', headers: AUTH })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('list')
    })

    it('GET /article/my → 200 + 分页结构', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/article/my', headers: AUTH })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('list')
      expect(body.data).toHaveProperty('total')
    })

    it('POST /article/publish → 400(缺少 title)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/article/publish',
        payload: { content: 'content only' },
        headers: AUTH,
      })
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(400)
    })

    it('POST /article/publish → 400(缺少 content)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/article/publish',
        payload: { title: 'title only' },
        headers: AUTH,
      })
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(400)
    })

    it('POST /article/publish → 201(有 title+content)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/article/publish',
        payload: { title: 'Test', content: 'Content' },
        headers: AUTH,
      })
      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('success', true)
      expect(body.data.article).toHaveProperty('id', 'art-1')
    })

    it('GET /article/hot → 200', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/article/hot', headers: AUTH })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('list')
    })

    it('GET /article/essence → 200', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/article/essence', headers: AUTH })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('list')
    })
  })

  describe('course', () => {
    it('POST /course/:id/enroll → 201(未报名 → enrolled=true)', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/course/c1/enroll', headers: AUTH })
      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('enrolled', true)
    })

    it('POST /course/:id/enroll → 201(已报名 → enrolled=false)', async () => {
      vi.mocked(isSignedUp).mockResolvedValueOnce(true)
      const res = await app.inject({ method: 'POST', url: '/api/course/c1/enroll', headers: AUTH })
      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('enrolled', false)
    })

    it('GET /course/:id/progress → 404(未报名)', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/course/c1/progress', headers: AUTH })
      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(404)
    })

    it('GET /course/:id/progress → 200(已报名)', async () => {
      vi.mocked(findSignUp).mockResolvedValueOnce({ progress: 50, status: 1 } as never)
      const res = await app.inject({ method: 'GET', url: '/api/course/c1/progress', headers: AUTH })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('progress', 50)
    })

    it('POST /course/lesson-complete → 400(缺少 lessonId)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/course/lesson-complete',
        payload: {},
        headers: AUTH,
      })
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(400)
    })

    it('POST /course/lesson-complete → 404(未报名)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/course/lesson-complete',
        payload: { lessonId: 'l1' },
        headers: AUTH,
      })
      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(404)
    })

    it('POST /course/lesson-complete → 200(更新成功)', async () => {
      vi.mocked(updateProgress).mockResolvedValueOnce({ progress: 100, status: 2 } as never)
      const res = await app.inject({
        method: 'POST',
        url: '/api/course/lesson-complete',
        payload: { lessonId: 'l1' },
        headers: AUTH,
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('progress', 100)
    })

    it('GET /course/my → 200 + 分页结构', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/course/my', headers: AUTH })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('list')
      expect(body.data).toHaveProperty('total')
    })
  })

  describe('misc', () => {
    it('GET /messages/:id → 200 + message 对象', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/messages/msg-1', headers: AUTH })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data.message).toHaveProperty('id', 'msg-1')
    })

    it('GET /resources/:id/download → 404(资源不存在)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/resources/r1/download',
        headers: AUTH,
      })
      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(404)
    })

    it('GET /resources/:id/download → 200(资源存在)', async () => {
      vi.mocked(findResourceById).mockResolvedValueOnce({
        id: 'r1',
        fileUrl: 'https://example.com/file.pdf',
      } as never)
      const res = await app.inject({
        method: 'GET',
        url: '/api/resources/r1/download',
        headers: AUTH,
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('url', 'https://example.com/file.pdf')
    })

    it('POST /certificates/issue → 400(缺少 userId)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/certificates/issue',
        payload: { templateId: 't1', title: 'Cert' },
        headers: AUTH,
      })
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(400)
    })

    it('POST /certificates/issue → 400(缺少 templateId)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/certificates/issue',
        payload: { userId: 'u1', title: 'Cert' },
        headers: AUTH,
      })
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(400)
    })

    it('POST /certificates/issue → 400(缺少 title)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/certificates/issue',
        payload: { userId: 'u1', templateId: 't1' },
        headers: AUTH,
      })
      expect(res.statusCode).toBe(400)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(400)
    })

    it('POST /certificates/issue → 201(参数完整)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/certificates/issue',
        payload: { userId: 'u1', templateId: 't1', title: 'Cert' },
        headers: AUTH,
      })
      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('certificateId', 'cert-1')
    })

    it('POST /certificates/:id/revoke → 404(证书不存在)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/certificates/c1/revoke',
        headers: AUTH,
      })
      expect(res.statusCode).toBe(404)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(404)
    })

    it('POST /certificates/:id/revoke → 200(吊销成功)', async () => {
      vi.mocked(updateCertificateStatus).mockResolvedValueOnce({ id: 'c1', status: 0 } as never)
      const res = await app.inject({
        method: 'POST',
        url: '/api/certificates/c1/revoke',
        headers: AUTH,
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('success', true)
    })
  })
})
