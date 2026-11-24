// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 统一 diff 渲染预算(2026-09-30 立,吸收批次 74 W1 票 G-977994)。
 *
 * 纯函数、不绑任何渲染库:输入 before/after 文本,输出结构化 hunks 数组;
 * 另提供手拼 unified patch 文本的出口(自带头部边界)。
 *
 * 机制(吸收自上游统一 diff 渲染预算):
 *  - LCS DP 矩阵超 60k cell 降级——直接整段「全删+全增」会把夹在中间的大量未改内容
 *    渲染成红绿大块;改用「两侧各只出现一次」的唯一行做 LIS 锚点,把大区间拆成多个小段
 *    递归回正常 diff,保留真实 hunk 边界;锚点全无(真·大面积重写)才整段全删全增;
 *  - context 预裁剪——先按 contextLines 截掉公共前后缀、只取改动两侧窗口,再进 diff/拼串;
 *    不预裁的话几千行只改 1 行的大文件会把整份公共区拼进 patch,主线程做大量无效字符串拼接;
 *  - 手拼 unified diff 必须补 `diff --git` 边界头——删除行正文(如 SQL 注释 `-- x`)
 *    恰好生成 `--- x` 形态的行,没有边界头会被解析器误判成第二个文件;
 *    新建/删除文件用 /dev/null 表示不存在的一侧,让解析器走新增/删除语义。
 *
 * 行模型:按 `\n` 切分(与手拼 patch 同一模型,CRLF 输入由调用方先归一)。
 */

/** LCS 动态规划格子数上限,超出走唯一行锚点拆段 */
export const MAX_DIFF_LCS_CELLS = 60_000

export type BudgetedDiffOp = 'equal' | 'insert' | 'delete'

export interface BudgetedDiffRow {
  op: BudgetedDiffOp
  text: string
  /** 0-based 旧文件行号(equal/delete 行携带) */
  oldIndex?: number
  /** 0-based 新文件行号(equal/insert 行携带) */
  newIndex?: number
}

export interface BudgetedDiffHunk {
  /** unified 语义 1-based 起始行;纯插入 hunk 的 oldStart 是插入点前一行(文件头插入为 0) */
  oldStart: number
  newStart: number
  oldCount: number
  newCount: number
  rows: BudgetedDiffRow[]
}

export interface BudgetedDiff {
  hunks: BudgetedDiffHunk[]
  /** 大区间走了「唯一行 LIS 锚点拆段」路径 */
  usedAnchorFallback: boolean
  /** 某个区间找不到任何唯一行锚点,退化成整段全删全增(最劣路径) */
  usedWholeBlockFallback: boolean
}

export interface BudgetedDiffOptions {
  /** hunk 两侧保留的上下文行数;不传 = 全量上下文(整个差异区并为一个 hunk) */
  contextLines?: number
}

interface LineMatch {
  beforeIndex: number
  afterIndex: number
}

interface BudgetState {
  usedAnchorFallback: boolean
  usedWholeBlockFallback: boolean
}

function splitDiffLines(text: string): string[] {
  return text.length === 0 ? [] : text.split('\n')
}

/** contextLines 非法(负数/非有限)视为未限制;否则取整下界 0 */
function resolveContextLimit(contextLines: number | undefined): number | null {
  if (typeof contextLines !== 'number' || !Number.isFinite(contextLines) || contextLines < 0) {
    return null
  }
  return Math.max(0, Math.floor(contextLines))
}

function countSharedPrefix(before: readonly string[], after: readonly string[]): number {
  const max = Math.min(before.length, after.length)
  let index = 0
  while (index < max && before[index] === after[index]) {
    index += 1
  }
  return index
}

function countSharedSuffix(
  before: readonly string[],
  after: readonly string[],
  sharedPrefix: number,
): number {
  const max = Math.min(before.length, after.length) - sharedPrefix
  let offset = 0
  while (
    offset < max &&
    before[before.length - 1 - offset] === after[after.length - 1 - offset]
  ) {
    offset += 1
  }
  return offset
}

/**
 * 收集「两侧各只出现一次」的行配对:这类配对是唯一可信的对齐锚点,
 * 重复出现的行无法证明对应关系,不进锚点集合。结果按 beforeIndex 升序。
 */
function collectUniqueLineMatches(
  before: readonly string[],
  after: readonly string[],
): LineMatch[] {
  const beforeSeen = new Map<string, { count: number; firstIndex: number }>()
  const afterSeen = new Map<string, { count: number; firstIndex: number }>()

  for (let index = 0; index < before.length; index += 1) {
    const line = before[index]!
    const seen = beforeSeen.get(line)
    if (seen) {
      seen.count += 1
      continue
    }
    beforeSeen.set(line, { count: 1, firstIndex: index })
  }
  for (let index = 0; index < after.length; index += 1) {
    const line = after[index]!
    const seen = afterSeen.get(line)
    if (seen) {
      seen.count += 1
      continue
    }
    afterSeen.set(line, { count: 1, firstIndex: index })
  }

  const matches: LineMatch[] = []
  for (const [line, beforeOccurrence] of beforeSeen) {
    const afterOccurrence = afterSeen.get(line)
    if (beforeOccurrence.count !== 1 || afterOccurrence?.count !== 1) {
      continue
    }
    matches.push({
      beforeIndex: beforeOccurrence.firstIndex,
      afterIndex: afterOccurrence.firstIndex,
    })
  }
  matches.sort((left, right) => left.beforeIndex - right.beforeIndex)
  return matches
}

/**
 * patience 风格:对唯一行配对按 afterIndex 求最长递增子序列(LIS),
 * 保证选出的锚点在两侧都单调,可以作为分段切点。
 */
function findIncreasingAnchors(matches: readonly LineMatch[]): LineMatch[] {
  if (matches.length === 0) {
    return []
  }

  const predecessors = new Array<number>(matches.length).fill(-1)
  const pileTops: number[] = []

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]!
    let low = 0
    let high = pileTops.length
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (matches[pileTops[middle]!]!.afterIndex < match.afterIndex) {
        low = middle + 1
      } else {
        high = middle
      }
    }
    if (low > 0) {
      predecessors[index] = pileTops[low - 1]!
    }
    pileTops[low] = index
  }

  const anchors: LineMatch[] = []
  let cursor = pileTops[pileTops.length - 1]!
  while (cursor >= 0) {
    anchors.push(matches[cursor]!)
    cursor = predecessors[cursor]!
  }
  return anchors.reverse()
}

/** 经典 LCS 动态规划回溯(仅在格子数预算内调用);同分先删后插,删除块聚在新增块前 */
function appendLcsRows(
  out: BudgetedDiffRow[],
  before: readonly string[],
  after: readonly string[],
  beforeOffset: number,
  afterOffset: number,
): void {
  const m = before.length
  const n = after.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      dp[i]![j] =
        before[i] === after[j]
          ? (dp[i + 1]![j + 1] ?? 0) + 1
          : Math.max(dp[i + 1]![j] ?? 0, dp[i]![j + 1] ?? 0)
    }
  }

  let i = 0
  let j = 0
  while (i < m || j < n) {
    const beforeLine = before[i]
    const afterLine = after[j]

    if (beforeLine !== undefined && afterLine !== undefined && beforeLine === afterLine) {
      out.push({
        op: 'equal',
        text: beforeLine,
        oldIndex: beforeOffset + i,
        newIndex: afterOffset + j,
      })
      i += 1
      j += 1
      continue
    }
    if (beforeLine === undefined) {
      out.push({ op: 'insert', text: afterLine!, newIndex: afterOffset + j })
      j += 1
      continue
    }
    if (afterLine === undefined) {
      out.push({ op: 'delete', text: beforeLine, oldIndex: beforeOffset + i })
      i += 1
      continue
    }
    if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      out.push({ op: 'delete', text: beforeLine, oldIndex: beforeOffset + i })
      i += 1
    } else {
      out.push({ op: 'insert', text: afterLine!, newIndex: afterOffset + j })
      j += 1
    }
  }
}

function pushAllInserts(
  out: BudgetedDiffRow[],
  after: readonly string[],
  afterOffset: number,
): void {
  after.forEach((line, j) => {
    out.push({ op: 'insert', text: line, newIndex: afterOffset + j })
  })
}

function pushAllDeletes(
  out: BudgetedDiffRow[],
  before: readonly string[],
  beforeOffset: number,
): void {
  before.forEach((line, i) => {
    out.push({ op: 'delete', text: line, oldIndex: beforeOffset + i })
  })
}

/**
 * 带预算的行级 diff:区间超 60k cell 时用唯一行锚点拆段递归,
 * 锚点全无才整段全删全增(此时红绿大块是事实,不是渲染缺陷)。
 */
function appendBudgetedRows(
  out: BudgetedDiffRow[],
  before: readonly string[],
  after: readonly string[],
  beforeOffset: number,
  afterOffset: number,
  state: BudgetState,
): void {
  if (before.length === 0) {
    pushAllInserts(out, after, afterOffset)
    return
  }
  if (after.length === 0) {
    pushAllDeletes(out, before, beforeOffset)
    return
  }

  if (before.length * after.length > MAX_DIFF_LCS_CELLS) {
    const anchors = findIncreasingAnchors(collectUniqueLineMatches(before, after))
    if (anchors.length === 0) {
      state.usedWholeBlockFallback = true
      pushAllDeletes(out, before, beforeOffset)
      pushAllInserts(out, after, afterOffset)
      return
    }

    state.usedAnchorFallback = true
    let prevBefore = 0
    let prevAfter = 0
    for (const anchor of anchors) {
      appendBudgetedRows(
        out,
        before.slice(prevBefore, anchor.beforeIndex),
        after.slice(prevAfter, anchor.afterIndex),
        beforeOffset + prevBefore,
        afterOffset + prevAfter,
        state,
      )
      out.push({
        op: 'equal',
        text: before[anchor.beforeIndex]!,
        oldIndex: beforeOffset + anchor.beforeIndex,
        newIndex: afterOffset + anchor.afterIndex,
      })
      prevBefore = anchor.beforeIndex + 1
      prevAfter = anchor.afterIndex + 1
    }
    appendBudgetedRows(
      out,
      before.slice(prevBefore),
      after.slice(prevAfter),
      beforeOffset + prevBefore,
      afterOffset + prevAfter,
      state,
    )
    return
  }

  appendLcsRows(out, before, after, beforeOffset, afterOffset)
}

function buildHunk(
  rows: readonly BudgetedDiffRow[],
  start: number,
  end: number,
  oldBefore: readonly number[],
  newBefore: readonly number[],
): BudgetedDiffHunk {
  const first = rows[start]!
  // unified 语义:首行带旧内容 → 起始行 = 之前已消费行数 + 1;纯插入 → 插入点 = 已消费行数(可为 0)
  const oldStart = first.op === 'insert' ? oldBefore[start]! : oldBefore[start]! + 1
  const newStart = first.op === 'delete' ? newBefore[start]! : newBefore[start]! + 1
  const hunkRows = rows.slice(start, end)
  return {
    oldStart,
    newStart,
    oldCount: hunkRows.filter((row) => row.op !== 'insert').length,
    newCount: hunkRows.filter((row) => row.op !== 'delete').length,
    rows: hunkRows,
  }
}

/**
 * 把行序列聚成 hunks:
 *  - 未限制 context → 全部行并为一个 hunk;
 *  - 有限 context → 相邻改动之间 equal 行超过 2×context 即切分,每个 hunk 向两侧各扩
 *    context 行 equal 上下文(改动间隔 > 2×context 保证扩展区间不重叠)。
 *
 * `leadingConsumedLines`:rows[0] 之前已被 context 裁掉的公共前缀行数。
 * 行号游标必须从这里起算,否则被裁掉的头部公共行不计入,纯插入 hunk 的起始行会算错。
 */
function groupRowsIntoHunks(
  rows: readonly BudgetedDiffRow[],
  contextLimit: number | null,
  leadingConsumedLines: number,
): BudgetedDiffHunk[] {
  const changeIndexes: number[] = []
  rows.forEach((row, index) => {
    if (row.op !== 'equal') {
      changeIndexes.push(index)
    }
  })
  if (changeIndexes.length === 0) {
    return []
  }

  const oldBefore = new Array<number>(rows.length)
  const newBefore = new Array<number>(rows.length)
  let oldCursor = leadingConsumedLines
  let newCursor = leadingConsumedLines
  for (let i = 0; i < rows.length; i += 1) {
    oldBefore[i] = oldCursor
    newBefore[i] = newCursor
    const row = rows[i]!
    if (row.op !== 'insert') {
      oldCursor += 1
    }
    if (row.op !== 'delete') {
      newCursor += 1
    }
  }

  const gapLimit = contextLimit === null ? Number.POSITIVE_INFINITY : contextLimit * 2
  const hunks: BudgetedDiffHunk[] = []
  let clusterFirst = 0

  for (let k = 1; k <= changeIndexes.length; k += 1) {
    const prev = changeIndexes[k - 1]!
    const next = changeIndexes[k]
    const isClusterBoundary = next === undefined || next - prev - 1 > gapLimit
    if (!isClusterBoundary) {
      continue
    }

    const firstChange = changeIndexes[clusterFirst]!
    const lastChange = prev
    const start =
      contextLimit === null ? 0 : Math.max(0, firstChange - contextLimit)
    const end =
      contextLimit === null
        ? rows.length
        : Math.min(rows.length, lastChange + 1 + contextLimit)
    hunks.push(buildHunk(rows, start, end, oldBefore, newBefore))
    clusterFirst = k
  }

  return hunks
}

/**
 * 主入口:结构化预算 diff。
 * 流程:找公共前后缀 → context 预裁剪 → 中段带预算 diff → 组装上下文行 → 聚 hunks。
 */
export function buildBudgetedDiff(
  before: string,
  after: string,
  options?: BudgetedDiffOptions,
): BudgetedDiff {
  const beforeLines = splitDiffLines(before)
  const afterLines = splitDiffLines(after)
  const contextLimit = resolveContextLimit(options?.contextLines)

  const sharedPrefix = countSharedPrefix(beforeLines, afterLines)
  const sharedSuffix = countSharedSuffix(beforeLines, afterLines, sharedPrefix)

  const limitedPrefix =
    contextLimit === null ? sharedPrefix : Math.min(sharedPrefix, contextLimit)
  const limitedSuffix =
    contextLimit === null ? sharedSuffix : Math.min(sharedSuffix, contextLimit)

  const beforeMiddle = beforeLines.slice(sharedPrefix, beforeLines.length - sharedSuffix)
  const afterMiddle = afterLines.slice(sharedPrefix, afterLines.length - sharedSuffix)

  const rows: BudgetedDiffRow[] = []
  const state: BudgetState = { usedAnchorFallback: false, usedWholeBlockFallback: false }

  // context 预裁剪:只取改动两侧窗口进 patch,公共区深处的内容永不进入拼串
  for (let i = sharedPrefix - limitedPrefix; i < sharedPrefix; i += 1) {
    rows.push({ op: 'equal', text: beforeLines[i]!, oldIndex: i, newIndex: i })
  }
  appendBudgetedRows(rows, beforeMiddle, afterMiddle, sharedPrefix, sharedPrefix, state)
  const suffixStart = beforeLines.length - sharedSuffix
  for (let i = suffixStart; i < suffixStart + limitedSuffix; i += 1) {
    rows.push({ op: 'equal', text: beforeLines[i]!, oldIndex: i, newIndex: i })
  }

  return {
    hunks: groupRowsIntoHunks(rows, contextLimit, sharedPrefix - limitedPrefix),
    usedAnchorFallback: state.usedAnchorFallback,
    usedWholeBlockFallback: state.usedWholeBlockFallback,
  }
}

function formatHunkRange(start: number, count: number): string {
  if (count === 0) {
    return `${start},0`
  }
  return count === 1 ? `${start}` : `${start},${count}`
}

/**
 * 手拼 unified patch 文本出口(与结构化出口同一套预算与判据)。
 * 内容完全一致(无任何改动)时返回 null,调用方据此跳过渲染。
 */
export function buildBudgetedDiffPatch(
  before: string,
  after: string,
  fileLabel: string,
  options?: BudgetedDiffOptions,
): string | null {
  const beforeLines = splitDiffLines(before)
  const afterLines = splitDiffLines(after)
  const isCreatedFile = beforeLines.length === 0 && afterLines.length > 0
  const isDeletedFile = beforeLines.length > 0 && afterLines.length === 0

  const diff = buildBudgetedDiff(before, after, options)
  if (diff.hunks.length === 0) {
    return null
  }

  const lines: string[] = [
    // 手拼 unified diff 必须补 `diff --git` 边界头:没有边界时,删除行正文
    // (如 SQL 注释 `-- x` 生成 `--- x` 行)会被解析器误判成第二个文件头并让渲染崩溃。
    `diff --git a/${fileLabel} b/${fileLabel}`,
    // 新建/删除文件用 /dev/null 表示不存在的一侧,解析器才能走新增/删除语义
    isCreatedFile ? '--- /dev/null' : `--- a/${fileLabel}`,
    isDeletedFile ? '+++ /dev/null' : `+++ b/${fileLabel}`,
  ]

  for (const hunk of diff.hunks) {
    lines.push(
      `@@ -${formatHunkRange(hunk.oldStart, hunk.oldCount)} +${formatHunkRange(hunk.newStart, hunk.newCount)} @@`,
    )
    for (const row of hunk.rows) {
      const prefix = row.op === 'equal' ? ' ' : row.op === 'insert' ? '+' : '-'
      lines.push(`${prefix}${row.text}`)
    }
  }

  return lines.join('\n')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
