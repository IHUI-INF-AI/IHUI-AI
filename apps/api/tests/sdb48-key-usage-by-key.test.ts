// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * SDB-48:Key 用量必须按 Key 维度聚合。
 *
 * 立因:`GET /api-keys/:id/usage` 旧实现用 `userId` 统计 `api_logs`,而该表没有
 * api_key_id 列 ⇒ 同一用户的任意 Key 拿到同一份 callCount/lastUsedAt/topEndpoints。
 *
 * 本文件用内存假 DB(WHERE 用 PgDialect 渲染成 SQL)钉住两条判据:
 * ① 同一 userId 下两把不同 Key 的用量彼此隔离(各拿各的 callCount / topEndpoints);
 * ② 每条计量查询的 WHERE 都带 api_key_id(或 audit_logs 的 details->>'apiKeyId'),
 *    且绑定参数是 Key id 而不是 userId —— 摘掉按 Key 过滤会立刻翻红。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

const KEY_A = '11111111-1111-4111-8111-111111111111'
const KEY_B = '22222222-2222-4222-8222-222222222222'
const USER_ID = '33333333-3333-4333-8333-333333333333'

type Endpoint = { path: string; method: string; count: number }
type UsageRow = { callCount: number; lastUsedAt: Date | null; endpoints: Endpoint[] }

const state = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
  return {
    keys: [] as Array<Record<string, unknown>>,
    usage: {} as Record<string, UsageRow>,
    quota: {} as Record<string, Record<string, unknown>>,
    /** 每次查询渲染后的形状,供断言"到底按什么过滤" */
    queries: [] as Array<{ table: string; sql: string; params: unknown[] }>,
  }
})

vi.mock('../src/db/index.js', async () => {
  const { getTableName } = await import('drizzle-orm')
  const dialect = new PgDialect()

  const resolve = (
    table: string,
    fields: Record<string, unknown> | undefined,
    cond: unknown,
  ): unknown[] => {
    const rendered =
      cond === undefined || cond === null
        ? { sql: '', params: [] as unknown[] }
        : dialect.sqlToQuery(cond as never)
    state.queries.push({
      table,
      sql: rendered.sql.toLowerCase(),
      params: rendered.params as unknown[],
    })
    const keyId = String(rendered.params[0] ?? '')

    if (table === 'developer_api_keys') {
      return state.keys.filter((k) => k.id === keyId)
    }
    if (table === 'llm_call_logs') {
      const row = state.usage[keyId]
      if (!row) return []
      if (fields && 'callCount' in fields) return [{ callCount: row.callCount }]
      if (fields && 'lastUsedAt' in fields) {
        return row.lastUsedAt ? [{ lastUsedAt: row.lastUsedAt }] : []
      }
      return []
    }
    if (table === 'audit_logs') {
      return state.usage[keyId]?.endpoints ?? []
    }
    if (table === 'api_key_quotas') {
      const q = state.quota[keyId]
      return q ? [q] : []
    }
    return []
  }

  const chainSelect = (fields?: Record<string, unknown>) => {
    let table = ''
    let cond: unknown
    const step: Record<string, unknown> = {}
    step.from = (t: unknown) => {
      table = getTableName(t as never)
      return step
    }
    step.where = (c: unknown) => {
      cond = c
      return step
    }
    for (const m of ['orderBy', 'limit', 'groupBy', 'offset']) step[m] = () => step
    step.then = (onOk: (v: unknown) => void, onErr?: (e: unknown) => void) =>
      Promise.resolve(resolve(table, fields, cond)).then(onOk, onErr)
    step.catch = (onErr: (e: unknown) => void) =>
      Promise.resolve(resolve(table, fields, cond)).catch(onErr)
    return step
  }

  return {
    db: { select: chainSelect },
    dbRead: { select: chainSelect },
  }
})

import { getUsage } from '../src/services/developer-api-keys-service.js'

const LAST_A = new Date('2026-11-01T08:00:00.000Z')
const LAST_B = new Date('2026-11-09T08:00:00.000Z')

beforeEach(() => {
  state.queries = []
  state.keys = [
    { id: KEY_A, userId: USER_ID, lastUsedAt: new Date('2026-10-01T00:00:00.000Z') },
    { id: KEY_B, userId: USER_ID, lastUsedAt: new Date('2026-10-02T00:00:00.000Z') },
  ]
  state.usage = {
    [KEY_A]: {
      callCount: 3,
      lastUsedAt: LAST_A,
      endpoints: [{ path: '/v1/chat/completions', method: 'POST', count: 3 }],
    },
    [KEY_B]: {
      callCount: 9,
      lastUsedAt: LAST_B,
      endpoints: [{ path: '/v1/embeddings', method: 'POST', count: 9 }],
    },
  }
  state.quota = {}
})

describe('SDB-48 Key 用量按 apiKeyId 聚合', () => {
  it('同一 userId 下两把 Key 的用量彼此隔离', async () => {
    const a = await getUsage(KEY_A, USER_ID)
    const b = await getUsage(KEY_B, USER_ID)

    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(a!.callCount).toBe(3)
    expect(b!.callCount).toBe(9)
    expect(a!.lastUsedAt).toEqual(LAST_A)
    expect(b!.lastUsedAt).toEqual(LAST_B)
    expect(a!.topEndpoints).toEqual([
      { path: '/v1/chat/completions', method: 'POST', count: 3 },
    ])
    expect(b!.topEndpoints).toEqual([{ path: '/v1/embeddings', method: 'POST', count: 9 }])
  })

  it('计量查询的 WHERE 带 api_key_id 且绑定 Key id,不再按 userId / api_logs 统计', async () => {
    await getUsage(KEY_A, USER_ID)

    // 归属校验一条 + callCount / lastUsedAt / topEndpoints 各一条
    const usageQueries = state.queries.filter(
      (q) => q.table === 'llm_call_logs' || q.table === 'audit_logs',
    )
    expect(usageQueries).toHaveLength(3)

    for (const q of usageQueries) {
      expect(q.sql).not.toContain('user_id')
      expect(q.params).toEqual([KEY_A])
      if (q.table === 'llm_call_logs') expect(q.sql).toContain('api_key_id')
      else expect(q.sql).toContain("->>'apikeyid'")
    }
    expect(state.queries.some((q) => q.table === 'api_logs')).toBe(false)
  })

  it('无调用记录时 callCount 为 0、lastUsedAt 回退 Key 行、topEndpoints 为空', async () => {
    state.usage = {}

    const usage = await getUsage(KEY_A, USER_ID)

    expect(usage!.callCount).toBe(0)
    expect(usage!.lastUsedAt).toEqual(new Date('2026-10-01T00:00:00.000Z'))
    expect(usage!.topEndpoints).toEqual([])
  })
})
