import type { PForm, Plan } from './types'

export const PAGE_SIZE = 10

export const EMPTY: PForm = {
  title: '',
  userId: '',
  startDate: '',
  endDate: '',
  targetHours: '10',
  status: 'active',
}

export const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active: {
    label: 'statusActive',
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  },
  completed: { label: 'statusCompleted', cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  expired: { label: 'statusExpired', cls: 'bg-muted text-muted-foreground' },
}

export function planToForm(p: Plan): PForm {
  return {
    title: p.title,
    userId: p.userId,
    startDate: p.startDate,
    endDate: p.endDate,
    targetHours: String(p.targetHours),
    status: p.status,
  }
}
