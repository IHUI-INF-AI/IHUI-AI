export const PAGE_SIZE = 10

export const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-500',
  refunding: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  refunded: 'bg-primary/10 text-primary',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-500',
  processing: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  issued: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  rejected: 'bg-rose-500/10 text-rose-600 dark:text-rose-500',
}

export const thCls = 'px-4 py-2.5 font-medium'
export const tdCls = 'px-4 py-2.5'
