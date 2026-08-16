'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { BookOpen, Loader2, Clock, MapPin } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'

interface CourseItem {
  id: string
  courseName: string
  teacher: string | null
  weekday: number
  startTime: string
  endTime: string
  classroom: string | null
  color: string | null
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export default function ChildCoursesPage() {
  const t = useTranslations('parentPortal')
  const tc = useTranslations('common')
  const params = useParams()
  const childId = params.childId as string

  const { data, isLoading, error } = useQuery({
    queryKey: ['parent', 'children', childId, 'courses'],
    queryFn: () =>
      api<{ list: CourseItem[] }>(`/api/edu-ai-management/parent/children/${childId}/courses`),
  })

  const courses = data?.list ?? []
  const grouped = courses.reduce<Record<number, CourseItem[]>>((acc, c) => {
    ;(acc[c.weekday] ??= []).push(c)
    return acc
  }, {})

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('child.courses')}</h1>
        <p className="text-xs text-muted-foreground">{t('child.coursesHint')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('loading')}
        </div>
      ) : error ? (
        <Alert variant="danger" description={tc('loadFailed')} />
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('child.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {WEEKDAY_LABELS.map((dayLabel, idx) => {
            const dayCourses = grouped[idx + 1]
            if (!dayCourses) return null
            return (
              <Card key={idx}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{dayLabel}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dayCourses.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border-l-4 bg-card px-3 py-2"
                      style={{ borderLeftColor: c.color ?? '#3b82f6' }}
                    >
                      <p className="text-sm font-medium">{c.courseName}</p>
                      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {c.startTime} - {c.endTime}
                        </div>
                        {c.teacher && (
                          <div className="flex items-center gap-1">
                            <span>{c.teacher}</span>
                          </div>
                        )}
                        {c.classroom && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {c.classroom}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
