'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, ArrowLeft, MessageSquare } from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import {
  api,
  TYPE_ICON,
  TYPE_BADGE,
  STATUS_BADGE,
  PRIORITY_BADGE,
  type FeedbackItem,
  type Priority,
  type FeedbackStatus,
} from '@/lib/feedback'
import { MarkdownViewer } from '@/components/media'

const STATUSES: FeedbackStatus[] = ['pending', 'reviewing', 'resolved', 'closed']
const PRIORITIES: Priority[] = ['low', 'medium', 'high']
const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        className,
      )}
    >
      {children}
    </span>
  )
}

export default function FeedbackDetailPage() {
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('feedback')
  const tc = useTranslations('comments')
  const locale = useLocale()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = (user?.roleId ?? 0) >= 1

  const {
    data: fb,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['feedbacks', id],
    queryFn: () => api<{ feedback: FeedbackItem }>(`/api/feedbacks/${id}`).then((d) => d.feedback),
  })

  const [status, setStatus] = React.useState<FeedbackStatus>('pending')
  const [priority, setPriority] = React.useState<Priority>('medium')
  const [reply, setReply] = React.useState('')
  const [formError, setFormError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (fb) {
      setStatus(fb.status)
      setPriority(fb.priority)
      setReply(fb.adminReply ?? '')
    }
  }, [fb])

  const replyMut = useMutation({
    mutationFn: () =>
      api<{ feedback: FeedbackItem }>(`/api/admin/feedbacks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, priority, adminReply: reply }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedbacks', id] })
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }
  if (error || !fb) {
    return (
      <div className="space-y-4">
        <Link
          href="/feedback"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToList')}
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? t('notFound')}
        </div>
      </div>
    )
  }

  const TypeIcon = TYPE_ICON[fb.type]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    replyMut.mutate()
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href="/feedback"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
            <TypeIcon className="h-4 w-4" />
          </div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">{fb.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge className={TYPE_BADGE[fb.type]}>{t(`type_${fb.type}`)}</Badge>
          <Badge className={STATUS_BADGE[fb.status]}>{t(`status_${fb.status}`)}</Badge>
          <Badge className={PRIORITY_BADGE[fb.priority]}>{t(`priority_${fb.priority}`)}</Badge>
          <span>·</span>
          <span>{dateFmt.format(new Date(fb.createdAt))}</span>
        </div>
      </header>

      <Card>
        <CardContent className="p-4 md:p-6">
          <MarkdownViewer content={fb.content} />
        </CardContent>
      </Card>

      {fb.adminReply && (
        <Card>
          <CardContent className="p-4 md:p-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tc('adminReply')}
            </p>
            <MarkdownViewer content={fb.adminReply} />
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardContent className="p-4 md:p-6">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4" />
              {tc('replyTitle')}
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="fb-status">
                    {t('field_status')}
                  </label>
                  <Select value={status} onValueChange={(v) => setStatus(v as FeedbackStatus)}>
                    <SelectTrigger className={selectClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {t(`status_${v}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="fb-priority">
                    {t('field_priority')}
                  </label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                    <SelectTrigger className={selectClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {t(`priority_${v}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="fb-reply">
                  {tc('replyContent')}
                </label>
                <textarea
                  id="fb-reply"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={tc('replyPlaceholder')}
                  maxLength={5000}
                  rows={5}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {formError && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={replyMut.isPending}>
                  {replyMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {replyMut.isPending ? tc('submitting') : tc('submitReply')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
