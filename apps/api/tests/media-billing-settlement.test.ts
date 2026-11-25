// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 媒体积分结算边界：部分扣减、幂等重放、失败不阻塞产物、402 结构。
 * 定价快照固定为 per_image 20 分/张，避免测试依赖真实库。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  settlePointsUsage: vi.fn(),
  findActivePricingForMode: vi.fn(),
  getSpendableBalance: vi.fn(),
}))

vi.mock('../src/services/points-service.js', () => ({
  settlePointsUsage: mocks.settlePointsUsage,
}))

vi.mock('../src/services/pricing-service.js', () => ({
  findActivePricingForMode: mocks.findActivePricingForMode,
}))

vi.mock('../src/services/daily-credits.js', () => ({
  getSpendableBalance: mocks.getSpendableBalance,
}))

import { chargeMediaPoints, ensureMediaPointsBalance } from '../src/services/media-billing.js'

function makeRequest() {
  return { userId: 'u-1', log: { warn: vi.fn() } } as never
}

function makeReply() {
  const reply = {
    code: 200,
    body: undefined as unknown,
    status: vi.fn((code: number) => {
      reply.code = code
      return reply
    }),
    send: vi.fn((body: unknown) => {
      reply.body = body
      return reply
    }),
  }
  return reply
}

describe('媒体积分结算', () => {
  beforeEach(() => {
    mocks.settlePointsUsage.mockReset().mockResolvedValue({
      deducted: 40,
      remaining: 0,
      shortfall: 0,
      alreadySettled: false,
    })
    mocks.findActivePricingForMode.mockReset().mockResolvedValue({
      billingMode: 'per_image',
      perUnitPrice: 20,
      videoUnit: null,
    })
    mocks.getSpendableBalance.mockReset().mockResolvedValue({
      permanent: 0,
      daily: 0,
      available: 0,
    })
  })

  it('成功后按报价金额走 settlePointsUsage(source=ai_media)', async () => {
    const request = makeRequest()
    const result = await chargeMediaPoints(request, 'gpt-image-1', 'image', 2, 'img:task-1')

    expect(result).toBe(40)
    expect(mocks.settlePointsUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        amount: 40,
        source: 'ai_media',
        referenceId: 'img:task-1',
      }),
    )
  })

  it('余额不足时部分扣减并返回实扣数,不误报全额', async () => {
    mocks.settlePointsUsage.mockResolvedValueOnce({
      deducted: 10,
      remaining: 0,
      shortfall: 30,
      alreadySettled: false,
    })
    const request = makeRequest()
    const result = await chargeMediaPoints(request, 'gpt-image-1', 'image', 2, 'img:task-2')

    expect(result).toBe(10)
    expect((request as { log: { warn: ReturnType<typeof vi.fn> } }).log.warn).toHaveBeenCalled()
  })

  it('幂等重放返回 0,不重复计为本次扣费', async () => {
    mocks.settlePointsUsage.mockResolvedValueOnce({
      deducted: 40,
      remaining: 0,
      shortfall: 0,
      alreadySettled: true,
    })
    const result = await chargeMediaPoints(makeRequest(), 'gpt-image-1', 'image', 2, 'img:task-3')
    expect(result).toBe(0)
  })

  it('结算异常不阻塞已交付产物,返回 0 并留日志', async () => {
    mocks.settlePointsUsage.mockRejectedValueOnce(new Error('db down'))
    const request = makeRequest()
    const result = await chargeMediaPoints(request, 'gpt-image-1', 'image', 2, 'img:task-4')

    expect(result).toBe(0)
    expect((request as { log: { warn: ReturnType<typeof vi.fn> } }).log.warn).toHaveBeenCalled()
  })

  it('预检 402 返回 INSUFFICIENT_POINTS 与结构化报价', async () => {
    mocks.getSpendableBalance.mockResolvedValueOnce({ permanent: 10, daily: 0, available: 10 })
    const request = makeRequest()
    const reply = makeReply()

    const ok = await ensureMediaPointsBalance(request, reply as never, 'gpt-image-1', 'image', 2)
    expect(ok).toBe(false)
    expect(reply.code).toBe(402)
    expect(reply.body).toMatchObject({
      code: 402,
      errorCode: 'INSUFFICIENT_POINTS',
      data: { balance: 10, required: 40, category: 'image', applied_units: 2 },
    })
  })
})
