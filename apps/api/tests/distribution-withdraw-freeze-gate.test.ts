// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-61:POST /distribution/withdraw 曾只插 withdrawal_flows 流水(fee:0、无冻结、无 partnerTradeNo),
 * 而 payment-extended 回调按「申请时已冻结」结算 —— SUCCESS 把 frozen 扣成负数,
 * FAIL 凭空铸币,申请期间余额未锁定且绕过 2% 手续费。
 * 判据:该端点必须走 applyWithdrawal(事务内冻结 + 手续费 + 幂等单号),
 * 失败必须如实返回错误而不是 201。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

const USER_ID = '33333333-3333-4333-8333-333333333333'

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  applyWithdrawal: vi.fn(),
  availableWithdrawal: vi.fn(),
  stepUp: vi.fn(),
}))

vi.mock('../src/db/index.js', () => {
  function chain(): Record<string, unknown> {
    const c: Record<string, unknown> = {
      from: () => c,
      where: () => c,
      offset: () => c,
      limit: () => Promise.resolve([]),
      orderBy: () => Promise.resolve([]),
      set: () => c,
      values: () => c,
      returning: () => Promise.resolve([]),
      leftJoin: () => c,
      innerJoin: () => c,
    }
    return c
  }
  const dbMock = {
    select: vi.fn(() => chain()),
    update: vi.fn(() => chain()),
    insert: vi.fn(() => chain()),
    delete: vi.fn(() => chain()),
    execute: vi.fn().mockResolvedValue([]),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

vi.mock('../src/plugins/auth.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, authenticate: mocks.authenticate }
})

vi.mock('../src/db/commission-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    applyWithdrawal: mocks.applyWithdrawal,
    availableWithdrawal: mocks.availableWithdrawal,
  }
})

vi.mock('../src/services/two-factor-step-up-store.js', () => ({
  requireStepUpForTwoFactorUser: mocks.stepUp,
}))

import { distributionRoutes } from '../src/routes/distribution.js'

describe('F-61 分销提现必须走 applyWithdrawal 冻结', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(distributionRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authenticate.mockImplementation(async (request: { userId?: string }) => {
      request.userId = USER_ID
    })
    mocks.stepUp.mockResolvedValue({ ok: true })
    mocks.availableWithdrawal.mockResolvedValue(1000)
    mocks.applyWithdrawal.mockResolvedValue({
      id: 'wd-1',
      userId: USER_ID,
      amount: 98,
      fee: 2,
      originalAmount: 100,
      status: 0,
      partnerTradeNo: 'WD1700000000000-abc',
    })
  })

  it('申请提现 ⇒ 调用 applyWithdrawal（冻结+手续费+单号），不落裸 insert', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/distribution/withdraw',
      payload: { amount: 100, method: 'wechat' },
    })
    expect(res.statusCode).toBe(201)
    expect(mocks.applyWithdrawal).toHaveBeenCalledTimes(1)
    expect(mocks.applyWithdrawal).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, amount: 100, method: 'wechat' }),
      USER_ID,
    )
    const body = res.json()
    expect(body.data.withdrawal).toMatchObject({ id: 'wd-1', fee: 2, amount: 98 })
    expect(body.data.withdrawal.partnerTradeNo).toBeTruthy()
  })

  it('冻结失败(余额不足)⇒ 如实 400，不返回成功', async () => {
    mocks.applyWithdrawal.mockRejectedValue(
      Object.assign(new Error('可提现余额不足'), { statusCode: 400 }),
    )
    const res = await app.inject({
      method: 'POST',
      url: '/api/distribution/withdraw',
      payload: { amount: 100 },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('可提现余额不足')
  })

  it('可提现额度预检不足 ⇒ 400 且不触达冻结', async () => {
    mocks.availableWithdrawal.mockResolvedValue(10)
    const res = await app.inject({
      method: 'POST',
      url: '/api/distribution/withdraw',
      payload: { amount: 100 },
    })
    expect(res.statusCode).toBe(400)
    expect(mocks.applyWithdrawal).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
