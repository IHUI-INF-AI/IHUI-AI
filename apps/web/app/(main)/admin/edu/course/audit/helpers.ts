import type { ExportColumn } from '@/lib/export-utils'
import type { CourseAuditSearch } from './types'

export const PAGE_SIZE = 10
export const PERM = 'course:courseaudit:'

export const fmt = (s?: string | null) =>
  s
    ? new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(s))
    : '-'

export const statusText = (n: number) =>
  n === 0 ? '待审核' : n === 1 ? '待整改' : n === 3 ? '已通过' : String(n)

export const statusClass = (n: number) =>
  n === 3
    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
    : n === 1
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
      : 'bg-muted text-muted-foreground'

export const COURSE_FIELDS: [string, string][] = [
  ['title', '标题'],
  ['subtitle', '副标题'],
  ['content', '内容'],
  ['remark', '备注'],
  ['remarkFile', '备注文件'],
  ['binding', '绑定'],
  ['stage', '阶段'],
  ['isHidden', '是否隐藏'],
  ['sort', '排序'],
  ['createdAt', '创建时间'],
  ['updatedAt', '更新时间'],
]

export const VIDEO_FIELDS: [string, string][] = [
  ['courseId', '课程ID'],
  ['binding', '绑定'],
  ['videoPath', '视频路径'],
  ['title', '标题'],
  ['subtitle', '副标题'],
  ['content', '内容'],
  ['remark', '备注'],
  ['duration', '时长'],
  ['adjunctUrl', '附件'],
  ['isPay', '是否付费'],
  ['amount', '金额'],
  ['status', '状态'],
  ['sort', '排序'],
  ['createdAt', '创建时间'],
  ['updatedAt', '更新时间'],
]

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'type', title: '类型' },
  { key: 'operate', title: '操作' },
  { key: 'sourceId', title: '源ID' },
  { key: 'targetId', title: '目标ID' },
  { key: 'status', title: '状态', formatter: (v) => statusText(Number(v)) },
  { key: 'creator', title: '创建人' },
  { key: 'createdAt', title: '创建时间' },
  { key: 'updator', title: '更新人' },
]

export const EMPTY_SEARCH: CourseAuditSearch = { operate: '', sourceId: '', creator: '' }
