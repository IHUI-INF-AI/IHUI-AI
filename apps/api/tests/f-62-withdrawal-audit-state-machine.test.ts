// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-62 夹具:提现审核必须走状态机(approve/reject),reject 必须退款,重复处理返回 409。

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockApprove, mockReject, mockRequireAdmin } = vi.hoisted(() => ({
  mockApprove: vi.fn(),
  mockReject: vi.fn(),
  mockRequireAdmin: vi.fn(),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: mockRequireAdmin,
}))

vi.mock('../src/db/index.js', () => ({ db: { select: vi.fn(), update: vi.fn() } }))

vi.mock('../src/db/commission-queries.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    approveWithdrawal: mockApprove,
    rejectWithdrawal: mockReject,
  }
})

import { financeRoutes } from '../src/routes/finance.js'

const ADMIN_ID = '22222222-2222-4222-8222-222222222222'
const FLOW_ID = '11111111-1111-4111-8111-111111111111'
const AUDIT_URL = `/api/admin/finance/withdrawal/${FLOW_ID}/audit`

describe('F-62 提现审核状态机', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(financeRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockImplementation(async (request: { userId?: string }) => {
      request.userId = ADMIN_ID
    })
  })

  it('approved 走 approveWithdrawal(0→1),不再裸 UPDATE', async () => {
    mockApprove.mockResolvedValue({ id: FLOW_ID, status: 1 })
    const res = await app.inject({
      method: 'PUT',
      url: AUDIT_URL,
      payload: { status: 'approved' },
    })
    expect(res.statusCode).toBe(200)
    expect(mockApprove).toHaveBeenCalledWith(FLOW_ID, ADMIN_ID)
    expect(mockReject).not.toHaveBeenCalled()
    // 变异自证:恢复无条件 db.update(withdrawalFlows) 后,approveWithdrawal 不会被调用,本断言翻红。
  })

  it('rejected 走 rejectWithdrawal 且带驳回原因(同事务退还冻结)', async () => {
    mockReject.mockResolvedValue({ id: FLOW_ID, status: 3 })
    const res = await app.inject({
      method: 'PUT',
      url: AUDIT_URL,
      payload: { status: 'rejected', remark: '风控驳回' },
    })
    expect(res.statusCode).toBe(200)
    expect(mockReject).toHaveBeenCalledWith(FLOW_ID, '风控驳回', ADMIN_ID)
    // 变异自证:恢复裸 UPDATE 后 frozen 不退还,rejectWithdrawal 未被调用,本断言翻红。
  })

  it('rejected 未填原因时落默认文案', async () => {
    mockReject.mockResolvedValue({ id: FLOW_ID, status: 3 })
    await app.inject({ method: 'PUT', url: AUDIT_URL, payload: { status: 'rejected' } })
    expect(mockReject).toHaveBeenCalledWith(FLOW_ID, '管理员驳回', ADMIN_ID)
  })

  it('状态机判定 0 行(已处理/不存在)→ 409,不得覆盖已完成流水', async () => {
    mockApprove.mockResolvedValue(undefined)
    const res = await app.inject({
      method: 'PUT',
      url: AUDIT_URL,
      payload: { status: 'approved' },
    })
    expect(res.statusCode).toBe(409)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
