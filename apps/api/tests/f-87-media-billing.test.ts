// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-87 回归锁(2026-11-08)。
 *
 * 病灶:/openai/images、/openai/speech、/openai/transcriptions、/openai/responses
 *       四条平台 Key 代理只 recordUsage 不扣分,零积账号可无限调用付费上游。
 * 判据:四条 handler 都有余额闸;无 token usage 的媒体端点按 ai_pricing 单一报价结算,
 *       有 usage 的文本端点仍按 input/output tokens 结算。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const mocks = vi.hoisted(() => ({
  settleLlmPointsUsage: vi.fn(async () => ({
    deducted: 5,
    remaining: 0,
    shortfall: 0,
    alreadySettled: false,
    quote: { points: 5 },
  })),
  recordAiCost: vi.fn(async () => ({ cost: 1, currency: 'CNY' })),
}))

vi.mock('../src/services/ai-points-billing.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    settleLlmPointsUsage: mocks.settleLlmPointsUsage,
    ensureLlmPointsBalance: vi.fn(async () => true),
  }
})
vi.mock('../src/plugins/ai-cost.js', () => ({
  recordAiCost: mocks.recordAiCost,
  resolveAiCost: vi.fn(),
}))
vi.mock('../src/db/gamification-queries.js', () => ({ findUserPoints: vi.fn() }))
vi.mock('../src/services/vendor-caller-service.js', () => ({ callVendor: vi.fn() }))
vi.mock('../src/routes/ai-vendors/_shared.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, callVendor: vi.fn(), recordUsage: vi.fn() }
})

import { chargePointsForCall } from '../src/routes/ai-vendors/proxy-llm.js'

const source = readFileSync(
  fileURLToPath(new URL('../src/routes/ai-vendors/proxy-openai-compat.ts', import.meta.url)),
  'utf8',
)

const request = { userId: 'u-1', id: 'req-1' }

describe('F-87 平台 Key 媒体端点必须计费', () => {
  beforeEach(() => {
    mocks.settleLlmPointsUsage.mockClear()
    mocks.recordAiCost.mockClear()
  })

  it('四条媒体 handler 都有余额闸:token 端点 3 处 + 媒体端点 3 处 + 读取闸 1 处', () => {
    // chat / embeddings / responses 走 model 倍率闸;images / speech / transcriptions
    // 走按本次报价的媒体闸;GET responses/:id 只做零积读取闸。
    expect(source.match(/ensurePointsBalance\(request, reply,/g) ?? []).toHaveLength(3)
    expect(source.match(/ensureMediaPointsBalance\(/g) ?? []).toHaveLength(3)
    expect(source.match(/ensurePointsAvailable\(request, reply\)/g) ?? []).toHaveLength(1)
  })

  it('结算口径单一:token 端点 3 处 chargePointsForCall,媒体端点 3 处 chargeMediaPoints', () => {
    expect(source.match(/chargePointsForCall\(request,/g) ?? []).toHaveLength(3)
    // images / speech / transcriptions 无 token usage,必须走 ai_pricing 媒体报价。
    expect(source.match(/chargeMediaPoints\(/g) ?? []).toHaveLength(3)
  })

  it('Responses API 的 input_tokens/output_tokens 能结算', async () => {
    await chargePointsForCall(
      request as never,
      'gpt-4o',
      { usage: { input_tokens: 1000, output_tokens: 500 } },
      'req-1',
    )
    expect(mocks.settleLlmPointsUsage).toHaveBeenCalledTimes(1)
    expect(mocks.settleLlmPointsUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        modelId: 'gpt-4o',
        promptTokens: 1000,
        completionTokens: 500,
        source: 'llm_chat',
        referenceId: 'req-1',
      }),
    )
    expect(mocks.recordAiCost).toHaveBeenCalledWith(
      expect.objectContaining({ promptTokens: 1000, completionTokens: 500, totalTokens: 1500 }),
    )
  })

  it('OpenAI 经典 prompt_tokens/completion_tokens 口径不受影响', async () => {
    await chargePointsForCall(
      request as never,
      'gpt-4o',
      { usage: { prompt_tokens: 1000, completion_tokens: 500 } },
      'req-1',
    )
    expect(mocks.settleLlmPointsUsage).toHaveBeenCalledTimes(1)
    expect(mocks.settleLlmPointsUsage.mock.calls[0]?.[0]).toMatchObject({
      promptTokens: 1000,
      completionTokens: 500,
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
