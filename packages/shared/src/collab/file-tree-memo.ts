// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文件树按请求分片记忆。请求键必须是已量到的 32 位小写十六进制。
 * 条目只留路径和尺寸，夹了正文就拒绝。键或时间没量到不得当成空树。
 */

const REQUEST_KEY = /^[0-9a-f]{32}$/

export interface FileTreeEntry {
  path: string
  name: string
  type: string
  size: number
}

export type FileTreeUnjudgedReason = 'key-unmeasured' | 'time-unmeasured' | 'files-unmeasured' | 'row-unmeasured'

export type FileTreeVerdict =
  | { disposition: 'projected'; reason: 'paths-only'; entries: readonly FileTreeEntry[] }
  | { disposition: 'refused'; reason: 'body-inlined'; entries: null }
  | {
      disposition: 'unjudged'
      reason: FileTreeUnjudgedReason
      entries: null
    }

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

export function projectFileTree(input: unknown): FileTreeVerdict {
  const unread = (reason: FileTreeUnjudgedReason): FileTreeVerdict => ({
    disposition: 'unjudged',
    reason,
    entries: null,
  })
  if (input === null || typeof input !== 'object' || Array.isArray(input))
    return unread('key-unmeasured')
  const row = input as Record<string, unknown>
  if (typeof row.requestKey !== 'string' || !REQUEST_KEY.test(row.requestKey))
    return unread('key-unmeasured')
  if (typeof row.createdAt !== 'number' || !Number.isFinite(row.createdAt))
    return unread('time-unmeasured')
  if (!Array.isArray(row.files)) return unread('files-unmeasured')
  const entries: FileTreeEntry[] = []
  for (const file of row.files) {
    if (file === null || typeof file !== 'object' || Array.isArray(file))
      return unread('row-unmeasured')
    const item = file as Record<string, unknown>
    if ('content' in item || 'text' in item || 'body' in item) {
      return { disposition: 'refused', reason: 'body-inlined', entries: null }
    }
    if (!nonEmpty(item.path) || !nonEmpty(item.name) || !nonEmpty(item.type))
      return unread('row-unmeasured')
    if (typeof item.size !== 'number' || !Number.isFinite(item.size) || item.size < 0) {
      return unread('row-unmeasured')
    }
    entries.push({ path: item.path, name: item.name, type: item.type, size: item.size })
  }
  return { disposition: 'projected', reason: 'paths-only', entries }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
