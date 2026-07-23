'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, ArrowLeft } from 'lucide-react'

import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/feedback'
import type { FeedbackItem, FeedbackStatus, Priority } from './types'
import { FeedbackDetailHeader } from './FeedbackDetailHeader'
import { FeedbackDetailBody } from './FeedbackDetailBody'
import { FeedbackReplyForm } from './FeedbackReplyForm'

export default function FeedbackDetailPage() {
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('feedback')
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    replyMut.mutate()
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <FeedbackDetailHeader fb={fb} />
      <FeedbackDetailBody fb={fb} />
      {isAdmin && (
        <FeedbackReplyForm
          status={status}
          setStatus={setStatus}
          priority={priority}
          setPriority={setPriority}
          reply={reply}
          setReply={setReply}
          formError={formError}
          isPending={replyMut.isPending}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )
}
