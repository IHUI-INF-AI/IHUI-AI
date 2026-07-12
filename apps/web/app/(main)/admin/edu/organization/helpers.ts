import type { ExportColumn } from '@/lib/export-utils'
import type { Organization, OrganizationForm, OrganizationSearch } from './types'

export const PAGE_SIZE = 10
export const PERM = 'course:organization:'

export const EMPTY_FORM: OrganizationForm = {
  uuid: '',
  platformId: '',
  name: '',
  remark: '',
  filePath: '',
  binding: '',
}

export const EMPTY_SEARCH: OrganizationSearch = {
  platformId: '',
  name: '',
}

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'uuid', title: 'UUID' },
  { key: 'platformId', title: 'col.platformId' },
  { key: 'name', title: 'col.name' },
  { key: 'remark', title: 'col.remark' },
  { key: 'filePath', title: 'col.filePath' },
  { key: 'creator', title: 'col.creator' },
  { key: 'createdAt', title: 'col.createdAt' },
]

export const textareaCls =
  'flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const fmt = (s?: string | null) =>
  s
    ? new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(s))
    : '-'

export function organizationToForm(r: Organization): OrganizationForm {
  return {
    uuid: r.uuid,
    platformId: r.platformId,
    name: r.name,
    remark: r.remark ?? '',
    filePath: r.filePath ?? '',
    binding: r.binding ?? '',
  }
}
