'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Webhook, Plus } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { WebhooksList } from './WebhooksList'
import { WebhookDialog } from './WebhookDialog'
import type { WebhookItem } from './types'

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

      <WebhooksList
        list={list}
        isLoading={isLoading}
        dateFmt={dateFmt}
        testPending={testMut.isPending}
        onTest={(id) => testMut.mutate(id)}
        onToggle={(wh) => toggleMut.mutate(wh)}
        onEdit={openEdit}
        onDelete={(id) => delMut.mutate(id)}
      />

      <WebhookDialog
        open={open}
        isEdit={!!editing}
        url={url}
        events={events}
        isPending={saveMut.isPending}
        onOpenChange={(v) => !v && closeDialog()}
        onUrlChange={setUrl}
        onToggleEvent={toggleEvent}
        onSave={() => saveMut.mutate()}
        onCancel={closeDialog}
      />
    </div>
  )
}
