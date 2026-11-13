// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-513 回归锁（2026-11-13）。
 *
 * 病灶：
 * ① relay-health-check 无全局互斥 —— 多实例/重叠 tick 会并发巡检同一批 key；
 * ② persistResult 按快照整块回写 extra_metadata —— 覆盖巡检期间管理员改的 baseUrl 等字段。
 *
 * 本文件锁四件事：
 * ① 抢锁失败 ⇒ 跳过本次检查（不读库）；
 * ② 抢到锁 ⇒ 执行检查并在结束释放；
 * ③ 回写是 jsonb 合并补丁（只含 consecutiveFailures，不整列覆盖）；
 * ④ 正常巡检结果（healthy/down/degraded/熔断）语义不变。
 *
 * 测试模式：mock db / @ihui/database / crypto 与 global.fetch（对齐 relay-health-recovery.test.ts），
 * Redis 以最小假对象注入（只用到 set / eval）。测试文件豁免 any（AGENTS.md §3）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Redis } from 'ioredis'

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
    weight: 'weight',
    isEnabled: 'is_enabled',
    healthStatus: 'health_status',
    healthCheckedAt: 'health_checked_at',
    lastErrorMessage: 'last_error_message',
    extraMetadata: 'extra_metadata',
    updatedAt: 'updated_at',
  },
}))

vi.mock('../src/utils/crypto.js', () => ({
  encryptJSON: vi.fn(),
  decryptJSON: mockDecryptJSON.mockImplementation((v: unknown) => v),
}))

global.fetch = mockFetch as unknown as typeof fetch

import { checkAllKeys } from '../src/services/relay-health-check-service.js'
import {
  runHealthCheckTick,
  HEALTH_CHECK_LOCK_NAME,
} from '../src/workers/relay-health-check-worker.js'

const BASE_URL = 'https://api.example.com'

interface RowSpec {
  id: string
  plainKey: string
  upstreamStatus: number
}

function makeRow(spec: RowSpec, failures = 0) {
  return {
    id: spec.id,
    providerCode: 'swiftapi',
    apiKeyEnc: JSON.stringify(spec.plainKey),
    // key 级 baseUrl 覆盖：跳过 ai_model_config 查询，使 select 调用序可预测
    extraMetadata: { consecutiveFailures: failures, baseUrl: BASE_URL },
    isEnabled: true,
  }
}

/** dbRead.select 链式 builder：按调用顺序吐出 rowsSets。 */
function stubSelectReads(rowsSets: unknown[][]) {
  let call = 0
  mockDbReadSelect.mockImplementation(() => {
    const rows = rowsSets[Math.min(call++, rowsSets.length - 1)]
    const builder: Record<string, unknown> = {}
    builder.from = vi.fn(() => builder)
    builder.where = vi.fn(() => builder)
    builder.orderBy = vi.fn(() => builder)
    builder.limit = vi.fn(() => Promise.resolve(rows))
    builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve)
    return builder
  })
}

function stubUpdateCapture() {
  const updates: Array<Record<string, unknown>> = []
  mockDbUpdate.mockImplementation(() => ({
    set: (s: Record<string, unknown>) => {
      updates.push(s)
      return { where: vi.fn(() => Promise.resolve()) }
    },
  }))
  return updates
}

/** fetch 按 Bearer key 内容返回指定状态码。 */
function stubUpstreamBy(specs: RowSpec[]) {
  mockFetch.mockImplementation(async (_url: unknown, init: { headers: Record<string, string> }) => {
    const auth = String(init.headers['Authorization'] ?? '')
    const hit = specs.find((s) => auth.includes(s.plainKey))
    return { status: hit?.upstreamStatus ?? 500 }
  })
}

/** 最小 Redis 假对象：DistributedLock 只用 set(NX/PX) 与 eval(释放 Lua)。 */
function makeFakeRedis(behavior: 'acquired' | 'busy' | 'error') {
  const setCalls: unknown[][] = []
  const evalCalls: unknown[][] = []
  const redis = {
    set: vi.fn(async (...args: unknown[]) => {
      setCalls.push(args)
      if (behavior === 'busy') return null
      if (behavior === 'error') throw new Error('redis down')
      return 'OK'
    }),
    eval: vi.fn(async (...args: unknown[]) => {
      evalCalls.push(args)
      return 1
    }),
  }
  return { redis: redis as unknown as Redis, setCalls, evalCalls }
}

interface FakeLog {
  info: ReturnType<typeof vi.fn>
  warn: ReturnType<typeof vi.fn>
}
function makeLog(): FakeLog {
  return { info: vi.fn(), warn: vi.fn() }
}

/** 把 drizzle SQL 的 queryChunks 摊平成可读文本，用于断言合并语义。 */
function sqlText(value: unknown): string {
  const chunks = (value as { queryChunks?: unknown[] })?.queryChunks
  if (!Array.isArray(chunks)) return ''
  return chunks
    .map((c) => {
      if (typeof c === 'string') return c
      const obj = c as { value?: unknown; name?: unknown }
      if (obj?.value !== undefined) return String(obj.value)
      if (obj?.name !== undefined) return String(obj.name)
      return ''
    })
    .join('')
}

describe('F-513 relay-health-check 全局互斥', () => {
  beforeEach(() => {
    mockDecryptJSON.mockClear()
    mockDbReadSelect.mockReset()
    mockDbUpdate.mockReset()
    mockFetch.mockReset()
  })

  it('抢锁失败 → 跳过本次检查（不读库、不写库）', async () => {
    const { redis } = makeFakeRedis('busy')
    const log = makeLog()

    const result = await runHealthCheckTick(redis, log as never)

    expect(result).toBeNull()
    expect(mockDbReadSelect).not.toHaveBeenCalled()
    expect(mockDbUpdate).not.toHaveBeenCalled()
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('跳过本 tick'))
  })

  it('抢到锁 → 执行检查并在结束释放（token 比对）', async () => {
    stubSelectReads([[], []])
    stubUpdateCapture()
    const { redis, setCalls, evalCalls } = makeFakeRedis('acquired')
    const log = makeLog()

    const result = await runHealthCheckTick(redis, log as never)

    expect(result).not.toBeNull()
    expect(result?.total).toBe(0)
    // SET key token PX ttl NX
    expect(setCalls).toHaveLength(1)
    expect(setCalls[0][0]).toBe(HEALTH_CHECK_LOCK_NAME)
    expect(setCalls[0].slice(2)).toEqual(['PX', 120_000, 'NX'])
    // 释放必须用同一 token 比对，防误删他人锁
    expect(evalCalls).toHaveLength(1)
    expect(evalCalls[0][2]).toBe(HEALTH_CHECK_LOCK_NAME)
    expect(evalCalls[0][3]).toBe(setCalls[0][1])
    expect(log.info).toHaveBeenCalledWith(expect.anything(), 'relay-health-check done')
  })

  it('Redis 抢锁命令异常 → 降级进程内互斥并 warn，仍执行检查', async () => {
    stubSelectReads([[], []])
    stubUpdateCapture()
    const { redis } = makeFakeRedis('error')
    const log = makeLog()

    const result = await runHealthCheckTick(redis, log as never)

    expect(result).not.toBeNull()
    expect(log.warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('降级'))
    expect(mockDbReadSelect).toHaveBeenCalled()
  })

  it('回写为 jsonb 合并补丁：只带 consecutiveFailures，不整列覆盖他字段', async () => {
    const healthy: RowSpec = { id: 'key-h', plainKey: 'h-key', upstreamStatus: 200 }
    stubSelectReads([[makeRow(healthy, 1)], []])
    stubUpstreamBy([healthy])
    const updates = stubUpdateCapture()

    await checkAllKeys()

    const patch = updates[0]?.['extraMetadata']
    // 不是普通对象快照，而是 SQL 表达式
    expect(patch).not.toEqual(expect.objectContaining({ consecutiveFailures: 0 }))
    const text = sqlText(patch)
    expect(text).toContain('||')
    expect(text).toContain('jsonb')
    expect(text).toContain('consecutiveFailures')
    // 补丁里不得出现快照中的其它字段（否则就是整列覆盖）
    expect(text).not.toContain('baseUrl')
    expect(text).not.toContain('"1"')
  })

  it('正常巡检结果不变：down 累计触发熔断、healthy 重置计数', async () => {
    const down: RowSpec = { id: 'key-down', plainKey: 'down-key', upstreamStatus: 401 }
    const healthy: RowSpec = { id: 'key-ok', plainKey: 'ok-key', upstreamStatus: 200 }
    const degraded: RowSpec = { id: 'key-deg', plainKey: 'deg-key', upstreamStatus: 429 }
    stubSelectReads([[makeRow(down, 2), makeRow(healthy, 2), makeRow(degraded, 1)], []])
    stubUpstreamBy([down, healthy, degraded])
    const updates = stubUpdateCapture()

    const summary = await checkAllKeys()

    expect(summary.total).toBe(3)
    expect(summary.down).toBe(1)
    expect(summary.healthy).toBe(1)
    expect(summary.degraded).toBe(1)
    expect(summary.disabled).toBe(1)

    const downUpdate = updates[0]
    expect(downUpdate?.['healthStatus']).toBe('down')
    expect(downUpdate?.['isEnabled']).toBe(false)
    expect(sqlText(downUpdate?.['extraMetadata'])).toContain('"consecutiveFailures":3')

    const healthyUpdate = updates[1]
    expect(healthyUpdate?.['healthStatus']).toBe('healthy')
    expect(healthyUpdate?.['isEnabled']).toBeUndefined()
    expect(sqlText(healthyUpdate?.['extraMetadata'])).toContain('"consecutiveFailures":0')

    // degraded 不改计数（1 → 1）
    const degradedUpdate = updates[2]
    expect(degradedUpdate?.['healthStatus']).toBe('degraded')
    expect(sqlText(degradedUpdate?.['extraMetadata'])).toContain('"consecutiveFailures":1')
  })
})
