// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 报销自助面路由行为测试(2026-11-24 十一波)。
 *
 * 只钉路由层的四件事,不触库、不触真服务(§5 测试隔离):
 *   ① /my/approvers 必须在(401 vs 200 双态);
 *   ② /my/submit 缺省 approverChain 时把 undefined 交给服务层解析(不在路由里猜人);
 *   ③ 超 8 人链 / 无票据 在 zod 层 400,不进服务;
 *   ④ /my 返回把"当前审批人 uuid"翻成姓名,不把 uuid 直接甩给界面。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const submitMock = vi.fn()
const listMock = vi.fn()

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ id: 'emp-1' }],
        }),
      }),
    }),
  },
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  // requirePermission 是"工厂→handler"(同步返回函数);requireSelf 本身是 handler
  requirePermission: () => async () => {},
  requireSelf: async () => {},
}))

vi.mock('../src/services/hr-expense.js', () => ({
  submitClaim: (...args: unknown[]) => submitMock(...args),
  listClaims: (...args: unknown[]) => listMock(...args),
  decideClaim: vi.fn(),
  getClaim: vi.fn(),
  linkVoucher: vi.fn(),
  payClaim: vi.fn(),
  voidClaim: vi.fn(),
}))

vi.mock('../src/services/hr-expense-approvers.js', () => ({
  loadExpenseApproverRoster: async () => ({
    candidates: [{ userId: 'u-2', name: '财务小王', source: 'finance' }],
    defaultChain: ['u-2'],
    warnings: [],
  }),
  expenseApproverNames: async () => ({ 'u-2': '财务小王' }),
}))

import { hrExpenseRoutes } from '../src/routes/hr-expense.js'

const CHAIN_ID = '11111111-1111-4111-8111-111111111111'

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  app.decorateRequest('user', null)
  app.addHook('onRequest', async (request) => {
    const uid = request.headers['x-test-user']
    if (typeof uid === 'string' && uid) {
      ;(request as { user?: unknown }).user = { id: uid }
    }
  })
  await app.register(hrExpenseRoutes, { prefix: '/api/hr-expense' })
  await app.ready()
  return app
}

const vouchers = [{ fileId: 'f-1', name: '发票.jpg', url: '/files/f-1' }]

describe('hr-expense 自助面路由', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    submitMock.mockReset()
    listMock.mockReset()
    submitMock.mockResolvedValue({ id: 'claim-1' })
    listMock.mockResolvedValue([])
    app = await buildApp()
  })

  it('GET /my/approvers 未登录 → 401(不泄漏候选池)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/hr-expense/my/approvers' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /my/approvers 登录 → 200 且带默认链与候选人', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/hr-expense/my/approvers',
      headers: { 'x-test-user': 'user-1' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.defaultChain).toEqual(['u-2'])
    expect(body.data.candidates[0].name).toBe('财务小王')
  })

  it('POST /my/submit 缺省 approverChain → 交给服务层解析(路由不猜人)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/hr-expense/my/submit',
      headers: { 'x-test-user': 'user-1' },
      payload: { category: 'office', title: '打印纸', amount: '12.50', vouchers },
    })
    expect(res.statusCode).toBe(200)
    const arg = submitMock.mock.calls[0][0] as { approverChain?: string[] }
    expect(arg.approverChain).toBeUndefined()
  })

  it('POST /my/submit 9 人链 → 400(zod 上限 8)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/hr-expense/my/submit',
      headers: { 'x-test-user': 'user-1' },
      payload: {
        category: 'office',
        title: '打印纸',
        amount: '12.50',
        vouchers,
        approverChain: Array.from({ length: 9 }, () => CHAIN_ID),
      },
    })
    expect(res.statusCode).toBe(400)
    expect(submitMock).not.toHaveBeenCalled()
  })

  it('POST /my/submit 无票据 → 400(裸金额不入账)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/hr-expense/my/submit',
      headers: { 'x-test-user': 'user-1' },
      payload: { category: 'office', title: '打印纸', amount: '12.50', vouchers: [] },
    })
    expect(res.statusCode).toBe(400)
    expect(submitMock).not.toHaveBeenCalled()
  })

  it('GET /my 把当前审批人 uuid 翻成姓名(界面不见 uuid)', async () => {
    listMock.mockResolvedValue([
      {
        id: 'claim-1',
        title: '打印纸',
        status: 'submitted',
        currentStep: 0,
        approverChain: ['u-2'],
      },
    ])
    const res = await app.inject({
      method: 'GET',
      url: '/api/hr-expense/my',
      headers: { 'x-test-user': 'user-1' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list[0].currentApproverName).toBe('财务小王')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
