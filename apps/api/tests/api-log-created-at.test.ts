// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `api_logs.created_at` 必须是**每行自己的请求完成时刻**(2026-10-28 立)。
 *
 * 一手缺口(本机开发库现读,非生产端口):
 *  - `SELECT now(), pg_sleep(0.05), now()` 单语句首尾逐字相同(而 clock_timestamp() 不同);
 *  - 一条 `INSERT ... VALUES (DEFAULT),(DEFAULT),(DEFAULT)` 三行 `distinct(ts)=1`;
 *  - 表里同刻成簇真实存在:`created_at=10:21:49.186Z n=2 durations=[5,20]`、
 *    `08:14:33.135Z n=2 durations=[8,184]` —— 6 次真请求被整批拉平成同一毫秒。
 * 后果:`api_logs` 是 5xx 自动发现器唯一的信号源,它的「24h 同签名 N 次」「最近样本时刻」
 * 全按 created_at 开窗 ⇒ 事件时间不可信。
 *
 * 正解约束:**零 schema 变更**(不动默认值、不加列、不迁移)。时刻由写入侧逐行携带,
 * 缺省时仍退回列默认 now()(不伪造)。历史行不回溯改写(改历史 = 造事件时间)。
 *
 * 本文件钉住四条:
 *  ① 同批两行、请求时刻不同 ⇒ 落库两行时刻**不等值**(并逐行等于各自请求完成时刻);
 *  ② flush 延迟(定时 flush 远晚于请求)不改变行内时刻;
 *  ③ 既有 api-logger 行为零回归(5xx `error` 前缀+摘要、4xx 只状态码行、2xx 无 error、字段形态);
 *  ④ SQL 层:带时刻 ⇒ 每行各绑一个 created_at 参数;缺省 ⇒ 该行走 `default`(不是拿 flush 时刻补的假数据)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { drizzle } from 'drizzle-orm/postgres-js'
import { apiLogs } from '@ihui/database'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

/** 捕获真正交给 drizzle 的 values 数组(不连库:整个 db 层是桩,生产端口 8810 不在射程)。 */
const { state } = vi.hoisted(() => ({
  state: { batches: [] as Array<Array<Record<string, unknown>>> },
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    insert: () => ({
      values: (rows: Array<Record<string, unknown>>) => {
        state.batches.push(rows)
        return Promise.resolve([])
      },
    }),
  },
}))

vi.mock('../src/config/index.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const base = (actual as { config?: Record<string, unknown> }).config ?? {}
  return {
    ...actual,
    config: {
      ...base,
      API_LOG_ENABLED: true,
      API_LOG_SAMPLE_RATE: 1,
      API_LOG_BATCH_SIZE: 1000,
      API_LOG_FLUSH_INTERVAL_MS: 600_000,
    },
  }
})

const { default: apiLoggerPlugin } = await import('../src/plugins/api-logger.js')
const { addApiLogsBatch } = await import('../src/db/system-queries.js')
const { config } = await import('../src/config/index.js')

type InsertRow = Parameters<typeof addApiLogsBatch>[0][number]

/** 只为把 values 数组渲染成真正的 INSERT 语句(toSQL,不执行、不连库) ⇒ 判据落在 SQL 形态上。 */
const probeDb = drizzle({} as unknown as Parameters<typeof drizzle>[0])

function renderInsert(rows: readonly Record<string, unknown>[]): {
  sql: string
  params: unknown[]
} {
  const q = probeDb
    .insert(apiLogs)
    .values(rows as unknown as InsertRow[])
    .toSQL()
  return { sql: q.sql, params: q.params as unknown[] }
}

const defaultTokens = (sql: string): number => sql.split('default').length - 1

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function buildApp(flushIntervalMs = 600_000): Promise<FastifyInstance> {
  const cfg = config as unknown as { API_LOG_FLUSH_INTERVAL_MS: number }
  cfg.API_LOG_FLUSH_INTERVAL_MS = flushIntervalMs
  const app = Fastify({ logger: false })
  await app.register(apiLoggerPlugin)
  app.get('/api/alpha', async (_request, reply) => reply.status(200).send({ code: 0 }))
  app.get('/api/beta', async (_request, reply) => reply.status(200).send({ code: 0 }))
  app.get('/api/poor', async (_request, reply) => reply.status(400).send({ code: 400 }))
  app.get('/api/boom', async () => {
    throw Object.assign(new Error('kaboom on purpose'), { name: 'RangeError', code: '22P02' })
  })
  await app.ready()
  return app
}

function rowsOf(path: string): Array<Record<string, unknown>> {
  const all: Array<Record<string, unknown>> = []
  for (const batch of state.batches) all.push(...batch)
  return all.filter((r) => r.path === path)
}

function onlyRow(path: string): Record<string, unknown> {
  const rows = rowsOf(path)
  expect(rows).toHaveLength(1)
  return rows[0] as Record<string, unknown>
}

describe('api_logs.created_at:每行携带自己的请求完成时刻', () => {
  beforeEach(() => {
    state.batches.length = 0
  })

  it('① 同批两行、请求时刻不同 ⇒ 落库两行时刻不等值', async () => {
    const app = await buildApp()
    const t0 = Date.now()
    await app.inject({ method: 'GET', url: '/api/alpha' })
    const t1 = Date.now()
    await sleep(120)
    const t2 = Date.now()
    await app.inject({ method: 'GET', url: '/api/beta' })
    const t3 = Date.now()
    await app.close() // 整批在同一次 flush 里落库

    expect(state.batches).toHaveLength(1)
    expect(state.batches[0]).toHaveLength(2)

    const a = onlyRow('/api/alpha').createdAt as Date
    const b = onlyRow('/api/beta').createdAt as Date
    expect(a).toBeInstanceOf(Date)
    expect(b).toBeInstanceOf(Date)
    // 这一行就是本次缺陷的靶心:同批两行绝不能再同刻
    expect(a.getTime()).not.toBe(b.getTime())
    // 且各自等于自己的请求完成时刻,而不是 flush 时刻
    expect(a.getTime()).toBeGreaterThanOrEqual(t0 - 5)
    expect(a.getTime()).toBeLessThanOrEqual(t1 + 5)
    expect(b.getTime()).toBeGreaterThanOrEqual(t2 - 5)
    expect(b.getTime()).toBeLessThanOrEqual(t3 + 5)
  })

  it('② flush 延迟不改变行内时刻(定时 flush 远晚于请求)', async () => {
    const app = await buildApp(30)
    const t0 = Date.now()
    await app.inject({ method: 'GET', url: '/api/alpha' })
    const t1 = Date.now()
    await sleep(400) // 期间定时器已把这一批冲走

    const flushedAt = Date.now()
    const row = onlyRow('/api/alpha')
    const createdAt = row.createdAt as Date
    expect(createdAt.getTime()).toBeGreaterThanOrEqual(t0 - 5)
    expect(createdAt.getTime()).toBeLessThanOrEqual(t1 + 5)
    // 行内时刻与"落库被观察到的那一刻"之间确实隔着这段延迟
    expect(flushedAt - createdAt.getTime()).toBeGreaterThanOrEqual(300)
    // 定时 flush 已发生(不必等 onClose)
    expect(state.batches.length).toBeGreaterThanOrEqual(1)
    await app.close()
  })

  it('③ 既有 api-logger 行为零回归(5xx 摘要/4xx 状态码行/2xx 无 error/字段形态)', async () => {
    const app = await buildApp()
    await app.inject({ method: 'GET', url: '/api/boom' })
    await app.inject({ method: 'GET', url: '/api/poor' })
    await app.inject({ method: 'GET', url: '/api/alpha' })
    await app.close()

    const boom = onlyRow('/api/boom')
    expect(String(boom.error).startsWith('GET /api/boom -> 500')).toBe(true)
    expect(String(boom.error)).toContain('RangeError [22P02]: kaboom on purpose')
    expect(String(onlyRow('/api/poor').error)).toBe('GET /api/poor -> 400')

    const ok = onlyRow('/api/alpha')
    expect(ok.error ?? undefined).toBeUndefined()
    expect(ok.method).toBe('GET')
    expect(typeof ok.duration).toBe('number')
    expect(typeof ok.ip).toBe('string')
    expect(ok.statusCode).toBe(200)
    expect(ok.createdAt).toBeInstanceOf(Date)
  })

  it('④ SQL 层:带时刻 ⇒ 每行各绑一个 created_at 参数;缺省 ⇒ 该行走列默认(不伪造)', async () => {
    const t = new Date('2026-01-01T00:00:00.100Z')
    const later = new Date('2026-01-01T00:00:03.900Z')
    const withTimes = [
      { method: 'GET', path: '/a', statusCode: 500, duration: 3, createdAt: t },
      { method: 'GET', path: '/b', statusCode: 500, duration: 68, createdAt: later },
    ]
    const { sql, params } = renderInsert(withTimes)
    const text = params.map((p) => String(p))
    expect(text.filter((v) => v === t.toISOString())).toHaveLength(1)
    expect(text.filter((v) => v === later.toISOString())).toHaveLength(1)

    // 摘掉时刻 ⇒ created_at 必须回落成 default,而不是被补一个 flush 时刻
    const withoutTimes = withTimes.map(({ createdAt: _dropped, ...rest }) => rest)
    const bare = renderInsert(withoutTimes)
    expect(bare.params.map((p) => String(p))).not.toContain(t.toISOString())
    expect(defaultTokens(bare.sql) - defaultTokens(sql)).toBe(withTimes.length)

    // 空批不落库(既有行为)
    const before = state.batches.length
    await addApiLogsBatch([])
    expect(state.batches).toHaveLength(before)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
