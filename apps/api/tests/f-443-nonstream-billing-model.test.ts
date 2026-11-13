// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-443 回归锁(2026-11-13):非流式成功流水按原始 model 计费,与流式/缓存不一致。
 *
 * 病灶:配置 gpt-4o→deepseek-chat 映射后,上游实际用映射模型;流式与缓存命中流水都取
 * 映射后模型,非流式成功流水却按请求原始 model 记账,且 metadata 不带映射元信息
 * ⇒ 同一请求在 stream / 缓存 / 非流式三处定价口径分裂,审计无法按模型对账。
 *
 * 本套件用桩替身驱动真实路由(不连 DB / 上游 / Redis):
 *   ① 非流式(ai-service 兜底)成功:流水 model = 映射后上游模型,且与流式一致;
 *   ② 渠道直连的非流式成功:流水 model 同为映射后模型;
 *   ③ 缓存命中:流水 model 同为映射后模型,metadata 带 modelMappingMeta;
 *   ④ 未配置映射:回退请求 model(不改变既有行为)。
 *
 * 回退自证:把非流式成功 recordCall 的 model 改回原始 model,① 的相等断言即变红。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyPluginAsync } from 'fastify'
import type * as RelayBillingService from '../src/services/relay-billing-service.js'
import type { RecordCallInput } from '../src/services/relay-billing-service.js'

const REQUESTED_MODEL = 'gpt-4o'
const MAPPED_MODEL = 'deepseek-chat'

const { captured, upstream } = vi.hoisted(() => ({
  captured: { calls: [] as RecordCallInput[] },
  upstream: { bodies: [] as Array<Record<string, unknown>> },
}))

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.AI_SERVICE_URL ??= 'http://test-ai-service:8802'
})

const MOCK_API_KEY = {
  id: 'ak_f443',
  userId: 'user_f443',
  key: 'ihui_f443_key',
  permissions: ['chat:write', '*'],
  rateLimit: 100,
  allowedModels: null,
}

// ---------------------------------------------------------------- 鉴权 / 计费
vi.mock('../src/plugins/api-key-auth.js', () => ({
  requireApiKeyAuth: vi.fn(async (request: { apiKey?: typeof MOCK_API_KEY }) => {
    request.apiKey = MOCK_API_KEY
  }),
  requireApiKeyPermission: vi.fn(() => async () => {}),
  requireApiKeyQuota: vi.fn(() => async () => {}),
  modelInList: vi.fn(() => true),
  checkAllowedModels: vi.fn(() => ({ ok: true })),
}))

// recordCall 是本票的唯一观察窗:保留真实 resolveBillingModel,只把落库出口换成桩。
vi.mock('../src/services/relay-billing-service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RelayBillingService>()
  return {
    ...actual,
    checkQuota: vi.fn(async () => ({ allowed: true })),
    recordCall: vi.fn(async (input: RecordCallInput) => {
      captured.calls.push(input)
      return { logId: 'log_f443', costCents: 1, newTokenBalance: 1, newCostBalanceCents: 1 }
    }),
    isByokCall: vi.fn(async () => false),
    preDeductQuota: vi.fn(async () => null),
  }
})

// -------------------------------------------------- v1-public 的其余外部依赖
vi.mock('../src/db/index.js', () => ({
  db: {
    execute: vi.fn(async () => []),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  dbRead: { select: vi.fn() },
}))

vi.mock('../src/services/user-concurrency-service.js', () => ({
  tryAcquireUserConcurrency: vi.fn(() => ({
    ok: true,
    current: 1,
    limit: 10,
    release: vi.fn(),
  })),
  acquireUserConcurrencyForResponse: vi.fn(() => ({
    ok: true,
    current: 1,
    limit: 10,
    release: vi.fn(),
  })),
  releaseUserConcurrency: vi.fn(),
}))

// 默认无渠道 ⇒ 非流式走 ai-service 既有链路;流式用例内再覆盖为渠道成功
vi.mock('../src/services/relay-upstream-forwarder.js', () => ({
  forwardToChannel: vi.fn(async () => null),
  pipeChannelStream: vi.fn(),
}))

vi.mock('../src/services/relay-channel-router.js', () => ({
  selectChannelCandidates: vi.fn(async () => []),
  recordChannelResult: vi.fn(async () => {}),
}))

// 模型映射:gpt-4o → deepseek-chat(Key 级)
vi.mock('../src/services/model-mapping-service.js', () => ({
  resolveModelMapping: vi.fn(async () => ({
    mapped: true,
    resolvedModel: 'deepseek-chat',
    mapping: { id: 'map_f443', apiKeyId: 'ak_f443' },
  })),
}))

vi.mock('../src/services/relay-response-cache.js', () => ({
  getRelayResponseCache: vi.fn(() => null),
  computeCacheKey: vi.fn(() => 'f443-cache-key'),
  shouldSkipCache: vi.fn(() => ({ skip: false })),
}))

vi.mock('../src/services/relay-error-rules-service.js', () => ({
  resolveErrorPassthrough: vi.fn(async () => null),
}))

vi.mock('../src/services/relay-plugins-service.js', () => ({
  evaluateRequestBlockPlugins: vi.fn(async () => null),
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

// ai-service 出口整块替换:非流式兜底不改走真实网络
vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch: vi.fn(),
  aiServiceFetch: vi.fn(),
  aiServiceFetchStream: vi.fn(),
  aiServiceUserFetch: vi.fn(),
}))

import { forwardToChannel, pipeChannelStream } from '../src/services/relay-upstream-forwarder.js'
import { getRelayResponseCache } from '../src/services/relay-response-cache.js'
import { resolveModelMapping } from '../src/services/model-mapping-service.js'
import { aiServiceSystemFetch } from '../src/utils/ai-service-fetch.js'
import v1PublicRoutes from '../src/routes/v1-public.js'

const CHANNEL = {
  keyPoolId: 'kp_f443',
  apiKey: 'sk_f443',
  baseUrl: 'https://upstream.test/v1',
  providerCode: 'openai',
  configId: 1,
  groupId: 'g_f443',
  groupName: 'g-f443',
}

async function boot(prefix: string, plugin: FastifyPluginAsync) {
  const server = Fastify({ logger: false })
  await server.register(plugin, { prefix })
  await server.ready()
  return server
}

function chatPayload(extra: Record<string, unknown> = {}) {
  return {
    model: REQUESTED_MODEL,
    messages: [{ role: 'user', content: 'ping' }],
    ...extra,
  }
}

/** ai-service 兜底替身:收下出站 body(断言上游实际 model),回简化格式 JSON */
function stubAiService(payload: Record<string, unknown>): void {
  vi.mocked(aiServiceSystemFetch).mockImplementation(async (path, init) => {
    const raw = typeof init?.body === 'string' ? init.body : '{}'
    upstream.bodies.push({
      path: String(path),
      ...(JSON.parse(raw) as Record<string, unknown>),
    })
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
}

/** 渠道成功替身:OpenAI 原生响应体 */
function channelJsonResponse(payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  captured.calls.length = 0
  upstream.bodies.length = 0
})

describe('F-443 非流式成功流水取映射后模型', () => {
  it('非流式(ai-service 兜底)与流式的 recordCall.model 同为映射后模型', async () => {
    const server = await boot('/v1', v1PublicRoutes)
    stubAiService({
      content: 'pong',
      model: MAPPED_MODEL,
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    })

    const plain = await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { 'x-api-key': 'ihui_f443_key' },
      payload: chatPayload(),
    })
    expect(plain.statusCode).toBe(200)
    const plainCall = captured.calls.at(-1)
    expect(plainCall?.status).toBe('success')
    // 上游收到的确是映射后模型(证明本请求走的是"映射 + 非流式")
    expect(upstream.bodies.at(-1)?.['model']).toBe(MAPPED_MODEL)
    expect(plainCall?.model).toBe(MAPPED_MODEL)
    expect(plainCall?.model).not.toBe(REQUESTED_MODEL)
    // 映射审计与流式/缓存同源
    expect(plainCall?.metadata?.originalModel).toBe(REQUESTED_MODEL)
    expect(plainCall?.metadata?.mappedModel).toBe(MAPPED_MODEL)

    vi.mocked(forwardToChannel).mockResolvedValueOnce({
      ok: true,
      response: new Response('data: [DONE]\n', { status: 200 }),
      channel: CHANNEL,
      latencyMs: 5,
      latencyTrusted: true,
    } as never)
    vi.mocked(pipeChannelStream).mockResolvedValueOnce({
      streamError: null,
      sawFinish: true,
      responseText: 'pong',
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      promptTokens: 3,
      completionTokens: 2,
      ttftMs: 1,
      upstreamCredits: null,
      lastFrameId: null,
      httpStatus: 200,
    } as never)

    const streamed = await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { 'x-api-key': 'ihui_f443_key' },
      payload: chatPayload({ stream: true }),
    })
    await server.close()
    expect(streamed.statusCode).toBe(200)

    const streamCall = captured.calls.at(-1)
    expect(streamCall?.status).toBe('success')
    expect(streamCall?.model).toBe(MAPPED_MODEL)
    // 同一请求的两种响应形态,流水计费模型必须一致
    expect(plainCall?.model).toBe(streamCall?.model)
  })

  it('渠道直连的非流式成功:流水 model 同为映射后模型', async () => {
    const server = await boot('/v1', v1PublicRoutes)
    vi.mocked(forwardToChannel).mockResolvedValueOnce({
      ok: true,
      response: channelJsonResponse({
        choices: [
          { index: 0, message: { role: 'assistant', content: 'pong' }, finish_reason: 'stop' },
        ],
        model: MAPPED_MODEL,
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      }),
      channel: CHANNEL,
      latencyMs: 5,
      latencyTrusted: true,
    } as never)

    const res = await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { 'x-api-key': 'ihui_f443_key' },
      payload: chatPayload(),
    })
    await server.close()

    expect(res.statusCode).toBe(200)
    expect(vi.mocked(forwardToChannel).mock.calls.at(-1)?.[0]?.model).toBe(MAPPED_MODEL)
    const call = captured.calls.at(-1)
    expect(call?.status).toBe('success')
    expect(call?.model).toBe(MAPPED_MODEL)
    expect(call?.metadata?.mappedModel).toBe(MAPPED_MODEL)
  })

  it('缓存命中:流水 model 同为映射后模型,metadata 带 modelMappingMeta', async () => {
    const server = await boot('/v1', v1PublicRoutes)
    const cachedPayload = {
      id: 'chatcmpl-cache',
      object: 'chat.completion',
      created: 1,
      model: MAPPED_MODEL,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'cached' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
    }
    vi.mocked(getRelayResponseCache).mockReturnValueOnce({
      get: vi.fn(async () => ({ hit: true, data: cachedPayload })),
      set: vi.fn(async () => {}),
    } as never)

    const res = await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { 'x-api-key': 'ihui_f443_key' },
      payload: chatPayload(),
    })
    await server.close()

    expect(res.statusCode).toBe(200)
    expect(res.headers['x-cache']).toBe('HIT')
    const call = captured.calls.at(-1)
    expect(call?.model).toBe(MAPPED_MODEL)
    expect(call?.metadata?.cacheHit).toBe(true)
    expect(call?.metadata?.originalModel).toBe(REQUESTED_MODEL)
    expect(call?.metadata?.mappedModel).toBe(MAPPED_MODEL)
  })

  it('未配置映射:仍回退请求 model(不改变既有行为)', async () => {
    vi.mocked(resolveModelMapping).mockResolvedValueOnce({ mapped: false } as never)
    const server = await boot('/v1', v1PublicRoutes)
    stubAiService({
      content: 'pong',
      model: REQUESTED_MODEL,
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    })

    const res = await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { 'x-api-key': 'ihui_f443_key' },
      payload: chatPayload(),
    })
    await server.close()

    expect(res.statusCode).toBe(200)
    expect(captured.calls.at(-1)?.model).toBe(REQUESTED_MODEL)
  })
})
