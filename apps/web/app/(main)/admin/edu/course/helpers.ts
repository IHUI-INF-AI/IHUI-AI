import type { ExportColumn } from '@/lib/export-utils'
import { cn } from '@/lib/utils'
import type { CForm } from './types'

export const EMPTY: CForm = {
  title: '',
  subtitle: '',
  content: '',
  remark: '',
  remarkFile: '',
  binding: '',
  stage: '0',
  label: '',
  creator: '',
}

export const PAGE_SIZE = 10
export const PERM = 'course:course:'
export const API = '/api/admin/course'
export const STAGE_TEXT = ['stage.0', 'stage.1', 'stage.2']
export const AUDIT_TEXT = [
  'auditStatus.0',
  'auditStatus.1',
  'auditStatus.2',
  'auditStatus.3',
  'auditStatus.4',
]

export const badgeCls = (ok: boolean) =>
  cn(
    'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
    ok
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
      : 'bg-muted text-muted-foreground',
  )

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'title', title: 'col.title' },
  { key: 'subtitle', title: 'col.subtitle' },
  { key: 'stage', title: 'col.stage', formatter: (v) => STAGE_TEXT[Number(v)] ?? String(v) },
  { key: 'label', title: 'col.label' },
  {
    key: 'auditStatus',
    title: 'col.auditStatus',
    formatter: (v) => AUDIT_TEXT[Number(v)] ?? String(v),
  },
  { key: 'creator', title: 'col.creator' },
]
