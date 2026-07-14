import type { LForm, Live } from './types'

export const PAGE_SIZE = 10

export const EMPTY: LForm = {
  title: '',
  lecturerName: '',
  startTime: '',
  status: 'upcoming',
}

export const STATUS_MAP: Record<string, { labelKey: string; cls: string }> = {
  upcoming: {
    labelKey: 'statusUpcoming',
    cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  ongoing: { labelKey: 'statusOngoing', cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  ended: { labelKey: 'statusEnded', cls: 'bg-muted text-muted-foreground' },
}

export function liveToForm(l: Live): LForm {
  return {
    title: l.title,
    lecturerName: l.lecturerName ?? '',
    startTime: l.startTime,
    status: l.status,
  }
}
