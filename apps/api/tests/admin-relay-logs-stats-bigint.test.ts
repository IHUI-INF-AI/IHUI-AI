// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GET /admin/relay/logs/stats 聚合统计的大数回归(2026-11-18,F-667)。
 *
 * 证的是一件事:token 三列去掉末端 ::int 后(消除窗口内合计 > 2^31 时的 22003
 * int4 溢出 → 整接口 500),postgres.js 会把 ::bigint 聚合以**字符串**返回。
 * 若路由层忘了 Number() 收口,响应里的 totalTokens/promptTokens/completionTokens
 * 会变成字符串,前端汇总/比较随之出错。本用例喂 > 2^31 的字符串,逐列钉住
 * 响应必须仍是 number。金额列 totalCostCents 同理已收口,一并断言。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.DATABASE_APP_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'unit-test-credentials-encryption-key-0123456789ab'
  process.env.NODE_ENV = 'test'
  return { statsRows: [] as unknown[] }
})

// stats 查询链:.from().where().groupBy().orderBy().limit() → Promise<statsRows>
vi.mock('../src/db/index.js', () => {
  const chain = () => {
    const self: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'groupBy', 'orderBy']) self[m] = () => self
    self.limit = () => Promise.resolve(h.statsRows)
    return self
  }
  const root = { select: () => chain() }
  return { db: root, dbRead: root, dbClient: {} }
})

vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: async () => {} }))

import relayLogsRoutes from '../src/routes/admin/relay-logs.js'

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(relayLogsRoutes)
  await app.ready()
  return app
}

beforeEach(() => {
  h.statsRows = []
})

describe('GET /admin/relay/logs/stats — F-667 bigint token 收口', () => {
  it('合计超 int4 时 token 三列以字符串返回,响应仍收口成 number', async () => {
    // ::bigint 由 postgres.js 以字符串返回;值均 > 2^31,旧实现 ::int 会直接 22003 → 500。
    h.statsRows = [
      {
        groupKey: 'gpt-4o',
        callCount: 2,
        totalTokens: '3000000000',
        promptTokens: '2500000000',
        completionTokens: '500000000',
        successCount: 2,
        errorCount: 0,
        avgLatencyMs: 120,
        totalCostCents: '9007199254740',
      },
    ]
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/relay/logs/stats?groupBy=model' })
    await app.close()

    expect(res.statusCode).toBe(200)
    const row = res.json().data.rows[0]
    expect(row.totalTokens).toBe(3_000_000_000)
    expect(row.promptTokens).toBe(2_500_000_000)
    expect(row.completionTokens).toBe(500_000_000)
    expect(row.totalCostCents).toBe(9_007_199_254_740)
    for (const key of ['totalTokens', 'promptTokens', 'completionTokens', 'totalCostCents']) {
      expect(typeof row[key], `${key} 必须是 number 而非字符串`).toBe('number')
    }
  })

  it('无聚合行(空结果)仍返回 200 且 rows 为空数组', async () => {
    h.statsRows = []
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/relay/logs/stats' })
    await app.close()
    expect(res.statusCode).toBe(200)
    expect(res.json().data.rows).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
