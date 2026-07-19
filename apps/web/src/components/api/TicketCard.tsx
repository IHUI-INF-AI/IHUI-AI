'use client'

import * as React from 'react'
import { MessageSquare, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed'

export interface TicketItem {
  id: string
  title: string
  category?: string
  status?: TicketStatus
  priority?: 'low' | 'medium' | 'high'
  createdAt?: string
  replyCount?: number
}

export interface TicketCardProps {
  ticket?: TicketItem
  onClick?: () => void
  className?: string
}

const STATUS_TEXT: Record<TicketStatus, string> = {
  open: '待处理',
  pending: '处理中',
  resolved: '已解决',
  closed: '已关闭',
}

const PRIORITY_COLOR: Record<NonNullable<TicketItem['priority']>, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-amber-500/10 text-amber-600',
  high: 'bg-destructive/10 text-destructive',
}

export default function TicketCard({
  ticket,
  onClick,
  className,
}: TicketCardProps): React.JSX.Element {
  const t = ticket ?? { id: '', title: '', status: 'open' as const }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left text-card-foreground shadow hover:shadow-md',
        className,
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <MessageSquare className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{t.title}</span>
          {t.priority && (
            <span
              className={cn('shrink-0 rounded px-1.5 py-0.5 text-xs', PRIORITY_COLOR[t.priority])}
            >
              {t.priority === 'high' ? '高' : t.priority === 'medium' ? '中' : '低'}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {t.category && <span>{t.category}</span>}
          {t.createdAt && <span>{t.createdAt}</span>}
          {t.replyCount !== undefined && <span>{t.replyCount} 条回复</span>}
        </div>
      </div>
      <span
        className={cn(
          'shrink-0 rounded px-2 py-0.5 text-xs',
          t.status === 'resolved' || t.status === 'closed'
            ? 'bg-emerald-500/10 text-emerald-600'
            : 'bg-amber-500/10 text-amber-600',
        )}
      >
        {STATUS_TEXT[t.status ?? 'open']}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  )
}
