'use client'

import { Loader2, CheckCircle2, Check, X } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { LEVEL_STYLE, STATUS_LABEL, STATUS_STYLE } from './helpers'
import type { Alert } from './types'
import { formatDate } from '@/lib/date-utils'

interface Props {
  list: Alert[]
  isLoading: boolean
  ackPending: boolean
  resolvePending: boolean
  onAck: (id: string) => void
  onResolve: (id: string) => void
}

export function AlertTable({
  list,
  isLoading,
  ackPending,
  resolvePending,
  onAck,
  onResolve,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs uppercase">级别</TableHead>
            <TableHead className="text-xs uppercase">标题</TableHead>
            <TableHead className="text-xs uppercase">来源</TableHead>
            <TableHead className="text-xs uppercase">状态</TableHead>
            <TableHead className="text-xs uppercase">时间</TableHead>
            <TableHead className="text-right text-xs uppercase">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                暂无告警
              </TableCell>
            </TableRow>
          ) : (
            list.map((a) => {
              const st = LEVEL_STYLE[a.level]
              const Icon = st.icon
              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs',
                        st.bg,
                        st.text,
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {a.level}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{a.title}</div>
                    <div className="max-w-[300px] break-words text-xs text-muted-foreground">
                      {a.message}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.source}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs',
                        STATUS_STYLE[a.status],
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {STATUS_LABEL[a.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(a.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {a.status === 'active' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={ackPending}
                        onClick={() => onAck(a.id)}
                      >
                        <Check className="h-3.5 w-3.5" />
                        确认
                      </Button>
                    )}
                    {a.status !== 'resolved' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={resolvePending}
                        onClick={() => onResolve(a.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                        解决
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
