'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { FileText, Plus, Edit, Trash2, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { slugify } from '@/lib/content'
import { Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ihui/ui'
import { cn } from '@/lib/utils'

type DocCategory = 'api' | 'guide' | 'development' | 'faq'
type DocStatus = 'draft' | 'published'

interface Doc {
  id: string
  title: string
  slug: string
  category: DocCategory
  content: string
  status: DocStatus
  viewCount?: number
  updatedAt?: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

async function fetchList(): Promise<Doc[]> {
  const d = await api<{ list: Doc[] } | Doc[]>('/api/admin/docs')
  return Array.isArray(d) ? d : (d.list ?? [])
}

const EMPTY = { title: '', slug: '', category: 'guide' as DocCategory, content: '', status: 'draft' as DocStatus }
const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function AdminDocsPage() {
  const t = useTranslations('admin.docs')
  const tc = useTranslations('common')
  const locale = useLocale()
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Doc | null>(null)
  const [slugTouched, setSlugTouched] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: list = [], isLoading } = useQuery({ queryKey: ['admin', 'docs'], queryFn: fetchList })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { title: form.title, slug: form.slug || slugify(form.title), category: form.category, content: form.content, status: form.status }
      return editing
        ? api(`/api/admin/docs/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : api('/api/admin/docs', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'docs'] }); close() },
    onError: (e: Error) => setErr(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/docs/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'docs'] }),
  })

  function openCreate() { setEditing(null); setForm(EMPTY); setSlugTouched(false); setErr(null); setOpen(true) }
  function openEdit(d: Doc) {
    setEditing(d)
    setForm({ title: d.title, slug: d.slug, category: d.category, content: d.content, status: d.status })
    setSlugTouched(true); setErr(null); setOpen(true)
  }
  function close() { if (saveMut.isPending) return; setOpen(false); setEditing(null); setSlugTouched(false); setErr(null) }
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
            <FileText className="h-6 w-6 text-primary" />{t('title')}
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
              <th className={th}>{t('colCategory')}</th>
              <th className={th}>{t('colSlug')}</th>
              <th className={th}>{t('colStatus')}</th>
              <th className={th}>{t('colViews')}</th>
              <th className={th}>{t('colUpdatedAt')}</th>
              <th className={cn(th, 'text-right')}>{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />{t('loading')}
              </td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">{t('noData')}</td></tr>
            ) : (
              list.map((d) => (
                <tr key={d.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{d.title}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{t(`categories.${d.category}`)}</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{d.slug}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', d.status === 'published' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-muted text-muted-foreground')}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', d.status === 'published' ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                      {t(`status_${d.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{d.viewCount ?? 0}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{d.updatedAt ? dateFmt.format(new Date(d.updatedAt)) : '-'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(d)}><Edit className="h-4 w-4" />{t('edit')}</Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={delMut.isPending} onClick={() => { if (confirm(t('deleteConfirm'))) delMut.mutate(d.id) }}>
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
              <Label htmlFor="d-title">{t('fieldTitle')}</Label>
              <Input id="d-title" value={form.title} onChange={(e) => { const title = e.target.value; setForm({ ...form, title, slug: slugTouched ? form.slug : slugify(title) }) }} placeholder={t('titlePlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="d-slug">{t('fieldSlug')}</Label>
                <Input id="d-slug" value={form.slug} onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: e.target.value }) }} placeholder={t('slugPlaceholder')} className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-category">{t('fieldCategory')}</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as DocCategory })}>
  <SelectTrigger className={selectClass}>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="api">{t('categories.api')}</SelectItem>
    <SelectItem value="guide">{t('categories.guide')}</SelectItem>
    <SelectItem value="development">{t('categories.development')}</SelectItem>
    <SelectItem value="faq">{t('categories.faq')}</SelectItem>
  </SelectContent>
</Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-status">{t('fieldStatus')}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as DocStatus })}>
  <SelectTrigger className={selectClass}>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="draft">{t('status_draft')}</SelectItem>
    <SelectItem value="published">{t('status_published')}</SelectItem>
  </SelectContent>
</Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-content">{t('fieldContent')}</Label>
              <textarea id="d-content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder={t('contentPlaceholder')} rows={6} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
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
