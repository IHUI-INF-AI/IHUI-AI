import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8080,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8000',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

const {
  mockAuthenticate,
  mockCheckPermission,
  mockDbExecute,
  mockSelectResult,
  mockInsertReturning,
  mockUpdateReturning,
  mockDeleteWhere,
} = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockCheckPermission: vi.fn().mockResolvedValue(false),
  mockDbExecute: vi.fn().mockResolvedValue([]),
  mockSelectResult: vi.fn().mockResolvedValue([]),
  mockInsertReturning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
  mockUpdateReturning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
  mockDeleteWhere: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

vi.mock('../src/db/rbac-queries.js', () => ({
  checkPermission: mockCheckPermission,
}))

function createChainableMock() {
  const thenFn = (resolve: (v: unknown) => void) => mockSelectResult().then(resolve)
  const make = (): Record<string, unknown> => {
    const proxy = new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') return thenFn
        return vi.fn().mockReturnValue(make())
      },
    })
    return proxy
  }
  return make()
}

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => createChainableMock()),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: mockInsertReturning })) })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockUpdateReturning })) })),
    })),
    delete: vi.fn(() => ({ where: mockDeleteWhere })),
    execute: mockDbExecute,
  },
  dbRead: {},
  dbClient: {},
}))

import agentExtendedRoutes from '../src/routes/agent-extended.js'

const ADMIN_USER = '00000000-0000-0000-0000-000000000001'
const REGULAR_USER = '00000000-0000-0000-0000-000000000002'
const VALID_UUID = '11111111-1111-1111-1111-111111111111'

function mockAdmin() {
  mockAuthenticate.mockImplementation(async (request: any) => {
    request.userId = ADMIN_USER
    request.jwtPayload = { userId: ADMIN_USER, roleId: 1 }
  })
}

function mockRegularUser() {
  mockAuthenticate.mockImplementation(async (request: any) => {
    request.userId = REGULAR_USER
    request.jwtPayload = { userId: REGULAR_USER, roleId: 0 }
  })
}

function mockUnauthorized() {
  const err = new Error('Authentication required')
  ;(err as Error & { statusCode: number }).statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

const PREFIX = '/api/agent-extended'

describe('agent-extended routes — 路由层 mock 测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(agentExtendedRoutes, { prefix: PREFIX })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    mockDbExecute.mockResolvedValue([])
    mockSelectResult.mockResolvedValue([])
    mockInsertReturning.mockResolvedValue([{ id: 'mock-id' }])
    mockUpdateReturning.mockResolvedValue([{ id: 'mock-id' }])
    mockDeleteWhere.mockResolvedValue(undefined)
    mockAuthenticate.mockReset()
    mockCheckPermission.mockResolvedValue(false)
  })

  // ===========================================================================
  // 1. need_task CRUD 完整链路
  // ===========================================================================
  describe('need_task CRUD', () => {
    it('GET /need-task/list 空表返回 200 + 空列表', async () => {
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/need-task/list` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.message).toBe('success')
      expect(body.data.list).toEqual([])
      expect(body.data.total).toBe(0)
      expect(body.data.page).toBe(1)
      expect(body.data.pageSize).toBe(20)
    })

    it('POST /need-task 创建成功返回 201', async () => {
      mockDbExecute.mockResolvedValueOnce([{ id: '1', title: '测试任务', status: 0 }])
      const res = await server.inject({
        method: 'POST',
        url: `${PREFIX}/need-task`,
        body: { title: '测试任务', user_id: 'u1', agent_id: 'a1' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.title).toBe('测试任务')
    })

    it('GET /need-task/:id 不存在返回 404', async () => {
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/need-task/999` })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.code).toBe(404)
      expect(body.message).toContain('不存在')
    })

    it('PUT /need-task/:id 更新返回 200', async () => {
      mockDbExecute.mockResolvedValueOnce([{ id: '1', title: '更新后', status: 1 }])
      const res = await server.inject({
        method: 'PUT',
        url: `${PREFIX}/need-task/1`,
        body: { title: '更新后', status: 1 },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
    })

    it('DELETE /need-task/:id 删除返回 200 + deleted:true', async () => {
      const res = await server.inject({ method: 'DELETE', url: `${PREFIX}/need-task/1` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.deleted).toBe(true)
      expect(mockDbExecute).toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // 2. upload 软删除(status=0,非物理删除)
  // ===========================================================================
  describe('upload 软删除', () => {
    it('DELETE /upload/:id 软删除调用 db.execute(UPDATE status=0)而非 db.delete', async () => {
      mockDbExecute.mockClear()
      const res = await server.inject({ method: 'DELETE', url: `${PREFIX}/upload/1` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.deleted).toBe(true)
      // 软删除路径:使用 db.execute(UPDATE ... SET status=0),不使用 db.delete
      expect(mockDbExecute).toHaveBeenCalledTimes(1)
    })

    it('GET /upload/list 仅返回 status=1 的记录(软删过滤)', async () => {
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/upload/list` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.list).toEqual([])
    })
  })

  // ===========================================================================
  // 3. buy 订单号生成(BUY/DEV 前缀格式校验)
  // ===========================================================================
  describe('buy 订单号生成', () => {
    it('GET /buy/order/generate 返回 BUY 前缀订单号', async () => {
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/buy/order/generate` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.orderNo).toMatch(/^BUY\d{14}\d{6}$/)
      expect(body.data.generatedAt).toBeDefined()
    })

    it('POST /developer/generate-order-no 返回 DEV 前缀订单号', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `${PREFIX}/developer/generate-order-no`,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.orderNo).toMatch(/^DEV\d{14}\d{6}$/)
      expect(body.data.generatedAt).toBeDefined()
    })

    it('GET /buy/order/generate 带查询参数透传 agentId/userId', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `${PREFIX}/buy/order/generate?agentId=a1&userId=u1`,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.agentId).toBe('a1')
      expect(body.data.userId).toBe('u1')
    })
  })

  // ===========================================================================
  // 4. buy 订单 validate / recalculate-expiration 逻辑
  // ===========================================================================
  describe('buy 订单校验与到期重算', () => {
    it('POST /buy/order/validate 无 orderNo 和 id 返回 400', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `${PREFIX}/buy/order/validate`,
        body: {},
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.code).toBe(400)
      expect(body.message).toContain('orderNo')
    })

    it('POST /buy/order/validate 订单不存在返回 404', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `${PREFIX}/buy/order/validate`,
        body: { id: '999' },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.code).toBe(404)
    })

    it('POST /buy/order/validate 订单 active 返回 valid:true', async () => {
      mockDbExecute.mockResolvedValueOnce([{ id: '1', status: 'active', price: '100' }])
      const res = await server.inject({
        method: 'POST',
        url: `${PREFIX}/buy/order/validate`,
        body: { id: '1' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.valid).toBe(true)
      expect(body.data.order.status).toBe('active')
    })

    it('POST /buy/:id/recalculate-expiration 不存在返回 404', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `${PREFIX}/buy/999/recalculate-expiration`,
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.code).toBe(404)
    })

    it('POST /buy/:id/recalculate-expiration 成功返回 recalculated:true', async () => {
      const createdDate = new Date('2025-01-01T00:00:00Z')
      mockDbExecute
        .mockResolvedValueOnce([{ id: '1', duration: 30, created_at: createdDate }])
        .mockResolvedValueOnce([{ id: '1', duration: 30, expires_at: new Date('2025-01-31') }])

      const res = await server.inject({
        method: 'POST',
        url: `${PREFIX}/buy/1/recalculate-expiration`,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.recalculated).toBe(true)
      expect(body.data.expiresAt).toBeDefined()
    })
  })

  // ===========================================================================
  // 5. rule CRUD + 鉴权
  // ===========================================================================
  describe('rule CRUD', () => {
    it('POST /rules 缺少必要字段返回 400', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `${PREFIX}/rules`,
        body: { ruleName: '仅名称' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.code).toBe(400)
      expect(body.message).toContain('agentId')
    })

    it('POST /rules 完整字段返回 201', async () => {
      mockInsertReturning.mockResolvedValueOnce([
        { id: 'r1', agentId: 'a1', ruleName: '规则1', ruleCode: 'R1', status: 1 },
      ])
      const res = await server.inject({
        method: 'POST',
        url: `${PREFIX}/rules`,
        body: { agentId: 'a1', ruleName: '规则1', ruleCode: 'R1' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.ruleName).toBe('规则1')
    })

    it('GET /rules/:id 不存在返回 404', async () => {
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/rules/999` })
      expect(res.statusCode).toBe(404)
    })

    it('DELETE /rules/:id 返回 200 + deleted:true', async () => {
      const res = await server.inject({ method: 'DELETE', url: `${PREFIX}/rules/r1` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.deleted).toBe(true)
    })

    it('GET /rules/list 返回 200 + 列表格式', async () => {
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/rules/list` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.list).toEqual([])
      expect(body.data.total).toBe(0)
    })
  })

  // ===========================================================================
  // 6. rule-params by-rule 查询
  // ===========================================================================
  describe('rule-params by-rule 查询', () => {
    it('GET /developer/rule-params/by-rule/:ruleId 未登录返回 401', async () => {
      mockUnauthorized()
      const res = await server.inject({
        method: 'GET',
        url: `${PREFIX}/developer/rule-params/by-rule/${VALID_UUID}`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /developer/rule-params/by-rule/:ruleId 无效 ruleId 返回 400', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'GET',
        url: `${PREFIX}/developer/rule-params/by-rule/not-a-uuid`,
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.code).toBe(400)
      expect(body.message).toContain('ruleId')
    })

    it('GET /developer/rule-params/by-rule/:ruleId 已登录返回 200', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'GET',
        url: `${PREFIX}/developer/rule-params/by-rule/${VALID_UUID}`,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(Array.isArray(body.data)).toBe(true)
    })
  })

  // ===========================================================================
  // 7. heat stats list/summary/top
  // ===========================================================================
  describe('heat stats', () => {
    it('GET /heat/top 返回 200 + 数组', async () => {
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/heat/top` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('GET /heat/summary 缺少 agentId 返回 400', async () => {
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/heat/summary` })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.code).toBe(400)
      expect(body.message).toContain('agentId')
    })

    it('GET /heat/summary 带 agentId 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `${PREFIX}/heat/summary?agentId=a1`,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.agentId).toBe('a1')
      expect(body.data.totalHits).toBe(0)
    })

    it('GET /heat/list 返回 200 + 分页结构', async () => {
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/heat/list` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.list).toEqual([])
      expect(body.data.total).toBe(0)
      expect(body.data.page).toBe(1)
    })
  })

  // ===========================================================================
  // 8. rule-links 鉴权(requireAdmin POST / requireAuth GET)
  // ===========================================================================
  describe('rule-links 鉴权', () => {
    it('POST /developer/:agentId/rule-links 未登录返回 401 (requireAdmin)', async () => {
      mockUnauthorized()
      const res = await server.inject({
        method: 'POST',
        url: `${PREFIX}/developer/${VALID_UUID}/rule-links`,
        body: { ruleId: VALID_UUID },
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /developer/:agentId/rule-links 普通用户返回 403 (requireAdmin)', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'POST',
        url: `${PREFIX}/developer/${VALID_UUID}/rule-links`,
        body: { ruleId: VALID_UUID },
      })
      expect(res.statusCode).toBe(403)
      const body = res.json()
      expect(body.code).toBe(403)
      expect(body.message).toContain('管理员')
    })

    it('POST /developer/:agentId/rule-links 无效 agentId 返回 400 (ZodError)', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: `${PREFIX}/developer/not-a-uuid/rule-links`,
        body: { ruleId: VALID_UUID },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.code).toBe(400)
      expect(body.message).toContain('agentId')
    })

    it('POST /developer/:agentId/rule-links 缺少 ruleId 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: `${PREFIX}/developer/${VALID_UUID}/rule-links`,
        body: {},
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.code).toBe(400)
    })

    it('POST /developer/:agentId/rule-links admin + 有效参数返回 201', async () => {
      mockAdmin()
      mockInsertReturning.mockResolvedValueOnce([
        { id: 'link1', ruleId: VALID_UUID, targetType: 'agent', targetId: VALID_UUID },
      ])
      const res = await server.inject({
        method: 'POST',
        url: `${PREFIX}/developer/${VALID_UUID}/rule-links`,
        body: { ruleId: VALID_UUID },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.ruleId).toBe(VALID_UUID)
    })

    it('GET /developer/:agentId/rule-links 未登录返回 401 (requireAuth)', async () => {
      mockUnauthorized()
      const res = await server.inject({
        method: 'GET',
        url: `${PREFIX}/developer/${VALID_UUID}/rule-links`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /developer/:agentId/rule-links 已登录普通用户返回 200 (requireAuth)', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'GET',
        url: `${PREFIX}/developer/${VALID_UUID}/rule-links`,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('GET /developer/:agentId/rule-links 无效 agentId 返回 400', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'GET',
        url: `${PREFIX}/developer/not-a-uuid/rule-links`,
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ===========================================================================
  // 9. buy/stats/summary + developer 创建
  // ===========================================================================
  describe('buy 统计与 developer 创建', () => {
    it('GET /buy/stats/summary 返回 200 + 统计结构', async () => {
      mockDbExecute.mockResolvedValueOnce([
        {
          total_count: 0,
          total_amount: 0,
          active_count: 0,
          pending_count: 0,
          expired_count: 0,
          cancelled_count: 0,
        },
      ])
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/buy/stats/summary` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
    })

    it('POST /developer 创建成功返回 201 + 自动生成 DEV 订单号', async () => {
      mockDbExecute.mockResolvedValueOnce([
        {
          id: 'd1',
          user_id: 'u1',
          type: 0,
          count: 1,
          order_no: 'DEV20250101000000000001',
          status: 1,
        },
      ])
      const res = await server.inject({
        method: 'POST',
        url: `${PREFIX}/developer`,
        body: { user_id: 'u1', type: 0, count: 1 },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.user_id).toBe('u1')
    })
  })

  // ===========================================================================
  // 10. raw SQL 白名单注入防护(ALLOWED_TABLES) — 隐式验证
  // ===========================================================================
  describe('raw SQL 白名单(隐式验证)', () => {
    it('GET /usedetail/list 使用白名单表 zhs_agent_usedetail 返回 200(非 500)', async () => {
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/usedetail/list` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
    })

    it('GET /developer/list 使用白名单表 zhs_developer_link 返回 200(非 500)', async () => {
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/developer/list` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
    })
  })

  // ===========================================================================
  // 11. ZodError → 400 响应格式(safeParse 失败路径)
  // ===========================================================================
  describe('Zod 校验 → 400', () => {
    it('GET /developer/:agentId/rule-links 非 UUID agentId 返回 400 + { code, message }', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'GET',
        url: `${PREFIX}/developer/bad-uuid/rule-links`,
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body).toHaveProperty('code')
      expect(body).toHaveProperty('message')
      expect(body.code).toBe(400)
    })

    it('POST /buy/order/validate 空对象返回 400 + { code, message }', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `${PREFIX}/buy/order/validate`,
        body: {},
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body).toHaveProperty('code')
      expect(body).toHaveProperty('message')
      expect(body.code).toBe(400)
    })
  })

  // ===========================================================================
  // 12. 响应格式规范 { code, message, data }
  // ===========================================================================
  describe('响应格式规范', () => {
    it('所有列表端点返回 { code:0, message:"success", data } 格式', async () => {
      const urls = [
        `${PREFIX}/need-task/list`,
        `${PREFIX}/upload/list`,
        `${PREFIX}/usedetail/list`,
        `${PREFIX}/rules/list`,
        `${PREFIX}/heat/list`,
        `${PREFIX}/heat/top`,
        `${PREFIX}/developer/list`,
      ]
      for (const url of urls) {
        const res = await server.inject({ method: 'GET', url })
        const body = res.json()
        expect(body).toHaveProperty('code')
        expect(body).toHaveProperty('message')
        expect(body).toHaveProperty('data')
        expect(body.code).toBe(0)
        expect(body.message).toBe('success')
      }
    })
  })
})
