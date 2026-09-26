// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 格②(2026-09-26):`/v1/*` 网关五文件的耗时落库回归。
 *
 * 判的是同一件事的两半:
 *  A. `llm_call_logs.latency_ms`(以及 `ttft_ms`)必须由 `utils/elapsed-ms.ts` 的单调钟 ×
 *     墙钟交叉校验样本产生,并经 `utils/latency-persistence.ts` 唯一适配器投影;
 *  B. 不可信样本(时钟步进 / 休眠 / 容器漂移 ⇒ 负值或小时级)落 0 属"非空列形态兜底",
 *     真相随行写进 `metadata.latencyTrusted` —— 一条坏样本就能把付费用户可见的 p95
 *     (`routes/admin/relay-stats.ts`、`routes/developer-relay-usage-analytics.ts`)整体带偏,
 *     而账面什么都看不出来,所以"能过滤"必须是可证的。
 *
 * 取证构成:
 *  1) 纯函数四态(可信取整 / 分歧 / 负差值 / 不可信样本仍保留 perfMs 供观测)+ `elapsedClockStats()` 增量;
 *  2) 端到端落库形态(v1-messages 非流式 + v1-public 非流式,假时钟注入 ⇒ 捕获 recordCall 入参);
 *  3) 既有键不变性(key 集合与 metadata 既有键逐字对账);
 *  4) 五文件源码静态锁(判据窄:只看 `latencyMs:` / `ttftMs:` 属性值切片的裸墙钟差值)。
 *
 * 禁止连库:recordCall 全程 mock,不产生任何 SQL。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify, { type FastifyPluginAsync } from 'fastify'
import type { RecordCallInput } from '../src/services/relay-billing-service.js'
import { startStopwatch, elapsedClockStats } from '../src/utils/elapsed-ms.js'
import type {
  ElapsedClockStats,
  StartStopwatchOptions,
  Stopwatch,
} from '../src/utils/elapsed-ms.js'
import { persistableLatency } from '../src/utils/latency-persistence.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ============================================================================
// 假时钟:生产代码调 startStopwatch() 不传 clocks ⇒ 在模块层注入(既有正例
// tests/clawdbot-elapsed-wiring.test.ts)。唯一出口本身的判据不被 mock,只换钟。
// ============================================================================
const { clock, captured } = vi.hoisted(() => ({
  clock: { perf: 0, wall: 0 },
  captured: { inputs: [] as RecordCallInput[] },
}))

/** 被 mock 的那道出口在本测试里用到的面(用显式接口,免写 import() 类型注解) */
interface ElapsedMsModule {
  startStopwatch(opts?: StartStopwatchOptions): Stopwatch
  elapsedClockStats(): ElapsedClockStats
}

vi.mock('../src/utils/elapsed-ms.js', async (importOriginal) => {
  const actual = (await importOriginal()) as ElapsedMsModule
  return {
    ...actual,
    startStopwatch: (opts?: StartStopwatchOptions) =>
      actual.startStopwatch({
        ...opts,
        clocks: { perfNow: () => clock.perf, wallNow: () => clock.wall },
      }),
  }
})

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.AI_SERVICE_URL ??= 'http://test-ai-service:8802'
})

// ---------------------------------------------------------------- 鉴权 / 计费
const MOCK_API_KEY = {
  id: 'ak_test_001',
  userId: 'user_test_001',
  key: 'ihui_test_key',
  permissions: ['chat:write', '*'],
  rateLimit: 100,
}

vi.mock('../src/plugins/api-key-auth.js', () => ({
  requireApiKeyAuth: vi.fn(async (request: { apiKey?: typeof MOCK_API_KEY }) => {
    request.apiKey = MOCK_API_KEY
  }),
  requireApiKeyPermission: vi.fn(() => async () => {}),
  requireApiKeyQuota: vi.fn(() => async () => {}),
  modelInList: vi.fn(() => true),
}))

// recordCall 是"坏样本会不会污染 p95"的唯一观察窗:整块替换,把入参原样收下。
vi.mock('../src/services/relay-billing-service.js', () => ({
  checkQuota: vi.fn(async () => ({
    allowed: true,
    apiKeyId: 'ak_test_001',
    userId: 'user_test_001',
    tokenBalance: 100000,
    costBalanceCents: 100000,
  })),
  recordCall: vi.fn(async (input: RecordCallInput) => {
    captured.inputs.push(input)
    return {
      logId: 'log_test_001',
      costCents: 1,
      newTokenBalance: 99999,
      newCostBalanceCents: 99999,
    }
  }),
  isByokCall: vi.fn(async () => false),
  modelToProviderCode: vi.fn(() => 'openai'),
  preDeductQuota: vi.fn(async () => null),
  BillingUnavailableError: class BillingUnavailableError extends Error {},
}))

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
  tryAcquireUserConcurrency: vi.fn(() => ({ ok: true, current: 1, limit: 10 })),
  releaseUserConcurrency: vi.fn(),
}))

// 渠道直连返回 null ⇒ 走 ai-service 既有链路(本票要量的正是这条链的落库形态)
vi.mock('../src/services/relay-upstream-forwarder.js', () => ({
  forwardToChannel: vi.fn(async () => null),
  pipeChannelStream: vi.fn(),
}))

vi.mock('../src/services/model-mapping-service.js', () => ({
  resolveModelMapping: vi.fn(async () => ({ mapped: false })),
}))

// 响应缓存关掉:缓存命中分支会短路掉真实上游调用,量不到本次要证的落库形态
vi.mock('../src/services/relay-response-cache.js', () => ({
  getRelayResponseCache: vi.fn(() => null),
  computeCacheKey: vi.fn(() => 'k'),
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

// ============================================================================
// 静态判据(取证 4)
// ============================================================================

/** 剥注释(字符串感知):说明性文字里出现过 `Date.now()` 不得被判成代码。 */
function stripComments(src: string): string {
  let out = ''
  let i = 0
  let inLine = false
  let inBlock = false
  let quote: string | null = null
  while (i < src.length) {
    const c = src[i] ?? ''
    const n = src[i + 1] ?? ''
    if (inLine) {
      if (c === '\n') {
        inLine = false
        out += c
      }
      i += 1
      continue
    }
    if (inBlock) {
      if (c === '*' && n === '/') {
        inBlock = false
        i += 2
      } else {
        out += c === '\n' ? '\n' : ' '
        i += 1
      }
      continue
    }
    if (quote !== null) {
      if (c === '\\') {
        out += c + n
        i += 2
        continue
      }
      out += c
      if (c === quote) quote = null
      i += 1
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c
      out += c
      i += 1
      continue
    }
    if (c === '/' && n === '/') {
      inLine = true
      i += 2
      continue
    }
    if (c === '/' && n === '*') {
      inBlock = true
      i += 2
      continue
    }
    out += c
    i += 1
  }
  return out
}

/**
 * 只判 `latencyMs:` / `ttftMs:` 属性值切片(从键后走到"同层逗号或闭合括号"为止,多行三元覆盖):
 *  - 出现裸墙钟差值 `Date.now() - x`;
 *  - 或引用被本票撤掉的墙钟起点变量(`startTime` / `firstTokenTime` / `nowMs`)——
 *    ttft 的旧形态是 `firstTokenTime - opts.startTime`,两个墙钟读数相减里没有 `Date.now()` 字面量,
 *    只看字面量就会对该形态失明,故按"起点变量"补一条同样窄的锁。
 * cutoff / 时间戳阈值等其它位置的 `Date.now() - ` 一律不算(判据窄是硬要求)。
 */
const WALL_EPOCH_IDENTS = /\b(startTime|firstTokenTime|nowMs)\b/
function rawWallDiffKeys(src: string): string[] {
  const code = stripComments(src)
  const hits: string[] = []
  const keyRe = /\b(latencyMs|ttftMs)\s*:/g
  let m: RegExpExecArray | null
  while ((m = keyRe.exec(code)) !== null) {
    const start = m.index + m[0].length
    let depth = 0
    let i = start
    while (i < code.length) {
      const ch = code[i]
      if (ch === '(' || ch === '[' || ch === '{') depth += 1
      else if (ch === ')' || ch === ']' || ch === '}') {
        if (depth === 0) break
        depth -= 1
      } else if (ch === ',' && depth === 0) break
      i += 1
    }
    const value = code.slice(start, i)
    if (/Date\.now\(\)\s*[-+]\s*[A-Za-z_$]/.test(value) || WALL_EPOCH_IDENTS.test(value)) {
      hits.push(`${m[1]}: ${value.trim()}`)
    }
  }
  return hits
}

const ROUTE_FILES = [
  'src/routes/v1-messages.ts',
  'src/routes/v1-public.ts',
  'src/routes/v1-responses.ts',
  'src/routes/v1-mcp-gateway.ts',
  'src/routes/v1-assistants.ts',
]

// ============================================================================

beforeEach(() => {
  clock.perf = 0
  clock.wall = 0
  captured.inputs.length = 0
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('取证 1:persistableLatency 纯函数四态 + 时钟质量计数', () => {
  /** 用假时钟产一个真实样本:起表后按 (perfDelta, wallDelta) 推进再 stop */
  const sampleOf = (perfDelta: number, wallDelta: number) => {
    const sw = startStopwatch()
    clock.perf += perfDelta
    clock.wall += wallDelta
    return sw.stop()
  }

  it('可信样本 ⇒ elapsedMs 取整 + latencyTrusted:true(取整由 120.6→121 证明)', () => {
    const before = elapsedClockStats()
    const s = sampleOf(120.6, 121)
    expect([s.trustworthy, s.reason]).toEqual([true, null])
    expect(persistableLatency(s)).toEqual({ latencyMs: 121, latencyTrusted: true })
    const after = elapsedClockStats()
    expect(after.total - before.total).toBe(1)
    expect(after.trustworthy - before.trustworthy).toBe(1)
    expect(after.untrustworthy - before.untrustworthy).toBe(0)
  })

  it('不可信·clock-divergence ⇒ {0,false},且 perfMs 仍在(观测用,不得当结论)', () => {
    const before = elapsedClockStats()
    const s = sampleOf(300, 100_000)
    expect([s.trustworthy, s.reason]).toEqual([false, 'clock-divergence'])
    // 变异①的靶子:不可信分支若改成 sample.perfMs,这里拿到的就是 300 而不是 0
    expect(s.perfMs).toBe(300)
    expect(persistableLatency(s)).toEqual({ latencyMs: 0, latencyTrusted: false })
    const after = elapsedClockStats()
    expect(after.divergence - before.divergence).toBe(1)
    expect(after.untrustworthy - before.untrustworthy).toBe(1)
    expect(after.trustworthy - before.trustworthy).toBe(0)
  })

  it('不可信·negative-delta(wall 回拨)⇒ {0,false} 且计入 negativeDelta', () => {
    const before = elapsedClockStats()
    const s = sampleOf(120, -5_000)
    expect([s.trustworthy, s.reason]).toEqual([false, 'negative-delta'])
    expect(persistableLatency(s)).toEqual({ latencyMs: 0, latencyTrusted: false })
    const after = elapsedClockStats()
    expect(after.negativeDelta - before.negativeDelta).toBe(1)
    expect(after.untrustworthy - before.untrustworthy).toBe(1)
  })

  it('同一张表可重复 stop(),两次样本各自独立判可信(流式 ttft + 总耗时依赖此性质)', () => {
    const sw = startStopwatch()
    clock.perf += 80
    clock.wall += 80
    const first = persistableLatency(sw.stop())
    clock.perf += 40
    clock.wall += 90_000 // 后半程发生 NTP step
    const second = persistableLatency(sw.stop())
    expect(first).toEqual({ latencyMs: 80, latencyTrusted: true })
    expect(second).toEqual({ latencyMs: 0, latencyTrusted: false })
  })
})

// ============================================================================
// 取证 2 + 3:端到端落库形态 + 既有键不变性
// ============================================================================

type Route = { default: FastifyPluginAsync }

async function boot(prefix: string, mod: Route) {
  const server = Fastify({ logger: false })
  server.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    const statusCode = err.statusCode ?? 500
    reply.status(statusCode).send({ code: statusCode, message: err.message })
  })
  await server.register(mod.default, { prefix })
  await server.ready()
  return server
}

/** 推进假时钟的 fetch 替身:perf 与 wall 各走多少,决定样本可信与否 */
function stubUpstream(perfMs: number, wallMs: number, payload: Record<string, unknown>) {
  const impl = vi.fn(async () => {
    clock.perf += perfMs
    clock.wall += wallMs
    return { ok: true, status: 200, json: async () => payload }
  })
  globalThis.fetch = impl as unknown as typeof globalThis.fetch
  return impl
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('取证 2a:v1-messages 非流式落库形态', () => {
  it('正常时钟 ⇒ latencyMs 为正且 metadata.latencyTrusted === true;既有键一字未动', async () => {
    const v1Messages = await import('../src/routes/v1-messages.js')
    const server = await boot('/v1/anthropic', v1Messages)
    stubUpstream(250, 250, {
      content: '你好,世界',
      model: 'claude-3-5-sonnet',
      usage: { prompt_tokens: 5, completion_tokens: 8, total_tokens: 13 },
    })

    const res = await server.inject({
      method: 'POST',
      url: '/v1/anthropic/messages',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: {
        model: 'claude-3-5-sonnet',
        max_tokens: 1024,
        messages: [{ role: 'user', content: '你好' }],
      },
    })
    await server.close()

    expect(res.statusCode).toBe(200)
    const input = captured.inputs[0]
    expect(input).toBeDefined()
    expect(input?.latencyMs).toBe(250)
    expect(input?.metadata?.latencyTrusted).toBe(true)
    // 既有键对账:该调用点在改动前的键集合(逐字),本票只往 metadata 里加了 latencyTrusted
    expect(Object.keys(input ?? {}).sort()).toEqual(
      [
        'apiKeyId',
        'userId',
        'model',
        'prompt',
        'response',
        'promptTokens',
        'completionTokens',
        'totalTokens',
        'latencyMs',
        'status',
        'metadata',
        'mode',
        'providerCode',
        'clientIp',
        'httpStatus',
      ].sort(),
    )
    expect(Object.keys(input?.metadata ?? {}).sort()).toEqual(['protocol', 'latencyTrusted'].sort())
    expect(input?.metadata?.protocol).toBe('anthropic-messages')
    expect(input?.status).toBe('success')
    expect(input?.httpStatus).toBe(200)
    expect(input?.errorMessage).toBeUndefined()
    // 计费金额相关的输入面:token 三元组仍由 usage 原样喂入
    expect([input?.promptTokens, input?.completionTokens, input?.totalTokens]).toEqual([5, 8, 13])
  })

  it('分歧超容差 ⇒ latencyMs === 0 且 metadata.latencyTrusted === false(坏样本不再污染 p95)', async () => {
    const v1Messages = await import('../src/routes/v1-messages.js')
    const server = await boot('/v1/anthropic', v1Messages)
    stubUpstream(260, 90_000, { content: 'ok', model: 'claude-3-5-sonnet' })

    await server.inject({
      method: 'POST',
      url: '/v1/anthropic/messages',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: {
        model: 'claude-3-5-sonnet',
        max_tokens: 1024,
        messages: [{ role: 'user', content: '你好' }],
      },
    })
    await server.close()

    const input = captured.inputs[0]
    expect(input?.latencyMs).toBe(0)
    expect(input?.metadata?.latencyTrusted).toBe(false)
    // 除耗时以外的一切照旧
    expect(input?.status).toBe('success')
    expect(input?.metadata?.protocol).toBe('anthropic-messages')
  })
})

describe('取证 2b:v1-public 非流式落库形态', () => {
  it('正常时钟 ⇒ latencyMs 为正 + latencyTrusted:true;该调用点原本不写 metadata ⇒ 只多一键', async () => {
    const v1Public = await import('../src/routes/v1-public.js')
    const server = await boot('/v1', v1Public)
    stubUpstream(320, 320, {
      content: '好的',
      model: 'gpt-4o',
      usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
    })

    const res = await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
    })
    await server.close()

    expect(res.statusCode).toBe(200)
    expect(res.json().object).toBe('chat.completion')
    const input = captured.inputs.at(-1)
    expect(input?.latencyMs).toBe(320)
    expect(input?.metadata).toEqual({ latencyTrusted: true })
    expect(Object.keys(input ?? {}).sort()).toEqual(
      [
        'apiKeyId',
        'userId',
        'model',
        'prompt',
        'response',
        'promptTokens',
        'completionTokens',
        'totalTokens',
        'cacheReadTokens',
        'cacheCreationTokens',
        'latencyMs',
        'status',
        'metadata',
        'mode',
        'providerCode',
        'configId',
        'keyPoolId',
        'clientIp',
        'httpStatus',
        'preDeducted',
      ].sort(),
    )
    expect([input?.promptTokens, input?.completionTokens, input?.totalTokens]).toEqual([3, 4, 7])
    expect(input?.preDeducted).toBeNull()
  })

  it('wall 回拨 ⇒ latencyMs === 0 且 latencyTrusted === false,其余字段同形', async () => {
    const v1Public = await import('../src/routes/v1-public.js')
    const server = await boot('/v1', v1Public)
    stubUpstream(320, -5_000, {
      content: '好的',
      model: 'gpt-4o',
      usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
    })

    await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
    })
    await server.close()

    const input = captured.inputs.at(-1)
    expect(input?.latencyMs).toBe(0)
    expect(input?.metadata).toEqual({ latencyTrusted: false })
    expect(input?.status).toBe('success')
  })
})

// ============================================================================
// 取证 4:五文件源码静态锁
// ============================================================================

describe('取证 4:五路由文件的 latencyMs/ttftMs 不再有裸墙钟差值', () => {
  it('判据本身有牙:阳性对照(改回裸差值)必被点名', () => {
    const dirty = `
      recordCall({
        status: 'success',
        latencyMs: Date.now() - startTime,
        ttftMs:
          firstTokenTime !== null ? firstTokenTime - startTime : undefined,
      })`
    expect(rawWallDiffKeys(dirty)).toHaveLength(2)
  })

  it('判据刻意窄:cutoff / 其它键 / 说明文字里的 Date.now() 都不算', () => {
    const benign = [
      'const cutoff = Date.now() - 86_400_000 // 24h',
      '// 原 `const startTime = Date.now()` 是墙钟 epoch,换成单调钟表',
      "const url = 'https://example.com/a//b'",
      'recordCall({ latencyMs: latency.latencyMs, ttftMs: ttft ? ttft.latencyMs : undefined })',
      'const created = Math.floor(Date.now() / 1000)',
    ].join('\n')
    expect(rawWallDiffKeys(benign)).toEqual([])
  })

  for (const rel of ROUTE_FILES) {
    it(`${rel} 无裸墙钟耗时差值,且已接唯一适配器`, () => {
      const src = readFileSync(resolve(ROOT, rel), 'utf8')
      expect(rawWallDiffKeys(src)).toEqual([])
      expect(src).toContain('persistableLatency(')
      expect(src).toContain('startStopwatch(')
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
