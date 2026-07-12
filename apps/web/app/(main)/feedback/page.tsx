'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { api } from '@/lib/feedback'
import type { FeedbackItem, FeedbackType } from './types'
import { FeedbackList } from './FeedbackList'
import { FeedbackForm } from './FeedbackForm'

export default function FeedbackPage() {
  const t = useTranslations('feedback')
  const qc = useQueryClient()

  const [tab, setTab] = React.useState<'list' | 'new'>('list')
  const [type, setType] = React.useState<FeedbackType>('bug')
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [contact, setContact] = React.useState('')
  const [formError, setFormError] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['feedbacks'],
    queryFn: () => api<{ list: FeedbackItem[] }>('/api/feedbacks').then((d) => d.list ?? []),
  })

  const createMut = useMutation({
    mutationFn: (input: { type: FeedbackType; title: string; content: string; contact?: string }) =>
      api<{ feedback: FeedbackItem }>('/api/feedbacks', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedbacks'] })
      setTab('list')
      setType('bug')
      setTitle('')
      setContent('')
      setContact('')
      setFormError(null)
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!title.trim() || !content.trim()) {
      setFormError(t('required'))
      return
    }
    createMut.mutate({
      type,
      title: title.trim(),
      content: content.trim(),
      contact: contact.trim() || undefined,
    })
  }

  const list = data ?? []

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {(['list', 'new'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setTab(v)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === v
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`tab_${v}`)}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-in fade-in-0 duration-200">
        {tab === 'list' ? (
          <FeedbackList list={list} isLoading={isLoading} error={error as Error | null} />
        ) : (
          <FeedbackForm
            type={type}
            setType={setType}
            title={title}
            setTitle={setTitle}
            content={content}
            setContent={setContent}
            contact={contact}
            setContact={setContact}
            formError={formError}
            isPending={createMut.isPending}
            onSubmit={handleSubmit}
            onCancel={() => setTab('list')}
          />
        )}
      </div>
    </div>
  )
}
