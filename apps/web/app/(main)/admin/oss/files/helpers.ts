import { fetchApi } from '@/lib/api'

export const PAGE_SIZE = 20

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'fileName', title: '文件名' },
  { key: 'size', title: '大小', formatter: (v: unknown) => formatSize(Number(v)) },
  { key: 'mimeType', title: '类型' },
  { key: 'uploadedBy', title: '上传者' },
  { key: 'createdAt', title: '上传时间' },
]
