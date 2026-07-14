'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Layers, BookOpen, Users, Loader2, PlayCircle } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

interface TopicLesson {
  id: string
  title: string
  name?: string
  coverImage?: string
  image?: string
  cover?: string
  intro?: string
  instructor?: string
  price?: string | number
  originalPrice?: string | number | null
  isFree?: boolean
}
interface TopicDetail {
  id: string
  title: string
  coverImage?: string
  description?: string
  lessonIds?: string[]
  learnNum?: number
  price?: number
  originalPrice?: number
  lessonList?: TopicLesson[]
  lessons?: TopicLesson[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function LearnTopicDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data, isLoading, error } = useQuery({
    queryKey: ['learn', 'topic', id],
    queryFn: async () => {
      const res = await api<{ topic: TopicDetail }>(`/api/topics/${id}`)
      return res.topic
    },
  })

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )

  if (error || !data)
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <button
          type="button"
          onClick={() => router.push('/learn/topic')}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回专题列表
        </button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? '专题不存在'}
        </div>
      </div>
    )

  const topic = data
  const lessons = topic.lessonList ?? topic.lessons ?? []

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Link
        href="/learn/topic"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回专题列表
      </Link>

      {/* 专题信息 */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row">
          <div className="flex h-40 w-full items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 md:w-64">
            {topic.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={topic.coverImage}
                alt={topic.title}
                className="h-full w-full rounded-lg object-cover"
              />
            ) : (
              <Layers className="h-12 w-12 text-primary/40" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{topic.title}</h1>
            {topic.description && (
              <p className="text-sm text-muted-foreground">{topic.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {topic.lessonIds?.length ?? lessons.length} 门课程
              </span>
              {typeof topic.learnNum === 'number' && (
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {topic.learnNum} 人学
                </span>
              )}
              {typeof topic.price === 'number' && (
                <span className="font-medium text-primary">
                  {topic.price > 0 ? `￥${topic.price}` : '免费'}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 包含的课程列表 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">包含课程</h2>
        {lessons.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
            <PlayCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">暂无课程</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lessons.map((lesson) => {
              const title = lesson.title ?? lesson.name ?? ''
              const cover = lesson.coverImage ?? lesson.image ?? lesson.cover
              return (
                <Link key={lesson.id} href={`/learn/${lesson.id}`} className="group block">
                  <Card className="h-full overflow-hidden transition-colors hover:bg-accent">
                    <div className="flex h-28 items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt={title} className="h-full w-full object-cover" />
                      ) : (
                        <PlayCircle className="h-10 w-10 text-primary/40" />
                      )}
                    </div>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base">{title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 p-4 pt-0 text-sm">
                      {lesson.instructor && (
                        <p className="text-muted-foreground">{lesson.instructor}</p>
                      )}
                      {typeof lesson.price === 'number' && (
                        <span
                          className={
                            lesson.price > 0 ? 'font-medium text-primary' : 'text-emerald-600'
                          }
                        >
                          {lesson.price > 0 ? `￥${lesson.price}` : '免费'}
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
