// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-229 夹具:单签约即时扣款的并发占位与终态映射。

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.WX_PAY_NOTIFY_URL ??= 'https://example.com/wx/notify'
})

const { mockDeduct, mockUpdate, mockGenerateOutTradeNo, selectQueue, claimQueue, updateSets } =
  vi.hoisted(() => ({
    mockDeduct: vi.fn(),
    mockUpdate: vi.fn(),
    mockGenerateOutTradeNo: vi.fn(() => 'IM-T-1'),
    selectQueue: [] as unknown[][],
    claimQueue: [] as unknown[][],
    updateSets: [] as Array<Record<string, unknown>>,
  }))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => selectQueue.shift() ?? [],
        }),
      }),
    })),
    update: mockUpdate,
  },
}))

vi.mock('../src/services/wechat-pay.js', () => ({
  deductRecurring: mockDeduct,
  generateOutTradeNo: mockGenerateOutTradeNo,
}))

import { chargeOneContractNow } from '../src/services/subscription-service.js'

const CONTRACT = {
  id: 7,
  userId: 'user-1',
  status: 'active',
  contractId: 'wx-contract-1',
  planId: 'plan-1',
  lastChargeStatus: 'success',
  lastChargeTime: new Date('2026-01-01T00:00:00Z'),
}
const PLAN = { price: 9900, name: 'VIP 月卡', billingPeriod: 'month' }

function setupDb() {
  selectQueue.push([CONTRACT], [PLAN])
}

describe('F-229 chargeOneContractNow 并发占位', () => {
  beforeEach(() => {
    selectQueue.length = 0
    claimQueue.length = 0
    updateSets.length = 0
    mockUpdate.mockReset()
    mockUpdate.mockImplementation(() => ({
      set: (values: Record<string, unknown>) => {
        updateSets.push(values)
        return {
          where: () => ({
            returning: async () => claimQueue.shift() ?? [],
            // 收尾 UPDATE 直接 await where(),用 then 让 await 立即结束
            then: (resolve: (v: unknown) => void) => resolve(undefined),
          }),
        }
      },
    }))
    mockDeduct.mockReset()
    mockGenerateOutTradeNo.mockReturnValue('IM-T-1')
  })

  it('第二次并发请求占位 0 行即拒绝,不会再次调用 deductRecurring', async () => {
    setupDb()
    claimQueue.push([{ id: 7 }])
    mockDeduct.mockResolvedValue({
      outTradeNo: 'IM-WX-1',
      amount: { total: 9900, currency: 'CNY' },
      tradeState: 'SUCCESS',
    })
    await chargeOneContractNow(7, 'user-1')

    // 第二次:SELECT 仍能读到旧契约(模拟并发都先通过读校验),但占位 UPDATE 影响 0 行
    setupDb()
    claimQueue.push([])
    await expect(chargeOneContractNow(7, 'user-1')).rejects.toThrow('上一笔扣款仍在处理中')

    expect(mockDeduct).toHaveBeenCalledTimes(1)
    // 变异自证:删掉条件 UPDATE 占位块(回到「先读 lastChargeStatus 再扣款」),
    // 第二次会绕过校验再次调用 deductRecurring,本断言翻红。
  })

  it('占位先写 pending,收尾按 tradeState=CLOSED 写 failed(可重试)', async () => {
    setupDb()
    claimQueue.push([{ id: 7 }])
    mockDeduct.mockResolvedValue({
      outTradeNo: 'IM-WX-2',
      amount: { total: 9900, currency: 'CNY' },
      tradeState: 'CLOSED',
    })

    await chargeOneContractNow(7, 'user-1')

    expect(updateSets[0]?.lastChargeStatus).toBe('pending')
    expect(updateSets.at(-1)?.lastChargeStatus).toBe('failed')
    // 变异自证:恢复「SUCCESS ? success : pending」后,CLOSED 会写 pending,本断言翻红。
  })

  it('tradeState=SUCCESS 写 success', async () => {
    setupDb()
    claimQueue.push([{ id: 7 }])
    mockDeduct.mockResolvedValue({
      outTradeNo: 'IM-WX-3',
      amount: { total: 9900, currency: 'CNY' },
      tradeState: 'SUCCESS',
    })

    await chargeOneContractNow(7, 'user-1')
    expect(updateSets.at(-1)?.lastChargeStatus).toBe('success')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
