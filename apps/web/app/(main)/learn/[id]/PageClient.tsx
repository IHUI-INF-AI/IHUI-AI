'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Clock, Users, PlayCircle, Check, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { ProgressBar } from '@/components/common'
import { cn } from '@/lib/utils'

interface Section {
  id: string
  title: string
  duration?: string
  completed?: boolean
}
interface Chapter {
  id: string
  title: string
  sections: Section[]
}
interface LessonDetail {
  id: string
  title: string
  instructor: string
  description: string
  duration?: string
  students: number
  price: number
  cover?: string
  objectives?: string[]
  chapters?: Chapter[]
  signedUp?: boolean
  progress?: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const formatCNY = (n: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(n)

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const t = useTranslations('learn')
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['learn', 'lesson', id],
    queryFn: () => api<{ lesson: LessonDetail }>(`/api/learn/lessons/${id}`).then((d) => d.lesson),
  })

  const signUpMut = useMutation({
    mutationFn: () => api(`/api/learn/lessons/${id}/sign-up`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learn', 'lesson', id] }),
  })

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <button
          type="button"
          onClick={() => router.push('/learn')}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('detail.back')}
        </button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? t('notFound')}
        </div>
      </div>
    )
  }

  const lesson = data
  const chapters = lesson.chapters ?? []
  const totalSections = chapters.reduce((s, c) => s + c.sections.length, 0)
  const progress = lesson.progress ?? 0

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Link
        href="/learn"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('detail.back')}
      </Link>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-6">
          <div className="space-y-3">
            <div className="flex h-48 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5">
              <PlayCircle className="h-16 w-16 text-primary/30" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{lesson.title}</h1>
            <p className="text-sm text-muted-foreground">{lesson.description}</p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{lesson.instructor}</span>
              {lesson.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {lesson.duration}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {t('signupCount', { count: lesson.students })}
              </span>
            </div>
          </div>

          {lesson.objectives && lesson.objectives.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">{t('detail.objectives')}</h2>
              <ul className="space-y-2">
                {lesson.objectives.map((obj, i) => (
                  <li key={`obj-${i}`} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{t('chapters')}</h2>
              <span className="text-sm text-muted-foreground">({totalSections})</span>
            </div>
            {chapters.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
              <div className="space-y-2">
                {chapters.map((chapter) => (
                  <details key={chapter.id} className="group rounded-lg border">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-accent">
                      <span>{chapter.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {chapter.sections.length}
                      </span>
                    </summary>
                    <div className="border-t">
                      {chapter.sections.map((sec) => (
                        <div
                          key={sec.id}
                          className="flex items-center justify-between px-4 py-2 text-sm transition-colors hover:bg-accent/50"
                        >
                          <span className="flex items-center gap-2 text-muted-foreground">
                            {sec.completed && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                            {sec.title}
                          </span>
                          {sec.duration && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {sec.duration}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="w-full shrink-0 lg:w-72">
          <Card className={cn('sticky top-4')}>
            <CardHeader>
              <CardTitle className="text-2xl">
                {lesson.price > 0 ? formatCNY(lesson.price) : t('free')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                {lesson.duration && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      {t('detail.duration')}
                    </span>
                    <span className="text-foreground">{lesson.duration}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {t('detail.studentsLabel')}
                  </span>
                  <span className="text-foreground">{lesson.students}</span>
                </div>
              </div>

              {lesson.signedUp && (
                <ProgressBar value={progress} showLabel label={t('progress')} size="md" />
              )}

              <Button
                className="w-full"
                size="lg"
                disabled={lesson.signedUp || signUpMut.isPending}
                onClick={() => signUpMut.mutate()}
              >
                {signUpMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {lesson.signedUp ? t('signedUp') : t('signUp')}
              </Button>
              {signUpMut.isError && (
                <p className="text-xs text-destructive">{(signUpMut.error as Error)?.message}</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
