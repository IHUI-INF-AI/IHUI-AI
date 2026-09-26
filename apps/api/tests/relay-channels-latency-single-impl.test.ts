// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 格②收口(2026-09-26):`relay-channels.ts` 的 llm_call_logs 写库面必须走唯一适配器。
 *
 * 两型处置形态不同,本票只收第一型,并锁死第二型没被顺手改掉:
 *  A. **写库面**:`llm_call_logs.latency_ms` 列非空(packages/database/src/schema/llm-call-logs.ts
 *     的 `integer('latency_ms').default(0).notNull()`)⇒ 不可信样本落 0 属"列形态兜底",
 *     真相随行写 `metadata.latencyTrusted`;两者一律由 `utils/latency-persistence.ts` 的
 *     `persistableLatency(sample)` 投影,不得在调用方各写一遍。
 *  B. **响应/展示面**:`latencyMs` 原样透出 `null`(**禁止** `?? 0`,0 会被读成"0ms 很快")。
 *     这一型由既有 tests/clawdbot-elapsed-wiring.test.ts、tests/relay-health-latency-source.test.ts
 *     守着;本票取证②是它的反向锁 —— 不可信时响应必须是 null,不得被收口顺带改成 0。
 *
 * 取证构成:
 *  ① 端到端落库形态(mock db 把 `insert(llmCallLogs).values(...)` 的入参原样据住):
 *     正常时钟 ⇒ latencyMs>0 且 metadata.latencyTrusted===true;假时钟分歧超容差 ⇒ 0 且 false;
 *  ② 响应面反向锁:同一趟不可信调用里 `data.latencyMs === null`;
 *  ③ 等价性(换实现零行为差的正面证据):对同一批**真实** stopwatch 样本,唯一实现在可落库区间
 *     与旧手写形态逐值相等;分数样本处两者必然不同 —— 旧形态交小数(非空 integer 列装不下),
 *     唯一实现按 Math.round 投影(这是它入库时就写定的语义,不是本票新增的行为);
 *  ④ 一份实现的静态锁:两处手写形态不得再出现在该文件代码面(判据窄到具体表达式 ——
 *     "不得出现 latencyTrusted 字样"那种宽判据会把正确用法一起拦掉),且每一处 llmCallLogs
 *     写库面必须由 persistableLatency 背书;阳性对照 + 反向对照各一条,证明尺子有牙也不误伤。
 *
 * 禁止连库:db / dbRead / crypto / relay-channel-router 全程 mock,不产生任何 SQL。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify, { type FastifyInstance } from 'fastify'
import { startStopwatch, elapsedClockStats } from '../src/utils/elapsed-ms.js'
import type {
  ElapsedClockStats,
  ElapsedSample,
  StartStopwatchOptions,
  Stopwatch,
} from '../src/utils/elapsed-ms.js'
import { persistableLatency } from '../src/utils/latency-persistence.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROUTE_FILE = resolve(ROOT, 'src/routes/admin/relay-channels.ts')

// ============================================================================
// 假时钟:生产代码调 startStopwatch() 不传 clocks ⇒ 只能在模块层注入
// (正例见 tests/v1-latency-persistence.test.ts / tests/clawdbot-elapsed-wiring.test.ts)
// 只换钟,唯一出口自身的交叉校验判据不被 mock。
// ============================================================================
const { clock, captured } = vi.hoisted(() => ({
  clock: { perf: 0, wall: 0 },
  captured: { rows: [] as InsertedLogRow[] },
}))

/** 该端点写进 llm_call_logs 的那一行(只声明本票判据用到的字段) */
interface InsertedLogRow {
  userId: string
  latencyMs: number
  status: string
  metadata: { isTestCall: boolean; chatUrl: string; model: string; latencyTrusted: boolean }
}

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

// ---------------------------------------------------------------- 被测面常量
const ADMIN_USER_ID = 'user_admin_latency_001'
const KEY_POOL_ID = '2f1e0d0c-0b0a-4f0e-9d0c-0b0a0f0e9d0c'
const PROVIDER_CODE = 'openai'
const BASE_URL = 'https://vendor.test/v1'
const KEY_ROW = {
  id: KEY_POOL_ID,
  providerCode: PROVIDER_CODE,
  // decryptApiKey 先 JSON.parse 再交给(已 mock 的)decryptJSON,形态只需可 parse
  apiKeyEnc: JSON.stringify({ alg: 'mock', kid: 'mock', iv: 'mock', ct: 'mock' }),
}

// ---------------------------------------------------------------- db / dbRead
vi.mock('../src/db/index.js', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(async (row: InsertedLogRow) => {
        captured.rows.push(row)
        return []
      }),
    })),
  },
  dbRead: {
    // 按投影键分发(不靠调用顺序):key_pool 条目 vs ai_model_config.base_url
    select: vi.fn((shape: Record<string, unknown>) => {
      const rows: unknown[] = []
      if ('apiKeyEnc' in shape) rows.push(KEY_ROW)
      if ('baseUrl' in shape) rows.push({ baseUrl: BASE_URL })
      return { from: () => ({ where: () => ({ limit: () => rows }) }) }
    }),
  },
}))

// ------------------------------------------------------------ 鉴权 / 上游 / 依赖
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async (request: { userId?: string }) => {
    request.userId = ADMIN_USER_ID
  }),
}))

vi.mock('../src/utils/crypto.js', () => ({
  decryptJSON: vi.fn(() => 'sk-mock-upstream-key'),
}))

// 熔断服务真身会摸 Redis ⇒ 整块替换,本票不经过它
vi.mock('../src/services/relay-channel-router.js', () => ({
  getCircuitState: vi.fn(async () => ({ state: 'closed', failureCount: 0, lastFailureAt: null })),
  getRecentCalls: vi.fn(async () => []),
  resetCircuit: vi.fn(async () => undefined),
}))

const originalFetch = globalThis.fetch

/** 推进假时钟的 fetch 替身:perf 与 wall 各走多少,决定该样本可信与否 */
function stubUpstream(perfMs: number, wallMs: number) {
  globalThis.fetch = vi.fn(async () => {
    clock.perf += perfMs
    clock.wall += wallMs
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'pong' } }],
        usage: { total_tokens: 7 },
      }),
    }
  }) as unknown as typeof globalThis.fetch
}

async function boot(): Promise<FastifyInstance> {
  const server = Fastify({ logger: false })
  const route = await import('../src/routes/admin/relay-channels.js')
  await server.register(route.default)
  await server.ready()
  return server
}

function runTestCall(server: FastifyInstance) {
  return server.inject({
    method: 'POST',
    url: `/admin/relay/channels/${KEY_POOL_ID}/test`,
    payload: { model: 'gpt-4o', prompt: 'hi' },
  })
}

/** 响应契约里的展示面字段(不写 any:本票要判的正是它有没有被改成 0) */
function latencyInResponse(res: { json(): unknown }): number | null | undefined {
  const body = res.json() as { data?: { latencyMs?: number | null } }
  return body.data?.latencyMs
}

beforeEach(() => {
  clock.perf = 0
  clock.wall = 0
  captured.rows.length = 0
})

afterEach(() => {
  vi.clearAllMocks()
  globalThis.fetch = originalFetch
})

// ============================================================================
// 静态判据(取证④)
// ============================================================================

/**
 * 代码面(粗剥注释):注释里复述旧形态是**说明**,不是第二份实现。
 * 只按行首标记剥、不做字符串遮罩 —— 判据对象是整段表达式字面量,窄到这一层就够。
 */
function codeLines(src: string): string[] {
  return src.split(/\r?\n/).filter((line) => {
    const t = line.trim()
    return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('*/'))
  })
}

/** 被禁的两处手写形态(逐字表达式,不是关键词) */
const SECOND_IMPL_FORMS = [
  'latencyMs: result.latencyMs ?? 0',
  'latencyTrusted: result.latencyMs !== null',
] as const

function secondImplFormHits(lines: string[]): string[] {
  return lines.filter((line) => SECOND_IMPL_FORMS.some((form) => line.includes(form)))
}

/** 每一处 llmCallLogs 写库面,其上方 ≤5 行代码内必须有唯一出口的调用 */
function unbackedWriteFaces(lines: string[]): string[] {
  const hits: string[] = []
  lines.forEach((line, i) => {
    if (!line.includes('insert(llmCallLogs)')) return
    const window = lines.slice(Math.max(0, i - 5), i)
    if (!window.some((l) => l.includes('persistableLatency('))) hits.push(line.trim())
  })
  return hits
}

// ============================================================================

describe('取证①:写库面由唯一适配器投影(端到端)', () => {
  it('正常时钟 ⇒ latencyMs>0 且 metadata.latencyTrusted===true;随行其余字段同形', async () => {
    stubUpstream(250, 250)
    const server = await boot()
    const before = elapsedClockStats()
    const res = await runTestCall(server)
    const after = elapsedClockStats()
    await server.close()

    expect(res.statusCode).toBe(200)
    expect(captured.rows).toHaveLength(1)
    const row = captured.rows[0]
    expect(row?.latencyMs).toBeGreaterThan(0)
    expect(row?.latencyMs).toBe(250)
    expect(row?.metadata.latencyTrusted).toBe(true)
    // metadata 既有键不得少(免计费旗与真相旗同一行)
    expect(Object.keys(row?.metadata ?? {}).sort()).toEqual(
      ['isTestCall', 'chatUrl', 'model', 'latencyTrusted'].sort(),
    )
    expect(row?.metadata.isTestCall).toBe(true)
    expect(row?.metadata.chatUrl).toBe(`${BASE_URL}/chat/completions`)
    expect(row?.userId).toBe(ADMIN_USER_ID)
    expect(row?.status).toBe('success')
    // 时钟质量计数照旧被喂:收口不得把观测面改成静默
    expect(after.total - before.total).toBe(1)
    expect(after.trustworthy - before.trustworthy).toBe(1)
    expect(after.untrustworthy - before.untrustworthy).toBe(0)
  })

  it('分歧超容差 ⇒ latencyMs===0 且 latencyTrusted===false(列形态兜底,非展示兜底)', async () => {
    stubUpstream(260, 90_000)
    const server = await boot()
    const before = elapsedClockStats()
    await runTestCall(server)
    const after = elapsedClockStats()
    await server.close()

    const row = captured.rows[0]
    expect(row?.latencyMs).toBe(0)
    expect(row?.metadata.latencyTrusted).toBe(false)
    // 除耗时以外的一切照旧
    expect(row?.status).toBe('success')
    expect(row?.metadata.isTestCall).toBe(true)
    expect(after.divergence - before.divergence).toBe(1)
    expect(after.untrustworthy - before.untrustworthy).toBe(1)
  })
})

describe('取证②:响应面反向锁 —— 不可信时透出 null,不得被本票改成 0', () => {
  it('同一趟分歧调用:data.latencyMs === null,响应串不含 "latencyMs":0', async () => {
    stubUpstream(260, 90_000)
    const server = await boot()
    const res = await runTestCall(server)
    await server.close()

    expect(latencyInResponse(res)).toBeNull()
    expect(res.body).toContain('"latencyMs":null')
    expect(res.body).not.toContain('"latencyMs":0')
    // 两型各走各的投影:同一趟调用里落库仍是 0(列非空)
    expect(captured.rows[0]?.latencyMs).toBe(0)
  })

  it('正常时钟:响应透出真实毫秒数(与落库同值)', async () => {
    stubUpstream(180, 180)
    const server = await boot()
    const res = await runTestCall(server)
    await server.close()

    expect(latencyInResponse(res)).toBe(180)
    expect(captured.rows[0]?.latencyMs).toBe(180)
  })
})

describe('取证③:等价性 —— 换实现在可落库区间零行为差', () => {
  /** 旧的手写形态(本票要否证的那两份),在测试里作为对照公式重新算一遍 */
  const oldForm = (sample: ElapsedSample) => ({
    latencyMs: sample.elapsedMs ?? 0,
    latencyTrusted: sample.elapsedMs !== null,
  })

  const sampleOf = (perfDelta: number, wallDelta: number): ElapsedSample => {
    const sw = startStopwatch()
    clock.perf += perfDelta
    clock.wall += wallDelta
    return sw.stop()
  }

  it('整数毫秒 / 0ms / 分歧 / 负差值 四种样本:唯一实现 == 旧手写形态', () => {
    const cases: ReadonlyArray<readonly [number, number]> = [
      [250, 250], // 可信整数毫秒
      [0, 0], // 可信 0ms(两态都不该被读成"兜底")
      [300, 100_000], // clock-divergence
      [120, -5_000], // negative-delta
    ]
    for (const [perf, wall] of cases) {
      const s = sampleOf(perf, wall)
      expect(persistableLatency(s)).toEqual(oldForm(s))
    }
  })

  it('分数毫秒样本处两者必然不同:旧形态交小数(integer 列装不下),唯一实现取整', () => {
    const s = sampleOf(120.6, 121)
    expect(s.trustworthy).toBe(true)
    expect(oldForm(s).latencyMs).toBe(120.6)
    // 与 persistableLatency 既有测试同判据:120.6 → 121
    const projected = persistableLatency(s)
    expect(projected).toEqual({ latencyMs: 121, latencyTrusted: true })
    expect(Number.isInteger(projected.latencyMs)).toBe(true)
  })
})

describe('取证④:一份实现的静态锁(relay-channels.ts 不再有第二份手写投影)', () => {
  it('判据本身有牙:阳性对照必须同时点名两处手写形态与无人背书的写库面', () => {
    const dirty = [
      'await db.insert(llmCallLogs).values({',
      '  latencyMs: result.latencyMs ?? 0,',
      "  status: result.success ? 'success' : 'error',",
      '  metadata: { isTestCall: true, latencyTrusted: result.latencyMs !== null },',
      '})',
    ]
    expect(secondImplFormHits(dirty)).toHaveLength(2)
    expect(unbackedWriteFaces(dirty)).toHaveLength(1)
  })

  it('判据不误伤:走唯一出口的写法零命中', () => {
    const clean = [
      'const latency = persistableLatency(result.elapsedSample)',
      'await db.insert(llmCallLogs).values({',
      '  latencyMs: latency.latencyMs,',
      '  metadata: { isTestCall: true, latencyTrusted: latency.latencyTrusted },',
      '})',
    ]
    expect(secondImplFormHits(clean)).toEqual([])
    expect(unbackedWriteFaces(clean)).toEqual([])
  })

  it('真文件代码面两处手写形态为 0、写库面有背书,且响应面两处透 null 原样在位', () => {
    const src = readFileSync(ROUTE_FILE, 'utf8')
    const lines = codeLines(src)
    expect(secondImplFormHits(lines)).toEqual([])
    expect(unbackedWriteFaces(lines)).toEqual([])
    expect(src).toContain("from '../../utils/latency-persistence.js'")
    expect(src).toContain('persistableLatency(')
    // 两处响应面(:674 测速端点 / :813 本端点)一个字都没动
    expect(src.match(/latencyMs: result\.latencyMs,/g) ?? []).toHaveLength(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
