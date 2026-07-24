'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, Loader2, ClipboardList, Clock, Upload } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui-react'

interface HomeworkItem {
  id: string
  title: string
  deadline?: string
  endTime?: string
  status?: number | string
  submitted?: boolean
}
interface HomeworkListData {
  list: HomeworkItem[]
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function CourseHomeworkPage() {
  const t = useTranslations('learnHomeworkPage')
  const locale = useLocale()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['learn', 'homework', id],
    queryFn: () => api<HomeworkListData>(`/api/learn/${id}/homework`),
  })

  const submitMut = useMutation({
    mutationFn: (hwId: string) =>
      api(`/api/learn/${id}/homework/${hwId}/submit`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learn', 'homework', id] }),
  })

  const deadlineFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const formatDeadline = (t?: string) => {
    if (!t) return ''
    const d = new Date(t)
    if (isNaN(d.getTime())) return t
    return deadlineFmt.format(d)
  }

  const statusText = (status?: number | string) => {
    if (status === undefined || status === null) return t('status.notSubmitted')
    if (typeof status === 'number') {
      const numKey = ['notSubmitted', 'submitted', 'passApproval', 'failApproval'][
        status
      ] as 'notSubmitted' | 'submitted' | 'passApproval' | 'failApproval'
      return numKey ? t(`status.${numKey}`) : t('status.unknown')
    }
    return t(`status.${status}` as 'status.submitted')
  }

  const list = data?.list ?? []

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )

  if (error)
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <button
          type="button"
          onClick={() => router.push(`/learn/${id}`)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToCourse')}
        </button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? t('errorFallback')}
        </div>
      </div>
    )

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href={`/learn/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToCourse')}
      </Link>

      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <ClipboardList className="h-6 w-6 text-primary" />
        {t('title')}
      </h1>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <ClipboardList className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((item) => {
            const deadline = formatDeadline(item.deadline ?? item.endTime)
            const submitted = item.submitted ?? (item.status === 'submitted' || item.status === 1)
            return (
              <Card key={item.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1.5">
                    <h3 className="text-base font-medium">{item.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {deadline && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {t('deadlineLabel', { deadline })}
                        </span>
                      )}
                      <span className="rounded px-1.5 py-0.5 bg-muted">
                        {statusText(item.status)}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Button
                      size="sm"
                      variant={submitted ? 'outline' : 'default'}
                      disabled={submitted || submitMut.isPending}
                      onClick={() => submitMut.mutate(item.id)}
                    >
                      {submitMut.isPending && submitMut.variables === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {submitted ? t('submitBtn.submitted') : t('submitBtn.notSubmitted')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
