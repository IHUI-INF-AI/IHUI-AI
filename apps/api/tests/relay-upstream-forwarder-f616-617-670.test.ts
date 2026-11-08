// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay 渠道腿三条 P1 的回归锁(2026-11-08):
 *  - F-616 非流式请求上游无业务超时 ⇒ 上游建连后不回响应头时挂到 undici 默认 300s;
 *  - F-617 任何非 2xx 都计渠道熔断 ⇒ 3 个客户端错误请求打掉全部候选(自伤式熔断);
 *  - F-670 客户端断开被记成渠道 key 失败 ⇒ 3 次切页/取消即熔断整个模型。
 * 另钉 F-618(非 2xx 必须 cancel body 才归还连接池)。
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

// 直连分支走 npm undici 的 fetch:替身只为观察 signal 与响应状态
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
  { keyPoolId: 'pool-c', baseUrl: 'https://upstream-c.example/v1', apiKey: 'sk-c' },
] as never[]

function makeResp(status: number) {
  const cancel = vi.fn(async () => {})
  return {
    ok: status >= 200 && status < 300,
    status,
    body: { cancel },
  }
}

function baseRequest(signal?: AbortSignal) {
  return {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'hi' }],
    stream: false,
    signal,
  }
}

/** 模拟「上游建连后永不回响应头」:只有 signal abort 才 reject(AbortError) */
function neverRespond(_url: string, init: { signal?: AbortSignal }) {
  return new Promise((_resolve, reject) => {
    const onAbort = () => {
      const e = new Error('aborted')
      e.name = 'AbortError'
      reject(e)
    }
    if (init.signal?.aborted) return onAbort()
    init.signal?.addEventListener('abort', onAbort, { once: true })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAssertRelayEgressSafe.mockResolvedValue(undefined)
  mockRecordChannelResult.mockResolvedValue(undefined)
  mockUndiciFetch.mockReset()
  delete process.env.RELAY_UPSTREAM_HEADERS_TIMEOUT_MS
})

describe('F-616 上游响应头业务超时(非流式也有 deadline)', () => {
  it('上游不回响应头 ⇒ 在头阶段超时后按渠道故障 failover,不再挂到 300s', async () => {
    process.env.RELAY_UPSTREAM_HEADERS_TIMEOUT_MS = '50'
    mockSelectChannelCandidates.mockResolvedValue(CHANNELS.slice(0, 2))
    mockUndiciFetch.mockImplementation(neverRespond)

    const startedAt = Date.now()
    const res = await forwardToChannel(baseRequest())
    const elapsed = Date.now() - startedAt

    expect(res).toEqual({
      ok: false,
      reason: 'upstream headers timeout (50ms)',
      lastHttpStatus: undefined,
    })
    // 两个候选各超时一次,各记一次渠道失败
    expect(mockRecordChannelResult).toHaveBeenCalledTimes(2)
    expect(mockRecordChannelResult).toHaveBeenNthCalledWith(1, 'pool-a', false, expect.anything())
    expect(mockRecordChannelResult).toHaveBeenNthCalledWith(2, 'pool-b', false, expect.anything())
    expect(elapsed).toBeLessThan(1000)
  })

  it('拿到响应头后即撤掉头阶段定时器:长流正文不会被中途掐断', async () => {
    process.env.RELAY_UPSTREAM_HEADERS_TIMEOUT_MS = '50'
    mockSelectChannelCandidates.mockResolvedValue([CHANNELS[0]])
    let captured: AbortSignal | undefined
    mockUndiciFetch.mockImplementation(async (_url: string, init: { signal?: AbortSignal }) => {
      captured = init.signal
      return makeResp(200)
    })

    const res = await forwardToChannel({ ...baseRequest(), stream: true })
    expect(res && res.ok).toBe(true)
    // 200ms 后(远超 50ms deadline)信号仍未 abort ⇒ 正文阶段不受头超时约束
    await new Promise((r) => setTimeout(r, 200))
    expect(captured?.aborted).toBe(false)
  })
})

describe('F-617 只有 5xx/429/网络错误计渠道熔断', () => {
  it('400 客户端错误:不计失败、不换候选(fail-fast),并 cancel body', async () => {
    mockSelectChannelCandidates.mockResolvedValue(CHANNELS)
    const resp = makeResp(400)
    mockUndiciFetch.mockResolvedValue(resp)

    const res = await forwardToChannel(baseRequest())
    expect(res).toEqual({
      ok: false,
      reason: 'upstream 400 (client error)',
      lastHttpStatus: 400,
    })
    expect(mockRecordChannelResult).not.toHaveBeenCalled()
    expect(mockUndiciFetch).toHaveBeenCalledTimes(1)
    // F-618:非 2xx body 必须 cancel
    expect(resp.body.cancel).toHaveBeenCalled()
  })

  it('连续 3 个 422 只打 1 个候选、0 次失败计数 ⇒ 不会把候选池打光', async () => {
    mockSelectChannelCandidates.mockResolvedValue(CHANNELS)
    mockUndiciFetch.mockResolvedValue(makeResp(422))

    const res = await forwardToChannel(baseRequest())
    expect(res && res.ok).toBe(false)
    expect(mockRecordChannelResult).not.toHaveBeenCalled()
    expect(mockUndiciFetch).toHaveBeenCalledTimes(1)
  })

  it('401 凭据异常:换下一候选但不计熔断', async () => {
    mockSelectChannelCandidates.mockResolvedValue(CHANNELS.slice(0, 2))
    mockUndiciFetch.mockResolvedValueOnce(makeResp(401)).mockResolvedValueOnce(makeResp(200))

    const res = await forwardToChannel(baseRequest())
    expect(res && res.ok).toBe(true)
    expect(mockRecordChannelResult).toHaveBeenCalledTimes(1)
    expect(mockRecordChannelResult).toHaveBeenCalledWith('pool-b', true, expect.anything())
  })

  it('5xx 与 429 仍计渠道失败并 failover(反证:放宽不得吞掉真故障)', async () => {
    mockSelectChannelCandidates.mockResolvedValue(CHANNELS)
    mockUndiciFetch
      .mockResolvedValueOnce(makeResp(500))
      .mockResolvedValueOnce(makeResp(429))
      .mockResolvedValueOnce(makeResp(503))

    const res = await forwardToChannel(baseRequest())
    expect(res && res.ok).toBe(false)
    expect(mockRecordChannelResult).toHaveBeenCalledTimes(3)
    for (const call of mockRecordChannelResult.mock.calls) {
      expect(call[1]).toBe(false)
    }
  })
})

describe('F-670 客户端断开不计渠道失败账', () => {
  it('fetch 抛 AbortError ⇒ 直接 break:不记失败、不再打下一候选', async () => {
    mockSelectChannelCandidates.mockResolvedValue(CHANNELS)
    mockUndiciFetch.mockImplementation(async () => {
      const e = new Error('The operation was aborted')
      e.name = 'AbortError'
      throw e
    })

    const res = await forwardToChannel(baseRequest())
    expect(res && res.ok).toBe(false)
    expect(mockRecordChannelResult).not.toHaveBeenCalled()
    expect(mockUndiciFetch).toHaveBeenCalledTimes(1)
  })

  it('req.signal 已 abort(切页/取消)⇒ 同样不记失败账', async () => {
    mockSelectChannelCandidates.mockResolvedValue(CHANNELS)
    const controller = new AbortController()
    controller.abort()
    mockUndiciFetch.mockImplementation(async (_url: string, init: { signal?: AbortSignal }) => {
      if (init.signal?.aborted) {
        const e = new Error('aborted')
        e.name = 'AbortError'
        throw e
      }
      return makeResp(200)
    })

    const res = await forwardToChannel(baseRequest(controller.signal))
    expect(res && res.ok).toBe(false)
    expect(mockRecordChannelResult).not.toHaveBeenCalled()
    expect(mockUndiciFetch).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
