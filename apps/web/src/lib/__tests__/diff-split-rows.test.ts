// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * V3 #66 判据 2:side-by-side 排版在**真实 diff 数据**上的形态断言。
 *
 * 覆盖的形态(刻意不止"最顺的那种"):
 *  上下文行 / 纯新增 / 纯删除 / 删除多于新增 / 新增多于删除 /
 *  两个 hunk 之间的跨段折叠 / 文件首尾不折叠 / contextLines=0 与 Infinity /
 *  空文件 / 单侧空 / 不丢行不重行的左右两侧全等重建。
 */

import { describe, expect, it } from 'vitest'
import { computeHunkDiff } from '../hunk-diff'
import {
  toSplitEntries,
  toUnifiedEntries,
  unifiedRowLineNo,
  unifiedRowText,
  type SplitEntry,
} from '../diff-split-rows'

function lines(...xs: string[]): string {
  return xs.length === 0 ? '' : `${xs.join('\n')}\n`
}

function ctx(prefix: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`)
}

/** 折叠条目(按出现顺序) */
function folds(entries: SplitEntry[]): SplitEntry[] {
  return entries.filter((e) => e.kind === 'fold')
}

/** 左栏重建旧文件行序列(含折叠块内被隐去的行) */
function leftSequence(entries: SplitEntry[]): string[] {
  const out: string[] = []
  for (const entry of entries) {
    if (entry.kind === 'fold') {
      for (const row of entry.fold.elided) if (row.oldLine) out.push(row.oldLine.text)
      continue
    }
    if (entry.left) out.push(entry.left.text)
  }
  return out
}

/** 右栏重建新文件行序列 */
function rightSequence(entries: SplitEntry[]): string[] {
  const out: string[] = []
  for (const entry of entries) {
    if (entry.kind === 'fold') {
      for (const row of entry.fold.elided) if (row.newLine) out.push(row.newLine.text)
      continue
    }
    if (entry.right) out.push(entry.right.text)
  }
  return out
}

/** 两侧都非空的行数(= 上下文 + 已配对的改动) */
function pairedRowCount(entries: SplitEntry[]): number {
  return entries.filter((e) => e.kind === 'row' && e.left && e.right).length
}

/** 只有一侧有内容的行数(= 未配对的纯增/纯删) */
function singleSideCount(entries: SplitEntry[]): number {
  return entries.filter((e) => e.kind === 'row' && Boolean(e.left) !== Boolean(e.right)).length
}

const CTX_OLD = lines(...ctx('A', 3), 'o1', ...ctx('E', 10), 'o2', ...ctx('B', 3))
const CTX_NEW = lines(...ctx('A', 3), 'n1', ...ctx('E', 10), 'n2', ...ctx('B', 3))

describe('diff-split-rows:两栏配对形态', () => {
  it('上下文行:左右同格、行号各取各侧', () => {
    const entries = toSplitEntries(computeHunkDiff(lines('a', 'b', 'c'), lines('a', 'B', 'c')))
    const first = entries[0]
    expect(first?.kind).toBe('row')
    if (first?.kind !== 'row') return
    expect(first.left).toEqual({ num: 1, text: 'a' })
    expect(first.right).toEqual({ num: 1, text: 'a' })
  })

  it('纯新增行:左格为 null(占位),右格带新行号', () => {
    const entries = toSplitEntries(computeHunkDiff(lines('a'), lines('a', 'b')))
    const last = entries[entries.length - 1]
    expect(last?.kind).toBe('row')
    if (last?.kind !== 'row') return
    expect(last.left).toBeNull()
    expect(last.right).toEqual({ num: 2, text: 'b' })
  })

  it('纯删除行:右格为 null,左格带旧行号', () => {
    const entries = toSplitEntries(computeHunkDiff(lines('a', 'b'), lines('a')))
    const last = entries[entries.length - 1]
    if (last?.kind !== 'row') throw new Error('expect row')
    expect(last.left).toEqual({ num: 2, text: 'b' })
    expect(last.right).toBeNull()
  })

  it('删 2 增 3:产出 3 行,第 3 行左格为空(新增多于删除不被压扁)', () => {
    const entries = toSplitEntries(
      computeHunkDiff(lines('A', 'd1', 'd2', 'B'), lines('A', 'i1', 'i2', 'i3', 'B')),
    )
    const change = entries.filter((e) => e.kind === 'row' && e.hunkId !== null)
    expect(change).toHaveLength(3)
    const [r0, r1, r2] = change
    if (r0?.kind !== 'row' || r1?.kind !== 'row' || r2?.kind !== 'row') throw new Error('shape')
    expect([r0.left?.text, r0.right?.text]).toEqual(['d1', 'i1'])
    expect([r1.left?.text, r1.right?.text]).toEqual(['d2', 'i2'])
    expect(r2.left).toBeNull()
    expect(r2.right?.text).toBe('i3')
    // 同段三行的 hunkId 必须一致(否则小标题会被重复插入)
    expect(new Set(change.map((e) => (e.kind === 'row' ? e.hunkId : null))).size).toBe(1)
  })

  it('删 3 增 1:产出 3 行,后两行右格为空(删除多于新增不丢行)', () => {
    const entries = toSplitEntries(
      computeHunkDiff(lines('A', 'd1', 'd2', 'd3', 'B'), lines('A', 'i1', 'B')),
    )
    const change = entries.filter((e) => e.kind === 'row' && e.hunkId !== null)
    expect(change).toHaveLength(3)
    expect(change.map((e) => (e.kind === 'row' ? e.left?.text : undefined))).toEqual([
      'd1',
      'd2',
      'd3',
    ])
    expect(change.map((e) => (e.kind === 'row' ? (e.right ? e.right.text : null) : undefined))).toEqual([
      'i1',
      null,
      null,
    ])
  })

  it('左右两栏各自完整重建源文件(不丢行、不重行、不乱序)', () => {
    for (const [oldC, newC] of [
      [CTX_OLD, CTX_NEW],
      [lines('a', 'b', 'c'), lines('a', 'B', 'c')],
      [lines('x'), lines('x', 'y', 'z')],
      [lines('x', 'y', 'z'), lines('x')],
      ['', lines('only')],
      [lines('only'), ''],
    ] as const) {
      const entries = toSplitEntries(computeHunkDiff(oldC, newC), { contextLines: Infinity })
      const src = (s: string) => (s === '' ? [] : s.trimEnd().split('\n'))
      expect(leftSequence(entries)).toEqual(src(oldC))
      expect(rightSequence(entries)).toEqual(src(newC))
    }
  })
})

describe('diff-split-rows:跨 hunk 折叠', () => {
  it('两个 hunk 之间的长上下文被折成一条,行数与首号正确', () => {
    const entries = toSplitEntries(computeHunkDiff(CTX_OLD, CTX_NEW))
    const foldList = folds(entries)
    expect(foldList).toHaveLength(1)
    const foldEntry = foldList[0]
    if (foldEntry?.kind !== 'fold') throw new Error('expect fold')
    // 10 行等值段,首尾各留 3 ⇒ 隐去 4 行,起点为 E4
    expect(foldEntry.fold.skipped).toBe(4)
    expect(foldEntry.fold.elided.map((r) => r.oldLine?.text)).toEqual(['E4', 'E5', 'E6', 'E7'])
    expect(foldEntry.fold.oldStart).toBe(4 + 3 + 1)
    expect(foldEntry.fold.newStart).toBe(4 + 3 + 1)
  })

  it('折叠后仍可完整重建两侧(折叠不是丢内容)', () => {
    const entries = toSplitEntries(computeHunkDiff(CTX_OLD, CTX_NEW))
    const src = (s: string) => s.trimEnd().split('\n')
    expect(leftSequence(entries)).toEqual(src(CTX_OLD))
    expect(rightSequence(entries)).toEqual(src(CTX_NEW))
  })

  it('文件首/尾的长上下文不折叠(没有"段间"可言)', () => {
    const head = toSplitEntries(computeHunkDiff(lines(...ctx('H', 12), 'x'), lines(...ctx('H', 12), 'y')))
    expect(folds(head)).toHaveLength(0)
    const tail = toSplitEntries(computeHunkDiff(lines('x', ...ctx('T', 12)), lines('y', ...ctx('T', 12))))
    expect(folds(tail)).toHaveLength(0)
  })

  it('contextLines=Infinity 关闭折叠;=0 把整段等值收进去', () => {
    const off = toSplitEntries(computeHunkDiff(CTX_OLD, CTX_NEW), { contextLines: Infinity })
    expect(folds(off)).toHaveLength(0)
    const tight = toSplitEntries(computeHunkDiff(CTX_OLD, CTX_NEW), { contextLines: 0 })
    const foldList = folds(tight)
    expect(foldList).toHaveLength(1)
    if (foldList[0]?.kind !== 'fold') throw new Error('expect fold')
    expect(foldList[0].fold.skipped).toBe(10)
  })

  it('短上下文(≤2×context)不折叠,不产出空折叠条', () => {
    const entries = toSplitEntries(computeHunkDiff(lines('A', 'x', 'B', 'C', 'y'), lines('A', 'X', 'B', 'C', 'Y')))
    expect(folds(entries)).toHaveLength(0)
  })

  it('折叠条目不带 hunkId(它不属于任何变更段)', () => {
    const entries = toSplitEntries(computeHunkDiff(CTX_OLD, CTX_NEW))
    for (const f of folds(entries)) expect(f.kind).toBe('fold')
  })
})

describe('diff-split-rows:unified 投影与 split 共享同一份折叠规划', () => {
  it('unified 的可见行 + 折叠行逐条等于 diff.rows(顺序不被重排)', () => {
    const diff = computeHunkDiff(CTX_OLD, CTX_NEW)
    const entries = toUnifiedEntries(diff)
    const flattened = entries.flatMap((e) => (e.kind === 'fold' ? e.fold.elided : [e.row]))
    expect(flattened).toEqual(diff.rows)
  })

  it('同一内容下 unified 与 split 的折叠数与隐去行数一致', () => {
    const diff = computeHunkDiff(CTX_OLD, CTX_NEW)
    const uFolds = toUnifiedEntries(diff).filter((e) => e.kind === 'fold')
    const sFolds = toSplitEntries(diff).filter((e) => e.kind === 'fold')
    expect(uFolds).toHaveLength(sFolds.length)
    expect(uFolds.map((e) => (e.kind === 'fold' ? e.fold.skipped : 0))).toEqual(
      sFolds.map((e) => (e.kind === 'fold' ? e.fold.skipped : 0)),
    )
  })

  it('unified 保留两侧行号(旧行号列与新行号列各占一格)', () => {
    const entries = toUnifiedEntries(computeHunkDiff(lines('a', 'b'), lines('a', 'B', 'c')))
    const del = entries.find((e) => e.kind === 'row' && e.row.op === 'delete')
    const ins = entries.find((e) => e.kind === 'row' && e.row.op === 'insert')
    if (del?.kind !== 'row' || ins?.kind !== 'row') throw new Error('expect both rows')
    expect(del.row.oldNum).toBe(2)
    expect(del.row.newNum).toBeUndefined()
    expect(ins.row.newNum).toBe(2)
  })
})

describe('diff-split-rows:行文本/行号取用口径', () => {
  it('unifiedRowText 对 insert 取新行,其余取旧行', () => {
    const diff = computeHunkDiff(lines('a', 'b'), lines('a', 'B'))
    const ins = diff.rows.find((r) => r.op === 'insert')
    const del = diff.rows.find((r) => r.op === 'delete')
    if (!ins || !del) throw new Error('fixture')
    expect(unifiedRowText(ins)).toBe('B')
    expect(unifiedRowText(del)).toBe('b')
  })

  it('unifiedRowLineNo 优先新行号,纯删除退回旧行号', () => {
    const diff = computeHunkDiff(lines('a', 'b'), lines('a', 'B'))
    const ins = diff.rows.find((r) => r.op === 'insert')
    const del = diff.rows.find((r) => r.op === 'delete')
    if (!ins || !del) throw new Error('fixture')
    expect(unifiedRowLineNo(ins)).toBe(2)
    expect(unifiedRowLineNo(del)).toBe(2)
  })

  it('配对行与单侧行的计数与形态一致(渲染面据此决定占位格数)', () => {
    const entries = toSplitEntries(computeHunkDiff(lines('A', 'd1', 'd2', 'B'), lines('A', 'i1', 'B')))
    expect(singleSideCount(entries)).toBe(1) // d2 那一行右格为空
    expect(pairedRowCount(entries)).toBe(3) // A、(d1,i1)、B
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
