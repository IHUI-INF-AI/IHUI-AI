// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-706 回归锁(2026-11-11):API 用量 stats 的 errorRate/avgLatency 精度失控。
 *
 * 病灶:`avg(...)` 在 PG 里返回 numeric,drizzle 原样给出字符串;`sql<number>` 只是类型断言,
 *       不做运行时转换 → 前端模板串直接输出 `1.2345678901234567%`。
 * 修法(选①,后端口径统一):SQL 侧 `::numeric(10,2)` + JS 侧 Number 收口,
 *       所有消费方(web 卡片、未来导出/看板)拿到的都是两位小数 number。
 * 判据:① 两列 SQL 均定档 numeric(10,2);② 响应里是 number 且已两位小数;
 *       ③ null/非数字/空结果 → 0;④ `/top` 既有口径与前端 `.toFixed(2)`(F-664)不受影响。
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import Fastify from 'fastify'
import type { SQL } from 'drizzle-orm'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
  return {
    resultQueue: [] as Array<Array<Record<string, unknown>>>,
    colsQueue: [] as Array<Record<string, unknown>>,
  }
})

vi.mock('../src/db/index.js', () => {
  const chain: {
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
    [m: string]: unknown
  } = {
    then: (resolve) => Promise.resolve(h.resultQueue.shift() ?? []).then(resolve),
  }
  for (const m of ['from', 'where', 'groupBy', 'orderBy', 'limit', 'offset']) {
    chain[m] = () => chain
  }
  const root = {
    select: (cols: Record<string, unknown>) => {
      h.colsQueue.push(cols)
      return chain
    },
  }
  return { db: root, dbRead: root, dbClient: {} }
})

// 管理员闸门与本票机制无关,放行为 no-op(不加载 auth/rbac 链)
vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: async () => {} }))

import { adminMonitoringRoutes } from '../src/routes/admin-monitoring-routes.js'

/** drizzle SQL 片段 → 可读 SQL 文本(静态 chunk 拼接;列引用等对象 chunk 跳过) */
function sqlText(fragment: SQL): string {
  const chunks = (fragment as unknown as { queryChunks?: unknown[] }).queryChunks ?? []
  return chunks
    .map((c) => {
      if (typeof c === 'string') return c
      const value = (c as { value?: unknown }).value
      return Array.isArray(value) ? value.filter((v) => typeof v === 'string').join('') : ''
    })
    .join('')
}

interface UsageStats {
  totalCalls: number
  todayCalls: number
  errorRate: number
  avgLatency: number
}

interface TopRow {
  errorRate: unknown
}

async function injectWith<T>(
  url: string,
  rows: Array<Record<string, unknown>>,
): Promise<{ body: { data: T }; sql: string[] }> {
  h.resultQueue = [rows]
  h.colsQueue = []
  const app = Fastify()
  await app.register(adminMonitoringRoutes)
  await app.ready()
  const res = await app.inject({ method: 'GET', url })
  await app.close()
  expect(res.statusCode).toBe(200)
  const cols = h.colsQueue[0] ?? {}
  return {
    body: res.json() as { data: T },
    sql: Object.values(cols).map((c) => sqlText(c as SQL)),
  }
}

describe('F-706 /api-usage/stats:SQL 侧定档', () => {
  it('errorRate / avgLatency 均 ::numeric(10,2),errorRate 仍是百分数(*100)', async () => {
    const { sql } = await injectWith<UsageStats>('/api-usage/stats', [
      { totalCalls: '0', todayCalls: '0', errorRate: '0.00', avgLatency: '0.00' },
    ])
    const errorRateSql = sql.find((s) => s.includes('* 100')) ?? ''
    const avgLatencySql = sql.find((s) => s.includes('avg(') && !s.includes('* 100')) ?? ''
    expect(errorRateSql).toContain('::numeric(10,2)')
    expect(errorRateSql).toContain('coalesce(')
    expect(avgLatencySql).toContain('::numeric(10,2)')
    expect(avgLatencySql).toContain('coalesce(')
  })
})

describe('F-706 /api-usage/stats:Number 收口', () => {
  it('17 位小数字符串 → 两位小数 number(1.23 / 123.46)', async () => {
    const { body } = await injectWith<UsageStats>('/api-usage/stats', [
      {
        totalCalls: '1000',
        todayCalls: '12',
        errorRate: '1.2345678901234567',
        avgLatency: '123.45678901234567',
      },
    ])
    expect(body.data).toEqual({
      totalCalls: 1000,
      todayCalls: 12,
      errorRate: 1.23,
      avgLatency: 123.46,
    })
    for (const v of Object.values(body.data)) expect(typeof v).toBe('number')
  })

  it('null / 非数字 → 0,不出现 NaN', async () => {
    const { body } = await injectWith<UsageStats>('/api-usage/stats', [
      { totalCalls: null, todayCalls: null, errorRate: null, avgLatency: 'abc' },
    ])
    expect(body.data).toEqual({ totalCalls: 0, todayCalls: 0, errorRate: 0, avgLatency: 0 })
  })

  it('空结果(无聚合行)→ 全 0 兜底', async () => {
    const { body } = await injectWith<UsageStats>('/api-usage/stats', [])
    expect(body.data).toEqual({ totalCalls: 0, todayCalls: 0, errorRate: 0, avgLatency: 0 })
  })
})

describe('F-706 口径边界:不动 /top(F-664 已覆盖)', () => {
  it('/top 的 errorRate 不做 numeric(10,2) 定档,原样返回给前端 .toFixed(2)', async () => {
    const { body, sql } = await injectWith<TopRow[]>('/api-usage/top', [
      {
        id: 'x',
        endpoint: '/api/x',
        method: 'GET',
        calls: '3',
        errorRate: '1.5000000000000000',
      },
    ])
    expect(sql.some((s) => s.includes('::numeric(10,2)'))).toBe(false)
    expect(body.data[0]!.errorRate).toBe('1.5000000000000000')
  })

  it('前端 /top 单元格仍走 .toFixed(2);stats 卡片依赖后端限位', () => {
    const page = readFileSync(
      new URL('../../web/app/(main)/admin/api-usage/page.tsx', import.meta.url),
      'utf8',
    )
    // F-664 的前端兜底保持原样
    expect(page).toMatch(/e\.errorRate\.toFixed\(2\)/)
    // 本票走①:后端已限位,stats 卡片直接插值不再是裸 numeric string
    expect(page).toMatch(/`\$\{stats\.errorRate\}%`/)
    expect(page).toMatch(/`\$\{stats\.avgLatency\}ms`/)
  })

  it('后端源码:两列 sql<string> 定档 + toFixed2 收口', () => {
    const route = readFileSync(
      new URL('../src/routes/admin-monitoring-routes.ts', import.meta.url),
      'utf8',
    )
    expect(route).toMatch(/errorRate: sql<string>`coalesce\([\s\S]*?\)::numeric\(10,2\)`/)
    expect(route).toMatch(/avgLatency: sql<string>`coalesce\([\s\S]*?\)::numeric\(10,2\)`/)
    expect(route).toContain('errorRate: toFixed2(stats.errorRate)')
    expect(route).toContain('avgLatency: toFixed2(stats.avgLatency)')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
