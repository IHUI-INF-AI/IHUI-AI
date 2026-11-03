// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 中转号池健康 gauge 取证(2026-10-23 立)。
 *
 * 钉死八件事,缺一不算修好:
 * - **set 语义 + 清幽灵**:二次快照后,上一轮有、这一轮没有的 key 序列必须消失
 *   (行被删/被摘 ⇒ 面板不许挂旧值);同键二次写入覆盖而非累加。
 * - **封闭四档**:健康态只认 `RELAY_POOL_HEALTH_STATES`;库是 varchar,枚举外的
 *   历史脏值必须被跳过**并计数**(rows_skipped),不悄悄丢也不入标签。
 * - **失败不写空**:查询抛错时服务不碰 gauge —— 旧值原样留着、新鲜度戳不推进,
 *   "陈"由 `*_refresh_last_success_timestamp_seconds` 自己说(§0.3:
 *   「没判」绝不写成「判过」;这里具体化成「没查到」绝不写成「池子空了」)。
 * - **显式丢失两路**:脏行(skipped)与标签撞车(collisions)都进 counter。
 * - **可负值只有一处**:token 临期允许负(负 = 已过期,正是要看的);年龄类钳 0。
 * - **null 不发序列**:从未健康检查 / 从未刷新的 key,没有"编一个 0"的选项。
 * - **标签必须有界**:provider_code / 健康态四档封闭;key 展示标签经
 *   sanitizeIhuiLabel 洗(注入字符进不了 Prometheus 文本)。
 * - **折叠零基线**:provider 出现过 ⇒ 四个态都列,缺的态是 0 不是"没有这一列"。
 *
 * 测试纪律:db 全程 mock(可链式 + 可 await),零连接 —— 不碰 PG 8810 / Redis 8811
 * (AGENTS §5 测试隔离铁律);枚举清单一律从源文件取(§22c 不抄第二份)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

/** 可链式 + 可 await 的 db 桩:每 await 一条查询就消费队列里的一批行。 */
const h = vi.hoisted(() => {
  const state: {
    queue: unknown[][]
    calls: number
    chainCalls: Array<[string, unknown[]]>
    reject: boolean
  } = { queue: [], calls: 0, chainCalls: [], reject: false }
  const chain: Record<string, unknown> = {}
  for (const m of ['from', 'where', 'groupBy', 'orderBy', 'limit', 'offset', 'having', 'on']) {
    chain[m] = (...args: unknown[]) => {
      state.chainCalls.push([m, args])
      return chain
    }
  }
  chain.then = (
    onFulfilled: (v: unknown) => unknown,
    onRejected: (e: unknown) => unknown,
  ): Promise<unknown> => {
    state.calls++
    if (state.reject) {
      return Promise.reject(new Error('模拟数据库不可用')).then(onFulfilled, onRejected)
    }
    const rows = state.queue.shift() ?? []
    return Promise.resolve(rows).then(onFulfilled, onRejected)
  }
  const db = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    execute: vi.fn(() => {
      state.calls++
      return Promise.resolve(state.queue.shift() ?? [])
    }),
    query: {},
  }
  return { state, db }
})

vi.mock('../src/db/index.js', () => ({ db: h.db, dbRead: h.db }))
vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import businessMetricsPlugin, {
  __test__ as BM,
  RELAY_POOL_HEALTH_STATES,
  RELAY_POOL_HEALTH_STATE_VALUE,
} from '../src/plugins/business-metrics.js'
import { refreshRelayPoolGaugesSafely } from '../src/services/relay-pool-stats-service.js'

let server: FastifyInstance | undefined

async function render(): Promise<string> {
  if (!server) {
    const app = Fastify({ logger: false })
    await app.register(businessMetricsPlugin)
    await app.ready()
    server = app
  }
  const res = await server.inject({ method: 'GET', url: '/business-metrics' })
  expect(res.statusCode).toBe(200)
  return res.body
}

function sampleLines(text: string, name: string): string[] {
  return text.split('\n').filter((l) => l.startsWith(`${name}{`))
}

function valueOf(text: string, name: string, labels: Record<string, string>): string | undefined {
  const labelSet = Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(',')
  const escaped = labelSet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const hit = new RegExp(`^${name}\\{${escaped}\\} (\\S+)$`, 'm').exec(text)
  return hit?.[1]
}

function gaugeValue(text: string, name: string): string | undefined {
  return new RegExp(`^${name} (\\S+)$`, 'm').exec(text)?.[1]
}

const NOW = 1_787_000_000_000 // 固定时钟:所有年龄/临期断言不受真实时间漂移影响

/** key 池一行(投影形状与 db.select 的输出逐字段对齐)。 */
function keyRow(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    providerCode: 'openai',
    name: 'openai-default',
    priority: 0,
    healthStatus: 'healthy',
    isEnabled: true,
    tempUnschedulable: false,
    healthCheckedAt: new Date(NOW - 120_000), // 2 分钟前检查过
    ...over,
  }
}

/** 账号池一行。 */
function accountRow(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    providerCode: 'trae',
    uid: 'uid-1001',
    healthStatus: 'healthy',
    isEnabled: true,
    tempUnschedulable: false,
    consecutiveFailures: 0,
    totalCalls: 12345,
    tokenExpiresAt: new Date(NOW + 3_600_000), // 1 小时后过期
    lastRefreshAt: new Date(NOW - 600_000), // 10 分钟前刷新过
    ...over,
  }
}

beforeEach(() => {
  BM.resetIhuiState()
  h.state.queue = []
  h.state.calls = 0
  h.state.chainCalls = []
  h.state.reject = false
})

afterEach(async () => {
  if (server) {
    await server.close()
    server = undefined
  }
})

describe('R) 中转号池健康 gauge:语义 + 有界标签 + 显式丢失 + 失败不写空', () => {
  it('R1 枚举自对账:四档词表与数值映射同键、单调(越大越坏)', () => {
    expect(Object.keys(RELAY_POOL_HEALTH_STATE_VALUE).sort()).toEqual(
      [...RELAY_POOL_HEALTH_STATES].sort(),
    )
    const values = RELAY_POOL_HEALTH_STATES.map((s) => RELAY_POOL_HEALTH_STATE_VALUE[s])
    // 单调不降:告警阈值才能直接写 `> 2`(= degraded 及以上)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]!)
    }
    expect(RELAY_POOL_HEALTH_STATE_VALUE.down).toBe(3)
    expect(RELAY_POOL_HEALTH_STATE_VALUE.unknown).toBe(0)
  })

  it('R2 还没刷新过:relay 全族零序列,两个新鲜度戳都是 0(≠ 池子空)', async () => {
    const text = await render()
    for (const name of [
      'ihui_relay_key_pool_health_state',
      'ihui_relay_key_pool_schedulable',
      'ihui_relay_key_pool_keys',
      'ihui_relay_key_pool_schedulable_keys',
      'ihui_relay_account_pool_health_state',
      'ihui_relay_account_pool_schedulable',
      'ihui_relay_account_pool_total_calls',
    ]) {
      expect(sampleLines(text, name).length, `${name} 未刷新时不得有序列`).toBe(0)
    }
    expect(gaugeValue(text, 'ihui_relay_key_pool_refresh_last_success_timestamp_seconds')).toBe('0')
    expect(gaugeValue(text, 'ihui_relay_account_pool_refresh_last_success_timestamp_seconds')).toBe(
      '0',
    )
  })

  it('R3 一次成功刷新:每键三件套(态/可调度/年龄)+ 账号池全字段 + 新鲜度戳推进', async () => {
    h.state.queue = [[keyRow()], [accountRow()]]
    const result = await refreshRelayPoolGaugesSafely(NOW)
    expect(result.reason).toBeUndefined()
    expect(result.keys).toBe(1)
    expect(result.accounts).toBe(1)
    expect(result.keyRowsSkipped).toBe(0)
    const text = await render()
    expect(
      valueOf(text, 'ihui_relay_key_pool_health_state', {
        provider_code: 'openai',
        key: 'openai-default-p0',
      }),
    ).toBe('1') // healthy = 1
    expect(
      valueOf(text, 'ihui_relay_key_pool_schedulable', {
        provider_code: 'openai',
        key: 'openai-default-p0',
      }),
    ).toBe('1')
    expect(
      valueOf(text, 'ihui_relay_key_pool_health_age_seconds', {
        provider_code: 'openai',
        key: 'openai-default-p0',
      }),
    ).toBe('120')
    // 折叠值:该 provider 四档各一条,healthy=1 其余 0;可用数 1
    expect(
      valueOf(text, 'ihui_relay_key_pool_keys', { provider_code: 'openai', state: 'healthy' }),
    ).toBe('1')
    expect(
      valueOf(text, 'ihui_relay_key_pool_keys', { provider_code: 'openai', state: 'down' }),
    ).toBe('0')
    expect(valueOf(text, 'ihui_relay_key_pool_schedulable_keys', { provider_code: 'openai' })).toBe(
      '1',
    )
    // 账号池:累计调用 / 临期正数 / 刷新年龄
    expect(
      valueOf(text, 'ihui_relay_account_pool_total_calls', {
        provider_code: 'trae',
        account: 'uid-1001',
      }),
    ).toBe('12345')
    expect(
      valueOf(text, 'ihui_relay_account_pool_token_expires_in_seconds', {
        provider_code: 'trae',
        account: 'uid-1001',
      }),
    ).toBe('3600')
    expect(
      valueOf(text, 'ihui_relay_account_pool_refresh_age_seconds', {
        provider_code: 'trae',
        account: 'uid-1001',
      }),
    ).toBe('600')
    // 新鲜度戳推进到本次时钟
    expect(gaugeValue(text, 'ihui_relay_key_pool_refresh_last_success_timestamp_seconds')).toBe(
      String(Math.floor(NOW / 1000)),
    )
  })

  it('R4 脏健康态行:枚举外值跳过并计数,不进标签不入数值', async () => {
    h.state.queue = [
      [
        keyRow({ name: 'good', healthStatus: 'degraded' }),
        keyRow({ name: 'bad', healthStatus: 'zombie-state' }), // varchar 脏值
        keyRow({ name: 'worse', healthStatus: '' }),
      ],
      [accountRow({ uid: 'uid-1' }), accountRow({ uid: 'uid-2', healthStatus: 'DISABLED' })],
    ]
    const result = await refreshRelayPoolGaugesSafely(NOW)
    expect(result.keys).toBe(1)
    expect(result.keyRowsSkipped).toBe(2)
    expect(result.accounts).toBe(1)
    expect(result.accountRowsSkipped).toBe(1)
    const text = await render()
    expect(sampleLines(text, 'ihui_relay_key_pool_health_state').length).toBe(1)
    expect(text).not.toContain('zombie')
    expect(text).not.toContain('DISABLED')
    expect(gaugeValue(text, 'ihui_relay_key_pool_rows_skipped_total')).toBe('2')
    expect(gaugeValue(text, 'ihui_relay_account_pool_rows_skipped_total')).toBe('1')
  })

  it('R5 set 语义 + 清幽灵:key 被删 ⇒ 序列消失;同键二次写覆盖不累加', async () => {
    h.state.queue = [
      [keyRow({ name: 'k1', priority: 0 }), keyRow({ name: 'k2', providerCode: 'groq' })],
      [accountRow()],
    ]
    await refreshRelayPoolGaugesSafely(NOW)
    let text = await render()
    expect(sampleLines(text, 'ihui_relay_key_pool_health_state').length).toBe(2)
    expect(valueOf(text, 'ihui_relay_key_pool_schedulable_keys', { provider_code: 'groq' })).toBe(
      '1',
    )

    // 第二轮:groq 那条没了(行被删/被摘),openai 那条健康态变了
    h.state.queue = [
      [keyRow({ name: 'k1', healthStatus: 'down', isEnabled: false })],
      [accountRow()],
    ]
    await refreshRelayPoolGaugesSafely(NOW + 300_000)
    text = await render()
    expect(sampleLines(text, 'ihui_relay_key_pool_health_state').length).toBe(1)
    expect(text).not.toContain('provider_code="groq"')
    expect(
      valueOf(text, 'ihui_relay_key_pool_health_state', {
        provider_code: 'openai',
        key: 'k1-p0',
      }),
    ).toBe('3') // down
    expect(
      valueOf(text, 'ihui_relay_key_pool_schedulable', {
        provider_code: 'openai',
        key: 'k1-p0',
      }),
    ).toBe('0') // isEnabled=false
    // 年龄跟着新时钟走(覆盖语义:120s + 300s = 420s,不是两条并存)
    expect(
      valueOf(text, 'ihui_relay_key_pool_health_age_seconds', {
        provider_code: 'openai',
        key: 'k1-p0',
      }),
    ).toBe('420')
  })

  it('R6 标签撞车:洗后同键的第二条不覆盖第一条,计入 collisions', async () => {
    h.state.queue = [
      [
        keyRow({ name: 'dup', priority: 0, healthStatus: 'healthy' }),
        keyRow({ name: 'dup', priority: 0, healthStatus: 'down' }), // 同名同优先级 ⇒ 撞
      ],
      [],
    ]
    await refreshRelayPoolGaugesSafely(NOW)
    const text = await render()
    expect(sampleLines(text, 'ihui_relay_key_pool_health_state').length).toBe(1)
    // 第一条(healthy)赢,第二条(down)被丢且计数 —— 少一条 key 必须看得见
    expect(
      valueOf(text, 'ihui_relay_key_pool_health_state', { provider_code: 'openai', key: 'dup-p0' }),
    ).toBe('1')
    expect(gaugeValue(text, 'ihui_relay_key_pool_label_collisions_total')).toBe('1')
  })

  it('R7 可负/钳零/null:token 已过期可为负;年龄不为负;从未检查不发序列', async () => {
    h.state.queue = [
      [
        keyRow({ name: 'fresh', healthCheckedAt: new Date(NOW + 60_000) }), // 时钟漂移 ⇒ 钳 0
        keyRow({ name: 'never', healthCheckedAt: null }), // 从未检查 ⇒ 无年龄序列
      ],
      [
        accountRow({
          uid: 'u-exp',
          tokenExpiresAt: new Date(NOW - 5_000_000),
          lastRefreshAt: null,
        }),
      ],
    ]
    await refreshRelayPoolGaugesSafely(NOW)
    const text = await render()
    expect(
      valueOf(text, 'ihui_relay_key_pool_health_age_seconds', {
        provider_code: 'openai',
        key: 'fresh-p0',
      }),
    ).toBe('0')
    expect(
      valueOf(text, 'ihui_relay_key_pool_health_age_seconds', {
        provider_code: 'openai',
        key: 'never-p0',
      }),
    ).toBeUndefined() // null ⇒ 不发序列,没有"编一个 0"的选项
    expect(
      valueOf(text, 'ihui_relay_account_pool_token_expires_in_seconds', {
        provider_code: 'trae',
        account: 'u-exp',
      }),
    ).toBe('-5000') // 已过期:负值是信号,不许 clamp
    expect(
      valueOf(text, 'ihui_relay_account_pool_refresh_age_seconds', {
        provider_code: 'trae',
        account: 'u-exp',
      }),
    ).toBeUndefined()
  })

  it('R8 查询失败:不碰 gauge(旧值保留 + 新鲜度戳不推进),reason 如实返回', async () => {
    h.state.queue = [[keyRow({ name: 'k1' })], [accountRow()]]
    await refreshRelayPoolGaugesSafely(NOW)
    const before = await render()

    h.state.reject = true
    const failed = await refreshRelayPoolGaugesSafely(NOW + 600_000)
    expect(failed.reason).toContain('模拟数据库不可用')
    expect(failed.keys).toBe(0)

    const after = await render()
    // 旧值原样保留(读起来是"上一次成功的快照",不是空池)
    expect(
      valueOf(after, 'ihui_relay_key_pool_health_state', { provider_code: 'openai', key: 'k1-p0' }),
    ).toBe('1')
    // 新鲜度戳停在上一轮 ⇒ "陈"由戳自己说,不把失败读成"池子空了"
    expect(gaugeValue(after, 'ihui_relay_key_pool_refresh_last_success_timestamp_seconds')).toBe(
      gaugeValue(before, 'ihui_relay_key_pool_refresh_last_success_timestamp_seconds'),
    )
  })

  it('R9 渲染完整性:每个族都有 HELP/TYPE 且数值行格式合法(一次 scrape 级)', async () => {
    h.state.queue = [[keyRow()], [accountRow()]]
    await refreshRelayPoolGaugesSafely(NOW)
    const text = await render()
    const families = [
      'ihui_relay_key_pool_health_state',
      'ihui_relay_key_pool_schedulable',
      'ihui_relay_key_pool_health_age_seconds',
      'ihui_relay_key_pool_keys',
      'ihui_relay_key_pool_schedulable_keys',
      'ihui_relay_account_pool_health_state',
      'ihui_relay_account_pool_schedulable',
      'ihui_relay_account_pool_consecutive_failures',
      'ihui_relay_account_pool_total_calls',
      'ihui_relay_account_pool_token_expires_in_seconds',
      'ihui_relay_account_pool_refresh_age_seconds',
    ]
    for (const name of families) {
      expect(text, `${name} 缺 HELP`).toContain(`# HELP ${name} `)
      expect(text, `${name} 缺 TYPE`).toContain(`# TYPE ${name} gauge`)
    }
    for (const name of [
      'ihui_relay_key_pool_rows_skipped_total',
      'ihui_relay_key_pool_label_collisions_total',
      'ihui_relay_account_pool_rows_skipped_total',
      'ihui_relay_account_pool_label_collisions_total',
    ]) {
      expect(text, `${name} 缺 TYPE`).toContain(`# TYPE ${name} counter`)
    }
    // 数值行必须形如 name{...} 数字 或 name 数字(坏一个样本丢的是整个抓取目标)。
    // 注意是整端点级检查:文本里还有 business_funnel_total 等其他族,所以用
    // Prometheus 通用指标名正则,不把前缀钉死成 ihui_(relay 族自己的格式由
    // R10 的逐行正则单独钉)。
    for (const line of text.split('\n')) {
      if (line.startsWith('#') || line.length === 0) continue
      expect(line, `非法指标行:${line}`).toMatch(
        /^[a-zA-Z_:][a-zA-Z0-9_:]*(\{[^}\n]*\})? -?\d+(\.\d+)?([eE][+-]?\d+)?$/,
      )
    }
  })

  it('R10 标签注入进不了文本:恶意 name/uid 被洗成安全字符', async () => {
    h.state.queue = [[keyRow({ name: 'evil",series="x' })], [accountRow({ uid: 'a}b{c' })]]
    await refreshRelayPoolGaugesSafely(NOW)
    const text = await render()
    // 未洗的引号/花括号会把整次 scrape 打回 ⇒ 这里必须一个不剩
    expect(text).not.toContain('",series="')
    expect(text).not.toContain('a}b{c')
    const line = sampleLines(text, 'ihui_relay_key_pool_health_state')[0]!
    expect(line).toMatch(
      /^ihui_relay_key_pool_health_state\{provider_code="openai",key="[A-Za-z0-9_.:@+\-]*"\} \d+$/,
    )
  })

  it('R11 直接驱动 setter 的折叠零基线:provider 出现过 ⇒ 四态各一条', async () => {
    BM.setRelayPoolGaugeSample({
      keys: [
        {
          providerCode: 'groq',
          key: 'groq-default-p0',
          healthState: 'down',
          schedulable: false,
          healthAgeSeconds: 30,
        },
      ],
      accounts: [],
      refreshedAtMs: NOW,
    })
    const text = await render()
    for (const state of RELAY_POOL_HEALTH_STATES) {
      expect(
        valueOf(text, 'ihui_relay_key_pool_keys', { provider_code: 'groq', state }),
        `state=${state} 应开零基线`,
      ).toBeDefined()
    }
    expect(
      valueOf(text, 'ihui_relay_key_pool_keys', { provider_code: 'groq', state: 'down' }),
    ).toBe('1')
    expect(
      valueOf(text, 'ihui_relay_key_pool_keys', { provider_code: 'groq', state: 'healthy' }),
    ).toBe('0')
    expect(valueOf(text, 'ihui_relay_key_pool_schedulable_keys', { provider_code: 'groq' })).toBe(
      '0',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
