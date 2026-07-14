import type { HForm, Homework } from './types'

export const EMPTY: HForm = {
  title: '',
  description: '',
  lessonId: '',
  dueDate: '',
  status: 'active',
}

export const PAGE_SIZE = 10

export const STATUS_MAP: Record<string, { labelKey: string; cls: string }> = {
  active: {
    labelKey: 'statusActive',
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  },
  closed: { labelKey: 'statusClosed', cls: 'bg-muted text-muted-foreground' },
  draft: { labelKey: 'statusDraft', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
}

export function homeworkToForm(h: Homework): HForm {
  return {
    title: h.title,
    description: h.description ?? '',
    lessonId: '',
    dueDate: h.dueDate ?? '',
    status: h.status,
  }
}
