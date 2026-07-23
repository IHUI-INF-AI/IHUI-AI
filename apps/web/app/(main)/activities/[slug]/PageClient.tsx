'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, ArrowLeft, Calendar, Users, Check, X, Sparkles } from 'lucide-react'
import Image from 'next/image'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'

type Status = 'upcoming' | 'active' | 'ended'

interface Activity {
  id: string
  slug: string
  title: string
  description: string
  banner?: string
  startAt: string
  endAt: string
  status: string
  joined?: boolean
  rules?: Record<string, unknown>
  participantCount?: number
}

function computeStatus(status: string, startAt: string, endAt: string): Status {
  if (status === 'ended') return 'ended'
  const now = Date.now()
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  if (now < start) return 'upcoming'
  if (now > end) return 'ended'
  return 'active'
}

const STATUS_STYLE: Record<Status, string> = {
  upcoming: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  ended: 'bg-muted text-muted-foreground',
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function ActivityDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const t = useTranslations('activities')
  const locale = useLocale()
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['activities', slug],
    queryFn: () => api<{ activity: Activity }>(`/api/activities/${slug}`).then((d) => d.activity),
  })

  const joinMut = useMutation({
    mutationFn: (id: string) => api(`/api/activities/${id}/join`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities', slug] }),
  })
  const leaveMut = useMutation({
    mutationFn: (id: string) => api(`/api/activities/${id}/join`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities', slug] }),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmt = (v?: string) => {
    if (!v) return '-'
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

  if (error || !data)
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <button
          type="button"
          onClick={() => router.push('/activities')}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToList')}
        </button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? t('notFound')}
        </div>
      </div>
    )

  const a = data
  const computedStatus = computeStatus(a.status, a.startAt, a.endAt)
  const ended = computedStatus === 'ended'
  const mut = a.joined ? leaveMut : joinMut

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <button
        type="button"
        onClick={() => router.push('/activities')}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </button>

      <div className="overflow-hidden rounded-lg border bg-card">
        {a.banner ? (
          <div className="relative h-48 w-full sm:h-64">
            <Image src={a.banner} alt={a.title} fill className="object-cover" />
          </div>
        ) : (
          <div className="flex h-48 w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 sm:h-64">
            <Sparkles className="h-12 w-12 text-primary/40" />
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{a.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {fmt(a.startAt)} - {fmt(a.endAt)}
              </span>
              {typeof a.participantCount === 'number' && (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {t('participants', { count: a.participantCount })}
                </span>
              )}
            </div>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-md px-2.5 py-0.5 text-xs font-medium',
              STATUS_STYLE[computedStatus],
            )}
          >
            {t(`status.${computedStatus}`)}
          </span>
        </div>

        {a.description && (
          <div>
            <h2 className="mb-1.5 text-sm font-semibold text-muted-foreground">
              {t('descriptionLabel')}
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed">{a.description}</p>
          </div>
        )}

        {a.rules && Object.keys(a.rules).length > 0 && (
          <div>
            <h2 className="mb-1.5 text-sm font-semibold text-muted-foreground">
              {t('rulesLabel')}
            </h2>
            <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs leading-relaxed">
              {JSON.stringify(a.rules, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={a.joined ? 'outline' : 'default'}
          onClick={() => mut.mutate(a.id)}
          disabled={mut.isPending || ended}
        >
          {mut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : a.joined ? (
            <X className="h-4 w-4" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {a.joined ? t('leave') : t('join')}
        </Button>
        {ended && <span className="text-xs text-muted-foreground">{t('endedHint')}</span>}
      </div>

      {(joinMut.isError || leaveMut.isError) && (
        <div className="text-xs text-destructive">
          {((joinMut.error ?? leaveMut.error) as Error)?.message}
        </div>
      )}
    </div>
  )
}
