// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 普通 LLM 代理的“双账”收口测试(2026-11-26):
 * - 平台成本先落 ai_cost_records(与用户积分无关,失败不阻塞);
 * - 用户积分统一走 settleLlmPointsUsage(预扣/部分结算/幂等由 points-service 负责);
 * - 预检按 prompt + max_tokens 冻结,不再传 completion=0;
 * - 网关不回 usage 时用字符数估算兜底,不再整笔免单。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  recordAiCost: vi.fn(async () => ({ cost: 1, currency: 'CNY' })),
  settleLlmPointsUsage: vi.fn(async () => ({
    deducted: 3,
    remaining: 100,
    shortfall: 0,
    alreadySettled: false,
    quote: { points: 3, multiplier: 1 },
  })),
  ensureLlmPointsBalance: vi.fn(async () => true),
  readMaxCompletionTokens: vi.fn(() => 4096),
  releasePointsHold: vi.fn(async () => 0),
}))

vi.mock('../src/plugins/ai-cost.js', () => ({
  recordAiCost: mocks.recordAiCost,
  resolveAiCost: vi.fn(),
}))

vi.mock('../src/services/ai-points-billing.js', () => ({
  ensureLlmPointsBalance: mocks.ensureLlmPointsBalance,
  settleLlmPointsUsage: mocks.settleLlmPointsUsage,
  readMaxCompletionTokens: mocks.readMaxCompletionTokens,
  quoteLlmPoints: vi.fn(),
  computeLlmPoints: vi.fn(),
  DEFAULT_MAX_COMPLETION_TOKENS: 4096,
  MAX_COMPLETION_TOKENS: 131_072,
}))

vi.mock('../src/services/points-service.js', () => ({
  releasePointsHold: mocks.releasePointsHold,
  reservePointsUsage: vi.fn(),
  settlePointsUsage: vi.fn(),
}))

import { chargePointsForCall, ensurePointsBalance } from '../src/routes/ai-vendors/proxy-llm.js'

function makeRequest(body: unknown = { model: 'openai/gpt-4o', messages: [{ role: 'user' }] }) {
  return {
    id: 'req-pre',
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
      quote: { points: 3, multiplier: 1 },
    })
    mocks.ensureLlmPointsBalance.mockReset().mockResolvedValue(true)
    mocks.readMaxCompletionTokens.mockReset().mockReturnValue(4096)
    mocks.releasePointsHold.mockReset().mockResolvedValue(0)
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
        holdReferenceId: 'req-pre',
      }),
    )
  })

  it('只回 total_tokens 时按输出价结算,不整笔免单', async () => {
    await chargePointsForCall(
      makeRequest(),
      'openai/gpt-4o',
      { usage: { total_tokens: 900 } },
      'req-total',
    )

    expect(mocks.recordAiCost).toHaveBeenCalledWith(
      expect.objectContaining({ promptTokens: 0, completionTokens: 900, totalTokens: 900 }),
    )
    expect(mocks.settleLlmPointsUsage).toHaveBeenCalledWith(
      expect.objectContaining({ promptTokens: 0, completionTokens: 900 }),
    )
  })

  it('完全不回 usage 时按请求/响应字符数估算,仍然收费', async () => {
    const request = makeRequest({ model: 'openai/gpt-4o', messages: [{ content: '12345678' }] })
    await chargePointsForCall(
      request,
      'openai/gpt-4o',
      { choices: [{ text: 'hello world' }] },
      'req-2',
    )

    expect(mocks.recordAiCost).toHaveBeenCalledTimes(1)
    expect(mocks.settleLlmPointsUsage).toHaveBeenCalledTimes(1)
    const call = mocks.settleLlmPointsUsage.mock.calls[0]?.[0] as {
      promptTokens: number
      completionTokens: number
    }
    expect(call.promptTokens).toBeGreaterThan(0)
    expect(call.completionTokens).toBeGreaterThan(0)
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

  it('积分结算失败被吞掉,并释放预扣 hold', async () => {
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
    expect(mocks.releasePointsHold).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-1', source: 'llm_chat', referenceId: 'req-pre' }),
    )
    expect((request as { log: { warn: ReturnType<typeof vi.fn> } }).log.warn).toHaveBeenCalled()
  })

  it('预检把 prompt + max_tokens 一并交给统一积分冻结', async () => {
    const request = makeRequest({
      model: 'openai/gpt-4o',
      messages: [{ content: '12345678' }],
      max_tokens: 2048,
    })
    const reply = {} as never

    await expect(ensurePointsBalance(request, reply, 'openai/gpt-4o')).resolves.toBe(true)
    expect(mocks.readMaxCompletionTokens).toHaveBeenCalledWith(request.body)
    expect(mocks.ensureLlmPointsBalance).toHaveBeenCalledWith(
      request,
      reply,
      'openai/gpt-4o',
      expect.any(Number),
      4096,
      { source: 'llm_chat', referenceId: 'req-pre' },
    )
    const estimated = mocks.ensureLlmPointsBalance.mock.calls[0]?.[3] as number
    expect(estimated).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
