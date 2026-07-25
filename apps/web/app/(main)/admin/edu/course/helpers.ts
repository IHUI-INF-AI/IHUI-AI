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

/** 课程阶段 i18n key 静态映射表(数字枚值 0/1/2):stage.${num} — 用于消除 `t(`stage.${var}`)` 动态拼接 */
export const STAGE_KEY: Record<number, string> = {
  0: 'stage.0',
  1: 'stage.1',
  2: 'stage.2',
}

/** 课程审核状态 i18n key 静态映射表(数字枚值 0/1/2/3/4):audit.${num} — 用于消除 `t(`audit.${var}`)` 动态拼接 */
export const AUDIT_KEY: Record<number, string> = {
  0: 'audit.0',
  1: 'audit.1',
  2: 'audit.2',
  3: 'audit.3',
  4: 'audit.4',
}

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
