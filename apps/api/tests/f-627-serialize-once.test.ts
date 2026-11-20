// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-627 回归锁(2026-11-13)。
 *
 * 病灶:forwardToChannel 的候选循环内每轮都 `body: JSON.stringify(body)`,
 * 首个候选失败 ⇒ 图片/长上下文请求最多 3 次整包序列化(CPU/内存峰值 + GC 抖动)。
 *
 * 本文件锁:3 个候选全部失败时,对请求体的 JSON.stringify 只发生 1 次(循环外),
 * 三次 fetch 拿到同一份序列化产物;并用源码锁确认序列化点在循环之外。
 *
 * 不连库、不连 Redis、不出网:forwarder 的所有外部依赖替身。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/relay-channel-router.js', () => ({
  selectChannelCandidates: vi.fn(),
  recordChannelResult: vi.fn(async () => {}),
}))
vi.mock('../src/services/relay-account-forwarder.js', () => ({
  forwardToAccountPool: vi.fn(async () => null),
}))
vi.mock('../src/utils/relay-egress-guard.js', () => ({
  assertRelayEgressSafe: vi.fn(async () => {}),
  directEgressDispatcher: vi.fn(() => ({})),
}))
vi.mock('../src/services/relay-outbound-proxy.js', () => ({
  isRelayOutboundProxyInstalled: vi.fn(() => true),
}))
vi.mock('undici', () => ({ fetch: vi.fn() }))
vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock('../src/plugins/business-metrics.js', () => ({
  recordRelayUpstreamFallback: vi.fn(),
}))
vi.mock('../src/services/relay-pool-stats-service.js', () => ({
  getRelayPoolLiveSnapshot: vi.fn(async () => ({})),
}))
vi.mock('../src/utils/elapsed-ms.js', () => ({
  startStopwatch: vi.fn(() => ({
    stop: () => ({ trustworthy: false, elapsedMs: null, perfMs: 1 }),
  })),
}))
vi.mock('../src/services/relay-plugins-service.js', () => ({
  getEnabledPlugins: vi.fn(async () => []),
  applyUpstreamHeaderPlugins: vi.fn((_p: unknown, h: unknown) => h),
}))

import { selectChannelCandidates } from '../src/services/relay-channel-router.js'
import { forwardToChannel } from '../src/services/relay-upstream-forwarder.js'

const candidates = [1, 2, 3].map((i) => ({
  keyPoolId: `kp-${i}`,
  baseUrl: 'https://upstream.example.com/v1',
  apiKey: `sk-${i}`,
  groupName: 'g',
  providerCode: 'p',
  configId: 'c',
}))

const fetchMock = vi.fn()

describe('F-627 候选循环内重复 JSON.stringify(body)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    // 每个候选都拿到 500 ⇒ 走 failover continue,把循环跑满 3 轮
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      body: { cancel: vi.fn(async () => {}) },
    } as never)
    vi.stubGlobal('fetch', fetchMock)
    vi.mocked(selectChannelCandidates).mockResolvedValue(candidates as never)
  })

  it('3 个候选全失败时请求体只序列化 1 次,三次 fetch 复用同一产物', async () => {
    const spy = vi.spyOn(JSON, 'stringify')
    const messages = [{ role: 'user', content: 'x'.repeat(200_000) }]
    const result = await forwardToChannel({ model: 'gpt-4o', messages, stream: false })

    expect(result?.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(3)

    // 只数「对含 messages 的请求体对象」的序列化:修复前 3 次,修复后 1 次
    const requestBodyCalls = spy.mock.calls.filter(
      (args) =>
        args[0] !== null &&
        typeof args[0] === 'object' &&
        Array.isArray((args[0] as { messages?: unknown }).messages),
    )
    expect(requestBodyCalls).toHaveLength(1)

    const bodies = fetchMock.mock.calls.map((c) => (c[1] as { body: string }).body)
    expect(new Set(bodies).size).toBe(1)
    expect(bodies[0]).toContain('"messages"')
    spy.mockRestore()
  })

  it('源码锁:序列化点在 for 循环外,循环内只引用 serializedBody', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/services/relay-upstream-forwarder.ts', import.meta.url)),
      'utf8',
    )
    const loopAt = src.indexOf('for (const channel of candidates)')
    const serializedAt = src.indexOf('const serializedBody = JSON.stringify(body)')
    expect(serializedAt).toBeGreaterThan(-1)
    expect(serializedAt).toBeLessThan(loopAt)
    // 非动态成本分支必须直接复用循环外那一次序列化(OpenRouter 的懒构造是另一条已登记分支)
    expect(src).toMatch(/body:\s*channel\.providerCode === 'openrouter'[^,]*: serializedBody,/)
    expect(src).not.toContain('body: JSON.stringify(body),')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
