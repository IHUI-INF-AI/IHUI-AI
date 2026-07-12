import { fetchApi } from '@/lib/api'
import type { AiGcItem } from './types'

export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY: AiGcItem = {
  id: '',
  title: '',
  subtitle: '',
  context: '',
  fileUrl: '',
  fileType: '',
  coverUrl: '',
  type: '',
  creator: '',
  createdAt: '',
}

export const TEXT_FIELDS: { key: keyof AiGcItem; label: string; type?: 'textarea' }[] = [
  { key: 'title', label: '标题' },
  { key: 'subtitle', label: '副标题', type: 'textarea' },
  { key: 'context', label: '内容', type: 'textarea' },
  { key: 'fileUrl', label: '文件URL' },
  { key: 'fileType', label: '文件类型' },
  { key: 'type', label: '类型' },
  { key: 'creator', label: '创建者' },
]

export const COLS: { key: keyof AiGcItem; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'title', label: '标题' },
  { key: 'subtitle', label: '副标题' },
  { key: 'context', label: '内容' },
  { key: 'fileUrl', label: '文件URL' },
  { key: 'fileType', label: '类型' },
  { key: 'type', label: '分类' },
  { key: 'creator', label: '创建者' },
]

export const th = 'px-4 py-2.5 font-medium'

export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
