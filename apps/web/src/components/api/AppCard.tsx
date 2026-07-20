'use client'

import * as React from 'react'
import { Boxes, MoreHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export interface AppCardItem {
  id: string
  name: string
  desc?: string
  appKey?: string
  status?: 'active' | 'disabled'
  qps?: number
}

export interface AppCardProps {
  app?: AppCardItem
  onClick?: () => void
  onMenu?: (action: string) => void
  className?: string
}

export default function AppCard({
  app,
  onClick,
  onMenu,
  className,
}: AppCardProps): React.JSX.Element {
  const t = useTranslations('a11y')
  const a = app ?? { id: '', name: '', desc: '', status: 'active' as const }
  return (
    <div className={cn('rounded-xl border bg-card p-4 text-card-foreground shadow', className)}>
      <div className="flex items-start justify-between">
        <button
          type="button"
          onClick={onClick}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Boxes className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{a.name}</div>
            {a.desc && <div className="truncate text-xs text-muted-foreground">{a.desc}</div>}
          </div>
        </button>
        {onMenu && (
          <button
            type="button"
            onClick={() => onMenu('more')}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={t('more')}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>
      {a.appKey && (
        <div className="mt-3 flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-xs">
          <span className="text-muted-foreground">AppKey</span>
          <code className="font-mono">{a.appKey}</code>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span
          className={cn(
            'inline-flex items-center gap-1',
            a.status === 'active' ? 'text-emerald-500' : 'text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              a.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground',
            )}
          />
          {a.status === 'active' ? '运行中' : '已停用'}
        </span>
        {a.qps !== undefined && <span>QPS: {a.qps}</span>}
      </div>
    </div>
  )
}
