// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-701 回归锁(2026-11-11):中转账号 24h 用量 `sum(...)::int` 溢出被 catch 吞成整批全 0。
 *
 * 病灶:prompt_tokens/completion_tokens 为 integer,SUM 在 PG 里返回 int8,再 `::int`
 * 会在 24h 合计超 2^31 时抛 22003;`getAccountUsageSummaries` 的 catch 把异常降级成
 * 空 Map,于是所有账号 calls24h/tokens24h/failRate24h 都显示 0(误报零调用)。
 *
 * 判据(零 DB/Redis 连接):
 *  1) 聚合 SQL 的 calls/tokens/fails 三条均以 `::bigint` 收口,不再对 SUM/COUNT 直接 `::int`;
 *  2) 结果映射经 `Number(...)`,驱动回传的 int8 字符串(如 '3000000000')转成 number;
 *  3) 真实故障仍返回空 Map(保持永不抛),但必须 `logger.error` 留痕并带降级标志。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SQLWrapper } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const h = vi.hoisted(() => ({
  rows: [] as unknown[],
  throwError: null as Error | null,
  cols: null as Record<string, unknown> | null,
}))

vi.mock('../src/db/index.js', () => {
  function makeChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      from: () => chain,
      where: () => chain,
      groupBy: () => chain,
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
        const pending = h.throwError ? Promise.reject(h.throwError) : Promise.resolve(h.rows)
        return pending.then(resolve, reject)
      },
    }
    return chain
  }
  const root = {
    select: (cols: Record<string, unknown>) => {
      h.cols = cols
      return makeChain()
    },
  }
  return { db: root, dbRead: root, dbClient: {} }
})

vi.mock('../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { getAccountUsageSummaries } from '../src/services/relay-account-usage.js'
import { logger } from '../src/utils/logger.js'

const dialect = new PgDialect()

function renderSql(fragment: unknown): string {
  const wrapper = fragment as SQLWrapper | undefined
  if (!wrapper || typeof wrapper.getSQL !== 'function') {
    throw new Error('聚合片段取不到 getSQL,判据失效方向必须是显式报错而不是静默通过')
  }
  return dialect.sqlToQuery(wrapper.getSQL()).sql
}

function aggregateSql(): Record<string, string> {
  if (!h.cols) throw new Error('没有捕获到聚合 select 列')
  return Object.fromEntries(Object.entries(h.cols).map(([key, value]) => [key, renderSql(value)]))
}

function readSource(relPath: string): string {
  return readFileSync(fileURLToPath(new URL(relPath, import.meta.url)), 'utf8')
}

const source = readSource('../src/services/relay-account-usage.ts')

/** 只截取 getAccountUsageSummaries 函数体,避免把同文件其它 count(*)::int 误算进来。 */
function summariesBlock(): string {
  const start = source.indexOf('export async function getAccountUsageSummaries')
  const end = source.indexOf('export interface AccountUsageResult')
  if (start < 0 || end < 0 || end <= start)
    throw new Error('定位不到 getAccountUsageSummaries 函数体')
  return source.slice(start, end)
}

beforeEach(() => {
  h.rows = []
  h.throwError = null
  h.cols = null
  vi.mocked(logger.error).mockClear()
})

describe('F-701 聚合 SQL 形状 — 三条聚合均以 ::bigint 收口', () => {
  it('calls/tokens/fails 编译后含 ::bigint,且不再对 SUM/COUNT 直接 ::int', async () => {
    await getAccountUsageSummaries(['acc-1'])
    const sql = aggregateSql()
    for (const key of ['calls', 'tokens', 'fails']) {
      expect(sql[key]).toContain('::bigint')
      expect(sql[key]).not.toMatch(/::int\b/)
    }
    expect(sql.tokens).toMatch(/sum\(/)
    expect(sql.fails).toMatch(/sum\(/)
  })

  it('源码层同样是 3 处 ::bigint + 映射处 Number(,函数体内无 ::int 收口', () => {
    // 注释里会解释「为什么不用 ::int」,判据只看代码行。
    const block = summariesBlock().replace(/^\s*\/\/.*$/gm, '')
    expect(block.match(/::bigint/g) ?? []).toHaveLength(3)
    expect(block).not.toMatch(/::int\b/)
    expect(block.match(/Number\(/g) ?? []).toHaveLength(3)
  })
})

describe('F-701 结果映射 — int8 字符串大值转 number', () => {
  it("tokens '3000000000'(> 2^31)映射为 number 3000000000,failRate 仍正确", async () => {
    h.rows = [{ accountId: 'acc-1', calls: '120', tokens: '3000000000', fails: '3' }]
    const map = await getAccountUsageSummaries(['acc-1'])
    const summary = map.get('acc-1')
    if (!summary) throw new Error('汇总缺失')
    expect(typeof summary.tokens24h).toBe('number')
    expect(summary.tokens24h).toBe(3000000000)
    expect(summary.calls24h).toBe(120)
    expect(summary.failRate24h).toBe(0.025)
  })

  it('驱动已回传 number 时同样归一为 number', async () => {
    h.rows = [{ accountId: 'acc-2', calls: 0, tokens: 0, fails: 0 }]
    const map = await getAccountUsageSummaries(['acc-2'])
    const summary = map.get('acc-2')
    if (!summary) throw new Error('汇总缺失')
    expect(summary).toEqual({ calls24h: 0, tokens24h: 0, failRate24h: 0 })
  })

  it('空账号列表直接返回空 Map,不触发查询', async () => {
    const map = await getAccountUsageSummaries([])
    expect(map.size).toBe(0)
    expect(h.cols).toBeNull()
  })
})

describe('F-701 catch 分支 — 真实故障留痕,不再静默降级', () => {
  it('查询抛错时仍返回空 Map(永不抛),但 logger.error 记录函数名与降级标志', async () => {
    h.throwError = new Error('connection reset')
    const map = await getAccountUsageSummaries(['acc-1'])
    expect(map.size).toBe(0)
    expect(logger.error).toHaveBeenCalledTimes(1)
    const [msg, meta] = vi.mocked(logger.error).mock.calls[0] as [string, Record<string, unknown>]
    expect(msg).toContain('getAccountUsageSummaries')
    expect(meta).toMatchObject({
      fn: 'getAccountUsageSummaries',
      degraded: true,
      error: 'connection reset',
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
