// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `api_logs.error` 的 5xx 可追责性(2026-10-28 立)。
 *
 * 一手缺口:生产表里 18 次 `GET /api/memory -> 500` 的 `error` 列**逐字就是这一行**,
 * 异常类型 / SQLSTATE / 堆栈一个字节都没进表(只在 pino stdout)。
 * 根因是结构性的:onResponse 这一刻手里只有状态码,拿不到错误对象 ⇒ 不是"记了被截断",
 * 而是**中间件本来就没记**。
 *
 * 本文件钉住修法的四条边界(缺一条都会退化成另一种无法追责或另一种新敞口):
 *  ① 5xx 必须带上"类名 + SQLSTATE + message 首行";
 *  ② 旧的 `"<METHOD> <path> -> <code>"` 前缀一字不动(下游按它计数);
 *  ③ **4xx 不追加摘要** —— 框架的入参/体校验错误 message 会带请求体片段(PII),
 *     这一格的状态码本来就够定位;
 *  ④ 摘要必须折成单行、钳长,且经日志面唯一脱敏出口(token / JWT 原文不得进表)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockAdd } = vi.hoisted(() => ({
  mockAdd: vi.fn(async (_logs: unknown[]) => undefined),
}))

vi.mock('../src/db/system-queries.js', () => ({ addApiLogsBatch: mockAdd }))

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

/** 只用于证明脱敏真的跑过:一把形态合法的 sk- 与一枚形态合法的 JWT。 */
const PLANTED_SK = 'sk-ABCDEFGHIJKLMNOPQRSTUVWXyz01234567890'
const PLANTED_JWT = 'eyJhbGciOiJIUzI1NiA.eyJzdWIiOiJhZGV2LXNlY3JldC0xMjM0NTY3ODkwIn0.abcdefg'

interface Row {
  method: string
  path: string
  statusCode: number
  error?: string
}

function rowsByPath(): Map<string, Row> {
  const rows: Row[] = []
  for (const call of mockAdd.mock.calls) rows.push(...(call[0] as Row[]))
  return new Map(rows.map((r) => [r.path, r]))
}

describe('api_logs.error:5xx 摘要与四条边界', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    mockAdd.mockClear()
    app = Fastify({ logger: false })
    await app.register(apiLoggerPlugin)
    // ① 真异常形态照搬本次生产那一型:DrizzleQueryError ← Postgres 22P02,多行 message
    app.get('/api/boom', async () => {
      const err = Object.assign(
        new Error(
          `Failed query: select "id" from "users" where "users"."id" = $1\ninvalid input syntax for type uuid: "system-worker"; bearer ${PLANTED_SK} ${PLANTED_JWT}`,
        ),
        { name: 'DrizzleQueryError', code: '22P02' },
      )
      throw err
    })
    // ③ 4xx 框架校验错(带请求体片段的典型),必须只落状态码行
    app.get('/api/poor', async (_request, reply) => reply.status(400).send({ code: 400 }))
    // ③ 带 statusCode 的被抛错误(4xx 级),同样不得追加摘要
    app.get('/api/not-found', async () => {
      throw Object.assign(new Error('record not found: secret-fragment-XYZ'), {
        name: 'NotFoundError',
        statusCode: 404,
      })
    })
    // ② 正常请求:格式与"没异常"两维都不能被这次改动污染
    app.get('/api/ok', async (_request, reply) => reply.status(200).send({ code: 0 }))
  })

  async function drive(): Promise<Map<string, Row>> {
    for (const url of ['/api/boom', '/api/poor', '/api/not-found', '/api/ok']) {
      await app.inject({ method: 'GET', url })
    }
    // 批次只在 onClose 时被强制 flush(批量写是既有设计,不在这里改)
    await app.close()
    return rowsByPath()
  }

  it('① 5xx 落库带异常类名 + SQLSTATE + message 首行', async () => {
    const row = (await drive()).get('/api/boom')
    expect(row).toBeDefined()
    expect(row?.error).toContain('DrizzleQueryError')
    expect(row?.error).toContain('[22P02]')
    expect(row?.error).toContain('Failed query')
  })

  it('② 旧的状态码行前缀一字未动', async () => {
    const rows = await drive()
    expect(rows.get('/api/boom')?.error?.startsWith('GET /api/boom -> 500')).toBe(true)
    expect(rows.get('/api/poor')?.error).toBe('GET /api/poor -> 400')
  })

  it('③ 4xx 一律不追加摘要(即便抛的是带 statusCode 的 Error)', async () => {
    const rows = await drive()
    expect(rows.get('/api/not-found')?.error).toBe('GET /api/not-found -> 404')
    expect(rows.get('/api/poor')?.error).toBe('GET /api/poor -> 400')
    // 2xx 不带 error
    expect(rows.get('/api/ok')?.error ?? undefined).toBeUndefined()
  })

  it('④ 摘要单行、钳长,且凭据原文不得进表', async () => {
    const row = (await drive()).get('/api/boom')
    const summary = row?.error ?? ''
    expect(summary).not.toContain('\n')
    // message 的第二行(含 uuid 报错原文那一段)不得被搬进表
    expect(summary).not.toContain('invalid input syntax')
    expect(summary.length).toBeLessThan(420)
    expect(summary).not.toContain(PLANTED_SK)
    expect(summary).not.toContain(PLANTED_JWT)
  })

  it('反向对照:异常里没有凭据形态时,摘要照常落且不含脱敏标记的假阳性', async () => {
    const plain = Fastify({ logger: false })
    await plain.register(apiLoggerPlugin)
    plain.get('/api/plain', async () => {
      throw Object.assign(new Error('boom without secrets'), { name: 'TypeError' })
    })
    await plain.inject({ method: 'GET', url: '/api/plain' })
    await plain.close()
    const row = rowsByPath().get('/api/plain')
    expect(row?.error).toBe('GET /api/plain -> 500 | TypeError: boom without secrets')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
