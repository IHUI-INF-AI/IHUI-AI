'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock, Users, PlayCircle, Check, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui'
import { Alert } from '@/components/feedback'

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
interface CourseDetail {
  id: string
  title: string
  instructor: string
  description: string
  duration?: string
  students: number
  cover?: string
  objectives?: string[]
  chapters?: Chapter[]
  progress?: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function EduCourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'course', id],
    queryFn: () => api<{ course: CourseDetail }>(`/api/edu/courses/${id}`).then((d) => d.course),
  })

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )

  if (error || !data) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.push('/edu/courses')}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回课程列表
        </button>
        <Alert variant="danger" description={(error as Error)?.message ?? '课程不存在'} />
      </div>
    )
  }

  const course = data
  const chapters = course.chapters ?? []
  const totalSections = chapters.reduce((s, c) => s + c.sections.length, 0)
  const progress = course.progress ?? 0

  return (
    <div className="space-y-6">
      <Link
        href="/edu/courses"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回课程列表
      </Link>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-6">
          <div className="space-y-3">
            <div className="flex h-48 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5">
              <PlayCircle className="h-16 w-16 text-primary/30" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
            <p className="text-sm text-muted-foreground">{course.description}</p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{course.instructor}</span>
              {course.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {course.duration}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {course.students} 人学习
              </span>
            </div>
          </div>

          {course.objectives && course.objectives.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">学习目标</h2>
              <ul className="space-y-2">
                {course.objectives.map((obj, i) => (
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
              <h2 className="text-lg font-semibold">章节</h2>
              <span className="text-sm text-muted-foreground">({totalSections})</span>
            </div>
            {chapters.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无章节</p>
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
          <Card className="sticky top-4">
            <CardContent className="space-y-4 p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">学习进度</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <Button asChild className="w-full">
                <Link href={`/edu/courses/${id}/learn`}>
                  <PlayCircle className="h-4 w-4" />
                  继续学习
                </Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
