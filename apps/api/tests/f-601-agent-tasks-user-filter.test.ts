// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-601 回归锁(2026-11-13)。
 *
 * 病灶:findAgentTasksByAgentId 的 SQL 只按 agentId 取最近 500 行,
 * 创建者可见性过滤与 limit 截断都在内存完成 ⇒ 热门 agent 下本人历史被挤出窗口,
 * 页面误显示无数据,且每次多拉 500 行。
 *
 * 本文件锁:
 *   ① 普通用户(回填前):created_by = 本人 OR created_by IS NULL 下推 WHERE,limit 直达 SQL;
 *   ② 普通用户(回填后):只留 created_by = 本人,NULL 行不再可见且不进 WHERE;
 *   ③ 管理员:WHERE 只有 agentId,不产生 created_by 条件、不探测迁移标记;
 *   ④ status / offset 可选参数下推 WHERE 与 OFFSET,默认 limit 为 50(不是 500);
 *   ⑤ 排序在 SQL 完成(created_at DESC, id DESC),旧三参调用签名保持兼容。
 *
 * 只 mock ../src/db/index.js 的查询链并捕获 where/orderBy/limit/offset,
 * SQL 文本由 PgDialect 编译,不连真实 PG。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

interface CapturedCall {
  where?: unknown
  orderBy?: unknown[]
  limit?: number
  offset?: number
}

const state = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  markerRows: [] as unknown[],
  calls: [] as CapturedCall[],
}))

vi.mock('../src/db/index.js', () => {
  const makeChain = () => {
    const call: CapturedCall = {}
    state.calls.push(call)
    const chain: Record<string, unknown> = {}
    chain.where = vi.fn((cond: unknown) => {
      call.where = cond
      return chain
    })
    chain.orderBy = vi.fn((...args: unknown[]) => {
      call.orderBy = args
      return chain
    })
    chain.limit = vi.fn((n: number) => {
      call.limit = n
      return chain
    })
    chain.offset = vi.fn((n: number) => {
      call.offset = n
      return chain
    })
    chain.then = (onFulfilled: (value: unknown) => unknown) =>
      Promise.resolve(state.rows).then(onFulfilled)
    return chain
  }
  return {
    db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
    dbRead: {
      select: vi.fn(() => ({ from: vi.fn(() => makeChain()) })),
      execute: vi.fn(async () => state.markerRows),
    },
  }
})

import { dbRead } from '../src/db/index.js'
import {
  findAgentTasksByAgentId,
  _resetAgentTaskBackfillCache,
} from '../src/db/agent-queries.js'

const dialect = new PgDialect()
const AGENT_ID = '44444444-4444-4444-8444-444444444444'
const USER_ID = '55555555-5555-4555-8555-555555555555'
const ADMIN_ID = '66666666-6666-4666-8666-666666666666'

const render = (cond: unknown) =>
  dialect.sqlToQuery(cond as Parameters<PgDialect['sqlToQuery']>[0])

const whereSql = (index = 0) => {
  const call = state.calls[index]
  expect(call?.where).toBeDefined()
  return render(call?.where)
}

const orderSql = (index = 0): string =>
  (state.calls[index]?.orderBy ?? []).map((arg) => render(arg).sql).join(', ')

beforeEach(() => {
  state.rows = []
  state.markerRows = []
  state.calls.length = 0
  _resetAgentTaskBackfillCache()
  vi.mocked(dbRead.execute).mockClear()
})

describe('F-601 agent_tasks 过滤/分页必须下推 SQL', () => {
  it('① 普通用户(回填前):本人 + NULL 进 WHERE,limit 不再是 500', async () => {
    state.rows = [
      { id: 'mine', createdBy: USER_ID },
      { id: 'legacy', createdBy: null },
    ]

    const rows = await findAgentTasksByAgentId(AGENT_ID, { userId: USER_ID, isAdmin: false })

    const call = state.calls[0]
    expect(call?.limit).toBe(50)
    expect(call?.limit).not.toBe(500)

    const { sql, params } = whereSql()
    expect(sql).toContain('"agent_tasks"."agent_id" = $1')
    expect(sql).toMatch(/"agent_tasks"\."created_by" = \$\d+/i)
    expect(sql).toMatch(/"agent_tasks"\."created_by" is null/i)
    expect(params).toEqual([AGENT_ID, USER_ID])

    expect(orderSql()).toMatch(/"agent_tasks"\."created_at" desc/i)
    expect(orderSql()).toMatch(/"agent_tasks"\."id" desc/i)
    expect(rows.map((r) => r.id)).toEqual(['mine', 'legacy'])
  })

  it('② 普通用户(回填后):只下推本人条件,NULL 行不再进入窗口', async () => {
    state.markerRows = [{ scope: 'agent_tasks.creator' }]
    state.rows = [{ id: 'mine', createdBy: USER_ID }]

    const rows = await findAgentTasksByAgentId(AGENT_ID, { userId: USER_ID, isAdmin: false })

    const { sql, params } = whereSql()
    expect(sql).not.toMatch(/is null/i)
    expect(sql).toMatch(/"agent_tasks"\."created_by" = \$\d+/i)
    expect(params).toEqual([AGENT_ID, USER_ID])
    expect(rows.map((r) => r.id)).toEqual(['mine'])
  })

  it('③ 管理员:WHERE 只有 agentId,不探测迁移标记', async () => {
    state.rows = [{ id: 'any', createdBy: 'someone-else' }]

    const rows = await findAgentTasksByAgentId(AGENT_ID, { userId: ADMIN_ID, isAdmin: true })

    const { sql, params } = whereSql()
    expect(sql).not.toContain('created_by')
    expect(params).toEqual([AGENT_ID])
    expect(dbRead.execute).not.toHaveBeenCalled()
    expect(rows.map((r) => r.id)).toEqual(['any'])
  })

  it('④ status 与 offset 下推 SQL,limit 用调用方值', async () => {
    state.rows = [{ id: 'paged', createdBy: USER_ID }]

    await findAgentTasksByAgentId(AGENT_ID, { userId: USER_ID, isAdmin: false }, 10, {
      status: ['pending', 'running', 'pending'],
      offset: 20,
    })

    const call = state.calls[0]
    expect(call?.limit).toBe(10)
    expect(call?.offset).toBe(20)

    const { sql, params } = whereSql()
    expect(sql).toMatch(/"agent_tasks"\."status" in \(\$\d+, \$\d+\)/i)
    expect(params).toEqual([AGENT_ID, USER_ID, 'pending', 'running'])
  })

  it('⑤ 单状态过滤与旧三参调用保持兼容(不传 offset 就不下发 OFFSET)', async () => {
    state.rows = [{ id: 'only', createdBy: USER_ID }]

    const rows = await findAgentTasksByAgentId(AGENT_ID, { userId: USER_ID, isAdmin: false }, 5, {
      status: 'completed',
    })

    expect(state.calls[0]?.limit).toBe(5)
    expect(state.calls[0]?.offset).toBeUndefined()
    const { sql, params } = whereSql()
    expect(sql).toMatch(/"agent_tasks"\."status" = \$\d+/i)
    expect(params).toEqual([AGENT_ID, USER_ID, 'completed'])
    expect(rows.map((r) => r.id)).toEqual(['only'])
  })
})
