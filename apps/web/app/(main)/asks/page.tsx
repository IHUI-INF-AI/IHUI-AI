'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { HelpCircle, Search, Loader2, Plus, MessageSquare, Eye, CheckCircle2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent } from '@ihui/ui'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface AskItem {
  id: string
  title: string
  tags?: string[]
  answerCount: number
  viewCount: number
  isResolved: boolean
  createdAt: string
}
interface AsksData { list: AskItem[]; total: number; page: number; pageSize: number }

const PAGE_SIZE = 20
type Filter = 'all' | 'unresolved' | 'resolved'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function AsksPage() {
  const t = useTranslations('asks')
  const tc = useTranslations('common')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [filter, setFilter] = React.useState<Filter>('all')
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [formError, setFormError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['asks', debounced],
    queryFn: () =>
      api<AsksData>(`/api/asks?page=1&pageSize=${PAGE_SIZE}&search=${encodeURIComponent(debounced)}`),
  })

  const createMut = useMutation({
    mutationFn: (payload: { title: string; content: string }) =>
      api<{ ask: AskItem }>(`/api/asks`, { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asks'] })
      setOpen(false)
      setTitle('')
      setContent('')
      setFormError(null)
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const list = (data?.list ?? []).filter((a) =>
    filter === 'all' ? true : filter === 'resolved' ? a.isResolved : !a.isResolved,
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!title.trim() || !content.trim()) {
      setFormError(t('required'))
      return
    }
    createMut.mutate({ title: title.trim(), content: content.trim() })
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <HelpCircle className="h-7 w-7 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { if (!o && createMut.isPending) return; setOpen(o); if (!o) setFormError(null) }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" />{t('askQuestion')}</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{t('askQuestion')}</DialogTitle>
                <DialogDescription>{t('subtitle')}</DialogDescription>
              </DialogHeader>
              {formError && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</div>}
              <div className="space-y-2">
                <Label htmlFor="ask-title">{t('title')}</Label>
                <Input id="ask-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('titlePlaceholder')} autoFocus maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ask-content">{t('content')}</Label>
                <textarea id="ask-content" value={content} onChange={(e) => setContent(e.target.value)} placeholder={t('contentPlaceholder')} rows={4} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createMut.isPending}>{tc('cancel')}</Button>
                <Button type="submit" disabled={createMut.isPending}>
                  {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('askQuestion')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('searchPlaceholder')} className="h-9 pl-8" />
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          {(['all', 'unresolved', 'resolved'] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors', filter === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {t(f === 'all' ? 'all' : f === 'resolved' ? 'resolved' : 'unresolved')}
            </button>
          ))}
        </div>
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
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <HelpCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <Link key={a.id} href={`/asks/${a.id}`}>
              <Card className="transition-colors hover:border-primary/40">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <span className={cn('flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', a.isResolved ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600')}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {a.isResolved ? t('resolved') : t('unresolved')}
                    </span>
                  </div>
                  {a.tags && a.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {a.tags.map((tag) => (
                        <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="flex items-center gap-4 p-4 pt-0 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{t('answerCount', { count: a.answerCount })}</span>
                  <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{t('viewCount', { count: a.viewCount })}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
