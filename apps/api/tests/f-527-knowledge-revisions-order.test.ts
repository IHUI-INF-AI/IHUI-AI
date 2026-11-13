// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-527 回归锁(2026-11-13)。
 *
 * 病灶:GET /api/knowledge-team/items/:itemId/revisions 用 `asc(revisionNo) + limit`,
 * 修订超过一页时取到的恰好是最早的 N 条、最新改动被挡在窗外;两条审计流也都没有 offset,
 * 翻页无从谈起(工单证据:knowledge-team-service.ts:723-733,740-745;routes:60-63)。
 *
 * 本文件锁:
 *   ① 条目流默认按 revisionNo 倒序(最新在前);
 *   ② offset 生效(透传到查询链,并在响应里回显);
 *   ③ 页大小有上限(传入超大 limit 只取 MAX_LIMIT=200);
 *   ④ 空间流仍按 createdAt 倒序。
 *
 * 零连接:db 用链式假桩只采集 orderBy/limit/offset,再交给 PgDialect 渲染成 SQL 文本;
 * 不触达真实 PG,也不执行任何 SQL。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  results: [] as unknown[][],
  calls: [] as Array<{ orderBy: unknown[]; limit?: number; offset?: number }>,
}))

vi.mock('../src/db/index.js', () => {
  function makeChain(): Record<string, unknown> {
    const call: { orderBy: unknown[]; limit?: number; offset?: number } = { orderBy: [] }
    state.calls.push(call)
    const api: Record<string, unknown> = {
      from: () => api,
      where: () => api,
      orderBy: (...args: unknown[]) => {
        call.orderBy.push(...args)
        return api
      },
      limit: (n: number) => {
        call.limit = n
        return api
      },
      offset: (n: number) => {
        call.offset = n
        return api
      },
      then: (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(state.results.shift() ?? []).then(res, rej),
    }
    return api
  }
  return {
    db: {
      select: () => makeChain(),
      insert: () => makeChain(),
      update: () => makeChain(),
      delete: () => makeChain(),
    },
    dbRead: { select: () => makeChain() },
  }
})

import { PgDialect } from 'drizzle-orm/pg-core'
import { listRevisions } from '../src/services/knowledge-team-service.js'

const USER_ID = '00000000-0000-4000-8000-0000000000a1'
const TEAM_ID = '00000000-0000-4000-8000-00000000c001'
const SPACE_ID = '00000000-0000-4000-8000-00000000a001'
const ITEM_ID = '00000000-0000-4000-8000-00000000b001'

// drizzle 0.45 的 SQL 片段没有 toSQL(),渲染口径只有一条:交给 PgDialect。
const dialect = new PgDialect()

function spaceRow() {
  return {
    id: SPACE_ID,
    teamId: TEAM_ID,
    name: '后端规范',
    settings: {},
    visibility: 'team',
    status: 'active',
    createdBy: USER_ID,
    updatedBy: USER_ID,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
  }
}

function itemRow() {
  return {
    id: ITEM_ID,
    spaceId: SPACE_ID,
    kind: 'memory',
    title: '分页约定',
    content: { rule: 'cursor' },
    plainText: '列表接口一律用 cursor',
    tags: ['api'],
    status: 'draft',
    revision: 60,
    sourceRef: null,
    createdBy: USER_ID,
    updatedBy: USER_ID,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-02T00:00:00.000Z'),
  }
}

function revisionRow(over: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-00000000d001',
    itemId: ITEM_ID,
    spaceId: SPACE_ID,
    revisionNo: 60,
    action: 'revise',
    actorUserId: USER_ID,
    actorRole: 'editor',
    beforeSummary: null,
    afterSummary: { title: '分页约定', status: 'draft', length: 42, digest: 'aaaaaaaaaaaaaaaa' },
    changeNote: null,
    createdAt: new Date('2026-11-02T00:00:00.000Z'),
    ...over,
  }
}

/** 取"数据查询"那次 select:权限检查那几次没有 orderBy,不参与断言 */
function revisionsCall(): { orderBy: unknown[]; limit?: number; offset?: number } {
  const call = state.calls.find((c) => c.orderBy.length > 0)
  if (!call) throw new Error(`没有捕获到带 orderBy 的查询(共 ${state.calls.length} 次 select)`)
  return call
}

/** 第 n 个 orderBy 片段渲染成 SQL 文本(取不到 getSQL ⇒ 显式报错,不静默通过) */
function orderKeys(): string[] {
  return revisionsCall().orderBy.map((part) => {
    const wrapper = part as { getSQL?: () => unknown } | undefined
    if (!wrapper || typeof wrapper.getSQL !== 'function') {
      throw new Error('orderBy 片段取不到 getSQL ⇒ 判据失效方向必须是显式报错')
    }
    return dialect.sqlToQuery(wrapper.getSQL() as never).sql
  })
}

/** 条目流的前置权限查询:条目 → 空间 → 空间成员 → 团队成员 */
function itemFlowResults(revisions: unknown[], total: number): unknown[][] {
  return [[itemRow()], [spaceRow()], [{ role: 'viewer' }], [{ role: 'member' }], revisions, [{ total }]]
}

/** 空间流的前置权限查询:空间 → 空间成员 → 团队成员 */
function spaceFlowResults(revisions: unknown[], total: number): unknown[][] {
  return [[spaceRow()], [{ role: 'viewer' }], [{ role: 'member' }], revisions, [{ total }]]
}

describe('F-527 团队知识修订流分页与倒序', () => {
  beforeEach(() => {
    state.results = []
    state.calls = []
  })

  it('① 条目流默认倒序:revision_no DESC,默认页大小 50、offset 0', async () => {
    state.results = itemFlowResults([revisionRow(), revisionRow({ revisionNo: 59 })], 60)

    const page = await listRevisions({ userId: USER_ID }, { itemId: ITEM_ID })

    expect(orderKeys()).toEqual(['"team_knowledge_revisions"."revision_no" desc'])
    expect(revisionsCall().limit).toBe(50)
    expect(revisionsCall().offset).toBe(0)
    expect(page.items.map((r) => r.revisionNo)).toEqual([60, 59])
    expect(page.total).toBe(60)
    expect(page.hasMore).toBe(true)
  })

  it('② offset 生效:透传到查询链并在响应回显,hasMore 按 offset+本页长度判', async () => {
    state.results = itemFlowResults([revisionRow({ revisionNo: 10 })], 120)

    const page = await listRevisions({ userId: USER_ID }, { itemId: ITEM_ID, limit: 20, offset: 100 })

    expect(revisionsCall().limit).toBe(20)
    expect(revisionsCall().offset).toBe(100)
    expect(page.limit).toBe(20)
    expect(page.offset).toBe(100)
    expect(page.hasMore).toBe(true)
  })

  it('③ 页大小有上限:传入超大 limit 只取 MAX_LIMIT=200', async () => {
    state.results = itemFlowResults([revisionRow()], 1)

    const page = await listRevisions({ userId: USER_ID }, { itemId: ITEM_ID, limit: 10_000 })

    expect(revisionsCall().limit).toBe(200)
    expect(page.limit).toBe(200)
    expect(page.hasMore).toBe(false)
  })

  it('④ 空间流按 created_at 倒序,同样支持 offset', async () => {
    state.results = spaceFlowResults([revisionRow()], 5)

    await listRevisions({ userId: USER_ID }, { spaceId: SPACE_ID, limit: 10, offset: 2 })

    expect(orderKeys()).toEqual(['"team_knowledge_revisions"."created_at" desc'])
    expect(revisionsCall().limit).toBe(10)
    expect(revisionsCall().offset).toBe(2)
  })
})
