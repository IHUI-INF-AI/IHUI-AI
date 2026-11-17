// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 连接层退避重试 —— 判据测试(2026-11-17)。
 *
 * R1 同候选网络层抛错一次 ⇒ 退避 1s 后**同一候选**重试成功,且不把这次抖动记成渠道失败。
 * R2 同一候选连续失败超过重试上限 ⇒ 只记一次渠道失败,再换下一候选(failover 仍是兜底)。
 * R3 头阶段超时不走退避(由 F-616 钉住,这里只作交叉确认:记录次数不因重试翻倍)。
 *
 * 反面对照在 `relay-upstream-forwarder-f616-617-670.test.ts`:那边断言头超时 < 1s 直接 failover。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockSelectChannelCandidates,
  mockRecordChannelResult,
  mockUndiciFetch,
  mockAssertRelayEgressSafe,
} = vi.hoisted(() => ({
  mockSelectChannelCandidates: vi.fn(),
  mockRecordChannelResult: vi.fn(),
  mockUndiciFetch: vi.fn(),
  mockAssertRelayEgressSafe: vi.fn(),
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
  directEgressDispatcher: () => ({ marker: 'direct-dispatcher' }),
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

import { forwardToChannel } from '../src/services/relay-upstream-forwarder.js'

const CHANNELS = [
  { keyPoolId: 'pool-a', baseUrl: 'https://upstream-a.example/v1', apiKey: 'sk-a' },
  { keyPoolId: 'pool-b', baseUrl: 'https://upstream-b.example/v1', apiKey: 'sk-b' },
] as never[]

function okResp() {
  return { ok: true, status: 200, body: { cancel: vi.fn(async () => {}) }, headers: new Map() }
}

function baseRequest() {
  return {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'hi' }],
    stream: false,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAssertRelayEgressSafe.mockResolvedValue(undefined)
  mockRecordChannelResult.mockResolvedValue(undefined)
  mockUndiciFetch.mockReset()
  delete process.env.RELAY_UPSTREAM_HEADERS_TIMEOUT_MS
  vi.useRealTimers()
})

describe('连接层退避重试', () => {
  it('R1 网络抛错一次后同候选重试成功,不把抖动记成渠道失败', async () => {
    vi.useFakeTimers()
    mockSelectChannelCandidates.mockResolvedValue(CHANNELS.slice(0, 1))
    let call = 0
    mockUndiciFetch.mockImplementation(async () => {
      call += 1
      if (call === 1) throw new Error('ECONNRESET')
      return okResp()
    })

    const pending = forwardToChannel(baseRequest())
    await vi.advanceTimersByTimeAsync(1000)
    const res = await pending

    expect(res?.ok).toBe(true)
    expect(call).toBe(2)
    // 抖动那次不记失败;只有最终成功记一次
    expect(mockRecordChannelResult).toHaveBeenCalledTimes(1)
    expect(mockRecordChannelResult).toHaveBeenCalledWith('pool-a', true, expect.anything())
  })

  it('R2 连续失败超过重试上限 ⇒ 只记一次渠道失败并换下一候选', async () => {
    vi.useFakeTimers()
    mockSelectChannelCandidates.mockResolvedValue(CHANNELS)
    let callsForA = 0
    mockUndiciFetch.mockImplementation(async (url: string) => {
      if (String(url).includes('upstream-a')) {
        callsForA += 1
        throw new Error('ECONNRESET')
      }
      return okResp()
    })

    const pending = forwardToChannel(baseRequest())
    await vi.advanceTimersByTimeAsync(5000)
    const res = await pending

    expect(res?.ok).toBe(true)
    // pool-a 共试 3 次(1 次首试 + 2 次退避重试),只记一次失败
    expect(callsForA).toBe(3)
    expect(mockRecordChannelResult).toHaveBeenCalledTimes(2)
    expect(mockRecordChannelResult).toHaveBeenNthCalledWith(1, 'pool-a', false, expect.anything())
    expect(mockRecordChannelResult).toHaveBeenNthCalledWith(2, 'pool-b', true, expect.anything())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
