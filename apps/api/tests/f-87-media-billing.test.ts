// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-87 回归锁(2026-11-08)。
 *
 * 病灶:/openai/images、/openai/speech、/openai/transcriptions、/openai/responses
 *       四条平台 Key 代理只 recordUsage 不扣分,零积账号可无限调用付费上游。
 * 判据:四条 handler 都有余额闸;无 token usage 的媒体端点按 points-guard 固定单价结算,
 *       有 usage 的文本端点仍按 input/output tokens 结算。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const mocks = vi.hoisted(() => ({
  spendPoints: vi.fn(async () => {}),
  findUserPoints: vi.fn(async () => ({ points: 100 })),
}))

vi.mock('../src/services/points-service.js', () => ({ spendPoints: mocks.spendPoints }))
vi.mock('../src/db/gamification-queries.js', () => ({ findUserPoints: mocks.findUserPoints }))
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
    mocks.spendPoints.mockClear()
  })

  it('四条媒体 handler 都有余额闸:token 端点 3 处 + 媒体端点 4 处', () => {
    // chat / embeddings / responses 走 model 倍率闸;images / speech / transcriptions /
    // GET responses/:id 走不看 model 名的固定闸(免费模型名不能绕过)。
    expect(source.match(/ensurePointsBalance\(request, reply,/g) ?? []).toHaveLength(3)
    expect(source.match(/ensurePointsAvailable\(request, reply\)/g) ?? []).toHaveLength(4)
  })

  it('结算口径单一:token 端点 3 处 chargePointsForCall,媒体端点 3 处 chargeFlatPoints', () => {
    expect(source.match(/chargePointsForCall\(request,/g) ?? []).toHaveLength(3)
    // images / speech / transcriptions 无 token usage,必须按固定单价扣费。
    expect(source.match(/chargeFlatPoints\(/g) ?? []).toHaveLength(3)
  })

  it('Responses API 的 input_tokens/output_tokens 能结算', async () => {
    await chargePointsForCall(
      request as never,
      'gpt-4o',
      { usage: { input_tokens: 1000, output_tokens: 500 } },
      'req-1',
    )
    expect(mocks.spendPoints).toHaveBeenCalledTimes(1)
    const [userId, amount, kind, reason, ref] = mocks.spendPoints.mock.calls[0] as unknown[]
    expect(userId).toBe('u-1')
    expect(amount).toBe(5) // ceil(1500/1000 * 3)
    expect(kind).toBe('ai_call')
    expect(String(reason)).toContain('tokens=1500')
    expect(ref).toBe('req-1')
  })

  it('OpenAI 经典 prompt_tokens/completion_tokens 口径不受影响', async () => {
    await chargePointsForCall(
      request as never,
      'gpt-4o',
      { usage: { prompt_tokens: 1000, completion_tokens: 500 } },
      'req-1',
    )
    expect(mocks.spendPoints).toHaveBeenCalledTimes(1)
    expect((mocks.spendPoints.mock.calls[0] as unknown[])[1]).toBe(5)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
