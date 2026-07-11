'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { FileText, Plus, Trash2, Loader2, Upload } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'

interface Paper {
  id: string
  paperTitle: string
  paperUrl: string | null
  courseId: string | null
  status: number
  createdAt: string
}

interface PaperForm {
  paperTitle: string
  paperUrl: string
}

const EMPTY_FORM: PaperForm = { paperTitle: '', paperUrl: '' }

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const STATUS_STYLE: Record<number, string> = {
  0: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  1: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  2: 'bg-destructive/10 text-destructive',
}

export default function MyPapersPage() {
  const t = useTranslations('papers')
  const tc = useTranslations('student')
  const qc = useQueryClient()

  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<PaperForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const {
    data: list = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['student', 'papers'],
    queryFn: () =>
      api<Paper[] | { list: Paper[] }>('/api/edu/my-papers').then((d) =>
        Array.isArray(d) ? d : (d.list ?? []),
      ),
  })

  const createMut = useMutation({
    mutationFn: () => {
      const body = {
        paperTitle: form.paperTitle.trim(),
        paperUrl: form.paperUrl.trim() || undefined,
      }
      return api('/api/edu/papers', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', 'papers'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/edu/papers/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student', 'papers'] }),
  })

  function openCreate() {
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function closeDialog() {
    if (createMut.isPending) return
    setOpen(false)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.paperTitle.trim()) {
      setErr(t('paperTitleField'))
      return
    }
    createMut.mutate()
  }
  function handleDelete(paper: Paper) {
    if (!window.confirm(t('deleteConfirm'))) return
    delMut.mutate(paper.id)
  }

  function statusKey(status: number) {
    if (status === 1) return 'statusApproved'
    if (status === 2) return 'statusRejected'
    return 'statusPending'
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <FileText className="h-7 w-7 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('upload')}
        </Button>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((paper) => (
            <Card key={paper.id} className="transition-colors hover:bg-accent">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      STATUS_STYLE[paper.status] ?? STATUS_STYLE[0],
                    )}
                  >
                    {t(statusKey(paper.status))}
                  </span>
                </div>
                <h3 className="font-medium">{paper.paperTitle}</h3>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {paper.paperUrl && (
                    <a
                      href={paper.paperUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Upload className="h-3 w-3" />
                      {t('paperUrlField')}
                    </a>
                  )}
                  {paper.createdAt && (
                    <p>{new Date(paper.createdAt).toLocaleDateString('zh-CN')}</p>
                  )}
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={delMut.isPending}
                    onClick={() => handleDelete(paper)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t('upload')}</DialogTitle>
              <DialogDescription>{t('subtitle')}</DialogDescription>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="p-title">{t('paperTitleField')}</Label>
              <Input
                id="p-title"
                value={form.paperTitle}
                onChange={(e) => setForm({ ...form, paperTitle: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-url">{t('paperUrlField')}</Label>
              <Input
                id="p-url"
                value={form.paperUrl}
                onChange={(e) => setForm({ ...form, paperUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={createMut.isPending}
              >
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('upload')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
