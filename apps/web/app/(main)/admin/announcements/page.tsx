'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Megaphone, Plus, Edit, Trash2, Pin, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ihui/ui'
import { cn } from '@/lib/utils'

type AnnType = 'info' | 'warning' | 'maintenance' | 'update'

interface Announcement {
  id: string
  title: string
  content: string
  type: AnnType
  isPinned: boolean
  isPublished: boolean
  publishedAt?: string
  updatedAt?: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

async function fetchList(): Promise<Announcement[]> {
  const raw = await api<{ list?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
    '/api/admin/messages/announcements?includeUnpublished=true',
  )
  const arr = Array.isArray(raw) ? raw : (raw.list ?? [])
  return arr.map((r) => ({
    id: String(r.id),
    title: String(r.title ?? ''),
    content: String(r.content ?? ''),
    type: (r.type as AnnType) ?? 'info',
    isPinned: Boolean(r.isTop ?? r.isPinned),
    isPublished: Boolean(r.isPublished),
    publishedAt: r.publishedAt ? String(r.publishedAt) : undefined,
    updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
  }))
}

const TYPE_BADGE: Record<AnnType, string> = {
  info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  maintenance: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  update: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}

const EMPTY = { title: '', content: '', type: 'info' as AnnType, isPinned: false, isPublished: false }
const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function AdminAnnouncementsPage() {
  const t = useTranslations('admin.announcements')
  const tc = useTranslations('common')
  const locale = useLocale()
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Announcement | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: list = [], isLoading, isError } = useQuery({ queryKey: ['admin', 'announcements'], queryFn: fetchList })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { title: form.title, content: form.content, isTop: form.isPinned, isPublished: form.isPublished }
      return editing
        ? api(`/api/admin/messages/announcements/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/messages/announcements', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'announcements'] }); close() },
    onError: (e: Error) => setErr(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/messages/announcements/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'announcements'] }),
  })

  function openCreate() { setEditing(null); setForm(EMPTY); setErr(null); setOpen(true) }
  function openEdit(a: Announcement) {
    setEditing(a)
    setForm({ title: a.title, content: a.content, type: a.type, isPinned: a.isPinned, isPublished: a.isPublished })
    setErr(null); setOpen(true)
  }
  function close() { if (saveMut.isPending) return; setOpen(false); setEditing(null); setErr(null) }
  function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null)
    if (!form.title.trim()) { setErr(t('titleRequired')); return }
    saveMut.mutate()
  }

  const dateFmt = new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' })
  const th = 'px-4 py-2.5 font-medium'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Megaphone className="h-6 w-6 text-primary" />{t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />{t('create')}</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className={th}>{t('colTitle')}</th>
              <th className={th}>{t('colType')}</th>
              <th className={th}>{t('colPinned')}</th>
              <th className={th}>{t('colPublished')}</th>
              <th className={th}>{t('colPublishedAt')}</th>
              <th className={cn(th, 'text-right')}>{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isError ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-destructive">{t('noData')}</td></tr>
            ) : isLoading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />{t('loading')}
              </td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">{t('noData')}</td></tr>
            ) : (
              list.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 font-medium">
                      {a.isPinned && <Pin className="h-3.5 w-3.5 text-amber-500" />}
                      <span>{a.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', TYPE_BADGE[a.type])}>
                      {t(`types.${a.type}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{a.isPinned ? t('yes') : t('no')}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', a.isPublished ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-muted text-muted-foreground')}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', a.isPublished ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                      {a.isPublished ? t('published') : t('draft')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{a.publishedAt ? dateFmt.format(new Date(a.publishedAt)) : '-'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(a)}><Edit className="h-4 w-4" />{t('edit')}</Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={delMut.isPending} onClick={() => { if (confirm(t('deleteConfirm'))) delMut.mutate(a.id) }}>
                        <Trash2 className="h-4 w-4" />{t('delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
              <DialogDescription>{t('createDesc')}</DialogDescription>
            </DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2">
              <Label htmlFor="a-title">{t('fieldTitle')}</Label>
              <Input id="a-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('titlePlaceholder')} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-content">{t('fieldContent')}</Label>
              <textarea id="a-content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder={t('contentPlaceholder')} rows={5} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="a-type">{t('fieldType')}</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as AnnType })}>
  <SelectTrigger className={selectClass}>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="info">{t('types.info')}</SelectItem>
    <SelectItem value="warning">{t('types.warning')}</SelectItem>
    <SelectItem value="maintenance">{t('types.maintenance')}</SelectItem>
    <SelectItem value="update">{t('types.update')}</SelectItem>
  </SelectContent>
</Select>
              </div>
              <div className="flex items-end gap-4 pb-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isPinned} onChange={(e) => setForm({ ...form, isPinned: e.target.checked })} className="h-4 w-4 accent-primary" />
                  {t('fieldPinned')}
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} className="h-4 w-4 accent-primary" />
                  {t('fieldPublished')}
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saveMut.isPending}>{tc('cancel')}</Button>
              <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t('save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
