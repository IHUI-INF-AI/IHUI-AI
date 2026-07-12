import {
  BarChart3,
  Users,
  GraduationCap,
  FileText,
  BookOpen,
  Award,
  TrendingUp,
} from 'lucide-react'
import { fetchApi } from '@/lib/api'
import type { OverviewStatistics } from './types'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function buildOverviewCards(t: (key: string) => string, overview?: OverviewStatistics) {
  return [
    { label: t('members'), value: overview?.memberTotal ?? 0, icon: Users, color: 'text-primary' },
    {
      label: t('lessons'),
      value: overview?.lessonTotal ?? 0,
      icon: GraduationCap,
      color: 'text-primary',
    },
    {
      label: t('exams'),
      value: overview?.examTotal ?? 0,
      icon: FileText,
      color: 'text-purple-600',
    },
    {
      label: t('signups'),
      value: overview?.signupTotal ?? 0,
      icon: BookOpen,
      color: 'text-emerald-600',
    },
    {
      label: t('examRecords'),
      value: overview?.examRecordTotal ?? 0,
      icon: Award,
      color: 'text-orange-600',
    },
    {
      label: t('posts'),
      value: overview?.postTotal ?? 0,
      icon: TrendingUp,
      color: 'text-pink-600',
    },
    {
      label: t('announcements'),
      value: overview?.announcementTotal ?? 0,
      icon: BarChart3,
      color: 'text-cyan-600',
    },
    {
      label: t('articles'),
      value: overview?.articleTotal ?? 0,
      icon: BookOpen,
      color: 'text-indigo-600',
    },
  ]
}
