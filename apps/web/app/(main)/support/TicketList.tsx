'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Ticket } from 'lucide-react'

import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { api, STATUS_LABEL, STATUS_BADGE } from './helpers'
import type { Ticket as TicketType } from './types'
import { TicketDetailDialog } from './TicketDetailDialog'
import { formatDate } from '@/lib/date-utils'

export function TicketList({ onSwitchToNew }: { onSwitchToNew: () => void }) {
  const [selected, setSelected] = React.useState<TicketType | null>(null)
  const [open, setOpen] = React.useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['cs-tickets'],
    queryFn: () => api<{ list: TicketType[]; total: number }>(`/api/customer-service/tickets`),
  })

  const list = data?.list ?? []

  function openDetail(t: TicketType) {
    setSelected(t)
    setOpen(true)
  }

  return (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <Ticket className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">暂无工单</p>
          <Button size="sm" variant="outline" onClick={onSwitchToNew} className="mt-1">
            提交第一个工单
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((t) => (
            <button
              key={t.id}
              onClick={() => openDetail(t)}
              className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <Ticket className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium">{t.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t.ticketNo} · {formatDate(t.createdAt)}
                </p>
              </div>
              <span
                className={cn(
                  'inline-flex shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
                  STATUS_BADGE[t.status],
                )}
              >
                {STATUS_LABEL[t.status]}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <TicketDetailDialog
          ticket={selected}
          open={open}
          onOpenChange={(o) => {
            setOpen(o)
            if (!o) setSelected(null)
          }}
        />
      )}
    </>
  )
}
