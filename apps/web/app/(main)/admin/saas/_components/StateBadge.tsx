/**
 * P1-2.2: 租户状态徽章
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

import type { TenantState } from '../types'

const STATE_MAP: Record<TenantState, { className: string; dotClassName: string; labelKey: string }> = {
  active: {
    className:
      'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    dotClassName: 'bg-emerald-500',
    labelKey: 'stateActive',
  },
  paused: {
    className:
      'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    dotClassName: 'bg-amber-500',
    labelKey: 'statePaused',
  },
  creating: {
    className: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400',
    dotClassName: 'bg-sky-500',
    labelKey: 'stateCreating',
  },
  'not-found': {
    className: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
    dotClassName: 'bg-rose-500',
    labelKey: 'stateNotFound',
  },
  destroyed: {
    className: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
    dotClassName: 'bg-rose-500',
    labelKey: 'stateNotFound',
  },
}

interface StateBadgeProps {
  state: TenantState | string
  className?: string
}

export function StateBadge({ state, className }: StateBadgeProps) {
  const t = useTranslations('admin.saas')
  const cfg = STATE_MAP[state as TenantState] ?? STATE_MAP['not-found']
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        cfg.className,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotClassName)} />
      {t(cfg.labelKey)}
    </span>
  )
}
