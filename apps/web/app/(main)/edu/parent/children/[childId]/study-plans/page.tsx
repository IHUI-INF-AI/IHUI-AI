'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { ClipboardList, Loader2, CalendarDays, Clock } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'
import { Badge } from '@/components/data'

interface StudyPlanItem {
  id: string
  title: string
  planType: string
  startDate: string
  endDate: string
  description: string | null
  status: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  active: '进行中',
  completed: '已完成',
  archived: '已归档',
}

const STATUS_VARIANTS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-amber-100 text-amber-700',
}

export default function ChildStudyPlansPage() {
  const t = useTranslations('parentPortal')
  const tc = useTranslations('common')
  const params = useParams()
  const childId = params.childId as string

  const { data, isLoading, error } = useQuery({
    queryKey: ['parent', 'children', childId, 'study-plans'],
    queryFn: () => api<{ list: StudyPlanItem[] }>(`/api/edu-ai-management/parent/children/${childId}/study-plans`),
  })

  const plans = data?.list ?? []

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('child.studyPlans')}</h1>
        <p className="text-xs text-muted-foreground">{t('child.studyPlansHint')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('loading')}
        </div>
      ) : error ? (
        <Alert variant="danger" description={tc('loadFailed')} />
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
          <ClipboardList className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('child.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    {p.planType === 'monthly' ? <CalendarDays className="h-4 w-4 text-primary" /> : <Clock className="h-4 w-4 text-primary" />}
                    {p.title}
                  </CardTitle>
                  <Badge className={STATUS_VARIANTS[p.status] ?? ''}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>{p.startDate} ~ {p.endDate}</span>
                </div>
                {p.description && (
                  <p className="line-clamp-2 text-muted-foreground">{p.description}</p>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {p.planType === 'monthly' ? t('child.monthlyPlan') : t('child.weeklyPlan')}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}