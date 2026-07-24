'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowLeft, Loader2, MessageSquare, Eye, CheckCircle2, Send } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

interface AskDetail {
  id: string
  title: string
  content?: string | null
  tags?: string[] | null
  answerCount: number
  viewCount: number
  isResolved: boolean
  authorName?: string | null
  createdAt: string
}

interface AnswerItem {
  id: string
  content: string
  authorName?: string | null
  isAccepted: boolean
  createdAt: string
}

interface AnswersData {
  list: AnswerItem[]
  total: number
  page: number
  pageSize: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function AskDetailPage() {
  const t = useTranslations('asks')
  const tc = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const qc = useQueryClient()

  const {
    data: askData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ask', params.id],
    queryFn: () => api<{ ask: AskDetail }>(`/api/asks/${params.id}`),
    enabled: !!params.id,
  })

  const { data: answersData, isLoading: answersLoading } = useQuery({
    queryKey: ['ask-answers', params.id],
    queryFn: () => api<AnswersData>(`/api/asks/${params.id}/answers?page=1&pageSize=50`),
    enabled: !!params.id,
  })

  const [content, setContent] = React.useState('')
  const [formError, setFormError] = React.useState<string | null>(null)

  const answerMut = useMutation({
    mutationFn: (payload: { content: string }) =>
      api<{ answer: AnswerItem }>(`/api/asks/${params.id}/answers`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ask-answers', params.id] })
      qc.invalidateQueries({ queryKey: ['ask', params.id] })
      setContent('')
      setFormError(null)
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const ask = askData?.ask
  const answers = answersData?.list ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (error || !ask) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {tc('back')}
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? t('empty')}
        </div>
      </div>
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!content.trim()) {
      setFormError(t('required'))
      return
    }
    answerMut.mutate({ content: content.trim() })
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        {tc('back')}
      </Button>

      {/* 问题 */}
      <Card>
        <CardHeader className="p-5">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-xl">{ask.title}</CardTitle>
            <span
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                ask.isResolved
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-amber-500/10 text-amber-600',
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {ask.isResolved ? t('resolved') : t('unresolved')}
            </span>
          </div>
          {ask.content && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{ask.content}</p>
          )}
          {ask.tags && ask.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {ask.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            {ask.authorName && <span>{ask.authorName}</span>}
            <span>{dateFmt.format(new Date(ask.createdAt))}</span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {t('answerCount', { count: ask.answerCount })}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {t('viewCount', { count: ask.viewCount })}
            </span>
          </div>
        </CardHeader>
      </Card>

      {/* 回答列表 */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          {tc('answers')}
          <span className="ml-2 text-sm font-normal text-muted-foreground">({answers.length})</span>
        </h2>
        {answersLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : answers.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            {tc('noAnswers')}
          </div>
        ) : (
          <div className="space-y-2">
            {answers.map((a) => (
              <Card key={a.id} className={cn(a.isAccepted && 'border-emerald-500/40')}>
                <CardContent className="p-4">
                  {a.isAccepted && (
                    <span className="mb-2 inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                      {tc('accepted')}
                    </span>
                  )}
                  <p className="whitespace-pre-wrap text-sm">{a.content}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    {a.authorName && <span>{a.authorName}</span>}
                    <span>{dateFmt.format(new Date(a.createdAt))}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 提交回答 */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <h2 className="text-lg font-semibold">{t('answerQuestion')}</h2>
        {formError && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        )}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder={t('contentPlaceholder')}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button type="submit" disabled={answerMut.isPending}>
          {answerMut.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-1.5 h-4 w-4" />
          )}
          {tc('submit')}
        </Button>
      </form>
    </div>
  )
}
