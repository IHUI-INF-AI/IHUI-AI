import type { ExportColumn } from '@/lib/export-utils'
import type { ZhsIdentity, CForm, Search } from './types'

export const PAGE_SIZE = 10
export const PERM = 'course:zhsidentity:'

export const EMPTY: CForm = {
  uuid: '',
  name: '',
  platformId: '',
  organizationId: '',
  parentId: '',
  remark: '',
  binding: '',
  isCross: '0',
}

export const EMPTY_SEARCH: Search = {
  uuid: '',
  name: '',
  platformId: '',
  organizationId: '',
}

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'uuid', title: 'UUID' },
  { key: 'name', title: 'col.name' },
  { key: 'platformId', title: 'col.platformId' },
  { key: 'organizationId', title: 'col.orgId' },
  { key: 'parentId', title: 'col.parentId' },
  { key: 'isCross', title: 'col.crossOrg' },
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

export function zhsIdentityToForm(r: ZhsIdentity): CForm {
  return {
    uuid: r.uuid,
    name: r.name,
    platformId: r.platformId,
    organizationId: r.organizationId,
    parentId: r.parentId ?? '',
    remark: r.remark ?? '',
    binding: r.binding ?? '',
    isCross: String(r.isCross ?? 0),
  }
}
