'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, Bell, Loader2 } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'
import { ChannelsTable } from './ChannelsTable'
import { ChannelDialog } from './ChannelDialog'
import {
  RESOURCE,
  PAGE_SIZE,
  EMPTY_FORM,
  api,
  itemToForm,
  type Item,
  type ListData,
  type FormState,
} from './helpers'

export default function NotificationChannelsPage() {
  const t = useTranslations('adminTools.notificationChannels')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Item | null>(null)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [delId, setDelId] = React.useState<string | null>(null)

  const qs = React.useMemo(
    () => new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) }).toString(),
    [page],
  )

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'notification-channels', qs],
    queryFn: () => api<ListData>(`${RESOURCE}?${qs}`),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const saveMut = useMutation({
    mutationFn: async () => {
      let config: Record<string, unknown> = {}
      if (form.configText.trim()) {
        try {
          config = JSON.parse(form.configText)
        } catch {
          throw new Error(t('configHint'))
        }
      }
      const body = {
        name: form.name.trim(),
        type: form.type,
        config,
        isActive: form.isActive,
        remark: form.remark.trim() || undefined,
      }
      return editing
        ? api<Item>(`${RESOURCE}/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api<Item>(RESOURCE, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'notification-channels'] })
      toast.success(t('saved'))
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`${RESOURCE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'notification-channels'] })
      toast.success(t('saved'))
      setDelId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }
  function openEdit(item: Item) {
    setEditing(item)
    setForm(itemToForm(item))
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error(t('required'))
      return
    }
    saveMut.mutate()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Bell className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('createChannel')}
        </Button>
      </div>

      <ChannelsTable
        list={list}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={(id) => setDelId(id)}
      />

      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t('totalInfo', { total, page, totalPages })}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {t('prevPage')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              {t('nextPage')}
            </Button>
          </div>
        </div>
      )}

      <ChannelDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={close}
      />

      <Dialog
        open={delId !== null}
        onOpenChange={(o) => {
          if (!o) setDelId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmDelete')}</DialogTitle>
            <DialogDescription>{t('deleteWarning')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDelId(null)}
              disabled={delMut.isPending}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={delMut.isPending}
              onClick={() => delId && delMut.mutate(delId)}
            >
              {delMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
