import { fetchApi } from '@/lib/api'
import type { SensitiveWordForm } from './types'

// 分类 ID 使用中性英文标识符,避免敏感词进入 LLM 上下文
// 注意:DB 已有历史数据可能仍含旧值(porn/abuse),需通过迁移脚本更新
export const CATEGORIES = ['default', 'politics', 'explicit', 'ads', 'harassment'] as const
export const LEVEL_KEYS = ['levelReplace', 'levelBlock', 'levelBan'] as const
export const th = 'px-4 py-2.5 font-medium'
export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const EMPTY: SensitiveWordForm = {
  word: '',
  category: 'default',
  level: 1,
  replacement: '',
  status: 1,
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
