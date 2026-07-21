'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, Loader2, Trash2, Settings, AlertCircle } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Checkbox,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@ihui/ui'
import { cn } from '@/lib/utils'
import { ManageRow } from './ManageRow'

interface DocSummary {
  id: number
  title: string
  sourceType: string
  chunkCount: number
  createdAt: string | null
}

interface BatchDeleteResult {
  success: number[]
  failed: number[]
}

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function KnowledgeRagManagePage() {
  const t = useTranslations('knowledgeRag.manage')
  const tSource = useTranslations('knowledgeRag.list.sourceType')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const qc = useQueryClient()
  const dateFmt = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }),
    [locale],
  )
  const fmtDate = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }
  const labels: Record<string, string> = {
    text: tSource('text'),
    file: tSource('file'),
    url: tSource('url'),
  }
  const srcLabel = (s: string) => labels[s] ?? s

  const [selected, setSelected] = React.useState<Set<number>>(new Set())
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['knowledgeRag', 'docs'],
    queryFn: () => api<DocSummary[]>('/api/knowledge/docs'),
  })

  React.useEffect(() => {
    if (!feedback) return
    const tm = setTimeout(() => setFeedback(null), 3000)
    return () => clearTimeout(tm)
  }, [feedback])

  const docs = data ?? []
  const allSelected = docs.length > 0 && selected.size === docs.length
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(docs.map((d) => d.id)))
  const toggleOne = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const singleDeleteMut = useMutation({
    mutationFn: (docId: number) =>
      api<{ deleted: boolean }>(`/api/knowledge/docs/${docId}`, { method: 'DELETE' }),
    onSuccess: (_d, docId) => {
      qc.invalidateQueries({ queryKey: ['knowledgeRag', 'docs'] })
      setSelected((p) => {
        const n = new Set(p)
        n.delete(docId)
        return n
      })
      setFeedback({ type: 'success', msg: t('deleteSuccess') })
    },
    onError: (e) => setFeedback({ type: 'error', msg: (e as Error).message }),
  })

  const batchDeleteMut = useMutation({
    mutationFn: (docIds: number[]) =>
      api<BatchDeleteResult>('/api/knowledge/docs/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ docIds, ownerUuid: '' }),
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['knowledgeRag', 'docs'] })
      setSelected(new Set())
      setConfirmOpen(false)
      const failed = result.failed.length
      setFeedback({
        type: failed === 0 ? 'success' : 'error',
        msg: failed === 0 ? t('deleteSuccess') : t('partialFailed', { failed }),
      })
    },
    onError: (e) => setFeedback({ type: 'error', msg: (e as Error).message }),
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Link
        href="/knowledge-rag"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {tCommon('back')}
      </Link>
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>
      {feedback && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
            feedback.type === 'success'
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-destructive/50 bg-destructive/10 text-destructive',
          )}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{feedback.msg}</span>
        </div>
      )}
      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            disabled={docs.length === 0}
            aria-label={t('selectAll')}
          />
          <span>
            {t('selectAll')} ({selected.size}/{docs.length})
          </span>
        </label>
        <Button
          variant="destructive"
          size="sm"
          disabled={selected.size === 0 || batchDeleteMut.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          {batchDeleteMut.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-1.5 h-4 w-4" />
          )}
          {t('batchDelete')}
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
      ) : docs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <ManageRow
              key={d.id}
              doc={d}
              checked={selected.has(d.id)}
              srcLabel={srcLabel(d.sourceType)}
              fmtDate={fmtDate(d.createdAt)}
              chunkLabel={t('chunkCount', { count: d.chunkCount })}
              deleteLabel={t('singleDelete')}
              disabled={singleDeleteMut.isPending}
              onToggle={() => toggleOne(d.id)}
              onDelete={() => singleDeleteMut.mutate(d.id)}
            />
          ))}
        </div>
      )}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('batchDelete')}</DialogTitle>
            <DialogDescription>{t('deleteConfirm', { count: selected.size })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={batchDeleteMut.isPending}
              onClick={() => batchDeleteMut.mutate([...selected])}
            >
              {batchDeleteMut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {tCommon('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
