'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Layers, BookOpen, Loader2, Users } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

interface TopicItem {
  id: string
  title: string
  coverImage?: string
  description?: string
  lessonIds?: string[]
  learnNum?: number
  price?: number
}
interface TopicListData {
  list: TopicItem[]
  total?: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function LearnTopicPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['learn', 'topics'],
    queryFn: () => api<TopicListData>(`/api/topics`),
  })

  const topics = data?.list ?? []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Layers className="h-7 w-7 text-primary" />
          学习专题
        </h1>
        <p className="text-sm text-muted-foreground">精选课程组合，系统化学习</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : topics.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <Layers className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">暂无专题</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic) => (
            <Link key={topic.id} href={`/learn/topic/${topic.id}`} className="group block">
              <Card className="h-full overflow-hidden transition-colors hover:bg-accent">
                <div className="flex h-36 items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                  {topic.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={topic.coverImage}
                      alt={topic.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Layers className="h-10 w-10 text-primary/40" />
                  )}
                </div>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{topic.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 p-4 pt-0 text-xs text-muted-foreground">
                  {topic.description && <p className="break-words">{topic.description}</p>}
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      {topic.lessonIds?.length ?? 0} 门课程
                    </span>
                    {typeof topic.learnNum === 'number' && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {topic.learnNum} 人学
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
