'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Tag, Hash, Plus, Edit, Trash2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Input, Label } from '@ihui/ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import { cn } from '@/lib/utils'
import { Tag as TagChip } from '@/components/data/Tag'

interface TagItem {
  id: string
  slug: string
  name: string
  usageCount: number
  description?: string | null
  color?: string | null
  createdAt?: string
}

const TAG_COLORS = [
  'text-primary',
  'text-emerald-600 dark:text-emerald-400',
  'text-amber-600 dark:text-amber-400',
  'text-rose-600 dark:text-rose-400',
  'text-violet-600 dark:text-violet-400',
  'text-cyan-600 dark:text-cyan-400',
]

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

async function fetchTags(): Promise<TagItem[]> {
  const data = await api<{ tags: TagItem[] }>('/api/tags')
  return data?.tags ?? []
}

const EMPTY = { name: '', description: '', color: '' }

export default function AdminTagsPage() {
  const t = useTranslations('admin.tags')
  const tc = useTranslations('common')
  const locale = useLocale()
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<TagItem | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)
  const [delId, setDelId] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'tags'],
    queryFn: fetchTags,
  })

  const tags = data ?? []
  const total = tags.length
  const counts = tags.map((x) => x.usageCount)
  const max = Math.max(1, ...counts)
  const min = Math.min(max, ...counts)
  const fontSize = (count: number) => {
    if (max === min) return 15
    return Math.round(12 + ((count - min) / (max - min)) * 14)
  }
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        color: form.color.trim() || undefined,
      }
      return editing
        ? api(`/api/tags/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : api('/api/tags', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tags'] })
      close()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tags'] })
      setDelId(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(tag: TagItem) {
    setEditing(tag)
    setForm({ name: tag.name, description: tag.description ?? '', color: tag.color ?? '' })
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
    saveMut.mutate()
  }

  const th = 'px-4 py-2.5 font-medium'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="py-12 text-center text-destructive">{(error as Error).message}</div>
      ) : tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <Tag className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('noData')}</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border">
            <div className="flex items-center gap-2 border-b px-4 py-2.5 text-xs font-medium uppercase text-muted-foreground">
              <Hash className="h-3.5 w-3.5" />
              {t('cloudTitle')}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-5">
              {tags.map((tag, i) => (
                <span
                  key={tag.id}
                  className={cn(
                    'inline-flex items-center gap-1 font-medium transition-colors hover:opacity-80',
                    TAG_COLORS[i % TAG_COLORS.length],
                  )}
                  style={{ fontSize: `${fontSize(tag.usageCount)}px` }}
                  title={t('usageCount', { count: tag.usageCount })}
                >
                  <Tag className="h-3 w-3" />
                  {tag.name}
                  <span className="text-xs text-muted-foreground">({tag.usageCount})</span>
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className={th}>{t('name')}</th>
                  <th className={th}>{t('slug')}</th>
                  <th className={th}>{t('usageCount')}</th>
                  <th className={th}>{t('createdAt')}</th>
                  <th className={cn(th, 'text-right')}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tags.map((tag) => (
                  <tr key={tag.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Tag className="h-3.5 w-3.5" />
                        </span>
                        <TagChip size="md" color={tag.color ?? undefined}>
                          {tag.name}
                        </TagChip>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                        {tag.slug}
                      </code>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {tag.usageCount}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {tag.createdAt ? dateFmt.format(new Date(tag.createdAt)) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(tag)}>
                          <Edit className="mr-1 h-3.5 w-3.5" />
                          {tc('edit')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDelId(tag.id)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          {tc('delete')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-sm text-muted-foreground">{t('total', { total })}</div>
        </>
      )}

      {/* 创建/编辑对话框 */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) close()
          else setOpen(true)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
            <DialogDescription>{editing ? t('editDesc') : t('createDesc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tag-name">{t('name')}</Label>
              <Input
                id="tag-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('namePlaceholder')}
                maxLength={64}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tag-desc">{t('description')}</Label>
              <Input
                id="tag-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t('descPlaceholder')}
                maxLength={500}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tag-color">{t('color')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="tag-color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
                {form.color ? (
                  <span
                    className="h-9 w-9 shrink-0 rounded-md border"
                    style={{ backgroundColor: form.color }}
                  />
                ) : null}
              </div>
            </div>
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saveMut.isPending}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                {editing ? tc('save') : t('create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog
        open={delId !== null}
        onOpenChange={(v) => {
          if (!v) setDelId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDelId(null)}
              disabled={delMut.isPending}
            >
              {tc('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={delMut.isPending}
              onClick={() => {
                if (delId) delMut.mutate(delId)
              }}
            >
              {delMut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
