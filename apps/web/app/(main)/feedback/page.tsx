'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, MessageSquare } from 'lucide-react'

import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { cn } from '@/lib/utils'
import {
  api,
  TYPE_ICON,
  TYPE_BADGE,
  STATUS_BADGE,
  type FeedbackItem,
  type FeedbackType,
} from '@/lib/feedback'

const TYPES: FeedbackType[] = ['bug', 'feature', 'improvement', 'other']
const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function FeedbackPage() {
  const t = useTranslations('feedback')
  const tc = useTranslations('common')
  const locale = useLocale()
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

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
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
          isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {(error as Error).message}
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {list.map((fb) => {
                const TypeIcon = TYPE_ICON[fb.type]
                return (
                  <Link
                    key={fb.id}
                    href={`/feedback/${fb.id}`}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                      <TypeIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium">{fb.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {dateFmt.format(new Date(fb.createdAt))}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        TYPE_BADGE[fb.type],
                      )}
                    >
                      {t(`type_${fb.type}`)}
                    </span>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_BADGE[fb.status],
                      )}
                    >
                      {t(`status_${fb.status}`)}
                    </span>
                  </Link>
                )
              })}
            </div>
          )
        ) : (
          <Card>
            <CardContent className="p-4 md:p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fb-type">{t('type')}</Label>
                  <Select value={type} onValueChange={(v) => setType(v as FeedbackType)}>
                    <SelectTrigger className={selectClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {t(`type_${v}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fb-title">{t('field_title')}</Label>
                  <Input
                    id="fb-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('titlePlaceholder')}
                    maxLength={128}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fb-content">{t('field_content')}</Label>
                  <textarea
                    id="fb-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={t('contentPlaceholder')}
                    maxLength={5000}
                    rows={6}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fb-contact">{t('field_contact')}</Label>
                  <Input
                    id="fb-contact"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder={t('contactPlaceholder')}
                    maxLength={128}
                  />
                </div>

                {formError && (
                  <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {formError}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setTab('list')}
                    disabled={createMut.isPending}
                  >
                    {tc('cancel')}
                  </Button>
                  <Button type="submit" disabled={createMut.isPending}>
                    {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {createMut.isPending ? t('submitting') : t('submit')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
