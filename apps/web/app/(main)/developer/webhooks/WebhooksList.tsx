'use client'

import { Loader2, Send, Power, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent, Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { WebhookItem } from './types'

interface Props {
  list: WebhookItem[]
  isLoading: boolean
  dateFmt: Intl.DateTimeFormat
  testPending: boolean
  onTest: (id: string) => void
  onToggle: (wh: WebhookItem) => void
  onEdit: (wh: WebhookItem) => void
  onDelete: (id: string) => void
}

export function WebhooksList({
  list,
  isLoading,
  dateFmt,
  testPending,
  onTest,
  onToggle,
  onEdit,
  onDelete,
}: Props) {
  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : list.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">暂无 Webhook 配置</p>
        ) : (
          <div className="divide-y">
            {list.map((wh) => (
              <div key={wh.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{wh.url}</p>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium',
                          wh.isEnabled
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {wh.isEnabled ? '启用' : '停用'}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {wh.events.map((ev) => (
                        <span
                          key={ev}
                          className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      创建于 {dateFmt.format(new Date(wh.createdAt))}
                      {wh.lastTriggeredAt &&
                        ` · 最近触发 ${dateFmt.format(new Date(wh.lastTriggeredAt))}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onTest(wh.id)}
                      disabled={testPending}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onToggle(wh)}>
                      <Power className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onEdit(wh)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => confirm('确认删除?') && onDelete(wh.id)}
                      className="text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
