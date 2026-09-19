// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌​‌‌​‌‍‍‌​‌​​‌​‍‍​‌‌​​‌‌‍‍​​‌​‌‌​‌‍‍​‌‌‌​‌‌‌‍‍​‌​‌​​​‌‌‍‍‌​‌‌​​​​‌‍‍​‌‌​​‌​‌‍‍​‌​‌​‌‌​‌‌​‌‍‍‌​‌​‌​‍‍‌​‌‌‌​‌‌‍‍​‌​‌‌‌‌​‌‍‍​‌​​‌‌​‌‍‍​‌​​‌‌​‍‍​‌‌​‌‌‌‌‍‍‌​‌​‌‌​‌‍‍​‌​‌​​‌‍‍​‌‌​​‌​‍‍​‌‌​​‌‌​‌​‍‍‌​‌‌​‌​‌‍‍‌‌​‌‌​‍‍​‌​‌​‌​‍‍​‌​‌​​​​‌‍‍‌‌​​‌‌​​​‌‌​‌​‍‍‌‌​‌​‌​​‍‍​‌‌​​‌‌‌​‍‍‌​‌‌‌​‍‍‌​‌​‌‍‍‌‌​‌‌‌‌‍‍​‌‌​‌‌​‌‍‍​‌‌​‌​​‌‍‍​‌‌​‌‌​‌‍‍​‌‌​​‌‌‌​‍‍​‌​‌​‌​‍‍​‌‌​‌‌‌‍‍‌​‌​‌​‍‍​‌​‌​‌‍‍​‌​​‌‌​‌‌⁠

/**
 * 教育食堂采购记账路由测试(2026-09-19 立)。
 *
 * 覆盖面:
 * - 鉴权:401 未登录 / 403 无权限 / 管理员放行
 * - 参数校验:非法 uuid / 空 image / 空供应商名
 * - AI 三轮编排:抽取失败 502 / 两轮一致 ai_verified / 三轮仲裁 / 明细落库与回读
 * - 状态机:confirm 404 / 已记账幂等拒绝 / 正常记账
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(),
}))

// 注意:以下模块 mock 均为纯 vi.fn(),持久默认实现在 beforeEach 统一重建。
// (vi.resetAllMocks 会清除实现与 *Once 队列,不能依赖工厂内联实现存活)
vi.mock('../../db/usercenter-queries.js', () => ({ getUserStatus: vi.fn() }))

vi.mock('jose', () => ({
  decodeJwt: vi.fn(),
}))

vi.mock('../../db/rbac-queries.js', () => ({
  checkAnyPermission: vi.fn(),
}))

vi.mock('../../db/index.js', () => {
  interface DbChain {
    then: (resolve: (value: unknown) => unknown) => Promise<unknown>
    from: () => DbChain
    where: () => DbChain
    orderBy: () => DbChain
    limit: () => DbChain
    offset: () => DbChain
    values: () => DbChain
    set: () => DbChain
    returning: () => DbChain
  }
  function createChain(result: unknown[] = []): DbChain {
    const chain: DbChain = {
      then: (resolve) => Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      values: () => chain,
      set: () => chain,
      returning: () => chain,
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() => createChain()),
      insert: vi.fn(() => createChain()),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
      // 事务:tx 直接复用 db mock(链式行为一致)
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(dbRef())),
    },
  }
})

vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceFetch: vi.fn(),
  aiServiceFetchStream: vi.fn(),
  aiServiceSystemFetch: vi.fn(),
}))

import eduCanteenRoutes from '../edu-canteen.js'
import { verifyAccessToken } from '@ihui/auth'
import { decodeJwt } from 'jose'
import { getUserStatus } from '../../db/usercenter-queries.js'
import { checkAnyPermission } from '../../db/rbac-queries.js'
import { aiServiceFetch } from '../../utils/ai-service-fetch.js'

const { db } = await import('../../db/index.js')

function dbRef() {
  return db
}

const AUTH_HEADERS = { authorization: 'Bearer mock-token' }
const USER_ID = '22222222-2222-4222-8222-222222222222'
const PROC_ID = '33333333-3333-4333-9333-333333333333'

function mockAuth(roleId = 0): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: USER_ID,
    phone: '13800000000',
    roleId,
  } as never)
}

function mockChain(result: unknown): never {
  const chain: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  }
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'values', 'set', 'returning']) {
    chain[m] = () => chain
  }
  return chain as never
}

// ---------------------------------------------------------------------------
// AI 响应 fixture(与 ai-service 三轮端点返回结构对齐)
// ---------------------------------------------------------------------------

const RECEIPT = {
  supplierName: '绿源蔬菜批发',
  receiptDate: '2026-09-18',
  receiptNo: 'NO-123456',
  totalAmount: 100.5,
  items: [
    { name: '土豆', category: '蔬菜', quantity: 10, unit: '斤', unitPrice: 2.5, amount: 25 },
    { name: '五花肉', category: '肉禽', quantity: 5, unit: '斤', unitPrice: 15.1, amount: 75.5 },
  ],
}

function aiOk(overrides: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ ok: true, verification: null, error: null, ...overrides }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function extractResp(receipt: unknown = RECEIPT): Response {
  return aiOk({
    verification: {
      round: 1,
      type: 'extract',
      model: 'gpt-4o-mini',
      at: '2026-09-19T10:00:00.000Z',
      receipt,
      checks: [],
      differences: [],
      confidence: 92,
      ok: true,
      error: null,
    },
  })
}

function verifyResp(ok: boolean, receipt: unknown = RECEIPT): Response {
  return aiOk({
    verification: {
      round: 2,
      type: 'verify',
      model: 'gpt-4o-mini',
      at: '2026-09-19T10:00:05.000Z',
      receipt,
      checks: [],
      differences: ok ? [] : [{ field: 'totalAmount', round1: 100.5, round2: 100.6 }],
      confidence: ok ? 93 : 60,
      ok,
      error: null,
    },
  })
}

function arbitrateResp(ok: boolean, receipt: unknown = RECEIPT): Response {
  return aiOk({
    verification: {
      round: 3,
      type: 'arbitrate',
      model: 'gpt-4o-mini',
      at: '2026-09-19T10:00:10.000Z',
      receipt,
      checks: [],
      differences: [],
      confidence: 90,
      ok,
      error: null,
    },
  })
}

const IMAGE = 'data:image/jpeg;base64,' + 'A'.repeat(64)
const AI_ANALYZE_BODY = { image: IMAGE, saveImage: false }

function makeProc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: PROC_ID,
    procurementDate: '2026-09-18',
    supplierName: '绿源蔬菜批发',
    receiptNo: 'NO-123456',
    totalAmount: '100.50',
    itemCount: 2,
    receiptImageUrl: IMAGE,
    status: 'ai_verified',
    aiRounds: 2,
    aiVerifications: [],
    aiConfidence: 93,
    notes: null,
    createdBy: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    procurementId: PROC_ID,
    itemName: '土豆',
    category: '蔬菜',
    quantity: '10',
    unit: '斤',
    unitPrice: '2.5',
    amount: '25',
    verifyStatus: 'ok',
    sortOrder: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('edu-canteen 路由', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(eduCanteenRoutes, { prefix: '/api/edu-canteen' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    // 用 resetAllMocks(而非 clearAllMocks):除了清调用记录,还清空实现与 *Once 队列。
    // 根因:clearAllMocks 不清 once 队列,上一用例未消费的 once mock
    // (如 401 用例排的 verifyAccessToken.mockRejectedValueOnce,无 token 时根本不会被调用)
    // 会泄漏到后续用例造成状态错位(403 变 401 / db.select 消费到残留 count mock)。
    vi.resetAllMocks()
    // ---- 持久默认实现统一重建(reset 已清空一切实现) ----
    mockAuth()
    vi.mocked(getUserStatus).mockResolvedValue(1) // 用户状态正常(1=活跃)
    vi.mocked(checkAnyPermission).mockResolvedValue(false) // 默认无权限,用例自行覆盖
    vi.mocked(decodeJwt).mockImplementation(() => ({ type: 'access' }) as never)
    vi.mocked(db.execute).mockResolvedValue([] as never)
    // db 链式查询默认返回空结果集,用例以 mockReturnValueOnce 精确覆盖
    vi.mocked(db.select).mockImplementation(() => mockChain([]))
    vi.mocked(db.insert).mockImplementation(() => mockChain([]))
    vi.mocked(db.update).mockImplementation(() => mockChain([]))
    vi.mocked(db.delete).mockImplementation(() => mockChain([]))
    // 事务:tx 直接复用 db mock(链式行为一致)
    // (fn 参数交由 TS 按真实 transaction 签名推断,仅 db 断言为 never 以通过逆变检查)
    vi.mocked(db.transaction).mockImplementation(async (fn) => fn(db as never) as Promise<unknown>)
  })

  describe('鉴权', () => {
    it('未携带 token → 401', async () => {
      vi.mocked(verifyAccessToken).mockRejectedValueOnce(new Error('invalid token'))
      const res = await app.inject({ method: 'GET', url: '/api/edu-canteen/procurement' })
      expect(res.statusCode).toBe(401)
    })

    it('普通用户无 edu:view/edu:manage 权限 → 403', async () => {
      mockAuth(0)
      vi.mocked(checkAnyPermission).mockResolvedValueOnce(false)
      const res = await app.inject({
        method: 'GET',
        url: '/api/edu-canteen/procurement',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(403)
      expect(checkAnyPermission).toHaveBeenCalledWith(USER_ID, ['edu:view', 'edu:manage'])
    })

    it('持有 edu:view 权限 → 200 列表', async () => {
      mockAuth(0)
      vi.mocked(checkAnyPermission).mockResolvedValueOnce(true)
      vi.mocked(db.select).mockReturnValueOnce(mockChain([{ count: 0 }])) // count
      vi.mocked(db.select).mockReturnValueOnce(mockChain([])) // list
      const res = await app.inject({
        method: 'GET',
        url: '/api/edu-canteen/procurement',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.total).toBe(0)
      expect(body.data.list).toEqual([])
    })

    it('写操作需 edu:manage(view 不足)→ 403', async () => {
      mockAuth(0)
      vi.mocked(checkAnyPermission).mockResolvedValueOnce(false)
      const res = await app.inject({
        method: 'POST',
        url: '/api/edu-canteen/supplier',
        headers: AUTH_HEADERS,
        payload: { name: '测试供应商' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('管理员(roleId>=1)直接放行', async () => {
      mockAuth(1)
      vi.mocked(db.select).mockReturnValueOnce(mockChain([{ count: 0 }]))
      vi.mocked(db.select).mockReturnValueOnce(mockChain([]))
      const res = await app.inject({
        method: 'GET',
        url: '/api/edu-canteen/procurement',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(checkAnyPermission).not.toHaveBeenCalled()
    })
  })

  describe('参数校验', () => {
    it('GET /procurement/:id 非法 uuid → 400', async () => {
      mockAuth(1)
      const res = await app.inject({
        method: 'GET',
        url: '/api/edu-canteen/procurement/not-a-uuid',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(400)
    })

    it('POST /procurement/ai-analyze 空 image → 400', async () => {
      mockAuth(1)
      const res = await app.inject({
        method: 'POST',
        url: '/api/edu-canteen/procurement/ai-analyze',
        headers: AUTH_HEADERS,
        payload: { image: 'x' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('POST /supplier 缺名称 → 400', async () => {
      mockAuth(1)
      const res = await app.inject({
        method: 'POST',
        url: '/api/edu-canteen/supplier',
        headers: AUTH_HEADERS,
        payload: { category: '蔬菜' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('POST /procurement/ai-analyze — AI 三轮编排', () => {
    it('第1轮抽取服务异常 → 502', async () => {
      mockAuth(1)
      vi.mocked(aiServiceFetch).mockRejectedValueOnce(new Error('connect refused'))
      const res = await app.inject({
        method: 'POST',
        url: '/api/edu-canteen/procurement/ai-analyze',
        headers: AUTH_HEADERS,
        payload: AI_ANALYZE_BODY,
      })
      expect(res.statusCode).toBe(502)
      expect(res.json().message).toContain('AI 服务不可用')
    })

    it('第1轮识别失败 → 502 透传错误', async () => {
      mockAuth(1)
      vi.mocked(aiServiceFetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: false, verification: null, error: '小票模糊,无法识别' }),
          { status: 200 },
        ),
      )
      const res = await app.inject({
        method: 'POST',
        url: '/api/edu-canteen/procurement/ai-analyze',
        headers: AUTH_HEADERS,
        payload: AI_ANALYZE_BODY,
      })
      expect(res.statusCode).toBe(502)
      expect(res.json().message).toContain('小票模糊')
    })

    it('两轮一致 → 201 ai_verified + aiRounds=2,只调 2 次 AI', async () => {
      mockAuth(1)
      vi.mocked(aiServiceFetch)
        .mockResolvedValueOnce(extractResp())
        .mockResolvedValueOnce(verifyResp(true))
      const created = makeProc({ status: 'ai_verified', aiRounds: 2 })
      vi.mocked(db.transaction).mockImplementationOnce(
        async (fn) => fn(db as never) as Promise<unknown>,
      )
      vi.mocked(db.insert).mockReturnValueOnce(mockChain([created])) // 台账主表
      vi.mocked(db.insert).mockReturnValueOnce(mockChain([])) // 明细
      vi.mocked(db.select).mockReturnValueOnce(
        mockChain([makeItem(), makeItem({ itemName: '五花肉' })]),
      ) // 回读明细

      const res = await app.inject({
        method: 'POST',
        url: '/api/edu-canteen/procurement/ai-analyze',
        headers: AUTH_HEADERS,
        payload: AI_ANALYZE_BODY,
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.procurement.status).toBe('ai_verified')
      expect(body.data.procurement.aiRounds).toBe(2)
      expect(body.data.procurement.totalAmount).toBe(100.5)
      expect(body.data.items).toHaveLength(2)
      expect(body.data.items[0].quantity).toBe(10) // numeric string → number
      expect(aiServiceFetch).toHaveBeenCalledTimes(2)
      // 第2轮入参携带第1轮 receipt 作比对基准
      // (aiServiceFetch 第3参是 fetch init,payload 序列化在 body 字符串里)
      const verifyCall = vi.mocked(aiServiceFetch).mock.calls[1]
      expect(verifyCall?.[1]).toBe('/api/edu-canteen-receipt/verify')
      const verifyBody = JSON.parse((verifyCall?.[2] as RequestInit).body as string) as {
        first: Record<string, unknown>
      }
      expect(verifyBody.first).toMatchObject({
        supplierName: '绿源蔬菜批发',
      })
    })

    it('两轮有差异且仲裁通过 → 201 ai_verified + aiRounds=3', async () => {
      mockAuth(1)
      vi.mocked(aiServiceFetch)
        .mockResolvedValueOnce(extractResp())
        .mockResolvedValueOnce(verifyResp(false))
        .mockResolvedValueOnce(arbitrateResp(true))
      const created = makeProc({ status: 'ai_verified', aiRounds: 3 })
      vi.mocked(db.transaction).mockImplementationOnce(
        async (fn) => fn(db as never) as Promise<unknown>,
      )
      vi.mocked(db.insert).mockReturnValueOnce(mockChain([created]))
      vi.mocked(db.insert).mockReturnValueOnce(mockChain([]))
      vi.mocked(db.select).mockReturnValueOnce(mockChain([makeItem()]))

      const res = await app.inject({
        method: 'POST',
        url: '/api/edu-canteen/procurement/ai-analyze',
        headers: AUTH_HEADERS,
        payload: AI_ANALYZE_BODY,
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.procurement.status).toBe('ai_verified')
      expect(body.data.procurement.aiRounds).toBe(3)
      expect(aiServiceFetch).toHaveBeenCalledTimes(3)
      expect(vi.mocked(aiServiceFetch).mock.calls[2]?.[1]).toBe(
        '/api/edu-canteen-receipt/arbitrate',
      )
    })

    it('两轮有差异且仲裁仍冲突 → 201 ai_conflict', async () => {
      mockAuth(1)
      vi.mocked(aiServiceFetch)
        .mockResolvedValueOnce(extractResp())
        .mockResolvedValueOnce(verifyResp(false))
        .mockResolvedValueOnce(arbitrateResp(false))
      const created = makeProc({ status: 'ai_conflict', aiRounds: 3 })
      vi.mocked(db.transaction).mockImplementationOnce(
        async (fn) => fn(db as never) as Promise<unknown>,
      )
      vi.mocked(db.insert).mockReturnValueOnce(mockChain([created]))
      vi.mocked(db.insert).mockReturnValueOnce(mockChain([]))
      vi.mocked(db.select).mockReturnValueOnce(mockChain([]))

      const res = await app.inject({
        method: 'POST',
        url: '/api/edu-canteen/procurement/ai-analyze',
        headers: AUTH_HEADERS,
        payload: AI_ANALYZE_BODY,
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().data.procurement.status).toBe('ai_conflict')
    })

    it('第2轮服务异常 → 保持 ai_extracted(单轮结果落库)', async () => {
      mockAuth(1)
      vi.mocked(aiServiceFetch)
        .mockResolvedValueOnce(extractResp())
        .mockRejectedValueOnce(new Error('connect refused'))
      const created = makeProc({ status: 'ai_extracted', aiRounds: 1 })
      vi.mocked(db.transaction).mockImplementationOnce(
        async (fn) => fn(db as never) as Promise<unknown>,
      )
      vi.mocked(db.insert).mockReturnValueOnce(mockChain([created]))
      vi.mocked(db.insert).mockReturnValueOnce(mockChain([]))
      vi.mocked(db.select).mockReturnValueOnce(mockChain([]))

      const res = await app.inject({
        method: 'POST',
        url: '/api/edu-canteen/procurement/ai-analyze',
        headers: AUTH_HEADERS,
        payload: AI_ANALYZE_BODY,
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.procurement.status).toBe('ai_extracted')
      expect(body.data.procurement.aiRounds).toBe(1)
    })
  })

  describe('POST /procurement/:id/confirm — 状态机', () => {
    it('单据不存在 → 404', async () => {
      mockAuth(1)
      vi.mocked(db.select).mockReturnValueOnce(mockChain([]))
      const res = await app.inject({
        method: 'POST',
        url: `/api/edu-canteen/procurement/${PROC_ID}/confirm`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(404)
    })

    it('已记账(confirmed)重复确认 → 400', async () => {
      mockAuth(1)
      vi.mocked(db.select).mockReturnValueOnce(mockChain([makeProc({ status: 'confirmed' })]))
      const res = await app.inject({
        method: 'POST',
        url: `/api/edu-canteen/procurement/${PROC_ID}/confirm`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('勿重复确认')
    })

    it('已作废(voided)不可记账 → 400', async () => {
      mockAuth(1)
      vi.mocked(db.select).mockReturnValueOnce(mockChain([makeProc({ status: 'voided' })]))
      const res = await app.inject({
        method: 'POST',
        url: `/api/edu-canteen/procurement/${PROC_ID}/confirm`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('不可记账')
    })

    it('ai_verified 正常记账 → 200 confirmed', async () => {
      mockAuth(1)
      vi.mocked(db.select).mockReturnValueOnce(mockChain([makeProc({ status: 'ai_verified' })]))
      vi.mocked(db.update).mockReturnValueOnce(mockChain([makeProc({ status: 'confirmed' })]))
      const res = await app.inject({
        method: 'POST',
        url: `/api/edu-canteen/procurement/${PROC_ID}/confirm`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.procurement.status).toBe('confirmed')
      expect(body.data.procurement.totalAmount).toBe(100.5)
    })
  })

  describe('POST /procurement/:id/void — 作废', () => {
    it('正常作废 → 200 voided', async () => {
      mockAuth(1)
      vi.mocked(db.select).mockReturnValueOnce(mockChain([makeProc({ status: 'confirmed' })]))
      vi.mocked(db.update).mockReturnValueOnce(mockChain([makeProc({ status: 'voided' })]))
      const res = await app.inject({
        method: 'POST',
        url: `/api/edu-canteen/procurement/${PROC_ID}/void`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.procurement.status).toBe('voided')
    })

    it('重复作废 → 400', async () => {
      mockAuth(1)
      vi.mocked(db.select).mockReturnValueOnce(mockChain([makeProc({ status: 'voided' })]))
      const res = await app.inject({
        method: 'POST',
        url: `/api/edu-canteen/procurement/${PROC_ID}/void`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('GET /export — 台账导出', () => {
    // excel-export-service(ExcelJS)真实运行不 mock,验证导出全链路;
    // 空数据集下 xlsx 仅含表头行,依然能验证 MIME 与 zip 容器魔数
    it('默认 format=xlsx → 真 Excel(xlsx MIME + zip 魔数 PK)', async () => {
      mockAuth(1)
      vi.mocked(db.select).mockReturnValueOnce(mockChain([])) // procs 空 → 不再查明细
      const res = await app.inject({
        method: 'GET',
        url: '/api/edu-canteen/export',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet')
      expect(res.headers['content-disposition']).toContain('.xlsx')
      // xlsx 为 zip 容器,前两字节魔数 "PK"(rawPayload 为原始 Buffer)
      expect(res.rawPayload.subarray(0, 2).toString('latin1')).toBe('PK')
    })

    it('format=csv → UTF-8 BOM + 中文表头', async () => {
      mockAuth(1)
      vi.mocked(db.select).mockReturnValueOnce(mockChain([]))
      const res = await app.inject({
        method: 'GET',
        url: '/api/edu-canteen/export?format=csv',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('text/csv')
      expect(res.body.charCodeAt(0)).toBe(0xfeff) // \ufeff BOM
      expect(res.body).toContain('供应商')
    })

    it('format 非法值 → 400', async () => {
      mockAuth(1)
      const res = await app.inject({
        method: 'GET',
        url: '/api/edu-canteen/export?format=pdf',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(400)
    })
  })
})
