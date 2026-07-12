import {
  Radio,
  FileStack,
  FolderTree,
  ListOrdered,
  ClipboardList,
  TrendingUp,
  CalendarDays,
  Bell,
  Users,
  Trophy,
} from 'lucide-react'
import type { LForm, Lesson } from './types'

export const PAGE_SIZE = 10

export const EMPTY: LForm = {
  title: '',
  categoryId: '',
  intro: '',
  lecturerName: '',
  price: '0',
  isFree: false,
  isPublished: false,
  sort: '0',
}

export const SUB_LINKS = [
  { href: '/admin/edu/learn/live', label: '直播学习', icon: Radio },
  { href: '/admin/edu/learn/recorded', label: '录播学习', icon: FileStack },
  { href: '/admin/edu/learn/materials', label: '资料学习', icon: FolderTree },
  { href: '/admin/edu/learn/homework', label: '作业学习', icon: ClipboardList },
  { href: '/admin/edu/learn/records', label: '学习记录', icon: ListOrdered },
  { href: '/admin/edu/learn/progress', label: '学习进度', icon: TrendingUp },
  { href: '/admin/edu/learn/plan', label: '学习计划', icon: CalendarDays },
  { href: '/admin/edu/learn/remind', label: '学习提醒', icon: Bell },
  { href: '/admin/edu/learn/community', label: '学习社区', icon: Users },
  { href: '/admin/edu/learn/ranking', label: '学习排行', icon: Trophy },
]

export function lessonToForm(l: Lesson): LForm {
  return {
    title: l.title,
    categoryId: l.categoryId ?? '',
    intro: l.intro ?? '',
    lecturerName: l.lecturerName ?? '',
    price: l.price,
    isFree: l.isFree,
    isPublished: l.isPublished,
    sort: String(l.sort),
  }
}
