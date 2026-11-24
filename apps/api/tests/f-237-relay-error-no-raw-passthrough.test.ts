// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-237 回归锁(2026-11-13)。
 *
 * 病灶:resolveErrorPassthrough 在「无启用规则命中」与「规则查询/匹配抛错」两条分支里
 * 都回 `raw || DEFAULT_MESSAGE`,而上游错误原文可能含账号标识、组织 ID、request id、
 * 内部 URL —— 未命中规则本应回通用文案,却把上游原文原样透给终端用户。
 *
 * 本文件锁:
 *   ① 未命中规则:502 + 'AI service error',响应体不得出现上游原文特征串;
 *   ② 规则匹配抛错:同样 502 + 通用文案(不 500,不外泄异常细节);
 *   ③ 命中规则:仍返回规则映射文案(行为不变);
 *   ④ 源锁:服务实现里不得再有 `message: raw` 形式的直通分支,路由必须转发映射结果。
 *
 * 走真实 /v1/agents/:id/call 路由 + 真实 relay-error-rules-service,只 mock db /
 * 鉴权 / ai-service 调用 / 与本路径无关的重依赖,不触达 PG、Redis、ai-service。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const MOCK_API_KEY = {
  id: 'ak_f237',
  userId: 'user_f237',
  key: 'ihui_f237_key',
  permissions: ['agents:call', '*'],
  rateLimit: 100,
}

vi.mock('../src/plugins/api-key-auth.js', () => ({
  requireApiKeyAuth: vi.fn(async (request: { apiKey?: typeof MOCK_API_KEY }) => {
    request.apiKey = MOCK_API_KEY
  }),
  requireApiKeyPermission: vi.fn(() => async () => {}),
  requireApiKeyQuota: vi.fn(() => async () => {}),
  modelInList: vi.fn(() => true),
  authenticateApiKey: vi.fn(),
}))

// 每条请求按序消费:第 1 条是 agents 行查询,第 2 条是错误透传规则的查询。
const { queryQueue } = vi.hoisted(() => ({
  queryQueue: [] as Array<() => Promise<unknown[]>>,
}))

vi.mock('../src/db/index.js', () => {
  const makeChain = (resolver: () => Promise<unknown[]>) => {
    const step: Record<string, unknown> = {}
    for (const m of [
      'from',
      'where',
      'set',
      'returning',
      'values',
      'innerJoin',
      'orderBy',
      'limit',
      'offset',
      'groupBy',
    ]) {
      step[m] = vi.fn(() => step)
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      resolver().then(resolve, reject)
    return step
  }
  return {
    db: {
      execute: vi.fn(async () => []),
      select: vi.fn(() => makeChain(async () => [])),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    dbRead: {
      select: vi.fn(() => {
        const next = queryQueue.shift()
        if (!next) throw new Error('F-237: 未预期的 dbRead.select()')
        return makeChain(next)
      }),
    },
  }
})

// 以下是 v1-public 的其余外部依赖(本路径不执行,仅为 import 安全 / 不触达真实设施)。
vi.mock('../src/services/relay-billing-service.js', () => ({
  checkQuota: vi.fn(),
  recordCall: vi.fn(),
  isByokCall: vi.fn(async () => false),
  modelToProviderCode: vi.fn(() => 'openai'),
  preDeductQuota: vi.fn(async () => null),
  BillingUnavailableError: class BillingUnavailableError extends Error {},
}))

vi.mock('../src/services/user-concurrency-service.js', () => ({
  tryAcquireUserConcurrency: vi.fn(() => ({ ok: true, current: 1, limit: 10, release: vi.fn() })),
  acquireUserConcurrencyForResponse: vi.fn(() => ({
    ok: true,
    current: 1,
    limit: 10,
    release: vi.fn(),
  })),
  releaseUserConcurrency: vi.fn(),
}))

vi.mock('../src/services/relay-upstream-forwarder.js', () => ({
  forwardToChannel: vi.fn(async () => null),
  pipeChannelStream: vi.fn(),
}))

vi.mock('../src/services/model-mapping-service.js', () => ({
  resolveModelMapping: vi.fn(async () => ({ mapped: false })),
}))

vi.mock('../src/services/relay-response-cache.js', () => ({
  getRelayResponseCache: vi.fn(() => null),
  computeCacheKey: vi.fn(() => 'k'),
  shouldSkipCache: vi.fn(() => ({ skip: false })),
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

const { aiServiceSystemFetch } = vi.hoisted(() => ({ aiServiceSystemFetch: vi.fn() }))

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch,
  aiServiceFetch: vi.fn(),
  aiServiceFetchStream: vi.fn(),
  aiServiceUserFetch: vi.fn(),
}))

const A_UUID = '123e4567-e89b-42d3-a456-426614174000'
const DEFAULT_MESSAGE = 'AI service error'
/** 上游原文:含组织 ID / request id / 内部 URL / 账号标识,任何一项落到响应体都算外泄。 */
const RAW =
  'upstream failure org=org_9f8e7d request_id=req_abc123 endpoint=https://internal.upstream.local/v1/messages account=acct_42'
const LEAK_MARKERS = ['org_9f8e7d', 'req_abc123', 'internal.upstream.local', 'acct_42']

const AGENT_ROW = {
  agentId: A_UUID,
  status: 'published',
  agentPrompt: '你是助手',
  agentModel: 'gpt-4o',
}

const upstreamError = (raw: string): Response =>
  new Response(JSON.stringify({ error: true, error_message: raw }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('F-237 错误透传未命中规则不得回传上游原文', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    vi.stubEnv('AI_SERVICE_URL', 'http://test-ai-service:8802')
    const { default: v1PublicRoutes } = await import('../src/routes/v1-public.js')
    app = Fastify({ logger: false })
    await app.register(v1PublicRoutes, { prefix: '/v1' })
    await app.ready()
    // 动态 import 会拉起整张路由图;冷 transform 在并发/首次运行时可能超过全局 15s hookTimeout。
  }, 60_000)

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(() => {
    queryQueue.length = 0
    aiServiceSystemFetch.mockReset()
    aiServiceSystemFetch.mockResolvedValue(upstreamError(RAW))
  })

  const call = () =>
    app.inject({
      method: 'POST',
      url: `/v1/agents/${A_UUID}/call`,
      headers: { 'x-api-key': 'ihui_f237_key' },
      payload: { input: '你好' },
    })

  it('① 未命中规则:响应为 DEFAULT_MESSAGE,且不含上游原文特征串', async () => {
    queryQueue.push(
      async () => [AGENT_ROW],
      async () => [],
    )

    const res = await call()
    expect(res.statusCode).toBe(502)
    const body = res.json() as { code: number; message: string }
    expect(body.code).toBe(502)
    expect(body.message).toBe(DEFAULT_MESSAGE)
    for (const marker of LEAK_MARKERS) {
      expect(res.body).not.toContain(marker)
    }
  })

  it('② 规则匹配抛错:同样 DEFAULT_MESSAGE(不 500,不外泄)', async () => {
    queryQueue.push(
      async () => [AGENT_ROW],
      async () => {
        throw new Error('rules query exploded db=/var/lib/postgresql secret=should-not-leak')
      },
    )

    const res = await call()
    expect(res.statusCode).toBe(502)
    const body = res.json() as { code: number; message: string }
    expect(body.code).toBe(502)
    expect(body.message).toBe(DEFAULT_MESSAGE)
    expect(res.body).not.toContain('rules query exploded')
    expect(res.body).not.toContain('should-not-leak')
    for (const marker of LEAK_MARKERS) {
      expect(res.body).not.toContain(marker)
    }
  })

  it('③ 命中规则:仍返回规则映射文案(行为不变)', async () => {
    queryQueue.push(
      async () => [AGENT_ROW],
      async () => [
        {
          id: 'rule-1',
          upstreamStatus: 502,
          keyword: null,
          downstreamStatus: 503,
          messageTemplate: '上游服务繁忙,请稍后再试',
          exposeUpstreamMessage: false,
          priority: 0,
          enabled: true,
        },
      ],
    )

    const res = await call()
    expect(res.statusCode).toBe(503)
    const body = res.json() as { code: number; message: string }
    expect(body.code).toBe(503)
    expect(body.message).toBe('上游服务繁忙,请稍后再试')
    expect(res.body).not.toContain(RAW)
  })

  it('④ 源锁:未命中/异常分支不再直通原始 upstream message,路由转发映射结果', () => {
    const serviceSrc = readFileSync(
      fileURLToPath(new URL('../src/services/relay-error-rules-service.ts', import.meta.url)),
      'utf8',
    )
    // 禁止 `message: raw` / `raw || DEFAULT_MESSAGE` 这类原文直通写法
    expect(serviceSrc).not.toMatch(/message:\s*raw\s*\|\|/)
    expect(serviceSrc).not.toMatch(/message:\s*raw\s*[,}]/)
    // 未命中与异常两条回落分支都必须使用 DEFAULT_MESSAGE
    const fallbacks =
      serviceSrc.match(/return\s*\{\s*status:\s*DEFAULT_STATUS,\s*message:\s*DEFAULT_MESSAGE/g) ??
      []
    expect(fallbacks.length).toBeGreaterThanOrEqual(2)

    const routeSrc = readFileSync(
      fileURLToPath(new URL('../src/routes/v1-public.ts', import.meta.url)),
      'utf8',
    )
    expect(routeSrc).toContain('resolveErrorPassthrough(502, data.error_message)')
    expect(routeSrc).toContain('error(passthrough.status, passthrough.message)')
    expect(routeSrc).not.toMatch(/error\(\s*passthrough\.status\s*,\s*data\.error_message/)
  })
})
