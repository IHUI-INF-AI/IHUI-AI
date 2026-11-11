// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// F-13 回归锁:api-key-quota.checkAndConsume 的 WHERE 必须与 SET 用同一套窗口重置判据。
//
// 缺陷:重置条件只写在 SET 的 CASE 里,WHERE 仍拿旧计数判超限 ⇒ 窗口翻转后 0 行命中,
// hourlyUsed/dailyUsed/resetAt 永不归零,Key 用满一次配额即永久 429。
//
// 判据分工(零连接:链式假 db,UPDATE 的 where 交给 PgDialect 渲染后按 PG 语义对旧行求值):
//  - ① resetAt 已过期且小时/天配额都已打满 ⇒ 本次放行,行被归零重计(hourly/daily 从 1 起)。
//    若 WHERE 缺重置分支,求值为 false ⇒ 0 行 ⇒ allowed=false,本用例必红。
//  - ② resetAt 未过期且小时配额已满 ⇒ 仍拒绝 hourly_exceeded,行不被改写(超限保护未放宽)。
//  - ③ 把 UPDATE 的 where 渲染成 SQL,断言"重置分支"真的进了 WHERE(小时 OR 分支 / 日跨天 OR 分支)。
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * 求值器只覆盖本票谓词用到的算子(CASE WHEN / AND / OR / 比较 / 加法 / 括号 / $n / 列引用)。
 * 遇到不认识的片段显式抛错 —— 判据失效方向必须是报错,而不是把 UPDATE 静默当成 0 行或 1 行。
 */
const h = vi.hoisted(() => {
  const state = {
    row: null as Record<string, unknown> | null,
    whereSql: '',
    whereParams: [] as unknown[],
    sets: [] as Record<string, unknown>[],
  }

  function tokenize(sql: string): string[] {
    const re =
      /\s*(?:"[^"]*"|\$\d+|\d+(?:\.\d+)?|<=|>=|<>|!=|[=<>+\-*/(),.]|[A-Za-z_][A-Za-z0-9_]*)/g
    return [...sql.matchAll(re)].map((m) => m[0].trim())
  }

  function normalize(v: unknown): unknown {
    return v instanceof Date ? v.toISOString() : v
  }

  function toNumber(v: unknown): number {
    if (typeof v !== 'number') throw new Error(`期望数值,实际 ${String(v)}`)
    return v
  }

  function toBool(v: unknown): boolean {
    if (typeof v !== 'boolean') throw new Error(`期望布尔,实际 ${String(v)}`)
    return v
  }

  function compare(left: unknown, op: string, right: unknown): boolean {
    if (typeof left === 'number' && typeof right === 'number') {
      switch (op) {
        case '<=':
          return left <= right
        case '>=':
          return left >= right
        case '<':
          return left < right
        case '>':
          return left > right
        case '=':
          return left === right
        case '<>':
        case '!=':
          return left !== right
        default:
          throw new Error(`不支持的比较算子: ${op}`)
      }
    }
    const l = String(normalize(left))
    const r = String(normalize(right))
    switch (op) {
      case '<=':
        return l <= r
      case '>=':
        return l >= r
      case '<':
        return l < r
      case '>':
        return l > r
      case '=':
        return l === r
      case '<>':
      case '!=':
        return l !== r
      default:
        throw new Error(`不支持的比较算子: ${op}`)
    }
  }

  function evalSql(sql: string, params: unknown[], row: Record<string, unknown>): unknown {
    const tokens = tokenize(sql)
    let i = 0
    const peek = (): string | undefined => tokens[i]
    const take = (): string | undefined => tokens[i++]
    const isKeyword = (kw: string): boolean => (peek() ?? '').toUpperCase() === kw

    function expectToken(tok: string): void {
      const got = take()
      if (got !== tok) throw new Error(`期望 ${tok},实际 ${String(got)}`)
    }

    function primary(): unknown {
      if (isKeyword('CASE')) return caseExpr()
      const tok = take()
      if (tok === undefined) throw new Error('SQL 表达式意外结束')
      if (tok === '(') {
        const value = or()
        expectToken(')')
        return value
      }
      if (tok.startsWith('$')) return normalize(params[Number(tok.slice(1)) - 1])
      if (/^\d/.test(tok)) return Number(tok)
      if (tok.startsWith('"')) {
        let column = tok.slice(1, -1)
        while (peek() === '.') {
          take()
          column = (take() ?? '').replace(/^"|"$/g, '')
        }
        // SQL 里是库列名(snake_case),假行用 drizzle 属性名(camelCase)
        const key = column.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
        return normalize(row[key])
      }
      throw new Error(`无法求值的 SQL 片段: ${tok}`)
    }

    function additive(): unknown {
      let left = primary()
      while (peek() === '+' || peek() === '-') {
        const op = take()
        const right = primary()
        left = op === '+' ? toNumber(left) + toNumber(right) : toNumber(left) - toNumber(right)
      }
      return left
    }

    function comparison(): unknown {
      const left = additive()
      const op = peek()
      if (op && ['<=', '>=', '<>', '!=', '=', '<', '>'].includes(op)) {
        take()
        return compare(left, op, additive())
      }
      return left
    }

    function andExpr(): unknown {
      let left = comparison()
      while (isKeyword('AND')) {
        take()
        // 必须先解析右侧再合并:&& 的短路会跳过解析,留下未消费 token
        const right = toBool(comparison())
        left = toBool(left) && right
      }
      return left
    }

    function or(): unknown {
      let left = andExpr()
      while (isKeyword('OR')) {
        take()
        const right = toBool(andExpr())
        left = toBool(left) || right
      }
      return left
    }

    function caseExpr(): unknown {
      take() // CASE
      let value: unknown = null
      let matched = false
      while (isKeyword('WHEN')) {
        take()
        const cond = or()
        if (!isKeyword('THEN')) throw new Error(`CASE 缺 THEN,实际 ${String(peek())}`)
        take()
        const branch = or()
        if (!matched && toBool(cond)) {
          value = branch
          matched = true
        }
      }
      if (isKeyword('ELSE')) {
        take()
        const fallback = or()
        if (!matched) value = fallback
      }
      if (!isKeyword('END')) throw new Error(`CASE 缺 END,实际 ${String(peek())}`)
      take()
      return value
    }

    const result = or()
    if (i !== tokens.length) throw new Error(`SQL 未消费完: ${tokens.slice(i).join(' ')}`)
    return result
  }

  return { state, evalSql }
})

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()

  const selectChain = () => {
    const rows = () => (h.state.row ? [{ ...h.state.row }] : [])
    const chain: Record<string, unknown> = {
      from: () => chain,
      where: () => chain,
      limit: () => Promise.resolve(rows()),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(rows()).then(res, rej),
    }
    return chain
  }

  const updateChain = () => {
    let set: Record<string, unknown> = {}
    let whereArg: unknown
    const chain: Record<string, unknown> = {
      set: (v: Record<string, unknown>) => {
        set = v
        return chain
      },
      where: (w: unknown) => {
        whereArg = w
        return chain
      },
      returning: () =>
        Promise.resolve().then(() => {
          const wrapper = whereArg as { getSQL?: () => unknown } | undefined
          if (!wrapper || typeof wrapper.getSQL !== 'function') {
            throw new Error('UPDATE 的 where 取不到 getSQL ⇒ 判据失效必须显式报错')
          }
          const q = dialect.sqlToQuery(wrapper.getSQL() as never)
          h.state.whereSql = q.sql
          h.state.whereParams = q.params as unknown[]
          h.state.sets.push(set)

          const oldRow = h.state.row
          if (!oldRow) return []
          // 按 PG 语义对"更新前的行"求值 WHERE;为 false 即 0 行影响
          if (h.evalSql(q.sql, q.params as unknown[], oldRow) !== true) return []

          const nextRow: Record<string, unknown> = { ...oldRow }
          for (const [key, expr] of Object.entries(set)) {
            const sqlExpr = expr as { getSQL?: () => unknown }
            if (typeof sqlExpr.getSQL !== 'function') {
              nextRow[key] = expr
              continue
            }
            const rendered = dialect.sqlToQuery(sqlExpr.getSQL() as never)
            const value = h.evalSql(rendered.sql, rendered.params as unknown[], oldRow)
            nextRow[key] = typeof value === 'string' && oldRow[key] instanceof Date
              ? new Date(value)
              : value
          }
          h.state.row = nextRow
          return [nextRow]
        }),
    }
    return chain
  }

  return {
    db: { select: () => selectChain(), update: () => updateChain() },
    dbRead: {},
    dbClient: {},
  }
})

vi.mock('@ihui/database', async () => {
  const { pgTable, uuid, varchar, integer, timestamp } = await import('drizzle-orm/pg-core')
  // 与 packages/database/src/schema/security.ts 同形:必须是真列对象,PgDialect 才能渲染成
  // "api_key_quotas"."col" 而不是参数占位符(用字符串 mock 列会让本文件的 SQL 断言全部失明)。
  const apiKeyQuotas = pgTable('api_key_quotas', {
    id: uuid('id').defaultRandom().primaryKey(),
    apiKeyId: varchar('api_key_id', { length: 128 }).notNull().unique(),
    hourlyUsed: integer('hourly_used').default(0).notNull(),
    dailyUsed: integer('daily_used').default(0).notNull(),
    hourlyLimit: integer('hourly_limit').default(1000).notNull(),
    dailyLimit: integer('daily_limit').default(10000).notNull(),
    resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  })
  return { apiKeyQuotas }
})

import { ApiKeyQuota } from '../src/utils/api-key-quota.js'

function quotaRow(
  overrides: Partial<{
    hourlyUsed: number
    dailyUsed: number
    hourlyLimit: number
    dailyLimit: number
    resetAt: Date
  }> = {},
) {
  return {
    id: 'row-1',
    apiKeyId: 'key-1',
    hourlyUsed: 0,
    dailyUsed: 0,
    hourlyLimit: 1000,
    dailyLimit: 10_000,
    resetAt: new Date(Date.now() + 3600_000),
    updatedAt: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  h.state.row = null
  h.state.whereSql = ''
  h.state.whereParams = []
  h.state.sets = []
})

describe('F-13 checkAndConsume 窗口重置', () => {
  it('① resetAt 已过期且小时/天配额都打满 ⇒ 本次放行,计数从 1 重新开始', async () => {
    const now = Date.now()
    h.state.row = quotaRow({
      hourlyUsed: 1000,
      dailyUsed: 10_000,
      resetAt: new Date(now - 2 * 24 * 3600_000),
    })

    const result = await new ApiKeyQuota().checkAndConsume('key-1', 1)

    expect(result.allowed).toBe(true)
    // 行真的被归零重计(旧实现 0 行命中,这里仍是 1000/10000)
    expect(h.state.row?.hourlyUsed).toBe(1)
    expect(h.state.row?.dailyUsed).toBe(1)
    expect(result.remaining).toBe(999)
    expect(result.resetAt).toBeInstanceOf(Date)
    expect(result.resetAt.getTime()).toBeGreaterThan(now)
    expect(h.state.row?.resetAt).toBeInstanceOf(Date)
    expect((h.state.row?.resetAt as Date).getTime()).toBeGreaterThan(now)
  })

  it('② resetAt 未过期且小时配额已满 ⇒ 仍拒绝 hourly_exceeded,行不被改写', async () => {
    const resetAt = new Date(Date.now() + 3600_000)
    h.state.row = quotaRow({ hourlyUsed: 1000, dailyUsed: 500, resetAt })

    const result = await new ApiKeyQuota().checkAndConsume('key-1', 1)

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('hourly_exceeded')
    expect(result.remaining).toBe(0)
    expect(result.resetAt.getTime()).toBe(resetAt.getTime())
    expect(h.state.row?.hourlyUsed).toBe(1000)
    expect(h.state.row?.dailyUsed).toBe(500)
    // UPDATE 发了,但 WHERE 未命中(不是靠提前 return 绕开)
    expect(h.state.whereSql).not.toBe('')
  })

  it('③ 渲染 UPDATE 的 WHERE:小时段与日段都带"窗口过期"重置分支', async () => {
    h.state.row = quotaRow({
      hourlyUsed: 1000,
      dailyUsed: 10_000,
      resetAt: new Date(Date.now() - 60_000),
    })

    await new ApiKeyQuota().checkAndConsume('key-1', 1)

    const sql = h.state.whereSql
    // 小时:resetAt <= now OR hourly_used + cost <= hourly_limit
    expect(sql).toMatch(
      /"api_key_quotas"\."reset_at"\s*<=\s*\$\d+\s+OR\s+"api_key_quotas"\."hourly_used"\s*\+\s*\$\d+\s*<=\s*"api_key_quotas"\."hourly_limit"/i,
    )
    // 日:跨小时且跨自然日则归零,否则按累计值判限(两分支都必须在 WHERE 里)
    expect(sql).toMatch(
      /\(\s*"api_key_quotas"\."reset_at"\s*<=\s*\$\d+\s+AND\s+"api_key_quotas"\."reset_at"\s*<\s*\$\d+\s*\)\s*OR\s+"api_key_quotas"\."daily_used"\s*\+\s*\$\d+\s*<=\s*"api_key_quotas"\."daily_limit"/i,
    )
    // 上限判据仍在(并发/窗口内不放宽)
    expect(sql).toMatch(/"hourly_used"\s*\+\s*\$\d+\s*<=\s*"api_key_quotas"\."hourly_limit"/i)
    expect(sql).toMatch(/"daily_used"\s*\+\s*\$\d+\s*<=\s*"api_key_quotas"\."daily_limit"/i)
    // 重置判据比较的是"当前时刻"参数(ISO 字符串,与 SET 的 CASE 同一口径)
    expect(
      h.state.whereParams.some((p) => typeof p === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(p)),
    ).toBe(true)
    expect(h.state.whereParams).toContain(1)
  })
})
