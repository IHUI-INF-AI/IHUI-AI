'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, FolderCog, Plus, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

// 对齐后端 AdminProjectRow
interface AdminProject {
  id: string
  userId: string
  name: string
  description: string | null
  status: number
  createdAt: string
  updatedAt: string
  ownerNickname: string | null
  ownerAvatar: string | null
  ownerPhone: string | null
  ownerEmail: string | null
}

interface PageData {
  list: AdminProject[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 12
const STATUS_OPTS = [0, 1, 2]
const STATUS_BADGE: Record<number, string> = {
  0: 'bg-red-500/10 text-red-600 dark:text-red-500',
  1: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  2: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
}
const EMPTY = { userId: '', name: '', description: '', status: 1 }
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function AdminProjectsPage() {
  const t = useTranslations('admin.projects')
  const tc = useTranslations('common')
  const locale = useLocale()
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AdminProject | null>(null)
  const [delTarget, setDelTarget] = React.useState<AdminProject | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'projects', page],
    queryFn: async () => api<PageData>(`/api/admin/projects?page=${page}&pageSize=${PAGE_SIZE}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
      }
      if (editing) {
        body.status = form.status
        return api(`/api/admin/projects/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      }
      body.userId = form.userId.trim()
      body.status = form.status
      return api('/api/admin/projects', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'projects'] })
      close()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'projects'] })
      setDelTarget(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(p: AdminProject) {
    setEditing(p)
    setForm({ userId: p.userId, name: p.name, description: p.description ?? '', status: p.status })
    setErr(null)
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) {
      setErr(t('nameRequired'))
      return
    }
    if (!editing && !form.userId.trim()) {
      setErr(t('userIdRequired'))
      return
    }
    saveMut.mutate()
  }

  const projects = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FolderCog className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <FolderCog className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('noData')}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Card key={p.id} className="transition-colors hover:bg-accent hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="flex min-w-0 items-center gap-2">
                      <FolderCog className="h-4 w-4 shrink-0 text-primary" />
                      <span className="break-words">{p.name}</span>
                    </span>
                    <span
                      className={cn(
                        'inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_BADGE[p.status] ?? 'bg-muted text-muted-foreground',
                      )}
                    >
                      {t(`status_${p.status}`)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {p.description && <p className="text-muted-foreground">{p.description}</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('owner')}</span>
                    <span className="font-medium">
                      {p.ownerNickname ?? p.ownerPhone ?? p.ownerEmail ?? p.userId.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-muted-foreground">{t('createdAt')}</span>
                    <span className="text-xs text-muted-foreground">
                      {dateFmt.format(new Date(p.createdAt))}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 border-t pt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      onClick={() => openEdit(p)}
                    >
                      <Edit className="h-4 w-4" />
                      {tc('edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setErr(null)
                        setDelTarget(p)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      {tc('delete')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(Math.max(1, page - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                {t('prev')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('page', { page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                {t('next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
              <DialogDescription>{editing ? t('editDesc') : t('createDesc')}</DialogDescription>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            {!editing && (
              <div className="space-y-2">
                <Label htmlFor="p-userId">{t('fieldUserId')}</Label>
                <Input
                  id="p-userId"
                  value={form.userId}
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  placeholder={t('userIdPlaceholder')}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="p-name">{t('fieldName')}</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-desc">{t('fieldDescription')}</Label>
              <textarea
                id="p-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('descPlaceholder')}
                rows={3}
                className={textareaClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-status">{t('fieldStatus')}</Label>
              <Select
                value={String(form.status)}
                onValueChange={(v) => setForm({ ...form, status: Number(v) })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {t(`status_${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saveMut.isPending}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!delTarget}
        onOpenChange={(o) => (!o && !delMut.isPending ? setDelTarget(null) : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteConfirm')}</DialogDescription>
          </DialogHeader>
          {delTarget && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
              <div className="font-medium">{delTarget.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {t('owner')}:{' '}
                {delTarget.ownerNickname ?? delTarget.ownerPhone ?? delTarget.ownerEmail ?? '-'} ·{' '}
                {t(`status_${delTarget.status}`)}
              </div>
            </div>
          )}
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDelTarget(null)}
              disabled={delMut.isPending}
            >
              {tc('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={delMut.isPending}
              onClick={() => delMut.mutate(delTarget!.id)}
            >
              {delMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
