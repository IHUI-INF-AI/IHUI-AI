import { cn } from '@/lib/utils'
import type { CForm, Video } from './types'

export const PAGE_SIZE = 10
export const PERM = 'course:coursevideo:'
export const API = '/api/admin/course-video'
export const LEVEL_TEXT = ['level.0', 'level.1', 'level.2']
export const AUDIT_TEXT = ['audit.0', 'audit.1', 'audit.2', 'audit.3', 'audit.4']

export const EMPTY_FORM: CForm = {
  courseId: '',
  videoPath: '',
  title: '',
  subtitle: '',
  lecturer: '',
  duration: '',
  adjunctUrl: '',
  amount: '0',
  label: '',
  agentIds: '',
  hot: '0',
  collect: '0',
  sort: '0',
  creator: '',
  binding: '',
  content: '',
  remark: '',
  isPay: '0',
  status: '0',
  auditStatus: '0',
}

export const TEXT_FIELDS: { key: keyof CForm; label: string }[] = [
  { key: 'courseId', label: 'field.courseId' },
  { key: 'videoPath', label: 'field.videoPath' },
  { key: 'title', label: 'field.title' },
  { key: 'subtitle', label: 'field.subtitle' },
  { key: 'lecturer', label: 'field.lecturer' },
  { key: 'duration', label: 'field.duration' },
  { key: 'adjunctUrl', label: 'field.attachmentUrl' },
  { key: 'amount', label: 'field.amount' },
  { key: 'label', label: 'field.label' },
  { key: 'agentIds', label: 'field.agentIds' },
  { key: 'hot', label: 'field.popularity' },
  { key: 'collect', label: 'field.favorites' },
  { key: 'sort', label: 'field.sort' },
  { key: 'creator', label: 'field.creator' },
]

export function badgeCls(ok: boolean) {
  return cn(
    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
    ok
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
      : 'bg-muted text-muted-foreground',
  )
}

export function videoToForm(r: Video): CForm {
  return {
    courseId: r.courseId ?? '',
    videoPath: r.videoPath ?? '',
    title: r.title ?? '',
    subtitle: r.subtitle ?? '',
    lecturer: r.lecturer ?? '',
    duration: r.duration ?? '',
    adjunctUrl: r.adjunctUrl ?? '',
    amount: r.amount ?? '0',
    label: r.label ?? '',
    agentIds: r.agentIds ?? '',
    hot: String(r.hot ?? 0),
    collect: String(r.collect ?? 0),
    sort: String(r.sort ?? 0),
    creator: r.creator ?? '',
    binding: r.binding ?? '',
    content: r.content ?? '',
    remark: r.remark ?? '',
    isPay: String(r.isPay ?? 0),
    status: String(r.status ?? 0),
    auditStatus: String(r.auditStatus ?? 0),
  }
}
