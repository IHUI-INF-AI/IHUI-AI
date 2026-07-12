import type { ExportColumn } from '@/lib/export-utils'
import type { CForm } from './types'

export const EMPTY: CForm = {
  code: '',
  name: '',
  domain: '',
  remark: '',
  binding: '',
  filePath: '',
  type: '0',
  status: true,
  sort: '0',
  field1: '',
  field2: '',
}

export const PAGE_SIZE = 10
export const PERM = 'course:educationplatform:'
export const API = '/api/admin/education-platform'

export const fmt = (s?: string | null) =>
  s
    ? new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(s))
    : '-'

export const textareaCls =
  'flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'code', title: 'col.code' },
  { key: 'name', title: 'col.name' },
  { key: 'domain', title: 'col.domain' },
  { key: 'type', title: 'col.type' },
  { key: 'status', title: 'col.status' },
  { key: 'sort', title: 'col.sort' },
  { key: 'creator', title: 'col.creator' },
  { key: 'createdAt', title: 'col.createdAt' },
]
