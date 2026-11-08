// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * DB-24 回归夹具（纯 mock，不连库）。
 *
 * 缺陷：课程详情/章节接口为每个 chapter 单独查一次小节，50 章 = 50 条 SQL。
 * 断言：批量入口 findLessonSectionsByChapterIds 对任意章数只发 1 条 IN 查询，
 * 且按 chapter 分组、组内保持 sortOrder/createdAt 原序。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const state = vi.hoisted(() => ({
  selectCalls: 0,
  sectionTable: null as Record<string, unknown> | null,
  rows: [] as Row[],
}))

vi.mock('../../db/index.js', () => {
  const createChain = () => {
    let rows: Row[] = []
    const chain: Record<string, unknown> = {}
    chain.from = (table: Record<string, unknown>) => {
      rows = table === state.sectionTable ? state.rows : []
      return chain
    }
    chain.where = () => chain
    chain.orderBy = () => chain
    chain.limit = () => chain
    chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(onFulfilled, onRejected)
    return chain
  }
  return {
    db: {
      select: vi.fn(() => {
        state.selectCalls += 1
        return createChain()
      }),
    },
  }
})

import { lessonChapterSections } from '@ihui/database'
import { findLessonSectionsByChapterIds } from '../../db/learn-queries.js'

describe('DB-24 章节小节批量读取', () => {
  beforeEach(() => {
    state.selectCalls = 0
    state.sectionTable = lessonChapterSections as unknown as Record<string, unknown>
    state.rows = []
  })

  it('多个章节只发 1 条查询并按章节分桶', async () => {
    state.rows = [
      { id: 'a1', chapterId: 'c1', sortOrder: 1, createdAt: '2026-01-01' },
      { id: 'a2', chapterId: 'c1', sortOrder: 2, createdAt: '2026-01-02' },
      { id: 'b1', chapterId: 'c2', sortOrder: 1, createdAt: '2026-01-03' },
    ]

    const map = await findLessonSectionsByChapterIds(['c1', 'c2', 'c3'])

    expect(state.selectCalls).toBe(1)
    expect(map.get('c1')?.map((s) => s.id)).toEqual(['a1', 'a2'])
    expect(map.get('c2')?.map((s) => s.id)).toEqual(['b1'])
    // 没有小节的章节返回空数组而不是 undefined
    expect(map.get('c3')).toEqual([])
  })

  it('空章节列表不发查询', async () => {
    await findLessonSectionsByChapterIds([])
    expect(state.selectCalls).toBe(0)
  })
})
