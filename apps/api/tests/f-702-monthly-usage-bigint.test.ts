// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-702 回归锁(2026-11-11):渠道配额月度用量 `::bigint::int` 溢出。
 *
 * 病灶:当月用量聚合 `coalesce(sum(...), 0)::bigint::int`，SUM 先得 numeric 再收窄 int32，
 *       当月 token/call 超 2^31 直接抛错 ⇒ 配额/成本面板 500 或数据缺失。
 * 判据:① 月度三列改 `::bigint`，不再出现 `::bigint::int`；
 *       ② 映射处 `Number()` 收口，Dashboard 契约保持 number；
 *       ③ 驱动返回字符串 '2500000000' 时结果为 2500000000；0 行仍为 0(非 NaN/null)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  /** 依次供两次 select 消费：当日聚合、当月聚合。 */
  results: [] as Array<Array<Record<string, unknown>>>,
}))

vi.mock('../src/db/index.js', () => {
  const makeChain = (rows: Array<Record<string, unknown>>) => {
    const chain: Record<string, unknown> = {}
    chain.from = () => chain
    chain.where = () => chain
    chain.groupBy = () => Promise.resolve(rows)
    return chain
  }
  const dbRead = { select: () => makeChain(h.results.shift() ?? []) }
  return { db: dbRead, dbRead, dbClient: {} }
})

import { getUsageSummaries, normalizeMonthlyUsage } from '../src/services/channel-quota-service.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SERVICE_SRC = readFileSync(join(HERE, '..', 'src', 'services', 'channel-quota-service.ts'), 'utf8')

/** 截出月度聚合的 select 片段（以 monthStartStr 为当月查询的锚点）。 */
function monthlySelectSrc(): string {
  // 文件里两处 monthStartStr 条件：getRawMonthlyUsage（配额读）与 getUsageSummaries 月度块，
  // 本票只锁后者（Dashboard 三条聚合），故取最后一处。
  const gteIdx = SERVICE_SRC.lastIndexOf(
    'gte(aiRelayChannelDailyUsage.usageDate, monthStartStr)',
  )
  expect(gteIdx).toBeGreaterThan(-1)
  const selectIdx = SERVICE_SRC.lastIndexOf('.select({', gteIdx)
  expect(selectIdx).toBeGreaterThan(-1)
  return SERVICE_SRC.slice(selectIdx, gteIdx)
}

describe('F-702 月度聚合 SQL 形状', () => {
  it('三条聚合只到 ::bigint，不再二次收窄 ::int', () => {
    const block = monthlySelectSrc()
    expect(block).not.toContain('::bigint::int')
    expect(block.match(/, 0\)::bigint`/g)).toHaveLength(3)
    expect(block).toContain('callCount')
    expect(block).toContain('totalTokens')
    expect(block).toContain('totalCostCents')
  })

  it('映射处用 Number() 恢复 number 契约', () => {
    expect(SERVICE_SRC).toContain('entry.monthly = normalizeMonthlyUsage(row)')
    const fnIdx = SERVICE_SRC.indexOf('export function normalizeMonthlyUsage(')
    expect(fnIdx).toBeGreaterThan(-1)
    const fnSrc = SERVICE_SRC.slice(fnIdx, SERVICE_SRC.indexOf('\n}', fnIdx) + 2)
    expect(fnSrc).toContain('Number(row?.callCount ?? 0)')
    expect(fnSrc).toContain('Number(row?.totalTokens ?? 0)')
    expect(fnSrc).toContain('Number(row?.totalCostCents ?? 0)')
  })
})

describe('F-702 normalizeMonthlyUsage 映射', () => {
  it('int8 字符串超 2^31 仍为 number，不截断', () => {
    const result = normalizeMonthlyUsage({
      callCount: '2500000000',
      totalTokens: '2500000000',
      totalCostCents: '123456789012',
    })
    expect(result).toEqual({
      callCount: 2500000000,
      totalTokens: 2500000000,
      totalCostCents: 123456789012,
    })
    for (const value of Object.values(result)) expect(typeof value).toBe('number')
  })

  it('0 行/空字段兜底 0，不产生 NaN/null', () => {
    for (const row of [undefined, null, {}, { callCount: null, totalTokens: null, totalCostCents: null }]) {
      const result = normalizeMonthlyUsage(row)
      expect(result).toEqual({ callCount: 0, totalTokens: 0, totalCostCents: 0 })
      for (const value of Object.values(result)) {
        expect(Number.isFinite(value)).toBe(true)
        expect(value).not.toBeNull()
      }
    }
  })
})

describe('F-702 getUsageSummaries 集成（db 替身，不连 DB/Redis）', () => {
  beforeEach(() => {
    h.results = []
  })

  it('当月返回字符串聚合时映射为 number', async () => {
    h.results = [
      [],
      [
        {
          keyPoolId: 'kp-1',
          callCount: '2500000000',
          totalTokens: '2500000000',
          totalCostCents: '3000000000',
        },
      ],
    ]
    const summaries = await getUsageSummaries(['kp-1'])
    expect(summaries.get('kp-1')?.monthly).toEqual({
      callCount: 2500000000,
      totalTokens: 2500000000,
      totalCostCents: 3000000000,
    })
  })

  it('0 行时月度仍返回 0', async () => {
    h.results = [[], []]
    const summaries = await getUsageSummaries(['kp-1'])
    const monthly = summaries.get('kp-1')?.monthly
    expect(monthly).toEqual({ callCount: 0, totalTokens: 0, totalCostCents: 0 })
    for (const value of Object.values(monthly ?? {})) expect(value).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
