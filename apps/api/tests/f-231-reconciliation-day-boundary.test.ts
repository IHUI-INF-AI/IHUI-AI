// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-231 回归锁(2026-11-13)。
 *
 * 病灶:支付宝/微信账单按**北京时间**归档(billDate 是上海自然日),而本地 paid 订单曾是
 * `${billDate}T00:00:00Z`~`T23:59:59Z` 的 **UTC** 日界取数 —— 每天错开 8 小时,固定产出
 * 假差异,`slice(0,50)` 再把真实差异挤掉;上界 `lt ...T23:59:59Z` 还截掉了当日最后一秒。
 *
 * 本文件锁:
 *   ① 给定北京某日,生成的 SQL 时间条件按 Asia/Shanghai 日界,且两端闭区间(`>=` / `<=`);
 *   ② 不再出现裸 UTC 日期比较(无 `'...T00:00:00Z'` 之类字符串参数,下界不是 UTC 零点);
 *   ③ 区间完整覆盖当日:上界 = 次日上海 00:00 前 1ms(即上海 23:59:59.999);
 *   ④ 正常参数下不产生额外条件(status + 两个时间界,没有第三条分支)。
 *
 * 只 mock db(select 链)并用 PgDialect 编译 where,不连真实 PG。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const capture = vi.hoisted(() => ({
  /** 每次 db.select().from().where(cond) 的 where 参数 */
  whereArgs: [] as unknown[],
}))

vi.mock('../src/db/index.js', async () => {
  const makeSelect = () => {
    const chain: Record<string, unknown> = {}
    chain.from = () => chain
    chain.where = (cond: unknown) => {
      capture.whereArgs.push(cond)
      return Promise.resolve([])
    }
    return chain
  }
  return {
    db: { select: makeSelect, insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
    dbRead: { select: makeSelect },
  }
})

import { PgDialect } from 'drizzle-orm/pg-core'
import { listPaidOrdersByDate } from '../src/db/payment-queries.js'

const dialect = new PgDialect()
const compile = (cond: unknown) => dialect.sqlToQuery(cond as never)

/** 北京(上海)2026-11-12 这个自然日的人工 oracle,不是任何一段代码的输出。 */
const BILL_DATE = '2026-11-12'
/** 上海 2026-11-12 00:00 = UTC 2026-11-11 16:00。 */
const SHANGHAI_DAY_START_UTC = '2026-11-11T16:00:00.000Z'
/** 上海 2026-11-13 00:00(次日日界)= UTC 2026-11-12 16:00。 */
const NEXT_SHANGHAI_DAY_START_UTC = '2026-11-12T16:00:00.000Z'
/** 北京时间当日最后一毫秒。 */
const SHANGHAI_DAY_END_INCLUSIVE_UTC = '2026-11-12T15:59:59.999Z'
/** 旧 UTC 口径会给出的下界 —— 本票明确否定的写法。 */
const UTC_DAY_START = `${BILL_DATE}T00:00:00.000Z`

/** PgDialect 把 timestamptz 的 Date 参数序列化成 ISO 字符串;这里还原成时刻,与写法无关。 */
const isoBoundaries = (params: unknown[]): Date[] =>
  params
    .filter((p): p is string => typeof p === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(p))
    .map((p) => new Date(p))

describe('F-231 对账本地取数必须按 Asia/Shanghai 自然日', () => {
  beforeEach(() => {
    capture.whereArgs.length = 0
  })

  it('① 时间条件用 Asia/Shanghai 日界,且两端闭区间(>= / <=)', async () => {
    await listPaidOrdersByDate(BILL_DATE)

    expect(capture.whereArgs).toHaveLength(1)
    const q = compile(capture.whereArgs[0])
    const bounds = isoBoundaries(q.params)

    // 下界 = 上海当日 00:00,上界 = 上海当日 23:59:59.999
    expect(bounds.map((d) => d.toISOString())).toEqual([
      SHANGHAI_DAY_START_UTC,
      SHANGHAI_DAY_END_INCLUSIVE_UTC,
    ])
    // 两端都是闭区间运算符,而不是 `>` / `<` 把边界日的一瞬排除在外
    expect(q.sql).toMatch(/"orders"\."created_at"\s*>=\s*\$\d+/)
    expect(q.sql).toMatch(/"orders"\."created_at"\s*<=\s*\$\d+/)
    expect(q.sql).not.toMatch(/"orders"\."created_at"\s*>\s*\$\d+/)
    expect(q.sql).not.toMatch(/"orders"\."created_at"\s*<\s*\$\d+/)
  })

  it('② 不再出现裸 UTC 日期比较(没有日期字符串参数,下界不是 UTC 零点)', async () => {
    await listPaidOrdersByDate(BILL_DATE)

    const q = compile(capture.whereArgs[0])
    const bounds = isoBoundaries(q.params)

    // 时间界必须以参数下发,SQL 文本里不得内联日期字面量
    expect(q.sql).not.toMatch(/"created_at"\s*(>=|<=|>|<)\s*'/)
    expect(q.sql).not.toContain(BILL_DATE)
    // 唯一的非日期字符串参数是状态等值条件
    expect(q.params.filter((p) => typeof p === 'string' && !/^\d{4}-\d{2}-\d{2}T/.test(p))).toEqual(
      ['paid'],
    )
    // 没有 '2026-11-12T00:00:00.000Z' / '...T23:59:59.000Z' 这类裸 UTC 日界参数
    expect(q.params).not.toContain(UTC_DAY_START)
    expect(q.params).not.toContain(`${BILL_DATE}T23:59:59.000Z`)
    // 控制组:下界确实不是旧的 UTC 零点(否则上面几条仍可能只是"没写字符串"而已)
    expect(bounds[0]!.toISOString()).not.toBe(UTC_DAY_START)
    expect(bounds[1]!.toISOString()).not.toBe(`${BILL_DATE}T23:59:59.000Z`)
  })

  it('③ 区间完整覆盖当日 24h:上界 = 次日上海 00:00 前 1ms', async () => {
    await listPaidOrdersByDate(BILL_DATE)

    const [start, end] = isoBoundaries(compile(capture.whereArgs[0]).params)
    const nextDayStart = new Date(NEXT_SHANGHAI_DAY_START_UTC)

    // 上界等价于次日 00:00 边界:比它早 1ms,不回退到当日 00:00、也不截断最后一秒
    expect(nextDayStart.getTime() - end!.getTime()).toBe(1)
    expect(end!.getTime()).toBeGreaterThanOrEqual(new Date(`${BILL_DATE}T15:59:59.000Z`).getTime())
    expect(new Date(SHANGHAI_DAY_END_INCLUSIVE_UTC).getTime()).toBe(end!.getTime())
    // 整个自然日时长为 24h(闭区间少 1ms),既没截断也没多算次日
    expect(end!.getTime() - start!.getTime()).toBe(86400_000 - 1)
  })

  it('④ 正常参数下不产生额外条件:status + 两个时间界,共 3 个占位符', async () => {
    await listPaidOrdersByDate(BILL_DATE)

    const q = compile(capture.whereArgs[0])

    expect(q.sql).toBe(
      '("orders"."status" = $1 and "orders"."created_at" >= $2 and "orders"."created_at" <= $3)',
    )
    expect(q.params).toHaveLength(3)
    expect(q.sql.match(/"orders"\."created_at"/g)).toHaveLength(2)
    expect(q.sql).not.toMatch(/\sor\s/i)
  })
})
