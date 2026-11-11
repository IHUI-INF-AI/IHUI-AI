// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * SDB-08 回归锁(2026-11-11):usage 兜底只补 completion ⇒ input token 永久计 0;
 * 且 total>0 但 prompt=completion=0 时兜底不触发 ⇒ 整单按 0 计费。
 *
 * 覆盖:
 * 1. 上游完全无 usage → prompt 按请求体估算、completion 按正文估算(含 forwardToChannel 生产接线);
 * 2. 只有 total_tokens → completion=total、prompt=0,并留 usage_fallback 告警;
 * 3. prompt/completion 正常 → 不触发兜底(即使 total 缺失);
 * 4. 只有 completion → 不触发兜底;
 * 5. trae-protocol.extractUsage 只有 total_tokens 时不再返回 null。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockSelectChannelCandidates,
  mockRecordChannelResult,
  mockUndiciFetch,
  mockAssertRelayEgressSafe,
  mockLoggerWarn,
} = vi.hoisted(() => ({
  mockSelectChannelCandidates: vi.fn(),
  mockRecordChannelResult: vi.fn(),
  mockUndiciFetch: vi.fn(),
  mockAssertRelayEgressSafe: vi.fn(),
  mockLoggerWarn: vi.fn(),
}))

vi.mock('../src/services/relay-channel-router.js', () => ({
  selectChannelCandidates: mockSelectChannelCandidates,
  recordChannelResult: mockRecordChannelResult,
}))

vi.mock('../src/services/relay-account-forwarder.js', () => ({
  forwardToAccountPool: vi.fn(async () => null),
}))

vi.mock('../src/utils/relay-egress-guard.js', () => ({
  assertRelayEgressSafe: mockAssertRelayEgressSafe,
  directEgressDispatcher: () => ({ marker: 'test-dispatcher' }),
}))

vi.mock('../src/services/relay-outbound-proxy.js', () => ({
  isRelayOutboundProxyInstalled: () => false,
}))

vi.mock('undici', () => ({
  fetch: mockUndiciFetch,
  Agent: class {
    close(): void {}
  },
}))

vi.mock('../src/services/relay-plugins-service.js', () => ({
  getEnabledPlugins: async () => [],
  applyUpstreamHeaderPlugins: (_plugins: unknown, headers: Record<string, string>) => headers,
}))

vi.mock('../src/plugins/business-metrics.js', () => ({
  recordRelayUpstreamFallback: vi.fn(),
}))

vi.mock('../src/services/relay-pool-stats-service.js', () => ({
  getRelayPoolLiveSnapshot: async () => null,
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: mockLoggerWarn, error: vi.fn() },
}))

import { forwardToChannel, pipeChannelStream } from '../src/services/relay-upstream-forwarder.js'
import { extractUsage } from '../src/services/upstream-adapters/trae-protocol.js'

// ---------------------------------------------------------------------------
// SSE 夹具
// ---------------------------------------------------------------------------

function sse(lines: string[]): Response {
  return new Response(lines.map((line) => `${line}\n\n`).join(''), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

function contentLine(text: string): string {
  return `data: ${JSON.stringify({
    id: 'c1',
    choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
  })}`
}

function usageLine(usage: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ id: 'c1', choices: [], usage })}`
}

const DONE = 'data: [DONE]'
const CHANNEL = { keyPoolId: 'pool-a', baseUrl: 'https://upstream-a.example/v1', apiKey: 'sk-a' }

beforeEach(() => {
  vi.clearAllMocks()
  mockAssertRelayEgressSafe.mockResolvedValue(undefined)
  mockRecordChannelResult.mockResolvedValue(undefined)
})

describe('SDB-08 usage 兜底', () => {
  it('无 usage：prompt 按请求体估算、completion 按正文估算，两部分都补', async () => {
    const promptText = JSON.stringify([{ role: 'user', content: 'x'.repeat(400) }])
    const stats = await pipeChannelStream(sse([contentLine('y'.repeat(40)), DONE]), {
      promptText,
    })

    expect(stats.promptTokens).toBe(Math.ceil(promptText.length / 4))
    expect(stats.completionTokens).toBe(10)
    expect(stats.totalTokens).toBe(stats.promptTokens + stats.completionTokens)
    expect(stats.promptTokens).toBeGreaterThan(0)
    expect(mockLoggerWarn).not.toHaveBeenCalled()
  })

  it('无 usage：forwardToChannel 登记的请求体可供 pipeChannelStream 估算(生产接线)', async () => {
    const messages = [{ role: 'user', content: 'x'.repeat(400) }]
    mockSelectChannelCandidates.mockResolvedValue([CHANNEL])
    mockUndiciFetch.mockResolvedValue(sse([contentLine('y'.repeat(40)), DONE]))

    const fwd = await forwardToChannel({ model: 'gpt-4o', messages, stream: true })
    if (!fwd || !fwd.ok) throw new Error('期望渠道直连成功')

    const stats = await pipeChannelStream(fwd.response, { writeLine: () => {} })
    expect(stats.promptTokens).toBe(Math.ceil(JSON.stringify(messages).length / 4))
    expect(stats.completionTokens).toBe(10)
    expect(stats.totalTokens).toBe(stats.promptTokens + 10)
  })

  it('只有 total_tokens：completion=total、prompt=0，并留 usage_fallback 告警', async () => {
    const stats = await pipeChannelStream(sse([contentLine('abc'), usageLine({ total_tokens: 50 }), DONE]), {
      promptText: JSON.stringify([{ role: 'user', content: 'x'.repeat(400) }]),
    })

    expect(stats.promptTokens).toBe(0)
    expect(stats.completionTokens).toBe(50)
    expect(stats.totalTokens).toBe(50)
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('usage_fallback reason=total_only'),
      expect.anything(),
    )
  })

  it('prompt/completion 正常：不触发兜底，正文长度不覆盖上游明细', async () => {
    const stats = await pipeChannelStream(
      sse([contentLine('y'.repeat(400)), usageLine({ prompt_tokens: 40, completion_tokens: 10 }), DONE]),
      { promptText: JSON.stringify([{ role: 'user', content: 'z'.repeat(400) }]) },
    )

    expect(stats.promptTokens).toBe(40)
    expect(stats.completionTokens).toBe(10)
    expect(mockLoggerWarn).not.toHaveBeenCalled()
  })

  it('只有 completion：不触发兜底(prompt 保持上游给的 0)', async () => {
    const stats = await pipeChannelStream(
      sse([contentLine('y'.repeat(400)), usageLine({ completion_tokens: 9 }), DONE]),
      { promptText: JSON.stringify([{ role: 'user', content: 'z'.repeat(400) }]) },
    )

    expect(stats.promptTokens).toBe(0)
    expect(stats.completionTokens).toBe(9)
    expect(mockLoggerWarn).not.toHaveBeenCalled()
  })
})

describe('SDB-08 trae-protocol.extractUsage', () => {
  it('只有 total_tokens 时不再返回 null，按契约映射为 prompt=0 / completion=total', () => {
    expect(extractUsage({ total_tokens: 42 }, 'token_usage')).toEqual({
      prompt_tokens: 0,
      completion_tokens: 42,
      total_tokens: 42,
      prompt_tokens_details: { cached_tokens: 0 },
      completion_tokens_details: { reasoning_tokens: 0 },
    })
  })
})
