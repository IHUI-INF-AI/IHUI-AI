// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DB-24（考试域）回归夹具（纯 mock，不连库）。
 *
 * 缺陷：/exam/papers/:examId/chapters 为每个 chapter 单独查一次 exam_chapter_sections，
 * 并与课程详情同样的 per-chapter N+1 组合模式。
 * 断言：批量入口 findSectionListByChapterIds 对任意章数只发 1 条 IN 查询并分桶。
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

import { examChapterSections } from '@ihui/database'
import { findSectionListByChapterIds } from '../../db/exam-extended-queries.js'

describe('DB-24 考试章节小节批量读取', () => {
  beforeEach(() => {
    state.selectCalls = 0
    state.sectionTable = examChapterSections as unknown as Record<string, unknown>
    state.rows = []
  })

  it('多个章节只发 1 条查询并按章节分桶', async () => {
    state.rows = [
      { id: 's1', chapterId: 'c1', sort: 1, questionIds: ['q1', 'q2'] },
      { id: 's2', chapterId: 'c1', sort: 2, questionIds: ['q3'] },
      { id: 's3', chapterId: 'c2', sort: 1, questionIds: [] },
    ]

    const map = await findSectionListByChapterIds(['c1', 'c2', 'c3'])

    expect(state.selectCalls).toBe(1)
    expect(map.get('c1')?.map((s) => s.id)).toEqual(['s1', 's2'])
    expect(map.get('c2')?.map((s) => s.id)).toEqual(['s3'])
    expect(map.get('c3')).toEqual([])
  })

  it('空章节列表不发查询', async () => {
    await findSectionListByChapterIds([])
    expect(state.selectCalls).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
