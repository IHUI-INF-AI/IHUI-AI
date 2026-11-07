// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 行级 diff 的**唯一解析/生成实现**(零依赖、纯函数)。
 *
 * 两个方向都必需,且必须互不代管:
 *   - `parseUnifiedDiff`  —— 读侧:人工编辑拿到的标准 unified diff(可能来自 git、来自编辑器、
 *     来自测试字面量),归因翻转只信它,不信"内容看起来一样"。
 *   - `computeDiffHunks`  —— 写侧:AI 落盘前后两份真实内容,由本函数算出**实际改动行**,
 *     据此标记 AI 行。禁止按"调用参数里的整文件内容"整文件标记。
 *
 * Myers O(ND) 逐行差异:按 D 保存 V 快照回溯。文件过大(行数或编辑距离超预算)时退回
 * 「公共前缀/后缀」单 hunk —— 该退化**仍以真实内容为准**,只会把中间一大段视作一个改动块,
 * 不会把未改动的文件头尾标成 AI。
 */

/** 行级差异的一行。 */
export interface DiffLine {
  kind: 'context' | 'add' | 'del'
  text: string
}

/** 一个 unified diff hunk(old/new 区间均 1-based;count 可为 0 表示纯插入/纯删除)。 */
export interface DiffHunk {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  lines: DiffLine[]
}

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

/** 按 `\n` 切行;末尾换行不产生多余空行(与编辑器行号口径一致)。 */
export function splitLines(text: string): string[] {
  if (text === '') return []
  const lines = text.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/**
 * 解析标准 unified diff。
 *
 * 只处理 `@@ -a,b +c,d @@` 块体;块体消费**按 header 里的行数**终止(不靠空行/文件头启发式),
 * 因此 hunk 内的空行(即使以 `\" \"` 省略)不会被误判成块结束。
 * `\ No newline at end of file` 忽略(行内容本身已由 +/-/空格前缀决定)。
 * 头部行(`diff --git` / `---` / `+++` / `index`)一律跳过。
 */
export function parseUnifiedDiff(diff: string): DiffHunk[] {
  const lines = diff.split('\n')
  const hunks: DiffHunk[] = []
  let i = 0
  while (i < lines.length) {
    const header = HUNK_HEADER_RE.exec(lines[i] ?? '')
    if (!header) {
      i += 1
      continue
    }
    const oldStart = Number(header[1])
    const oldCount = header[2] === undefined ? 1 : Number(header[2])
    const newStart = Number(header[3])
    const newCount = header[4] === undefined ? 1 : Number(header[4])
    i += 1
    let oldRemaining = oldCount
    let newRemaining = newCount
    const body: DiffLine[] = []
    while (i < lines.length && (oldRemaining > 0 || newRemaining > 0)) {
      const raw = lines[i] ?? ''
      if (raw.startsWith('\\')) {
        i += 1
        continue
      }
      if (raw.startsWith('+')) {
        body.push({ kind: 'add', text: raw.slice(1) })
        newRemaining -= 1
        i += 1
        continue
      }
      if (raw.startsWith('-')) {
        body.push({ kind: 'del', text: raw.slice(1) })
        oldRemaining -= 1
        i += 1
        continue
      }
      // 上下文行:标准前缀是 ' ';空行(末尾截断)同样按上下文处理
      body.push({ kind: 'context', text: raw.length > 0 ? raw.slice(1) : '' })
      oldRemaining -= 1
      newRemaining -= 1
      i += 1
    }
    hunks.push({ oldStart, oldCount, newStart, newCount, lines: body })
  }
  return hunks
}

/** Myers 预算:超过任一上限即退化(避免 O(D·N) 快照把内存打爆)。 */
export const MYERS_MAX_LINES = 8000
export const MYERS_MAX_EDIT_DISTANCE = 2000

interface DiffOp {
  kind: 'equal' | 'add' | 'del'
  aIndex: number
  bIndex: number
}

/** 退化实现:公共前缀 + 公共后缀,中间整段视作 del+add(仍以真实内容为准)。 */
function simpleOps(a: string[], b: string[]): DiffOp[] {
  const ops: DiffOp[] = []
  let prefix = 0
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1
  let suffix = 0
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix += 1
  }
  for (let i = 0; i < prefix; i += 1) ops.push({ kind: 'equal', aIndex: i, bIndex: i })
  for (let i = prefix; i < a.length - suffix; i += 1)
    ops.push({ kind: 'del', aIndex: i, bIndex: -1 })
  for (let i = prefix; i < b.length - suffix; i += 1)
    ops.push({ kind: 'add', aIndex: -1, bIndex: i })
  for (let i = 0; i < suffix; i += 1) {
    ops.push({ kind: 'equal', aIndex: a.length - suffix + i, bIndex: b.length - suffix + i })
  }
  return ops
}

/** Myers O(ND):回溯得到逐行 edit script。超出预算返回 null(由调用方退化)。 */
function myersOps(a: string[], b: string[]): DiffOp[] | null {
  const n = a.length
  const m = b.length
  const max = n + m
  if (max === 0) return []
  if (n + m > MYERS_MAX_LINES * 2) return null
  const offset = max
  const size = 2 * max + 2
  const v = new Int32Array(size)
  const trace: Int32Array[] = []
  for (let d = 0; d <= max; d += 1) {
    if (d > MYERS_MAX_EDIT_DISTANCE) return null
    // 先存「进入本 d 之前」的 V 快照,回溯时 trace[d] 即为 d-1 的状态
    trace.push(Int32Array.from(v))
    for (let k = -d; k <= d; k += 2) {
      let x: number
      if (k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!)) {
        x = v[offset + k + 1]!
      } else {
        x = v[offset + k - 1]! + 1
      }
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x += 1
        y += 1
      }
      v[offset + k] = x
      if (x >= n && y >= m) {
        return backtrack(trace, a.length, b.length, offset)
      }
    }
  }
  return null
}

function backtrack(trace: Int32Array[], n: number, m: number, offset: number): DiffOp[] {
  let x = n
  let y = m
  const ops: DiffOp[] = []
  for (let d = trace.length - 1; d >= 0; d -= 1) {
    const v = trace[d]!
    const k = x - y
    let prevK: number
    if (k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!)) prevK = k + 1
    else prevK = k - 1
    const prevX = d === 0 ? 0 : v[offset + prevK]!
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) {
      ops.push({ kind: 'equal', aIndex: x - 1, bIndex: y - 1 })
      x -= 1
      y -= 1
    }
    if (d > 0) {
      if (x === prevX) {
        ops.push({ kind: 'add', aIndex: -1, bIndex: y - 1 })
        y -= 1
      } else {
        ops.push({ kind: 'del', aIndex: x - 1, bIndex: -1 })
        x -= 1
      }
    }
  }
  ops.reverse()
  return ops
}

function opsOf(a: string[], b: string[]): DiffOp[] {
  return myersOps(a, b) ?? simpleOps(a, b)
}

/**
 * 两份真实内容 → unified hunk 列表(默认 3 行上下文)。
 *
 * 注意:归因只消费 `add`/`del` 的实际落点;`context` 行原样带过,因此"只在 5 行文件里改了
 * 第 3 行"不会把 1-5 行统统标成改动。
 */
export function computeDiffHunks(before: string, after: string, contextLines = 3): DiffHunk[] {
  const a = splitLines(before)
  const b = splitLines(after)
  const ops = opsOf(a, b)
  if (ops.every((op) => op.kind === 'equal')) return []

  const positions: Array<{ op: DiffOp; aPos: number; bPos: number }> = []
  let aPos = 1
  let bPos = 1
  for (const op of ops) {
    positions.push({ op, aPos, bPos })
    if (op.kind === 'equal') {
      aPos += 1
      bPos += 1
    } else if (op.kind === 'del') {
      aPos += 1
    } else {
      bPos += 1
    }
  }

  // 改动 run 的合并:两段改动之间的未变更行 < 2*context 时,上下文会重叠,合成一个 hunk
  const runs: Array<{ start: number; end: number }> = []
  let idx = 0
  while (idx < positions.length) {
    if (positions[idx]!.op.kind === 'equal') {
      idx += 1
      continue
    }
    const start = idx
    while (idx < positions.length && positions[idx]!.op.kind !== 'equal') idx += 1
    const end = idx
    const prev = runs[runs.length - 1]
    if (prev && start - prev.end <= contextLines * 2) prev.end = end
    else runs.push({ start, end })
  }

  const hunks: DiffHunk[] = []
  for (const run of runs) {
    let begin = run.start
    let leading = 0
    while (begin > 0 && positions[begin - 1]!.op.kind === 'equal' && leading < contextLines) {
      begin -= 1
      leading += 1
    }
    let finish = run.end
    let trailing = 0
    while (
      finish < positions.length &&
      positions[finish]!.op.kind === 'equal' &&
      trailing < contextLines
    ) {
      finish += 1
      trailing += 1
    }
    const body = positions.slice(begin, finish)
    const lines: DiffLine[] = body.map(({ op }) =>
      op.kind === 'equal'
        ? { kind: 'context', text: a[op.aIndex] ?? '' }
        : op.kind === 'del'
          ? { kind: 'del', text: a[op.aIndex] ?? '' }
          : { kind: 'add', text: b[op.bIndex] ?? '' },
    )
    hunks.push({
      oldStart: body[0]!.aPos,
      oldCount: body.filter((p) => p.op.kind !== 'add').length,
      newStart: body[0]!.bPos,
      newCount: body.filter((p) => p.op.kind !== 'del').length,
      lines,
    })
  }
  return hunks
}

/** 渲染为标准 unified diff(带 `--- a/` `+++ b/` 头,供人读与作为 reconcile 的入参)。 */
export function toUnifiedDiff(
  before: string,
  after: string,
  filePath: string,
  contextLines = 3,
): string {
  const hunks = computeDiffHunks(before, after, contextLines)
  if (hunks.length === 0) return ''
  const out: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`]
  for (const h of hunks) {
    out.push(`@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@`)
    for (const line of h.lines) {
      const prefix = line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' '
      out.push(`${prefix}${line.text}`)
    }
  }
  return `${out.join('\n')}\n`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
