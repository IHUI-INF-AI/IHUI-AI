// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// SDB-21：CTR 的 served 与 clicked 曾经是两条逐字相同的查询（clicked 侧漏了 clicked = true），
// 只要 total>0 就恒等于 1，低 CTR 告警与健康摘要全部失真。
// 这里用假 db 对内存行求值：eq/and 被换成描述符，where 条件真正参与过滤，
// 因此「两条查询条件相同」会直接表现为 ctr=1 而不是 0.3，测试即红。
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as DrizzleOrm from 'drizzle-orm'

type Row = { contentId: string; clicked: boolean }
type Cond =
  | { op: 'eq'; col: string; value: unknown }
  | { op: 'and'; conds: Cond[] }

const state = vi.hoisted(() => ({ rows: [] as Row[], conds: [] as Cond[] }))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleOrm>()
  return {
    ...actual,
    eq: (col: unknown, value: unknown): Cond => ({ op: 'eq', col: String(col), value }),
    and: (...conds: Cond[]): Cond => ({ op: 'and', conds }),
  }
})

vi.mock('@ihui/database', () => ({
  tourContent: {
    id: 'tourContent.id',
    viewCount: 'tourContent.viewCount',
    likeCount: 'tourContent.likeCount',
    status: 'tourContent.status',
    releaseStage: 'tourContent.releaseStage',
  },
  tourRecommendations: {
    contentId: 'tourRecommendations.contentId',
    clicked: 'tourRecommendations.clicked',
  },
}))

vi.mock('../src/db/index.js', () => {
  const builder = {
    from: () => builder,
    where: (cond: Cond) => {
      state.conds.push(cond)
      return Promise.resolve([{ count: state.rows.filter((r) => matches(cond, r)).length }])
    },
  }
  return { db: { select: () => builder }, dbRead: {}, dbClient: {} }
})

import { computeAndReportCtr } from '../src/services/tour/tour-monitoring.js'

/** 条件求值：列名取描述符末段（如 contentId / clicked）映射到内存行字段。 */
function matches(cond: Cond, row: Row): boolean {
  if (cond.op === 'and') return cond.conds.every((c) => matches(c, row))
  const field = cond.col.split('.').at(-1) ?? ''
  return (row as Record<string, unknown>)[field] === cond.value
}

/** 造 served 条推荐，其中 clickedCount 条已点击。 */
function rows(contentId: string, served: number, clickedCount: number): Row[] {
  return Array.from({ length: served }, (_, i) => ({ contentId, clicked: i < clickedCount }))
}

describe('SDB-21 CTR 分子只统计已点击的推荐', () => {
  beforeEach(() => {
    state.rows = []
    state.conds = []
  })

  it('served=10 / clicked=3 ⇒ ctr=0.3', async () => {
    state.rows = rows('c1', 10, 3)
    await expect(computeAndReportCtr('c1')).resolves.toBeCloseTo(0.3)
  })

  it('clicked=0 ⇒ ctr=0', async () => {
    state.rows = rows('c1', 10, 0)
    await expect(computeAndReportCtr('c1')).resolves.toBe(0)
  })

  it('served=0 ⇒ ctr=0（既有语义保持不变）', async () => {
    await expect(computeAndReportCtr('c1')).resolves.toBe(0)
  })

  it('两条查询的 where 条件不同，且 clicked 侧带 clicked = true', async () => {
    state.rows = rows('c1', 10, 3)
    await computeAndReportCtr('c1')

    expect(state.conds).toHaveLength(2)
    expect(state.conds[0]).not.toEqual(state.conds[1])
    // 若实现退回「两条一样的查询」，这里找不到 clicked 条件，直接红
    const clickedCond = state.conds.find((c) => JSON.stringify(c).includes('clicked'))
    expect(clickedCond).toBeTruthy()
    expect(JSON.stringify(clickedCond)).toContain('true')
  })
})
