import type { ClassGroup, CForm } from './types'

export const PAGE_SIZE = 10

export const EMPTY: CForm = {
  name: '',
  courseId: '',
  teacherName: '',
  startDate: '',
  endDate: '',
  status: 'active',
}

export const STATUS_CLASS: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  ended: 'bg-muted text-muted-foreground',
}

export function classToForm(c: ClassGroup): CForm {
  return {
    name: c.name,
    courseId: c.courseId ?? '',
    teacherName: c.teacherName ?? '',
    startDate: c.startDate,
    endDate: c.endDate,
    status: c.status,
  }
}
