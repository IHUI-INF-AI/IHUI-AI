'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Ticket } from 'lucide-react'
import { Button, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { useLocale } from 'next-intl'
import {
  type Ticket as TicketType,
  type TicketStatus,
  type TicketPriority,
  api,
  STATUS_LABEL,
  STATUS_BADGE,
  PRIORITY_LABEL,
  PRIORITY_BADGE,
} from './types'
import { TicketDetailDialog } from './TicketDetailDialog'

export function TicketsPanel() {
  const qc = useQueryClient()
  const locale = useLocale()
  const [status, setStatus] = React.useState('all')
  const [priority, setPriority] = React.useState('all')
  const [selected, setSelected] = React.useState<TicketType | null>(null)
  const [open, setOpen] = React.useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'cs-tickets', status, priority],
    queryFn: async () => {
      const qs = new URLSearchParams()
      if (status !== 'all') qs.set('status', status)
      if (priority !== 'all') qs.set('priority', priority)
      const suffix = qs.toString() ? `?${qs.toString()}` : ''
      return api<{ list: TicketType[]; total: number }>(
        `/api/admin/customer-service/tickets${suffix}`,
      )
    },
  })

  const list = data?.list ?? []

  function openDetail(t: TicketType) {
    setSelected(t)
    setOpen(true)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="优先级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部优先级</SelectItem>
            {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">工单号</th>
              <th className="px-4 py-2.5 font-medium">标题</th>
              <th className="px-4 py-2.5 font-medium">状态</th>
              <th className="px-4 py-2.5 font-medium">优先级</th>
              <th className="px-4 py-2.5 font-medium">创建时间</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Ticket className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无工单
                </td>
              </tr>
            ) : (
              list.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={() => openDetail(t)}
                >
                  <td className="px-4 py-2.5 font-mono text-xs">{t.ticketNo}</td>
                  <td className="max-w-xs break-words px-4 py-2.5 font-medium">{t.title}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_BADGE[t.status],
                      )}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        PRIORITY_BADGE[t.priority],
                      )}
                    >
                      {PRIORITY_LABEL[t.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {new Intl.DateTimeFormat(locale).format(new Date(t.createdAt))}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        openDetail(t)
                      }}
                    >
                      处理
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <TicketDetailDialog
          ticket={selected}
          open={open}
          onOpenChange={(o) => {
            setOpen(o)
            if (!o) {
              qc.invalidateQueries({ queryKey: ['admin', 'cs-tickets'] })
              setSelected(null)
            }
          }}
        />
      )}
    </div>
  )
}
