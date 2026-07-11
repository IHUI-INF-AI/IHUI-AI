/** 状态徽章颜色映射 - 统一规范，禁止使用蓝色 */
export const STATUS_COLORS: Record<string, string> = {
  // draft/未发布/archived → muted 灰
  draft: 'bg-muted text-muted-foreground',
  unpublished: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground',
  inactive: 'bg-muted text-muted-foreground',
  disabled: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',

  // published/active/approved/paid/completed → emerald 绿
  published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  verified: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  enabled: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',

  // pending/processing → amber 琥珀
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  processing: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  reviewing: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  submitted: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  open: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  idle: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',

  // rejected/failed/cancelled → red 红
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400',
  error: 'bg-red-500/10 text-red-600 dark:text-red-400',
  closed: 'bg-red-500/10 text-red-600 dark:text-red-400',

  // refunded → primary
  refunded: 'bg-primary/10 text-primary',
}

/** 获取状态颜色，未知状态默认返回 muted */
export function getStatusColor(status: string): string {
  return STATUS_COLORS[status.toLowerCase()] ?? 'bg-muted text-muted-foreground'
}
