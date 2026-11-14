// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-458 回归锁(2026-11-14):金额/数量聚合 `::int` 溢出扩散。
 *
 * 病灶:commission-queries / agents-queries 里 `coalesce(sum(<金额>), 0)::int` /
 * `sum(<金额>)::int`,累计值越过 int4 上限(≈¥21,474,836.47 分)时 PG 抛
 * `22003 integer out of range`,提现资格校验、佣金汇总、平台结算统计等接口直接 500。
 *
 * 本文件锁:
 *   ① 源码锁:这两个文件里所有 sum(...) 聚合行不得再出现 ::int(统一 ::bigint);
 *   ② 映射锁:PG 驱动把 int8 解码成字符串,出口必须经 toSafeAmount 收敛为 number,
 *      不让字符串泄漏到 API 响应,也不因超安全整数丢精度;
 *   ③ 接线锁:提现汇总 / 结算汇总在驱动回字符串时,返回值仍是 number。
 *
 * 只 mock ../src/db/index.js,不触达真实 PG。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/db/index.js', () => {
  const settlementRows = [
    {
      totalAmount: '2147483648',
      settledAmount: '2147483648',
      unsettledAmount: '0',
      commissionAmount: '2147483649',
      totalCount: 1,
      settledCount: 1,
      unsettledCount: 0,
      count: 1,
    },
  ]
  // 同时兼容 `.from(t)` 直接 await 与 `.from(t).where(...)` 两种链式收尾。
  const selectable = (rows: unknown[]) =>
    Object.assign(Promise.resolve(rows), { where: () => Promise.resolve(rows) })
  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([{ total: '3000000000' }]),
        }),
      }),
    },
    dbRead: {
      select: () => ({
        from: () => selectable(settlementRows),
      }),
    },
  }
})

import {
  toSafeAmount,
  withdrawalSummary,
} from '../src/db/commission-queries.js'
import {
  findSettlementSummary,
  findSettlementByOrder,
} from '../src/db/agents-queries.js'

const sourceOf = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

const INT_CAST = /::\s*int\b/

describe('F-458 源码锁:聚合不再强转 int4', () => {
  for (const file of ['../src/db/commission-queries.ts', '../src/db/agents-queries.ts']) {
    it(`${file} 的 sum 聚合行不出现 ::int`, () => {
      const offenders = sourceOf(file)
        .split('\n')
        .map((line, index) => ({ line: line.trim(), no: index + 1 }))
        .filter(({ line }) => !line.startsWith('*') && !line.startsWith('//'))
        .filter(({ line }) => line.includes('sum(') && INT_CAST.test(line))
        .map(({ line, no }) => `${no}: ${line}`)
      expect(offenders).toEqual([])
    })

    it(`${file} 的 sum 聚合已切到 ::bigint`, () => {
      const sumLines = sourceOf(file)
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => !line.startsWith('*') && !line.startsWith('//'))
        .filter((line) => line.includes('sum('))
      expect(sumLines.length).toBeGreaterThan(0)
      expect(sumLines.some((line) => line.includes('::bigint'))).toBe(true)
    })
  }
})

describe('toSafeAmount:int8/numeric 字符串安全转 number', () => {
  it('int4 溢出边界的字符串仍返回 number', () => {
    expect(toSafeAmount('2147483648')).toBe(2147483648)
    expect(typeof toSafeAmount('2147483648')).toBe('number')
  })

  it('bigint 输入转 number', () => {
    expect(toSafeAmount(2147483648n)).toBe(2147483648)
    expect(typeof toSafeAmount(2147483648n)).toBe('number')
  })

  it('超过安全整数时饱和,不丢精度也不抛错', () => {
    expect(toSafeAmount('9007199254740993')).toBe(Number.MAX_SAFE_INTEGER)
    expect(toSafeAmount(9007199254740993n)).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('普通 number 原样返回', () => {
    expect(toSafeAmount(0)).toBe(0)
    expect(toSafeAmount(-1234)).toBe(-1234)
  })

  it('空值/非法值归零', () => {
    expect(toSafeAmount(undefined)).toBe(0)
    expect(toSafeAmount(null)).toBe(0)
    expect(toSafeAmount('')).toBe(0)
    expect(toSafeAmount('not-a-number')).toBe(0)
  })
})

describe('F-458 接线锁:驱动回 int8 字符串时出口仍是 number', () => {
  it('withdrawalSummary 不泄漏字符串', async () => {
    const summary = await withdrawalSummary('user-1')
    expect(summary).toEqual({ totalWithdrawn: 3000000000, pendingAmount: 3000000000 })
    expect(typeof summary.totalWithdrawn).toBe('number')
  })

  it('findSettlementSummary 不泄漏字符串', async () => {
    const summary = await findSettlementSummary()
    expect(summary).toMatchObject({
      totalAmount: 2147483648,
      settledAmount: 2147483648,
      unsettledAmount: 0,
    })
    expect(typeof summary.totalAmount).toBe('number')
  })

  it('findSettlementByOrder 不泄漏字符串', async () => {
    const summary = await findSettlementByOrder('order-1')
    expect(summary).toEqual({
      orderNo: 'order-1',
      totalAmount: 2147483648,
      commissionAmount: 2147483649,
      count: 1,
    })
    expect(typeof summary.commissionAmount).toBe('number')
  })
})
