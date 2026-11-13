// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SQLWrapper } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const dialect = new PgDialect()

/**
 * F-602 回归锁(2026-11-13)。
 *
 * 病灶:list/count 用完整 where(partition/q/groupKey/conversationId),groups 只按 userId,
 * 于是分组角标数大于当前列表 total ——"列表 0 条但分组显示 10 条"。
 *
 * 本文件锁:
 *   ① partition=archived 时 groups 谓词与 list/count 同口径,角标之和 = total;
 *   ② q 筛选同样进 groups 谓词(含 % 转义);
 *   ③ 无筛选(默认 active)行为不变:角标之和 = total,withGroups=false 仍不返回 groups;
 *   ④ groupKey 维度只出现在 list/count,不回到分面自己的谓词里。
 */
const state = vi.hoisted(() => ({
  wheres: { list: [] as unknown[], count: [] as unknown[], groups: [] as unknown[] },
  rows: [] as unknown[],
  counts: [{ total: 0 }] as { total: number }[],
  groups: [] as { groupKey: string; count: number }[],
}))

type Kind = 'list' | 'count' | 'groups'

function makeApi(kind: Kind) {
  const api: Record<string, unknown> = {
    from: () => api,
    where: (w: unknown) => {
      state.wheres[kind].push(w)
      return api
    },
    orderBy: () => api,
    groupBy: () => api,
    limit: () => api,
    offset: () => api,
    then: (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(
        kind === 'count' ? state.counts : kind === 'groups' ? state.groups : state.rows,
      ).then(res, rej),
  }
  return api
}

vi.mock('../src/db/index.js', () => ({
  db: {
    select: (shape?: unknown) => {
      if (shape && typeof shape === 'object' && 'total' in shape) return makeApi('count')
      if (shape && typeof shape === 'object' && 'groupKey' in shape) return makeApi('groups')
      return makeApi('list')
    },
  },
}))

/** 谓词渲染口径唯一:交给 PgDialect;取不到 getSQL 必须显式报错,否则断言静默通过。 */
function render(condition: unknown): { sql: string; params: unknown[] } {
  const wrapper = condition as SQLWrapper | undefined
  if (!wrapper || typeof wrapper.getSQL !== 'function') {
    throw new Error('where 片段取不到 getSQL ⇒ 判据失效方向必须是显式报错,而不是静默通过')
  }
  const q = dialect.sqlToQuery(wrapper.getSQL())
  return { sql: q.sql, params: q.params as unknown[] }
}

const { listVoiceNotes } = await import('../src/db/voice-note-queries.js')

const USER = '11111111-1111-4111-8111-111111111111'

function sqlOf(kind: Kind): string {
  return state.wheres[kind].map((w) => render(w).sql).join('\n')
}

function paramsOf(kind: Kind): unknown[] {
  return state.wheres[kind].flatMap((w) => render(w).params)
}

function sumOf(groups: { count: number }[] | undefined): number {
  return (groups ?? []).reduce((acc, g) => acc + g.count, 0)
}

beforeEach(() => {
  state.wheres.list.length = 0
  state.wheres.count.length = 0
  state.wheres.groups.length = 0
  state.rows.length = 0
  state.groups.length = 0
  state.counts[0] = { total: 0 }
})

describe('F-602 语音笔记 groups 分面必须与 list/total 同口径', () => {
  it('① 带 partition=archived:groups 谓词含归档分区,角标之和等于 total', async () => {
    state.counts[0] = { total: 2 }
    state.groups = [{ groupKey: 'inbox', count: 2 }]

    const result = await listVoiceNotes(USER, {
      page: 1,
      pageSize: 20,
      partition: 'archived',
      withGroups: true,
    })

    expect(result.total).toBe(2)
    expect(sumOf(result.groups)).toBe(result.total)
    // 旧行为只按 user_id ⇒ 会把 active 的分组也算进角标;现在必须带分区谓词
    expect(sqlOf('groups')).toMatch(/archived_at/i)
    expect(sqlOf('groups')).toMatch(/is not null/i)
    expect(sqlOf('groups')).toBe(sqlOf('count'))
    expect(sqlOf('groups')).toBe(sqlOf('list'))
  })

  it('② 带 q 筛选:关键词检索同样进 groups 谓词(% 仍转义成字面量)', async () => {
    state.counts[0] = { total: 1 }
    state.groups = [{ groupKey: 'lectures', count: 1 }]

    const result = await listVoiceNotes(USER, {
      page: 1,
      pageSize: 20,
      q: '100%',
      withGroups: true,
    })

    expect(sumOf(result.groups)).toBe(result.total)
    expect(sqlOf('groups')).toMatch(/ilike/i)
    expect(sqlOf('groups')).toMatch(/title/i)
    expect(sqlOf('groups')).toMatch(/transcript/i)
    expect(paramsOf('groups').some((p) => typeof p === 'string' && p.includes('\\%'))).toBe(true)
    expect(sqlOf('groups')).toBe(sqlOf('count'))
    expect(sqlOf('groups')).toBe(sqlOf('list'))
  })

  it('③ 无筛选(默认 active):返回结构与角标口径不变,withGroups=false 仍无 groups', async () => {
    state.counts[0] = { total: 5 }
    state.groups = [
      { groupKey: 'inbox', count: 3 },
      { groupKey: 'lectures', count: 2 },
    ]

    const result = await listVoiceNotes(USER, { page: 1, pageSize: 20, withGroups: true })
    expect(result.total).toBe(5)
    expect(result.groups).toEqual([
      { groupKey: 'inbox', count: 3 },
      { groupKey: 'lectures', count: 2 },
    ])
    expect(sumOf(result.groups)).toBe(result.total)
    expect(sqlOf('groups')).toContain('user_id')
    expect(sqlOf('groups')).toMatch(/is null/i)

    state.wheres.groups.length = 0
    const plain = await listVoiceNotes(USER, { page: 1, pageSize: 20 })
    expect(plain.groups).toBeUndefined()
    expect(state.wheres.groups.length).toBe(0)
  })

  it('④ groupKey 维度只在 list/count,不回到分面自己的谓词里', async () => {
    state.counts[0] = { total: 1 }
    state.groups = [
      { groupKey: 'inbox', count: 3 },
      { groupKey: 'lectures', count: 1 },
    ]

    const result = await listVoiceNotes(USER, {
      page: 1,
      pageSize: 20,
      groupKey: 'lectures',
      withGroups: true,
    })

    expect(result.total).toBe(1)
    expect(sqlOf('list')).toMatch(/group_key/i)
    expect(sqlOf('count')).toMatch(/group_key/i)
    expect(sqlOf('groups')).not.toMatch(/group_key/i)
    // 分面仍按 groupKey 分组返回全量分面,而不是被选中维度压成一条
    expect(result.groups?.map((g) => g.groupKey)).toEqual(['inbox', 'lectures'])
  })
})
