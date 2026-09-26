// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 三方合并(diff3 型)纯函数(V3 #66,2026-09-26 立)。
 *
 * 输入 base / ours / theirs 三份文本,产出**逐块**的落差与来源归属,并允许逐块选择来源。
 *
 * 关键取舍(为什么不是"再写一遍 diff"):
 *  - 行级 diff 只有 `@/lib/hunk-diff` 一个真相源。本模块把它当唯一取差出口:
 *    `computeHunkDiff(base, ours)` 与 `computeHunkDiff(base, theirs)` 的 hunk 已经带
 *    **base 侧行区间** `oldStart/oldEnd`,所以"两侧是否改到同一段 base"只需要区间
 *    重叠判断,不需要第三种 diff 算法 —— 这也是它能与 UI 勾选态、patch 导出同源的缘故。
 *  - 两侧改动**纠缠**(区间严格重叠 / 同一插入点各插内容)才归为一块并判冲突;
 *    只是"改到相邻两处"绝不归为一块 —— 把相邻当重叠会把最常见的自动合并形态
 *    报成冲突,三方视图会因此比人工逐行改更难用(该规则由 `entangled()` 单点表达)。
 *  - 冲突块的来源**没有默认值**:`buildMergedContent` 在有未决冲突时返回 `null`,
 *    不猜、不静默偏向某侧(偏向一侧的"看起来成功了"比报红更难查)。
 */

import { computeHunkDiff, detectEol, joinLines, splitLinesWithEol } from './hunk-diff'
import type { DiffHunk, DiffLine } from './hunk-diff'

/**
 * 块型:
 *  - `stable`     三侧一致
 *  - `ours`       仅当前侧改动(可自动取 ours)
 *  - `theirs`     仅传入侧改动(可自动取 theirs)
 *  - `both-same`  两侧改动结果相同(取任一侧)
 *  - `conflict`   两侧改动到同一段 base 且结果不同 —— 必须人裁
 */
export type ThreeWayKind = 'stable' | 'ours' | 'theirs' | 'both-same' | 'conflict'

/** 冲突块的来源选择 */
export type MergeChoice = 'ours' | 'theirs' | 'both'

export interface ThreeWayBlock {
  id: number
  kind: ThreeWayKind
  /** base 侧行区间 [baseStart, baseEnd),0-based 半开 */
  baseStart: number
  baseEnd: number
  base: DiffLine[]
  ours: DiffLine[]
  theirs: DiffLine[]
  changedByOurs: boolean
  changedByTheirs: boolean
}

export interface ThreeWayMerge {
  blocks: ThreeWayBlock[]
  /** 需要人裁的块 id(按出现顺序) */
  conflictIds: number[]
  baseLineCount: number
}

/** 单侧相对 base 的一处改动:base 区间 + 该侧在此区间的结果行 */
interface SideChange {
  start: number
  end: number
  lines: DiffLine[]
}

type TaggedChange = SideChange & { side: 'ours' | 'theirs' }

function toSideChanges(hunks: readonly DiffHunk[]): SideChange[] {
  return hunks.map((h) => ({ start: h.oldStart, end: h.oldEnd, lines: h.newLines }))
}

/** 两侧文本是否逐行等值(只看内容,行尾符已由 hunk-diff 归一到 base 主流行尾) */
function sameLines(a: readonly DiffLine[], b: readonly DiffLine[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i]?.text !== b[i]?.text) return false
  return true
}

/** 把一侧的改动施加到 base 的 [from,to) 区间上,得到该侧在此区间的结果行 */
function applyChanges(baseLines: readonly DiffLine[], from: number, to: number, changes: SideChange[]): DiffLine[] {
  const out: DiffLine[] = []
  let cursor = from
  for (const change of changes) {
    for (let i = cursor; i < change.start; i++) {
      const line = baseLines[i]
      if (line) out.push(line)
    }
    for (const line of change.lines) out.push(line)
    cursor = Math.max(cursor, change.end)
  }
  for (let i = cursor; i < to; i++) {
    const line = baseLines[i]
    if (line) out.push(line)
  }
  return out
}

/**
 * 两处改动是否"纠缠"到必须一起裁决(而非可各自自动合并)。
 *
 * 规则刻意保守但不含糊:
 *  - 两个零宽插入落在**同一插入点** ⇒ 纠缠(谁在前无法机械决定);
 *  - 一侧零宽插入落在另一侧区间的**内部**(严格介于两端)⇒ 纠缠;
 *  - 两侧实区间**严格重叠** ⇒ 纠缠;
 *  - 仅"相接"(一方改到第 n 行、另一方在第 n+1 行起改,或插入点正落在对方区间的
 *    端点上)⇒ **不**纠缠。把相接也判红等于把"改到相邻两处"这种最常见的可自动合并
 *    形态报成冲突,三方视图会因此比人工逐行改更难用。
 */
function entangled(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  const aZero = a.start === a.end
  const bZero = b.start === b.end
  if (aZero && bZero) return a.start === b.start
  if (bZero) return b.start > a.start && b.start < a.end
  if (aZero) return a.start > b.start && a.start < b.end
  return a.start < b.end && b.start < a.end
}

/**
 * 把两侧改动按 base 区间归并成"裁决组"。
 *
 * 输入事件已按 start 升序(两侧各自有序,合并排序后仍有序),一次线性扫描即可。
 * 因为组的起点单调不减,后续 `applyChanges` 不会重放已产出的行。
 */
function groupChanges(oursChanges: SideChange[], theirsChanges: SideChange[]) {
  const events: TaggedChange[] = [
    ...oursChanges.map((c) => ({ ...c, side: 'ours' as const })),
    ...theirsChanges.map((c) => ({ ...c, side: 'theirs' as const })),
  ].sort((a, b) => a.start - b.start)

  const groups: Array<{ start: number; end: number; ours: SideChange[]; theirs: SideChange[] }> = []
  let current: { start: number; end: number; ours: SideChange[]; theirs: SideChange[] } | null = null
  for (const ev of events) {
    const plain: SideChange = { start: ev.start, end: ev.end, lines: ev.lines }
    if (current && entangled(current, plain)) {
      current.end = Math.max(current.end, ev.end)
      current.start = Math.min(current.start, ev.start)
      current[ev.side].push(plain)
      continue
    }
    current = { start: ev.start, end: ev.end, ours: [], theirs: [] }
    current[ev.side].push(plain)
    groups.push(current)
  }
  return groups
}

/**
 * 计算三方合并块序列(纯函数,确定性;不写盘、不改入参)。
 *
 * 复杂度:两次 LCS(两侧各一次)+ 一次线性归并。与 unified 视图同量级。
 */
export function computeThreeWay(base: string, ours: string, theirs: string): ThreeWayMerge {
  const baseLines = splitLinesWithEol(base)
  const oursChanges = toSideChanges(computeHunkDiff(base, ours).hunks)
  const theirsChanges = toSideChanges(computeHunkDiff(base, theirs).hunks)
  const groups = groupChanges(oursChanges, theirsChanges)

  const blocks: ThreeWayBlock[] = []
  let cursor = 0
  const pushStable = (to: number): void => {
    if (to <= cursor) return
    blocks.push({
      id: blocks.length,
      kind: 'stable',
      baseStart: cursor,
      baseEnd: to,
      base: baseLines.slice(cursor, to),
      ours: baseLines.slice(cursor, to),
      theirs: baseLines.slice(cursor, to),
      changedByOurs: false,
      changedByTheirs: false,
    })
    cursor = to
  }

  for (const group of groups) {
    pushStable(group.start)
    const oursLines = applyChanges(baseLines, group.start, group.end, group.ours)
    const theirsLines = applyChanges(baseLines, group.start, group.end, group.theirs)
    const changedByOurs = group.ours.length > 0
    const changedByTheirs = group.theirs.length > 0
    let kind: ThreeWayKind
    if (changedByOurs && changedByTheirs) kind = sameLines(oursLines, theirsLines) ? 'both-same' : 'conflict'
    else if (changedByOurs) kind = 'ours'
    else if (changedByTheirs) kind = 'theirs'
    else kind = 'stable'
    blocks.push({
      id: blocks.length,
      kind,
      baseStart: group.start,
      baseEnd: group.end,
      base: baseLines.slice(group.start, group.end),
      ours: oursLines,
      theirs: theirsLines,
      changedByOurs,
      changedByTheirs,
    })
    cursor = Math.max(cursor, group.end)
  }
  pushStable(baseLines.length)

  return {
    blocks,
    conflictIds: blocks.filter((b) => b.kind === 'conflict').map((b) => b.id),
    baseLineCount: baseLines.length,
  }
}

/**
 * 单块取用行:非冲突块忽略 choice;冲突块未选择 ⇒ `null`(不猜)。
 *
 * `both` 只在冲突块有意义 —— 两段都留下,顺序 ours 在前。
 */
export function resolveBlockLines(block: ThreeWayBlock, choice?: MergeChoice): DiffLine[] | null {
  switch (block.kind) {
    case 'stable':
      return block.base
    case 'ours':
      return block.ours
    case 'theirs':
      return block.theirs
    case 'both-same':
      return block.ours
    case 'conflict':
      if (!choice) return null
      if (choice === 'ours') return block.ours
      if (choice === 'theirs') return block.theirs
      return [...block.ours, ...block.theirs]
    default:
      return null
  }
}

/** 冲突块是否都已选定来源(其余块自动可解) */
export function mergeResolutions(
  merge: ThreeWayMerge,
  choices: ReadonlyMap<number, MergeChoice>,
): { resolved: number; unresolvedIds: number[] } {
  const unresolvedIds: number[] = []
  let resolved = 0
  for (const block of merge.blocks) {
    if (resolveBlockLines(block, choices.get(block.id)) === null) unresolvedIds.push(block.id)
    else resolved++
  }
  return { resolved, unresolvedIds }
}

/**
 * 产出合并后的完整内容;存在未决冲突 ⇒ `null`(调用方须禁用"应用")。
 *
 * 行尾符沿用 base 的主流行尾 —— 合并不得顺手把 CRLF 文件改成 LF。
 */
export function buildMergedContent(
  base: string,
  merge: ThreeWayMerge,
  choices: ReadonlyMap<number, MergeChoice>,
): string | null {
  const eol = detectEol(base)
  const out: DiffLine[] = []
  for (const block of merge.blocks) {
    const lines = resolveBlockLines(block, choices.get(block.id))
    if (lines === null) return null
    for (const line of lines) out.push(line)
  }
  return joinLines(out, eol)
}

/** 批量选择(给「全部采用当前 / 全部采用传入」用):只覆盖冲突块 */
export function chooseAllConflicts(
  merge: ThreeWayMerge,
  choices: ReadonlyMap<number, MergeChoice>,
  choice: MergeChoice,
): Map<number, MergeChoice> {
  const next = new Map(choices)
  for (const id of merge.conflictIds) next.set(id, choice)
  return next
}

/** 逐类计数(展示「N 处可自动合并 / M 处冲突」) */
export function summarizeMerge(merge: ThreeWayMerge): Record<ThreeWayKind, number> {
  const tally: Record<ThreeWayKind, number> = {
    stable: 0,
    ours: 0,
    theirs: 0,
    'both-same': 0,
    conflict: 0,
  }
  for (const block of merge.blocks) tally[block.kind] += 1
  return tally
}

/** 是否存在需要人裁的冲突块 */
export function hasConflicts(merge: ThreeWayMerge): boolean {
  return merge.conflictIds.length > 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
