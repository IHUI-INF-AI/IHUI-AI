// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-628 回归锁(2026-11-11):中转成本汇总归零。
 *
 * 病灶:写侧 `relay-billing-service.recordCallInternal()` 自 2026-08-01 起把成本写进
 *       顶层列 `llm_call_logs.cost_cents`(分),metadata 里**没有** costCents 键;
 *       6 个读取点却仍 `metadata->>'costCents'` → COALESCE(NULL,0) → 汇总恒 0。
 * 判据:① 成本归一/聚合统一走 services/relay-cost;
 *       ② SQL 必须是 `sum(cost_cents)` 下推 + `::bigint`(防 int32 溢出);
 *       ③ 真实写入形状(metadata 无成本、列有值)的行,聚合结果 > 0。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import Fastify from 'fastify'
import type { SQL } from 'drizzle-orm'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
  return {
    rows: [] as Array<Record<string, unknown>>,
    cols: null as Record<string, unknown> | null,
  }
})

vi.mock('../src/db/index.js', () => {
  const chain: Record<string, unknown> = {
    from: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve(h.rows),
  }
  const root = {
    select: (cols: Record<string, unknown>) => {
      h.cols = cols
      return chain
    },
  }
  return { db: root, dbRead: root, dbClient: {} }
})

// 管理员闸门与本票机制无关,放行为 no-op(不加载 auth/rbac 链)
vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: async () => {} }))

import relayLogsRoutes from '../src/routes/admin/relay-logs.js'
import {
  extractCostCents,
  sumRelayCostCentsSql,
  relayCostCentsColumnSql,
} from '../src/services/relay-cost.js'

/** drizzle SQL 片段 → 可读 SQL 文本(本票表达式无参数,字符串 chunk 即全文) */
function sqlText(fragment: SQL): string {
  const chunks = (fragment as unknown as { queryChunks?: unknown[] }).queryChunks ?? []
  return chunks
    .map((c) => {
      if (typeof c === 'string') return c
      // drizzle 把模板里的静态字符串包成 StringChunk { value: string[] }
      const value = (c as { value?: unknown }).value
      return Array.isArray(value) ? value.filter((v) => typeof v === 'string').join('') : ''
    })
    .join('')
}

describe('extractCostCents:历史形状归一化成整数分', () => {
  const cases: Array<[string, unknown, number]> = [
    ['costCents 已是分', { costCents: 12 }, 12],
    ['cost_cents 字符串', { cost_cents: '12' }, 12],
    ['cost 按元折分', { cost: 1.5 }, 150],
    ['costYuan 字符串', { costYuan: '0.42' }, 42],
    ['分优先于元', { costCents: 12, cost: 9 }, 12],
    ['缺失键 → 0', { multiplier: 2 }, 0],
    ['null → 0', null, 0],
    ['非对象 → 0', 'metadata', 0],
    ['负数 → 0', { costCents: -5 }, 0],
    ['NaN → 0', { costCents: Number.NaN }, 0],
    ['Infinity → 0', { costCents: Number.POSITIVE_INFINITY }, 0],
    ['非数字字符串 → 0', { costCents: 'abc' }, 0],
    ['空串 → 0', { cost_cents: '' }, 0],
    ['小数分四舍五入', { costCents: 12.4 }, 12],
  ]

  for (const [name, input, expected] of cases) {
    it(name, () => {
      expect(extractCostCents(input)).toBe(expected)
    })
  }
})

describe('聚合 SQL:成本列下推 + bigint 防溢出', () => {
  it('sum(cost_cents) 且不含 metadata', () => {
    const text = sqlText(sumRelayCostCentsSql())
    expect(text).toContain('sum(cost_cents)')
    expect(text).toContain('::bigint')
    expect(text).not.toContain('metadata')
  })

  it('单列引用只指向 cost_cents', () => {
    expect(sqlText(relayCostCentsColumnSql()).trim()).toBe('cost_cents')
  })
})

describe('6 个读取点不再裸读 metadata->>\'costCents\'', () => {
  const files = [
    'src/routes/admin/relay-logs.ts',
    'src/routes/developer-relay.ts',
    'src/routes/admin/relay-stats.ts',
    'src/routes/earnings-routes.ts',
    'src/services/relay-ops-snapshot.ts',
    'src/routes/admin-ops-wallboard.ts',
  ] as const

  for (const rel of files) {
    it(rel, () => {
      const text = readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
      expect(text).not.toMatch(/metadata\s*->>\s*'costCents'/)
      expect(text).not.toMatch(/metadata\.costCents/)
      // 成本口径必须走 relay-cost 单一出口(SQL 聚合或列引用二选一)
      expect(text).toMatch(/from '[^']*relay-cost\.js'/)
      expect(text).toMatch(/sumRelayCostCentsSql|relayCostCentsColumnSql/)
    })
  }

  it('relay-cost 模块自身保留 ::bigint 聚合', () => {
    const text = readFileSync(
      new URL('../src/services/relay-cost.ts', import.meta.url),
      'utf8',
    )
    expect(text).toContain('sum(cost_cents)')
    expect(text).toContain('::bigint')
  })
})

describe('DB 替身:真实写入形状的行聚合结果 > 0', () => {
  beforeEach(() => {
    h.cols = null
    // 真实写入形状:成本在顶层列(分),metadata 只有审计键,没有 costCents
    h.rows = [
      {
        groupKey: 'gpt-4o',
        callCount: 1000,
        totalTokens: 2000,
        promptTokens: 1200,
        completionTokens: 800,
        successCount: 1000,
        errorCount: 0,
        avgLatencyMs: 120,
        totalCostCents: '420.000000',
        metadata: { multiplier: 1, pricingSource: 'ai_pricing', billingMode: 'token' },
      },
    ]
  })

  it('GET /admin/relay/logs/stats 成本汇总为 420 分(不是 0)', async () => {
    const app = Fastify()
    await app.register(relayLogsRoutes)
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: '/admin/relay/logs/stats?groupBy=model',
    })
    expect(res.statusCode).toBe(200)

    const body = res.json() as {
      data: { rows: Array<{ totalCostCents: number }> }
    }
    expect(body.data.rows[0]!.totalCostCents).toBe(420)
    expect(typeof body.data.rows[0]!.totalCostCents).toBe('number')

    // 同一行的 metadata 里确实没有成本 → 旧口径必然为 0
    expect(extractCostCents(h.rows[0]!.metadata)).toBe(0)

    // 端点实际下推的聚合表达式指向 cost_cents 列
    const aggregate = sqlText(h.cols!.totalCostCents as SQL)
    expect(aggregate).toContain('sum(cost_cents)')
    expect(aggregate).toContain('::bigint')
    expect(aggregate).not.toContain('metadata')

    await app.close()
  })
})
