'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { HelpCircle, Plus, Edit, Trash2, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ihui/ui'
import { cn } from '@/lib/utils'

type HelpCategory = 'account' | 'payment' | 'project' | 'ai' | 'tech'

interface HelpArticle {
  id: string
  title: string
  slug: string
  category: HelpCategory
  content: string
  isPublished: boolean
  viewCount?: number
  updatedAt?: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

async function fetchList(): Promise<HelpArticle[]> {
  const d = await api<{ list: HelpArticle[] } | HelpArticle[]>('/api/admin/help/articles')
  return Array.isArray(d) ? d : (d.list ?? [])
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

const EMPTY = { title: '', slug: '', category: 'account' as HelpCategory, content: '', isPublished: false }
const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function AdminHelpPage() {
  const t = useTranslations('admin.help')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<HelpArticle | null>(null)
  const [slugTouched, setSlugTouched] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: list = [], isLoading } = useQuery({ queryKey: ['admin', 'help'], queryFn: fetchList })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { title: form.title, slug: form.slug || slugify(form.title), category: form.category, content: form.content, isPublished: form.isPublished }
      return editing
        ? api(`/api/admin/help/articles/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : api('/api/admin/help/articles', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'help'] }); close() },
    onError: (e: Error) => setErr(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/help/articles/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'help'] }),
  })

  function openCreate() { setEditing(null); setForm(EMPTY); setSlugTouched(false); setErr(null); setOpen(true) }
  function openEdit(h: HelpArticle) {
    setEditing(h)
    setForm({ title: h.title, slug: h.slug, category: h.category, content: h.content, isPublished: h.isPublished })
    setSlugTouched(true); setErr(null); setOpen(true)
  }
  function close() { if (saveMut.isPending) return; setOpen(false); setEditing(null); setSlugTouched(false); setErr(null) }
  function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null)
    if (!form.title.trim()) { setErr(t('titleRequired')); return }
    saveMut.mutate()
  }

  const th = 'px-4 py-2.5 font-medium'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <HelpCircle className="h-6 w-6 text-primary" />{t('title')}
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
              <th className={cn(th, 'text-right')}>{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />{t('loading')}
              </td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">{t('noData')}</td></tr>
            ) : (
              list.map((h) => (
                <tr key={h.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{h.title}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{t(`categories.${h.category}`)}</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{h.slug}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', h.isPublished ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-muted text-muted-foreground')}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', h.isPublished ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                      {h.isPublished ? t('published') : t('draft')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{h.viewCount ?? 0}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(h)}><Edit className="h-4 w-4" />{t('edit')}</Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={delMut.isPending} onClick={() => { if (confirm(t('deleteConfirm'))) delMut.mutate(h.id) }}>
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
              <Label htmlFor="h-title">{t('fieldTitle')}</Label>
              <Input id="h-title" value={form.title} onChange={(e) => { const title = e.target.value; setForm({ ...form, title, slug: slugTouched ? form.slug : slugify(title) }) }} placeholder={t('titlePlaceholder')} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="h-slug">{t('fieldSlug')}</Label>
                <Input id="h-slug" value={form.slug} onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: e.target.value }) }} placeholder={t('slugPlaceholder')} className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="h-category">{t('fieldCategory')}</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as HelpCategory })}>
  <SelectTrigger className={selectClass}>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="account">{t('categories.account')}</SelectItem>
    <SelectItem value="payment">{t('categories.payment')}</SelectItem>
    <SelectItem value="project">{t('categories.project')}</SelectItem>
    <SelectItem value="ai">{t('categories.ai')}</SelectItem>
    <SelectItem value="tech">{t('categories.tech')}</SelectItem>
  </SelectContent>
</Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="h-content">{t('fieldContent')}</Label>
              <textarea id="h-content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder={t('contentPlaceholder')} rows={6} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} className="h-4 w-4 accent-primary" />
              {t('fieldPublished')}
            </label>
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
