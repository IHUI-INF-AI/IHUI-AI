// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-22 回归锁(2026-11-11):营收 `sum(amount)::int` 溢出被吞成「全 0 看板」。
 *
 * 根因:orders.amount 为 integer(分),sum(int4) 在 PG 里是 int8,再 `::int` 转 int4
 * 会在累计已支付金额超过 2^31 分(≈ ¥21,474,836.47)时抛 22003 integer out of range;
 * 上层 catch 把整个看板降级成全 0,且不报错。
 *
 * 本用例不连真实 DB:
 *  1) 纯转换函数 toSafeMoneyInt:字符串 bigint 入参、超界钳制、脏数据归零;
 *  2) 源码形状:6+ 处聚合均为 ::bigint,不再出现 `sum(amount), 0)::int`,
 *     聚合失败不再以零值 success 响应收场。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi } from 'vitest'

// stats.ts 顶层会 import db;此处仅取纯函数与源码文本,不建任何连接
vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), execute: vi.fn() },
  dbRead: {},
  dbClient: {},
}))

import { toSafeMoneyInt } from '../src/routes/admin/stats.js'

function readSource(relPath: string): string {
  return readFileSync(fileURLToPath(new URL(relPath, import.meta.url)), 'utf8')
}

const statsSource = readSource('../src/routes/admin/stats.ts')
const adminSource = readSource('../src/routes/admin.ts')

describe('F-22 toSafeMoneyInt — bigint 聚合结果安全转 number', () => {
  it('字符串 bigint 入参(驱动对 int8 的默认返回形态)按数值透传', () => {
    // 214748364800 分 = ¥21 亿,远超 int4 上限 2147483647
    expect(toSafeMoneyInt('214748364800')).toBe(214748364800)
    expect(toSafeMoneyInt('2147483648')).toBe(2147483648)
    expect(toSafeMoneyInt('0')).toBe(0)
    expect(toSafeMoneyInt('-12345')).toBe(-12345)
  })

  it('number / bigint 入参同样可用', () => {
    expect(toSafeMoneyInt(5600)).toBe(5600)
    expect(toSafeMoneyInt(0)).toBe(0)
    expect(toSafeMoneyInt(123n)).toBe(123)
    expect(toSafeMoneyInt(12.9)).toBe(12)
  })

  it('无数据(null / undefined / 空串)归 0,不抛', () => {
    expect(toSafeMoneyInt(null)).toBe(0)
    expect(toSafeMoneyInt(undefined)).toBe(0)
    expect(toSafeMoneyInt('')).toBe(0)
  })

  it('不可解析或非有限值归 0,不抛', () => {
    expect(toSafeMoneyInt('abc')).toBe(0)
    expect(toSafeMoneyInt(Number.NaN)).toBe(0)
    expect(toSafeMoneyInt(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('超过 Number.MAX_SAFE_INTEGER 时钳制到上限并告警(不抛)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      // 2^53 + 1,Number 化后丢精度,必须钳制
      expect(toSafeMoneyInt('9007199254740993')).toBe(Number.MAX_SAFE_INTEGER)
      expect(toSafeMoneyInt(Number.MAX_SAFE_INTEGER + 2)).toBe(Number.MAX_SAFE_INTEGER)
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('低于 -Number.MAX_SAFE_INTEGER 时钳制到下限并告警(不抛)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(toSafeMoneyInt('-9007199254740993')).toBe(-Number.MAX_SAFE_INTEGER)
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })
})

describe('F-22 源码形状 — 聚合不再 ::int,失败不再零值兜底', () => {
  it('stats.ts 的 5 处 sum(amount) 聚合全部改为 ::bigint', () => {
    expect(statsSource).not.toMatch(/coalesce\(sum\(amount\), ?0\)::int/)
    expect(statsSource).not.toMatch(/coalesce\(sum\(\$\{orders\.amount\}\), ?0\)::int/)
    const bigintAggs = statsSource.match(/coalesce\(sum\((?:amount|\$\{orders\.amount\})\), 0\)::bigint/g)
    expect(bigintAggs).toHaveLength(5)
  })

  it('admin.ts 的 2 处 sum(amount) 聚合全部改为 ::bigint', () => {
    expect(adminSource).not.toMatch(/coalesce\(sum\(amount\), ?0\)::int/)
    const bigintAggs = adminSource.match(/coalesce\(sum\(amount\), 0\)::bigint/g)
    expect(bigintAggs).toHaveLength(2)
  })

  it('聚合结果统一经 toSafeMoneyInt 转 number(响应仍是 number)', () => {
    // stats.ts: 函数定义 1 处 + 调用 5 处(dashboard 1 + revenue 3 + trend 1)
    expect(statsSource.match(/toSafeMoneyInt\(/g)).toHaveLength(6)
    // admin.ts: today + yesterday 两处调用
    expect(adminSource.match(/toSafeMoneyInt\(/g)).toHaveLength(2)
  })

  it('dashboard / revenue 查询失败返回 500,不再伪装成全 0 看板', () => {
    expect(statsSource).toMatch(
      /'stats\/dashboard 查询失败'\)[\s\S]{0,200}reply\.status\(500\)\.send\(error\(500/,
    )
    expect(statsSource).toMatch(
      /'stats\/revenue 查询失败'\)[\s\S]{0,200}reply\.status\(500\)\.send\(error\(500/,
    )
  })
})
