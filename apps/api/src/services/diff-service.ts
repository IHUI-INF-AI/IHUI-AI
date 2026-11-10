// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 差异对比服务。
 * 支持文本文件（基于 LCS 的逐行 diff）与二进制文件（哈希对比）。
 * 零依赖实现，不引入外部 diff 库。
 */

import { createHash } from 'node:crypto'
import { readFileSync, existsSync, statSync, openSync, readSync, closeSync } from 'node:fs'

export type DiffType = 'add' | 'delete' | 'modify' | 'equal'

/**
 * F-261:差异计算的资源预算。
 *
 * LCS 是 `(m+1)×(n+1)` 的二维数组且原实现无上限:两 5MB 文本(约 10 万行)会申请
 * 1e10 个槽位直接 OOM,而且 `isTextFile` 声称只采样 8KB,实际却 `readFileSync`
 * 整文件读入。这里把「单文件字节 / 单侧行数 / LCS 单元格数」三档预算前置,
 * 超限直接抛 `DiffTooLargeError`,不再让畸形输入拖死事件循环。
 */
export const MAX_DIFF_FILE_BYTES = 2 * 1024 * 1024
export const MAX_DIFF_LINES = 5000
export const MAX_DIFF_LCS_CELLS = 4_000_000

export class DiffTooLargeError extends Error {
  constructor(reason: string) {
    super(`Diff too large: ${reason}`)
    this.name = 'DiffTooLargeError'
  }
}

function assertFileSize(filePath: string): void {
  const size = statSync(filePath).size
  if (size > MAX_DIFF_FILE_BYTES) {
    throw new DiffTooLargeError(`${filePath} is ${size} bytes (max ${MAX_DIFF_FILE_BYTES})`)
  }
}

function assertDiffBudget(fromLines: number, toLines: number): void {
  if (fromLines > MAX_DIFF_LINES || toLines > MAX_DIFF_LINES) {
    throw new DiffTooLargeError(`${fromLines}/${toLines} lines (max ${MAX_DIFF_LINES})`)
  }
  if (fromLines * toLines > MAX_DIFF_LCS_CELLS) {
    throw new DiffTooLargeError(
      `${fromLines}×${toLines}=${fromLines * toLines} LCS cells (max ${MAX_DIFF_LCS_CELLS})`,
    )
  }
}

export interface DiffLine {
  lineNumber: number
  content: string
  diffType: DiffType
}

export interface DiffResult {
  additions: number
  deletions: number
  changes: number
  fromContent: string
  toContent: string
  changesList: DiffLine[]
}

/** 计算文件 SHA-256 哈希。 */
export function getFileHash(filePath: string): string {
  const buf = readFileSync(filePath)
  return createHash('sha256').update(buf).digest('hex')
}

/** 判断是否为文本文件（采样前 8KB，含 \0 视为二进制）。 */
export function isTextFile(filePath: string, sampleSize = 8192): boolean {
  let fd: number | null = null
  try {
    // F-261:只读采样窗口,不再为「探测类型」把整个文件读进内存
    fd = openSync(filePath, 'r')
    const buf = Buffer.alloc(sampleSize)
    const read = readSync(fd, buf, 0, sampleSize, 0)
    const chunk = buf.subarray(0, read)
    if (chunk.includes(0)) return false
    return chunk.toString('utf8') !== ''
  } catch {
    return false
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd)
      } catch {
        /* ignore */
      }
    }
  }
}

/** 读取文件内容，返回行数组与原始字符串。 */
export function readFileContent(filePath: string): { lines: string[]; content: string } {
  try {
    const content = readFileSync(filePath, 'utf-8')
    return { lines: content.split(/\r?\n/), content }
  } catch {
    return { lines: [], content: '' }
  }
}

/**
 * 基于 LCS 计算两段文本的逐行 diff。
 *
 * 口径归属(G-415 A9):这一处的切行**刻意与后端 Python `str.splitlines()` 不同**,不要"顺手对齐":
 * `split(/\r?\n/)` **保留**末尾空行(`'a\n'` → 2 行),因为 LCS 需要把"文件以换行结尾"本身
 * 当成一个可比条目 —— 换成 Python 口径(摘掉尾空段)会丢掉这一维,diff 结果就不报"末尾多了换行"。
 * 它量的也不是"改了几行"这个用户可见统计量(那个住在 `apps/web/src/lib/py-line-count.ts`,
 * 由 `scripts/check-line-split-parity.mjs` 跨语言对账),所以不参与那条尺子的语料。
 * 只认 `\r?\n` 也是有意:`\v`/`\f`/`\x1c` 在这里是行内字符,切开会产出假 hunk。
 */
export function computeTextDiff(fromText: string, toText: string): DiffLine[] {
  const fromLines = fromText.split(/\r?\n/)
  const toLines = toText.split(/\r?\n/)
  const m = fromLines.length
  const n = toLines.length
  assertDiffBudget(m, n)

  // LCS 动态规划表
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    const row = dp[i]!
    const nextRow = dp[i + 1]!
    for (let j = n - 1; j >= 0; j--) {
      row[j] =
        fromLines[i] === toLines[j]
          ? (nextRow[j + 1] ?? 0) + 1
          : Math.max(nextRow[j] ?? 0, row[j + 1] ?? 0)
    }
  }

  const result: DiffLine[] = []
  let i = 0
  let j = 0
  let lineNum = 0
  while (i < m && j < n) {
    const row = dp[i]!
    const nextRow = dp[i + 1]!
    if (fromLines[i] === toLines[j]) {
      result.push({ lineNumber: lineNum++, content: fromLines[i]!, diffType: 'equal' })
      i++
      j++
    } else if ((nextRow[j] ?? 0) >= (row[j + 1] ?? 0)) {
      result.push({ lineNumber: lineNum, content: fromLines[i]!, diffType: 'delete' })
      i++
    } else {
      result.push({ lineNumber: lineNum++, content: toLines[j]!, diffType: 'add' })
      j++
    }
  }
  while (i < m) result.push({ lineNumber: lineNum, content: fromLines[i++]!, diffType: 'delete' })
  while (j < n) result.push({ lineNumber: lineNum++, content: toLines[j++]!, diffType: 'add' })
  return result
}

/** 比较两个文本文件。 */
export function compareTextFiles(fromPath: string, toPath: string): DiffResult {
  assertFileSize(fromPath)
  assertFileSize(toPath)
  const { content: fromContent } = readFileContent(fromPath)
  const { content: toContent } = readFileContent(toPath)

  const diffLines = computeTextDiff(fromContent, toContent)
  const additions = diffLines.filter((d) => d.diffType === 'add').length
  const deletions = diffLines.filter((d) => d.diffType === 'delete').length

  return {
    additions,
    deletions,
    changes: additions + deletions,
    fromContent,
    toContent,
    changesList: diffLines.filter((d) => d.diffType !== 'equal').slice(0, 100),
  }
}

/** 比较两个二进制文件（基于哈希）。 */
export function compareBinaryFiles(fromPath: string, toPath: string): DiffResult {
  const fromHash = getFileHash(fromPath)
  const toHash = getFileHash(toPath)
  const fromSize = existsSync(fromPath) ? statSync(fromPath).size : 0
  const toSize = existsSync(toPath) ? statSync(toPath).size : 0

  if (fromHash === toHash) {
    return {
      additions: 0,
      deletions: 0,
      changes: 0,
      fromContent: `Binary (hash: ${fromHash.slice(0, 16)}, size: ${fromSize})`,
      toContent: `Binary (hash: ${toHash.slice(0, 16)}, size: ${toSize})`,
      changesList: [],
    }
  }

  const sizeDiff = toSize - fromSize
  return {
    additions: Math.max(0, sizeDiff),
    deletions: Math.max(0, -sizeDiff),
    changes: 1,
    fromContent: `Binary (hash: ${fromHash.slice(0, 16)}, size: ${fromSize})`,
    toContent: `Binary (hash: ${toHash.slice(0, 16)}, size: ${toSize})`,
    changesList: [
      {
        lineNumber: 0,
        content: `Binary changed, size diff: ${sizeDiff} bytes`,
        diffType: 'modify',
      },
    ],
  }
}

/** 自动判断文件类型并比较。 */
export function compareFiles(fromPath: string, toPath: string): DiffResult {
  if (isTextFile(fromPath) && isTextFile(toPath)) {
    return compareTextFiles(fromPath, toPath)
  }
  return compareBinaryFiles(fromPath, toPath)
}

/** 计算两文件相似度（0-1）。 */
export function getSimilarity(fromPath: string, toPath: string): number {
  if (!isTextFile(fromPath) || !isTextFile(toPath)) {
    return getFileHash(fromPath) === getFileHash(toPath) ? 1.0 : 0.0
  }
  assertFileSize(fromPath)
  assertFileSize(toPath)
  const { lines: fromLines } = readFileContent(fromPath)
  const { lines: toLines } = readFileContent(toPath)
  if (fromLines.length === 0 && toLines.length === 0) return 1.0
  if (fromLines.length === 0 || toLines.length === 0) return 0.0

  // LCS 长度 / 较大行数
  const m = fromLines.length
  const n = toLines.length
  assertDiffBudget(m, n)
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    const row = dp[i]!
    const nextRow = dp[i + 1]!
    for (let j = n - 1; j >= 0; j--) {
      row[j] =
        fromLines[i] === toLines[j]
          ? (nextRow[j + 1] ?? 0) + 1
          : Math.max(nextRow[j] ?? 0, row[j + 1] ?? 0)
    }
  }
  return (dp[0]?.[0] ?? 0) / Math.max(m, n)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
