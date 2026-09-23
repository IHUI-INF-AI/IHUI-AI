// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Hunk 级 diff 纯函数(2026-09-18 立,W5:hunk 级接受/拒绝/部分应用)。
 *
 * 设计:
 *  - diff 算法与 `inline-diff-card.tsx` 内联的 LCS 一致(经典 LCS 动态规划),额外按行拆出
 *    `{ text, eol }`,使重组时能**逐行保留原始行尾符**(`\r\n` / `\n` / `\r` 与结尾换行)。
 *  - hunk = 连续的 insert/delete 行组;被至少一行 equal 隔开即为两个 hunk。
 *  - `buildPartialContent` 以 oldContent 为基线,只把「已接受」hunk 替换为新内容,
 *    被拒绝的 hunk 原样保留。全拒绝时输出与 oldContent 完全一致(调用方据此不写盘)。
 */

export interface DiffLine {
  /** 行内容(不含行尾符) */
  text: string
  /** 行尾符:`\n` / `\r\n` / `\r`;仅「最后一行且原文无结尾换行」时为 '' */
  eol: string
}

export type DiffOp = 'equal' | 'insert' | 'delete'

export interface DiffRow {
  op: DiffOp
  oldLine?: DiffLine
  newLine?: DiffLine
  /** 1-based 旧文件行号 */
  oldNum?: number
  /** 1-based 新文件行号 */
  newNum?: number
}

export interface HunkRow {
  op: 'insert' | 'delete'
  oldLine?: DiffLine
  newLine?: DiffLine
  oldNum?: number
  newNum?: number
}

export interface DiffHunk {
  /** 0 起的稳定 id(按出现顺序),UI 选择态以此为键 */
  id: number
  rows: HunkRow[]
  /** 在 `HunkDiff.rows` 中的区间 [rowStart, rowEnd) */
  rowStart: number
  rowEnd: number
  /** 旧文件侧行区间 [oldStart, oldEnd),0-based 半开,用于重组时定位 */
  oldStart: number
  oldEnd: number
  /** 展示用 1-based 行号区间(纯插入时 oldStartLine = oldEndLine 表示插入点) */
  oldStartLine: number
  oldEndLine: number
  newStartLine: number
  newEndLine: number
  added: number
  removed: number
  /** 新文件侧内容行(行尾符已归一到文件主流行尾符),用于重组 */
  newLines: DiffLine[]
}

export interface HunkDiff {
  /** 完整渲染序列(equal + insert/delete 按序) */
  rows: DiffRow[]
  hunks: DiffHunk[]
  /** 与 `rows` 等长:该行所属 hunk id(equal 行为 null) */
  hunkIdByRow: Array<number | null>
}

/** LCS 动态规划格子数上限,超出则降级为「整体单 hunk」,避免大文件 O(n*m) 内存爆炸 */
const MAX_LCS_CELLS = 4_000_000

/**
 * 按行拆分并保留行尾符。
 * `''` → `[]`(空文件视为 0 行);`'a\n'` → `[{text:'a',eol:'\n'}]`(不产生幽灵空行)。
 */
export function splitLinesWithEol(text: string): DiffLine[] {
  if (text === '') return []
  const lines: DiffLine[] = []
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '\n') {
      lines.push({ text: text.slice(start, i), eol: '\n' })
      start = i + 1
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') {
        lines.push({ text: text.slice(start, i), eol: '\r\n' })
        i++
      } else {
        lines.push({ text: text.slice(start, i), eol: '\r' })
      }
      start = i + 1
    }
  }
  if (start < text.length) lines.push({ text: text.slice(start), eol: '' })
  return lines
}

/** 检测文本文档的主流行尾符(出现次数最多者),无换行时默认 `\n` */
export function detectEol(text: string): string {
  let crlf = 0
  let lf = 0
  let cr = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      if (text[i - 1] === '\r') crlf++
      else lf++
    } else if (text[i] === '\r' && text[i + 1] !== '\n') {
      cr++
    }
  }
  if (crlf >= lf && crlf >= cr && crlf > 0) return '\r\n'
  if (cr > lf && cr > 0) return '\r'
  return '\n'
}

/** 把行尾符归一到目标风格(保留「无结尾换行」的语义) */
function normalizeEol(line: DiffLine, eol: string): DiffLine {
  if (line.eol === '' || line.eol === eol) return line
  return { text: line.text, eol }
}

/** 拼接行序列:非末行若缺行尾符则补 `fallbackEol`,末行保留自身行尾符 */
export function joinLines(lines: DiffLine[], fallbackEol: string): string {
  const parts: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const isLast = i === lines.length - 1
    const eol = line.eol !== '' ? line.eol : isLast ? '' : fallbackEol
    parts.push(line.text + eol)
  }
  return parts.join('')
}

/** LCS 行级 diff(与 inline-diff-card 既有实现同算法,仅比较行文本并携带行尾符) */
function computeLcsRows(oldLines: DiffLine[], newLines: DiffLine[]): DiffRow[] {
  const m = oldLines.length
  const n = newLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))

  for (let i = m - 1; i >= 0; i--) {
    const row = dp[i]
    const nextRow = dp[i + 1]
    if (!row || !nextRow) continue
    for (let j = n - 1; j >= 0; j--) {
      const oldText = oldLines[i]?.text ?? ''
      const newText = newLines[j]?.text ?? ''
      row[j] =
        oldText === newText ? (nextRow[j + 1] ?? 0) + 1 : Math.max(nextRow[j] ?? 0, row[j + 1] ?? 0)
    }
  }

  const rows: DiffRow[] = []
  let i = 0
  let j = 0
  let oldNum = 0
  let newNum = 0
  while (i < m && j < n) {
    const oldLine = oldLines[i]
    const newLine = newLines[j]
    if ((oldLine?.text ?? '') === (newLine?.text ?? '')) {
      oldNum++
      newNum++
      rows.push({ op: 'equal', oldLine, newLine, oldNum, newNum })
      i++
      j++
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      oldNum++
      rows.push({ op: 'delete', oldLine, oldNum })
      i++
    } else {
      newNum++
      rows.push({ op: 'insert', newLine, newNum })
      j++
    }
  }
  while (i < m) {
    oldNum++
    rows.push({ op: 'delete', oldLine: oldLines[i], oldNum })
    i++
  }
  while (j < n) {
    newNum++
    rows.push({ op: 'insert', newLine: newLines[j], newNum })
    j++
  }
  return rows
}

/** 计算 hunk 级 diff(纯函数,确定性) */
export function computeHunkDiff(oldContent: string, newContent: string): HunkDiff {
  const oldLines = splitLinesWithEol(oldContent)
  const newLines = splitLinesWithEol(newContent)
  const fileEol = detectEol(oldContent)
  const normalizedNew = newLines.map((l) => normalizeEol(l, fileEol))

  let rows: DiffRow[]
  if (oldLines.length * newLines.length > MAX_LCS_CELLS) {
    // 降级:整体视为单个 hunk(全删 + 全增),保留行尾符归一化后的新内容
    rows = []
    for (let i = 0; i < oldLines.length; i++) {
      rows.push({ op: 'delete', oldLine: oldLines[i], oldNum: i + 1 })
    }
    for (let j = 0; j < normalizedNew.length; j++) {
      rows.push({ op: 'insert', newLine: normalizedNew[j], newNum: j + 1 })
    }
  } else {
    rows = computeLcsRows(oldLines, normalizedNew)
  }

  const hunks: DiffHunk[] = []
  const hunkIdByRow: Array<number | null> = new Array<number | null>(rows.length).fill(null)
  let oldCursor = 0
  let newCursor = 0
  let rowIdx = 0

  while (rowIdx < rows.length) {
    const current = rows[rowIdx]
    if (!current) break
    if (current.op === 'equal') {
      oldCursor++
      newCursor++
      rowIdx++
      continue
    }
    const rowStart = rowIdx
    const oldStart = oldCursor
    const newStart = newCursor
    const hunkRows: HunkRow[] = []
    const hunkNewLines: DiffLine[] = []
    let added = 0
    let removed = 0
    while (rowIdx < rows.length && rows[rowIdx]?.op !== 'equal') {
      const r = rows[rowIdx]
      if (!r) break
      if (r.op === 'delete') {
        oldCursor++
        removed++
      } else {
        newCursor++
        added++
        if (r.newLine) hunkNewLines.push(r.newLine)
      }
      hunkRows.push({
        op: r.op === 'delete' ? 'delete' : 'insert',
        oldLine: r.oldLine,
        newLine: r.newLine,
        oldNum: r.oldNum,
        newNum: r.newNum,
      })
      hunkIdByRow[rowIdx] = hunks.length
      rowIdx++
    }
    hunks.push({
      id: hunks.length,
      rows: hunkRows,
      rowStart,
      rowEnd: rowIdx,
      oldStart,
      oldEnd: oldCursor,
      oldStartLine: oldStart + 1,
      oldEndLine: removed > 0 ? oldCursor : oldStart,
      newStartLine: added > 0 ? newStart + 1 : newStart,
      newEndLine: newCursor,
      added,
      removed,
      newLines: hunkNewLines,
    })
  }

  return { rows, hunks, hunkIdByRow }
}

/**
 * 以 `oldContent` 为基线,只应用「已接受」的 hunk,其余保留原文。
 *
 * 保证:
 *  - 输出与 `oldContent` 在未触碰区域**逐字节一致**(含各行原始行尾符);
 *  - 全拒绝时输出 === `oldContent`(调用方据此跳过写盘,避免写出空文件);
 *  - 被接受 hunk 的新行采用文件主流行尾符,避免混入异种换行。
 */
export function buildPartialContent(
  oldContent: string,
  hunks: readonly DiffHunk[],
  acceptedIds: ReadonlySet<number>,
): string {
  const src = splitLinesWithEol(oldContent)
  const fileEol = detectEol(oldContent)
  const sorted = [...hunks].sort((a, b) => a.oldStart - b.oldStart)
  const out: DiffLine[] = []
  let cursor = 0
  for (const hunk of sorted) {
    for (let i = cursor; i < hunk.oldStart; i++) {
      const line = src[i]
      if (line) out.push(line)
    }
    if (acceptedIds.has(hunk.id)) {
      for (const line of hunk.newLines) out.push(normalizeEol(line, fileEol))
    } else {
      for (let i = hunk.oldStart; i < hunk.oldEnd; i++) {
        const line = src[i]
        if (line) out.push(line)
      }
    }
    cursor = Math.max(cursor, hunk.oldEnd)
  }
  for (let i = cursor; i < src.length; i++) {
    const line = src[i]
    if (line) out.push(line)
  }
  return joinLines(out, fileEol)
}

/** 判定「部分应用结果是否等同原文」(全拒绝 → 无需写盘) */
export function isUnchangedPartial(oldContent: string, partial: string): boolean {
  return oldContent === partial
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
