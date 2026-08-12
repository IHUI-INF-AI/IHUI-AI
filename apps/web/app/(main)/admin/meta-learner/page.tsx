'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Brain, Clock, Loader2, Zap } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { formatShortDateTime } from '@/lib/date-utils'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'

type LessonType = 'failure_pattern' | 'improvement_tip' | 'best_practice'
type RunStatus = 'running' | 'success' | 'failed' | 'skipped'

interface StatusData {
  learner: { totalLessons: number; byType: Record<string, number>; avgConfidence: number }
  scheduler: { enabled: boolean; intervalSeconds: number; minFailures: number; running: boolean; historyCount: number }
  skillEvolution: { enabled: boolean; intervalSeconds: number; minFailures: number; maxSkillsPerRun: number; running: boolean; historyCount: number }
}

interface MetaLesson {
  lessonId: string
  lessonType: LessonType
  title: string
  content: string
  sourceSkills: string[]
  occurrenceCount: number
  confidence: number
}

interface HistoryEntry {
  triggered_at: string
  status: RunStatus
  duration_ms: number
  lessons_extracted: number
  error: string | null
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const LESSON_BADGE: Record<LessonType, string> = {
  failure_pattern: 'border-transparent bg-red-500/10 text-red-600',
  improvement_tip: 'border-transparent bg-amber-500/10 text-amber-600',
  best_practice: 'border-transparent bg-emerald-500/10 text-emerald-600',
}

const LESSON_I18N: Record<LessonType, string> = {
  failure_pattern: 'failurePattern',
  improvement_tip: 'improvementTip',
  best_practice: 'bestPractice',
}

const RUN_BADGE: Record<RunStatus, string> = {
  success: 'border-transparent bg-emerald-500/10 text-emerald-600',
  failed: 'border-transparent bg-red-500/10 text-red-600',
  running: 'border-transparent bg-sky-500/10 text-sky-600',
  skipped: 'border-transparent bg-muted text-muted-foreground',
}

const RUN_I18N: Record<RunStatus, string> = {
  success: 'success',
  failed: 'failed',
  running: 'running',
  skipped: 'skipped',
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10">
      {icon}
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-8 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      {label}
    </div>
  )
}

export default function MetaLearnerPage() {
  const t = useTranslations('eduAi.metaLearner')
  const tc = useTranslations('common')
  const locale = useLocale()
  const queryClient = useQueryClient()

  const statusQuery = useQuery({
    queryKey: ['meta-learner', 'status'],
    queryFn: () => api<StatusData>('/api/admin/meta-learner/status'),
  })
  const lessonsQuery = useQuery({
    queryKey: ['meta-learner', 'lessons'],
    queryFn: () => api<{ lessons: MetaLesson[] }>('/api/admin/meta-learner/lessons'),
  })
  const historyQuery = useQuery({
    queryKey: ['meta-learner', 'history'],
    queryFn: () => api<{ history: HistoryEntry[] }>('/api/admin/meta-learner/history?limit=20'),
  })
  const triggerMutation = useMutation({
    mutationFn: () => api<{ status: string }>('/api/admin/meta-learner/trigger', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meta-learner'] }),
  })

  const lessons = lessonsQuery.data?.lessons ?? []
  const history = historyQuery.data?.history ?? []
  const status = statusQuery.data

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Brain className="h-7 w-7 text-primary" />
            {t('title')}
          </h1>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={() => triggerMutation.mutate()} disabled={triggerMutation.isPending}>
          {triggerMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Zap className="mr-1.5 h-4 w-4" />}
          {t('trigger')}
        </Button>
      </header>

      {triggerMutation.isSuccess && <Alert variant="success" title={t('triggerSuccess')} />}
      {triggerMutation.isError && (
        <Alert variant="danger" title={t('triggerError')} description={(triggerMutation.error as Error).message} />
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Activity className="h-5 w-5 text-primary" />
          {t('systemStatus')}
        </h2>
        {statusQuery.isLoading ? (
          <LoadingRow label={tc('loading')} />
        ) : statusQuery.isError ? (
          <Alert variant="danger" description={(statusQuery.error as Error).message} />
        ) : status ? (
          <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4 text-primary" />{t('learner')}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="text-muted-foreground">{t('lessons')}: {status.learner.totalLessons}</p>
                <p className="text-muted-foreground">{t('confidence')}: {(status.learner.avgConfidence * 100).toFixed(0)}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-primary" />{t('scheduler')}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <Badge className={status.scheduler.enabled ? RUN_BADGE.success : RUN_BADGE.skipped}>{status.scheduler.enabled ? t('enabled') : t('disabled')}</Badge>
                <p className="text-muted-foreground">{t('history')}: {status.scheduler.historyCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4 text-primary" />{t('skillEvolution')}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <Badge className={status.skillEvolution.enabled ? RUN_BADGE.success : RUN_BADGE.skipped}>{status.skillEvolution.enabled ? t('enabled') : t('disabled')}</Badge>
                <p className="text-muted-foreground">{t('history')}: {status.skillEvolution.historyCount}</p>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Brain className="h-5 w-5 text-primary" />
          {t('lessons')}
        </h2>
        {lessonsQuery.isLoading ? (
          <LoadingRow label={tc('loading')} />
        ) : lessonsQuery.isError ? (
          <Alert variant="danger" description={(lessonsQuery.error as Error).message} />
        ) : lessons.length === 0 ? (
          <EmptyState icon={<Brain className="h-8 w-8 text-muted-foreground" />} label={t('noLessons')} />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t('lessonType')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('title')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('confidence')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('occurrenceCount')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('sourceSkills')}</th>
                </tr>
              </thead>
              <tbody>
                {lessons.map((lesson) => (
                  <tr key={lesson.lessonId} className="border-t">
                    <td className="px-3 py-2"><Badge className={LESSON_BADGE[lesson.lessonType]}>{t(LESSON_I18N[lesson.lessonType])}</Badge></td>
                    <td className="max-w-xs px-3 py-2">
                      <p className="truncate">{lesson.title}</p>
                      {lesson.content && <p className="line-clamp-1 text-xs text-muted-foreground">{lesson.content}</p>}
                    </td>
                    <td className="px-3 py-2 text-right">{(lesson.confidence * 100).toFixed(0)}%</td>
                    <td className="px-3 py-2 text-right">{lesson.occurrenceCount}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {lesson.sourceSkills.map((s, i) => (
                          <span key={`${i}-${s}`} className="rounded bg-muted px-1.5 py-0.5 text-xs">{s}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Clock className="h-5 w-5 text-primary" />
          {t('history')}
        </h2>
        {historyQuery.isLoading ? (
          <LoadingRow label={tc('loading')} />
        ) : historyQuery.isError ? (
          <Alert variant="danger" description={(historyQuery.error as Error).message} />
        ) : history.length === 0 ? (
          <EmptyState icon={<Clock className="h-8 w-8 text-muted-foreground" />} label={t('noHistory')} />
        ) : (
          <div className="space-y-2">
            {history.map((entry, i) => (
              <Card key={`${i}-${entry.triggered_at}`}>
                <CardContent className="flex flex-wrap items-center gap-3 p-3 text-sm min-[640px]:p-3">
                  <Badge className={RUN_BADGE[entry.status]}>{t(RUN_I18N[entry.status])}</Badge>
                  <span className="text-muted-foreground">{t('runAt')}: {formatShortDateTime(entry.triggered_at, locale)}</span>
                  <span className="text-muted-foreground">{t('duration')}: {(entry.duration_ms / 1000).toFixed(1)}s</span>
                  <span className="text-muted-foreground">{t('lessonsExtracted')}: {entry.lessons_extracted}</span>
                  {entry.error && <span className="text-red-600">{entry.error}</span>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
