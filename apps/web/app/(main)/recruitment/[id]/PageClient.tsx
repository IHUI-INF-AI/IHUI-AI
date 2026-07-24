'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
  Users,
  Award,
  Target,
  UserCheck,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

interface Requirement {
  title: string
  detail: string
}

interface Benefit {
  title: string
  detail: string
}

interface RecruitmentPlan {
  title: string
  subtitle: string
  description: string
  requirements: Requirement[]
  benefits: Benefit[]
  stats: { label: string; value: string }[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function RecruitmentDetailPage() {
  const params = useParams<{ id: string }>()
  const locale = useLocale()
  const t = useTranslations('recruitmentDetailPage')

  const { data, isLoading, error } = useQuery({
    queryKey: ['recruitment', params.id],
    queryFn: () => api<RecruitmentPlan>('/api/recruitment'),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const highlightIdx = (() => {
    const n = Number(params.id)
    return Number.isFinite(n) && n >= 0 ? n : -1
  })()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/recruitment"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? t('notExist')}
        </div>
      </div>
    )
  }

  const requirements = Array.isArray(data.requirements) ? data.requirements : []
  const benefits = Array.isArray(data.benefits) ? data.benefits : []
  const stats = Array.isArray(data.stats) ? data.stats : []
  const statIcons = [TrendingUp, Users, Award]
  const statColors = ['text-primary', 'text-emerald-600', 'text-amber-500']

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href="/recruitment"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1 text-sm text-primary">
          <Target className="h-4 w-4" />
          {data.subtitle ?? t('defaultSubtitle')}
        </div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{data.title}</h1>
        <p className="text-sm text-muted-foreground md:text-base">{data.description}</p>
      </header>

      {stats.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.slice(0, 3).map((s, i) => {
            const Icon = statIcons[i] ?? TrendingUp
            const color = statColors[i] ?? 'text-primary'
            return (
              <Card key={s.label}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg bg-muted',
                      color,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-lg font-bold">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-5 w-5 text-primary" />
              {t('requirementsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {requirements.length > 0 ? (
              <ul className="space-y-3">
                {requirements.map((r, i) => (
                  <li
                    key={r.title}
                    className={cn(
                      'flex items-start gap-2 rounded-md p-2 text-sm transition-colors',
                      highlightIdx === i && 'bg-primary/5',
                    )}
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-medium text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <div className="font-medium">{r.title}</div>
                      <div className="text-muted-foreground">{r.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t('emptyRequirements')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-5 w-5 text-amber-500" />
              {t('benefitsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {benefits.length > 0 ? (
              <ul className="space-y-3">
                {benefits.map((b) => (
                  <li key={b.title} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <div>
                      <div className="font-medium">{b.title}</div>
                      <div className="text-muted-foreground">{b.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t('emptyBenefits')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-5 w-5 text-muted-foreground" />
            {t('applicantsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-2 py-10">
            <Users className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('emptyApplicants')}</p>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-xs text-muted-foreground">
        {t('publishTime', { date: dateFmt.format(new Date()) })}
      </div>
    </div>
  )
}
