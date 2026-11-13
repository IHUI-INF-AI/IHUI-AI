// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-149 回归锁(2026-11-13)。
 *
 * 病灶:findCompanyStudyReport 的汇总聚合只用 searchCond,时间范围只喂给了 trend,
 * 且完全不过滤 lessons.status=1 ⇒ 汇总卡片恒为全量,与趋势/明细对不上。
 *
 * 本文件锁:
 *   ① 汇总与趋势使用**同一个** WHERE 对象(渲染后的 SQL 文本与参数必须一致);
 *   ② 给定 startDate/endDate 时条件包含两端边界(>= startDate / <= endDate);
 *   ③ 课程状态过滤 lessons.status=1 始终存在;
 *   ④ 未给时间范围时不下发时间条件(避免把「无筛选」变成「全空」)。
 *
 * 只 mock ../src/db/index.js 的 db,不连真实 PG。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getTableName, type SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

import { db } from '../src/db/index.js'

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))

import {
  findCompanyStudyReport,
  type CompanyStudyReportQuery,
} from '../src/db/learn-extended-queries.js'

const dialect = new PgDialect()

interface CapturedQuery {
  fromTable?: string
  where?: SQL
}

const SUMMARY_ROW = {
  totalLessons: 3,
  totalSignups: 7,
  completedCount: 2,
  activeCount: 4,
  refundedCount: 1,
  avgProgress: 42,
  activeMembers: 5,
}

/**
 * 造一个 drizzle 链式查询对象:from/leftJoin/innerJoin/where/groupBy/orderBy
 * 全部返回自身,await 时吐出预置行;同时记录 from 的表名与 where 条件。
 */
function makeSelectChain(rows: unknown[], capture: CapturedQuery) {
  const chain: Record<string, unknown> = {}
  Object.assign(chain, {
    from: vi.fn((table: unknown) => {
      capture.fromTable = getTableName(table as never)
      return chain
    }),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn((cond: SQL | undefined) => {
      capture.where = cond
      return chain
    }),
    groupBy: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    then: (onFulfilled: (value: unknown) => unknown) => onFulfilled(rows),
  })
  return chain
}

/** 按调用顺序给 select 预置结果行,并返回每次调用的捕获记录。 */
function stubDb(results: unknown[][]): CapturedQuery[] {
  const captures: CapturedQuery[] = []
  let index = 0
  vi.mocked(db.select).mockImplementation(((shape: unknown) => {
    void shape
    const capture: CapturedQuery = {}
    captures.push(capture)
    return makeSelectChain(results[index++] ?? [], capture)
  }) as unknown as typeof db.select)
  return captures
}

function render(cond: SQL | undefined) {
  expect(cond).toBeDefined()
  return dialect.sqlToQuery(cond as SQL)
}

const FULL_QUERY: CompanyStudyReportQuery = {
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  search: '管理',
}

describe('F-149 企业学习报表汇总必须与明细同口径', () => {
  beforeEach(() => {
    vi.mocked(db.select).mockReset()
  })

  it('① 汇总与趋势共用同一个 WHERE 对象(同一 SQL 文本与参数)', async () => {
    const captures = stubDb([[SUMMARY_ROW], [{ date: '2026-01-02', signups: 7, completed: 2 }]])

    await findCompanyStudyReport(FULL_QUERY)

    expect(captures).toHaveLength(2)
    // 汇总先跑(lessons 打头),趋势后跑(lesson_sign_ups 打头)
    expect(captures[0]?.fromTable).toBe('lessons')
    expect(captures[1]?.fromTable).toBe('lesson_sign_ups')
    // 同一个条件实例,不是各拼一份
    expect(captures[1]?.where).toBe(captures[0]?.where)

    const summary = render(captures[0]?.where)
    const trend = render(captures[1]?.where)
    expect(trend.sql).toBe(summary.sql)
    expect(trend.params).toEqual(summary.params)
  })

  it('② 给定时间范围时汇总条件包含两端边界', async () => {
    const captures = stubDb([[SUMMARY_ROW], []])
    await findCompanyStudyReport(FULL_QUERY)

    const { sql, params } = render(captures[0]?.where)
    expect(sql).toMatch(/"lesson_sign_ups"\."created_at"\s*>=\s*\$\d+/)
    expect(sql).toMatch(/"lesson_sign_ups"\."created_at"\s*<=\s*\$\d+/)
    expect(params).toContain('2026-01-01')
    expect(params).toContain('2026-01-31')
  })

  it('③ 课程状态过滤 status=1 恒在(时间范围 + 搜索都在时也一样)', async () => {
    const captures = stubDb([[SUMMARY_ROW], []])
    await findCompanyStudyReport(FULL_QUERY)

    const { sql, params } = render(captures[0]?.where)
    expect(sql).toContain('"lessons"."status" = $')
    expect(params).toContain(1)
    expect(sql).toContain('"lessons"."title" ilike $')
    expect(params).toContain('%管理%')
  })

  it('④ 未给时间范围:仍过滤 status=1,且不下发时间条件', async () => {
    const captures = stubDb([[SUMMARY_ROW]])
    await findCompanyStudyReport({ search: '管理' })

    expect(captures).toHaveLength(1)
    const { sql } = render(captures[0]?.where)
    expect(sql).toContain('"lessons"."status" = $')
    expect(sql).not.toContain('"lesson_sign_ups"."created_at"')
  })
})
