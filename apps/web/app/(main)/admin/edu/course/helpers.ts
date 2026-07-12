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
export const STAGE_TEXT = ['初级', '中级', '高级']
export const AUDIT_TEXT = ['待审核', '审核中', '待整改', '已驳回', '已通过']

export const badgeCls = (ok: boolean) =>
  cn(
    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
    ok
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
      : 'bg-muted text-muted-foreground',
  )

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'title', title: '标题' },
  { key: 'subtitle', title: '副标题' },
  { key: 'stage', title: '阶段', formatter: (v) => STAGE_TEXT[Number(v)] ?? String(v) },
  { key: 'label', title: '标签' },
  {
    key: 'auditStatus',
    title: '审核状态',
    formatter: (v) => AUDIT_TEXT[Number(v)] ?? String(v),
  },
  { key: 'creator', title: '创建人' },
]
