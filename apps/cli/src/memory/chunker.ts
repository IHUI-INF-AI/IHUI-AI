/**
 * Markdown-aware chunker — 把 MEMORY.md 切成可检索的 chunk。
 *
 * 灵感来源:xai-grok-memory crate 的 chunker 模块。
 * 简化策略(做减法):
 *   - 按行分割,识别 #/##/### heading 层级,记录 ancestors 路径
 *   - 当前 chunk 累积到 maxChunkSize 字符时 flush,保留 overlap 字符的尾部行
 *   - hash 用 sha256 截断 16 字符(替代 blake3,零依赖)
 *
 * ancestors 语义:chunk 的 ancestors = 当前所属 heading 的父链(不含自身)。
 *   例:`# A` → `## B` → `### C` 下方的 chunk,ancestors = ['A', 'A/B']
 *   (即 `# A` 的路径 'A' + `## B` 的路径 'A/B',各级标题用 / 拼接)
 */
import * as crypto from 'node:crypto'

export interface ChunkerOptions {
  /** 单 chunk 最大字符数,默认 500 */
  maxChunkSize?: number
  /** overlap 区域字符数,默认 50 */
  overlap?: number
}

export interface Chunk {
  text: string
  startLine: number
  endLine: number
  hash: string
  ancestors: string[]
}

const DEFAULT_MAX_CHUNK_SIZE = 500
const DEFAULT_OVERLAP = 50

const HEADING_RE = /^(#{1,6})\s+(.+)$/

/**
 * 把 Markdown 文本切成 chunk 数组。
 * startLine / endLine 均为 0-indexed 且 inclusive。
 */
export function chunkMarkdown(text: string, options?: ChunkerOptions): Chunk[] {
  if (!text) return []
  const maxChunkSize = options?.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE
  const overlap = options?.overlap ?? DEFAULT_OVERLAP

  const lines = text.split('\n')
  const chunks: Chunk[] = []
  // headingPaths[i] = 当前活跃的 level-(i+1) heading 的"路径"(内部追踪,含自身)
  let headingPaths: string[] = []
  // currentAncestors = 当前累积 chunk 所属 heading 的父链(不含当前 heading)
  let currentAncestors: string[] = []
  let current: string[] = []
  let currentSize = 0
  let startLine = 0

  const flush = (endLine: number): void => {
    if (current.length === 0) return
    const chunkText = current.join('\n')
    const hash = crypto.createHash('sha256').update(chunkText).digest('hex').slice(0, 16)
    chunks.push({
      text: chunkText,
      startLine,
      endLine,
      hash,
      ancestors: [...currentAncestors],
    })
    // 从末尾取若干行,累计字符数达到 overlap,作为下一个 chunk 的开头
    const overlapLines: string[] = []
    let size = 0
    for (let i = current.length - 1; i >= 0 && size < overlap; i--) {
      const line = current[i]!
      overlapLines.unshift(line)
      size += line.length + 1 // +1 for \n
    }
    current = overlapLines
    currentSize = overlapLines.reduce((s, l) => s + l.length + 1, 0)
    startLine = endLine - overlapLines.length + 2
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trim()
    const m = HEADING_RE.exec(trimmed)
    if (m) {
      const level = m[1]!.length
      const title = m[2]!.trim()
      // 截断到父级(level-1 层),保留 levels 1..level-1 的路径
      headingPaths = headingPaths.slice(0, level - 1)
      const parentPath = headingPaths.length > 0 ? headingPaths[headingPaths.length - 1]! : ''
      const path = parentPath ? `${parentPath}/${title}` : title
      // 当前 chunk 的 ancestors = 父链(不含当前 heading)
      currentAncestors = [...headingPaths]
      // 把当前 heading 路径加入追踪
      headingPaths.push(path)
    }

    if (current.length === 0) {
      startLine = i
    }
    current.push(line)
    currentSize += line.length + 1

    if (currentSize >= maxChunkSize) {
      flush(i)
    }
  }

  if (current.length > 0) {
    flush(lines.length - 1)
  }

  return chunks
}
