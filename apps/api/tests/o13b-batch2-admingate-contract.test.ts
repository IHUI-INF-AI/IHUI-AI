// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O13b 第二批(admin 面闸门收敛)行为契约:
 * finance.ts(6 处)/ user/developer-routes.ts(1 处)的裸 roleId 数值比较收敛为集中
 * requireAdmin 后,鉴权行为不变 —— 无 JWT → 401 / roleId<1 → 403 '需要管理员权限' /
 * roleId>=1 → 放行进入业务分支。
 *
 * 模式沿用试点批 o13b-requireadmin-pilot.test.ts:真实集中封装 + mock authenticate,
 * db / 业务查询模块全部 mock,不连真实数据库。
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockAuthenticate } = vi.hoisted(() => ({ mockAuthenticate: vi.fn() }))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(),
}))

// 集中封装的两个下游依赖:rbac-queries(真实会连库)与 internal-service-token 均 mock,
// 本用例只走"管理员豁免"分支,不触达 RBAC 查询。
vi.mock('../src/db/rbac-queries.js', () => ({
  checkAnyPermission: vi.fn().mockResolvedValue(false),
}))

vi.mock('../src/plugins/internal-service-token.js', () => ({
  hasInternalServiceToken: vi.fn().mockReturnValue(false),
  checkInternalServiceToken: vi.fn().mockResolvedValue(false),
}))

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), execute: vi.fn() },
  dbRead: { execute: vi.fn() },
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  orders: { orderNo: 'order_no', status: 'status', userId: 'user_id' },
  withdrawalFlows: { id: 'id', status: 'status' },
}))

vi.mock('../src/db/commission-queries.js', () => ({
  getBalance: vi.fn().mockResolvedValue(100),
  rechargeToken: vi.fn(),
  deductToken: vi.fn().mockResolvedValue(80),
  refundToken: vi.fn(),
  expireToken: vi.fn(),
  listTokenFlows: vi.fn(),
  listCommissionFlows: vi.fn(),
  commissionSummary: vi.fn(),
  applyWithdrawal: vi.fn(),
  listWithdrawals: vi.fn(),
  withdrawalSummary: vi.fn(),
  availableWithdrawal: vi.fn(),
  listSubordinates: vi.fn(),
  teamCenter: vi.fn(),
}))

vi.mock('../src/db/developer-queries.js', () => ({
  findDeveloperInfo: vi.fn(),
  findDeveloperPricing: vi.fn(),
  createDeveloperApplication: vi.fn(),
  updateDeveloperApplicationStatus: vi.fn().mockResolvedValue(null),
}))

vi.mock('../src/routes/user/_shared.js', () => ({
  parseIdParam: vi.fn().mockReturnValue('dev-app-001'),
  parsePagination: vi.fn().mockReturnValue({ page: 1, pageSize: 10 }),
}))

import { financeRoutes } from '../src/routes/finance.js'
import developerRoutes from '../src/routes/user/developer-routes.js'

interface MockAuthRequest {
  userId?: string
  jwtPayload?: { userId: string; roleId: number }
}

function setAdmin(): void {
  mockAuthenticate.mockImplementation(async (request: MockAuthRequest) => {
    request.userId = 'admin-001'
    request.jwtPayload = { userId: 'admin-001', roleId: 1 }
  })
}

function setUser(): void {
  mockAuthenticate.mockImplementation(async (request: MockAuthRequest) => {
    request.userId = 'user-001'
    request.jwtPayload = { userId: 'user-001', roleId: 0 }
  })
}

function setNoAuth(): void {
  const err = new Error('Authentication required') as Error & { statusCode: number }
  err.statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

describe('O13b 第二批:集中 requireAdmin 收敛后行为契约', () => {
  let finance: FastifyInstance
  let developer: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    if (!finance) {
      finance = Fastify({ logger: false })
      await finance.register(financeRoutes)
      await finance.ready()
      developer = Fastify({ logger: false })
      await developer.register(developerRoutes)
      await developer.ready()
    }
  })

  afterAll(async () => {
    await finance?.close()
    await developer?.close()
  })

  describe('finance/margin/deduct(原 roleId<1 → 403 裸比较)', () => {
    it('无 JWT → 401 且不进入资金操作', async () => {
      setNoAuth()
      const res = await finance.inject({
        method: 'POST',
        url: '/finance/margin/deduct?quantity=10',
      })
      expect(res.statusCode).toBe(401)
      expect(res.json().code).toBe(401)
    })

    it('roleId=0 → 403 + 消息与迁移前一致', async () => {
      setUser()
      const res = await finance.inject({
        method: 'POST',
        url: '/finance/margin/deduct?quantity=10',
      })
      expect(res.statusCode).toBe(403)
      expect(res.json()).toEqual({ code: 403, message: '需要管理员权限' })
    })

    it('roleId>=1 → 放行(资金操作执行并返回 code=0)', async () => {
      setAdmin()
      const res = await finance.inject({
        method: 'POST',
        url: '/finance/margin/deduct?quantity=10',
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
      expect(res.json().data).toEqual({ balance: 80 })
    })
  })

  describe('finance/margin/refund(同族第 6 处闸门)', () => {
    it('roleId=0 → 403', async () => {
      setUser()
      const res = await finance.inject({ method: 'POST', url: '/finance/margin/refund?quantity=5' })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('管理员')
    })
  })

  describe('developer/:id/audit(原 roleId<1 → 403 裸比较)', () => {
    it('无 JWT → 401', async () => {
      setNoAuth()
      const res = await developer.inject({
        method: 'POST',
        url: '/developer/dev-app-001/audit',
        payload: { status: 'approved' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('roleId=0 → 403 + 消息与迁移前一致', async () => {
      setUser()
      const res = await developer.inject({
        method: 'POST',
        url: '/developer/dev-app-001/audit',
        payload: { status: 'approved' },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json()).toEqual({ code: 403, message: '需要管理员权限' })
    })

    it('roleId>=1 → 通过鉴权(落到"申请不存在"业务分支)', async () => {
      setAdmin()
      const res = await developer.inject({
        method: 'POST',
        url: '/developer/dev-app-001/audit',
        payload: { status: 'approved' },
      })
      expect(res.statusCode).toBe(404)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
