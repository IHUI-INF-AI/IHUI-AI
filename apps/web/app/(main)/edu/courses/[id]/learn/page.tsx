'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import {
  ArrowLeft,
  PlayCircle,
  Loader2,
  Send,
  NotebookPen,
  HelpCircle,
  Check,
  Clock,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface Section {
  id: string
  title: string
  duration?: string
  completed?: boolean
  videoUrl?: string
}
interface QAItem {
  id: string
  question: string
  answer?: string
  author: string
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function EduCourseLearnPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('eduCourseLearnPage')
  const qc = useQueryClient()
  const [currentSec, setCurrentSec] = React.useState<Section | null>(null)
  const [noteText, setNoteText] = React.useState('')
  const [qaText, setQaText] = React.useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'course', id, 'learn'],
    queryFn: () => api<{ sections: Section[]; title: string }>(`/api/edu/courses/${id}/sections`),
  })

  const { data: qaList } = useQuery({
    queryKey: ['edu', 'course', id, 'qa'],
    queryFn: () => api<{ list: QAItem[] }>(`/api/edu/courses/${id}/qa`).then((d) => d.list ?? []),
  })

  const noteMut = useMutation({
    mutationFn: () =>
      api(`/api/edu/courses/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: noteText, sectionId: currentSec?.id }),
      }),
    onSuccess: () => {
      setNoteText('')
      qc.invalidateQueries({ queryKey: ['edu', 'notes'] })
    },
  })

  const qaMut = useMutation({
    mutationFn: () =>
      api(`/api/edu/courses/${id}/qa`, {
        method: 'POST',
        body: JSON.stringify({ question: qaText }),
      }),
    onSuccess: () => {
      setQaText('')
      qc.invalidateQueries({ queryKey: ['edu', 'course', id, 'qa'] })
    },
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmt = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )

  if (error || !data) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.push(`/edu/courses/${id}`)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToDetail')}
        </button>
        <Alert variant="danger" description={(error as Error)?.message ?? t('loadFailed')} />
      </div>
    )
  }

  const sections = data.sections ?? []
  const active = currentSec ?? sections[0] ?? null

  return (
    <div className="space-y-4">
      <Link
        href={`/edu/courses/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToDetail')}
      </Link>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div className="flex aspect-video items-center justify-center rounded-lg bg-black">
            {active?.videoUrl ? (
              <video src={active.videoUrl} controls className="h-full w-full rounded-lg">
                <track kind="captions" />
              </video>
            ) : (
              <PlayCircle className="h-16 w-16 text-white/30" />
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">{active?.title ?? data.title}</h1>
            {active?.duration && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {active.duration}
              </p>
            )}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <NotebookPen className="h-4 w-4 text-primary" />
                {t('notes')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="note" className="text-xs">
                  {t('noteLabel')}
                </Label>
                <textarea
                  id="note"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder={t('notePlaceholder')}
                />
              </div>
              <Button
                size="sm"
                disabled={!noteText.trim() || noteMut.isPending}
                onClick={() => noteMut.mutate()}
              >
                {noteMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('saveNote')}
              </Button>
              {noteMut.isError && (
                <p className="text-xs text-destructive">{(noteMut.error as Error)?.message}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('sections')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0.5 p-2">
              {sections.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCurrentSec(s)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                    active?.id === s.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
                  )}
                >
                  {s.completed ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <span className="w-3.5 shrink-0 text-center text-xs text-muted-foreground">
                      {i + 1}
                    </span>
                  )}
                  <span className="line-clamp-1 flex-1">{s.title}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <HelpCircle className="h-4 w-4 text-primary" />
                {t('qa')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={qaText}
                  onChange={(e) => setQaText(e.target.value)}
                  placeholder={t('qaPlaceholder')}
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!qaText.trim() || qaMut.isPending}
                  onClick={() => qaMut.mutate()}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {(qaList ?? []).length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">{t('qaEmpty')}</p>
                ) : (
                  (qaList ?? []).map((qa) => (
                    <div key={qa.id} className="rounded-md border p-2">
                      <p className="text-xs font-medium">{qa.question}</p>
                      {qa.answer && (
                        <p className="mt-1 text-xs text-muted-foreground">{qa.answer}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {qa.author} · {fmt(qa.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
