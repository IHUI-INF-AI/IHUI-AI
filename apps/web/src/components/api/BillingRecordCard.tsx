'use client'

import * as React from 'react'
import { Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BillingRecord {
  id: string
  apiName?: string
  method?: string
  tokens?: number
  cost?: number | string
  status?: 'success' | 'failed'
  createdAt?: string
}

export interface BillingRecordCardProps {
  record?: BillingRecord
  onClick?: () => void
  className?: string
}

export default function BillingRecordCard({
  record,
  onClick,
  className,
}: BillingRecordCardProps): React.JSX.Element {
  const r = record ?? { id: '', status: 'success' as const }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left text-card-foreground shadow hover:shadow-md',
        className,
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Receipt className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">
            {r.apiName ?? r.method ?? '调用记录'}
          </span>
          {r.cost !== undefined && <span className="shrink-0 text-sm font-medium">¥{r.cost}</span>}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {r.method && <code className="font-mono">{r.method}</code>}
          {r.tokens !== undefined && <span>{r.tokens} tokens</span>}
          {r.createdAt && <span>{r.createdAt}</span>}
        </div>
      </div>
      <span
        className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-xs',
          r.status === 'failed'
            ? 'bg-destructive/10 text-destructive'
            : 'bg-emerald-500/10 text-emerald-600',
        )}
      >
        {r.status === 'failed' ? '失败' : '成功'}
      </span>
    </button>
  )
}
