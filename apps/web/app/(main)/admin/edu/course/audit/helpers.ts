import type { ExportColumn } from '@/lib/export-utils'
import type { CourseAuditSearch } from './types'

export const PAGE_SIZE = 10
export const PERM = 'course:courseaudit:'

/** 审计操作类型 → i18n key 映射(2026-07-25 补充,补齐 CourseAuditTable 的 type 字段翻译)
 * - 数字 → 翻译 key 字符串,t('type.xxx') 渲染
 * - 未知值兜底 'type.unknown' */
export const TYPE_KEY: Record<number, string> = {
  1: 'type.create',
  2: 'type.update',
  3: 'type.delete',
  4: 'type.publish',
  5: 'type.unpublish',
  6: 'type.archive',
  7: 'type.restore',
}

export const fmt = (s?: string | null) =>
  s
    ? new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(s))
    : '-'

export const statusText = (n: number) =>
  n === 0 ? 'status.0' : n === 1 ? 'status.1' : n === 3 ? 'status.3' : String(n)

export const statusClass = (n: number) =>
  n === 3
    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
    : n === 1
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
      : 'bg-muted text-muted-foreground'

export const COURSE_FIELDS: [string, string][] = [
  ['title', 'field.title'],
  ['subtitle', 'field.subtitle'],
  ['content', 'field.content'],
  ['remark', 'field.remark'],
  ['remarkFile', 'field.remarkFile'],
  ['binding', 'field.binding'],
  ['stage', 'field.stage'],
  ['isHidden', 'field.isHidden'],
  ['sort', 'field.sort'],
  ['createdAt', 'field.createdAt'],
  ['updatedAt', 'field.updatedAt'],
]

export const VIDEO_FIELDS: [string, string][] = [
  ['courseId', 'field.courseId'],
  ['binding', 'field.binding'],
  ['videoPath', 'field.videoPath'],
  ['title', 'field.title'],
  ['subtitle', 'field.subtitle'],
  ['content', 'field.content'],
  ['remark', 'field.remark'],
  ['duration', 'field.duration'],
  ['adjunctUrl', 'field.attachment'],
  ['isPay', 'field.isPaid'],
  ['amount', 'field.amount'],
  ['status', 'field.status'],
  ['sort', 'field.sort'],
  ['createdAt', 'field.createdAt'],
  ['updatedAt', 'field.updatedAt'],
]

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'type', title: 'col.type' },
  { key: 'operate', title: 'col.action' },
  { key: 'sourceId', title: 'col.sourceId' },
  { key: 'targetId', title: 'col.targetId' },
  { key: 'status', title: 'col.status', formatter: (v) => statusText(Number(v)) },
  { key: 'creator', title: 'col.creator' },
  { key: 'createdAt', title: 'col.createdAt' },
  { key: 'updator', title: 'col.updater' },
]

export const EMPTY_SEARCH: CourseAuditSearch = { operate: '', sourceId: '', creator: '' }
