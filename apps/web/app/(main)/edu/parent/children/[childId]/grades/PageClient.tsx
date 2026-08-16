'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { Award, Loader2, TrendingUp, TrendingDown } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'

interface GradeItem {
  id: string
  subject: string
  examName: string
  score: number
  totalScore: number
  examDate: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function ChildGradesPage() {
  const t = useTranslations('parentPortal')
  const tc = useTranslations('common')
  const params = useParams()
  const childId = params.childId as string

  const { data, isLoading, error } = useQuery({
    queryKey: ['parent', 'children', childId, 'grades'],
    queryFn: () =>
      api<{ list: GradeItem[] }>(`/api/edu-ai-management/parent/children/${childId}/grades`),
  })

  const grades = data?.list ?? []

  // 按科目分组
  const grouped = grades.reduce<Record<string, GradeItem[]>>((acc, g) => {
    ;(acc[g.subject] ??= []).push(g)
    return acc
  }, {})

  // 计算各科平均分
  const subjectAvgs = Object.entries(grouped).map(([subject, items]) => {
    const avg = Math.round(items.reduce((s, i) => s + i.score, 0) / items.length)
    const totalScore = items[0]?.totalScore ?? 100
    const percentage = Math.round((avg / totalScore) * 100)
    return { subject, avg, totalScore, percentage, count: items.length }
  })

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('child.grades')}</h1>
        <p className="text-xs text-muted-foreground">{t('child.gradesHint')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('loading')}
        </div>
      ) : error ? (
        <Alert variant="danger" description={tc('loadFailed')} />
      ) : grades.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
          <Award className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('child.empty')}</p>
        </div>
      ) : (
        <>
          {/* 科目概览 */}
          <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
            {subjectAvgs.map((s) => (
              <Card key={s.subject}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{s.subject}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{s.avg}</span>
                    <span className="text-sm text-muted-foreground">/ {s.totalScore}</span>
                    {s.percentage >= 80 ? (
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-muted">
                    <div
                      className={`h-full rounded-md transition-all ${
                        s.percentage >= 80
                          ? 'bg-emerald-500'
                          : s.percentage >= 60
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${s.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('grades.examCount', { count: s.count })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 成绩明细 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('grades.detail')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {grades.map((g) => {
                  const percentage = Math.round((g.score / g.totalScore) * 100)
                  return (
                    <div
                      key={g.id}
                      className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{g.subject}</span>
                          <span className="text-xs text-muted-foreground">{g.examName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{g.examDate}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-lg font-bold ${
                              percentage >= 80
                                ? 'text-emerald-600'
                                : percentage >= 60
                                  ? 'text-amber-600'
                                  : 'text-red-600'
                            }`}
                          >
                            {g.score}
                          </span>
                          <span className="text-xs text-muted-foreground">/ {g.totalScore}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
