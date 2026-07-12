import { cn } from '@/lib/utils'
import type { CForm, Video } from './types'

export const PAGE_SIZE = 10
export const PERM = 'course:coursevideo:'
export const API = '/api/admin/course-video'
export const LEVEL_TEXT = ['初级', '中级', '高级']
export const AUDIT_TEXT = ['待审核', '审核中', '待整改', '已驳回', '已通过']

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
  { key: 'courseId', label: '课程ID' },
  { key: 'videoPath', label: '视频路径' },
  { key: 'title', label: '标题' },
  { key: 'subtitle', label: '副标题' },
  { key: 'lecturer', label: '讲师' },
  { key: 'duration', label: '时长' },
  { key: 'adjunctUrl', label: '附件URL' },
  { key: 'amount', label: '金额' },
  { key: 'label', label: '标签' },
  { key: 'agentIds', label: '代理IDs' },
  { key: 'hot', label: '热度' },
  { key: 'collect', label: '收藏' },
  { key: 'sort', label: '排序' },
  { key: 'creator', label: '创建人' },
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
