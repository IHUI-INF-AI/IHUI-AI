'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Webhook, Plus, Trash2, Send, Loader2, Power, Pencil } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Card,
  CardContent,
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface WebhookItem {
  id: string
  url: string
  events: string[]
  isEnabled: boolean
  createdAt: string
  lastTriggeredAt?: string
}

const ALL_EVENTS = [
  'api.called',
  'key.created',
  'key.deleted',
  'limit.reached',
  'webhook.failed',
  'subscription.updated',
]

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function WebhooksPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<WebhookItem | null>(null)
  const [url, setUrl] = React.useState('')
  const [events, setEvents] = React.useState<string[]>([])

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const {
    data: list = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['developer', 'webhooks'],
    queryFn: () => api<WebhookItem[]>('/api/developer/webhooks').catch(() => [] as WebhookItem[]),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({ url, events })
      return editing
        ? api(`/api/developer/webhooks/${editing.id}`, { method: 'PUT', body })
        : api('/api/developer/webhooks', { method: 'POST', body })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'webhooks'] })
      closeDialog()
      toast.success(editing ? 'Webhook 已更新' : 'Webhook 已创建')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/developer/webhooks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'webhooks'] })
      toast.success('Webhook 已删除')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleMut = useMutation({
    mutationFn: (wh: WebhookItem) =>
      api(`/api/developer/webhooks/${wh.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isEnabled: !wh.isEnabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['developer', 'webhooks'] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const testMut = useMutation({
    mutationFn: (id: string) => api(`/api/developer/webhooks/${id}/test`, { method: 'POST' }),
    onSuccess: () => toast.success('测试消息已发送'),
    onError: (e: Error) => toast.error(e.message),
  })

  function closeDialog() {
    setOpen(false)
    setEditing(null)
    setUrl('')
    setEvents([])
  }

  function openEdit(wh: WebhookItem) {
    setEditing(wh)
    setUrl(wh.url)
    setEvents(wh.events)
    setOpen(true)
  }

  function toggleEvent(ev: string) {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((x) => x !== ev) : [...prev, ev]))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Webhook className="h-5 w-5 text-primary" />
            Webhook 配置
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">接收平台事件回调通知</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            closeDialog()
            setOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          新建 Webhook
        </Button>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

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
                            'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
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
                            className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
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
                        onClick={() => testMut.mutate(wh.id)}
                        disabled={testMut.isPending}
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleMut.mutate(wh)}>
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(wh)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => confirm('确认删除?') && delMut.mutate(wh.id)}
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

      <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '编辑 Webhook' : '新建 Webhook'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-sm">回调 URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/webhook"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">订阅事件</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_EVENTS.map((ev) => (
                  <button
                    key={ev}
                    type="button"
                    onClick={() => toggleEvent(ev)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs transition-colors',
                      events.includes(ev)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {ev}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={!url.trim() || events.length === 0 || saveMut.isPending}
            >
              {saveMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
