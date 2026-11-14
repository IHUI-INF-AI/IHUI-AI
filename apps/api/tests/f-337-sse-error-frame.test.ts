// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-337 回归锁(2026-11-13)。
 *
 * 病灶:上游 HTTP 200 但 SSE 内 `data: {"error":...}`,或只发 [DONE] 的空流,
 * 旧实现只看 resp.ok 就记 success、按字符估算白扣输入 token、渠道恒记健康。
 *
 * 本文件锁三处落点:
 *   ① pipeChannelStream 识别 error 对象帧 / error 字符串帧 / 空流 ⇒ streamError 非空;
 *   ② 正常 choices 流不受影响(streamError 为 null、正文照常聚合);
 *   ③ forwardToChannel 带 deferStreamSuccess 时建连不预记成功(预记会把失败计数清零);
 *   ④ 渠道流式腿:错误帧 ⇒ 只记 recordChannelResult(false)、recordCall status=error 且
 *      输入 token 归零、客户端收到 error 帧而非静默结束;正常流 ⇒ 记成功且无 error 帧;
 *      空流未写任何帧 ⇒ 记失败并回退 ai-service(客户端无感)。
 *
 * 不连库、不出网:PG / Redis / 上游 fetch 全部替身。
 */
import { EventEmitter } from 'node:events'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type * as RelayUpstreamForwarder from '../src/services/relay-upstream-forwarder.js'

vi.mock('../src/services/relay-channel-router.js', () => ({
  selectChannelCandidates: vi.fn(async () => []),
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
vi.mock('../src/services/relay-plugins-service.js', () => ({
  getEnabledPlugins: vi.fn(async () => []),
  applyUpstreamHeaderPlugins: vi.fn((_p: unknown, h: unknown) => h),
  evaluateRequestBlockPlugins: vi.fn(async () => null),
}))
vi.mock('../src/db/index.js', () => ({
  db: { execute: vi.fn(async () => []), select: vi.fn(), insert: vi.fn(), update: vi.fn() },
  dbRead: { execute: vi.fn(async () => []), select: vi.fn() },
}))
vi.mock('../src/plugins/api-key-auth.js', () => ({
  requireApiKeyAuth: vi.fn(async () => {}),
  requireApiKeyQuota: vi.fn(() => async () => {}),
  checkAllowedModels: vi.fn(() => ({ ok: true })),
}))
vi.mock('../src/services/relay-billing-service.js', () => ({
  checkQuota: vi.fn(async () => ({ allowed: true })),
  recordCall: vi.fn(async () => ({ costCents: 0, logId: 'log-f337' })),
  isByokCall: vi.fn(async () => false),
  modelToProviderCode: vi.fn(() => 'openai'),
  preDeductQuota: vi.fn(async () => null),
  resolveBillingModel: vi.fn((_raw: string, resolved: string) => resolved),
  BillingUnavailableError: class BillingUnavailableError extends Error {},
}))
vi.mock('../src/services/user-concurrency-service.js', () => ({
  acquireUserConcurrencyForResponse: vi.fn(() => ({ ok: true, limit: 10, release: vi.fn() })),
}))
vi.mock('../src/services/model-mapping-service.js', () => ({
  resolveModelMapping: vi.fn(async () => ({ mapped: false })),
}))
vi.mock('../src/services/relay-response-cache.js', () => ({
  getRelayResponseCache: vi.fn(() => null),
  computeCacheKey: vi.fn(() => 'k'),
  shouldSkipCache: vi.fn(() => ({ skip: false })),
}))
vi.mock('../src/services/relay-error-rules-service.js', () => ({
  resolveErrorPassthrough: vi.fn(async () => ({ status: 502, message: 'AI service error' })),
}))
vi.mock('../src/services/relay-prompt-audit-service.js', () => ({
  auditPrompt: vi.fn(async () => ({ action: 'pass', hits: [] })),
}))
vi.mock('../src/services/relay-param-ops-config.js', () => ({
  applyParamOpsToBody: vi.fn(async (body: Record<string, unknown>) => ({
    body,
    appliedRules: [],
    modified: false,
  })),
}))
vi.mock('../src/services/channel-quota-service.js', () => ({
  recordUsage: vi.fn(async () => undefined),
}))
vi.mock('../src/services/relay-conversation-service.js', () => ({
  recordRelayConversationTurnSafe: vi.fn(),
}))
vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch: vi.fn(),
  aiServiceFetch: vi.fn(),
  aiServiceFetchStream: vi.fn(),
  aiServiceUserFetch: vi.fn(),
}))
// 保留真实 pipeChannelStream(帧解析),只替换建连函数 —— 流内错误帧要经真实解析器判定
vi.mock('../src/services/relay-upstream-forwarder.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RelayUpstreamForwarder>()
  // F-337 ③ 要验证真实 forwardToChannel 的建连记账语义,而 ④ 需要能在用例内
  // 替换返回值:默认委托真实实现(mockReset 后仍直连),用例里 mockResolvedValue 时再覆盖。
  return { ...actual, forwardToChannel: vi.fn(actual.forwardToChannel) }
})

import { forwardToChannel, pipeChannelStream } from '../src/services/relay-upstream-forwarder.js'
import {
  recordChannelResult,
  selectChannelCandidates,
  type SelectedChannelKey,
} from '../src/services/relay-channel-router.js'
import { recordCall } from '../src/services/relay-billing-service.js'
import { aiServiceSystemFetch } from '../src/utils/ai-service-fetch.js'
import { __test__ } from '../src/routes/v1-public.js'

const CHANNEL = {
  keyPoolId: 'kp-f337',
  groupName: 'g-f337',
  providerCode: 'openai',
  configId: 'cfg-f337',
  baseUrl: 'https://upstream.test/v1',
  apiKey: 'sk-f337',
} as unknown as SelectedChannelKey

function sseResponse(...lines: string[]): Response {
  return new Response(`${lines.join('\n')}\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

const ERROR_LINE = 'data: {"error":{"message":"quota exceeded"}}'
const CONTENT_LINE = 'data: {"id":"c1","choices":[{"delta":{"content":"hi"},"finish_reason":"stop"}]}'

const sw = {
  stop: () => ({ perfMs: 1, wallMs: 1, trustworthy: true, elapsedMs: 1, reason: null }),
}

/** 造一条渠道流式腿的请求/响应,收集写向客户端的原始帧。 */
function makeHarness(): {
  request: FastifyRequest
  reply: FastifyReply
  frames: () => string
} {
  const frames: string[] = []
  const raw = Object.assign(new EventEmitter(), {
    writeHead: vi.fn(),
    write: vi.fn((s: string) => {
      frames.push(s)
      return true
    }),
    end: vi.fn(),
  })
  const request = { ip: '127.0.0.1', raw: new EventEmitter() } as unknown as FastifyRequest
  const reply = { hijack: vi.fn(), raw } as unknown as FastifyReply
  return { request, reply, frames: () => frames.join('') }
}

function streamOpts() {
  return {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'hello f337' }],
    promptText: 'user: hello f337',
    apiKeyId: 'ak-f337',
    userId: 'user-f337',
    sw,
    mode: 'relay' as const,
  }
}

beforeEach(() => {
  vi.mocked(recordChannelResult).mockClear()
  vi.mocked(recordCall).mockClear()
  vi.mocked(forwardToChannel).mockReset()
  vi.mocked(selectChannelCandidates).mockReset()
  vi.mocked(selectChannelCandidates).mockResolvedValue([])
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('F-337 ① pipeChannelStream 识别流内错误', () => {
  it('error 对象帧 ⇒ streamError 留底上游消息,正文为空', async () => {
    const stats = await pipeChannelStream(sseResponse(ERROR_LINE, 'data: [DONE]'), {})
    expect(stats.streamError).toContain('quota exceeded')
    expect(stats.responseText).toBe('')
  })

  it('error 字符串帧 ⇒ streamError 留底', async () => {
    const stats = await pipeChannelStream(
      sseResponse('data: {"error":"model not found"}', 'data: [DONE]'),
      {},
    )
    expect(stats.streamError).toContain('model not found')
  })

  it('只发 [DONE] 的空流 ⇒ 判 streamError(而非补 finish 记 success)', async () => {
    const stats = await pipeChannelStream(sseResponse('data: [DONE]'), {})
    expect(stats.streamError).toContain('empty stream')
  })
})

describe('F-337 ② 正常流不受影响', () => {
  it('正常 choices 流 ⇒ streamError 为 null,正文照常聚合', async () => {
    const stats = await pipeChannelStream(sseResponse(CONTENT_LINE, 'data: [DONE]'), {})
    expect(stats.streamError).toBeNull()
    expect(stats.responseText).toBe('hi')
    expect(stats.sawFinish).toBe(true)
  })

  it('纯 usage 帧(无正文)⇒ streamError 为 null', async () => {
    const stats = await pipeChannelStream(
      sseResponse(
        'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}',
        'data: [DONE]',
      ),
      {},
    )
    expect(stats.streamError).toBeNull()
    expect(stats.totalTokens).toBe(15)
  })
})

describe('F-337 ③ 建连阶段不得预记成功(否则熔断计数被清零)', () => {
  it('deferStreamSuccess=true ⇒ 2xx 响应头到达时 recordChannelResult 一次都不调', async () => {
    vi.mocked(selectChannelCandidates).mockResolvedValue([CHANNEL])
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse(CONTENT_LINE, 'data: [DONE]')),
    )
    const result = await forwardToChannel({
      model: 'gpt-4o',
      messages: [],
      stream: true,
      deferStreamSuccess: true,
    })
    expect(result?.ok).toBe(true)
    expect(recordChannelResult).not.toHaveBeenCalled()
  })

  it('对照组:不带旗标仍保持旧语义(拿到 2xx 即记成功)', async () => {
    vi.mocked(selectChannelCandidates).mockResolvedValue([CHANNEL])
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse(CONTENT_LINE, 'data: [DONE]')),
    )
    const result = await forwardToChannel({ model: 'gpt-4o', messages: [], stream: true })
    expect(result?.ok).toBe(true)
    const calls = vi.mocked(recordChannelResult).mock.calls
    expect(calls).toHaveLength(1)
    expect(calls[0]?.[0]).toBe('kp-f337')
    expect(calls[0]?.[1]).toBe(true)
  })
})

describe('F-337 ④ 渠道流式腿按失败处理并通知客户端', () => {
  it('流内 error 帧 ⇒ 只记失败、recordCall 记 error 且输入 token 归零、客户端收到 error 帧', async () => {
    vi.mocked(forwardToChannel).mockResolvedValue({
      ok: true,
      response: sseResponse(ERROR_LINE),
      channel: CHANNEL,
      latencyMs: 5,
      latencyTrusted: true,
    })
    const h = makeHarness()

    await __test__.streamChatCompletion(h.request, h.reply, streamOpts())

    expect(recordChannelResult).toHaveBeenCalledTimes(1)
    expect(recordChannelResult).toHaveBeenCalledWith('kp-f337', false, null)
    const call = vi.mocked(recordCall).mock.calls[0]?.[0] as unknown as Record<string, unknown>
    expect(call['status']).toBe('error')
    expect(call['promptTokens']).toBe(0)
    expect(call['completionTokens']).toBe(0)
    expect(call['totalTokens']).toBe(0)
    // 客户端必须有 error 事件,而不是静默补 finish 收尾
    expect(h.frames()).toContain('"error"')
    expect(h.frames()).toContain('quota exceeded')
    expect(h.frames()).toContain('data: [DONE]')
    expect(h.frames()).not.toContain('"finish_reason":"stop"')
  })

  it('正常流 ⇒ 记成功、recordCall success,且不写 error 帧', async () => {
    vi.mocked(forwardToChannel).mockResolvedValue({
      ok: true,
      response: sseResponse(CONTENT_LINE, 'data: [DONE]'),
      channel: CHANNEL,
      latencyMs: 5,
      latencyTrusted: true,
    })
    const h = makeHarness()

    await __test__.streamChatCompletion(h.request, h.reply, streamOpts())

    expect(recordChannelResult).toHaveBeenCalledTimes(1)
    expect(recordChannelResult).toHaveBeenCalledWith('kp-f337', true, 5)
    const call = vi.mocked(recordCall).mock.calls[0]?.[0] as unknown as Record<string, unknown>
    expect(call['status']).toBe('success')
    expect(call['promptTokens'] as number).toBeGreaterThan(0)
    expect(h.frames()).toContain('hi')
    expect(h.frames()).toContain('data: [DONE]')
    expect(h.frames()).not.toContain('"error"')
  })

  it('空流未写出任何帧 ⇒ 记失败并回退 ai-service(客户端仍拿到正常回复)', async () => {
    vi.mocked(forwardToChannel).mockResolvedValue({
      ok: true,
      response: sseResponse('data: [DONE]'),
      channel: CHANNEL,
      latencyMs: 5,
      latencyTrusted: true,
    })
    vi.mocked(aiServiceSystemFetch).mockResolvedValue(
      sseResponse(
        'data: {"choices":[{"delta":{"content":"fallback-ok"}}]}',
        'data: [DONE]',
      ),
    )
    const h = makeHarness()

    await __test__.streamChatCompletion(h.request, h.reply, streamOpts())

    expect(recordChannelResult).toHaveBeenCalledTimes(1)
    expect(recordChannelResult).toHaveBeenCalledWith('kp-f337', false, null)
    expect(aiServiceSystemFetch).toHaveBeenCalled()
    expect(h.frames()).toContain('fallback-ok')
    expect(h.frames()).not.toContain('"error"')
  })
})
