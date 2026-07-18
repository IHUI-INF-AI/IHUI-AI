import type { IngestForm, SearchForm } from './types'

export const EMPTY_INGEST: IngestForm = {
  ownerUuid: '',
  title: '',
  collectionName: 'default',
  text: '',
}

export const EMPTY_SEARCH: SearchForm = {
  query: '',
  collectionName: 'default',
  topK: 5,
  scoreThreshold: 0.3,
}

export function fmtTime(s: string | null | undefined): string {
  if (!s) return '-'
  try {
    return new Date(s).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return s
  }
}

/** 把分数格式化为百分比 */
export function fmtScore(score: number): string {
  return `${(score * 100).toFixed(1)}%`
}
