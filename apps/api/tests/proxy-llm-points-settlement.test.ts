// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 普通 LLM 代理的“双账”收口测试：
 * - 平台成本先落 ai_cost_records（与用户积分无关，失败不阻塞）；
 * - 用户积分统一走 settleLlmPointsUsage（部分结算/幂等由 points-service 负责）；
 * - 预检按请求体估算 prompt，余额不足由 ensureLlmPointsBalance 统一 402。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  recordAiCost: vi.fn(async () => ({ cost: 1, currency: 'CNY' })),
  settleLlmPointsUsage: vi.fn(async () => ({
    deducted: 3,
    remaining: 100,
    shortfall: 0,
    alreadySettled: false,
    quote: { points: 3 },
  })),
  ensureLlmPointsBalance: vi.fn(
    async (_request: unknown, _reply: unknown, _modelId: string, _promptTokens: number, _completionTokens = 0) =>
      true,
  ),
}))

vi.mock('../src/plugins/ai-cost.js', () => ({
  recordAiCost: mocks.recordAiCost,
  resolveAiCost: vi.fn(),
}))

vi.mock('../src/services/ai-points-billing.js', () => ({
  ensureLlmPointsBalance: mocks.ensureLlmPointsBalance,
  settleLlmPointsUsage: mocks.settleLlmPointsUsage,
  quoteLlmPoints: vi.fn(),
  computeLlmPoints: vi.fn(),
}))

import { chargePointsForCall, ensurePointsBalance } from '../src/routes/ai-vendors/proxy-llm.js'

function makeRequest(body: unknown = { model: 'openai/gpt-4o', messages: [{ role: 'user' }] }) {
  return {
    userId: 'u-1',
    body,
    log: { warn: vi.fn(), error: vi.fn() },
  } as never
}

describe('普通 LLM 代理 — 成本与积分双账', () => {
  beforeEach(() => {
    mocks.recordAiCost.mockReset().mockResolvedValue({ cost: 1, currency: 'CNY' })
    mocks.settleLlmPointsUsage.mockReset().mockResolvedValue({
      deducted: 3,
      remaining: 100,
      shortfall: 0,
      alreadySettled: false,
      quote: { points: 3 },
    })
    mocks.ensureLlmPointsBalance.mockReset().mockResolvedValue(true)
  })

  it('按 usage 同时记平台成本与扣用户积分', async () => {
    const request = makeRequest()
    const data = { usage: { prompt_tokens: 1000, completion_tokens: 500 } }

    await chargePointsForCall(request, 'openai/gpt-4o', data, 'req-1')

    expect(mocks.recordAiCost).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        model: 'openai/gpt-4o',
        provider: 'openai',
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        requestType: 'llm_chat',
      }),
    )
    expect(mocks.settleLlmPointsUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        modelId: 'openai/gpt-4o',
        promptTokens: 1000,
        completionTokens: 500,
        source: 'llm_chat',
        referenceId: 'req-1',
      }),
    )
  })

  it('无 usage 时两边都不动，避免估算误扣', async () => {
    await chargePointsForCall(makeRequest(), 'openai/gpt-4o', { choices: [] }, 'req-2')
    expect(mocks.recordAiCost).not.toHaveBeenCalled()
    expect(mocks.settleLlmPointsUsage).not.toHaveBeenCalled()
  })

  it('成本落账失败不阻塞积分结算', async () => {
    mocks.recordAiCost.mockRejectedValueOnce(new Error('cost db down'))
    const request = makeRequest()

    await chargePointsForCall(
      request,
      'openai/gpt-4o',
      { usage: { prompt_tokens: 1000, completion_tokens: 0 } },
      'req-3',
    )

    expect(mocks.settleLlmPointsUsage).toHaveBeenCalledTimes(1)
    expect((request as { log: { warn: ReturnType<typeof vi.fn> } }).log.warn).toHaveBeenCalled()
  })

  it('积分结算失败被吞掉，不把已生成的响应打成 500', async () => {
    mocks.settleLlmPointsUsage.mockRejectedValueOnce(new Error('points db down'))
    const request = makeRequest()

    await expect(
      chargePointsForCall(
        request,
        'openai/gpt-4o',
        { usage: { prompt_tokens: 1000, completion_tokens: 0 } },
        'req-4',
      ),
    ).resolves.toBeUndefined()
    expect((request as { log: { warn: ReturnType<typeof vi.fn> } }).log.warn).toHaveBeenCalled()
  })

  it('预检把请求体估算成 prompt token 后交给统一积分预检', async () => {
    const request = makeRequest({ model: 'openai/gpt-4o', messages: [{ content: '12345678' }] })
    const reply = {} as never

    await expect(ensurePointsBalance(request, reply, 'openai/gpt-4o')).resolves.toBe(true)
    expect(mocks.ensureLlmPointsBalance).toHaveBeenCalledWith(
      request,
      reply,
      'openai/gpt-4o',
      expect.any(Number),
      0,
    )
    const estimated = mocks.ensureLlmPointsBalance.mock.calls[0]?.[3]
    expect(estimated).toBeGreaterThan(0)
  })
})
