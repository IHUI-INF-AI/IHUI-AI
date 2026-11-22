// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Diff 行 → unified / side-by-side 两种排版的**纯投影**(V3 #66,2026-09-26 立)。
 *
 * 为什么单独一层:行级 diff 算法只有一个真相源 `@/lib/hunk-diff`(LCS + hunk 切分),
 * 而"同一份 rows 怎么摆到一栏 / 两栏"是**排版**问题。此前 chat 面自己 map rows、
 * IDE split 面自己 grid 两列、IDE unified 面更是拿 `旧行[i] vs 新行[i]` 假 diff
 * (见 diff-viewer-pane 的 generateUnifiedDiff),三处各写一遍且互不对齐 ——
 * 本模块把排版收成一份,两个渲染面都只是它的消费者。
 *
 * 三条不可动摇的判据(单测逐条钉死):
 *  1. **配对**:同一变更段内第 k 条删除与第 k 条新增落在**同一行**左右两格;
 *     多出来的那一侧留 `null` 占位(渲染为空格,行高不塌)。
 *  2. **对齐**:equal 行左右同格;两栏行序逐条同序,不存在"左右各数各的"。
 *  3. **折叠**:仅折叠**两个变更段之间**的 equal 段(跨 hunk),首尾各留
 *     `contextLines` 行;折叠块携带被隐去的 rows,渲染面可就地展开。
 *     `contextLines: 0` ⇒ 内部 equal 段整块收起;`Infinity` ⇒ 不折叠。
 */

import type { DiffLine, DiffRow, HunkDiff } from './hunk-diff'

/** 单元格 = 一侧的一行(行号 1-based) */
export interface SplitCell {
  num: number
  text: string
}

/** 折叠块:被隐去的 equal 行 + 展示用起点 */
export interface FoldInfo {
  /** 隐去行数 */
  skipped: number
  /** 旧文件侧起始行号(1-based) */
  oldStart: number
  /** 新文件侧起始行号(1-based) */
  newStart: number
  /** 被隐去的原始 rows(供就地展开) */
  elided: DiffRow[]
}

export type SplitEntry =
  | { kind: 'row'; hunkId: number | null; left: SplitCell | null; right: SplitCell | null }
  | { kind: 'fold'; fold: FoldInfo }

export type UnifiedEntry =
  | { kind: 'row'; hunkId: number | null; row: DiffRow }
  | { kind: 'fold'; fold: FoldInfo }

/** 与 git diff 默认上下文一致 */
export const DEFAULT_CONTEXT_LINES = 3

export interface LayoutOptions {
  /** 折叠段两侧各保留的上下文行数;`Infinity` 关闭折叠 */
  contextLines?: number
}

/** 半开行段 [start, end) —— 只在 planFoldBands 内部流转 */
interface Band {
  start: number
  end: number
}

function cellFrom(row: DiffRow | undefined, side: 'old' | 'new'): SplitCell | null {
  if (!row) return null
  const line: DiffLine | undefined = side === 'old' ? row.oldLine : row.newLine
  const num = side === 'old' ? row.oldNum : row.newNum
  if (!line || num === undefined) return null
  return { num, text: line.text }
}

function foldInfoFor(rows: readonly DiffRow[], band: Band): FoldInfo {
  const elided = rows.slice(band.start, band.end)
  const first = elided[0]
  return {
    skipped: elided.length,
    oldStart: first?.oldNum ?? 0,
    newStart: first?.newNum ?? 0,
    elided,
  }
}

/**
 * 规划折叠段:返回 `折叠起始行下标 → 区间` 的映射。
 *
 * 刻意只折叠**内部** equal 段(前面有改动、后面也有改动)。文件首尾的上下文
 * 折叠掉不省地方,只会让人怀疑"上面是不是还有改动没显示"。
 */
function planFoldBands(rows: readonly DiffRow[], contextLines: number): Map<number, Band> {
  const bands = new Map<number, Band>()
  if (!Number.isFinite(contextLines) || contextLines < 0) return bands
  let runStart = -1
  for (let i = 0; i <= rows.length; i++) {
    const isEqual = i < rows.length && rows[i]?.op === 'equal'
    if (isEqual) {
      if (runStart === -1) runStart = i
      continue
    }
    if (runStart === -1) continue
    const runEnd = i
    const interior = runStart > 0 && runEnd < rows.length
    if (interior && runEnd - runStart > contextLines * 2) {
      bands.set(runStart + contextLines, { start: runStart + contextLines, end: runEnd - contextLines })
    }
    runStart = -1
  }
  return bands
}

/** 取一个变更段的 hunk id(同一 maximal 非 equal 段必属同一 hunk;取首行) */
function segmentHunkId(hunkIdByRow: ReadonlyArray<number | null>, start: number): number | null {
  return hunkIdByRow[start] ?? null
}

/**
 * side-by-side 排版:左右两栏逐格对齐。
 *
 * `diff` 为 `computeHunkDiff(old, new)` 的结果 —— 与 chat 卡片、patch 导出同一算法源。
 */
export function toSplitEntries(diff: HunkDiff, options: LayoutOptions = {}): SplitEntry[] {
  const rows = diff.rows
  const contextLines = options.contextLines ?? DEFAULT_CONTEXT_LINES
  const bands = planFoldBands(rows, contextLines)
  const out: SplitEntry[] = []
  let i = 0
  while (i < rows.length) {
    const band = bands.get(i)
    if (band) {
      out.push({ kind: 'fold', fold: foldInfoFor(rows, band) })
      i = band.end
      continue
    }
    const row = rows[i]
    if (!row) break
    if (row.op === 'equal') {
      out.push({
        kind: 'row',
        hunkId: null,
        left: cellFrom(row, 'old'),
        right: cellFrom(row, 'new'),
      })
      i++
      continue
    }
    const start = i
    while (i < rows.length && rows[i]?.op !== 'equal') i++
    const segment = rows.slice(start, i)
    const hunkId = segmentHunkId(diff.hunkIdByRow, start)
    const deletes = segment.filter((r) => r.op === 'delete')
    const inserts = segment.filter((r) => r.op === 'insert')
    const pairCount = Math.max(deletes.length, inserts.length)
    for (let k = 0; k < pairCount; k++) {
      out.push({
        kind: 'row',
        hunkId,
        left: cellFrom(deletes[k], 'old'),
        right: cellFrom(inserts[k], 'new'),
      })
    }
  }
  return out
}

/**
 * unified 排版:保持 rows 原始顺序(与 hunk 勾选态一一对应),只做折叠。
 *
 * 刻意**不**复用 toSplitEntries 再压平 —— 配对会把"先删后增"重排成"删增交替",
 * 那会让行号列与 HunkHeader 的区间标注对不上。两者共享同一份折叠规划。
 */
export function toUnifiedEntries(diff: HunkDiff, options: LayoutOptions = {}): UnifiedEntry[] {
  const rows = diff.rows
  const contextLines = options.contextLines ?? DEFAULT_CONTEXT_LINES
  const bands = planFoldBands(rows, contextLines)
  const out: UnifiedEntry[] = []
  let i = 0
  while (i < rows.length) {
    const band = bands.get(i)
    if (band) {
      out.push({ kind: 'fold', fold: foldInfoFor(rows, band) })
      i = band.end
      continue
    }
    const row = rows[i]
    if (!row) break
    out.push({ kind: 'row', hunkId: diff.hunkIdByRow[i] ?? null, row })
    i++
  }
  return out
}

/** 行内容取用(unified 面):insert 取新行,其余取旧行 */
export function unifiedRowText(row: DiffRow): string {
  return (row.op === 'insert' ? row.newLine?.text : row.oldLine?.text) ?? ''
}

/** 行号(unified 面):与行级评论锚定口径一致 —— 优先新行号,纯删除退回旧行号 */
export function unifiedRowLineNo(row: DiffRow): number | undefined {
  return row.newNum ?? row.oldNum
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
