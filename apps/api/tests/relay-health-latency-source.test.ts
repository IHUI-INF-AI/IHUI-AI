// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 格② 「耗时样本唯一出口」在 relay 健康巡检服务上的接线回归(2026-09-26 立,不连库)。
//
// 被测缺陷:relay-health-check-service.runHealthCheck 的三个 return 分支曾用裸墙钟差值当耗时,
// 那种差值会被 NTP 步进 / 系统休眠 / 容器时钟漂移打穿成负数或巨大值,而它直接进 admin 展示面
// (routes/admin/relay-key-pool.ts 的 :id/health 响应)。另一处 checkSingleKey 的 "Key 不存在"
// 分支写 latencyMs: 0 —— 那不是测量值而是"根本没测",按格②的规矩属于用 0 冒充耗时。
//
// 本文件的实测结论(判据只钉这些,不造判据):
//  - latencyMs **不写库**:persistResult 的 set() 只写 healthStatus / healthCheckedAt /
//    lastErrorMessage / extraMetadata / updatedAt(可选 isEnabled),ai_relay_key_pool 也没有任何耗时列
//    (packages/database/src/schema/ai-relay.ts 全文无 latency 字段)⇒ 由用例④逐键断言兜住回升。
//  - **该服务不按耗时判熔断**:persistResult 的 consecutiveFailures 只看 result.status,
//    shouldDisable 只看 status + 失败计数。所以用例④只钉"不可信样本(null)不改变既有计数语义",
//    不去断言任何"按耗时熔断"的判据(那种判据本仓不存在)。
//
// 取证纪律(§判据不得把仓库瞬时状态当恒定前提):
//  - 时钟全部由用例注入(vi.hoisted 假时钟 + 对 utils/elapsed-ms.ts 的**只换 clocks**的部分 mock,
//    交叉校验判据与计数仍走真实出口,不由测试重写一份);
//  - 计数断言一律取 elapsedClockStats() 的前后**差值**,不依赖仓库/进程当前累计读数;
//  - 静态锁判的是"该文件不得再出现裸墙钟差值形态",不锚定行号、不锚定"HEAD 现在有几处"。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type * as ElapsedMs from '../src/utils/elapsed-ms.js'

// ── 假时钟注入口:每次起表都拿一把独立的钟 ──
const { clockHolder } = vi.hoisted(() => ({
  clockHolder: {
    factory: null as null | (() => { perfNow(): number; wallNow(): number }),
  },
}))

// 只替换"用哪把钟",判据与计数沿用真实出口模块(否则测试只是复读实现)。
vi.mock('../src/utils/elapsed-ms.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ElapsedMs>()
  return {
    ...actual,
    startStopwatch: (opts?: Parameters<typeof actual.startStopwatch>[0]) =>
      actual.startStopwatch({
        ...opts,
        clocks: clockHolder.factory ? clockHolder.factory() : opts?.clocks,
      }),
  }
})

// ── db / 解密 / fetch 全部 mock(风格对齐 tests/relay-health-recovery.test.ts)──
const { mockDbReadSelect, mockDbUpdate, mockDecryptJSON, mockFetch } = vi.hoisted(() => ({
  mockDbReadSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDecryptJSON: vi.fn(),
  mockFetch: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: mockDbUpdate },
  dbRead: { select: mockDbReadSelect },
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  aiModelConfig: {
    id: 'id',
    providerCode: 'provider_code',
    baseUrl: 'base_url',
    enabled: 'enabled',
  },
  aiRelayKeyPool: {
    id: 'id',
    apiKeyEnc: 'api_key_enc',
    providerCode: 'provider_code',
    extraMetadata: 'extra_metadata',
    isEnabled: 'is_enabled',
    healthStatus: 'health_status',
    healthCheckedAt: 'health_checked_at',
    lastErrorMessage: 'last_error_message',
    updatedAt: 'updated_at',
  },
}))

vi.mock('../src/utils/crypto.js', () => ({
  encryptJSON: vi.fn(),
  // 解密直通:apiKeyEnc 存的就是 JSON 形式的"明文 key",不引入真实密钥
  decryptJSON: mockDecryptJSON.mockImplementation((v: unknown) => v),
}))

global.fetch = mockFetch as unknown as typeof fetch

const { checkSingleKey } = await import('../src/services/relay-health-check-service.js')
const { elapsedClockStats } = await import('../src/utils/elapsed-ms.js')

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SERVICE_FILE = resolve(ROOT, 'src/services/relay-health-check-service.ts')
const KEY_POOL_ROUTE_FILE = resolve(ROOT, 'src/routes/admin/relay-key-pool.ts')

/**
 * 假时钟:每次读表前进固定步长。
 * startStopwatch 起表各读一次、stop 各读一次 ⇒ perfMs = perfStep、wallMs = wallStep,
 * 与被测代码走哪个分支无关(解密失败/未找到 base_url/ping 结果 三条分支都拿得到样本)。
 * 顺带钉住"一次巡检只 stop 一次":stop 被多调一次就会读出 2×perfStep。
 */
function fakeClockSteps(perfStep: number, wallStep: number): () => ElapsedMs.ClockSource {
  return () => {
    let perf = 0
    let wall = 0
    return {
      perfNow: () => (perf += perfStep),
      wallNow: () => (wall += wallStep),
    }
  }
}

/** dbRead.select 链式 builder:按调用顺序吐 rowsSets(超出后重复最后一组)。 */
function stubSelectReads(rowsSets: unknown[][]) {
  let call = 0
  mockDbReadSelect.mockImplementation(() => {
    const rows = rowsSets[Math.min(call++, rowsSets.length - 1)] ?? []
    const builder: Record<string, unknown> = {}
    builder.from = vi.fn(() => builder)
    builder.where = vi.fn(() => builder)
    builder.limit = vi.fn(() => Promise.resolve(rows))
    builder.then = (resolve_: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve_)
    return builder
  })
}

/** 捕获 persistResult / recoverDisabledKeys 写库的 set() 载荷。 */
function stubUpdateCapture(): Array<Record<string, unknown>> {
  const updates: Array<Record<string, unknown>> = []
  mockDbUpdate.mockImplementation(() => ({
    set: (s: Record<string, unknown>) => {
      updates.push(s)
      return { where: vi.fn(() => Promise.resolve()) }
    },
  }))
  return updates
}

/**
 * key 行:extraMetadata.baseUrl 覆写走的是服务里"key 级覆写优先"那条分支
 * (与渠道路由的 per-key 覆盖同源),这样一次 checkSingleKey 只发生一次 dbRead,
 * 断言不依赖内部读序,少一层会腐烂的前提。
 */
function keyRow(id: string, consecutiveFailures = 0): Record<string, unknown> {
  return {
    id,
    providerCode: 'swiftapi',
    // 解密直通 ⇒ 上游收到的 Authorization 含 `${id}-key`
    apiKeyEnc: JSON.stringify(`${id}-key`),
    extraMetadata: {
      consecutiveFailures,
      baseUrl: 'https://upstream.example.com/v1',
    },
  }
}

/** fetch 按 Authorization 里的 key 内容回指定状态码(未列出的 key 一律回 500)。 */
function stubUpstream(statusBy: Record<string, number>): void {
  mockFetch.mockImplementation(
    async (_url: unknown, init: { headers: Record<string, string> }) => {
      const auth = String(init.headers['Authorization'] ?? '')
      const hit = Object.entries(statusBy).find(([key]) => auth.includes(`${key}-key`))
      return { status: hit ? hit[1] : 500 }
    },
  )
}

describe('格② relay 健康巡检耗时经唯一出口', () => {
  beforeEach(() => {
    clockHolder.factory = null
    mockDbUpdate.mockReset()
    mockDbReadSelect.mockReset()
    mockFetch.mockReset()
    mockDecryptJSON.mockClear()
    // db.update 默认给一条 no-op 链:凡不需要检查落库载荷的用例(①②③)也不必自己造
    mockDbUpdate.mockImplementation(() => ({
      set: () => ({ where: () => Promise.resolve() }),
    }))
  })

  it('① 单调钟与墙钟分歧超容差 ⇒ latencyMs 为 null,且不可信样本恰计 +1(不静默丢)', async () => {
    // perf 走 120ms,墙钟走一小时(NTP step / 休眠唤醒量级)—— 旧算法这里会直接报 3_600_120
    clockHolder.factory = fakeClockSteps(120, 120 + 3_600_000)
    stubSelectReads([[keyRow('k1')]])
    stubUpstream({ k1: 200 })
    const before = elapsedClockStats()

    const result = await checkSingleKey('k1')

    expect(result.status).toBe('healthy')
    expect(result.latencyMs).toBeNull()
    const after = elapsedClockStats()
    expect(after.untrustworthy - before.untrustworthy).toBe(1)
    // 一次巡检 = 一个样本:既没被丢掉(总样本数照样 +1),也没重复计
    expect(after.total - before.total).toBe(1)
  })

  it('② 双钟同速 ⇒ latencyMs 是非负数字,可信样本恰计 +1(与旧墙钟算法同量级)', async () => {
    clockHolder.factory = fakeClockSteps(120, 120)
    stubSelectReads([[keyRow('k2')]])
    stubUpstream({ k2: 200 })
    const before = elapsedClockStats()

    const result = await checkSingleKey('k2')

    expect(typeof result.latencyMs).toBe('number')
    expect(result.latencyMs).not.toBeNull()
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    // 逐字等于注入的单调钟差值 = 旧算法在时钟正常时的读数 ⇒ 等价回归,没有换量级
    expect(result.latencyMs).toBe(120)
    const after = elapsedClockStats()
    expect(after.trustworthy - before.trustworthy).toBe(1)
    expect(after.untrustworthy - before.untrustworthy).toBe(0)
  })

  it('③ "Key 不存在"不再用 0 冒充测量:latencyMs=null 且一次采样都不产生', async () => {
    // 即便给一把完全正常的钟,这条早退分支也必须没有样本 —— 否则 0 是从"测到了"来的
    clockHolder.factory = fakeClockSteps(120, 120)
    stubSelectReads([[]])
    const before = elapsedClockStats()

    const result = await checkSingleKey('no-such-key')

    expect(result.status).toBe('down')
    expect(result.errorMessage).toBe('Key 不存在')
    // 契约取 null 而不是删字段:同一个 HealthCheckResult 被 persistResult 与展示面共用,
    // 删字段会让"未测量"与"测量不可信"分成两套形状;null 已经是格②里"不得当耗时结论消费"的那一档。
    expect(result.latencyMs).toBeNull()
    expect(result.latencyMs).not.toBe(0)
    expect(elapsedClockStats().total).toBe(before.total)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('④ 不可信样本不改变熔断计数语义,且耗时不写库', async () => {
    clockHolder.factory = fakeClockSteps(120, 120 + 3_600_000)
    // 已连败 2 次的 key,上游回 401 ⇒ 应当照常累计到 3 并禁用
    stubSelectReads([[keyRow('k4', 2)]])
    stubUpstream({ k4: 401 })

    const updates = stubUpdateCapture()
    const result = await checkSingleKey('k4')

    expect(result.latencyMs).toBeNull()
    // 恰一次写库(不可信样本既不让计数跳过,也不让流程重跑)
    expect(updates).toHaveLength(1)
    const payload = updates[0] as Record<string, unknown>
    const meta = payload.extraMetadata as Record<string, unknown>
    expect(meta.consecutiveFailures).toBe(3)
    expect(payload.healthStatus).toBe('down')
    expect(payload.isEnabled).toBe(false)
    // 实测:该服务不按耗时判熔断 ⇒ 落库载荷里不得出现任何耗时字段(耗时列在 schema 里也不存在)
    expect(Object.keys(payload).filter((k) => /latency/i.test(k))).toEqual([])
  })

  it('④b 不可信样本下的 healthy 仍把连败计数重置为 0', async () => {
    clockHolder.factory = fakeClockSteps(120, 120 + 3_600_000)
    stubSelectReads([[keyRow('k5', 2)]])
    stubUpstream({ k5: 200 })

    const updates = stubUpdateCapture()
    const result = await checkSingleKey('k5')

    expect(result.latencyMs).toBeNull()
    expect(updates).toHaveLength(1)
    const meta = (updates[0] as Record<string, unknown>).extraMetadata as Record<string, unknown>
    expect(meta.consecutiveFailures).toBe(0)
  })
})

describe('格② 静态锁:裸墙钟差值不得回到该服务', () => {
  const BARE_WALL_CLOCK_DELTA = /Date\.now\(\)\s*-\s*/
  const serviceSrc = readFileSync(SERVICE_FILE, 'utf8')

  it('判据本身有牙:必须命中被禁形态、放过合法形态', () => {
    // 阳性对照 —— 缺了它,下面的断言就只是"正则写错了也照样绿"的废话
    expect(BARE_WALL_CLOCK_DELTA.test('      latencyMs: Date.now() - startedAt,')).toBe(true)
    expect(BARE_WALL_CLOCK_DELTA.test('      latencyMs: Date.now()-startedAt,')).toBe(true)
    // 反向对照:本票产出的写法不得被判成违规
    expect(BARE_WALL_CLOCK_DELTA.test('      latencyMs: sw.stop().elapsedMs,')).toBe(false)
    expect(BARE_WALL_CLOCK_DELTA.test('  wallNow: () => Date.now(),')).toBe(false)
  })

  it('relay-health-check-service.ts 内不得再出现 Date.now() - 形态的差值表达式', () => {
    const offenders: string[] = []
    serviceSrc.split(/\r?\n/).forEach((line, i) => {
      if (BARE_WALL_CLOCK_DELTA.test(line)) offenders.push(`L${i + 1}: ${line.trim()}`)
    })
    expect(offenders).toEqual([])
  })

  it('耗时出口接线在位(被摘线就要红,别等下次漂移才发现)', () => {
    expect(serviceSrc).toContain("from '../utils/elapsed-ms.js'")
    expect(serviceSrc).toContain('startStopwatch()')
    expect(serviceSrc).toContain('latencyMs: number | null')
    // "Key 不存在"这条早退分支不得回到 0
    expect(serviceSrc).toContain('latencyMs: null, errorMessage')
  })
})

describe('格② 响应面契约与 relay-channels 既有写法同形', () => {
  const routeSrc = readFileSync(KEY_POOL_ROUTE_FILE, 'utf8')

  it('响应透出 null + 并写 latencyTrusted(不得把不可信样本写成 0)', () => {
    // 与 routes/admin/relay-channels.ts 的**响应**面逐字同形(:797-803 原样透出 null)。
    // `?? 0` 只属于写库面(llm_call_logs.latency_ms 列非空),响应面套 0 会被读成"该 key 0ms"。
    expect(routeSrc).toContain('latencyMs: result.latencyMs,')
    expect(routeSrc).toContain('latencyTrusted: result.latencyMs !== null')
    // 反向锁:响应面出现 `?? 0` 兜底 ⇒ 红(两型形态不同,混用就是把"没测出"洗成"很快")
    expect(routeSrc).not.toContain('latencyMs: result.latencyMs ?? 0')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
