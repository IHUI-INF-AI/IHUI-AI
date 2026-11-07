// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 变更列表只投影摘要和明细指针。
 * 条目里夹了正文就拒绝，缺明细指针是未判定，不得把列表当成明细。
 */

export interface ChangeIndexRow {
  id: string
  summary: string
  detailRef: string
  fileCount: number
  paths: readonly string[]
}

export type ChangeIndexVerdict =
  | { disposition: 'projected'; reason: 'summary-only'; row: ChangeIndexRow }
  | { disposition: 'refused'; reason: 'detail-inlined'; row: null }
  | {
      disposition: 'unjudged'
      reason: 'row-unmeasured' | 'detail-unmeasured' | 'paths-unmeasured'
      row: null
    }

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

export function projectChangeIndex(input: unknown): ChangeIndexVerdict {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { disposition: 'unjudged', reason: 'row-unmeasured', row: null }
  }
  const row = input as Record<string, unknown>
  if (
    !nonEmpty(row.id) ||
    !nonEmpty(row.summary) ||
    !Number.isInteger(row.fileCount) ||
    (row.fileCount as number) < 0
  ) {
    return { disposition: 'unjudged', reason: 'row-unmeasured', row: null }
  }
  if (!nonEmpty(row.detailRef)) {
    return { disposition: 'unjudged', reason: 'detail-unmeasured', row: null }
  }
  if (!Array.isArray(row.files)) {
    return { disposition: 'unjudged', reason: 'paths-unmeasured', row: null }
  }
  const paths: string[] = []
  for (const file of row.files) {
    if (typeof file === 'string') {
      if (file.trim() === '')
        return { disposition: 'unjudged', reason: 'paths-unmeasured', row: null }
      paths.push(file)
      continue
    }
    if (file === null || typeof file !== 'object') {
      return { disposition: 'unjudged', reason: 'paths-unmeasured', row: null }
    }
    const body = file as Record<string, unknown>
    if ('content' in body || 'text' in body || 'body' in body || 'diff' in body) {
      return { disposition: 'refused', reason: 'detail-inlined', row: null }
    }
    if (!nonEmpty(body.path))
      return { disposition: 'unjudged', reason: 'paths-unmeasured', row: null }
    paths.push(body.path)
  }
  return {
    disposition: 'projected',
    reason: 'summary-only',
    row: {
      id: row.id,
      summary: row.summary,
      detailRef: row.detailRef,
      fileCount: row.fileCount as number,
      paths,
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
