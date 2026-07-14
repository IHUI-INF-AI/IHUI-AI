'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { FileCheck, Clock, ListChecks, Target, Loader2, ArrowRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface Exam {
  id: string
  title: string
  description?: string
  questionCount: number
  totalScore: number
  passScore: number
  duration: number
  status?: string
  attempted?: boolean
  bestScore?: number
}
interface ExamsData {
  list: Exam[]
  total: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function EduExamPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'exams'],
    queryFn: () => api<ExamsData>('/api/edu/exam'),
  })

  const exams = data?.list ?? []

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FileCheck className="h-7 w-7 text-primary" />
          在线考试
        </h1>
        <p className="text-sm text-muted-foreground">参加考试并查看成绩</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <Alert variant="danger" description={(error as Error).message} />
      ) : exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <FileCheck className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">暂无考试</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <Card key={exam.id} className="flex h-full flex-col transition-colors hover:bg-accent">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{exam.title}</CardTitle>
                  {exam.attempted && (
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-xs',
                        (exam.bestScore ?? 0) >= exam.passScore
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {(exam.bestScore ?? 0) >= exam.passScore ? '已通过' : '未通过'}
                    </span>
                  )}
                </div>
                {exam.description && (
                  <p className="text-xs text-muted-foreground">{exam.description}</p>
                )}
              </CardHeader>
              <CardContent className="flex-1 space-y-3 p-4 pt-0">
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ListChecks className="h-3.5 w-3.5" />
                    {exam.questionCount} 题
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="h-3.5 w-3.5" />
                    满分 {exam.totalScore}
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="h-3.5 w-3.5" />
                    及格 {exam.passScore}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {exam.duration} 分钟
                  </span>
                </div>
                {exam.bestScore !== undefined && (
                  <p className="text-xs text-muted-foreground">最高分：{exam.bestScore}</p>
                )}
                <Button asChild size="sm" className="w-full">
                  <Link href={`/edu/exam/${exam.id}`}>
                    {exam.attempted ? '再次考试' : '开始考试'}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
