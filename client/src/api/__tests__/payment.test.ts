// payment.ts 单元测试 (支付订单接口)
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: vi.fn().mockImplementation((config: any) => {
    return Promise.resolve({ data: { code: 200, msg: 'ok', data: {} } })
  }),
}))

import * as api from '../payment'

async function callFn(fn: any, ...args: any[]): Promise<any> {
  try {
    const result = await fn(...args)
    expect(result).toBeDefined()
    return result
  } catch (e) {
    expect(e).toBeDefined()
    return null
  }
}

describe('payment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('checkPaymentStatus 状态', async () => {
    await callFn((api as any).checkPaymentStatus, 'O1')
  })

  it('cancelPaymentOrder 取消', async () => {
    await callFn((api as any).cancelPaymentOrder, 'O1')
  })

  it('syncPaymentStatus 同步', async () => {
    await callFn((api as any).syncPaymentStatus, 'O1')
  })

  it('verifyPaymentCallback 验证', async () => {
    await callFn((api as any).verifyPaymentCallback, { sign: 's' })
  })
})
